<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/audit.php';

header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
apiRequireRecentReauthentication();
$body = getRequestBody();
$targetId = (int)($body['user_id'] ?? 0);
if ($targetId <= 0 || $targetId === (int)$session['user_id']) {
    jsonError('Select another active OSA staff account.', 422);
}

$pdo = getPdo();
try {
    $pdo->beginTransaction();
    $locked = $pdo->query(
        "SELECT * FROM users WHERE account_type = 'osa_staff' ORDER BY user_id FOR UPDATE"
    )->fetchAll();
    $current = null;
    $target = null;
    foreach ($locked as $row) {
        if ((int)$row['user_id'] === (int)$session['user_id'] && (int)$row['is_primary_osa'] === 1) $current = $row;
        if ((int)$row['user_id'] === $targetId) $target = $row;
    }
    if (!$current) throw new InvalidArgumentException('Primary authority changed. Refresh and try again.');
    if (!$target || (int)$target['is_active'] !== 1) {
        throw new InvalidArgumentException('The selected OSA account must be active.');
    }

    $pdo->exec("UPDATE users SET is_primary_osa = 0 WHERE account_type = 'osa_staff' AND is_primary_osa = 1");
    $promote = $pdo->prepare(
        "UPDATE users SET is_primary_osa = 1
         WHERE user_id = :target_id AND account_type = 'osa_staff' AND is_active = 1"
    );
    $promote->execute([':target_id' => $targetId]);
    if ($promote->rowCount() !== 1) throw new RuntimeException('Primary transfer could not be completed.');

    appendAuditLog(
        'osa_primary_transferred',
        'osa_staff',
        (string)$targetId,
        $current,
        $target,
        ['primary_user_id' => (int)$current['user_id']],
        ['primary_user_id' => $targetId],
        'success',
        $pdo
    );
    $pdo->commit();
    jsonOk(['message' => 'Primary OSA authority transferred.']);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/transfer-primary] ' . $e->getMessage());
    jsonError('Could not transfer Primary authority right now.', 500);
}
