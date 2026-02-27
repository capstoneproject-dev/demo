<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$userId = (int)($body['userId'] ?? 0);
$studentId = trim((string)($body['studentId'] ?? ''));
$studentName = trim((string)($body['studentName'] ?? ''));
$section = trim((string)($body['section'] ?? ''));
$programCode = trim((string)($body['programCode'] ?? 'BSAIS'));

if ($studentId === '' || $studentName === '' || $section === '') {
    jsonError('studentId, studentName, and section are required.', 422);
}

try {
    $ctx = igpRequireOfficerOrgContext();
    $pdo = getPdo();

    $progStmt = $pdo->prepare("SELECT program_id FROM academic_programs WHERE UPPER(program_code)=UPPER(:pc) LIMIT 1");
    $progStmt->execute([':pc' => $programCode ?: 'BSAIS']);
    $prog = $progStmt->fetch();
    if (!$prog) {
        jsonError("Program code '$programCode' not found.", 422);
    }
    $programId = (int)$prog['program_id'];

    $registeredStmt = $pdo->prepare(
        "SELECT user_id, is_active
         FROM users
         WHERE student_number = :sn
           AND account_type = 'student'
         LIMIT 1"
    );
    $registeredStmt->execute([':sn' => $studentId]);
    $registered = $registeredStmt->fetch();
    if (!$registered) {
        jsonError('Student is not a registered account in users table.', 422);
    }

    $resolvedUserId = (int)$registered['user_id'];
    if ($userId > 0 && $userId !== $resolvedUserId) {
        jsonError('studentId does not match the selected registered account.', 422);
    }

    if (!(bool)$registered['is_active']) {
        jsonError('Student account is inactive.', 422);
    }

    $hasProfile = $pdo->prepare("SELECT 1 FROM student_profiles WHERE user_id = :uid LIMIT 1");
    $hasProfile->execute([':uid' => $resolvedUserId]);
    if ($hasProfile->fetch()) {
        $pdo->prepare("UPDATE student_profiles SET program_id = :pid, section = :sec WHERE user_id = :uid")
            ->execute([':pid' => $programId, ':sec' => $section, ':uid' => $resolvedUserId]);
    } else {
        $pdo->prepare("INSERT INTO student_profiles (user_id, program_id, section) VALUES (:uid, :pid, :sec)")
            ->execute([':uid' => $resolvedUserId, ':pid' => $programId, ':sec' => $section]);
    }

    $memberRoleStmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :org AND role_name = 'member' LIMIT 1");
    $memberRoleStmt->execute([':org' => $ctx['org_id']]);
    $memberRole = $memberRoleStmt->fetch();
    if (!$memberRole) {
        jsonError('Member role is not configured for this organization.', 422);
    }

    $pdo->prepare(
        "INSERT IGNORE INTO organization_members (user_id, org_id, role_id, joined_at, is_active)
         VALUES (:uid, :org, :role, CURDATE(), 1)"
    )->execute([
        ':uid' => $resolvedUserId,
        ':org' => $ctx['org_id'],
        ':role' => (int)$memberRole['role_id']
    ]);
    $pdo->prepare(
        "UPDATE organization_members
         SET is_active = 1
         WHERE user_id = :uid AND org_id = :org AND role_id = :role"
    )->execute([
        ':uid' => $resolvedUserId,
        ':org' => $ctx['org_id'],
        ':role' => (int)$memberRole['role_id']
    ]);

    jsonOk(['user_id' => $resolvedUserId, 'msg' => 'Registered student linked/updated.']);
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/students/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
