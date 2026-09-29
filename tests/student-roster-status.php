<?php
require __DIR__ . '/../api/accounts/student-numbers/roster-status.php';

foreach ([
    [null, '2026-2027'], ['', '2026-2027'], ['  ', '2026-2027'],
    ['2026-2027', '2026-2027'], [' 2027-2028 ', '2027-2028'],
] as [$input, $expected]) {
    if (rosterParseAcademicYear($input, '2026-2027') !== $expected) {
        throw new Exception('Incorrect academicYear value for ' . var_export($input, true));
    }
}
foreach (['2026-2028', '2026/2027', 'invalid', '2026-2026', [], false] as $invalid) {
    try {
        rosterParseAcademicYear($invalid, '2026-2027');
    } catch (InvalidArgumentException $e) {
        continue;
    }
    throw new Exception('Invalid academicYear was accepted: ' . var_export($invalid, true));
}

foreach ([
    [false, false], [true, true],
    ['false', false], [' FALSE ', false], ['0', false], ['no', false], ['inactive', false], [0, false],
    ['true', true], [' TRUE ', true], ['1', true], ['yes', true], ['active', true], [1, true],
] as [$input, $expected]) {
    if (rosterParseActiveStatus($input) !== $expected) throw new Exception('Incorrect isActive value for ' . var_export($input, true));
}

foreach ([null, '', 'maybe', 2, -1, 0.0, [], new stdClass()] as $invalid) {
    try {
        rosterParseActiveStatus($invalid);
    } catch (InvalidArgumentException $e) {
        continue;
    }
    throw new Exception('Invalid isActive value was accepted: ' . var_export($invalid, true));
}

echo "Student roster academicYear and isActive parsing passed.\n";
