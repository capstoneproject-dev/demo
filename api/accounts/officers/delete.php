<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';
require_once __DIR__ . '/delete-target.php';

header('Content-Type: application/json');
apiRequireOsaSystemAdministrator();
requirePost();
apiRequireRecentReauthentication();

$body         = getRequestBody();
$membershipId = (int)($body['id'] ?? 0);

if (!$membershipId) {
    jsonError('Membership id is required.', 422);
}

try {
    $pdo  = getPdo();
    if (!officerDeleteStudentMembership($pdo, $membershipId)) {
        jsonError('Officer record not found.', 404);
    }
    jsonOk(['msg' => 'Officer removed.']);
} catch (PDOException $e) {
    jsonError('DB error: ' . $e->getMessage(), 500);
}
