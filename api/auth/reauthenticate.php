<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

header('Content-Type: application/json');
requirePost();
apiGuard();

$body = getRequestBody();
$currentPassword = (string)($body['current_password'] ?? '');
if ($currentPassword === '') {
    jsonError('Current password is required.', 422);
}

$session = getPhpSession();
$userId = (int)($session['user_id'] ?? $_SESSION['user_id'] ?? 0);
$user = $userId > 0 ? getUserById($userId) : null;
if (!$user || !password_verify($currentPassword, (string)($user['password_hash'] ?? ''))) {
    jsonError('The current password is incorrect.', 403, [
        'error_code' => 'REAUTHENTICATION_FAILED',
    ]);
}

$csrfToken = authMarkReauthenticated(true);
jsonOk([
    'message' => 'Identity confirmed.',
    'csrf_token' => $csrfToken,
    'valid_for' => authEnvironmentSeconds('CAPSTONE_REAUTH_SECONDS', CAPSTONE_REAUTH_SECONDS_DEFAULT, 60),
]);
