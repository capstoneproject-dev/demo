<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = igpRequireOfficerOrgContext();
    $body = getRequestBody();
    $itemId = (int)($body['item_id'] ?? 0);
    igpDeleteInventoryItem(getPdo(), $ctx['org_id'], $itemId);
    jsonOk();
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/inventory/delete] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
