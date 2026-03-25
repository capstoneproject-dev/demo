<?php
/**
 * POST /api/auth/forgot-password-reset.php
 *
 * Simulation-backed reset flow:
 * - Accepts student_number + email + otp + new_password
 * - If a matching active account exists in users, updates password_hash
 *   to the chosen new password after OTP verification.
 */

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');

requirePost();

$body = getRequestBody();
$studentNumber = trim((string)($body['student_number'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$otp = trim((string)($body['otp'] ?? ''));
$newPassword = (string)($body['new_password'] ?? '');

if ($studentNumber === '' || $email === '' || $otp === '' || $newPassword === '') {
    jsonError('Student number, email, OTP, and new password are required.', 422);
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

    jsonOk([
        'message' => 'Password reset successfully.',
    ]);
} catch (PDOException $e) {
    error_log('[api/auth/forgot-password-reset] ' . $e->getMessage());
    jsonError('Could not reset the password right now.', 500);
}
