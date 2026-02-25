<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body         = getRequestBody();
$membershipId = (int)($body['id'] ?? 0);

if (!$membershipId) {
    jsonError('Membership id is required.', 422);
}

try {
    $pdo  = getPdo();
    $stmt = $pdo->prepare("DELETE FROM organization_members WHERE membership_id = :mid");
    $stmt->execute([':mid' => $membershipId]);
    if ($stmt->rowCount() === 0) {
        jsonError('Officer record not found.', 404);
    }
    jsonOk(['msg' => 'Officer removed.']);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
