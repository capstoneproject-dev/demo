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

if ($targetId <= 0) {
    jsonError('Select an inactive OSA staff account to remove.', 422);
}

$pdo = getPdo();
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        "SELECT * FROM users
         WHERE user_id = :user_id AND account_type = 'osa_staff'
         LIMIT 1 FOR UPDATE"
    );
    $stmt->execute([':user_id' => $targetId]);
    $target = $stmt->fetch();

    if (!$target) {
        throw new InvalidArgumentException('OSA staff account not found.');
    }
    if ((int)$target['is_primary_osa'] === 1 || $targetId === (int)$session['user_id']) {
        throw new InvalidArgumentException('The Primary OSA account cannot be removed.');
    }
    if ((int)$target['is_active'] === 1) {
        throw new InvalidArgumentException('Deactivate this OSA staff account before removing it.');
    }

    $delete = $pdo->prepare(
        "DELETE FROM users
         WHERE user_id = :user_id
           AND account_type = 'osa_staff'
           AND is_active = 0
           AND is_primary_osa = 0"
    );
    $delete->execute([':user_id' => $targetId]);
    if ($delete->rowCount() !== 1) {
        throw new InvalidArgumentException('The OSA staff account could not be removed.');
    }

    appendAuditLog(
        'osa_account_removed',
        'osa_staff',
        (string)$targetId,
        getUserById((int)$session['user_id']),
        $target,
        [
            'is_active' => 0,
            'is_primary_osa' => 0,
            'account_exists' => true,
        ],
        ['account_exists' => false],
        'success',
        $pdo
    );
    $pdo->commit();
    jsonOk(['message' => 'Inactive OSA staff account removed.']);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/delete] ' . $e->getMessage());
    if ((string)$e->getCode() === '23000') {
        jsonError('This OSA staff account has linked system records and cannot be removed. Keep it inactive instead.', 409);
    }
    jsonError('Could not remove the OSA staff account right now.', 500);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/delete] ' . $e->getMessage());
    jsonError('Could not remove the OSA staff account right now.', 500);
}
