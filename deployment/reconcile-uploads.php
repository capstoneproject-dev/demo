<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../includes/upload_reconciliation.php';

try {
    $options = array_slice($argv, 1);
    foreach ($options as $option) {
        if (!in_array($option, ['--delete', '--uploads-paused'], true)) throw new RuntimeException('Unknown option: ' . $option);
    }
    $delete = in_array('--delete', $options, true);
    if ($delete && !in_array('--uploads-paused', $options, true)) {
        throw new RuntimeException('Deletion requires a drained maintenance window and --uploads-paused.');
    }
    $references = uploadReferencedFiles(getPdo());
    foreach ([uploadRoot() . '/announcements', uploadRoot() . '/documents', privatePdfStorageRoot() . '/documents'] as $directory) {
        foreach (uploadReconcileDirectory($directory, $references, $delete) as $result) {
            echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        }
    }
    fwrite(STDERR, $delete ? "Recovery complete.\n" : "Report only; no files deleted.\n");
} catch (Throwable $e) {
    fwrite(STDERR, 'Upload recovery stopped: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
