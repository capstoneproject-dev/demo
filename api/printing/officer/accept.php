<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireOfficerContext();
    $pdo = getPdo();

    if (!stServiceEnabledForOrg($pdo, (int)$ctx['org_id'], 'printing')) {
        jsonError('OSA has not enabled printing services for this organization yet.', 403);
    }

    $body = getRequestBody();
    $printJobId = (int)($body['print_job_id'] ?? 0);

    $item = stAcceptPendingPrintJob($pdo, (int)$ctx['org_id'], $printJobId, (int)$ctx['user_id']);
    jsonOk(['item' => $item]);
} catch (PDOException $e) {
    error_log('[api/printing/officer/accept] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (ServiceTrackerValidationException $e) {
    // Likely already accepted by another org.
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
