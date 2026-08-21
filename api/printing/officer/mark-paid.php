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
    $officerIdentifier = trim((string)($body['officer_identifier'] ?? ''));
    $item = stMarkPrintJobPaid(
        getPdo(),
        (int)$ctx['org_id'],
        $printJobId,
        $officerIdentifier
    );
    jsonOk(['item' => $item]);
} catch (ServiceTrackerAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/printing/officer/mark-paid] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
