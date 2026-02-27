<?php
/**
 * POST /api/auth/activate-org.php
 *
 * Upgrades current authenticated PHP session to org-context based on selected org.
 * Requires existing login session from /api/auth/login.php.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$body = getRequestBody();
$orgId = (int)($body['org_id'] ?? 0);

if ($orgId <= 0) {
    jsonError('Invalid organization selection.');
}

try {
    $uid = (int)($_SESSION['user_id'] ?? 0);
    if ($uid <= 0) {
        jsonError('Not authenticated.', 401);
    }

    $memberships = getOfficerMemberships($uid);
    $selected = null;
    foreach ($memberships as $m) {
        if ((int)$m['org_id'] === $orgId) {
            $selected = $m;
            break;
        }
    }

    if (!$selected) {
        jsonError('You do not have officer access for that organization.', 403);
    }

    updateActiveOrg((int)$selected['org_id'], (string)$selected['org_name'], (string)$selected['role_name']);
    $session = getPhpSession();
    jsonOk(['session' => $session]);
} catch (PDOException $e) {
    error_log('[api/auth/activate-org] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}

