<?php

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/private_pdf_storage.php';

apiGuard();

$printJobId = (int)($_GET['print_job_id'] ?? 0);
if ($printJobId <= 0) {
    http_response_code(404);
    exit;
}

try {
    $pdo = getPdo();
    $stmt = $pdo->prepare(
        "SELECT print_job_id, org_id, user_id, file_name, file_url
         FROM print_jobs
         WHERE print_job_id = :print_job_id
         LIMIT 1"
    );
    $stmt->execute([':print_job_id' => $printJobId]);
    $job = $stmt->fetch();
    if (!$job) {
        http_response_code(404);
        exit;
    }

    if (!privatePdfCanAccessPrintJob($job, getPhpSession())) {
        appendAuditLog('protected_file_access_denied', 'print_job', (string)$printJobId, auditActorFromSession(), null, null, ['reason' => 'authorization'], 'failure', $pdo);
        http_response_code(403);
        exit;
    }

    $path = privatePdfResolveStoredFile((string)$job['file_url'], ['print-jobs']);
    if (!$path) {
        http_response_code(404);
        exit;
    }
    auditProtectedFileAccessOnce('print_job', $printJobId, [
        'disposition' => isset($_GET['download']) ? 'download' : 'inline',
    ]);
    privatePdfStream($path, (string)$job['file_name'], isset($_GET['download']));
} catch (Throwable $e) {
    error_log('[api/printing/file] ' . $e->getMessage());
    http_response_code(500);
    exit;
}
