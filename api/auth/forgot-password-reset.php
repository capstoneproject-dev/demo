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
$studentNumber = trim((string)($body['student_number'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$verificationToken = trim((string)($body['verification_token'] ?? ''));
$newPassword = (string)($body['new_password'] ?? '');

if ($studentNumber === '' || $email === '' || $verificationToken === '' || $newPassword === '') {
    jsonError('Student number, email verification, and new password are required.', 422);
}

if (strlen($newPassword) < 8) {
    jsonError('New password must be at least 8 characters.', 422);
}

try {
    $pdo = getPdo();

    $stmt = $pdo->prepare(
        "SELECT user_id
         FROM users
         WHERE student_number = :student_number
           AND email = :email
           AND is_active = 1
         LIMIT 1"
    );
    $stmt->execute([
        ':student_number' => $studentNumber,
        ':email' => $email,
    ]);

    $user = $stmt->fetch();
    if (!$user) {
        jsonError('No matching active account was found.', 404);
    }

    $pdo->beginTransaction();
    consumeOtpVerification($pdo, $verificationToken, 'password_reset', $email, $studentNumber);

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
