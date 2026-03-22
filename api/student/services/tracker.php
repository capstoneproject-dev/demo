<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    stRequireStudentContext();
    $overview = stGetStudentServicesOverview(getPdo());
    jsonOk($overview);
} catch (PDOException $e) {
    error_log('[api/student/services/tracker] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
