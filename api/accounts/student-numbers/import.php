<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body    = getRequestBody();
$records = $body['records'] ?? [];

if (!is_array($records) || count($records) === 0) {
    jsonError('records array is required and must not be empty.', 422);
}

$session = getPhpSession();
$actorId = $session['user_id'] ?? null;

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("
        INSERT IGNORE INTO student_numbers
            (student_number, student_name, program_code, institute, year_section,
             email, phone, has_unpaid_debt, is_active, added_by_user_id)
        VALUES (:sn, :name, :prog, :inst, :ys, :email, :phone, :debt, :active, :by)
    ");

    $imported = 0;
    $skipped  = 0;
    $errors   = 0;

    foreach ($records as $row) {
        $sn   = trim($row['studentId']   ?? '');
        $name = trim($row['studentName'] ?? '');
        if (!$sn || !$name) { $errors++; continue; }

        try {
            $stmt->execute([
                ':sn'     => $sn,
                ':name'   => $name,
                ':prog'   => trim($row['programCode'] ?? ''),
                ':inst'   => trim($row['institute']   ?? ''),
                ':ys'     => trim($row['yearSection'] ?? '') ?: null,
                ':email'  => trim($row['email']  ?? '') ?: null,
                ':phone'  => trim($row['phone']  ?? '') ?: null,
                ':debt'   => 0,
                ':active' => 1,
                ':by'     => $actorId,
            ]);
            if ($stmt->rowCount() > 0) { $imported++; } else { $skipped++; }
        } catch (PDOException $innerEx) {
            $errors++;
        }
    }

    jsonOk(['imported' => $imported, 'skipped' => $skipped, 'errors' => $errors]);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
