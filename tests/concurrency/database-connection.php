<?php
/** CLI: php tests/concurrency/database-connection.php [unit-only]
 * Live checks lock two existing organization rows; no data or schema changes.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../../config/db.php';

function dbCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
function dbExpect(callable $operation, string $class): Throwable
{
    try { $operation(); } catch (Throwable $error) {
        dbCheck($error instanceof $class, 'Unexpected exception: ' . $error);
        return $error;
    }
    throw new RuntimeException('Expected exception ' . $class);
}
function dbTestError(int $code, string $state = '40001'): PDOException
{
    $error = new PDOException('Synthetic database error');
    $error->errorInfo = [$state, $code, 'Synthetic database error'];
    return $error;
}
class DbTestPdo extends PDO
{
    public bool $active = false;
    public int $begins = 0;
    public int $commits = 0;
    public int $rollbacks = 0;
    public bool $rollbackFails = false;
    public bool $beginFails = false;
    public bool $commitFails = false;
    public int $errorMode = PDO::ERRMODE_EXCEPTION;
    public ?Throwable $commitError = null;
    public function __construct() {}
    public function getAttribute(int $attribute): mixed { return $this->errorMode; }
    public function inTransaction(): bool { return $this->active; }
    public function beginTransaction(): bool {
        $this->begins++;
        if ($this->beginFails) return false;
        $this->active = true;
        return true;
    }
    public function rollBack(): bool {
        $this->rollbacks++;
        if ($this->rollbackFails) return false;
        $this->active = false;
        return true;
    }
    public function commit(): bool {
        $this->commits++;
        if ($this->commitError) throw $this->commitError;
        if ($this->commitFails) return false;
        $this->active = false;
        return true;
    }
}
function dbSpawn(array $args): array
{
    $process = proc_open([PHP_BINARY, __FILE__, 'worker', json_encode($args, JSON_THROW_ON_ERROR)],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    dbCheck(is_resource($process), 'Could not start worker');
    stream_set_timeout($pipes[1], 15);
    if (trim((string)fgets($pipes[1])) !== 'READY') {
        proc_terminate($process);
        foreach ($pipes as $pipe) fclose($pipe);
        proc_close($process);
        throw new RuntimeException('Worker did not become ready');
    }
    return [$process, $pipes];
}
function dbFinish(array $worker): array
{
    [$process, $pipes] = $worker;
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    if (stream_get_meta_data($pipes[1])['timed_out']) {
        proc_terminate($process);
        fclose($pipes[1]); fclose($pipes[2]); proc_close($process);
        throw new RuntimeException('Worker timed out');
    }
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    dbCheck(proc_close($process) === 0, 'Worker failed: ' . $errors);
    return json_decode($output, true, 512, JSON_THROW_ON_ERROR);
}
if (($argv[1] ?? '') === 'worker') {
    try {
        $args = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
        $pdo = getPdo();
        $attempts = 0;
        if ($args['mode'] === 'timeout') $pdo->exec('SET SESSION innodb_lock_wait_timeout = 1');
        $start = microtime(true);
        try {
            dbRunTransaction($pdo, function (PDO $pdo) use ($args, &$attempts): void {
                $attempts++;
                if ($args['mode'] === 'deadlock') {
                    $pdo->query('SELECT org_id FROM organizations WHERE org_id = ' . (int)$args['first'] . ' FOR UPDATE')->fetch();
                }
                if ($attempts === 1) {
                    echo "READY\n"; flush();
                    dbCheck(trim((string)fgets(STDIN)) === 'GO', 'Missing GO signal');
                }
                $pdo->query('SELECT org_id FROM organizations WHERE org_id = ' . (int)$args['second'] . ' FOR UPDATE')->fetch();
            });
            $code = 0;
        } catch (PDOException $error) { $code = (int)($error->errorInfo[1] ?? 0); }
        echo json_encode(['attempts' => $attempts, 'code' => $code,
            'active' => $pdo->inTransaction(), 'elapsed' => microtime(true) - $start], JSON_THROW_ON_ERROR);
    } catch (Throwable $error) { fwrite(STDERR, (string)$error); exit(1); }
    exit;
}

$setting = 'DB_CONNECTION_TEST_TIMEOUT';
$prior = getenv($setting);
try {
    putenv($setting);
    dbCheck(dbTimeoutSetting($setting, 5) === 5, 'Wrong default');
    foreach (['1', '5', '300'] as $value) {
        putenv($setting . '=' . $value);
        dbCheck(dbTimeoutSetting($setting, 5) === (int)$value, 'Wrong configured timeout');
    }
    foreach (['0', '-1', '301', '999999999999999999999', '1.5', '1e2', ' 5', '5; SELECT 1', 'true'] as $value) {
        putenv($setting . '=' . $value);
        dbExpect(fn() => dbTimeoutSetting($setting, 5), RuntimeException::class);
    }
} finally { putenv($prior === false ? $setting : $setting . '=' . $prior); }
echo "PASS: timeout configuration validation\n";
$pdo = new DbTestPdo();
$calls = 0;
$result = dbRunTransaction($pdo, function () use (&$calls) {
    if (++$calls < 3) throw dbTestError(1213);
    return 'done';
});
dbCheck($result === 'done' && $pdo->begins === 3 && $pdo->rollbacks === 2 && $pdo->commits === 1, 'Retry lifecycle failed');
foreach ([dbTestError(1205, 'HY000'), dbTestError(1062, '23000'), dbTestError(0), new RuntimeException('business conflict')] as $error) {
    $pdo = new DbTestPdo();
    $caught = dbExpect(fn() => dbRunTransaction($pdo, function () use ($error) { throw $error; }), get_class($error));
    dbCheck($caught === $error && $pdo->begins === 1 && $pdo->rollbacks === 1 && !$pdo->active, 'Unsafe failure retried');
}
$pdo = new DbTestPdo();
dbExpect(fn() => dbRunTransaction($pdo, function () { throw dbTestError(1213); }), PDOException::class);
dbCheck($pdo->begins === 3 && $pdo->rollbacks === 3 && $pdo->commits === 0, 'Retry exhaustion failed');
$pdo = new DbTestPdo();
$pdo->commitError = dbTestError(1213);
dbExpect(fn() => dbRunTransaction($pdo, fn() => 'result'), PDOException::class);
dbCheck($pdo->begins === 1 && $pdo->commits === 1 && $pdo->rollbacks === 1, 'Commit failure retried');
$pdo = new DbTestPdo();
$pdo->rollbackFails = true;
dbExpect(fn() => dbRunTransaction($pdo, function () { throw dbTestError(1213); }), RuntimeException::class);
dbCheck($pdo->begins === 1, 'Failed cleanup retried');
$pdo = new DbTestPdo();
$pdo->active = true;
dbExpect(fn() => dbRunTransaction($pdo, fn() => null), LogicException::class);
dbCheck($pdo->active && $pdo->rollbacks === 0, 'Nested guard changed caller transaction');
foreach ([0, 4] as $limit) dbExpect(fn() => dbRunTransaction(new DbTestPdo(), fn() => null, $limit), InvalidArgumentException::class);
$pdo = new DbTestPdo();
dbExpect(fn() => dbRunTransaction($pdo, function (PDO $pdo) { $pdo->rollBack(); }), LogicException::class);
dbCheck($pdo->begins === 1 && $pdo->commits === 0, 'Ended callback transaction accepted');
$pdo = new DbTestPdo();
dbRunTransaction($pdo, function (PDO $pdo) {
    if ($pdo->begins === 1) { $pdo->rollBack(); throw dbTestError(1213); }
});
dbCheck($pdo->begins === 2 && $pdo->commits === 1, 'Already rolled-back deadlock failed');
$pdo = new DbTestPdo();
$pdo->errorMode = PDO::ERRMODE_SILENT;
dbExpect(fn() => dbRunTransaction($pdo, fn() => null), LogicException::class);
dbCheck($pdo->begins === 0, 'Silent error mode accepted');
$pdo = new DbTestPdo();
$pdo->beginFails = true;
$calls = 0;
dbExpect(fn() => dbRunTransaction($pdo, function () use (&$calls) { $calls++; }), RuntimeException::class);
dbCheck($calls === 0 && $pdo->begins === 1, 'Failed begin dispatched callback');
$pdo = new DbTestPdo();
$pdo->commitFails = true;
dbExpect(fn() => dbRunTransaction($pdo, fn() => null), RuntimeException::class);
dbCheck($pdo->begins === 1 && $pdo->rollbacks === 1, 'False commit result accepted or retried');
echo "PASS: bounded retries, cleanup, error propagation, commit and ownership guards\n";
if (($argv[1] ?? '') === 'unit-only') exit;

$pdo = getPdo();
dbCheck($pdo === getPdo(), 'Connection is not a singleton');
$settings = $pdo->query('SELECT @@session.innodb_lock_wait_timeout AS row_timeout, @@session.lock_wait_timeout AS metadata_timeout')->fetch();
dbCheck((int)$settings['row_timeout'] === dbTimeoutSetting('DB_LOCK_WAIT_TIMEOUT', 5), 'Wrong row timeout');
dbCheck((int)$settings['metadata_timeout'] === dbTimeoutSetting('DB_METADATA_LOCK_WAIT_TIMEOUT', 5), 'Wrong metadata timeout');
dbCheck((int)$pdo->getAttribute(PDO::ATTR_ERRMODE) === PDO::ERRMODE_EXCEPTION, 'Error mode changed');
dbCheck(!$pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES), 'Native prepares disabled');
echo "PASS: live connection settings and singleton\n";
$engine = $pdo->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizations'")->fetchColumn();
dbCheck(strcasecmp((string)$engine, 'InnoDB') === 0, 'Live test requires InnoDB organizations');
$ids = $pdo->query('SELECT org_id FROM organizations ORDER BY org_id LIMIT 2')->fetchAll(PDO::FETCH_COLUMN);
dbCheck(count($ids) === 2, 'Live test requires two existing organizations');
$attempts = 0;
$worker = null;
dbRunTransaction($pdo, function (PDO $pdo) use ($ids, &$attempts, &$worker): void {
    $attempts++;
    $pdo->query('SELECT org_id FROM organizations WHERE org_id = ' . (int)$ids[0] . ' FOR UPDATE')->fetch();
    if ($attempts === 1) {
        $worker = dbSpawn(['mode' => 'deadlock', 'first' => $ids[1], 'second' => $ids[0]]);
        fwrite($worker[1][0], "GO\n"); fflush($worker[1][0]);
    }
    $pdo->query('SELECT org_id FROM organizations WHERE org_id = ' . (int)$ids[1] . ' FOR UPDATE')->fetch();
});
$result = dbFinish($worker);
dbCheck($result['code'] === 0 && !$result['active'] && !$pdo->inTransaction(), 'Deadlock recovery failed');
dbCheck($attempts + $result['attempts'] >= 3, 'No real deadlock occurred');
echo "PASS: real two-process deadlock recovered with a complete transaction retry\n";
$pdo->beginTransaction();
try {
    $pdo->query('SELECT org_id FROM organizations WHERE org_id = ' . (int)$ids[0] . ' FOR UPDATE')->fetch();
    $worker = dbSpawn(['mode' => 'timeout', 'second' => $ids[0]]);
    fwrite($worker[1][0], "GO\n"); fflush($worker[1][0]);
    $result = dbFinish($worker);
    dbCheck($result['code'] === 1205 && $result['attempts'] === 1 && !$result['active'], 'Lock timeout was retried or left a transaction open');
    dbCheck($result['elapsed'] >= 0.8 && $result['elapsed'] < 5, 'Unexpected lock timeout duration');
} finally { $pdo->rollBack(); }
echo "PASS: real lock wait bounded, rolled back, and not retried\n";
