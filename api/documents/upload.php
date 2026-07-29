<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';
require_once __DIR__ . '/../../includes/upload_security.php';

header('Content-Type: application/json');
apiGuard();
docRequireOfficerOrgContext();

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed.', 405);
    }
    if (empty($_FILES['file'])) {
        jsonError('No file uploaded.', 422);
    }

    $stored = uploadStorePdfFile($_FILES['file'], 'documents', 20 * 1024 * 1024);

    $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'], 3), '/');
    $publicUrl = $basePath . '/' . $stored['relative_path'];
    jsonOk(['file_url' => $publicUrl, 'name' => $stored['original_name']]);
} catch (UploadValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[api/documents/upload] ' . $e->getMessage());
    jsonError('Could not store the uploaded document. Please try again.', 500);
}
