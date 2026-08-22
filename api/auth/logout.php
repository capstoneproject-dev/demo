<?php
/**
 * POST /api/auth/logout.php
 *
 * Destroys the PHP session.
 * Returns JSON { ok: true } so JS can clear localStorage and redirect.
 */

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');
requirePost();

if (!authClearUserPresence()) {
    jsonError('Could not securely clear your online session. Please try logging out again.', 500);
}
destroySession();

jsonOk(['message' => 'Logged out successfully.']);
