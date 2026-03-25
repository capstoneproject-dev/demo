<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();

try {
    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
    ];
    $items = qrListPublishedEventsForStudents(getPdo(), $filters);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/events/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
