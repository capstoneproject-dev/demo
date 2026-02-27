<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo = getPdo();
    $stmt = $pdo->prepare("
        SELECT sn_id AS id,
               student_number AS studentId,
               student_name   AS studentName,
               sn.program_id  AS programId,
               ap.program_code AS programCode,
               sn.institute_id AS instituteId,
               i.institute_name AS institute,
               year_section   AS yearSection,
               sn.is_active    AS isActive,
               sn.added_at     AS addedAt,
               sn.updated_at   AS updatedAt
        FROM student_numbers sn
        LEFT JOIN academic_programs ap ON ap.program_id = sn.program_id
        LEFT JOIN institutes i ON i.institute_id = sn.institute_id
        ORDER BY student_number ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['programId'] = $r['programId'] !== null ? (int)$r['programId'] : null;
        $r['instituteId'] = $r['instituteId'] !== null ? (int)$r['instituteId'] : null;
        $r['isActive']      = (bool)$r['isActive'];
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
