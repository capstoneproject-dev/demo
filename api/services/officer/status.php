<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = stRequireOfficerContext();
    $pdo = getPdo();
    $orgId = (int)$ctx['org_id'];

    jsonOk([
        'org_id' => $orgId,
        'rentals_enabled' => stServiceEnabledForOrg($pdo, $orgId, 'rentals'),
        'printing_enabled' => stServiceEnabledForOrg($pdo, $orgId, 'printing'),
    ]);
} catch (PDOException $e) {
    error_log('[api/services/officer/status] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
