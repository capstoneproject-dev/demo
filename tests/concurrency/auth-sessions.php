<?php
/** Run: C:/xampp/php/php.exe tests/concurrency/auth-sessions.php
 * Independent CLI processes exercise real PHP file-session locks.
 * Temporary sessions only; no database fixtures or tables are created.
 */
declare(strict_types=1);

function sessionCheck(bool $ok, string $message): void
{
    if (!$ok) throw new RuntimeException($message);
}

ini_set('session.use_cookies', '0');
ini_set('session.cache_limiter', '');
ini_set('session.gc_probability', '0');

if (($argv[1] ?? '') === 'worker') {
    $args = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    ini_set('session.save_path', $args['directory']);
    session_id($args['id']);
    file_put_contents($args['signal'] . '.started', '1');
    if ($args['mode'] === 'save-failure') {
        ini_set('error_log', $args['signal'] . '.log');
        session_set_save_handler(new class extends SessionHandler {
            public function write(string $id, string $data): bool { return false; }
        }, true);
    }
    require __DIR__ . '/../../includes/auth.php';
    $mode = $args['mode'];
    if ($mode === 'save-failure') {
        try { authReleaseSessionLock(); }
        catch (RuntimeException $e) { echo json_encode(['rejected' => true]); exit; }
        throw new RuntimeException('Session storage failure was accepted.');
    }
    if ($mode === 'expired' || $mode === 'anonymous') {
        apiGuard();
        throw new RuntimeException('Invalid session passed authentication.');
    }
    if ($mode === 'csrf') {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        // Attendance avoids unrelated audit/rate-limit work in this fixture.
        $_SERVER['REQUEST_URI'] = '/api/qr-attendance/attendance/checkin.php';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'invalid';
        authEnforceCsrfForApiRequest();
        throw new RuntimeException('Invalid CSRF token accepted.');
    }
    if ($mode === 'page') {
        guardSession();
    } else {
        apiGuard(in_array($mode, ['writer', 'logout', 'reauth', 'pending', 'consume'], true));
        apiGuard(); // Nested guards must preserve the first guard's policy.
    }
    $active = session_status() === PHP_SESSION_ACTIVE;
    if ($mode === 'reader' || $mode === 'writer') {
        file_put_contents($args['signal'] . '.ready', '1');
        $deadline = microtime(true) + 10;
        while (!is_file($args['signal'] . '.go') && microtime(true) < $deadline) usleep(10000);
        sessionCheck(is_file($args['signal'] . '.go'), 'Missing completion signal.');
    }
    if ($mode === 'writer') {
        sessionCheck($active, 'Writer lost its lock through a nested guard.');
        $payload = getPhpSession();
        $payload['display_name'] = 'Updated by writer';
        startUserSession($payload);
        authMarkReauthenticated(false);
        authReleaseSessionLock();
    } elseif ($mode === 'logout') {
        destroySession();
    } elseif ($mode === 'reauth') {
        authMarkReauthenticated(true);
        authReleaseSessionLock();
    } elseif ($mode === 'pending' || $mode === 'consume') {
        require __DIR__ . '/../../includes/private_pdf_storage.php';
        if ($mode === 'pending') {
            privatePdfCreatePendingUpload(['storage_key' => 'documents/session-test.pdf',
                'original_name' => 'test.pdf'], 2147483647, 1);
        } else {
            privatePdfConsumePendingUpload(array_key_first($_SESSION['private_pdf_pending']));
        }
        authReleaseSessionLock();
    }
    $lateWriteRejected = false;
    if ($mode === 'reader' || $mode === 'fast') {
        sessionCheck(!$active, 'Read-only guard retained its lock.');
        apiRequireRecentReauthentication();
        try { startUserSession(getPhpSession()); }
        catch (LogicException $e) { $lateWriteRejected = true; }
        sessionCheck($lateWriteRejected, 'Late session write was not rejected.');
        try { apiGuard(true); throw new RuntimeException('Late writable guard accepted.'); }
        catch (LogicException $e) {}
        authReleaseSessionLock(); // Closing twice must be harmless.
    }
    echo json_encode([
        'active' => $active, 'id' => session_id(), 'payload' => getPhpSession(),
        'token' => $_SESSION['capstone_csrf_token'] ?? null,
        'last_activity' => $_SESSION['capstone_security']['last_activity_at'] ?? null,
        'late_write_rejected' => $lateWriteRejected,
    ], JSON_THROW_ON_ERROR);
    exit;
}

