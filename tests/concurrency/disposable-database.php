<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../config/db.php';
$source = getPdo();
$controlFile = sys_get_temp_dir() . '/capstone-disposable-control.json';
$mode = $argv[1] ?? 'status';
function fingerprints(PDO $pdo): array {
    $data = [];
    foreach ($pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $quoted = '`' . str_replace('`', '``', $table) . '`';
        $rows = [];
        foreach ($pdo->query('SELECT * FROM ' . $quoted) as $row) $rows[] = hash('sha256', serialize($row));
        sort($rows);
        $data[$table] = ['count' => count($rows), 'hash' => hash('sha256', implode('', $rows))];
    }
    return $data;
}
if ($mode === 'create') {
    if (is_file($controlFile)) throw new RuntimeException('A disposable control manifest already exists; inspect it first.');
    $name = 'capstone_disposable_' . bin2hex(random_bytes(6));
    $directory = sys_get_temp_dir() . '/capstone-disposable-' . bin2hex(random_bytes(6));
    if (!mkdir($directory, 0700)) throw new RuntimeException('Cannot create private test directory.');
    $control = ['source' => DB_NAME, 'database' => $name, 'directory' => $directory, 'baseline' => fingerprints($source), 'created' => false];
    file_put_contents($controlFile, json_encode($control, JSON_THROW_ON_ERROR));
    $env = getenv(); $env['MYSQL_PWD'] = DB_PASS;
    $common = ['--host=' . DB_HOST, '--port=' . DB_PORT, '--user=' . DB_USER];
    $dump = $directory . '/source.sql';
    $process = proc_open(array_merge(['C:/xampp/mysql/bin/mysqldump.exe'], $common, ['--single-transaction', '--routines', '--triggers', '--skip-events', '--result-file=' . $dump, DB_NAME]), [0 => ['pipe', 'r'], 1 => ['file', $directory . '/dump.log', 'w'], 2 => ['file', $directory . '/dump-error.log', 'w']], $pipes, null, $env);
    fclose($pipes[0]);
    if (proc_close($process) !== 0) throw new RuntimeException('Dump failed; see the private dump-error.log.');
    $source->exec('CREATE DATABASE `' . $name . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $control['created'] = true; file_put_contents($controlFile, json_encode($control, JSON_THROW_ON_ERROR));
    $process = proc_open(array_merge(['C:/xampp/mysql/bin/mysql.exe'], $common, [$name]), [0 => ['file', $dump, 'r'], 1 => ['file', $directory . '/import.log', 'w'], 2 => ['file', $directory . '/import-error.log', 'w']], $pipes, null, $env);
    if (proc_close($process) !== 0) throw new RuntimeException('Import failed; disposable database retained for diagnosis.');
    $copy = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $name), DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    if (fingerprints($copy) !== $control['baseline']) throw new RuntimeException('Copy does not match baseline.');
    $control['clone_verified'] = true;
    file_put_contents($controlFile, json_encode($control, JSON_THROW_ON_ERROR));
    echo json_encode(['database' => $name, 'directory' => $directory, 'tables' => count($control['baseline']), 'clone_verified' => true]) . "\n";
    exit;
}
$control = json_decode(file_get_contents($controlFile), true, 512, JSON_THROW_ON_ERROR);
if (DB_NAME !== $control['source'] || !preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', $control['database']) || $control['database'] === DB_NAME) throw new RuntimeException('Source/target safety check failed.');
if ($mode === 'verify-source') {
    $current = fingerprints($source); $differences = [];
    foreach ($control['baseline'] as $table => $before) if (($current[$table] ?? null) !== $before) $differences[] = $table;
    $control['source_differences'] = $differences;
    file_put_contents($controlFile, json_encode($control, JSON_THROW_ON_ERROR));
    echo $differences ? 'Source tables changed: ' . implode(', ', $differences) . "\n" : "PASS: Every source table matches its pre-test data fingerprint.\n";
    exit($differences ? 1 : 0);
}
if ($mode === 'drop') {
    if (empty($control['tests_passed']) || empty($control['clone_verified'])) throw new RuntimeException('Passing test result marker required before deletion.');
    $source->exec('DROP DATABASE `' . $control['database'] . '`');
    $exists = $source->prepare('SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?');
    $exists->execute([$control['database']]);
    if ($exists->fetchColumn()) throw new RuntimeException('Database deletion verification failed.');
    $control['deleted'] = true; file_put_contents($controlFile, json_encode($control, JSON_THROW_ON_ERROR));
    echo "PASS: Disposable database deleted; original database retained.\n";
    exit;
}
echo json_encode(['database' => $control['database'], 'directory' => $control['directory'], 'deleted' => $control['deleted'] ?? false]) . "\n";
