<?php
declare(strict_types=1);

require __DIR__ . '/../api/accounts/students/roster.php';

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY, student_number TEXT, first_name TEXT, last_name TEXT,
    program_id INTEGER, institute_id INTEGER, year_section TEXT, email TEXT, phone TEXT, is_active INTEGER, account_type TEXT)');
$pdo->exec('CREATE TABLE academic_programs (program_id INTEGER PRIMARY KEY, program_code TEXT, institute_id INTEGER)');
$pdo->exec('CREATE TABLE institutes (institute_id INTEGER PRIMARY KEY, institute_name TEXT)');
$pdo->exec('CREATE TABLE organization_members (membership_id INTEGER PRIMARY KEY, user_id INTEGER, is_active INTEGER)');
$pdo->exec('CREATE TABLE student_numbers (student_number TEXT, student_name TEXT, year_section TEXT, is_active INTEGER)');
$pdo->exec("INSERT INTO institutes VALUES (1, 'Institute One')");
$pdo->exec("INSERT INTO academic_programs VALUES (1, 'BSIT', 1)");
$pdo->exec("INSERT INTO users VALUES
    (1, 'S1', 'Registered', 'Student', 1, 1, '2-1', 's1@example.test', NULL, 1, 'student'),
    (2, 'S2', 'Another', 'Student', 1, 1, '2-1', 's2@example.test', NULL, 1, 'student')");
$pdo->exec("INSERT INTO student_numbers VALUES
    ('S1', 'Registered Student', '2-1', 1),
    ('S2', 'Another Student', '2-1', 1),
    ('S3', 'Roster Only', '1-1', 1)");

$base = ['studentId' => 'S1', 'studentName' => 'Registered Student', 'programCode' => 'BSIT',
    'institute' => 'Institute One', 'yearSection' => '2-1', 'isActive' => true, 'email' => 's1@example.test'];
$unknown = accountRosterValidateRecords($pdo, [array_replace($base, ['studentId' => 'S3', 'studentName' => 'Roster Only'])]);
if (!$unknown['errors'] || count($unknown['records']) !== 0 || !str_contains($unknown['errors'][0], 'must register themselves')) {
    throw new RuntimeException('An unregistered roster-only student was accepted.');
}
$valid = accountRosterValidateRecords($pdo, [$base]);
if ($valid['errors']) throw new RuntimeException(implode('; ', $valid['errors']));
$preview = accountRosterBuildPreview($pdo, $valid['records']);
if ($preview['summary']['unchanged'] !== 1 || $preview['summary']['deactivated'] !== 1) {
    throw new RuntimeException('Account-only unchanged/deactivated preview is incorrect.');
}
accountRosterApply($pdo, $valid['records'], $preview);
if ((int)$pdo->query("SELECT is_active FROM users WHERE student_number = 'S2'")->fetchColumn() !== 0 ||
    (int)$pdo->query("SELECT is_active FROM student_numbers WHERE student_number = 'S2'")->fetchColumn() !== 1) {
    throw new RuntimeException('Account import changed the Users roster or failed to deactivate the omitted account.');
}
$changed = accountRosterValidateRecords($pdo, [array_replace($base, ['yearSection' => '3-1'])]);
$updatePreview = accountRosterBuildPreview($pdo, $changed['records']);
if ($updatePreview['summary']['updated'] !== 1) throw new RuntimeException('Account update was not previewed.');
accountRosterApply($pdo, $changed['records'], $updatePreview);
if ($pdo->query("SELECT year_section FROM users WHERE student_number = 'S1'")->fetchColumn() !== '3-1' ||
    $pdo->query("SELECT year_section FROM student_numbers WHERE student_number = 'S1'")->fetchColumn() !== '2-1') {
    throw new RuntimeException('Account year-section update crossed into Users roster.');
}
echo "Account roster separation passed.\n";
