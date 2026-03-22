<?php
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $context = stRequireStudentContext();
    $pdo = getPdo();
    jsonOk(stListStudentLockers($pdo, (int)$context['user_id']));
} catch (PDOException $e) {
    error_log('[api/lockers/student/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
