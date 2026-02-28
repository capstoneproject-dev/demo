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
        $sectionExpr = "COALESCE(NULLIF(u.year_section, ''), NULLIF(sn.year_section, ''), '')";
    } elseif ($hasUsersYearSection) {
        $sectionExpr = "COALESCE(NULLIF(u.year_section, ''), '')";
    } elseif ($hasSnYearSection) {
        $sectionExpr = "COALESCE(NULLIF(sn.year_section, ''), '')";
    } else {
        $sectionExpr = "''";
    }

    $stmt = $pdo->prepare(
        "SELECT u.user_id,
               CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
               u.student_number,
               u.employee_number,
               r.role_name,
               COALESCE(ap.program_code, '') AS program_code,
               {$sectionExpr} AS section
        FROM organization_members om
        JOIN users u ON u.user_id = om.user_id
        JOIN org_roles r ON r.role_id = om.role_id
        LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
        LEFT JOIN academic_programs ap ON ap.program_id = COALESCE(u.program_id, sn.program_id)
        WHERE om.org_id = :org
          AND om.is_active = 1
          AND u.is_active = 1
          AND r.is_active = 1
          AND r.org_id = :org_role
          AND r.can_access_org_dashboard = 1
        ORDER BY officer_name ASC"
    );
    $stmt->execute([
        ':org' => $ctx['org_id'],
        ':org_role' => $ctx['org_id']
    ]);
    $items = $stmt->fetchAll();
    jsonOk(['items' => $items]);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/reference/officers] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
