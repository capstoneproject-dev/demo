<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require_once __DIR__ . '/../../config/db.php';
$controlPath = sys_get_temp_dir() . '/capstone-disposable-control.json';
$control = json_decode(file_get_contents($controlPath), true, 512, JSON_THROW_ON_ERROR);
if (DB_NAME !== $control['source']) throw new RuntimeException('Source connection required.');
$source = getPdo();
$name = 'capstone_disposable_' . bin2hex(random_bytes(6));
$source->exec('CREATE DATABASE `' . $name . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
try {
    $env = getenv(); $env['MYSQL_PWD'] = DB_PASS;
    $process = proc_open(['C:/xampp/mysql/bin/mysql.exe', '--host=' . DB_HOST, '--port=' . DB_PORT, '--user=' . DB_USER, $name], [0 => ['file', $control['directory'] . '/source.sql', 'r'], 1 => ['file', $control['directory'] . '/comparison-import.log', 'w'], 2 => ['file', $control['directory'] . '/comparison-error.log', 'w']], $pipes, null, $env);
    if (proc_close($process) !== 0) throw new RuntimeException('Comparison snapshot import failed.');
    $before = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $name), DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $differences = [];
    foreach ($control['source_differences'] as $table) {
        $pk = $source->query("SHOW KEYS FROM `$table` WHERE Key_name = 'PRIMARY'")->fetchAll(PDO::FETCH_ASSOC);
        $keys = array_column($pk, 'Column_name');
        $index = static function (PDO $pdo) use ($table, $keys): array {
            $indexed = [];
            foreach ($pdo->query("SELECT * FROM `$table`") as $row) $indexed[implode('|', array_map(fn($key) => $row[$key], $keys))] = $row;
            return $indexed;
        };
        $old = $index($before); $new = $index($source);
        $changedFields = []; $changed = 0;
        foreach ($old as $id => $row) {
            if (!isset($new[$id])) continue;
            $fields = [];
            foreach ($row as $field => $value) if ($new[$id][$field] !== $value) $fields[] = $field;
            if ($fields) { $changed++; $changedFields = array_unique(array_merge($changedFields, $fields)); }
        }
        $differences[$table] = ['added' => count(array_diff_key($new, $old)), 'removed' => count(array_diff_key($old, $new)), 'updated' => $changed, 'changed_fields' => array_values($changedFields)];
    }
    $fixtureQuery = $source->query("SELECT COUNT(*) FROM users WHERE email LIKE 'FT%@example.invalid'");
    $originalFixtures = $before->query("SELECT COUNT(*) FROM users WHERE email LIKE 'FT%@example.invalid'")->fetchColumn();
    $control['source_diff_details'] = $differences;
    $control['source_fixture_counts_unchanged'] = $fixtureQuery->fetchColumn() === $originalFixtures;
    $schemaDifferences = [];
    foreach (array_keys($control['baseline']) as $table) {
        $oldSchema = preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', $before->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1]);
        $newSchema = preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', $source->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1]);
        if ($oldSchema !== $newSchema) $schemaDifferences[] = $table;
    }
    $control['source_schema_differences'] = $schemaDifferences;
    file_put_contents($controlPath, json_encode($control, JSON_THROW_ON_ERROR));
    echo json_encode(['differences' => $differences, 'source_fixture_count_unchanged' => $control['source_fixture_counts_unchanged'], 'source_schema_differences' => $schemaDifferences], JSON_PRETTY_PRINT) . "\n";
    foreach ($source->query('SELECT action FROM audit_logs ORDER BY created_at DESC LIMIT 6') as $row) echo json_encode($row) . "\n";
} finally {
    $source->exec('DROP DATABASE `' . $name . '`');
}
