<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();

$studentNumber = trim($body['studentId']   ?? '');
$studentName   = trim($body['studentName'] ?? '');
$programCode   = trim($body['programCode'] ?? '');
$institute     = trim($body['institute']   ?? '');
$yearSection   = trim($body['yearSection'] ?? '') ?: null;
$email         = trim($body['email']       ?? '') ?: null;
$isActive      = isset($body['isActive'])      ? (int)(bool)$body['isActive']      : 1;
$hasUnpaidDebt = isset($body['hasUnpaidDebt']) ? (int)(bool)$body['hasUnpaidDebt'] : 0;
// For updates: pass either userId (user_id) or origStudentId (student_number). userId takes priority.
$userId        = (int)($body['userId']        ?? 0);
$origStudentId = trim($body['origStudentId']  ?? '');

if (!$studentNumber || !$studentName || !$programCode || !$institute || !$yearSection) {
    jsonError('studentId, studentName, programCode, institute, and yearSection are required.', 422);
}

// Build email placeholder if none provided
if (!$email) {
    $email = strtolower(str_replace([' ', '/'], ['', '-'], $studentNumber)) . '@student.noop';
}

// Split name into first / last (last word = last name)
$parts     = explode(' ', trim($studentName));
$lastName  = count($parts) > 1 ? array_pop($parts) : $studentName;
$firstName = count($parts) > 0 ? implode(' ', $parts) : $studentName;

try {
    $pdo = getPdo();

    // Look up program_id
    $progStmt = $pdo->prepare("SELECT program_id FROM academic_programs WHERE program_code = :code LIMIT 1");
    $progStmt->execute([':code' => $programCode]);
    $prog = $progStmt->fetch();
    if (!$prog) {
        jsonError("Program code '$programCode' not found in the database. Please configure programs first.", 422);
    }
    $programId = (int)$prog['program_id'];

    if ($userId === 0 && $origStudentId === '') {
        // ----- INSERT -----
        // Check for duplicate student_number
        $chk = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn");
        $chk->execute([':sn' => $studentNumber]);
        if ($chk->fetch()) {
            jsonError('That student number already exists.', 409);
        }

        // Default password = bcrypt(studentNumber)
        $pwHash = password_hash($studentNumber, PASSWORD_BCRYPT);

        $ins = $pdo->prepare("
            INSERT INTO users
                (student_number, email, password_hash, first_name, last_name,
                 account_type, has_unpaid_debt, is_active)
            VALUES (:sn, :email, :pw, :fn, :ln, 'student', :debt, :active)
        ");
        $ins->execute([
            ':sn'     => $studentNumber,
            ':email'  => $email,
            ':pw'     => $pwHash,
            ':fn'     => $firstName,
            ':ln'     => $lastName,
            ':debt'   => $hasUnpaidDebt,
            ':active' => $isActive,
        ]);
        $userId = (int)$pdo->lastInsertId();

        $insProf = $pdo->prepare("
            INSERT INTO student_profiles (user_id, program_id, section)
            VALUES (:uid, :pid, :sec)
        ");
        $insProf->execute([':uid' => $userId, ':pid' => $programId, ':sec' => $yearSection]);

        jsonOk(['user_id' => $userId, 'msg' => 'Student account created.']);
    } else {
        // ----- UPDATE -----
        // Look up by userId (user_id) if provided, otherwise fall back to origStudentId
        if ($userId > 0) {
            $chk = $pdo->prepare("SELECT user_id, student_number FROM users WHERE user_id = :uid");
            $chk->execute([':uid' => $userId]);
        } else {
            $chk = $pdo->prepare("SELECT user_id, student_number FROM users WHERE student_number = :sn");
            $chk->execute([':sn' => $origStudentId]);
        }
        $existing = $chk->fetch();
        if (!$existing) {
            jsonError('Student not found.', 404);
        }
        $userId            = (int)$existing['user_id'];
        $currentStudentNum = $existing['student_number'];

        // Check new student_number uniqueness (if changed)
        if ($studentNumber !== $currentStudentNum) {
            $dupChk = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn AND user_id != :uid");
            $dupChk->execute([':sn' => $studentNumber, ':uid' => $userId]);
            if ($dupChk->fetch()) {
                jsonError('That student number is already taken.', 409);
            }
        }

        $upd = $pdo->prepare("
            UPDATE users
            SET student_number = :sn,
                email          = :email,
                first_name     = :fn,
                last_name      = :ln,
                has_unpaid_debt = :debt,
                is_active      = :active
            WHERE user_id = :uid
        ");
        $upd->execute([
            ':sn'     => $studentNumber,
            ':email'  => $email,
            ':fn'     => $firstName,
            ':ln'     => $lastName,
            ':debt'   => $hasUnpaidDebt,
            ':active' => $isActive,
            ':uid'    => $userId,
        ]);

        // Update or insert student profile
        $profStmt = $pdo->prepare("SELECT user_id FROM student_profiles WHERE user_id = :uid");
        $profStmt->execute([':uid' => $userId]);
        if ($profStmt->fetch()) {
            $pdo->prepare("UPDATE student_profiles SET program_id = :pid, section = :sec WHERE user_id = :uid")
                ->execute([':pid' => $programId, ':sec' => $yearSection, ':uid' => $userId]);
        } else {
            $pdo->prepare("INSERT INTO student_profiles (user_id, program_id, section) VALUES (:uid, :pid, :sec)")
                ->execute([':uid' => $userId, ':pid' => $programId, ':sec' => $yearSection]);
        }

        jsonOk(['user_id' => $userId, 'msg' => 'Student account updated.']);
    }
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'Duplicate entry')) {
        jsonError('Duplicate entry: that student number or email already exists.', 409);
    }
    jsonError('DB error: ' . $e->getMessage(), 500);
}
