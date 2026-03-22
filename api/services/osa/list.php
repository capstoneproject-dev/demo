<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    stRequireOsaContext();
    $data = stListOrganizationsWithServices(getPdo());
    jsonOk($data);
} catch (PDOException $e) {
    error_log('[api/services/osa/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
