<?php
declare(strict_types=1);

ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/qr_attendance.php';

function attendanceAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$studentRegistrationSource = (string)file_get_contents(__DIR__ . '/../api/student/events/register.php');
$studentEventListSource = (string)file_get_contents(__DIR__ . '/../api/student/events/list.php');
$studentDashboardSource = (string)file_get_contents(__DIR__ . '/../assets/js/studentDashboard.js');

attendanceAssert(
    str_contains($studentRegistrationSource, 'EVENT_ALREADY_ATTENDED')
        && str_contains($studentRegistrationSource, '!empty($existing[\'time_in\'])')
        && str_contains($studentRegistrationSource, '!empty($existing[\'time_out\'])'),
    'Student pre-registration does not reject an existing attendance record.'
);
attendanceAssert(
    str_contains($studentEventListSource, "THEN 'attended'")
        && str_contains($studentEventListSource, "'participation_status'"),
    'Student event listings do not expose the authoritative attendance status.'
);
attendanceAssert(
    str_contains($studentDashboardSource, "participationStatus === 'attended'")
        && str_contains($studentDashboardSource, 'Pre-registration is no longer available.')
        && str_contains($studentDashboardSource, 'registeredEvents:${accountKey}')
        && str_contains($studentDashboardSource, "if (event) return status === 'attended' || status === 'registered' ? status : '';"),
    'Student event buttons do not disable pre-registration after attendance.'
);

$pdo = getPdo();

try {
    $index = $pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'attendance_records'
           AND INDEX_NAME = 'uq_attendance_event_student'"
    );
    attendanceAssert((int)$index->fetchColumn() === 2, 'The event/student unique key is missing.');

    $event = $pdo->query(
        "SELECT event_id, org_id FROM events ORDER BY event_id ASC LIMIT 1"
    )->fetch();
    attendanceAssert(is_array($event), 'At least one event is required for the attendance test.');

    $studentNumber = 'TEST-' . strtoupper(bin2hex(random_bytes(6)));
    $pdo->beginTransaction();
    $registration = $pdo->prepare(
        "INSERT INTO attendance_records
            (event_id, user_id, student_number, student_name, section, time_in, time_out)
         VALUES (:event_id, NULL, :student_number, 'Attendance Test', 'TEST', NULL, NULL)"
    );
    $registration->execute([
        ':event_id' => (int)$event['event_id'],
        ':student_number' => $studentNumber,
    ]);
    $registrationId = (int)$pdo->lastInsertId();

    $first = qrCheckIn($pdo, (int)$event['org_id'], 0, [
        'event_id' => (int)$event['event_id'],
        'student_number' => $studentNumber,
        'student_name' => 'Attendance Test',
        'section' => 'TEST',
    ]);
    attendanceAssert((int)$first['record_id'] === $registrationId, 'Check-in did not reuse the registration row.');
    attendanceAssert($first['already_checked_in'] === false, 'The first check-in was incorrectly treated as a duplicate.');

    $count = $pdo->prepare(
        "SELECT COUNT(*) FROM attendance_records
         WHERE event_id = :event_id AND student_number = :student_number"
    );
    $count->execute([
        ':event_id' => (int)$event['event_id'],
        ':student_number' => $studentNumber,
    ]);
    attendanceAssert((int)$count->fetchColumn() === 1, 'Registration plus check-in created two rows.');

    $second = qrCheckIn($pdo, (int)$event['org_id'], 0, [
        'event_id' => (int)$event['event_id'],
        'student_number' => $studentNumber,
    ]);
    attendanceAssert((int)$second['record_id'] === $registrationId, 'Repeated check-in changed the attendance row.');
    attendanceAssert($second['already_checked_in'] === true, 'Repeated check-in was not reported as already checked in.');

    $duplicateBlocked = false;
    try {
        $registration->execute([
            ':event_id' => (int)$event['event_id'],
            ':student_number' => $studentNumber,
        ]);
    } catch (PDOException $e) {
        $duplicateBlocked = (int)($e->errorInfo[1] ?? 0) === 1062;
    }
    attendanceAssert($duplicateBlocked, 'The database accepted duplicate event/student attendance.');

    $pdo->rollBack();
    echo "Attendance duplication tests passed.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
}
