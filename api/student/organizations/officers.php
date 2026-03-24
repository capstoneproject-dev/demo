<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Invalid session.', 401);
    }

    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        $orgId = (int)($session['mapped_org_id'] ?? 0);
    }

    if ($orgId <= 0) {
        $user = getUserById($userId);
        if ($user && !empty($user['program_id'])) {
            $mappedOrg = getMappedOrgByProgram((int)$user['program_id']);
            $orgId = (int)($mappedOrg['org_id'] ?? 0);
        }
    }

    if ($orgId <= 0) {
        jsonError('No organization mapped to this account.', 404);
    }

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
        "SELECT om.membership_id,
                om.org_id,
                CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
                u.student_number,
                u.employee_number,
                r.role_name,
                COALESCE(ap.program_code, '') AS program_code,
                {$sectionExpr} AS section,
                om.joined_at
         FROM organization_members om
         JOIN users u ON u.user_id = om.user_id
         JOIN org_roles r ON r.role_id = om.role_id
         LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
         LEFT JOIN academic_programs ap ON ap.program_id = COALESCE(u.program_id, sn.program_id)
         WHERE om.org_id = :org
           AND om.is_active = 1
           AND u.is_active = 1
           AND r.is_active = 1
           AND r.can_access_org_dashboard = 1
         ORDER BY FIELD(LOWER(r.role_name), 'president', 'vice president', 'vice-president', 'secretary', 'treasurer', 'auditor'),
                  r.role_name ASC,
                  officer_name ASC"
    );
    $stmt->execute([':org' => $orgId]);
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['membership_id'] = (int)$item['membership_id'];
        $item['org_id'] = (int)$item['org_id'];
    }

    jsonOk([
        'org_id' => $orgId,
        'items' => $items,
    ]);
} catch (PDOException $e) {
    error_log('[api/student/organizations/officers] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
