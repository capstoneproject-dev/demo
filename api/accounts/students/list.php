<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("
        SELECT u.user_id,
               u.student_number AS studentId,
               CONCAT(u.first_name, ' ', u.last_name) AS studentName,
               COALESCE(i.institute_name, '') AS institute,
               COALESCE(ap.program_code, '') AS programCode,
               COALESCE(sn.year_section, '') AS yearSection,
               COALESCE(u.email, '') AS email,
               COALESCE(u.phone, '') AS phone,
               u.has_unpaid_debt AS hasUnpaidDebt,
               u.is_active AS isActive,
               u.created_at AS addedAt,
               u.updated_at AS updatedAt
        FROM users u
        LEFT JOIN academic_programs ap ON ap.program_id   = u.program_id
        LEFT JOIN institutes i         ON i.institute_id  = u.institute_id
        LEFT JOIN student_numbers sn   ON sn.student_number = u.student_number
        WHERE u.account_type = 'student'
        ORDER BY u.student_number ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['hasUnpaidDebt'] = (bool)$r['hasUnpaidDebt'];
        $r['isActive']      = (bool)$r['isActive'];
        $r['id']            = (int)$r['user_id'];
        unset($r['user_id']);
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
