<?php
require __DIR__ . '/../api/accounts/officers/save-target.php';
require __DIR__ . '/../api/accounts/officers/delete-target.php';

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('CREATE TABLE users (user_id INTEGER PRIMARY KEY, student_number TEXT, account_type TEXT)');
$pdo->exec('CREATE TABLE organization_members (membership_id INTEGER PRIMARY KEY, user_id INTEGER)');
$pdo->exec("INSERT INTO users VALUES
    (1, 'S1', 'student'),
    (2, 'A1', 'organization_adviser'),
    (3, NULL, 'osa_staff')");
$pdo->exec('INSERT INTO organization_members VALUES (11, 1), (22, 2), (33, 3)');

foreach ([
    [11, '', 1],
    [11, 'S1', 1],
    [0, 'S1', 1],
    [22, '', null],
    [22, 'S1', null],
    [33, '', null],
    [0, 'A1', null],
    [11, 'A1', null],
    [99, 'S1', null],
] as [$membershipId, $studentNumber, $expected]) {
    $actual = officerSaveStudentUserId($pdo, $membershipId, $studentNumber);
    if ($actual !== $expected) {
        throw new Exception("Incorrect officer target for membership $membershipId and student $studentNumber");
    }
}

if (officerDeleteStudentMembership($pdo, 22) || officerDeleteStudentMembership($pdo, 33) ||
    !officerDeleteStudentMembership($pdo, 11)) {
    throw new Exception('Officer delete did not enforce student ownership');
}
if ((int)$pdo->query('SELECT COUNT(*) FROM organization_members')->fetchColumn() !== 2) {
    throw new Exception('Officer delete modified a non-student membership');
}

echo "Officer save and delete target validation passed.\n";
