<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, private');
apiGuard(true); // Keep presence updates serialized with this session's logout.

// This endpoint is also used by the visible-page presence heartbeat. Recording
// presence here does not extend the authenticated session's genuine-activity
// deadline unless the request carries X-Capstone-User-Activity.
authRecordPresence();
authReleaseSessionLock();

jsonOk(['recorded' => true]);
