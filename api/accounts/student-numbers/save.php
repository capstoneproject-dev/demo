<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');
$studentName   = trim($body['studentName'] ?? '');
$programCode   = trim($body['programCode'] ?? '');
$institute     = trim($body['institute'] ?? '');
$yearSection   = trim($body['yearSection'] ?? '');
$email         = trim($body['email'] ?? '') ?: null;
$phone         = trim($body['phone'] ?? '') ?: null;
$hasUnpaidDebt = isset($body['hasUnpaidDebt']) ? (int)(bool)$body['hasUnpaidDebt'] : 0;
$isActive      = isset($body['isActive'])      ? (int)(bool)$body['isActive']      : 1;
$origId        = trim($body['origStudentId'] ?? ''); // empty = new record

if (!$studentNumber || !$studentName || !$programCode || !$institute) {
    jsonError('studentId, studentName, programCode, and institute are required.', 422);
}

$session  = getPhpSession();
$actorId  = $session['user_id'] ?? null;

try {
    $pdo = getPdo();

    if ($origId === '') {
        // INSERT
        $stmt = $pdo->prepare("
            INSERT INTO student_numbers
                (student_number, student_name, program_code, institute, year_section,
                 email, phone, has_unpaid_debt, is_active, added_by_user_id)
            VALUES (:sn, :name, :prog, :inst, :ys, :email, :phone, :debt, :active, :by)
        ");
        $stmt->execute([
            ':sn'     => $studentNumber,
            ':name'   => $studentName,
            ':prog'   => $programCode,
            ':inst'   => $institute,
            ':ys'     => $yearSection ?: null,
            ':email'  => $email,
            ':phone'  => $phone,
            ':debt'   => $hasUnpaidDebt,
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
                program_code   = :prog,
                institute      = :inst,
                year_section   = :ys,
                email          = :email,
                phone          = :phone,
                has_unpaid_debt = :debt,
                is_active      = :active
            WHERE student_number = :orig
        ");
        $stmt->execute([
            ':sn'     => $studentNumber,
            ':name'   => $studentName,
            ':prog'   => $programCode,
            ':inst'   => $institute,
            ':ys'     => $yearSection ?: null,
            ':email'  => $email,
            ':phone'  => $phone,
            ':debt'   => $hasUnpaidDebt,
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
