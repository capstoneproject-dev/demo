<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

function handleInventoryImageUpload(array $file): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new IgpValidationException('Item image upload failed.');
    }

    $tmp = (string)($file['tmp_name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        throw new IgpValidationException('Invalid item image upload.');
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $mime = mime_content_type($tmp) ?: '';
    if (!isset($allowed[$mime])) {
        throw new IgpValidationException('Item image must be JPG, PNG, or WEBP.');
    }

    $targetDir = dirname(__DIR__, 3) . '/uploads/inventory-items';
    if (!is_dir($targetDir) && !mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
        throw new RuntimeException('Could not prepare inventory image directory.');
    }

    $fileName = 'inventory_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
    $targetPath = $targetDir . '/' . $fileName;
    if (!move_uploaded_file($tmp, $targetPath)) {
        throw new RuntimeException('Could not save item image.');
    }

    return 'uploads/inventory-items/' . $fileName;
}

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = igpRequireOfficerOrgContext();
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    $body = str_contains($contentType, 'multipart/form-data')
        ? $_POST
        : getRequestBody();

    if (!empty($_FILES['image']) && (int)($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $body['image_path'] = handleInventoryImageUpload($_FILES['image']);
    }

    $itemId = igpSaveInventoryItem(getPdo(), $ctx['org_id'], $body);
    jsonOk(['item_id' => $itemId]);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/inventory/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
