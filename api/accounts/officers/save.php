<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body          = getRequestBody();
$membershipId  = (int)($body['id'] ?? 0);          // 0 = new, >0 = update
$studentNumber = trim($body['studentId'] ?? '');
$orgCode       = trim($body['orgCode']   ?? '');
$roleName      = trim($body['roleName']  ?? '');
$positionTitle = trim($body['positionTitle'] ?? '');
$joinedAt      = trim($body['joinedAt']  ?? '') ?: date('Y-m-d');
$isActive      = isset($body['isActive']) ? (int)(bool)$body['isActive'] : 1;

if (!$studentNumber || !$orgCode || !$roleName) {
    jsonError('studentId, orgCode, and roleName are required.', 422);
}

try {
    $pdo = getPdo();

    // Resolve user_id
    $uStmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn LIMIT 1");
    $uStmt->execute([':sn' => $studentNumber]);
    $user = $uStmt->fetch();
    if (!$user) {
        jsonError("Student '$studentNumber' not found in accounts.", 404);
    }
    $userId = (int)$user['user_id'];

    // Resolve org_id
    $oStmt = $pdo->prepare("SELECT org_id FROM organizations WHERE org_code = :oc LIMIT 1");
    $oStmt->execute([':oc' => $orgCode]);
    $org = $oStmt->fetch();
    if (!$org) {
        jsonError("Organization '$orgCode' not found.", 404);
    }
    $orgId = (int)$org['org_id'];

    // Resolve role_id
    $rStmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :oid AND role_name = :rn LIMIT 1");
    $rStmt->execute([':oid' => $orgId, ':rn' => $roleName]);
    $role = $rStmt->fetch();
    if (!$role) {
        // Auto-create role if it doesn't exist
        $pdo->prepare("INSERT IGNORE INTO org_roles (org_id, role_name, can_access_org_dashboard) VALUES (:oid, :rn, 0)")
            ->execute([':oid' => $orgId, ':rn' => $roleName]);
        $rStmt->execute([':oid' => $orgId, ':rn' => $roleName]);
        $role = $rStmt->fetch();
        if (!$role) { jsonError("Could not resolve or create role '$roleName'.", 500); }
    }
    $roleId = (int)$role['role_id'];

    if ($membershipId === 0) {
        // INSERT
        $ins = $pdo->prepare("
            INSERT INTO organization_members (user_id, org_id, role_id, position_title, joined_at, is_active)
            VALUES (:uid, :oid, :rid, :position, :ja, :active)
        ");
        $ins->execute([
            ':uid'    => $userId,
            ':oid'    => $orgId,
            ':rid'    => $roleId,
            ':position' => $positionTitle !== '' ? $positionTitle : null,
            ':ja'     => $joinedAt,
            ':active' => $isActive,
        ]);
        jsonOk(['membership_id' => (int)$pdo->lastInsertId(), 'msg' => 'Officer added.']);
    } else {
        // UPDATE
        $upd = $pdo->prepare("
            UPDATE organization_members
            SET role_id   = :rid,
                position_title = :position,
                joined_at = :ja,
                is_active = :active
            WHERE membership_id = :mid
        ");
        $upd->execute([
            ':rid'    => $roleId,
            ':position' => $positionTitle !== '' ? $positionTitle : null,
            ':ja'     => $joinedAt,
            ':active' => $isActive,
            ':mid'    => $membershipId,
        ]);
        if ($upd->rowCount() === 0) {
            jsonError('Officer record not found.', 404);
        }
        jsonOk(['msg' => 'Officer updated.']);
    }
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), 'Duplicate entry')) {
        jsonError('This student is already a member of that organization.', 409);
    }
    jsonError('DB error: ' . $e->getMessage(), 500);
}
