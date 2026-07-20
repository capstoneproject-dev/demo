<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/student_notifications.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0 || ($session['login_role'] ?? '') !== 'student') {
        jsonError('Student account required.', 403);
    }

    $pdo = getPdo();
    $profileStmt = $pdo->prepare(
        "SELECT student_number
         FROM users
         WHERE user_id = :user_id
           AND account_type = 'student'
           AND is_active = 1
         LIMIT 1"
    );
    $profileStmt->execute([':user_id' => $userId]);
    $studentNumber = $profileStmt->fetchColumn();
    if ($studentNumber === false) {
        jsonError('Active student profile not found.', 404);
    }

    $items = studentBuildTransactionNotifications($pdo, $userId, (string)$studentNumber);
    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/student/notifications/list] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    error_log('[api/student/notifications/list] ' . $e->getMessage());
    jsonError('Could not load transaction notifications.', 500);
}
