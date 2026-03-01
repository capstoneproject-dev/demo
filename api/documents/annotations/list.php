<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $submissionId = (int)($_GET['submission_id'] ?? 0);
    if ($submissionId <= 0) {
        throw new DocumentValidationException('submission_id is required.');
    }
    $items = docListAnnotations(getPdo(), $submissionId, $session);
    jsonOk(['items' => $items]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/annotations/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

