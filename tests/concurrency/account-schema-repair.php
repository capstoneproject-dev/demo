<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../config/db.php';
$pdo = getPdo();
$columns = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
$settingsExists = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'system_settings'")->fetchColumn();
if (!$settingsExists) throw new RuntimeException('Existing system_settings table required; no new tables will be created.');
$keys = "('student_account_institute_backfilled','student_account_roster_year_section_backfilled')";
$markers = $pdo->query('SELECT * FROM system_settings WHERE setting_key IN ' . $keys)->fetchAll();
echo json_encode(['database' => DB_NAME, 'missing_columns' => array_values(array_diff(['institute_id', 'year_section'], $columns)), 'migration_markers' => array_column($markers, 'setting_key')]) . "\n";
if (($argv[1] ?? '') === 'verify') {
    $backup = json_decode(file_get_contents($argv[2]), true, 512, JSON_THROW_ON_ERROR);
    $current = $pdo->query('SELECT * FROM users')->fetchAll();
    if (count($current) !== count($backup['users'])) throw new RuntimeException('User count changed.');
    $byId = array_column($current, null, 'user_id');
    foreach ($backup['users'] as $old) {
        $new = $byId[$old['user_id']] ?? null;
        if (!$new) throw new RuntimeException('Original user missing.');
        foreach ($old as $field => $value) {
            if (in_array($field, ['institute_id', 'updated_at'], true)) continue;
            if ($new[$field] !== $value) throw new RuntimeException('Unexpected user field change: ' . $field);
        }
        if ($old['institute_id'] !== null && $new['institute_id'] !== $old['institute_id']) throw new RuntimeException('Existing account institute overwritten.');
    }
    $mismatch = $pdo->query("SELECT COUNT(*) FROM users u JOIN student_numbers sn ON sn.student_number = u.student_number WHERE u.account_type = 'student' AND NOT (u.year_section <=> sn.year_section)")->fetchColumn();
    if ((int)$mismatch !== 0) throw new RuntimeException('Initial account section backfill mismatch.');
    echo "PASS: User count and unrelated account fields preserved; existing institutes preserved; initial sections match the roster.\n";
    exit;
}
if (($argv[1] ?? '') !== 'apply') exit;
if (!in_array('year_section', $columns, true) && in_array('student_account_roster_year_section_backfilled', array_column($markers, 'setting_key'), true)) {
    throw new RuntimeException('Backfill marker exists without its column; investigate before repair.');
}
$backup = ['users_schema' => $pdo->query('SHOW CREATE TABLE users')->fetch(PDO::FETCH_NUM)[1], 'users' => $pdo->query('SELECT * FROM users')->fetchAll(), 'markers' => $markers];
$backupPath = sys_get_temp_dir() . '/capstone-account-schema-backup-' . bin2hex(random_bytes(8)) . '.json';
if (file_put_contents($backupPath, json_encode($backup, JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Backup failed.');
echo "Backup saved outside the web root: $backupPath\n";
$sql = file_get_contents(__DIR__ . '/../../database/migrations/20260929_split_student_account_roster.sql');
// The table is already present. Honor this project's no-additional-tables scope.
$sql = preg_replace('/CREATE TABLE IF NOT EXISTS system_settings\s*\(.*?\) ENGINE=.*?;/s', '', $sql);
try {
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $sql) as $statement) {
        if (trim(preg_replace('/--[^\r\n]*/', '', $statement)) !== '') $pdo->exec($statement);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
$rows = $pdo->query("SELECT u.user_id, COALESCE(u.year_section, '') AS yearSection FROM users u WHERE u.account_type = 'student'")->fetchAll();
echo 'Migration completed; account section query passed for ' . count($rows) . " students.\n";
