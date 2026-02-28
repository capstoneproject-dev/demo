<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = qrRequireOfficerOrgContext();
    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
        'event_id' => (int)($_GET['event_id'] ?? 0),
        'event_name' => trim((string)($_GET['event_name'] ?? '')),
        'section' => trim((string)($_GET['section'] ?? '')),
        'date_from' => trim((string)($_GET['date_from'] ?? '')),
        'date_to' => trim((string)($_GET['date_to'] ?? '')),
        'limit' => (int)($_GET['limit'] ?? 2000),
    ];
    $items = qrListAttendance(getPdo(), $ctx['org_id'], $filters);
    jsonOk(['items' => $items]);
} catch (QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/qr-attendance/attendance/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

