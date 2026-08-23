<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();
apiRequireOrgManageAccess();
requirePost();

try {
    $ctx = docRequireOfficerOrgContext();
    $body = getRequestBody();
    $submissionId = (int)($body['submission_id'] ?? 0);
    if ($submissionId <= 0) {
        throw new DocumentValidationException('submission_id is required.');
    }
    $item = docForwardSubmissionToOsa(
        getPdo(), $submissionId, (int)$ctx['org_id'], (int)$ctx['user_id']
    );
    jsonOk(['item' => privatePdfDecorateDocumentRow($item)]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/forward-to-osa] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
