<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body          = getRequestBody();
$studentNumber = trim($body['studentId'] ?? '');

if (!$studentNumber) {
    jsonError('studentId is required.', 422);
}

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("DELETE FROM student_numbers WHERE student_number = :sn");
    $stmt->execute([':sn' => $studentNumber]);
    if ($stmt->rowCount() === 0) {
        jsonError('Student number not found.', 404);
    }
    jsonOk(['msg' => 'Student number deleted.']);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
