<?php
/**
 * POST /api/auth/login.php
 *
 * Accepts JSON body or form-encoded POST.
 * Body fields:
 *   identifier  — email, student number, or employee number
 *   password    — plain-text password (compared against bcrypt hash)
 *
 * Returns JSON:
 *   { ok: true,  user: {...}, memberships: [...], legacyProfile: {...} }
 *   { ok: false, error: "..." }
 *
 * On success a PHP session is created. The JS caller receives the data,
 * builds the full session payload client-side (same logic as before),
 * saves it to localStorage, and then redirects.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/otp.php';

header('Content-Type: application/json');

requirePost();

$body       = getRequestBody();
$identifier = trim($body['identifier'] ?? '');
$password   = $body['password'] ?? '';
$verificationToken = trim((string)($body['verification_token'] ?? ''));
$testingBypassOtp = filter_var($body['testing_bypass_otp'] ?? false, FILTER_VALIDATE_BOOLEAN);

if (!$identifier || !$password) {
    jsonError('Please enter your email / ID and password.');
}

try {

// --- Look up user ---
$user = findUserByIdentifier($identifier);

if (!$user) {
    jsonError('Account not found. Please check your credentials or register first.');
}

if (!$user['is_active']) {
    jsonError('Your account is inactive. Please contact administration.');
}

if (!password_verify($password, $user['password_hash'])) {
    jsonError('Invalid password. Please try again.');
}

$requestHost = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
$requestHost = preg_replace('/:\d+$/', '', $requestHost);
$requestIp = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
$localTestingRequest = in_array($requestHost, ['localhost', '127.0.0.1', '::1'], true)
    && in_array($requestIp, ['127.0.0.1', '::1'], true);

if ($testingBypassOtp && !$localTestingRequest) {
    jsonError('The OSA OTP testing bypass is available only on localhost.', 403);
}

if ($testingBypassOtp && ($user['account_type'] ?? '') === 'osa_staff') {
    error_log(sprintf(
        '[api/auth/login] LOCAL TESTING ONLY: OTP bypass used for OSA user_id=%d from %s.',
        (int)$user['user_id'],
        $requestIp
    ));
}

// Every OSA account, including the primary account and all staff accounts,
// must complete a fresh email OTP challenge before a session is created.
if (($user['account_type'] ?? '') === 'osa_staff' && !$testingBypassOtp) {
    $otpIdentifier = (string)(int)$user['user_id'];
    $otpEmail = strtolower(trim((string)$user['email']));

    if ($verificationToken === '') {
        $challenge = createOtpChallenge('osa_login', $otpEmail, $otpIdentifier);
        jsonOk([
            'otp_required' => true,
            'challenge_token' => $challenge['challenge_token'],
            'expires_in' => $challenge['expires_in'],
            'resend_after' => $challenge['resend_after'],
            'message' => 'Enter the verification code sent to the email registered to this OSA account.',
        ]);
    }

    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        consumeOtpVerification($pdo, $verificationToken, 'osa_login', $otpEmail, $otpIdentifier);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

// --- Build memberships ---
$memberships = getOfficerMemberships((int)$user['user_id']);

// --- Resolve mapped student organization from program_id ---
$mappedOrg = !empty($user['program_id'])
    ? getMappedOrgByProgram((int)$user['program_id'])
    : null;

// --- Determine base login role ---
$loginRole = match($user['account_type']) {
    'osa_staff' => 'osa',
    default     => (count($memberships) > 0 ? 'student' : 'student'),
    // JS will upgrade to 'org' when the user picks an officer dashboard
};

// --- Store base PHP session (org choice happens client-side via the modal) ---
$sessionPayload = buildSessionPayload(
    $user,
    $memberships,
    $loginRole,
    null,
    $mappedOrg['org_name'] ?? null,
    isset($mappedOrg['org_id']) ? (int)$mappedOrg['org_id'] : null
);
startUserSession($sessionPayload);

// --- Update last_login_at ---
touchLastLogin((int)$user['user_id']);
$user = getUserById((int)$user['user_id']) ?: $user;

// --- Build the legacy profile (needed by studentDashboard.js) ---
$legacyProfile = buildLegacyProfile($user, $mappedOrg['org_name'] ?? null);

jsonOk([
    'user'          => [
        'user_id'         => (int)$user['user_id'],
        'account_type'    => $user['account_type'],
        'is_primary_osa'  => ($user['account_type'] ?? '') === 'osa_staff'
                                && (int)($user['is_primary_osa'] ?? 0) === 1,
        'first_name'      => $user['first_name'],
        'last_name'       => $user['last_name'],
        'email'           => $user['email'],
        'phone'           => $user['phone'] ?? null,
        'profile_photo'   => $user['profile_photo'] ?? null,
        'student_number'  => $user['student_number'],
        'employee_number' => $user['employee_number'],
        'program_code'    => $user['program_code'] ?? null,
        'section'         => $user['student_numbers_year_section'] ?? $user['year_section'] ?? ($user['section'] ?? null),
        'program_id'      => $user['program_id'] ?? null,
        'institute_id'    => $user['institute_id'] ?? null,
        'last_login_at'   => $user['last_login_at'] ?? null,
        'mapped_org_id'   => isset($mappedOrg['org_id']) ? (int)$mappedOrg['org_id'] : null,
        'mapped_org_name' => $mappedOrg['org_name'] ?? null,
    ],
    'memberships'   => $memberships,
    'legacyProfile' => $legacyProfile,
]);

} catch (PDOException $e) {
    error_log('[api/auth/login] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (OtpRateLimitException $e) {
    http_response_code(429);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'retry_after' => $e->retryAfter,
    ]);
    exit;
} catch (RuntimeException $e) {
    error_log('[api/auth/login] ' . $e->getMessage());
    jsonError('Could not send the verification code right now.', 503);
}
