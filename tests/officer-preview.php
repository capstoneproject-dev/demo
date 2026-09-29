<?php
require __DIR__ . '/../api/accounts/officers/roster.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY, student_number TEXT, first_name TEXT, last_name TEXT, account_type TEXT)');
$pdo->exec('CREATE TABLE organizations (org_id INTEGER PRIMARY KEY, org_code TEXT)');
$pdo->exec('CREATE TABLE org_roles (role_id INTEGER PRIMARY KEY, org_id INTEGER, role_name TEXT, can_access_org_dashboard INTEGER)');
$pdo->exec('CREATE TABLE organization_members (membership_id INTEGER PRIMARY KEY, user_id INTEGER, org_id INTEGER, role_id INTEGER, position_title TEXT, joined_at TEXT, is_active INTEGER)');
$pdo->exec("INSERT INTO users VALUES (1, 'S1', 'Test', 'Student', 'student'),
    (2, NULL, 'Osa', 'Staff', 'osa_staff'),
    (3, NULL, 'Test', 'Adviser', 'organization_adviser')");
$pdo->exec("INSERT INTO organizations VALUES (1, 'CLUB')");
$pdo->exec("INSERT INTO org_roles VALUES (1, 1, 'President', 1)");
$pdo->exec("INSERT INTO organization_members VALUES (1, 1, 1, 1, 'President', '2026-09-01', 1),
    (2, 2, 1, 1, 'Staff', '2026-09-01', 1),
    (3, 3, 1, 1, 'Adviser', '2026-09-01', 1)");
$base = ['membershipId' => 1, 'userId' => 1, 'orgId' => 1, 'roleName' => 'President', 'positionTitle' => 'President', 'joinedAt' => '2026-09-01', 'active' => true];
foreach ([
    [$base, 'unchanged'],
    [array_merge($base, ['positionTitle' => 'Chair']), 'updated'],
    [array_merge($base, ['membershipId' => 0]), 'new'],
] as [$row, $status]) {
    if (count(officerChangePreview($pdo, [$row])[$status]) !== 1) throw new Exception("Officer $status preview failed");
}
$pdo->exec('UPDATE organization_members SET is_active = 0 WHERE membership_id = 1');
if (count(officerChangePreview($pdo, [$base])['reactivated']) !== 1) throw new Exception('Officer reactivation preview failed');
foreach ([2, 3] as $nonStudentMembershipId) {
    foreach (['', 'S1'] as $studentId) {
        try {
            validateOfficerWorkbook($pdo, [[
                'officerId' => $nonStudentMembershipId, 'studentId' => $studentId,
                'orgCode' => 'CLUB', 'roleName' => 'President', 'joinedAt' => '2026-09-01',
            ]]);
            throw new Exception('Non-student membership was accepted during workbook validation');
        } catch (InvalidArgumentException $e) {
            if (!str_contains($e->getMessage(), 'does not match an existing officer')) throw $e;
        }
    }
    try {
        applyOfficerWorkbook($pdo, [array_merge($base, ['membershipId' => $nonStudentMembershipId])]);
        throw new Exception('Non-student membership was updated by workbook apply');
    } catch (InvalidArgumentException $e) {
        if (!str_contains($e->getMessage(), 'student memberships')) throw $e;
    }
}
try {
    applyOfficerWorkbook($pdo, [array_merge($base, ['membershipId' => 0, 'userId' => 2])]);
    throw new Exception('Non-student account was assigned by workbook apply');
} catch (InvalidArgumentException $e) {
    if (!str_contains($e->getMessage(), 'student accounts')) throw $e;
}
try {
    applyOfficerWorkbook($pdo, [array_merge($base, ['userId' => 2])]);
    throw new Exception('Non-student account was assigned to an existing officer membership');
} catch (InvalidArgumentException $e) {
    if (!str_contains($e->getMessage(), 'student accounts')) throw $e;
}
if (applyOfficerWorkbook($pdo, [$base])['updated'] !== 1 ||
    (int)$pdo->query('SELECT is_active FROM organization_members WHERE membership_id = 1')->fetchColumn() !== 1 ||
    (int)$pdo->query('SELECT COUNT(*) FROM organization_members WHERE user_id <> 1')->fetchColumn() !== 2) {
    throw new Exception('Workbook apply did not safely update the student officer');
}
echo "Officer preview passed: new, updated, reactivated, unchanged.\n";
