<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx  = annRequireOfficerOrgContext();
    $body = getRequestBody();
    $item = annCreateAnnouncement(getPdo(), $ctx['org_id'], $ctx['user_id'], $body);
    jsonOk(['item' => $item]);
} catch (AnnouncementAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (AnnouncementValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/announcements/create] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
