<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/qr_attendance.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    $pdo = getPdo();
    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
    ];
    $items = qrListPublishedEventsForStudents($pdo, $filters);

    // Include this student's authoritative participation state so every
    // event button can distinguish pre-registration from actual attendance.
    $profile = $pdo->prepare(
        "SELECT student_number
         FROM users
         WHERE user_id = :user_id
           AND account_type = 'student'
           AND is_active = 1
         LIMIT 1"
    );
    $profile->execute([':user_id' => $userId]);
    $studentNumber = trim((string)($profile->fetchColumn() ?: ''));
    $participationByEvent = [];

    if ($userId > 0 && $studentNumber !== '') {
        $participation = $pdo->prepare(
            "SELECT event_id,
                    CASE
                        WHEN MAX(CASE WHEN time_in IS NOT NULL OR time_out IS NOT NULL THEN 1 ELSE 0 END) = 1
                            THEN 'attended'
                        ELSE 'registered'
                    END AS participation_status
             FROM attendance_records
             WHERE user_id = :user_id
                OR student_number = :student_number
             GROUP BY event_id"
        );
        $participation->execute([
            ':user_id' => $userId,
            ':student_number' => $studentNumber,
        ]);
        foreach ($participation->fetchAll() as $row) {
            $participationByEvent[(int)$row['event_id']] = (string)$row['participation_status'];
        }
    }

    foreach ($items as &$item) {
        $item['participation_status'] = $participationByEvent[(int)$item['event_id']] ?? null;
    }
    unset($item);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/events/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
