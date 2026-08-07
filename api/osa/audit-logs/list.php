<?php

require_once __DIR__ . '/../../../includes/auth.php';

header('Content-Type: application/json');
apiRequirePrimaryOsaAdministrator();

$search = trim((string)($_GET['search'] ?? ''));
$action = trim((string)($_GET['action'] ?? ''));
$dateFrom = trim((string)($_GET['date_from'] ?? ''));
$dateTo = trim((string)($_GET['date_to'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$limit = min(100, max(10, (int)($_GET['limit'] ?? 25)));
$offset = ($page - 1) * $limit;
$where = [];
$params = [];

if ($search !== '') {
    $where[] = "(actor_name LIKE :search OR actor_email LIKE :search
                 OR target_name LIKE :search OR target_email LIKE :search
                 OR actor_employee_number LIKE :search
                 OR target_employee_number LIKE :search
                 OR action LIKE :search OR target_type LIKE :search
                 OR target_id LIKE :search)";
    $params[':search'] = '%' . $search . '%';
}
if ($action !== '') {
    $where[] = 'action = :action';
    $params[':action'] = $action;
}
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $where[] = 'created_at >= :date_from';
    $params[':date_from'] = $dateFrom . ' 00:00:00';
}
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $where[] = 'created_at < DATE_ADD(:date_to, INTERVAL 1 DAY)';
    $params[':date_to'] = $dateTo . ' 00:00:00';
}
$whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

try {
    $pdo = getPdo();
    $count = $pdo->prepare("SELECT COUNT(*) FROM audit_logs{$whereSql}");
    $count->execute($params);
    $total = (int)$count->fetchColumn();
    $stmt = $pdo->prepare(
        "SELECT audit_id, actor_name, action, target_type, target_id, target_name,
                target_email, result, created_at
         FROM audit_logs{$whereSql}
         ORDER BY audit_id DESC LIMIT {$limit} OFFSET {$offset}"
    );
    $stmt->execute($params);
    $actions = $pdo->query("SELECT DISTINCT action FROM audit_logs ORDER BY action")->fetchAll(PDO::FETCH_COLUMN);
    jsonOk([
        'logs' => $stmt->fetchAll(),
        'actions' => $actions,
        'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total],
    ]);
} catch (PDOException $e) {
    error_log('[api/osa/audit-logs/list] ' . $e->getMessage());
    jsonError('Could not load audit logs right now.', 500);
}
