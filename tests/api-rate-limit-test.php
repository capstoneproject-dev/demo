<?php
declare(strict_types=1);

ini_set('session.save_path', sys_get_temp_dir());

$scenario = (string)($argv[1] ?? '');
$scenarioSubject = (string)($argv[2] ?? '');
if ($scenario === 'consume') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/tests/rate-limit';
    require_once __DIR__ . '/../includes/auth.php';
    rateLimitConsume('test_concurrent', $scenarioSubject, 100, 3600);
    echo "ok\n";
    exit;
}

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/CAPSTONE/demo/tests/rate-limit';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
require_once __DIR__ . '/../includes/auth.php';

function rateTestAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = getPdo();
$table = $pdo->query("SHOW TABLES LIKE 'api_rate_limit_buckets'")->fetchColumn();
rateTestAssert($table === 'api_rate_limit_buckets', 'The API rate-limit table is missing.');

$columns = $pdo->query("SHOW COLUMNS FROM api_rate_limit_buckets")->fetchAll(PDO::FETCH_COLUMN);
rateTestAssert(!in_array('subject', $columns, true), 'The table stores raw bucket subjects.');
rateTestAssert(!in_array('ip_address', $columns, true), 'The table stores raw client IP subjects.');

$subject = 'test:' . bin2hex(random_bytes(12));
try {
    $first = rateLimitConsume('test_boundary', $subject, 2, 300);
    $second = rateLimitConsume('test_boundary', $subject, 2, 300);
    $third = rateLimitConsume('test_boundary', $subject, 2, 300);
    rateTestAssert(!$first['limited'] && !$second['limited'], 'Requests were blocked before reaching the limit.');
    rateTestAssert($third['limited'], 'A request beyond the limit was accepted.');

    $status = rateLimitStatus('test_boundary', $subject, 2, 300);
    rateTestAssert($status['limited'] && $status['count'] === 3, 'Stored bucket count is incorrect.');
    rateLimitClear('test_boundary', $subject, 300);
    rateTestAssert(rateLimitStatus('test_boundary', $subject, 2, 300)['count'] === 0, 'Bucket clear failed.');

    $_SERVER['REMOTE_ADDR'] = '198.51.100.10';
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.20';
    putenv('CAPSTONE_TRUSTED_PROXIES');
    rateTestAssert(rateLimitClientIp() === '198.51.100.10', 'An untrusted forwarded IP was accepted.');
    putenv('CAPSTONE_TRUSTED_PROXIES=198.51.100.10');
    rateTestAssert(rateLimitClientIp() === '203.0.113.20', 'A configured trusted proxy was ignored.');
    putenv('CAPSTONE_TRUSTED_PROXIES');

    $concurrentSubject = 'concurrent:' . bin2hex(random_bytes(12));
    $processes = [];
    for ($i = 0; $i < 8; $i++) {
        $pipes = [];
        $process = proc_open(
            [PHP_BINARY, __FILE__, 'consume', $concurrentSubject],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes
        );
        rateTestAssert(is_resource($process), 'Could not start a concurrent limiter process.');
        $processes[] = [$process, $pipes];
    }
    foreach ($processes as [$process, $pipes]) {
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        rateTestAssert($exit === 0 && str_contains($stdout, 'ok'), 'Concurrent limiter process failed: ' . $stderr);
    }
    $concurrent = rateLimitStatus('test_concurrent', $concurrentSubject, 100, 3600);
    rateTestAssert($concurrent['count'] === 8, 'Concurrent increments were lost.');
    rateLimitClear('test_concurrent', $concurrentSubject, 3600);

    $auditSubject = 'audit:' . bin2hex(random_bytes(12));
    $pdo->beginTransaction();
    $auditState = rateLimitConsume('test_audit_dedup', $auditSubject, 1, 300);
    $auditState = rateLimitConsume('test_audit_dedup', $auditSubject, 1, 300);
    rateTestAssert($auditState['limited'], 'Audit test did not reach the block state.');
    rateLimitAuditBlockOnce($auditState);
    rateLimitAuditBlockOnce($auditState);
    $auditCount = $pdo->prepare(
        "SELECT COUNT(*) FROM audit_logs WHERE action = 'rate_limit_blocked' AND target_id = 'test_audit_dedup'"
    );
    $auditCount->execute();
    rateTestAssert((int)$auditCount->fetchColumn() === 1, 'A blocked bucket created duplicate audit records.');
    $pdo->rollBack();
} finally {
    putenv('CAPSTONE_TRUSTED_PROXIES');
    if ($pdo->inTransaction()) $pdo->rollBack();
    rateLimitClear('test_boundary', $subject, 300);
}

echo "API rate-limit tests passed.\n";
