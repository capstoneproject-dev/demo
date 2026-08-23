<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';

function adviserAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$loginHtml = (string)file_get_contents(__DIR__ . '/../pages/login.html');
$loginJs = (string)file_get_contents(__DIR__ . '/../assets/js/login.js');
$otpSource = (string)file_get_contents(__DIR__ . '/../includes/otp.php');
$submitSource = (string)file_get_contents(__DIR__ . '/../api/accounts/requests/submit.php');
$approvalSource = (string)file_get_contents(__DIR__ . '/../api/accounts/requests/action.php');
$readonlyUi = (string)file_get_contents(__DIR__ . '/../assets/js/readonly-org-dashboard.js');

adviserAssert(str_contains($loginHtml, 'org-adviser-employee-number-input'), 'Organization adviser employee-number registration field is missing.');
adviserAssert(str_contains($loginJs, "'organization_adviser_registration'"), 'Organization adviser registration does not start its OTP flow.');
adviserAssert(str_contains($otpSource, "if (\$purpose === 'organization_adviser_registration')"), 'Organization adviser OTP eligibility is missing.');
adviserAssert(str_contains($submitSource, "requestedRole'] ?? 'student'") && str_contains($submitSource, "'organization_adviser'"), 'Organization adviser request submission is missing.');
adviserAssert(str_contains($approvalSource, "account_type, has_unpaid_debt, is_active") && str_contains($approvalSource, "'organization_adviser'"), 'Organization adviser approval does not create the account.');
adviserAssert(str_contains($readonlyUi, 'Organization Adviser — View-only access'), 'Read-only dashboard indicator is missing.');

$guardedMutations = [
    'api/announcements/create.php',
    'api/documents/submit.php',
    'api/igp/inventory/save.php',
    'api/igp/rentals/rent.php',
    'api/qr-attendance/events/save.php',
    'api/qr-attendance/attendance/checkin.php',
    'api/lockers/officer/approve.php',
    'api/printing/officer/update-status.php',
    'api/officer/organizations/public-profile-save.php',
];
foreach ($guardedMutations as $relativePath) {
    $source = (string)file_get_contents(__DIR__ . '/../' . $relativePath);
    adviserAssert(str_contains($source, 'apiRequireOrgManageAccess();'), "Missing read-only guard: {$relativePath}");
}

$pdo = getPdo();
$suffix = strtoupper(bin2hex(random_bytes(4)));
$pdo->beginTransaction();
try {
    $pdo->prepare(
        "INSERT INTO organizations (org_name, org_code, status)
         VALUES (:name, :code, 'active')"
    )->execute([':name' => "Adviser Test {$suffix}", ':code' => "OA{$suffix}"]);
    $orgId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        "INSERT INTO org_roles
            (org_id, role_name, can_access_org_dashboard, can_manage_org_dashboard, is_active)
         VALUES (:org_id, 'organization_adviser', 1, 0, 1)"
    )->execute([':org_id' => $orgId]);
    $roleId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        "INSERT INTO users
            (employee_number, email, password_hash, first_name, last_name, account_type, is_active)
         VALUES (:employee_number, :email, :password_hash, 'Organization', 'Adviser', 'organization_adviser', 1)"
    )->execute([
        ':employee_number' => "EMP-{$suffix}",
        ':email' => strtolower($suffix) . '@adviser-test.invalid',
        ':password_hash' => password_hash('test-password', PASSWORD_DEFAULT),
    ]);
    $userId = (int)$pdo->lastInsertId();

    $pdo->prepare(
        "INSERT INTO organization_members
            (user_id, org_id, role_id, position_title, joined_at, is_active)
         VALUES (:user_id, :org_id, :role_id, 'Organization Adviser', CURDATE(), 1)"
    )->execute([':user_id' => $userId, ':org_id' => $orgId, ':role_id' => $roleId]);

    $memberships = getOfficerMemberships($userId);
    adviserAssert(count($memberships) === 1, 'Organization adviser cannot access the assigned organization.');
    adviserAssert((int)$memberships[0]['can_access_org_dashboard'] === 1, 'Organization adviser lacks view permission.');
    adviserAssert((int)$memberships[0]['can_manage_org_dashboard'] === 0, 'Organization adviser unexpectedly has manage permission.');
    adviserAssert((int)$memberships[0]['is_read_only'] === 1, 'Organization adviser membership is not marked read-only.');

    $user = getUserById($userId);
    $session = buildSessionPayload($user, $memberships, 'org', $orgId);
    adviserAssert($session['is_read_only'] === true, 'Organization adviser session is not read-only.');
    adviserAssert($session['can_manage_org_dashboard'] === false, 'Organization adviser session can manage organization data.');
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}

echo "Organization adviser registration and read-only authorization tests passed.\n";
