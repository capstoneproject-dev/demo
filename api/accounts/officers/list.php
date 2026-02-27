<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("
        SELECT om.membership_id AS id,
               u.student_number AS studentId,
               CONCAT(u.first_name, ' ', u.last_name) AS studentName,
               COALESCE(i.institute_name, '') AS institute,
               org.org_code AS orgCode,
               org.org_name AS orgName,
               r.role_name AS roleName,
               om.joined_at AS joinedAt,
               om.is_active AS isActive,
               om.created_at AS addedAt
        FROM organization_members om
        JOIN users        u   ON u.user_id   = om.user_id
        JOIN organizations org ON org.org_id = om.org_id
        JOIN org_roles     r   ON r.role_id  = om.role_id
        LEFT JOIN institutes i         ON i.institute_id = u.institute_id
        ORDER BY org.org_code ASC, u.student_number ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['isActive'] = (bool)$r['isActive'];
        $r['id']       = (int)$r['id'];
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
