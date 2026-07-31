<?php
/**
 * POST /api/auth/register-osa.php
 *
 * Create an invited OSA staff account.
 * Body fields:
 *   invitation_token, employee_number, first_name, last_name, email, phone,
 *   password, confirm_password, privacy_consent, verification_token
 *
 * Returns JSON: { ok: true, user_id } | { ok: false, error }
 * On success a PHP session is also started so the JS can redirect immediately.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/otp.php';
require_once __DIR__ . '/../../includes/osa_staff.php';

header('Content-Type: application/json');

requirePost();

$body            = getRequestBody();
$employeeNumber  = trim($body['employee_number']  ?? '');
$firstName       = trim($body['first_name']       ?? '');
$lastName        = trim($body['last_name']        ?? '');
$email           = trim($body['email']            ?? '');
$phone           = trim($body['phone']            ?? '');
$password        = $body['password']              ?? '';
$confirmPassword = $body['confirm_password']      ?? '';
$verificationToken = trim($body['verification_token'] ?? '');
$invitationToken = trim($body['invitation_token'] ?? '');
$privacyConsent = filter_var($body['privacy_consent'] ?? false, FILTER_VALIDATE_BOOLEAN);

// --- Validation ---
if (!$employeeNumber || !$firstName || !$email || !$password || !$confirmPassword || !$invitationToken) {
    jsonError('Please complete all fields.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address.');
}
if ($password !== $confirmPassword) {
    jsonError('Passwords do not match.');
}
if (strlen($password) < 8) {
    jsonError('Password must be at least 8 characters.');
}
if (!$privacyConsent) {
    jsonError('Privacy consent is required.');
}

// --- Consume verification and create user atomically ---
$pdo = getPdo();
try {
    $pdo->beginTransaction();
    $invite = requireMatchingOsaInvitation(
        $pdo,
        $invitationToken,
        $email,
        $employeeNumber,
        true
    );
    $duplicate = $pdo->prepare(
        "SELECT 1 FROM users
         WHERE LOWER(email) = :email OR employee_number = :employee_number
         LIMIT 1"
    );
    $duplicate->execute([
        ':email' => normalizeOsaInvitationEmail($email),
        ':employee_number' => $employeeNumber,
    ]);
    if ($duplicate->fetchColumn()) {
        throw new InvalidArgumentException(OSA_INVITATION_GENERIC_ERROR);
    }
    consumeOtpVerification($pdo, $verificationToken, 'osa_registration', $email, $employeeNumber);
    $userId = createOsaUser([
        'pdo'             => $pdo,
        'employee_number' => $employeeNumber,
        'first_name'      => $firstName,
        'last_name'       => $lastName,
        'email'           => $email,
        'phone'           => $phone,
        'password'        => $password,
    ]);
    $accepted = $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET status = 'accepted',
             accepted_by_user_id = :user_id,
             accepted_at = CURRENT_TIMESTAMP
         WHERE invitation_id = :invitation_id AND status = 'pending'"
    );
    $accepted->execute([
        ':user_id' => $userId,
        ':invitation_id' => (int)$invite['invitation_id'],
    ]);
    if ($accepted->rowCount() !== 1) {
        throw new InvalidArgumentException(OSA_INVITATION_GENERIC_ERROR);
    }
    $createdUser = [
        'user_id' => $userId,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => normalizeOsaInvitationEmail($email),
        'employee_number' => $employeeNumber,
    ];
    appendAuditLog(
        'osa_invitation_accepted',
        'osa_staff',
        (string)$userId,
        $createdUser,
        $createdUser,
        ['invitation_id' => (int)$invite['invitation_id'], 'status' => 'pending'],
        ['invitation_id' => (int)$invite['invitation_id'], 'status' => 'accepted'],
        'success',
        $pdo
    );
    $pdo->commit();
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/auth/register-osa] ' . $e->getMessage());
    jsonError('Could not create the account right now.', 500);
}

// --- Build and persist session ---
$user = getUserById($userId);
if (!$user) jsonError('Account created but could not load profile.', 500);

$sessionPayload = buildSessionPayload($user, [], 'osa');
startUserSession($sessionPayload);

jsonOk([
    'user_id'       => $userId,
    'user'          => [
        'user_id'         => $userId,
        'account_type'    => 'osa_staff',
        'first_name'      => $firstName,
        'last_name'       => $lastName,
        'email'           => $email,
        'student_number'  => null,
        'employee_number' => $employeeNumber,
        'program_code'    => null,
        'section'         => null,
    ],
    'memberships'   => [],
    'legacyProfile' => buildLegacyProfile($user, 'Office of Student Affairs'),
]);
