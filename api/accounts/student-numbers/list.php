<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiRequireOsaSystemAdministrator();

try {
    $pdo = getPdo();
    $stmt = $pdo->prepare("
        SELECT sn_id AS id,
               sn.student_number AS studentId,
               student_name   AS studentName,
               sn.program_id  AS programId,
               ap.program_code AS programCode,
               sn.institute_id AS instituteId,
               i.institute_name AS institute,
               sn.year_section AS yearSection,
               CASE
                   WHEN u.user_id IS NOT NULL AND u.email NOT LIKE '%@student.noop'
                   THEN COALESCE(u.email, '')
                   ELSE ''
               END AS email,
               CASE WHEN u.user_id IS NOT NULL THEN COALESCE(u.phone, '') ELSE '' END AS phone,
               CASE WHEN u.user_id IS NOT NULL THEN 1 ELSE 0 END AS isRegistered,
               sn.is_active    AS isActive,
               sn.added_at     AS addedAt,
               sn.updated_at   AS updatedAt
        FROM student_numbers sn
        LEFT JOIN academic_programs ap ON ap.program_id = sn.program_id
        LEFT JOIN institutes i ON i.institute_id = sn.institute_id
        LEFT JOIN users u ON u.student_number = sn.student_number
        ORDER BY sn.student_number ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['programId'] = $r['programId'] !== null ? (int)$r['programId'] : null;
        $r['instituteId'] = $r['instituteId'] !== null ? (int)$r['instituteId'] : null;
        $r['isRegistered'] = (bool)$r['isRegistered'];
        $r['isActive']      = (bool)$r['isActive'];
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
