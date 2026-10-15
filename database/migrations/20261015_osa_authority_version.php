<?php
/** Run before deploying the OSA authority-session guards. Existing sessions start at version zero. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function migrateOsaAuthorityVersion(PDO $pdo): void
{
    if (!in_array('osa_authority_version', $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN), true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN osa_authority_version INT UNSIGNED NOT NULL DEFAULT 0');
    }
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/../../config/db.php';
    migrateOsaAuthorityVersion(getPdo());
    echo "OSA authority session version migration completed.\n";
}
