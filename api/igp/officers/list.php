<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = igpRequireOfficerOrgContext();
    $stmt = getPdo()->prepare(
        "SELECT om.membership_id AS id,
                u.student_number AS officerId,
                CONCAT(u.first_name, ' ', u.last_name) AS officerName,
                COALESCE(sp.section, '') AS department,
                r.role_name AS roleName,
                om.joined_at AS joinedAt,
                om.is_active AS isActive
         FROM organization_members om
         JOIN users u ON u.user_id = om.user_id
         JOIN org_roles r ON r.role_id = om.role_id
         LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
         WHERE om.org_id = :org
         ORDER BY u.student_number ASC"
    );
    $stmt->execute([':org' => $ctx['org_id']]);
    $items = $stmt->fetchAll();
    foreach ($items as &$i) {
        $i['id'] = (int)$i['id'];
        $i['isActive'] = (bool)$i['isActive'];
    }
    jsonOk(['items' => $items]);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/officers/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}

