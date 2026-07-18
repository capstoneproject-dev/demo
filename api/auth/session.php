<?php
/**
 * GET /api/auth/session.php
 *
 * Returns the current PHP session state.
 * Dashboard pages fetch this on load to validate the server-side session.
 *
 * Returns:
 *   { authenticated: true,  user_id, account_type, session: {...} }
 *   { authenticated: false }
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['authenticated' => false]);
    exit;
}

$session = getPhpSession();

// Student enrollment details can change during the annual OSA roster import.
// Refresh database-backed profile fields on every session check so browser
// localStorage never remains the source of truth for year/section or program.
if (($session['account_type'] ?? '') === 'student') {
    $user = getUserById((int)$_SESSION['user_id']);
    if (!$user) {
        destroySession();
        echo json_encode(['authenticated' => false]);
        exit;
    }

    $mappedOrg = !empty($user['program_id'])
        ? getMappedOrgByProgram((int)$user['program_id'])
        : null;
    $session['display_name'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
    $session['email'] = $user['email'] ?? null;
    $session['phone'] = $user['phone'] ?? null;
    $session['profile_photo'] = $user['profile_photo'] ?? null;
    $session['student_number'] = $user['student_number'] ?? null;
    $session['program_id'] = isset($user['program_id']) ? (int)$user['program_id'] : null;
    $session['program_code'] = $user['program_code'] ?? null;
    $session['section'] = $user['student_numbers_year_section'] ?? null;
    $session['mapped_org_id'] = isset($mappedOrg['org_id']) ? (int)$mappedOrg['org_id'] : null;
    $session['mapped_org_name'] = $mappedOrg['org_name'] ?? null;
    startUserSession($session);
}

echo json_encode([
    'authenticated' => true,
    'user_id'       => $_SESSION['user_id'],
    'account_type'  => $session['account_type'] ?? null,
    'session'       => $session,
]);
