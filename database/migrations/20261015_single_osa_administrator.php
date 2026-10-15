<?php
/** Run during maintenance: php database/migrations/20261015_single_osa_administrator.php */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function migrateSingleOsaAdministrator(PDO $pdo): void
{
    $pdo->beginTransaction();
    try {
        $rows = $pdo->query("SELECT user_id, is_active, is_primary_osa FROM users WHERE account_type = 'osa_staff' ORDER BY user_id FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
        $primary = array_values(array_filter($rows, static fn(array $row): bool => (int)$row['is_active'] === 1 && (int)$row['is_primary_osa'] === 1));
        if (count($primary) !== 1) throw new RuntimeException('Migration stopped: select exactly one active primary OSA administrator before retrying.');
        $pdo->prepare("UPDATE users SET is_active = 0, is_primary_osa = 0 WHERE account_type = 'osa_staff' AND user_id <> ?")->execute([(int)$primary[0]['user_id']]);
        $pdo->exec("UPDATE osa_staff_invitations SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE status = 'pending'");
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    // DDL commits implicitly in MariaDB/MySQL. Reruns safely finish an interrupted rollout.
    $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('active_osa_singleton', $columns, true)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN active_osa_singleton TINYINT
            GENERATED ALWAYS AS (CASE WHEN account_type = 'osa_staff' AND is_active = 1 THEN 1 ELSE NULL END) STORED");
    }
    $index = $pdo->query("SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uq_users_single_active_osa'")->fetchAll(PDO::FETCH_ASSOC);
    if (!$index) {
        $pdo->exec('ALTER TABLE users ADD UNIQUE KEY uq_users_single_active_osa (active_osa_singleton)');
    } elseif (count($index) !== 1 || $index[0]['COLUMN_NAME'] !== 'active_osa_singleton' || (int)$index[0]['NON_UNIQUE'] !== 0) {
        throw new RuntimeException('The OSA singleton index has an unexpected definition. Operator attention is required.');
    }
    $stmt = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'chk_active_osa_primary'");
    if (!(int)$stmt->fetchColumn()) {
        $pdo->exec("ALTER TABLE users ADD CONSTRAINT chk_active_osa_primary
            CHECK (account_type <> 'osa_staff' OR is_active <> 1 OR is_primary_osa = 1)");
    }
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/../../config/db.php';
    migrateSingleOsaAdministrator(getPdo());
    echo "Single OSA administrator migration completed.\n";
}
