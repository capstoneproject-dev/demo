<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/osa_staff.php';

header('Content-Type: application/json');
$session = apiRequirePrimaryOsaAdministrator();
$pdo = getPdo();

try {
    expirePendingOsaInvitations($pdo);
    $staff = $pdo->query(
        "SELECT user_id, employee_number, email, first_name, last_name, phone,
                is_active, is_primary_osa, last_login_at, created_at
         FROM users
         WHERE account_type = 'osa_staff'
         ORDER BY is_primary_osa DESC, is_active DESC, last_name, first_name"
    )->fetchAll();
    $invitations = $pdo->query(
        "SELECT i.invitation_id, i.employee_number, i.email, i.status,
                i.delivery_status, i.delivery_error, i.expires_at, i.last_sent_at,
                i.accepted_at, i.revoked_at, i.created_at,
                CONCAT(inviter.first_name, ' ', inviter.last_name) AS invited_by_name
         FROM osa_staff_invitations i
         JOIN users inviter ON inviter.user_id = i.invited_by_user_id
         ORDER BY i.created_at DESC"
    )->fetchAll();
    jsonOk(['staff' => $staff, 'invitations' => $invitations]);
} catch (PDOException $e) {
    error_log('[api/osa/staff/list] ' . $e->getMessage());
    jsonError('Could not load OSA staff right now.', 500);
}
