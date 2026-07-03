<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();

try {
    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
        'limit' => isset($_GET['limit']) ? (int)$_GET['limit'] : 10,
    ];
    $items = annListPublishedAnnouncementsForStudents(getPdo(), $filters);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/announcements/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
