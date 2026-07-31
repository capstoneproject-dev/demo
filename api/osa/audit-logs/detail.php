<?php

require_once __DIR__ . '/../../../includes/auth.php';

header('Content-Type: application/json');
apiRequirePrimaryOsaAdministrator();
$auditId = (int)($_GET['audit_id'] ?? 0);
if ($auditId <= 0) jsonError('Invalid audit entry.', 422);

try {
    $stmt = getPdo()->prepare("SELECT * FROM audit_logs WHERE audit_id = :id LIMIT 1");
    $stmt->execute([':id' => $auditId]);
    $log = $stmt->fetch();
    if (!$log) jsonError('Audit entry not found.', 404);
    $log['before_state'] = $log['before_state'] ? json_decode($log['before_state'], true) : null;
    $log['after_state'] = $log['after_state'] ? json_decode($log['after_state'], true) : null;
    jsonOk(['log' => $log]);
} catch (PDOException $e) {
    error_log('[api/osa/audit-logs/detail] ' . $e->getMessage());
    jsonError('Could not load the audit entry right now.', 500);
}
