<?php
// Read-only schema capture; no application rows or credentials are exported.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/config/db.php';
$pdo = getPdo();
$schema = ['database' => DB_NAME, 'captured_on' => '2026-10-03', 'tables' => []];
$tables = $pdo->query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME')->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    $entry = [];
    foreach ([
        'columns' => 'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
        'foreign_keys' => 'SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION',
        'indexes' => 'SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX'
    ] as $key => $sql) {
        $statement = $pdo->prepare($sql);
        $statement->execute([$table]);
        $entry[$key] = $statement->fetchAll();
    }
    $schema['tables'][$table] = $entry;
}
file_put_contents(dirname(__DIR__) . '/md/Logical Database Schema Snapshot.json', json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
echo count($tables) . " table definitions captured; no business data exported.\n";
