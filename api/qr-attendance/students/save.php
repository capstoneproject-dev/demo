<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = qrRequireOfficerOrgContext();
    $body = getRequestBody();
    $userId = qrSaveStudent(getPdo(), $ctx['org_id'], $body);
    jsonOk(['user_id' => $userId]);
} catch (QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/qr-attendance/students/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}

