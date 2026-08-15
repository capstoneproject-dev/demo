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
$reauthUserSubject = 'user:' . $userId;
$reauthIpSubject = 'ip:' . rateLimitClientIp();
rateLimitEnsureNotBlocked('reauth_failed_user', $reauthUserSubject, 5, 900);
rateLimitEnsureNotBlocked('reauth_failed_ip', $reauthIpSubject, 20, 900);
$user = $userId > 0 ? getUserById($userId) : null;
if (!$user || !password_verify($currentPassword, (string)($user['password_hash'] ?? ''))) {
    rateLimitRecordFailure('reauth_failed_user', $reauthUserSubject, 5, 900);
    rateLimitRecordFailure('reauth_failed_ip', $reauthIpSubject, 20, 900);
    jsonError('The current password is incorrect.', 403, [
        'error_code' => 'REAUTHENTICATION_FAILED',
    ]);
}
rateLimitClear('reauth_failed_user', $reauthUserSubject, 900);

$csrfToken = authMarkReauthenticated(true);
jsonOk([
    'message' => 'Identity confirmed.',
    'csrf_token' => $csrfToken,
    'valid_for' => authEnvironmentSeconds('CAPSTONE_REAUTH_SECONDS', CAPSTONE_REAUTH_SECONDS_DEFAULT, 60),
]);
