<?php
require __DIR__ . '/../api/accounts/officers/roster.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY, student_number TEXT, first_name TEXT, last_name TEXT)');
$pdo->exec('CREATE TABLE organizations (org_id INTEGER PRIMARY KEY, org_code TEXT)');
$pdo->exec('CREATE TABLE org_roles (role_id INTEGER PRIMARY KEY, role_name TEXT)');
$pdo->exec('CREATE TABLE organization_members (membership_id INTEGER PRIMARY KEY, user_id INTEGER, org_id INTEGER, role_id INTEGER, position_title TEXT, joined_at TEXT, is_active INTEGER)');
$pdo->exec("INSERT INTO users VALUES (1, 'S1', 'Test', 'Student')");
$pdo->exec("INSERT INTO organizations VALUES (1, 'CLUB')");
$pdo->exec("INSERT INTO org_roles VALUES (1, 'President')");
$pdo->exec("INSERT INTO organization_members VALUES (1, 1, 1, 1, 'President', '2026-09-01', 1)");
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
echo "Officer preview passed: new, updated, reactivated, unchanged.\n";
