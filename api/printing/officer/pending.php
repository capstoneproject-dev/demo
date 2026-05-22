<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = stRequireOfficerContext();
    $pdo = getPdo();
    $printingEnabled = stServiceEnabledForOrg($pdo, (int)$ctx['org_id'], 'printing');

    if (!$printingEnabled) {
        jsonOk([
            'items' => [],
            'printing_enabled' => false,
        ]);
    }

    $items = stListPendingPrintJobs($pdo);
    jsonOk([
        'items' => $items,
        'printing_enabled' => true,
    ]);
} catch (PDOException $e) {
    error_log('[api/printing/officer/pending] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
