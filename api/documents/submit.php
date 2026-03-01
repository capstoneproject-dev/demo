<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx  = docRequireOfficerOrgContext();
    $body = getRequestBody();
    $item = docCreateSubmission(getPdo(), $ctx['org_id'], $ctx['user_id'], $body);
    jsonOk(['item' => $item]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/submit] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
