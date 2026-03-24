<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireStudentContext();
    $body = getRequestBody();
    $printJobId = (int)($body['print_job_id'] ?? 0);
    $item = stCancelStudentPrintJob(getPdo(), (int)$ctx['user_id'], $printJobId);
    jsonOk(['item' => $item]);
} catch (PDOException $e) {
    error_log('[api/printing/student/cancel] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
