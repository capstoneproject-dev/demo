<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/audit.php';

header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
$body = getRequestBody();
$targetId = (int)($body['user_id'] ?? 0);
$active = array_key_exists('is_active', $body)
    ? filter_var($body['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
    : null;
if ($targetId <= 0 || $active === null) jsonError('A staff account and status are required.', 422);

$pdo = getPdo();
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        "SELECT * FROM users WHERE user_id = :id AND account_type = 'osa_staff' LIMIT 1 FOR UPDATE"
    );
    $stmt->execute([':id' => $targetId]);
    $target = $stmt->fetch();
    if (!$target) throw new InvalidArgumentException('OSA staff account not found.');
    if ((int)$target['is_primary_osa'] === 1) {
        throw new InvalidArgumentException('Transfer Primary authority before changing this account.');
    }
    if ($targetId === (int)$session['user_id'] && !$active) {
        throw new InvalidArgumentException('You cannot deactivate your own account.');
    }

    $pdo->prepare("UPDATE users SET is_active = :active WHERE user_id = :id")
        ->execute([':active' => $active ? 1 : 0, ':id' => $targetId]);
    appendAuditLog(
        $active ? 'osa_account_activated' : 'osa_account_deactivated',
        'osa_staff',
        (string)$targetId,
        getUserById((int)$session['user_id']),
        $target,
        ['is_active' => (int)$target['is_active']],
        ['is_active' => $active ? 1 : 0],
        'success',
        $pdo
    );
    $pdo->commit();
    jsonOk(['message' => $active ? 'OSA account activated.' : 'OSA account deactivated.']);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/status] ' . $e->getMessage());
    jsonError('Could not update the account right now.', 500);
}
