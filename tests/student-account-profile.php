<?php
declare(strict_types=1);

require __DIR__ . '/../includes/functions.php';

$account = [
    'user_id' => 1,
    'account_type' => 'student',
    'student_number' => 'S1',
    'first_name' => 'Test',
    'last_name' => 'Student',
    'email' => 'student@example.test',
    'program_id' => 1,
    'program_code' => 'BSIT',
    'year_section' => '4-1',
    'student_numbers_year_section' => '2-1',
];

$session = buildSessionPayload($account, [], 'student');
$legacy = buildLegacyProfile($account, null);
if ($session['section'] !== '4-1' || $legacy['section'] !== '4-1') {
    throw new RuntimeException('Student profile preferred the eligibility roster over the registered account.');
}

$account['year_section'] = null;
if (buildSessionPayload($account, [], 'student')['section'] !== null ||
    buildLegacyProfile($account, null)['section'] !== '') {
    throw new RuntimeException('A missing account section was populated from the eligibility roster.');
}

echo "Student account profile section passed.\n";
