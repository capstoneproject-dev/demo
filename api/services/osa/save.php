<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = stRequireOsaContext();
    $body = getRequestBody();
    $orgId = (int)($body['org_id'] ?? 0);
    $services = is_array($body['services'] ?? null) ? $body['services'] : [];
    $item = stSaveOrganizationServiceAuthorizations(getPdo(), $orgId, $services, (int)$ctx['user_id']);
    jsonOk(['item' => $item]);
} catch (PDOException $e) {
    error_log('[api/services/osa/save] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
