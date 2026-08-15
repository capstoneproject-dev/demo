<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, private');
apiGuard();

jsonOk(['recorded' => true]);
