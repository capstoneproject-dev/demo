<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/osa_staff.php';

header('Content-Type: application/json');
$session = apiRequirePrimaryOsaAdministrator();
$pdo = getPdo();

try {
    $staff = $pdo->query(
        "SELECT user_id, employee_number, email, first_name, last_name, phone,
                is_active, is_primary_osa, osa_archived_at, last_login_at, created_at
         FROM users
         WHERE account_type = 'osa_staff'
         ORDER BY is_primary_osa DESC, is_active DESC, last_name, first_name"
    )->fetchAll();
    jsonOk(['staff' => $staff]);
} catch (PDOException $e) {
    error_log('[api/osa/staff/list] ' . $e->getMessage());
    jsonError('Could not load OSA staff right now.', 500);
}
