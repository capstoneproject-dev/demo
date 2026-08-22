<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, private');
apiRequireOsaSystemAdministrator();

try {
    $pdo = getPdo();

    $accounts = $pdo->query(
        "SELECT
            (SELECT COUNT(DISTINCT om.user_id)
             FROM organization_members om
             JOIN users u ON u.user_id = om.user_id
             JOIN org_roles r ON r.role_id = om.role_id
             WHERE om.is_active = 1
               AND u.is_active = 1
               AND u.account_type = 'student'
               AND r.is_active = 1
               AND r.can_access_org_dashboard = 1) AS active_officers,
            (SELECT COUNT(*) FROM users
             WHERE account_type = 'student' AND is_active = 1) AS active_students"
    )->fetch(PDO::FETCH_ASSOC) ?: [];

    $documents = $pdo->query(
        "SELECT
            SUM(CASE WHEN ds.status IN ('pending', 'sent_to_osa') THEN 1 ELSE 0 END) AS request_queue,
            SUM(CASE WHEN ds.submitted_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                      AND ds.status IN ('pending', 'sent_to_osa') THEN 1 ELSE 0 END) AS month_pending,
            SUM(CASE WHEN ds.submitted_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                      AND ds.status = 'approved' THEN 1 ELSE 0 END) AS month_accepted,
            SUM(CASE WHEN ds.submitted_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                      AND ds.status = 'rejected' THEN 1 ELSE 0 END) AS month_rejected
         FROM document_submissions ds
         JOIN document_versions dv ON dv.submission_id = ds.submission_id
         WHERE UPPER(TRIM(ds.recipient)) = 'OSA'
           AND ds.status <> 'cancelled'
           AND NOT EXISTS (
               SELECT 1 FROM document_versions newer
               WHERE newer.parent_submission_id = ds.submission_id
           )"
    )->fetch(PDO::FETCH_ASSOC) ?: [];

    $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
    jsonOk([
        'stats' => [
            'active_officers' => (int)($accounts['active_officers'] ?? 0),
            'active_students' => (int)($accounts['active_students'] ?? 0),
            'request_queue' => (int)($documents['request_queue'] ?? 0),
            'documents' => [
                'month_label' => $now->format('F'),
                'pending' => (int)($documents['month_pending'] ?? 0),
                'accepted' => (int)($documents['month_accepted'] ?? 0),
                'rejected' => (int)($documents['month_rejected'] ?? 0),
            ],
        ],
        'generated_at' => $now->format(DATE_ATOM),
    ]);
} catch (PDOException $e) {
    error_log('[api/osa/dashboard-stats] ' . $e->getMessage());
    jsonError('A database error occurred while loading dashboard statistics.', 500);
} catch (Throwable $e) {
    error_log('[api/osa/dashboard-stats] ' . $e->getMessage());
    jsonError('Could not load dashboard statistics.', 500);
}
