<?php

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';
require_once __DIR__ . '/../../includes/private_pdf_storage.php';

apiGuard();

$submissionId = (int)($_GET['submission_id'] ?? 0);
if ($submissionId <= 0) {
    http_response_code(404);
    exit;
}

try {
    $pdo = getPdo();
    $session = getPhpSession();
    if (!docResolveSubmissionAccess($pdo, $submissionId, $session)) {
        http_response_code(403);
        exit;
    }
    $submission = docFetchSubmission($pdo, $submissionId);
    $path = privatePdfResolveStoredFile((string)$submission['file_url'], ['documents']);
    if (!$path) {
        http_response_code(404);
        exit;
    }
    privatePdfStream($path, (string)$submission['title'], isset($_GET['download']));
} catch (Throwable $e) {
    error_log('[api/documents/download] ' . $e->getMessage());
    http_response_code(500);
    exit;
}
