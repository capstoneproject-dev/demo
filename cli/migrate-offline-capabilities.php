<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/offline_sync.php';

try {
    $pdo = getPdo();
    offlineEnsureSchema($pdo);
    qrEnsureOfflineAttendanceColumns($pdo);
    echo "Offline synchronization schema is ready.\n";
    echo "- offline_operations: ready\n";
    echo "- attendance receipt timestamps: ready\n";
} catch (Throwable $e) {
    fwrite(STDERR, "Offline migration failed: " . $e->getMessage() . PHP_EOL);
    exit(1);
}
