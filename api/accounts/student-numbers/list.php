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
               program_code   AS programCode,
               institute,
               year_section   AS yearSection,
               email,
               phone,
               has_unpaid_debt AS hasUnpaidDebt,
               is_active       AS isActive,
               added_at        AS addedAt,
               updated_at      AS updatedAt
        FROM student_numbers
        ORDER BY student_number ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['hasUnpaidDebt'] = (bool)$r['hasUnpaidDebt'];
        $r['isActive']      = (bool)$r['isActive'];
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
