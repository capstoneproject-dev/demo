<?php
/**
 * POST /api/auth/forgot-password-reset.php
 *
 * Verified reset flow. A single-use server-issued email verification token is
 * required before the password can be changed.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/otp.php';

header('Content-Type: application/json');

requirePost();

$body = getRequestBody();
$accountIdentifier = trim((string)($body['student_number'] ?? $body['identifier'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$verificationToken = trim((string)($body['verification_token'] ?? ''));
$newPassword = (string)($body['new_password'] ?? '');

if ($accountIdentifier === '' || $email === '' || $verificationToken === '' || $newPassword === '') {
    jsonError('Student or employee number, email verification, and new password are required.', 422);
}

if (strlen($newPassword) < 8) {
    jsonError('New password must be at least 8 characters.', 422);
}

rateLimitEnsureAllowed('password_reset_ip', 'ip:' . rateLimitClientIp(), 30, 3600);

try {
    $pdo = getPdo();

    $stmt = $pdo->prepare(
        "SELECT user_id
         FROM users
         WHERE (student_number = :student_number OR employee_number = :employee_number)
           AND email = :email
           AND is_active = 1
         LIMIT 1"
    );
    $stmt->execute([
        ':student_number' => $accountIdentifier,
        ':employee_number' => $accountIdentifier,
        ':email' => $email,
    ]);

    $user = $stmt->fetch();
    if (!$user) {
        jsonError('No matching active account was found.', 404);
    }
    rateLimitEnsureAllowed('password_reset_account', 'user:' . (int)$user['user_id'], 5, 3600);

    $pdo->beginTransaction();
    consumeOtpVerification($pdo, $verificationToken, 'password_reset', $email, $accountIdentifier);

    $update = $pdo->prepare(
        "UPDATE users
         SET password_hash = :password_hash,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = :user_id
         LIMIT 1"
    );
    $update->execute([
        ':password_hash' => password_hash($newPassword, PASSWORD_BCRYPT),
        ':user_id' => (int)$user['user_id'],
    ]);
    $pdo->commit();

    jsonOk([
        'message' => 'Password reset successfully.',
    ]);
} catch (InvalidArgumentException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/auth/forgot-password-reset] ' . $e->getMessage());
    jsonError('Could not reset the password right now.', 500);
}
