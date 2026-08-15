<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/osa_staff.php';

header('Content-Type: application/json');
requirePost();
rateLimitEnsureAllowed('invitation_inspect_ip', 'ip:' . rateLimitClientIp(), 30, 600);

$body = getRequestBody();
$token = trim((string)($body['invitation_token'] ?? ''));

try {
    $pdo = getPdo();
    $invite = findUsableOsaInvitation($pdo, $token);
    if (!$invite) {
        jsonError(OSA_INVITATION_GENERIC_ERROR, 404);
    }
    jsonOk([
        'invitation' => [
            'email' => $invite['email'],
            'employee_number' => $invite['employee_number'],
            'expires_at' => $invite['expires_at'],
        ],
    ]);
} catch (PDOException $e) {
    error_log('[api/auth/osa-invitations/inspect] ' . $e->getMessage());
    jsonError('The invitation could not be checked right now.', 500);
}
