<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';
require_once __DIR__ . '/../../includes/upload_security.php';
require_once __DIR__ . '/../../includes/private_pdf_storage.php';

header('Content-Type: application/json');
apiGuard();

try {
    $stored = null;
    $ctx = docRequireOfficerOrgContext();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed.', 405);
    }
    if (empty($_FILES['file'])) {
        jsonError('No file uploaded.', 422);
    }

    $stored = privatePdfStoreUploadedFile($_FILES['file'], 'documents', 20 * 1024 * 1024);
    $uploadToken = privatePdfCreatePendingUpload($stored, (int)$ctx['user_id'], (int)$ctx['org_id']);
    jsonOk([
        'upload_token' => $uploadToken,
        'name' => $stored['original_name'],
        'expires_in' => PRIVATE_PDF_PENDING_TTL_SECONDS,
    ]);
} catch (UploadValidationException $e) {
    if (is_array($stored ?? null)) privatePdfDeleteStorageKey((string)$stored['storage_key']);
    jsonError($e->getMessage(), 422);
} catch (Throwable $e) {
    if (is_array($stored ?? null)) privatePdfDeleteStorageKey((string)$stored['storage_key']);
    error_log('[api/documents/upload] ' . $e->getMessage());
    jsonError('Could not store the uploaded document. Please try again.', 500);
}
