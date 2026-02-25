<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body      = getRequestBody();
$requestId = (int)($body['requestId'] ?? 0);
$action    = trim($body['action'] ?? ''); // approve | reject | reopen

if (!$requestId || !in_array($action, ['approve', 'reject', 'reopen'], true)) {
    jsonError('requestId and action (approve|reject|reopen) are required.', 422);
}

$session  = getPhpSession();
$actorId  = $session['user_id'] ?? null;

try {
    $pdo = getPdo();

    // Fetch request
    $getStmt = $pdo->prepare("SELECT * FROM pending_registrations WHERE reg_id = :id");
    $getStmt->execute([':id' => $requestId]);
    $req = $getStmt->fetch();
    if (!$req) {
        jsonError('Registration request not found.', 404);
    }

    if ($action === 'approve') {
        if ($req['status'] !== 'pending') {
            jsonError('Only pending requests can be approved.', 409);
        }

        // Verify student number is in whitelist
        $snStmt = $pdo->prepare("
            SELECT sn_id, student_name, program_code, institute, year_section, email, phone
            FROM student_numbers WHERE student_number = :sn LIMIT 1
        ");
        $snStmt->execute([':sn' => $req['student_number']]);
        $snRecord = $snStmt->fetch();

        if (!$snRecord) {
            jsonError('Student number ' . $req['student_number'] . ' is not in the student numbers database. Cannot approve.', 422);
        }

        // Lookup program_id using the program_code stored in pending_registrations
        $progCode = $req['program_code'] ?: $snRecord['program_code'];
        $progStmt = $pdo->prepare("SELECT program_id FROM academic_programs WHERE program_code = :code LIMIT 1");
        $progStmt->execute([':code' => $progCode]);
        $prog = $progStmt->fetch();
        if (!$prog) {
            jsonError("Program '$progCode' not found in database.", 422);
        }
        $programId = (int)$prog['program_id'];

        // Build name
        $fullName  = $req['student_name'] ?: $snRecord['student_name'];
        $parts     = explode(' ', trim($fullName));
        $lastName  = count($parts) > 1 ? array_pop($parts) : $fullName;
        $firstName = count($parts) > 0 ? implode(' ', $parts) : $fullName;

        $email    = $req['email'];
        $yearSec  = $req['year_section'] ?: $snRecord['year_section'];

        // Check for existing user
        $dupStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn OR email = :email LIMIT 1");
        $dupStmt->execute([':sn' => $req['student_number'], ':email' => $email]);
        if (!$dupStmt->fetch()) {
            // Create user
            $insUser = $pdo->prepare("
                INSERT INTO users
                    (student_number, email, password_hash, first_name, last_name,
                     account_type, has_unpaid_debt, is_active)
                VALUES (:sn, :email, :pw, :fn, :ln, 'student', 0, 1)
            ");
            $insUser->execute([
                ':sn'    => $req['student_number'],
                ':email' => $email,
                ':pw'    => $req['password_hash'],
                ':fn'    => $firstName,
                ':ln'    => $lastName,
            ]);
            $userId = (int)$pdo->lastInsertId();

            $pdo->prepare("INSERT INTO student_profiles (user_id, program_id, section) VALUES (:uid, :pid, :sec)")
                ->execute([':uid' => $userId, ':pid' => $programId, ':sec' => $yearSec]);
        }

        // Mark approved
        $pdo->prepare("
            UPDATE pending_registrations
            SET status = 'approved', reviewed_by_user_id = :actor, reviewed_at = NOW()
            WHERE reg_id = :id
        ")->execute([':actor' => $actorId, ':id' => $requestId]);

        jsonOk(['msg' => 'Request approved and student account created.']);

    } elseif ($action === 'reject') {
        if ($req['status'] !== 'pending') {
            jsonError('Only pending requests can be rejected.', 409);
        }
        $notes = trim($body['reviewerNotes'] ?? '') ?: null;
        $pdo->prepare("
            UPDATE pending_registrations
            SET status = 'rejected', reviewed_by_user_id = :actor,
                reviewed_at = NOW(), reviewer_notes = :notes
            WHERE reg_id = :id
        ")->execute([':actor' => $actorId, ':notes' => $notes, ':id' => $requestId]);

        jsonOk(['msg' => 'Request rejected.']);

    } elseif ($action === 'reopen') {
        if ($req['status'] !== 'rejected') {
            jsonError('Only rejected requests can be reopened.', 409);
        }
        $pdo->prepare("
            UPDATE pending_registrations
            SET status = 'pending', reviewed_by_user_id = NULL,
                reviewed_at = NULL, reviewer_notes = NULL
            WHERE reg_id = :id
        ")->execute([':id' => $requestId]);

        jsonOk(['msg' => 'Request moved back to pending.']);
    }

} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
