<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();

try {
    docRequireOsaContext();

    $filters = [
        'status' => $_GET['status'] ?? 'all',
        'q' => trim((string)($_GET['q'] ?? '')),
        'from' => $_GET['from'] ?? null,
        'to' => $_GET['to'] ?? null,
    ];

    $items = docListOsaRequestOverview(getPdo(), $filters);
    jsonOk(['items' => $items]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/documents/requests-overview] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
