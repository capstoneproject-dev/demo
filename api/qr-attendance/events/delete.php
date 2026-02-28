<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = qrRequireOfficerOrgContext();
    $body = getRequestBody();
    $eventId = (int)($body['event_id'] ?? 0);
    qrDeleteEvent(getPdo(), $ctx['org_id'], $eventId);
    jsonOk();
} catch (QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/qr-attendance/events/delete] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

