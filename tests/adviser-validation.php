<?php
require __DIR__ . '/../api/accounts/advisers/roster.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE users (user_id INTEGER, employee_number TEXT, account_type TEXT, email TEXT, first_name TEXT, last_name TEXT, is_active INTEGER, phone TEXT)');
$pdo->exec('CREATE TABLE organizations (org_id INTEGER, org_code TEXT, org_name TEXT)');
$pdo->exec('CREATE TABLE organization_members (membership_id INTEGER, user_id INTEGER, org_id INTEGER, is_active INTEGER, joined_at TEXT)');
$pdo->exec("INSERT INTO users VALUES (1, '0007', 'organization_adviser', 'ana@example.test', 'Ana', 'Cruz', 1, ''), (2, 'OSA', 'osa_staff', 'osa@example.test', 'Osa', 'Staff', 1, ''), (3, '0008', 'organization_adviser', 'ben@example.test', 'Ben', 'Reyes', 1, '')");
$pdo->exec("INSERT INTO organizations VALUES (1, 'CLUB', 'Club'), (2, 'OTHER', 'Other')");
$pdo->exec("INSERT INTO organization_members VALUES (1, 1, 1, 1, '2026-09-01'), (2, 1, 2, 1, '2026-09-01'), (3, 3, 1, 1, '2026-09-01')");
$row = ['employeeNumber'=>'0007','firstName'=>'Ana','lastName'=>'Cruz','email'=>'ana@example.test','orgCode'=>'CLUB','joinedAt'=>'2026-09-01','isActive'=>'false','membershipActive'=>'false'];
$valid = validateAdviserRows($pdo, [$row, array_merge($row, ['orgCode'=>'OTHER'])]);
if (count($valid) !== 2 || $valid[0]['userId'] !== 1 || $valid[0]['isActive'] !== 0 || $valid[0]['membershipActive'] !== 0) throw new Exception('Round-trip state failed');
$unchanged = validateAdviserRows($pdo, [array_merge($row, ['isActive'=>'true','membershipActive'=>'true'])]);
if (count(adviserChangePreview($pdo, $unchanged)['unchanged']) !== 1) throw new Exception('Unchanged adviser preview failed');
$new = validateAdviserRows($pdo, [array_merge($row, ['employeeNumber'=>'0009','email'=>'new@example.test'])]);
if (count(adviserChangePreview($pdo, $new)['new']) !== 1) throw new Exception('New adviser preview failed');
if (count(adviserChangePreview($pdo, [$valid[0]])['updated']) !== 1) throw new Exception('Updated adviser preview failed');
foreach ([[$row,$row], [array_merge($row,['orgCode'=>'MISSING'])], [array_merge($row,['employeeNumber'=>'OSA'])], [array_merge($row,['joinedAt'=>'2026-02-30'])], [array_merge($row,['isActive'=>'invalid'])], [$row,array_merge($row,['employeeNumber'=>'NEW'])]] as $invalid) {
    try { validateAdviserRows($pdo, $invalid); } catch (InvalidArgumentException $e) { continue; }
    throw new Exception('Invalid rows were accepted');
}
$omissions = adviserOmissions($pdo, [$valid[0]]);
if (count($omissions['accounts']) !== 1 || $omissions['accounts'][0]['employeeNumber'] !== '0008' || count($omissions['memberships']) !== 2) throw new Exception('Adviser omissions preview failed');
deactivateOmittedAdvisers($pdo, $omissions);
if ((int)$pdo->query('SELECT is_active FROM users WHERE user_id = 3')->fetchColumn() !== 0 ||
    (int)$pdo->query('SELECT is_active FROM users WHERE user_id = 1')->fetchColumn() !== 1 ||
    (int)$pdo->query('SELECT is_active FROM organization_members WHERE membership_id = 1')->fetchColumn() !== 1 ||
    (int)$pdo->query('SELECT COUNT(*) FROM organization_members WHERE is_active = 1')->fetchColumn() !== 1) throw new Exception('Adviser omission deactivation failed');
if (count(adviserRows($pdo)) !== 1 || adviserRows($pdo)[0]['employeeNumber'] !== '0007') throw new Exception('Inactive adviser is still listed or exported');
if (count(adviserChangePreview($pdo, validateAdviserRows($pdo, [array_merge($row, ['employeeNumber'=>'0008','firstName'=>'Ben','lastName'=>'Reyes','email'=>'ben@example.test','isActive'=>'true','membershipActive'=>'true'])]))['reactivated']) !== 1) throw new Exception('Reactivated adviser preview failed');
echo "Adviser validation passed: state, multiple organizations, duplicates, conflicts, dates, status, and omitted advisers.\n";