$directory = sys_get_temp_dir() . '/capstone-auth-sessions-' . bin2hex(random_bytes(8));
sessionCheck(mkdir($directory, 0700), 'Could not create temporary session directory.');
ini_set('session.save_path', $directory);
require __DIR__ . '/../../includes/auth.php';
session_write_close();
$workers = [];

function seedSession(string $kind = 'normal', ?array $payload = null): string
{
    session_id('');
    session_start();
    $now = time();
    $_SESSION = $kind === 'anonymous' ? [] : [
        'user_id' => 2147483647,
        'naap_session' => ['user_id' => 2147483647, 'account_type' => 'student',
            'login_role' => 'student', 'display_name' => 'Original'],
        'capstone_security' => ['version' => 1, 'created_at' => $now,
            'last_activity_at' => $kind === 'expired' ? $now - 3600 : $now - 10,
            'reauthenticated_at' => $now],
    ];
    if ($payload !== null) {
        $_SESSION['user_id'] = $payload['user_id'];
        $_SESSION['naap_session'] = $payload;
    }
    $id = session_id();
    session_write_close();
    return $id;
}

function readSession(string $id): array
{
    session_id($id);
    session_start();
    $data = $_SESSION;
    session_write_close();
    return $data;
}

function spawnSessionWorker(string $mode, string $id): int
{
    global $directory, $workers;
    $signal = $directory . '/worker-' . count($workers);
    $process = proc_open([PHP_BINARY, __FILE__, 'worker', json_encode([
        'directory' => $directory, 'id' => $id, 'mode' => $mode, 'signal' => $signal,
    ], JSON_THROW_ON_ERROR)], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    sessionCheck(is_resource($process), 'Could not start session worker.');
    $workers[] = ['process' => $process, 'pipes' => $pipes, 'signal' => $signal];
    return array_key_last($workers);
}

function waitSessionOutput(int $key, bool $ready = false): string
{
    global $workers;
    $worker = &$workers[$key];
    $deadline = microtime(true) + 10;
    do {
        if ($ready && is_file($worker['signal'] . '.ready')) return '';
        $status = proc_get_status($worker['process']);
        if (!$status['running']) {
            $output = stream_get_contents($worker['pipes'][1]);
            $errors = stream_get_contents($worker['pipes'][2]);
            sessionCheck(!$ready && $status['exitcode'] === 0 && $errors === '', 'Worker failed: ' . $output . $errors);
            return $output;
        }
        usleep(10000);
    } while (microtime(true) < $deadline);
    throw new RuntimeException('Session worker timed out.');
}

function finishSessionWorker(int $key): array
{
    $output = waitSessionOutput($key);
    return json_decode($output, true, 512, JSON_THROW_ON_ERROR);
}

function releaseWorker(int $key): void
{
    global $workers;
    file_put_contents($workers[$key]['signal'] . '.go', '1');
}

function sessionCgiResponse(string $cookie = ''): string
{
    global $directory;
    $cgi = dirname(PHP_BINARY) . '/php-cgi.exe';
    sessionCheck(is_file($cgi), 'PHP CGI executable is required for cookie-header regression checks.');
    $environment = getenv();
    $environment['REDIRECT_STATUS'] = '1';
    $environment['REQUEST_METHOD'] = 'GET';
    $environment['REQUEST_URI'] = '/api/auth/csrf.php';
    $environment['HTTP_COOKIE'] = $cookie;
    $environment['SCRIPT_FILENAME'] = realpath(__DIR__ . '/../../api/auth/csrf.php');
    $process = proc_open([$cgi, '-d', 'session.save_path=' . $directory,
        '-d', 'session.gc_probability=0', '-f', $environment['SCRIPT_FILENAME']],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
    sessionCheck(is_resource($process), 'Could not start CGI cookie check.');
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    sessionCheck($exit === 0 && $errors === '', 'CGI check failed: ' . $output . $errors);
    return $output;
}

try {
    $id = seedSession();
    $slow = spawnSessionWorker('reader', $id);
    waitSessionOutput($slow, true);
    $fast = finishSessionWorker(spawnSessionWorker('fast', $id));
    sessionCheck($fast['payload']['display_name'] === 'Original', 'Snapshot lost identity.');
    sessionCheck($fast['token'] === readSession($id)['capstone_csrf_token'], 'CSRF token not saved before release.');
    releaseWorker($slow);
    finishSessionWorker($slow);

    $id = seedSession();
    $writer = spawnSessionWorker('writer', $id);
    waitSessionOutput($writer, true);
    $reader = spawnSessionWorker('fast', $id);
    $deadline = microtime(true) + 5;
    while (!is_file($workers[$reader]['signal'] . '.started') && microtime(true) < $deadline) usleep(10000);
    sessionCheck(is_file($workers[$reader]['signal'] . '.started'), 'Reader failed to start.');
    usleep(200000);
    sessionCheck(proc_get_status($workers[$reader]['process'])['running'], 'Reader bypassed writer lock.');
    releaseWorker($writer);
    $saved = finishSessionWorker($writer);
    $read = finishSessionWorker($reader);
    sessionCheck($read['payload']['display_name'] === 'Updated by writer', 'Writer update was lost.');
    sessionCheck($read['token'] === $saved['token'], 'Reauthentication token update was lost.');

    $id = seedSession();
    $slow = spawnSessionWorker('reader', $id);
    waitSessionOutput($slow, true);
    finishSessionWorker(spawnSessionWorker('logout', $id));
    sessionCheck(!is_file($directory . '/sess_' . $id), 'Logout failed to destroy session.');
    releaseWorker($slow);
    finishSessionWorker($slow);
    sessionCheck(!is_file($directory . '/sess_' . $id), 'Old reader resurrected a logged-out session.');

    $id = seedSession();
    $before = readSession($id);
    $page = finishSessionWorker(spawnSessionWorker('page', $id));
    $after = readSession($id);
    sessionCheck(!$page['active'], 'Page guard retained lock.');
    sessionCheck($after['capstone_security']['last_activity_at'] > $before['capstone_security']['last_activity_at'], 'Page activity was not saved.');

    $id = seedSession();
    $reauth = finishSessionWorker(spawnSessionWorker('reauth', $id));
    sessionCheck($reauth['id'] !== $id, 'Reauthentication did not regenerate ID.');
    sessionCheck(!is_file($directory . '/sess_' . $id), 'Old ID survived reauthentication.');
    sessionCheck(readSession($reauth['id'])['capstone_csrf_token'] === $reauth['token'], 'New ID did not persist token.');

    foreach (['anonymous' => 'AUTHENTICATION_REQUIRED', 'expired' => 'SESSION_EXPIRED', 'csrf' => 'CSRF_VALIDATION_FAILED'] as $mode => $code) {
        $id = seedSession($mode);
        $result = finishSessionWorker(spawnSessionWorker($mode, $id));
        sessionCheck(($result['error_code'] ?? '') === $code, 'Wrong rejection for ' . $mode);
        if ($mode === 'expired') sessionCheck(!is_file($directory . '/sess_' . $id), 'Expired session not destroyed.');
    }
    $id = seedSession();
    $existing = sessionCgiResponse('PHPSESSID=' . $id);
    sessionCheck(!str_contains($existing, 'Set-Cookie: PHPSESSID=' . $id . ';'), 'Existing request reissued stale session cookie.');
    $new = sessionCgiResponse();
    sessionCheck((bool)preg_match('/Set-Cookie: PHPSESSID=[a-zA-Z0-9,-]+; path=\/; HttpOnly; SameSite=Lax/i', $new), 'New session cookie lacks root scope/security attributes.');
    $id = seedSession();
    sessionCheck(finishSessionWorker(spawnSessionWorker('save-failure', $id))['rejected'], 'Session save failure did not fail closed.');
    $id = seedSession();
    finishSessionWorker(spawnSessionWorker('pending', $id));
    sessionCheck(count(readSession($id)['private_pdf_pending']) === 1, 'Pending upload token not persisted.');
    finishSessionWorker(spawnSessionWorker('consume', $id));
    sessionCheck(readSession($id)['private_pdf_pending'] === [], 'Pending upload token not consumed.');

    // Read existing authorization fixtures; do not change accounts/memberships.
    $osa = getPdo()->query("SELECT user_id, is_primary_osa FROM users WHERE account_type = 'osa_staff' AND is_active = 1 LIMIT 1")->fetch();
    if ($osa) {
        $id = seedSession('normal', ['user_id' => (int)$osa['user_id'], 'account_type' => 'osa_staff',
            'login_role' => 'osa', 'is_primary_osa' => !(bool)$osa['is_primary_osa']]);
        finishSessionWorker(spawnSessionWorker('fast', $id));
        sessionCheck(readSession($id)['naap_session']['is_primary_osa'] === (bool)$osa['is_primary_osa'], 'OSA authorization refresh was not saved.');
    }
    $membership = getPdo()->query("SELECT om.user_id, om.org_id, r.can_manage_org_dashboard, r.can_review_org_documents
        FROM organization_members om JOIN org_roles r ON r.role_id = om.role_id AND r.org_id = om.org_id
        JOIN organizations o ON o.org_id = om.org_id JOIN users u ON u.user_id = om.user_id
        WHERE om.is_active = 1 AND r.is_active = 1 AND r.can_access_org_dashboard = 1
          AND o.status <> 'suspended' AND u.is_active = 1 LIMIT 1")->fetch();
    if ($membership) {
        $id = seedSession('normal', ['user_id' => (int)$membership['user_id'], 'account_type' => 'student',
            'login_role' => 'org', 'active_org_id' => (int)$membership['org_id'],
            'can_manage_org_dashboard' => !(bool)$membership['can_manage_org_dashboard'],
            'can_review_org_documents' => !(bool)$membership['can_review_org_documents']]);
        finishSessionWorker(spawnSessionWorker('fast', $id));
        $saved = readSession($id)['naap_session'];
        sessionCheck($saved['can_manage_org_dashboard'] === (bool)$membership['can_manage_org_dashboard']
            && $saved['can_review_org_documents'] === (bool)$membership['can_review_org_documents'], 'Organization authorization refresh was not saved.');
    }
    echo "PASS: overlapping readers, serialized writers/nested guards, logout collision, page activity, ID/token rotation, expiry, authentication/CSRF rejection, CGI cookie headers, failed saves, and pending-upload tokens.\n";
    echo 'Authorization refresh: OSA ' . ($osa ? 'PASS' : 'SKIP (no active account)')
        . ', organization ' . ($membership ? 'PASS' : 'SKIP (no active membership)') . ".\n";
} finally {
    foreach ($workers as $worker) {
        foreach ($worker['pipes'] as $pipe) if (is_resource($pipe)) fclose($pipe);
        if (proc_get_status($worker['process'])['running']) proc_terminate($worker['process']);
        proc_close($worker['process']);
    }
    // Only this run's explicitly created directory and files are removed.
    foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
    rmdir($directory);
}
