<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';
require_once __DIR__ . '/../../../includes/notification_email_delivery.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireStudentContext();
    $body = getRequestBody();
    $printJobId = (int)($body['print_job_id'] ?? 0);
    $pdo = getPdo();
    $item = stCancelStudentPrintJob($pdo, (int)$ctx['user_id'], $printJobId);
    notificationEmailDispatchPrintingJobsBestEffort($pdo, [$printJobId]);
    jsonOk(['item' => $item]);
} catch (PDOException $e) {
    error_log('[api/printing/student/cancel] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
