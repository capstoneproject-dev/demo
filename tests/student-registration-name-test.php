<?php
declare(strict_types=1);

ini_set('session.save_path', sys_get_temp_dir());
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/tests/student-registration-name';
require_once __DIR__ . '/../includes/otp.php';

function studentNameAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

studentNameAssert(
    studentRegistryNamesMatch('  CHARLES   GABRIEL A MARTINEZ ', 'Charles Gabriel A. Martinez'),
    'Case, spacing, and harmless punctuation should not cause a name mismatch.'
);
studentNameAssert(
    !studentRegistryNamesMatch('Charles Gabriel Martinez', 'Charles Gabriel A. Martinez'),
    'A missing registered name component was accepted.'
);
studentNameAssert(
    !studentRegistryNamesMatch('Different Student', 'Charles Gabriel A. Martinez'),
    'A different student name was accepted.'
);

$loginSource = (string)file_get_contents(__DIR__ . '/../assets/js/login.js');
$otpApiSource = (string)file_get_contents(__DIR__ . '/../api/auth/otp/send.php');
$submitSource = (string)file_get_contents(__DIR__ . '/../api/accounts/requests/submit.php');
studentNameAssert(str_contains($loginSource, 'student_name: registrationOtpState.pendingStudentName'), 'Student name is not sent for OTP eligibility.');
studentNameAssert(str_contains($otpApiSource, '$studentName'), 'OTP API does not forward the supplied student name.');
studentNameAssert(str_contains($submitSource, 'studentRegistryNamesMatch'), 'Final registration does not revalidate the student name.');

$pdo = getPdo();
$suffix = strtoupper(bin2hex(random_bytes(4)));
try {
    $pdo->beginTransaction();
    $pdo->prepare("INSERT INTO institutes (institute_name, is_active) VALUES (:name, 1)")
        ->execute([':name' => 'Name Test Institute ' . $suffix]);
    $instituteId = (int)$pdo->lastInsertId();
    $pdo->prepare(
        "INSERT INTO academic_programs (program_code, institute_id, is_active)
         VALUES (:code, :institute_id, 1)"
    )->execute([':code' => 'NT' . $suffix, ':institute_id' => $instituteId]);
    $programId = (int)$pdo->lastInsertId();
    $studentNumber = 'NT-' . $suffix;
    $registeredName = 'Maria Anne D. Santos';
    $pdo->prepare(
        "INSERT INTO student_numbers
            (student_number, student_name, program_id, institute_id, is_active)
         VALUES (:student_number, :student_name, :program_id, :institute_id, 1)"
    )->execute([
        ':student_number' => $studentNumber,
        ':student_name' => $registeredName,
        ':program_id' => $programId,
        ':institute_id' => $instituteId,
    ]);

    studentNameAssert(
        otpRecipientIsEligible($pdo, 'student_registration', 'test@example.invalid', $studentNumber, '', 'MARIA ANNE D SANTOS'),
        'A matching roster name was rejected during OTP eligibility.'
    );
    studentNameAssert(
        !otpRecipientIsEligible($pdo, 'student_registration', 'test@example.invalid', $studentNumber, '', 'Maria Santos'),
        'A mismatched roster name was accepted during OTP eligibility.'
    );
    $pdo->rollBack();
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}

echo "Student registration name-validation tests passed.\n";

