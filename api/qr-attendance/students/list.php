<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = qrRequireOfficerOrgContext();
    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
    ];
    $items = qrListStudents(getPdo(), $ctx['org_id'], $filters);
    jsonOk(['items' => $items]);
} catch (QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/qr-attendance/students/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

