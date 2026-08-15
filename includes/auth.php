<?php
/**
 * PHP session helpers.
 * All API and page scripts that need auth should require_once this file.
 */

const CAPSTONE_SESSION_SECURITY_VERSION = 1;
const CAPSTONE_SESSION_IDLE_SECONDS_DEFAULT = 1800;
const CAPSTONE_SESSION_ABSOLUTE_SECONDS_DEFAULT = 28800;
const CAPSTONE_REAUTH_SECONDS_DEFAULT = 600;

function authEnvironmentSeconds(string $name, int $default, int $minimum): int
{
    $value = getenv($name);
    if ($value === false || !preg_match('/^\d+$/', trim((string)$value))) return $default;
    return max($minimum, (int)$value);
}

function authRequestIsHttps(): bool
{
    $override = getenv('CAPSTONE_COOKIE_SECURE');
    if ($override !== false && trim((string)$override) !== '') {
        return filter_var($override, FILTER_VALIDATE_BOOLEAN);
    }
    return strtolower((string)($_SERVER['HTTPS'] ?? '')) === 'on'
        || (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function authSessionCookieOptions(int $expires = 0): array
{
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => authRequestIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.cookie_secure', authRequestIsHttps() ? '1' : '0');
    ini_set('session.gc_maxlifetime', (string)authEnvironmentSeconds(
        'CAPSTONE_SESSION_ABSOLUTE_SECONDS',
        CAPSTONE_SESSION_ABSOLUTE_SECONDS_DEFAULT,
        900
    ));
    $cookieOptions = authSessionCookieOptions();
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $cookieOptions['path'],
        'secure' => $cookieOptions['secure'],
        'httponly' => $cookieOptions['httponly'],
        'samesite' => $cookieOptions['samesite'],
    ]);
    session_start();

    // Normalize session cookie scope so both /api/* and /pages/* routes
    // share the same PHP session (important for iframe-authenticated pages).
    if (session_id() !== '') {
        $name = session_name();
        $sid  = session_id();
        setcookie($name, $sid, authSessionCookieOptions());

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
function startUserSession(array $payload, bool $establishAuthentication = false): void
{
    if ($establishAuthentication) {
        session_regenerate_id(true);
        $now = time();
        $_SESSION['capstone_security'] = [
            'version' => CAPSTONE_SESSION_SECURITY_VERSION,
            'created_at' => $now,
            'last_activity_at' => $now,
            'reauthenticated_at' => $now,
        ];
        authRotateCsrfToken();
    }
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
        $name = session_name();
        if (ini_get('session.use_cookies')) {
            setcookie($name, '', authSessionCookieOptions(time() - 42000));
        }
        session_destroy();
    }
}

function authRotateCsrfToken(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION['capstone_csrf_token'] = $token;
    return $token;
}

function authCsrfToken(): string
{
    $token = (string)($_SESSION['capstone_csrf_token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return authRotateCsrfToken();
    return $token;
}

function authUpgradeExistingSession(): void
{
    if (!isLoggedIn()) return;
    $security = $_SESSION['capstone_security'] ?? [];
    if ((int)($security['version'] ?? 0) >= CAPSTONE_SESSION_SECURITY_VERSION) return;
    session_regenerate_id(true);
    $now = time();
    $_SESSION['capstone_security'] = [
        'version' => CAPSTONE_SESSION_SECURITY_VERSION,
        'created_at' => $now,
        'last_activity_at' => $now,
        'reauthenticated_at' => 0,
    ];
    authRotateCsrfToken();
}

function authSessionExpiredReason(): ?string
{
    if (!isLoggedIn()) return null;
    $security = $_SESSION['capstone_security'] ?? [];
    $now = time();
    $created = (int)($security['created_at'] ?? $now);
    $lastActivity = (int)($security['last_activity_at'] ?? $created);
    $idleSeconds = authEnvironmentSeconds('CAPSTONE_SESSION_IDLE_SECONDS', CAPSTONE_SESSION_IDLE_SECONDS_DEFAULT, 60);
    $absoluteSeconds = authEnvironmentSeconds('CAPSTONE_SESSION_ABSOLUTE_SECONDS', CAPSTONE_SESSION_ABSOLUTE_SECONDS_DEFAULT, 900);
    if (($now - $created) >= $absoluteSeconds) return 'absolute';
    if (($now - $lastActivity) >= $idleSeconds) return 'idle';
    return null;
}

function authHasRecentUserActivityHeader(): bool
{
    return trim((string)($_SERVER['HTTP_X_CAPSTONE_USER_ACTIVITY'] ?? '')) === '1';
}

function authEnforceSessionLifetime(): void
{
    if (!isLoggedIn()) return;
    $reason = authSessionExpiredReason();
    if ($reason !== null) {
        destroySession();
        jsonError('Your session has expired. Please log in again.', 401, [
            'error_code' => 'SESSION_EXPIRED',
            'reason' => $reason,
        ]);
    }
    if (authHasRecentUserActivityHeader()) {
        $_SESSION['capstone_security']['last_activity_at'] = time();
    }
}

function authMarkReauthenticated(bool $regenerateSession = true): string
{
    if ($regenerateSession) session_regenerate_id(true);
    $_SESSION['capstone_security']['reauthenticated_at'] = time();
    return authRotateCsrfToken();
}

function authRequiresRecentReauthentication(): bool
{
    $seconds = authEnvironmentSeconds('CAPSTONE_REAUTH_SECONDS', CAPSTONE_REAUTH_SECONDS_DEFAULT, 60);
    $verifiedAt = (int)($_SESSION['capstone_security']['reauthenticated_at'] ?? 0);
    return $verifiedAt <= 0 || (time() - $verifiedAt) >= $seconds;
}

function apiRequireRecentReauthentication(): void
{
    apiGuard();
    if (authRequiresRecentReauthentication()) {
        jsonError('Please confirm your current password to continue.', 428, [
            'error_code' => 'REAUTHENTICATION_REQUIRED',
        ]);
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
    if (authSessionExpiredReason() !== null) {
        destroySession();
        header("Location: $redirectTo");
        exit;
    }
    // A protected PHP page navigation is itself a genuine user action; unlike
    // dashboard API polling, it may safely extend the idle deadline.
    $_SESSION['capstone_security']['last_activity_at'] = time();
    return getPhpSession();
}

/**
 * API-level auth guard (returns JSON 401 instead of redirecting).
 * Use this in REST endpoints instead of guardSession().
 */
function apiGuard(): void
{
    if (!isLoggedIn()) {
        jsonError('Not authenticated.', 401, ['error_code' => 'AUTHENTICATION_REQUIRED']);
    }
    authEnforceSessionLifetime();

    $session = getPhpSession();
    if (($session['account_type'] ?? '') === 'osa_staff') {
        $userId = (int)($session['user_id'] ?? $_SESSION['user_id'] ?? 0);
        try {
            $stmt = getPdo()->prepare(
                "SELECT account_type, is_active, is_primary_osa
                 FROM users WHERE user_id = :user_id LIMIT 1"
            );
            $stmt->execute([':user_id' => $userId]);
            $current = $stmt->fetch();
        } catch (PDOException $e) {
            error_log('[auth/osa-session-refresh] ' . $e->getMessage());
            jsonError('Authorization could not be verified.', 500);
        }

        if (
            !$current
            || ($current['account_type'] ?? '') !== 'osa_staff'
            || (int)($current['is_active'] ?? 0) !== 1
        ) {
            destroySession();
            jsonError('Not authenticated.', 401, ['error_code' => 'AUTHENTICATION_REQUIRED']);
        }

        $_SESSION['naap_session']['is_primary_osa'] = (int)($current['is_primary_osa'] ?? 0) === 1;
    }
}

/**
 * Require the combined OSA/System Administrator account role.
 *
 * The database is checked on every protected request so an inactive,
 * deleted, or demoted account cannot retain administrative access through
 * an older session payload.
 *
 * @return array The authenticated PHP session payload.
 */
function apiRequireOsaSystemAdministrator(): array
{
    apiGuard();

    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? $_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('You are not authorized to perform this action.', 403);
    }

    try {
        $stmt = getPdo()->prepare(
            "SELECT account_type, is_active
             FROM users
             WHERE user_id = :user_id
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $user = $stmt->fetch();
    } catch (PDOException $e) {
        error_log('[auth/osa-system-administrator] ' . $e->getMessage());
        jsonError('Authorization could not be verified.', 500);
    }

    if (
        !$user
        || (int)($user['is_active'] ?? 0) !== 1
        || ($user['account_type'] ?? '') !== 'osa_staff'
    ) {
        jsonError('You are not authorized to perform this action.', 403);
    }

    return $session;
}

/**
 * Require the sole active Primary OSA. The flag is always read from the
 * database; a browser session or localStorage value can never grant access.
 */
function apiRequirePrimaryOsaAdministrator(): array
{
    $session = apiRequireOsaSystemAdministrator();
    $userId = (int)($session['user_id'] ?? $_SESSION['user_id'] ?? 0);

    try {
        $stmt = getPdo()->prepare(
            "SELECT is_primary_osa
             FROM users
             WHERE user_id = :user_id
               AND account_type = 'osa_staff'
               AND is_active = 1
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $isPrimary = $stmt->fetchColumn();
    } catch (PDOException $e) {
        error_log('[auth/primary-osa] ' . $e->getMessage());
        jsonError('Authorization could not be verified.', 500);
    }

    if ((int)$isPrimary !== 1) {
        jsonError('Primary OSA authorization is required.', 403);
    }

    return $session;
}

// ---------------------------------------------------------------------------
// JSON response helpers (for API endpoints)
// ---------------------------------------------------------------------------

function jsonOk(array $data = []): never
{
    if (function_exists('auditFinalizeRequest')) {
        try {
            // This uses the same PDO transaction when the endpoint still has
            // one open, allowing the mutation and its required audit entry to
            // commit together. The shutdown hook remains a fallback for APIs
            // that return without this helper.
            auditFinalizeRequest(200, true, $data);
        } catch (Throwable $e) {
            try {
                $pdo = getPdo();
                if ($pdo->inTransaction()) $pdo->rollBack();
            } catch (Throwable $_ignored) {
            }
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['ok' => false, 'error' => 'The action could not be completed securely because its audit record failed.']);
            exit;
        }
    }
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, ...$data]);
    exit;
}

function jsonError(string $message, int $status = 400, array $data = []): never
{
    http_response_code($status);
    if (function_exists('auditFinalizeRequest')) auditFinalizeRequest($status);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => $message, ...$data]);
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
    static $cached = null;
    if (is_array($cached)) return $cached;
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) return $cached = $decoded;
    }
    return $cached = $_POST;
}

require_once __DIR__ . '/audit.php';

function authShouldValidateCsrf(): bool
{
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? ''));
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) return false;
    $route = strtolower(str_replace('\\', '/', (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '')));
    return $route !== '' && str_contains($route, '/api/');
}

function authEnforceCsrfForApiRequest(): void
{
    if (!authShouldValidateCsrf()) return;
    $provided = trim((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    $expected = authCsrfToken();
    if ($provided === '' || !hash_equals($expected, $provided)) {
        jsonError('The security token is missing or invalid. Refresh the page and try again.', 403, [
            'error_code' => 'CSRF_VALIDATION_FAILED',
        ]);
    }
}

authUpgradeExistingSession();
authEnforceCsrfForApiRequest();
