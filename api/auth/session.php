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

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['authenticated' => false]);
    exit;
}

$session = getPhpSession();

echo json_encode([
    'authenticated' => true,
    'user_id'       => $_SESSION['user_id'],
    'account_type'  => $session['account_type'] ?? null,
    'session'       => $session,
]);
