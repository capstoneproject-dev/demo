<?php
require_once __DIR__ . '/../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Not authenticated.', 401);
    }

    $limit = max(1, min(10, (int)($_GET['limit'] ?? 5)));
    $pdo = getPdo();
    $queries = [
        "SELECT 'printing' AS activity_type,
                'Printing Service' AS title,
                CONCAT(pj.file_name, ' - ', COALESCE(o.org_code, o.org_name)) AS description,
                COALESCE(pj.updated_at, pj.submitted_at) AS activity_at,
                pj.status
         FROM print_jobs pj
         JOIN organizations o ON o.org_id = pj.org_id
         WHERE pj.user_id = :user_id",

        "SELECT CASE WHEN COALESCE(r.service_kind, 'rental') = 'locker' THEN 'locker' ELSE 'rental' END AS activity_type,
                CASE WHEN COALESCE(r.service_kind, 'rental') = 'locker' THEN 'Locker Service' ELSE 'Equipment Rental' END AS title,
                CONCAT(
                    COALESCE((
                        SELECT GROUP_CONCAT(CONCAT(i.item_name, ' (', ri.quantity, 'x)') ORDER BY i.item_name SEPARATOR ', ')
                        FROM rental_items ri
                        JOIN inventory_items i ON i.item_id = ri.item_id
                        WHERE ri.rental_id = r.rental_id
                    ), 'Rental request'),
                    ' - ', COALESCE(o.org_code, o.org_name)
                ) AS description,
                COALESCE(r.updated_at, r.created_at, r.rent_time) AS activity_at,
                r.status
         FROM rentals r
         JOIN organizations o ON o.org_id = r.org_id
         WHERE r.renter_user_id = :user_id",

        "SELECT 'event' AS activity_type,
                CASE WHEN ar.time_in IS NULL THEN 'Event Registration' ELSE 'Event Attendance' END AS title,
                CONCAT(e.event_name, ' - ', COALESCE(o.org_code, o.org_name)) AS description,
                COALESCE(ar.updated_at, ar.created_at) AS activity_at,
                CASE WHEN ar.time_in IS NULL THEN 'registered' ELSE 'attended' END AS status
         FROM attendance_records ar
         JOIN events e ON e.event_id = ar.event_id
         JOIN organizations o ON o.org_id = e.org_id
         WHERE ar.user_id = :user_id",

        "SELECT 'membership' AS activity_type,
                'Organization Membership' AS title,
                CONCAT('Joined ', COALESCE(o.org_code, o.org_name)) AS description,
                COALESCE(om.updated_at, om.created_at, om.joined_at) AS activity_at,
                CASE WHEN om.is_active = 1 THEN 'active' ELSE 'inactive' END AS status
         FROM organization_members om
         JOIN organizations o ON o.org_id = om.org_id
         WHERE om.user_id = :user_id",
    ];

    $items = [];
    foreach ($queries as $query) {
        $stmt = $pdo->prepare($query);
        $stmt->execute([':user_id' => $userId]);
        array_push($items, ...$stmt->fetchAll());
    }

    usort($items, static fn(array $a, array $b): int => strcmp((string)$b['activity_at'], (string)$a['activity_at']));
    jsonOk(['items' => array_slice($items, 0, $limit)]);
} catch (PDOException $e) {
    error_log('[api/student/dashboard/recent-activity] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
