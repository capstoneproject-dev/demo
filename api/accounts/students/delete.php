<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body          = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');
$userId        = (int)($body['userId']   ?? 0);

if (!$studentNumber && !$userId) {
    jsonError('studentId or userId is required.', 422);
}

try {
    $pdo = getPdo();
    if ($userId > 0) {
        $stmt = $pdo->prepare("DELETE FROM users WHERE user_id = :uid AND account_type = 'student'");
        $stmt->execute([':uid' => $userId]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM users WHERE student_number = :sn AND account_type = 'student'");
        $stmt->execute([':sn' => $studentNumber]);
    }
    if ($stmt->rowCount() === 0) {
        jsonError('Student not found.', 404);
    }
    jsonOk(['msg' => 'Student deleted.']);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
