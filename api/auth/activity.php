<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, private');
apiGuard();

// This endpoint is also used by the visible-page presence heartbeat. Recording
// presence here does not extend the authenticated session's genuine-activity
// deadline unless the request carries X-Capstone-User-Activity.
authRecordPresence();

jsonOk(['recorded' => true]);
