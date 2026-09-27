<?php
require __DIR__ . '/../api/accounts/advisers/roster.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (user_id INTEGER, employee_number TEXT, account_type TEXT, email TEXT)');
$pdo->exec('CREATE TABLE organizations (org_id INTEGER, org_code TEXT)');
$pdo->exec("INSERT INTO users VALUES (1, '0007', 'organization_adviser', 'ana@example.test'), (2, 'OSA', 'osa_staff', 'osa@example.test')");
$pdo->exec("INSERT INTO organizations VALUES (1, 'CLUB'), (2, 'OTHER')");
$row = ['employeeNumber'=>'0007','firstName'=>'Ana','lastName'=>'Cruz','email'=>'ana@example.test','orgCode'=>'CLUB','joinedAt'=>'2026-09-01','isActive'=>'false','membershipActive'=>'false'];
$valid = validateAdviserRows($pdo, [$row, array_merge($row, ['orgCode'=>'OTHER'])]);
if (count($valid) !== 2 || $valid[0]['userId'] !== 1 || $valid[0]['isActive'] !== 0 || $valid[0]['membershipActive'] !== 0) throw new Exception('Round-trip state failed');
foreach ([[$row,$row], [array_merge($row,['orgCode'=>'MISSING'])], [array_merge($row,['employeeNumber'=>'OSA'])], [array_merge($row,['joinedAt'=>'2026-02-30'])], [array_merge($row,['isActive'=>'invalid'])], [$row,array_merge($row,['employeeNumber'=>'NEW'])]] as $invalid) {
    try { validateAdviserRows($pdo, $invalid); } catch (InvalidArgumentException $e) { continue; }
    throw new Exception('Invalid rows were accepted');
}
echo "Adviser validation passed: state, multiple organizations, duplicates, conflicts, dates, and status.\n";
