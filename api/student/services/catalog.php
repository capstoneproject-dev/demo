<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $items = igpGetStudentServicesCatalog(getPdo());
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/services/catalog] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
