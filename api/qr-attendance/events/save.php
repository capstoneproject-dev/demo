<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = qrRequireOfficerOrgContext();
    $body = getRequestBody();
    $eventId = qrSaveEvent(getPdo(), $ctx['org_id'], $ctx['user_id'], $body);
    jsonOk(['event_id' => $eventId]);
} catch (QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/qr-attendance/events/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

