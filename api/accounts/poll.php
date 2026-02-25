<?php
/**
 * Lightweight poll endpoint.
 * Returns a small "fingerprint" of each collection so the frontend can
 * detect changes without fetching full datasets every poll cycle.
 */
require_once '../../config/db.php';
require_once '../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo  = getPdo();
    $row  = $pdo->query("
        SELECT
            (SELECT COUNT(*)      FROM users               WHERE account_type = 'student') AS students_count,
            (
                SELECT MAX(ts) FROM (
                    SELECT MAX(updated_at) AS ts FROM users WHERE account_type = 'student'
                    UNION ALL
                    SELECT MAX(updated_at) AS ts FROM student_profiles
                ) s
            ) AS students_last,
            (SELECT COUNT(*)      FROM organization_members)                                AS officers_count,
            (
                SELECT MAX(ts) FROM (
                    SELECT MAX(updated_at) AS ts FROM organization_members
                    UNION ALL
                    SELECT MAX(updated_at) AS ts FROM org_roles
                    UNION ALL
                    SELECT MAX(updated_at) AS ts FROM organizations
                ) o
            ) AS officers_last,
            (SELECT COUNT(*)      FROM pending_registrations)                               AS requests_count,
            (SELECT COUNT(*)      FROM pending_registrations WHERE status = 'pending')      AS requests_pending,
            (SELECT MAX(updated_at) FROM pending_registrations)                             AS requests_last,
            (SELECT COUNT(*)      FROM student_numbers)                                     AS sn_count,
            (SELECT MAX(updated_at) FROM student_numbers)                                   AS sn_last
    ")->fetch();

    jsonOk([
        'students'       => ['count' => (int)$row['students_count'],  'lastUpdated' => $row['students_last']],
        'officers'       => ['count' => (int)$row['officers_count'],  'lastUpdated' => $row['officers_last']],
        'requests'       => ['count' => (int)$row['requests_count'],  'pending' => (int)$row['requests_pending'], 'lastUpdated' => $row['requests_last']],
        'studentNumbers' => ['count' => (int)$row['sn_count'],        'lastUpdated' => $row['sn_last']],
    ]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
