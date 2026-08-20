<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';
require_once __DIR__ . '/../../../includes/upload_security.php';

function handleInventoryImageUpload(array $file): string
{
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    try {
        return uploadStoreImageFile(
            $file,
            'inventory-items',
            'inventory_' . date('Ymd_His'),
            $allowed,
            5 * 1024 * 1024,
            8000
        );
    } catch (UploadValidationException $e) {
        throw new IgpValidationException($e->getMessage(), 0, $e);
    }
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

    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $itemId = igpSaveInventoryItem($pdo, $ctx['org_id'], $body);
        if ((int)($body['apply_pricing_to_group'] ?? 0) === 1) {
            igpApplyInventoryGroupPricing($pdo, (int)$ctx['org_id'], $itemId);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    jsonOk(['item_id' => $itemId]);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/inventory/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
