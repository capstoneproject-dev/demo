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
    ];
    if ($filters['published'] === null) {
        unset($filters['published']);
    }
    $items = annListAnnouncements(getPdo(), $ctx['org_id'], $filters);
    jsonOk(['items' => $items]);
} catch (AnnouncementAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/announcements/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
