<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';
require_once __DIR__ . '/../../../includes/notification_email_delivery.php';

header('Content-Type: application/json');
apiGuard();
apiRequireOrgManageAccess();
requirePost();

try {
    $ctx = stRequireOfficerContext();
    $body = getRequestBody();
    $printJobId = (int)($body['print_job_id'] ?? 0);
    $status = (string)($body['status'] ?? '');
    $pdo = getPdo();
    $item = stUpdatePrintJobStatus(
        $pdo,
        (int)$ctx['org_id'],
        $printJobId,
        $status,
        (int)$ctx['user_id'],
        [
            'total_cost' => $body['total_cost'] ?? null,
            'payment_status' => $body['payment_status'] ?? 'unpaid',
            'officer_identifier' => $body['officer_identifier'] ?? '',
        ]
    );
    notificationEmailDispatchPrintingJobsBestEffort($pdo, [$printJobId]);
    jsonOk(['item' => $item]);
} catch (ServiceTrackerAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/printing/officer/update-status] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
