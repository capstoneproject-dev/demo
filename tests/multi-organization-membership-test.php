<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

function multiOrgAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$lookupSource = (string)file_get_contents(__DIR__ . '/../api/auth/lookup-student.php');
$otpSource = (string)file_get_contents(__DIR__ . '/../includes/otp.php');
$submitSource = (string)file_get_contents(__DIR__ . '/../api/accounts/requests/submit.php');
$approvalSource = (string)file_get_contents(__DIR__ . '/../api/accounts/requests/action.php');

multiOrgAssert(
    !str_contains($lookupSource, 'FROM organization_members'),
    'Student lookup still rejects users who already belong to an organization.'
);
multiOrgAssert(
    !preg_match("/purpose === 'org_registration'.*?NOT EXISTS\s*\(\s*SELECT 1 FROM organization_members/s", $otpSource),
    'Organization OTP eligibility still rejects existing organization officers.'
);
multiOrgAssert(
    str_contains($submitSource, 'WHERE user_id = :uid AND org_id = :org_id'),
    'Membership duplicate validation is not scoped to the selected organization.'
);
multiOrgAssert(
    str_contains($submitSource, "requested_role = 'org_officer'")
        && str_contains($submitSource, 'requested_org = :org_name'),
    'Pending officer-request validation is not scoped to the selected organization.'
);
multiOrgAssert(
    str_contains($approvalSource, 'ON DUPLICATE KEY UPDATE'),
    'Officer approval no longer safely upserts the selected organization membership.'
);

$pdo = getPdo();
$suffix = strtoupper(bin2hex(random_bytes(4)));

try {
    $pdo->beginTransaction();
    $pdo->prepare(
        "INSERT INTO users
            (student_number, email, password_hash, first_name, last_name, account_type, is_active)
         VALUES (:student_number, :email, :password_hash, 'Multi', 'Officer', 'student', 1)"
    )->execute([
        ':student_number' => 'MO-' . $suffix,
        ':email' => strtolower($suffix) . '@multi-org-test.invalid',
        ':password_hash' => password_hash('test-password', PASSWORD_DEFAULT),
    ]);
    $userId = (int)$pdo->lastInsertId();

    $organizationIds = [];
    foreach ([1, 2] as $index) {
        $pdo->prepare(
            "INSERT INTO organizations (org_name, org_code, status)
             VALUES (:org_name, :org_code, 'active')"
        )->execute([
            ':org_name' => "Multi Org {$suffix} {$index}",
            ':org_code' => "MO{$index}{$suffix}",
        ]);
        $orgId = (int)$pdo->lastInsertId();
        $organizationIds[] = $orgId;

        $pdo->prepare(
            "INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard, is_active)
             VALUES (:org_id, 'officer', 1, 1)"
        )->execute([':org_id' => $orgId]);
        $roleId = (int)$pdo->lastInsertId();

        $pdo->prepare(
            "INSERT INTO organization_members
                (user_id, org_id, role_id, position_title, joined_at, is_active)
             VALUES (:user_id, :org_id, :role_id, :position, CURDATE(), 1)"
        )->execute([
            ':user_id' => $userId,
            ':org_id' => $orgId,
            ':role_id' => $roleId,
            ':position' => $index === 1 ? 'President' : 'Committee Chair',
        ]);
    }

    $count = $pdo->prepare(
        "SELECT COUNT(*) FROM organization_members WHERE user_id = :user_id AND is_active = 1"
    );
    $count->execute([':user_id' => $userId]);
    multiOrgAssert((int)$count->fetchColumn() === 2, 'One student could not hold memberships in two organizations.');

    $duplicateBlocked = false;
    try {
        $role = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :org_id LIMIT 1");
        $role->execute([':org_id' => $organizationIds[0]]);
        $pdo->prepare(
            "INSERT INTO organization_members
                (user_id, org_id, role_id, position_title, joined_at, is_active)
             VALUES (:user_id, :org_id, :role_id, 'Duplicate', CURDATE(), 1)"
        )->execute([
            ':user_id' => $userId,
            ':org_id' => $organizationIds[0],
            ':role_id' => (int)$role->fetchColumn(),
        ]);
    } catch (PDOException $e) {
        $duplicateBlocked = $e->getCode() === '23000';
    }
    multiOrgAssert($duplicateBlocked, 'Duplicate membership in the same organization was accepted.');
    $pdo->rollBack();
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}

echo "Multi-organization membership tests passed.\n";

