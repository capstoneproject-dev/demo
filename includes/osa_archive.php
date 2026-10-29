<?php
require_once __DIR__ . '/osa_registration.php';

function transferOsaAdministrator(PDO $pdo, int $actorId, int $targetId, ?int $authorityVersion = null): array
{
    $pdo->beginTransaction();
    try {
        $actor = lockCurrentOsaAdministrator($pdo, $actorId, $authorityVersion);
        $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id=? AND account_type='osa_staff' FOR UPDATE");
        $stmt->execute([$targetId]);
        $target = $stmt->fetch();
        if (!$target || $actorId === $targetId || (int)$target['is_active'] !== 0
            || (int)$target['is_primary_osa'] !== 0 || $target['osa_archived_at'] !== null) {
            throw new InvalidArgumentException('Select an inactive former administrator from the Current list. Archived accounts must be restored first.');
        }
        $pdo->prepare('UPDATE users SET is_active=0, is_primary_osa=0, osa_authority_version=osa_authority_version+1 WHERE user_id=?')->execute([$actorId]);
        $pdo->prepare('UPDATE users SET is_active=1, is_primary_osa=1, osa_authority_version=osa_authority_version+1 WHERE user_id=?')->execute([$targetId]);
        appendAuditLog('osa_administrator_transferred', 'osa_staff', (string)$targetId, $actor, $target,
            ['administrator_user_id' => $actorId], ['administrator_user_id' => $targetId], 'success', $pdo);
        $pdo->commit();
        return ['transfer_completed' => true, 'message' => 'Administrator authority transferred. Sign in with the selected administrator account.'];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function archiveOsaAdministrator(PDO $pdo, int $actorId, int $targetId, bool $archive, ?int $authorityVersion = null): void
{
    $pdo->beginTransaction();
    try {
        $actor = lockCurrentOsaAdministrator($pdo, $actorId, $authorityVersion);
        $stmt = $pdo->prepare("SELECT * FROM users WHERE user_id=? AND account_type='osa_staff' FOR UPDATE");
        $stmt->execute([$targetId]);
        $target = $stmt->fetch();
        if (!$target || (int)$target['is_active'] !== 0 || (int)$target['is_primary_osa'] !== 0 || $actorId === $targetId) {
            throw new InvalidArgumentException('Only inactive former OSA administrators can be archived or restored.');
        }
        $wasArchived = $target['osa_archived_at'] !== null;
        if ($wasArchived === $archive) throw new InvalidArgumentException($archive ? 'This account is already archived.' : 'This account is not archived.');
        $pdo->prepare('UPDATE users SET osa_archived_at=' . ($archive ? 'CURRENT_TIMESTAMP' : 'NULL') . ' WHERE user_id=?')->execute([$targetId]);
        appendAuditLog($archive ? 'osa_administrator_archived' : 'osa_administrator_unarchived', 'osa_staff', (string)$targetId,
            $actor, $target, ['archived' => $wasArchived, 'is_active' => false], ['archived' => $archive, 'is_active' => false], 'success', $pdo);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
