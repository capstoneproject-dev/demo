<?php
require_once __DIR__ . '/../../../includes/osa_archive.php';
header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
apiRequireRecentReauthentication();
$body = getRequestBody();
$id = osaRequestUserId($body['user_id'] ?? null);
$action = $body['action'] ?? '';
if ($id <= 0 || !in_array($action, ['archive', 'restore'], true)) jsonError('A valid account and archive or restore action are required.', 422);
try {
    archiveOsaAdministrator(getPdo(), (int)$session['user_id'], $id, $action === 'archive', (int)($session['osa_authority_version'] ?? 0));
    jsonOk(['message' => $action === 'archive' ? 'Former administrator archived.' : 'Former administrator restored to the inactive list.']);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 409);
} catch (PDOException $e) {
    error_log('[api/osa/staff/archive] ' . $e->getMessage());
    jsonError('Could not update the archive right now.', 500);
}
