<?php
/**
 * GET|POST /api/auth/logout.php
 *
 * Destroys the PHP session.
 * Returns JSON { ok: true } so JS can clear localStorage and redirect.
 */

require_once __DIR__ . '/../../includes/auth.php';

header('Content-Type: application/json');

destroySession();

jsonOk(['message' => 'Logged out successfully.']);
