<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/notification_email_delivery.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);
$limit = 100;
foreach ($argv ?? [] as $argument) {
    if (str_starts_with($argument, '--limit=')) {
        $limit = max(1, min(500, (int)substr($argument, 8)));
    }
}

try {
    $result = dispatchTransactionNotificationEmails(getPdo(), $dryRun, $limit);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(!empty($result['locked']) ? 2 : 0);
} catch (Throwable $e) {
    error_log('[notification-email-dispatcher] ' . $e->getMessage());
    fwrite(STDERR, "Transaction notification email dispatch failed.\n");
    exit(1);
}
