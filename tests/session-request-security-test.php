<?php
declare(strict_types=1);

$scenario = (string)($argv[1] ?? '');
if ($scenario === 'csrf_missing' || $scenario === 'csrf_valid') {
    ini_set('session.save_path', sys_get_temp_dir());
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/api/auth/csrf.php';
    require_once __DIR__ . '/../includes/auth.php';
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/api/test/mutation.php';
    if ($scenario === 'csrf_valid') {
        $_SERVER['HTTP_X_CSRF_TOKEN'] = authCsrfToken();
    }
    authEnforceCsrfForApiRequest();
    echo json_encode(['ok' => true]) . PHP_EOL;
    exit;
}

ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/auth.php';

function securityAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function securityRunScenario(string $scenario): string
{
    $pipes = [];
    $process = proc_open(
        [PHP_BINARY, __FILE__, $scenario],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes
    );
    if (!is_resource($process)) throw new RuntimeException('Could not start security test subprocess.');
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    if ($exit !== 0) throw new RuntimeException("Security subprocess failed: {$stderr}");
    return $stdout;
}

securityAssert(ini_get('session.use_strict_mode') === '1', 'PHP session strict mode is disabled.');
securityAssert(ini_get('session.use_only_cookies') === '1', 'PHP accepted non-cookie session identifiers.');
securityAssert(ini_get('session.cookie_httponly') === '1', 'The session cookie is not HttpOnly.');
securityAssert(strtolower((string)ini_get('session.cookie_samesite')) === 'lax', 'The session cookie is not SameSite=Lax.');

$originalId = session_id();
$payload = [
    'user_id' => 900000001,
    'account_type' => 'student',
    'login_role' => 'student',
    'display_name' => 'Security Test',
];
startUserSession($payload, true);
securityAssert(session_id() !== '' && session_id() !== $originalId, 'Login did not regenerate the session ID.');
securityAssert((int)$_SESSION['capstone_security']['reauthenticated_at'] > 0, 'Login did not establish recent authentication.');
securityAssert(!authRequiresRecentReauthentication(), 'A fresh login immediately requires reauthentication.');

$firstToken = authCsrfToken();
securityAssert((bool)preg_match('/^[a-f0-9]{64}$/', $firstToken), 'CSRF token format is invalid.');
$secondToken = authRotateCsrfToken();
securityAssert($secondToken !== $firstToken, 'CSRF token rotation reused the prior token.');

$_SESSION['capstone_security']['created_at'] = time() - 100;
$_SESSION['capstone_security']['last_activity_at'] = time() - 1801;
securityAssert(authSessionExpiredReason() === 'idle', 'Idle timeout was not detected.');
$_SESSION['capstone_security']['created_at'] = time() - 28801;
$_SESSION['capstone_security']['last_activity_at'] = time();
securityAssert(authSessionExpiredReason() === 'absolute', 'Absolute timeout was not detected.');

$_SESSION['capstone_security']['created_at'] = time();
$_SESSION['capstone_security']['last_activity_at'] = time() - 100;
$unchangedActivity = (int)$_SESSION['capstone_security']['last_activity_at'];
unset($_SERVER['HTTP_X_CAPSTONE_USER_ACTIVITY']);
authEnforceSessionLifetime();
securityAssert((int)$_SESSION['capstone_security']['last_activity_at'] === $unchangedActivity, 'Background request extended idle timeout.');
$_SERVER['HTTP_X_CAPSTONE_USER_ACTIVITY'] = '1';
authEnforceSessionLifetime();
securityAssert((int)$_SESSION['capstone_security']['last_activity_at'] > $unchangedActivity, 'Genuine activity did not extend idle timeout.');

$_SESSION['capstone_security']['reauthenticated_at'] = time() - 601;
securityAssert(authRequiresRecentReauthentication(), 'Expired reauthentication window was accepted.');
$beforeReauthId = session_id();
$beforeReauthToken = authCsrfToken();
$afterReauthToken = authMarkReauthenticated(true);
securityAssert(session_id() !== $beforeReauthId, 'Reauthentication did not regenerate the session ID.');
securityAssert($afterReauthToken !== $beforeReauthToken, 'Reauthentication did not rotate the CSRF token.');
securityAssert(!authRequiresRecentReauthentication(), 'Successful reauthentication did not open the ten-minute window.');

putenv('CAPSTONE_COOKIE_SECURE=1');
securityAssert(authSessionCookieOptions()['secure'] === true, 'Secure-cookie deployment override was ignored.');
putenv('CAPSTONE_COOKIE_SECURE=0');
securityAssert(authSessionCookieOptions()['secure'] === false, 'Local HTTP cookie override was ignored.');
putenv('CAPSTONE_COOKIE_SECURE');

$missing = securityRunScenario('csrf_missing');
securityAssert(str_contains($missing, '"error_code":"CSRF_VALIDATION_FAILED"'), 'Missing CSRF token was accepted.');
$valid = securityRunScenario('csrf_valid');
securityAssert(str_contains($valid, '"ok":true'), 'Valid CSRF token was rejected.');

$scopedEndpoints = [
    'api/accounts/students/save.php',
    'api/accounts/officers/save.php',
    'api/accounts/requests/action.php',
    'api/accounts/student-numbers/import.php',
    'api/osa/staff/transfer-primary.php',
    'api/osa/staff/delete.php',
    'api/osa/staff/invite.php',
    'api/services/osa/save.php',
    'api/osa/settings/academic-term.php',
];
foreach ($scopedEndpoints as $relativePath) {
    $source = file_get_contents(__DIR__ . '/../' . $relativePath);
    securityAssert($source !== false, "Missing scoped endpoint: {$relativePath}");
    securityAssert(str_contains((string)$source, 'apiRequireRecentReauthentication()'), "Missing reauthentication guard: {$relativePath}");
}

$routineEndpoints = [
    'api/documents/review.php',
    'api/printing/officer/update-status.php',
    'api/qr-attendance/attendance/checkin.php',
    'api/announcements/create.php',
];
foreach ($routineEndpoints as $relativePath) {
    $source = file_get_contents(__DIR__ . '/../' . $relativePath);
    securityAssert($source !== false, "Missing routine endpoint: {$relativePath}");
    securityAssert(!str_contains((string)$source, 'apiRequireRecentReauthentication()'), "Routine workflow gained reauthentication: {$relativePath}");
}

echo "Session and request security tests passed.\n";
