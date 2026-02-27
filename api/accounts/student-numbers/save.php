<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');
$studentName   = trim($body['studentName'] ?? '');
$programId     = isset($body['programId']) ? (int)$body['programId'] : 0;
$instituteId   = isset($body['instituteId']) ? (int)$body['instituteId'] : 0;
$programCode   = trim($body['programCode'] ?? '');
$institute     = trim($body['institute'] ?? '');
$yearSection   = trim($body['yearSection'] ?? '');
$isActive      = isset($body['isActive'])      ? (int)(bool)$body['isActive']      : 1;
$origId        = trim($body['origStudentId'] ?? ''); // empty = new record

if (!$studentNumber || !$studentName) {
    jsonError('studentId and studentName are required.', 422);
}

$session  = getPhpSession();
$actorId  = $session['user_id'] ?? null;

try {
    $pdo = getPdo();

    if ($programId <= 0 && $programCode !== '') {
        $progStmt = $pdo->prepare("SELECT program_id, institute_id FROM academic_programs WHERE UPPER(program_code) = UPPER(:code) LIMIT 1");
        $progStmt->execute([':code' => $programCode]);
        $prog = $progStmt->fetch();
        if ($prog) {
            $programId = (int)$prog['program_id'];
            if ($instituteId <= 0 && !empty($prog['institute_id'])) {
                $instituteId = (int)$prog['institute_id'];
            }
        } else {
            jsonError("Unknown programCode '$programCode'.", 422);
        }
    }
    if ($instituteId <= 0 && $institute !== '') {
        $instStmt = $pdo->prepare("SELECT institute_id FROM institutes WHERE UPPER(institute_name) = UPPER(:name) LIMIT 1");
        $instStmt->execute([':name' => $institute]);
        $inst = $instStmt->fetch();
        if ($inst) {
            $instituteId = (int)$inst['institute_id'];
        } else {
            jsonError("Unknown institute '$institute'.", 422);
        }
    }
    if ($programId > 0 && $instituteId <= 0) {
        $instByProgStmt = $pdo->prepare("SELECT institute_id FROM academic_programs WHERE program_id = :pid LIMIT 1");
        $instByProgStmt->execute([':pid' => $programId]);
        $instByProg = $instByProgStmt->fetch();
        if ($instByProg) {
            $instituteId = (int)$instByProg['institute_id'];
        }
    }

    if ($origId === '') {
        // INSERT
        $stmt = $pdo->prepare("
            INSERT INTO student_numbers
                (student_number, student_name, program_id, institute_id, year_section,
                 is_active, added_by_user_id)
            VALUES (:sn, :name, :prog_id, :inst_id, :ys, :active, :by)
        ");
        $stmt->execute([
            ':sn'     => $studentNumber,
            ':name'   => $studentName,
            ':prog_id'=> $programId > 0 ? $programId : null,
            ':inst_id'=> $instituteId > 0 ? $instituteId : null,
            ':ys'     => $yearSection ?: null,
            ':active' => $isActive,
            ':by'     => $actorId,
        ]);
        jsonOk(['sn_id' => (int)$pdo->lastInsertId(), 'msg' => 'Student number added.']);
    } else {
        // UPDATE
        $stmt = $pdo->prepare("
            UPDATE student_numbers
            SET student_number = :sn,
                student_name   = :name,
                program_id     = :prog_id,
                institute_id   = :inst_id,
                year_section   = :ys,
                is_active      = :active
            WHERE student_number = :orig
        ");
        $stmt->execute([
            ':sn'     => $studentNumber,
            ':name'   => $studentName,
            ':prog_id'=> $programId > 0 ? $programId : null,
            ':inst_id'=> $instituteId > 0 ? $instituteId : null,
            ':ys'     => $yearSection ?: null,
            ':active' => $isActive,
            ':orig'   => $origId,
        ]);
        if ($stmt->rowCount() === 0) {
            jsonError('Student number not found.', 404);
        }
        jsonOk(['msg' => 'Student number updated.']);
    }
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'Duplicate entry')) {
        jsonError('That student number already exists.', 409);
    }
    jsonError('DB error: ' . $e->getMessage(), 500);
}
