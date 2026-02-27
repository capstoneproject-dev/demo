<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$id = (int)($body['id'] ?? 0);
if ($id <= 0) jsonError('id is required.', 422);

try {
    $ctx = igpRequireOfficerOrgContext();
    $stmt = getPdo()->prepare("DELETE FROM organization_members WHERE membership_id = :id AND org_id = :org");
    $stmt->execute([':id' => $id, ':org' => $ctx['org_id']]);
    if ($stmt->rowCount() === 0) jsonError('Officer membership not found.', 404);
    jsonOk();
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/officers/delete] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}

