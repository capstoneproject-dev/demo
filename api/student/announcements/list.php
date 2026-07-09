<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $studentProgramId = (int)($session['program_id'] ?? 0);
    $pdo = getPdo();
    if ($studentProgramId <= 0 && !empty($session['user_id'])) {
        $programStmt = $pdo->prepare(
            "SELECT program_id
             FROM users
             WHERE user_id = :user_id
               AND account_type = 'student'
             LIMIT 1"
        );
        $programStmt->execute([':user_id' => (int)$session['user_id']]);
        $studentProgramId = (int)($programStmt->fetchColumn() ?: 0);
    }

    $filters = [
        'q' => trim((string)($_GET['q'] ?? '')),
        'limit' => isset($_GET['limit']) ? (int)$_GET['limit'] : 10,
        'student_program_id' => $studentProgramId,
    ];
    $items = annListPublishedAnnouncementsForStudents($pdo, $filters);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/announcements/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
