<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../config/db.php';
$pdo = getPdo();
$snapshot = static function () use ($pdo): string {
    return hash('sha256', serialize([
        $pdo->query('SELECT * FROM users ORDER BY user_id')->fetchAll(),
        $pdo->query('SELECT * FROM system_settings ORDER BY setting_key')->fetchAll(),
    ]));
};
$before = $snapshot();
$sql = file_get_contents(__DIR__ . '/../../database/migrations/20261003_live_student_account_schema_fix.sql');
$sql = preg_replace('/--[^\r\n]*/', '', $sql);
try {
    for ($run = 0; $run < 2; $run++) {
        foreach (explode(';', $sql) as $statement) {
            if (trim($statement) !== '') {
                $result = $pdo->query($statement);
                do { if ($result->columnCount() > 0) $result->fetchAll(); } while ($result->nextRowset());
                $result->closeCursor();
            }
        }
        if ($snapshot() !== $before) throw new RuntimeException('Import changed already-migrated account/settings data.');
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
echo "PASS: SQL imported twice on the repaired local database without changing users or settings.\n";
