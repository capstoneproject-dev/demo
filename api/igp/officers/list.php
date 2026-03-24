<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = igpRequireOfficerOrgContext();
    $pdo = getPdo();

    $hasUsersYearSectionStmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'year_section'
    ");
    $hasUsersYearSectionStmt->execute();
    $hasUsersYearSection = ((int)$hasUsersYearSectionStmt->fetchColumn() > 0);

    $hasSnYearSectionStmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'student_numbers'
          AND COLUMN_NAME = 'year_section'
    ");
    $hasSnYearSectionStmt->execute();
    $hasSnYearSection = ((int)$hasSnYearSectionStmt->fetchColumn() > 0);

    if ($hasUsersYearSection && $hasSnYearSection) {
        $departmentExpr = "COALESCE(NULLIF(u.year_section, ''), NULLIF(sn.year_section, ''), '')";
    } elseif ($hasUsersYearSection) {
        $departmentExpr = "COALESCE(NULLIF(u.year_section, ''), '')";
    } elseif ($hasSnYearSection) {
        $departmentExpr = "COALESCE(NULLIF(sn.year_section, ''), '')";
    } else {
        $departmentExpr = "''";
    }

    $stmt = $pdo->prepare(
        "SELECT om.membership_id AS id,
                u.student_number AS officerId,
                CONCAT(u.first_name, ' ', u.last_name) AS officerName,
                {$departmentExpr} AS department,
                r.role_name AS roleName,
                COALESCE(NULLIF(om.position_title, ''), r.role_name) AS positionTitle,
                om.joined_at AS joinedAt,
                om.is_active AS isActive
         FROM organization_members om
         JOIN users u ON u.user_id = om.user_id
         JOIN org_roles r ON r.role_id = om.role_id
         LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
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

