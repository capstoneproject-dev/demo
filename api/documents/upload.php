<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();
docRequireOfficerOrgContext();

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed.', 405);
    }
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        jsonError('No file uploaded.', 422);
    }

    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        jsonError('File upload failed.', 422);
    }

    $original = (string)($file['name'] ?? 'document.pdf');
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
    $allowed = ['pdf'];
    if (!in_array($ext, $allowed, true)) {
        jsonError('Only PDF files are allowed.', 422);
    }

    $targetDir = dirname(__DIR__, 2) . '/uploads/documents';
    if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
        throw new RuntimeException('Failed to create upload directory.');
    }

    $safeBase = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($original, PATHINFO_FILENAME));
    $fileName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeBase . '.pdf';
    $targetPath = $targetDir . '/' . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new RuntimeException('Failed to move uploaded file.');
    }

    $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'], 3), '/');
    $publicUrl = $basePath . '/uploads/documents/' . $fileName;
    jsonOk(['file_url' => $publicUrl, 'name' => $original]);
} catch (Throwable $e) {
    error_log('[api/documents/upload] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
