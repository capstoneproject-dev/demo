<?php
require_once __DIR__ . '/../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Not authenticated.', 401);
    }

    $body = getRequestBody();
    $eventId = (int)($body['event_id'] ?? 0);
    $studentNumber = trim((string)($body['student_number'] ?? $session['student_number'] ?? ''));
    $studentName = trim((string)($body['student_name'] ?? ''));
    $section = trim((string)($body['section'] ?? ''));

    if ($eventId <= 0) {
        jsonError('A database-backed event is required before students can register.', 422);
    }
    if ($studentNumber === '') {
        jsonError('Student number is required.', 422);
    }

    $pdo = getPdo();

    $eventStmt = $pdo->prepare(
        "SELECT event_id
         FROM events
         WHERE event_id = :event_id
           AND is_published = 1
         LIMIT 1"
    );
    $eventStmt->execute([':event_id' => $eventId]);
    if (!$eventStmt->fetch()) {
        jsonError('This event is not available for student registration.', 404);
    }

    $profileStmt = $pdo->prepare(
        "SELECT u.student_number,
                CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                sn.year_section AS section
         FROM users u
         LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
         WHERE u.user_id = :user_id
           AND u.account_type = 'student'
         LIMIT 1"
    );
    $profileStmt->execute([':user_id' => $userId]);
    $profile = $profileStmt->fetch();
    if (!$profile) {
        jsonError('Student profile not found.', 404);
    }

    $studentNumber = trim((string)($profile['student_number'] ?? $studentNumber));
    $studentName = $studentName !== '' ? $studentName : trim((string)($profile['full_name'] ?? ''));
    $section = $section !== '' ? $section : trim((string)($profile['section'] ?? ''));

    $duplicateStmt = $pdo->prepare(
        "SELECT record_id
         FROM attendance_records
         WHERE event_id = :event_id
           AND (
                user_id = :user_id
                OR student_number = :student_number
           )
         LIMIT 1"
    );
    $duplicateStmt->execute([
        ':event_id' => $eventId,
        ':user_id' => $userId,
        ':student_number' => $studentNumber,
    ]);
    $existing = $duplicateStmt->fetch();
    if ($existing) {
        jsonOk([
            'record_id' => (int)$existing['record_id'],
            'already_registered' => true,
        ]);
    }

    $insertStmt = $pdo->prepare(
        "INSERT INTO attendance_records
            (event_id, user_id, student_number, student_name, section, time_in, time_out)
         VALUES
            (:event_id, :user_id, :student_number, :student_name, :section, NULL, NULL)"
    );
    $insertStmt->execute([
        ':event_id' => $eventId,
        ':user_id' => $userId,
        ':student_number' => $studentNumber,
        ':student_name' => $studentName !== '' ? $studentName : $studentNumber,
        ':section' => $section !== '' ? $section : null,
    ]);

    jsonOk([
        'record_id' => (int)$pdo->lastInsertId(),
        'already_registered' => false,
    ]);
} catch (PDOException $e) {
    error_log('[api/student/events/register] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
