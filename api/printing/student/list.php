<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = stRequireStudentContext();
    $status = trim((string)($_GET['status'] ?? 'all'));
    $items = stListPrintJobs(getPdo(), ['status' => $status], (int)$ctx['user_id'], null);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/printing/student/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
