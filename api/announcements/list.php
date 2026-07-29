<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx     = annRequireOfficerOrgContext();
    $filters = [
        'published' => isset($_GET['published']) ? (int)$_GET['published'] : null,
        'q'         => trim((string)($_GET['q'] ?? '')),
        'status'    => trim((string)($_GET['status'] ?? (
            isset($_GET['published']) && (int)$_GET['published'] === 0 ? 'unpublished' : 'active'
        ))),
        'audience'  => trim((string)($_GET['audience'] ?? '')),
        'type'      => trim((string)($_GET['type'] ?? '')),
        'limit'     => isset($_GET['limit']) ? (int)$_GET['limit'] : 10,
        'cursor'    => trim((string)($_GET['cursor'] ?? '')),
    ];
    if ($filters['published'] === null) {
        unset($filters['published']);
    }
    $page = annListAnnouncementsPage(getPdo(), $ctx['org_id'], $filters);
    jsonOk($page);
} catch (AnnouncementAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/announcements/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
