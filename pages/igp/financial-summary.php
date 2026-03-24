<?php
require_once __DIR__ . '/../../includes/auth.php';
$session = guardSession('../login.html');
if (($session['login_role'] ?? '') !== 'org' || empty($session['active_org_id'])) {
    header('Location: ../login.html');
    exit;
}

header('Location: ../officerDashboard.html#tracker-financial-summary');
exit;
