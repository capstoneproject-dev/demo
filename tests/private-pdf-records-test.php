<?php

declare(strict_types=1);

$sessionDir = __DIR__ . '/.private-pdf-record-sessions-' . bin2hex(random_bytes(4));
mkdir($sessionDir, 0700, true);
session_save_path($sessionDir);
register_shutdown_function(static function () use ($sessionDir): void {
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    foreach (glob($sessionDir . '/*') ?: [] as $file) @unlink($file);
    @rmdir($sessionDir);
});

require_once __DIR__ . '/../includes/documents.php';
require_once __DIR__ . '/../includes/services_tracker.php';

function privatePdfRecordAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = getPdo();
$tables = [
    'document_submissions' => ['id' => 'submission_id', 'category' => 'documents'],
    'documents_approved' => ['id' => 'repo_id', 'category' => 'documents'],
    'print_jobs' => ['id' => 'print_job_id', 'category' => 'print-jobs'],
];

foreach ($tables as $table => $config) {
    $rows = $pdo->query("SELECT {$config['id']} AS row_id, file_url FROM {$table}")->fetchAll();
    foreach ($rows as $row) {
        $key = (string)$row['file_url'];
        privatePdfRecordAssert(
            preg_match('#^' . preg_quote($config['category'], '#') . '/[A-Za-z0-9._-]+\.pdf$#i', $key) === 1,
            "{$table} row {$row['row_id']} exposes a non-private file value."
        );
        $path = privatePdfResolveStoredFile($key, [$config['category']]);
        privatePdfRecordAssert($path !== null && is_readable($path), "{$table} row {$row['row_id']} has a missing private file.");
        privatePdfRecordAssert(file_get_contents($path, false, null, 0, 5) === '%PDF-', "{$table} row {$row['row_id']} is not a PDF.");
    }
}

$document = $pdo->query('SELECT submission_id, org_id FROM document_submissions ORDER BY submission_id LIMIT 1')->fetch();
if ($document) {
    $submissionId = (int)$document['submission_id'];
    $orgId = (int)$document['org_id'];
    privatePdfRecordAssert(docResolveSubmissionAccess($pdo, $submissionId, ['account_type' => 'osa_staff']) !== null, 'OSA document access failed.');
    privatePdfRecordAssert(docResolveSubmissionAccess($pdo, $submissionId, ['login_role' => 'org', 'active_org_id' => $orgId]) !== null, 'Owning organization document access failed.');
    privatePdfRecordAssert(docResolveSubmissionAccess($pdo, $submissionId, ['login_role' => 'org', 'active_org_id' => $orgId + 100000]) === null, 'Another organization gained document access.');
    privatePdfRecordAssert(docResolveSubmissionAccess($pdo, $submissionId, ['login_role' => 'student']) === null, 'Student gained document repository access.');
    $decorated = privatePdfDecorateDocumentRow(['submission_id' => $submissionId, 'file_url' => 'documents/internal.pdf']);
    privatePdfRecordAssert(!str_contains($decorated['file_url'], 'internal.pdf'), 'Document API decoration leaked its storage key.');
}

$job = $pdo->query('SELECT print_job_id, user_id, org_id FROM print_jobs ORDER BY print_job_id LIMIT 1')->fetch();
if ($job) {
    privatePdfRecordAssert(!privatePdfCanAccessPrintJob($job, ['account_type' => 'osa_staff', 'user_id' => (int)$job['user_id']]), 'OSA gained printing-file access.');
    privatePdfRecordAssert(privatePdfCanAccessPrintJob($job, ['user_id' => (int)$job['user_id']]), 'Submitting student printing access failed.');
    privatePdfRecordAssert(!privatePdfCanAccessPrintJob($job, ['user_id' => (int)$job['user_id'] + 100000]), 'Another student gained printing access.');
    privatePdfRecordAssert(privatePdfCanAccessPrintJob($job, ['login_role' => 'org', 'active_org_id' => (int)$job['org_id']]), 'Assigned organization printing access failed.');
    privatePdfRecordAssert(!privatePdfCanAccessPrintJob($job, ['login_role' => 'org', 'active_org_id' => (int)$job['org_id'] + 100000]), 'Another organization gained printing access.');
    $decorated = privatePdfDecoratePrintJobRow(['print_job_id' => (int)$job['print_job_id'], 'file_url' => 'print-jobs/internal.pdf']);
    privatePdfRecordAssert(!str_contains($decorated['file_url'], 'internal.pdf'), 'Printing API decoration leaked its storage key.');
}

fwrite(STDOUT, "Private PDF database and authorization tests passed.\n");
