<?php
/** Run: C:/xampp/php/php.exe tests/concurrency/offline-sync.php
 * Add validation-only to run timezone validation checks without MySQL.
 * Exercises receipt claims on independent MySQL connections, not browser uploads.
 * Uses existing users and removes only receipts bearing this run's random UUIDs.
 */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/offline_sync.php';

function syncCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function syncUuid(): string
{
    $hex = bin2hex(random_bytes(16));
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
        . '-8' . substr($hex, 17, 3) . '-' . substr($hex, 20);
}

function syncThrows(callable $action, string $class): void
{
    try { $action(); } catch (Throwable $e) {
        syncCheck($e instanceof $class, 'Unexpected exception: ' . get_class($e) . ': ' . $e->getMessage());
        return;
    }
    throw new RuntimeException('Expected ' . $class);
}

if (($argv[1] ?? '') === 'worker') {
    try {
        $args = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
        $pdo = getPdo();
        echo "READY\n";
        flush();
        syncCheck(trim((string)fgets(STDIN)) === 'GO', 'Missing start signal.');
        $prior = offlineBegin($pdo, $args['user'], $args['envelope'], $args['hash']);
        if ($prior === null) {
            usleep(150000);
            offlineFinish($pdo, $args['user'], $args['envelope']['operation_id'], 'completed', 200, ['ok' => true, 'marker' => 'one business dispatch']);
        }
        echo json_encode(['claimed' => $prior === null, 'prior' => $prior], JSON_THROW_ON_ERROR);
    } catch (Throwable $e) { fwrite(STDERR, (string)$e); exit(1); }
    exit;
}

// Fixed historical instants keep these checks independent of the future-time guard.
foreach (['+14:01', '-14:01', '+14:30', '-14:30', '+14:59', '-14:59',
    '+15:00', '-15:00', '+23:59', '-23:59', '+24:00', '-24:00',
    '+99:00', '-99:00', '+08:60', '-08:60', '+00:99', '+23:60'] as $offset) {
    syncThrows(fn() => offlineValidateEnvelope([
        'operation_id' => syncUuid(), 'operation_type' => 'attendance.checkin',
        'created_at' => '2020-01-02T12:00:00' . $offset, 'payload' => [],
    ]), OfflineSyncValidationException::class);
}
foreach ([
    '2020-01-02T12:00:00Z' => '2020-01-02 12:00:00',
    '2020-01-02T12:00:00+00:00' => '2020-01-02 12:00:00',
    '2020-01-02T12:00:00+08:00' => '2020-01-02 04:00:00',
    '2020-01-02T12:00:00-05:30' => '2020-01-02 17:30:00',
    '2020-01-02T12:00:00+13:59' => '2020-01-01 22:01:00',
    '2020-01-02T12:00:00-13:59' => '2020-01-03 01:59:00',
    '2020-01-02T12:00:00+14:00' => '2020-01-01 22:00:00',
    '2020-01-02T12:00:00-14:00' => '2020-01-03 02:00:00',
    '2020-01-02T12:00:00.123+08:00' => '2020-01-02 04:00:00',
] as $timestamp => $expectedUtc) {
    $validated = offlineValidateEnvelope([
        'operation_id' => syncUuid(), 'operation_type' => 'attendance.checkin',
        'created_at' => $timestamp, 'payload' => [],
    ]);
    syncCheck($validated['created_at'] === $expectedUtc, 'Incorrect UTC conversion: ' . $timestamp);
}
echo "PASS: timezone offset bounds and valid UTC conversions\n";
if (($argv[1] ?? '') === 'validation-only') exit;

