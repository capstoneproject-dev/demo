<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$id = (int)($body['id'] ?? 0);
$officerId = trim((string)($body['officerId'] ?? ''));
$officerName = trim((string)($body['officerName'] ?? ''));
$department = trim((string)($body['department'] ?? ''));
$roleName = trim((string)($body['roleName'] ?? 'officer'));
$joinedAt = trim((string)($body['joinedAt'] ?? date('Y-m-d')));
$isActive = isset($body['isActive']) ? (int)(bool)$body['isActive'] : 1;

if ($officerId === '' || $officerName === '') {
    jsonError('officerId and officerName are required.', 422);
}

try {
    $ctx = igpRequireOfficerOrgContext();
    $pdo = getPdo();

    $uStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn LIMIT 1");
    $uStmt->execute([':sn' => $officerId]);
    $user = $uStmt->fetch();

    if (!$user) {
        $parts = preg_split('/\s+/', $officerName);
        $last = count($parts) > 1 ? array_pop($parts) : ($parts[0] ?? 'Officer');
        $first = count($parts) ? implode(' ', $parts) : 'Officer';
        $email = strtolower(str_replace([' ', '/'], ['', '-'], $officerId)) . '@officer.noop';

        $insUser = $pdo->prepare(
            "INSERT INTO users
                (student_number, email, password_hash, first_name, last_name, account_type, is_active)
             VALUES
                (:sn, :email, :pw, :fn, :ln, 'student', 1)"
        );
        $insUser->execute([
            ':sn' => $officerId,
            ':email' => $email,
            ':pw' => password_hash($officerId, PASSWORD_BCRYPT),
            ':fn' => $first,
            ':ln' => $last,
        ]);
        $userId = (int)$pdo->lastInsertId();

        if ($department !== '') {
            $prog = $pdo->query("SELECT program_id FROM academic_programs ORDER BY program_id ASC LIMIT 1")->fetch();
            if ($prog) {
                $pdo->prepare("INSERT INTO student_profiles (user_id, program_id, section) VALUES (:uid, :pid, :sec)")
                    ->execute([':uid' => $userId, ':pid' => (int)$prog['program_id'], ':sec' => $department]);
            }
        }
    } else {
        $userId = (int)$user['user_id'];
        $parts = preg_split('/\s+/', $officerName);
        $last = count($parts) > 1 ? array_pop($parts) : ($parts[0] ?? 'Officer');
        $first = count($parts) ? implode(' ', $parts) : 'Officer';
        $email = strtolower(str_replace([' ', '/'], ['', '-'], $officerId)) . '@officer.noop';
        $pdo->prepare(
            "UPDATE users
             SET student_number = :sn, email = :email, first_name = :fn, last_name = :ln, is_active = 1
             WHERE user_id = :uid"
        )->execute([
            ':sn' => $officerId,
            ':email' => $email,
            ':fn' => $first,
            ':ln' => $last,
            ':uid' => $userId
        ]);
        if ($department !== '') {
            $exists = $pdo->prepare("SELECT 1 FROM student_profiles WHERE user_id = :uid LIMIT 1");
            $exists->execute([':uid' => $userId]);
            if ($exists->fetch()) {
                $pdo->prepare("UPDATE student_profiles SET section = :sec WHERE user_id = :uid")
                    ->execute([':sec' => $department, ':uid' => $userId]);
            } else {
                $prog = $pdo->query("SELECT program_id FROM academic_programs ORDER BY program_id ASC LIMIT 1")->fetch();
                if ($prog) {
                    $pdo->prepare("INSERT INTO student_profiles (user_id, program_id, section) VALUES (:uid, :pid, :sec)")
                        ->execute([':uid' => $userId, ':pid' => (int)$prog['program_id'], ':sec' => $department]);
                }
            }
        }
    }

    $rStmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :org AND role_name = :role LIMIT 1");
    $rStmt->execute([':org' => $ctx['org_id'], ':role' => $roleName]);
    $role = $rStmt->fetch();
    if (!$role) {
        $pdo->prepare("INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard, is_active) VALUES (:org, :role, 1, 1)")
            ->execute([':org' => $ctx['org_id'], ':role' => $roleName]);
        $rStmt->execute([':org' => $ctx['org_id'], ':role' => $roleName]);
        $role = $rStmt->fetch();
    }
    $roleId = (int)$role['role_id'];

    if ($id > 0) {
        $upd = $pdo->prepare(
            "UPDATE organization_members
             SET role_id = :rid, joined_at = :joined, is_active = :active
             WHERE membership_id = :id AND org_id = :org"
        );
        $upd->execute([
            ':rid' => $roleId,
            ':joined' => $joinedAt,
            ':active' => $isActive,
            ':id' => $id,
            ':org' => $ctx['org_id']
        ]);
        if ($upd->rowCount() === 0) jsonError('Officer membership not found.', 404);
        jsonOk(['id' => $id, 'msg' => 'Officer updated.']);
    } else {
        $ins = $pdo->prepare(
            "INSERT INTO organization_members (user_id, org_id, role_id, joined_at, is_active)
             VALUES (:uid, :org, :rid, :joined, :active)
             ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), joined_at = VALUES(joined_at), is_active = VALUES(is_active)"
        );
        $ins->execute([
            ':uid' => $userId,
            ':org' => $ctx['org_id'],
            ':rid' => $roleId,
            ':joined' => $joinedAt,
            ':active' => $isActive
        ]);

        $idStmt = $pdo->prepare("SELECT membership_id FROM organization_members WHERE user_id = :uid AND org_id = :org LIMIT 1");
        $idStmt->execute([':uid' => $userId, ':org' => $ctx['org_id']]);
        $membership = $idStmt->fetch();
        jsonOk(['id' => (int)($membership['membership_id'] ?? 0), 'msg' => 'Officer added.']);
    }
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'Duplicate entry')) {
        jsonError('This officer already has membership in this organization.', 409);
    }
    error_log('[api/igp/officers/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
