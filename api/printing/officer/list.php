<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = stRequireOfficerContext();
    $status = trim((string)($_GET['status'] ?? 'all'));
    $items = stListPrintJobs(getPdo(), ['status' => $status], null, (int)$ctx['org_id']);
    jsonOk([
        'items' => $items,
        'printing_enabled' => stServiceEnabledForOrg(getPdo(), (int)$ctx['org_id'], 'printing'),
    ]);
} catch (PDOException $e) {
    error_log('[api/printing/officer/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
