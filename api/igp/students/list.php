<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    igpRequireOfficerOrgContext();
    $stmt = getPdo()->prepare(
        "SELECT u.user_id,
                u.student_number AS studentId,
                CONCAT(u.first_name, ' ', u.last_name) AS studentName,
                COALESCE(sp.section, '') AS section,
                COALESCE(ap.program_code, '') AS programCode,
                u.is_active AS isActive
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
         LEFT JOIN academic_programs ap ON ap.program_id = sp.program_id
         WHERE u.account_type = 'student'
         ORDER BY u.student_number ASC"
    );
    $stmt->execute();
    $items = $stmt->fetchAll();
    foreach ($items as &$i) {
        $i['user_id'] = (int)$i['user_id'];
        $i['isActive'] = (bool)$i['isActive'];
    }
    jsonOk(['items' => $items]);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/students/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
