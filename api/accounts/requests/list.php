<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("
        SELECT reg_id AS id,
               student_number  AS studentId,
               student_name    AS studentName,
               email,
               program_code    AS programCode,
               year_section    AS yearSection,
               requested_role  AS requestedRole,
               requested_org   AS requestedOrg,
               status,
               requested_at    AS requestedAt,
               reviewed_at     AS reviewedAt,
               updated_at      AS updatedAt
        FROM pending_registrations
        ORDER BY requested_at DESC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int)$r['id'];
        // Map field names the frontend expects
        $r['name']         = $r['studentName'];
        $r['course']       = $r['programCode'];
        $r['requestTime']  = $r['requestedAt'];
        $r['approvedAt']   = ($r['status'] === 'approved') ? $r['reviewedAt'] : null;
        $r['rejectedAt']   = ($r['status'] === 'rejected') ? $r['reviewedAt'] : null;
    }
    jsonOk(['items' => $rows]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
