<?php
/**
 * POST /api/auth/login.php
 *
 * Accepts JSON body or form-encoded POST.
 * Body fields:
 *   identifier  — email, student number, or employee number
 *   password    — plain-text password (compared against bcrypt hash)
 *
 * Returns JSON:
 *   { ok: true,  user: {...}, memberships: [...], legacyProfile: {...} }
 *   { ok: false, error: "..." }
 *
 * On success a PHP session is created. The JS caller receives the data,
 * builds the full session payload client-side (same logic as before),
 * saves it to localStorage, and then redirects.
 */

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/functions.php';

header('Content-Type: application/json');

requirePost();

$body       = getRequestBody();
$identifier = trim($body['identifier'] ?? '');
$password   = $body['password'] ?? '';

if (!$identifier || !$password) {
    jsonError('Please enter your email / ID and password.');
}

// --- Look up user ---
$user = findUserByIdentifier($identifier);

if (!$user) {
    jsonError('Account not found. Please check your credentials or register first.');
}

if (!$user['is_active']) {
    jsonError('Your account is inactive. Please contact administration.');
}

if (!password_verify($password, $user['password_hash'])) {
    jsonError('Invalid password. Please try again.');
}

// --- Build memberships ---
$memberships = getOfficerMemberships((int)$user['user_id']);

// --- Determine base login role ---
$loginRole = match($user['account_type']) {
    'osa_staff' => 'osa',
    default     => (count($memberships) > 0 ? 'student' : 'student'),
    // JS will upgrade to 'org' when the user picks an officer dashboard
};

// --- Store base PHP session (org choice happens client-side via the modal) ---
$sessionPayload = buildSessionPayload($user, $memberships, $loginRole);
startUserSession($sessionPayload);

// --- Update last_login_at ---
touchLastLogin((int)$user['user_id']);

// --- Build the legacy profile (needed by studentDashboard.js) ---
$legacyProfile = buildLegacyProfile($user, null); // org resolved client-side

jsonOk([
    'user'          => [
        'user_id'         => (int)$user['user_id'],
        'account_type'    => $user['account_type'],
        'first_name'      => $user['first_name'],
        'last_name'       => $user['last_name'],
        'email'           => $user['email'],
        'student_number'  => $user['student_number'],
        'employee_number' => $user['employee_number'],
        'program_code'    => $user['program_code'],
        'section'         => $user['section'],
        'program_id'      => $user['program_id'] ?? null,
    ],
    'memberships'   => $memberships,
    'legacyProfile' => $legacyProfile,
]);
