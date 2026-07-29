<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = annRequireOfficerOrgContext();
    $body = getRequestBody();
    $announcementId = (int)($body['announcement_id'] ?? 0);
    if ($announcementId <= 0) {
        throw new AnnouncementValidationException('Invalid announcement.');
    }
    $item = annSetArchivedState(getPdo(), $ctx['org_id'], $ctx['user_id'], $announcementId, true);
    jsonOk(['item' => $item]);
} catch (AnnouncementAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (AnnouncementValidationException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/announcements/archive] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
