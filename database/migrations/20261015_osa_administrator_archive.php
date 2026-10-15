<?php
/** Run: php database/migrations/20261015_osa_administrator_archive.php */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function migrateOsaAdministratorArchive(PDO $pdo): void
{
    $columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('osa_archived_at', $columns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN osa_archived_at DATETIME NULL');
    }
    $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='users' AND CONSTRAINT_NAME='chk_osa_archive_inactive'")->fetchColumn();
    if (!(int)$exists) {
        $pdo->exec("ALTER TABLE users ADD CONSTRAINT chk_osa_archive_inactive CHECK
            (osa_archived_at IS NULL OR (account_type='osa_staff' AND is_active=0 AND is_primary_osa=0))");
    }
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/../../config/db.php';
    migrateOsaAdministratorArchive(getPdo());
    echo "OSA administrator archive migration completed.\n";
}
