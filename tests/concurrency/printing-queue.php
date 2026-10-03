<?php
/** Run: C:/xampp/php/php.exe tests/concurrency/printing-queue.php
 * Uses temporary rows in existing tables; removes fixtures in finally.
 * Allocation tests exercise the submission allocator and insert on independent connections.
 * Uploaded-file validation and browser routing are outside this CLI test.
 */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/services_tracker.php';

function printingCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function printingInsert(PDO $pdo, int $org, int $user, bool $pending = false): int
{
    stBeginPrintingTransaction($pdo);
    try {
        $order = stGetNextQueueOrder($pdo, $org);
        $pdo->prepare("INSERT INTO print_jobs
            (org_id, user_id, provider_auto_assigned, file_name, file_url, queue_order)
            VALUES (?, ?, ?, 'Printing concurrency test', 'test/no-upload.pdf', ?)")
            ->execute([$org, $user, (int)$pending, $order]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

if (($argv[1] ?? '') === 'worker') {
    try {
        $args = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
        $pdo = getPdo();
        stEnsureSchema($pdo);
        echo "READY\n";
        flush();
        printingCheck(trim((string)fgets(STDIN)) === 'GO', 'Missing collision signal.');
        switch ($args['action']) {
            case 'insert': $id = printingInsert($pdo, $args['org'], $args['user']); break;
            case 'accept': $id = stAcceptPendingPrintJob($pdo, $args['org'], $args['job'], $args['user'])['print_job_id']; break;
            case 'cancel': $id = stCancelStudentPrintJob($pdo, $args['user'], $args['job'])['print_job_id']; break;
            case 'status': $id = stUpdatePrintJobStatus($pdo, $args['org'], $args['job'], 'processing', $args['user'])['print_job_id']; break;
            case 'officer-cancel': $id = stUpdatePrintJobStatus($pdo, $args['org'], $args['job'], 'cancelled', $args['user'], ['expected_version' => $args['version']])['print_job_id']; break;
            case 'reorder': $id = stReorderPrintJob($pdo, $args['org'], $args['job'], $args['position'])['print_job_id']; break;
            default: throw new RuntimeException('Unknown action.');
        }
        echo json_encode(['ok' => true, 'id' => $id], JSON_THROW_ON_ERROR);
    } catch (ServiceTrackerValidationException | ServiceTrackerConflictException $e) {
        echo json_encode(['ok' => false, 'conflict' => $e->getMessage()], JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        fwrite(STDERR, (string)$e);
        exit(1);
    }
    exit;
}

function printingCollision(PDO $pdo, array $lockOrgs, array $actions, ?callable $beforeRelease = null): array
{
    $workers = [];
    try {
        foreach ($actions as $action) {
            $process = proc_open([PHP_BINARY, __FILE__, 'worker', json_encode($action, JSON_THROW_ON_ERROR)],
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            printingCheck(is_resource($process), 'Could not start worker.');
            $workers[] = [$process, $pipes];
        }
        foreach ($workers as [$process, $pipes]) {
            printingCheck(trim((string)fgets($pipes[1])) === 'READY', 'Worker did not reach barrier.');
        }
        stBeginPrintingTransaction($pdo);
        stLockPrintingQueues($pdo, $lockOrgs);
        foreach ($workers as [$process, $pipes]) {
            fwrite($pipes[0], "GO\n");
            fclose($pipes[0]);
        }
        usleep(200000);
        if ($beforeRelease) $beforeRelease();
        $pdo->commit();
        $results = [];
        foreach ($workers as [$process, $pipes]) {
            $output = stream_get_contents($pipes[1]);
            $error = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            printingCheck(proc_close($process) === 0, 'Worker failed: ' . $error);
            $results[] = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        }
        return $results;
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($workers as [$process, $pipes]) {
            if (is_resource($process)) { proc_terminate($process); proc_close($process); }
            foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
        }
    }
}

function printingQueueCheck(PDO $pdo, int $org, bool $contiguous = true): array
{
    $stmt = $pdo->prepare("SELECT print_job_id, queue_order FROM print_jobs
        WHERE org_id = ? AND status = 'queued'
        ORDER BY queue_order, submitted_at, print_job_id");
    $stmt->execute([$org]);
    $rows = $stmt->fetchAll();
    $orders = array_map('intval', array_column($rows, 'queue_order'));
    printingCheck(count(array_unique($orders)) === count($orders), 'Duplicate queue orders.');
    if ($contiguous && $orders) printingCheck($orders === range(1, count($orders)), 'Queue is not contiguous.');
    return array_map('intval', array_column($rows, 'print_job_id'));
}

$pdo = getPdo();
stEnsureSchema($pdo);
$orgs = [];
$users = [];
$token = 'PQ' . bin2hex(random_bytes(6));
try {
    $engines = $pdo->query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('organizations', 'print_jobs')")->fetchAll();
    printingCheck(count($engines) === 2, 'Required printing tables are missing.');
    foreach ($engines as $table) printingCheck(strtoupper($table['ENGINE']) === 'INNODB', 'Printing tables must use InnoDB.');
    for ($i = 0; $i < 3; $i++) {
        $pdo->prepare('INSERT INTO organizations (org_name, org_code, can_offer_printing) VALUES (?, ?, 1)')
            ->execute([$token . $i, $token . $i]);
        $orgs[] = (int)$pdo->lastInsertId();
    }
    for ($i = 0; $i < 2; $i++) {
        $pdo->prepare("INSERT INTO users (first_name, last_name, email, password_hash, student_number)
            VALUES ('Printing', 'Concurrency', ?, 'unusable-test-hash', ?)")
            ->execute([$token . $i . '@example.invalid', $token . $i]);
        $users[] = (int)$pdo->lastInsertId();
    }
    $reset = static function () use ($pdo, $orgs): void {
        foreach ($orgs as $org) $pdo->prepare('DELETE FROM print_jobs WHERE org_id = ?')->execute([$org]);
    };
    $action = static fn(string $name, int $org, int $job = 0, int $user = 0, int $position = 1): array =>
        ['action' => $name, 'org' => $org, 'job' => $job, 'user' => $user ?: $users[0], 'position' => $position];
    $allOk = static function (array $results, string $label): void {
        printingCheck(count(array_filter($results, static fn($r) => $r['ok'])) === count($results), $label . ': ' . json_encode($results));
        echo $label . " passed\n";
    };
    foreach ([0, 1] as $preload) {
        $reset();
        if ($preload) printingInsert($pdo, $orgs[0], $users[0]);
        $actions = [];
        for ($i = 0; $i < 10; $i++) $actions[] = $action('insert', $orgs[0], 0, $users[$i % 2]);
        $allOk(printingCollision($pdo, [$orgs[0]], $actions), 'Ten allocations / ' . ($preload ? 'existing' : 'empty') . ' queue');
        printingCheck(count(printingQueueCheck($pdo, $orgs[0])) === 10 + $preload, 'Missing allocation.');
    }
    $reset();
    $allOk(printingCollision($pdo, $orgs, [$action('insert', $orgs[0]), $action('insert', $orgs[1])]), 'Independent empty providers');
    foreach ([$orgs[0], $orgs[1]] as $org) printingQueueCheck($pdo, $org);

    $reset();
    $pending = printingInsert($pdo, $orgs[0], $users[0], true);
    $results = printingCollision($pdo, $orgs, [$action('accept', $orgs[1], $pending), $action('accept', $orgs[2], $pending)]);
    printingCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Competing acceptances need exactly one winner.');
    $job = stFetchPrintJob($pdo, $pending);
    printingCheck(!$job['provider_auto_assigned'] && in_array($job['org_id'], [$orgs[1], $orgs[2]], true), 'Acceptance was not persisted.');
    foreach ($orgs as $org) printingQueueCheck($pdo, $org);
    echo "Competing organizations / one request passed\n";

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0], true);
    $b = printingInsert($pdo, $orgs[0], $users[1], true);
    $allOk(printingCollision($pdo, $orgs, [$action('accept', $orgs[1], $a), $action('accept', $orgs[1], $b), $action('insert', $orgs[1])]), 'Acceptance / acceptance / allocation');
    printingCheck(count(printingQueueCheck($pdo, $orgs[1])) === 3, 'Missing accepted job.');
    printingQueueCheck($pdo, $orgs[0]);

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0], true);
    $b = printingInsert($pdo, $orgs[1], $users[1], true);
    $allOk(printingCollision($pdo, $orgs, [$action('accept', $orgs[1], $a), $action('accept', $orgs[0], $b)]), 'Opposite provider transfers');
    foreach ($orgs as $org) printingQueueCheck($pdo, $org);

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0], true);
    $b = printingInsert($pdo, $orgs[0], $users[0]);
    stAcceptPendingPrintJob($pdo, $orgs[0], $a, $users[0]);
    printingCheck(printingQueueCheck($pdo, $orgs[0]) === [$b, $a], 'Same-provider acceptance must append once.');
    echo "Same-provider acceptance passed\n";

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0], true);
    $before = stFetchPrintJob($pdo, $a)['state_version'];
    stAcceptPendingPrintJob($pdo, $orgs[0], $a, $users[0]);
    foreach ([$before, null, [], 'invalid'] as $version) {
        try {
            stUpdatePrintJobStatus($pdo, $orgs[0], $a, 'cancelled', $users[1], ['expected_version' => $version]);
            throw new RuntimeException('Stale or invalid cancellation was accepted.');
        } catch (ServiceTrackerConflictException $e) {}
        printingCheck(stFetchPrintJob($pdo, $a)['status'] === 'queued', 'Accepted job was cancelled by stale action.');
    }
    $acceptedVersion = stFetchPrintJob($pdo, $a)['state_version'];
    stUpdatePrintJobStatus($pdo, $orgs[0], $a, 'processing', $users[0]);
    try {
        stUpdatePrintJobStatus($pdo, $orgs[0], $a, 'cancelled', $users[1], ['expected_version' => $acceptedVersion]);
        throw new RuntimeException('Processing was overwritten by stale cancellation.');
    } catch (ServiceTrackerConflictException $e) {}
    try {
        stUpdatePrintJobStatus($pdo, $orgs[1], $a, 'cancelled', $users[1], ['expected_version' => stFetchPrintJob($pdo, $a)['state_version']]);
        throw new RuntimeException('Other provider cancelled the job.');
    } catch (ServiceTrackerAuthorizationException $e) {}
    $freshVersion = stFetchPrintJob($pdo, $a)['state_version'];
    $actions = [array_merge($action('officer-cancel', $orgs[0], $a), ['version' => $freshVersion]),
        array_merge($action('officer-cancel', $orgs[0], $a, $users[1]), ['version' => $freshVersion])];
    $results = printingCollision($pdo, [$orgs[0]], $actions);
    printingCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Fresh concurrent officer cancellations require one winner.');
    printingCheck(stFetchPrintJob($pdo, $a)['status'] === 'cancelled', 'Refreshed cancellation did not succeed.');
    echo "Officer stale acceptance/processing, invalid versions, provider authorization, and fresh cancellation collision passed\n";

    foreach (['cancel', 'status', 'reorder'] as $operation) {
        $reset();
        $a = printingInsert($pdo, $orgs[0], $users[0]);
        $b = printingInsert($pdo, $orgs[0], $users[0]);
        $allOk(printingCollision($pdo, [$orgs[0]], [$action($operation, $orgs[0], $a, 0, 2), $action('insert', $orgs[0])]), $operation . ' / allocation');
        $queue = printingQueueCheck($pdo, $orgs[0]);
        if ($operation === 'reorder') printingCheck($queue[0] === $b, 'Reorder lost the requested first job.');
        else printingCheck(!in_array($a, $queue, true), 'Removed job remains queued.');
    }
    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0]);
    $results = printingCollision($pdo, [$orgs[0]], [$action('cancel', $orgs[0], $a), $action('status', $orgs[0], $a)]);
    printingCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Cancel / processing needs exactly one winner.');
    printingCheck(in_array(stFetchPrintJob($pdo, $a)['status'], ['cancelled', 'processing'], true), 'Unexpected status.');
    echo "Cancellation / processing passed\n";

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0]);
    $results = printingCollision($pdo, [$orgs[0]], [$action('cancel', $orgs[0], $a)],
        static function () use ($pdo, $a): void {
            $pdo->prepare("UPDATE print_jobs SET status = 'processing' WHERE print_job_id = ?")->execute([$a]);
        });
    printingCheck(!$results[0]['ok'] && stFetchPrintJob($pdo, $a)['status'] === 'processing', 'Stale cancellation overwrote processing.');
    echo "Stale cancellation after locked status change passed\n";

    $reset();
    $a = printingInsert($pdo, $orgs[0], $users[0], true);
    $results = printingCollision($pdo, $orgs, [$action('accept', $orgs[1], $a), $action('accept', $orgs[1], $a)]);
    printingCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Duplicate acceptance must have one winner.');
    printingQueueCheck($pdo, $orgs[1]);
    echo "Duplicate acceptance / same provider passed\n";

    $reset();
    $ids = [];
    for ($i = 0; $i < 3; $i++) $ids[] = printingInsert($pdo, $orgs[0], $users[0]);
    $allOk(printingCollision($pdo, [$orgs[0]], [$action('reorder', $orgs[0], $ids[0], 0, 3), $action('reorder', $orgs[0], $ids[2], 0, 1)]), 'Concurrent reorders');
    printingCheck(printingQueueCheck($pdo, $orgs[0]) === [$ids[2], $ids[1], $ids[0]], 'Reorder result is not serializable.');

    // Legacy ties are resolved by timestamp and primary key.
    $pdo->prepare("UPDATE print_jobs SET queue_order = 1, submitted_at = '2026-01-01 00:00:00' WHERE org_id = ?")->execute([$orgs[0]]);
    stBeginPrintingTransaction($pdo);
    stNormalizeQueuedOrders($pdo, $orgs[0]);
    $pdo->commit();
    printingCheck(printingQueueCheck($pdo, $orgs[0]) === $ids, 'Tie ordering is not deterministic.');
    echo "Deterministic ties passed\n";

    $reader = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET),
        DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    try {
        $reader->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $reader->beginTransaction();
        $reader->query('SELECT COUNT(*) FROM print_jobs')->fetchColumn();
        printingInsert($pdo, $orgs[0], $users[0]);
        printingCheck(stGetNextQueueOrder($reader, $orgs[0]) === 5, 'Allocation used a stale transaction snapshot.');
    } finally {
        if ($reader->inTransaction()) $reader->rollBack();
    }
    echo "Current queue read after earlier snapshot passed\n";

    stBeginPrintingTransaction($pdo);
    $pdo->prepare('UPDATE print_jobs SET queue_order = 2147483647 WHERE print_job_id = ?')->execute([$ids[0]]);
    try {
        stGetNextQueueOrder($pdo, $orgs[0]);
        throw new RuntimeException('Queue overflow was accepted.');
    } catch (ServiceTrackerValidationException $e) {
        $pdo->rollBack();
    }
    printingQueueCheck($pdo, $orgs[0]);
    try {
        stGetNextQueueOrder($pdo, $orgs[0]);
        throw new RuntimeException('Allocator allowed a missing transaction.');
    } catch (LogicException $e) {}
    foreach ([1205, 1213, 1062] as $code) {
        $e = new PDOException('Test error');
        $e->errorInfo = ['HY000', $code, 'Test error'];
        printingCheck(stIsPrintingConcurrencyError($e) === ($code !== 1062), 'Incorrect concurrency error classification.');
    }
    echo "Overflow / transaction guard / conflict classification passed\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($orgs as $org) {
        $pdo->prepare('DELETE FROM print_jobs WHERE org_id = ?')->execute([$org]);
        $pdo->prepare('DELETE FROM organizations WHERE org_id = ?')->execute([$org]);
    }
    foreach ($users as $user) $pdo->prepare('DELETE FROM users WHERE user_id = ?')->execute([$user]);
}
