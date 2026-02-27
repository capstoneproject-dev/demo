<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = igpRequireOfficerOrgContext();
    $filters = [
        'status' => trim((string)($_GET['status'] ?? '')),
        'payment_status' => trim((string)($_GET['payment_status'] ?? '')),
        'date_from' => trim((string)($_GET['date_from'] ?? '')),
        'date_to' => trim((string)($_GET['date_to'] ?? '')),
        'q' => trim((string)($_GET['q'] ?? '')),
    ];
    $summary = igpGetFinancialSummary(getPdo(), $ctx['org_id'], $filters);
    jsonOk($summary);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/reports/financial-summary] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
