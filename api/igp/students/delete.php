<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$userId = (int)($body['userId'] ?? 0);
$studentId = trim((string)($body['studentId'] ?? ''));

if ($userId <= 0 && $studentId === '') {
    jsonError('userId or studentId is required.', 422);
}

try {
    $ctx = igpRequireOfficerOrgContext();
    $pdo = getPdo();

    $resolvedUserId = $userId;
    if ($resolvedUserId <= 0) {
        $lookup = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn AND account_type = 'student' LIMIT 1");
        $lookup->execute([':sn' => $studentId]);
        $user = $lookup->fetch();
        if (!$user) jsonError('Student not found.', 404);
        $resolvedUserId = (int)$user['user_id'];
    }

    $roleStmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :org AND role_name = 'member' LIMIT 1");
    $roleStmt->execute([':org' => $ctx['org_id']]);
    $memberRole = $roleStmt->fetch();
    if (!$memberRole) jsonError('Member role is not configured for this organization.', 422);

    $stmt = $pdo->prepare(
        "UPDATE organization_members
         SET is_active = 0
         WHERE user_id = :uid AND org_id = :org AND role_id = :role"
    );
    $stmt->execute([
        ':uid' => $resolvedUserId,
        ':org' => $ctx['org_id'],
        ':role' => (int)$memberRole['role_id']
    ]);

    if ($stmt->rowCount() === 0) jsonError('Student not found.', 404);
    jsonOk();
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/students/delete] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
