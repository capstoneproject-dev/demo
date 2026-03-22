<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireStudentContext();
    $job = stSubmitPrintJob(getPdo(), (int)$ctx['user_id'], $_POST, $_FILES['file'] ?? []);
    jsonOk(['item' => $job]);
} catch (PDOException $e) {
    error_log('[api/printing/student/submit] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