$pdo = getPdo();
offlineCheckSchema($pdo);
$users = $pdo->query('SELECT user_id FROM users ORDER BY user_id LIMIT 2')->fetchAll(PDO::FETCH_COLUMN);
syncCheck(count($users) === 2, 'Two existing users required.');
$user = (int)$users[0];
$ids = [];
$workers = [];
$new = static function (string $type = 'announcement.create') use (&$ids): array {
    $ids[] = syncUuid();
    return offlineValidateEnvelope(['operation_id' => end($ids), 'operation_type' => $type,
        'created_at' => gmdate('c'), 'payload' => ['title' => 'Receipt regression test']]);
};
try {
    $env = $new();
    $hash = offlinePayloadHash($env['operation_type'], $env['payload']);
    for ($i = 0; $i < 8; $i++) {
        $process = proc_open([PHP_BINARY, __FILE__, 'worker', json_encode(['user' => $user, 'envelope' => $env, 'hash' => $hash], JSON_THROW_ON_ERROR)],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        syncCheck(is_resource($process), 'Worker failed to start.');
        $workers[] = [$process, $pipes];
    }
    foreach ($workers as [$process, $pipes]) syncCheck(trim((string)fgets($pipes[1])) === 'READY', 'Worker failed readiness barrier.');
    foreach ($workers as [$process, $pipes]) { fwrite($pipes[0], "GO\n"); fclose($pipes[0]); }
    $claims = 0;
    foreach ($workers as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        syncCheck(proc_close($process) === 0, $error);
        $row = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        $claims += (int)$row['claimed'];
        if (!$row['claimed']) syncCheck(in_array($row['prior']['status'], [200, 202], true), 'Unexpected duplicate result.');
    }
    $workers = [];
    syncCheck($claims === 1, 'Simultaneous retries claimed more than once.');
    for ($i = 0; $i < 5; $i++) syncCheck(offlineBegin($pdo, $user, $env, $hash)['body']['marker'] === 'one business dispatch', 'Completed replay changed.');
    syncThrows(fn() => offlineBegin($pdo, $user, $env, str_repeat('f', 64)), OfflineSyncConflictException::class);
    syncThrows(fn() => offlineFinish($pdo, $user, $env['operation_id'], 'rejected', 422, ['ok' => false]), OfflineSyncReceiptException::class);
    syncCheck(offlineBegin($pdo, (int)$users[1], $env, $hash) === null, 'User IDs are not independent.');
    offlineFinish($pdo, (int)$users[1], $env['operation_id'], 'rejected', 409, ['ok' => false, 'error' => 'test conflict']);
    syncCheck(offlineBegin($pdo, (int)$users[1], $env, $hash)['status'] === 409, 'Rejection not replayed.');
    echo "PASS: eight simultaneous claims, repeated replay, changed content, immutable receipts, user isolation, rejected replay\n";

    $pending = $new();
    syncCheck(offlineBegin($pdo, $user, $pending, $hash) === null, 'Fresh claim failed.');
    syncCheck(offlineBegin($pdo, $user, $pending, $hash)['status'] === 202, 'Processing retry not pending.');
    $pdo->prepare('UPDATE offline_operations SET received_at = CURRENT_TIMESTAMP - INTERVAL 11 MINUTE WHERE user_id = ? AND operation_id = ?')->execute([$user, $pending['operation_id']]);
    syncThrows(fn() => offlineBegin($pdo, $user, $pending, $hash), OfflineSyncConflictException::class);
    // Encoding failure must leave the claim processing, never report false success.
    syncThrows(fn() => offlineFinish($pdo, $user, $pending['operation_id'], 'completed', 200, ['bad' => "\xB1"]), OfflineSyncReceiptException::class);
    offlineFinish($pdo, $user, $pending['operation_id'], 'completed', 200, ['ok' => true]);
    $pdo->prepare("UPDATE offline_operations SET result_json = 'broken' WHERE user_id = ? AND operation_id = ?")->execute([$user, $pending['operation_id']]);
    syncThrows(fn() => offlineBegin($pdo, $user, $pending, $hash), OfflineSyncConflictException::class);
    $pdo->prepare("UPDATE offline_operations SET result_json = '{}' WHERE user_id = ? AND operation_id = ?")->execute([$user, $pending['operation_id']]);
    syncThrows(fn() => offlineBegin($pdo, $user, $pending, $hash), OfflineSyncConflictException::class);
    echo "PASS: pending and interrupted retries, receipt encoding failure, corrupt receipt protection\n";

    $attendance = $new('attendance.checkin');
    $attendance['created_at_iso'] = gmdate('c', time() - 8 * 86400);
    $attendance['created_at'] = gmdate('Y-m-d H:i:s', time() - 8 * 86400);
    syncCheck(offlineBegin($pdo, $user, $attendance, $hash) === null, 'Attendance claim failed.');
    syncThrows(fn() => offlineValidateNewClaim($attendance), OfflineSyncValidationException::class);
    offlineFinish($pdo, $user, $attendance['operation_id'], 'completed', 200, ['ok' => true]);
    syncCheck(offlineBegin($pdo, $user, $attendance, $hash)['status'] === 200, 'Old completed attendance not replayed.');
    $changed = $attendance;
    $changed['created_at'] = gmdate('Y-m-d H:i:s');
    syncThrows(fn() => offlineBegin($pdo, $user, $changed, $hash), OfflineSyncConflictException::class);
    foreach (['', [], null, 'now', '2026-02-30T00:00:00Z'] as $invalid) {
        syncThrows(fn() => offlineValidateEnvelope(['operation_id' => syncUuid(), 'operation_type' => 'attendance.checkin', 'created_at' => $invalid]), OfflineSyncValidationException::class);
    }
    $pdo->beginTransaction();
    syncThrows(fn() => offlineBegin($pdo, $user, $env, $hash), RuntimeException::class);
    syncCheck($pdo->inTransaction(), 'Claim implicitly committed transaction.');
    syncThrows(fn() => offlineFinish($pdo, $user, $env['operation_id'], 'completed', 200, ['ok' => true]), OfflineSyncReceiptException::class);
    $pdo->rollBack();
    echo "PASS: attendance timestamp identity, age validation, envelope validation, transaction guards\n";

    foreach (['inventory.save', 'printing.accept'] as $type) {
        $conflictEnv = $new($type);
        $conflictHash = offlinePayloadHash($type, $conflictEnv['payload']);
        syncCheck(offlineBegin($pdo, $user, $conflictEnv, $conflictHash) === null, 'Conflict claim failed.');
        $pdo->beginTransaction();
        $conflict = $type === 'inventory.save'
            ? offlineRejectIgpConflict($pdo, $user, $conflictEnv, true, new IgpConflictException('test equipment conflict'))
            : offlineRejectPrintingConflict($pdo, $user, $conflictEnv, true, new ServiceTrackerConflictException('test printing conflict'));
        syncCheck(!$pdo->inTransaction(), 'Conflict finalization left a transaction open.');
        $replay = offlineBegin($pdo, $user, $conflictEnv, $conflictHash);
        syncCheck($replay['status'] === 409 && $replay['body'] === $conflict, 'Existing conflict finalization regressed.');
    }
    $partialEnv = $new('student.printing.submit');
    syncCheck(offlineBegin($pdo, $user, $partialEnv, $hash) === null, 'Partial claim failed.');
    $partial = ['ok' => false, 'partial' => true, 'items' => [['print_job_id' => 123]], 'error_code' => 'PRINTING_PARTIAL_SUCCESS'];
    offlineFinish($pdo, $user, $partialEnv['operation_id'], 'completed', 409, $partial);
    syncCheck(offlineBegin($pdo, $user, $partialEnv, $hash)['body'] === $partial, 'Partial receipt replay changed.');
    syncCheck(offlinePayloadHash('inventory.save', ['b' => 2, 'a' => ['d' => 4, 'c' => 3]])
        === offlinePayloadHash('inventory.save', ['a' => ['c' => 3, 'd' => 4], 'b' => 2]), 'Object key order changed identity.');
    syncCheck(offlinePayloadHash('student.printing.submit', [], ['first', 'second'])
        !== offlinePayloadHash('student.printing.submit', [], ['second', 'first']), 'Upload order missing from identity.');
    echo "PASS: equipment and printing conflict compatibility, partial batch replay, canonical payload and upload identity\n";
} finally {
    foreach ($workers as [$process, $pipes]) {
        if (is_resource($process)) proc_terminate($process);
        foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
        if (is_resource($process)) proc_close($process);
    }
    if ($pdo->inTransaction()) $pdo->rollBack();
    $delete = $pdo->prepare('DELETE FROM offline_operations WHERE user_id IN (?, ?) AND operation_id = ?');
    foreach ($ids as $id) $delete->execute([$users[0], $users[1], $id]);
}
