<?php
/**
 * PHP session helpers.
 * All API and page scripts that need auth should require_once this file.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Normalize session cookie scope so both /api/* and /pages/* routes
    // share the same PHP session (important for iframe-authenticated pages).
    if (session_id() !== '') {
        $name = session_name();
        $sid  = session_id();
        setcookie($name, $sid, [
            'expires' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        // Best-effort cleanup of older narrow-path cookies that can shadow
        // the root cookie in some browsers.
        setcookie($name, '', time() - 3600, '/CAPSTONE/demo/api');
        setcookie($name, '', time() - 3600, '/CAPSTONE/demo/api/auth');
    }
}

require_once __DIR__ . '/../config/db.php';

// ---------------------------------------------------------------------------
// Session read / write
// ---------------------------------------------------------------------------

function isLoggedIn(): bool
{
    return !empty($_SESSION['user_id']);
}

/** Returns the full session payload stored at login, or []. */
function getPhpSession(): array
{
    return $_SESSION['naap_session'] ?? [];
}

/**
 * Persist a session payload into $_SESSION.
 * Stores the full payload under 'naap_session' and a top-level 'user_id'
 * so isLoggedIn() stays fast.
 */
function startUserSession(array $payload): void
{
    $_SESSION['user_id']      = $payload['user_id'];
    $_SESSION['naap_session'] = $payload;
}

/** Updates only the active-org fields without rebuilding the full session. */
function updateActiveOrg(int $orgId, string $orgName, string $roleName): void
{
    $_SESSION['naap_session']['active_org_id']   = $orgId;
    $_SESSION['naap_session']['active_org_name'] = $orgName;
    $_SESSION['naap_session']['active_role_name']= $roleName;
    $_SESSION['naap_session']['login_role']      = 'org';
}

function destroySession(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

// ---------------------------------------------------------------------------
// Page-level guards (for PHP-rendered pages)
// ---------------------------------------------------------------------------

/**
 * Redirect to login if not authenticated.
 * Returns the session payload so the caller can use it immediately.
 *
 * @param string $redirectTo Relative path to login page.
 */
function guardSession(string $redirectTo = '../pages/login.html'): array
{
    if (!isLoggedIn()) {
        header("Location: $redirectTo");
        exit;
    }
    return getPhpSession();
}

/**
 * API-level auth guard (returns JSON 401 instead of redirecting).
 * Use this in REST endpoints instead of guardSession().
 */
function apiGuard(): void
{
    if (!isLoggedIn()) {
        jsonError('Not authenticated.', 401);
    }
}

// ---------------------------------------------------------------------------
// JSON response helpers (for API endpoints)
// ---------------------------------------------------------------------------

function jsonOk(array $data = []): never
{
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, ...$data]);
    exit;
}

function jsonError(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed.', 405);
    }
}

/** Read JSON body or fall back to $_POST. */
function getRequestBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $decoded;
    }
    return $_POST;
}
