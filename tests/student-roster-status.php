<?php
require __DIR__ . '/../api/accounts/student-numbers/roster-status.php';

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

echo "Student roster isActive parsing passed.\n";
