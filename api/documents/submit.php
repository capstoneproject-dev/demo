<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';
require_once __DIR__ . '/../../includes/private_pdf_storage.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx  = docRequireOfficerOrgContext();
    $body = getRequestBody();
    $uploadToken = trim((string)($body['upload_token'] ?? ''));
    $pendingUpload = privatePdfGetPendingUpload($uploadToken, (int)$ctx['user_id'], (int)$ctx['org_id']);
    $body['storage_key'] = $pendingUpload['storage_key'];
    $item = docCreateSubmission(getPdo(), $ctx['org_id'], $ctx['user_id'], $body);
    privatePdfConsumePendingUpload($uploadToken);
    jsonOk(['item' => privatePdfDecorateDocumentRow($item)]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (UploadValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/submit] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
