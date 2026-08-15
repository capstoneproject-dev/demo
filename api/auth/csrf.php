<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, private');
header('Pragma: no-cache');

if (isLoggedIn()) authEnforceSessionLifetime();

jsonOk([
    'csrf_token' => authCsrfToken(),
]);
