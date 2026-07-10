<?php
/**
 * POST /api/auth/register-osa.php
 *
 * Create an OSA staff account directly (no approval queue).
 * Body fields:
 *   employee_number, first_name, last_name, email, password, confirm_password
 *
 * Returns JSON: { ok: true, user_id } | { ok: false, error }
 * On success a PHP session is also started so the JS can redirect immediately.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/otp.php';

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

// --- Validation ---
if (!$employeeNumber || !$firstName || !$email || !$password || !$confirmPassword) {
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
if (emailExists($email)) {
    jsonError('An account with that email already exists.');
}
if (employeeNumberExists($employeeNumber)) {
    jsonError('An account with that employee number already exists.');
}

// --- Consume verification and create user atomically ---
$pdo = getPdo();
try {
    $pdo->beginTransaction();
    consumeOtpVerification($pdo, $verificationToken, 'osa_registration', $email, $employeeNumber);
    $userId = createOsaUser([
        'employee_number' => $employeeNumber,
        'first_name'      => $firstName,
        'last_name'       => $lastName,
        'email'           => $email,
        'phone'           => $phone,
        'password'        => $password,
    ]);
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
