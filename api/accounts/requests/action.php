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
            SELECT sn_id, student_name, program_id, institute_id, year_section
            FROM student_numbers WHERE student_number = :sn LIMIT 1
        ");
        $snStmt->execute([':sn' => $req['student_number']]);
        $snRecord = $snStmt->fetch();

        if (!$snRecord) {
            jsonError('Student number ' . $req['student_number'] . ' is not in the student numbers database. Cannot approve.', 422);
        }

        // Resolve program from pending request program_code first, then fallback to whitelist program_id.
        $programId = 0;
        if (!empty($req['program_code'])) {
            $progStmt = $pdo->prepare("SELECT program_id FROM academic_programs WHERE program_code = :code LIMIT 1");
            $progStmt->execute([':code' => $req['program_code']]);
            $prog = $progStmt->fetch();
            if ($prog) {
                $programId = (int)$prog['program_id'];
            }
        }
        if ($programId <= 0 && !empty($snRecord['program_id'])) {
            $programId = (int)$snRecord['program_id'];
        }
        if ($programId <= 0) {
            jsonError("Program for this registration request is not resolvable.", 422);
        }

        // Build name
        $fullName  = $req['student_name'] ?: $snRecord['student_name'];
        $parts     = explode(' ', trim($fullName));
        $lastName  = count($parts) > 1 ? array_pop($parts) : $fullName;
        $firstName = count($parts) > 0 ? implode(' ', $parts) : $fullName;

        $email    = $req['email'];
        $yearSec  = $req['year_section'] ?: $snRecord['year_section'];

        // Check for existing user — always resolve $userId
        $dupStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn OR email = :email LIMIT 1");
        $dupStmt->execute([':sn' => $req['student_number'], ':email' => $email]);
        $existingUser = $dupStmt->fetch();
        if (!$existingUser) {
            // Create user
            $insUser = $pdo->prepare("
                INSERT INTO users
                    (student_number, email, password_hash, first_name, last_name,
                     phone, account_type, has_unpaid_debt, is_active, program_id, institute_id, year_section)
                VALUES (:sn, :email, :pw, :fn, :ln, :phone, 'student', 0, 1, :pid, :iid, :ys)
            ");
            $insUser->execute([
                ':sn'    => $req['student_number'],
                ':email' => $email,
                ':pw'    => $req['password_hash'],
                ':fn'    => $firstName,
                ':ln'    => $lastName,
                ':phone' => $req['phone'] ?? null,
                ':pid'   => $programId,
                ':iid'   => $snRecord['institute_id'] ?? null,
                ':ys'    => $yearSec ?: null,
            ]);
            $userId = (int)$pdo->lastInsertId();
        } else {
            $userId = (int)$existingUser['user_id'];
            $pdo->prepare("
                UPDATE users
                SET program_id = :pid,
                    institute_id = :iid,
                    year_section = :ys
                WHERE user_id = :uid
            ")->execute([
                ':pid' => $programId,
                ':iid' => $snRecord['institute_id'] ?? null,
                ':ys' => $yearSec ?: null,
                ':uid' => $userId,
            ]);
        }

        // If org_officer request, add/update org membership
        if ($req['requested_role'] === 'org_officer' && !empty($req['requested_org'])) {
            $orgStmt = $pdo->prepare("SELECT org_id FROM organizations WHERE org_code = :code OR org_name = :name LIMIT 1");
            $orgStmt->execute([':code' => $req['requested_org'], ':name' => $req['requested_org']]);
            $org = $orgStmt->fetch();

            if ($org) {
                $orgId = (int)$org['org_id'];

                // Get or create 'officer' role for this org
                $roleStmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :oid AND role_name = 'officer' LIMIT 1");
                $roleStmt->execute([':oid' => $orgId]);
                $role = $roleStmt->fetch();

                if (!$role) {
                    $pdo->prepare("INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard) VALUES (:oid, 'officer', 1)")
                        ->execute([':oid' => $orgId]);
                    $roleId = (int)$pdo->lastInsertId();
                } else {
                    $roleId = (int)$role['role_id'];
                }

                // Upsert organization_members.
                // If a student already has a member row for this org, upgrade it to officer.
                $pdo->prepare("
                    INSERT INTO organization_members (user_id, org_id, role_id, joined_at, is_active)
                    VALUES (:uid, :oid, :rid, CURDATE(), 1)
                    ON DUPLICATE KEY UPDATE
                        role_id = VALUES(role_id),
                        is_active = VALUES(is_active)
                ")->execute([':uid' => $userId, ':oid' => $orgId, ':rid' => $roleId]);
            }
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
