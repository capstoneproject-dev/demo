<?php
require_once __DIR__ . '/../../../includes/osa_archive.php';
header('Content-Type: application/json');
requirePost();
apiGuard(true); // Transfer destroys the outgoing session after committing.
$session = apiRequirePrimaryOsaAdministrator();
apiRequireRecentReauthentication();
$id = (int)(getRequestBody()['user_id'] ?? 0);
if ($id <= 0) jsonError('Select a former administrator.', 422);
try {
    $result = transferOsaAdministrator(getPdo(), (int)$session['user_id'], $id);
    destroySession();
    jsonOk($result);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 409);
} catch (PDOException $e) {
    error_log('[api/osa/staff/transfer-primary] ' . $e->getMessage());
    jsonError('Could not transfer administrator authority right now.', 409);
}
