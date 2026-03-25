<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';

header('Content-Type: application/json');

apiGuard();
requirePost();

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    jsonError('Not authenticated.', 401);
}

$body = getRequestBody();
$currentPassword = (string)($body['current_password'] ?? '');
$newPassword = (string)($body['new_password'] ?? '');
$confirmPassword = (string)($body['confirm_password'] ?? '');

if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
    jsonError('All password fields are required.', 422);
}

if ($newPassword !== $confirmPassword) {
    jsonError('New passwords do not match.', 422);
}

if (strlen($newPassword) < 8) {
    jsonError('New password must be at least 8 characters.', 422);
}

$user = getUserById($userId);
if (!$user) {
    jsonError('User not found.', 404);
}

if (!password_verify($currentPassword, (string)($user['password_hash'] ?? ''))) {
    jsonError('Current password is incorrect.', 422);
}

try {
    $stmt = getPdo()->prepare('
        UPDATE users
        SET password_hash = :password_hash,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :user_id
        LIMIT 1
    ');
    $stmt->execute([
        ':password_hash' => password_hash($newPassword, PASSWORD_BCRYPT),
        ':user_id' => $userId,
    ]);

    jsonOk(['message' => 'Password updated successfully.']);
} catch (PDOException $e) {
    error_log('[api/osa/profile/update-password] ' . $e->getMessage());
    jsonError('Could not update password right now.', 500);
}
