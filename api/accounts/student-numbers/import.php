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
            (student_number, student_name, program_id, institute_id, year_section,
             is_active, added_by_user_id)
        VALUES (:sn, :name, :prog_id, :inst_id, :ys, :active, :by)
    ");

    $imported = 0;
    $skipped  = 0;
    $errors   = 0;

    foreach ($records as $row) {
        $sn   = trim($row['studentId']   ?? '');
        $name = trim($row['studentName'] ?? '');
        if (!$sn || !$name) { $errors++; continue; }

        try {
            $programId = isset($row['programId']) ? (int)$row['programId'] : 0;
            $instituteId = isset($row['instituteId']) ? (int)$row['instituteId'] : 0;
            $programCode = trim((string)($row['programCode'] ?? ''));
            $instituteName = trim((string)($row['institute'] ?? ''));

            if ($programId <= 0 && $programCode !== '') {
                $pStmt = $pdo->prepare("SELECT program_id, institute_id FROM academic_programs WHERE UPPER(program_code) = UPPER(:code) LIMIT 1");
                $pStmt->execute([':code' => $programCode]);
                $pRow = $pStmt->fetch();
                if ($pRow) {
                    $programId = (int)$pRow['program_id'];
                    if ($instituteId <= 0 && !empty($pRow['institute_id'])) {
                        $instituteId = (int)$pRow['institute_id'];
                    }
                }
            }
            if ($instituteId <= 0 && $instituteName !== '') {
                $iStmt = $pdo->prepare("SELECT institute_id FROM institutes WHERE UPPER(institute_name) = UPPER(:name) LIMIT 1");
                $iStmt->execute([':name' => $instituteName]);
                $iRow = $iStmt->fetch();
                if ($iRow) {
                    $instituteId = (int)$iRow['institute_id'];
                }
            }
            if ($programId > 0 && $instituteId <= 0) {
                $ipStmt = $pdo->prepare("SELECT institute_id FROM academic_programs WHERE program_id = :pid LIMIT 1");
                $ipStmt->execute([':pid' => $programId]);
                $ipRow = $ipStmt->fetch();
                if ($ipRow) {
                    $instituteId = (int)$ipRow['institute_id'];
                }
            }

            $stmt->execute([
                ':sn'     => $sn,
                ':name'   => $name,
                ':prog_id'=> $programId > 0 ? $programId : null,
                ':inst_id'=> $instituteId > 0 ? $instituteId : null,
                ':ys'     => trim($row['yearSection'] ?? '') ?: null,
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
