<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    $body = getRequestBody();
    $annotationId = (int)($body['annotation_id'] ?? 0);
    if ($annotationId <= 0) {
        throw new DocumentValidationException('annotation_id is required.');
    }

    $deleted = docDeleteAnnotation(getPdo(), $annotationId, $userId, $session);
    jsonOk(['deleted' => $deleted ? 1 : 0]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (DocumentValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/documents/annotations/delete] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

