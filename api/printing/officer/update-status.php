<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireOfficerContext();
    $body = getRequestBody();
    $printJobId = (int)($body['print_job_id'] ?? 0);
    $status = (string)($body['status'] ?? '');
    $item = stUpdatePrintJobStatus(getPdo(), (int)$ctx['org_id'], $printJobId, $status, (int)$ctx['user_id']);
    jsonOk(['item' => $item]);
} catch (PDOException $e) {
    error_log('[api/printing/officer/update-status] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
