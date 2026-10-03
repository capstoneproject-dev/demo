<?php
/** Run with: php tests/concurrency/attendance.php (against a disposable test database). */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/qr_attendance.php';

if (in_array($argv[1] ?? '', ['worker', 'checkout'], true)) {
    $startAt = (float)$argv[5];
    while (microtime(true) < $startAt) usleep(1000);
    try {
        $result = $argv[1] === 'checkout'
            ? qrCheckOut(getPdo(), (int)$argv[2], (int)$argv[3], ['record_id' => (int)$argv[4]])
            : qrCheckIn(getPdo(), (int)$argv[2], (int)$argv[3], [
                'event_id' => (int)$argv[4],
                'student_number' => $argv[6],
                'student_name' => 'Concurrency test',
            ]);
        echo json_encode($result, JSON_THROW_ON_ERROR);
    } catch (Throwable $e) {
        fwrite(STDERR, (string)$e);
        exit(1);
    }
    exit;
}

$pdo = getPdo();
$event = $pdo->query(
    "SELECT event_id, org_id, created_by_user_id FROM events WHERE archived_at IS NULL ORDER BY event_id LIMIT 1"
)->fetch();
if (!$event) throw new RuntimeException('An active event is required in the test database.');
$eventId = (int)$event['event_id'];
$orgId = (int)$event['org_id'];
$officerId = (int)$event['created_by_user_id'];
$number = 'AT' . bin2hex(random_bytes(8));

try {
    foreach ([false, true] as $preRegistered) {
        if ($preRegistered) {
            $pdo->prepare(
                "INSERT INTO attendance_records (event_id, student_number, student_name)
                 VALUES (:event_id, :student_number, 'Concurrency test')"
            )->execute([':event_id' => $eventId, ':student_number' => $number]);
        }

        $startAt = microtime(true) + 1;
        $workers = [];
        for ($i = 0; $i < 2; $i++) {
            $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__)
                . ' worker ' . $orgId . ' ' . $officerId . ' ' . $eventId
                . ' ' . $startAt . ' ' . escapeshellarg($number);
            $workers[] = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($workers[$i])) throw new RuntimeException('Could not start check-in worker.');
            $streams[$i] = $pipes;
        }
        $results = [];
        foreach ($workers as $i => $worker) {
            $output = stream_get_contents($streams[$i][1]);
            $error = stream_get_contents($streams[$i][2]);
            fclose($streams[$i][1]);
            fclose($streams[$i][2]);
            if (proc_close($worker) !== 0) throw new RuntimeException($error);
            $results[] = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        }

        $stmt = $pdo->prepare(
            'SELECT record_id, time_in, COUNT(*) AS row_count FROM attendance_records
             WHERE event_id = :event_id AND student_number = :student_number GROUP BY record_id, time_in'
        );
        $stmt->execute([':event_id' => $eventId, ':student_number' => $number]);
        $rows = $stmt->fetchAll();
        $firstScans = count(array_filter($results, static fn($r) => !$r['already_checked_in']));
        if (count($rows) !== 1 || !$rows[0]['time_in'] || $firstScans !== 1
            || (int)$results[0]['record_id'] !== (int)$results[1]['record_id']) {
            throw new RuntimeException('Concurrent check-ins were not idempotent: ' . json_encode($results));
        }
        echo ($preRegistered ? 'Pre-registration' : 'New attendance') . " collision passed\n";

        $startAt = microtime(true) + 1;
        $workers = [];
        $streams = [];
        for ($i = 0; $i < 2; $i++) {
            $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__)
                . ' checkout ' . $orgId . ' ' . $officerId . ' ' . (int)$rows[0]['record_id']
                . ' ' . $startAt;
            $workers[] = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($workers[$i])) throw new RuntimeException('Could not start checkout worker.');
            $streams[$i] = $pipes;
        }
        $checkouts = [];
        foreach ($workers as $i => $worker) {
            $output = stream_get_contents($streams[$i][1]);
            $error = stream_get_contents($streams[$i][2]);
            fclose($streams[$i][1]);
            fclose($streams[$i][2]);
            if (proc_close($worker) !== 0) throw new RuntimeException($error);
            $checkouts[] = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
        }
        $firstCheckouts = count(array_filter($checkouts, static fn($r) => !$r['already_checked_out']));
        $storedTimeOut = $pdo->prepare('SELECT time_out FROM attendance_records WHERE record_id = :record_id');
        $storedTimeOut->execute([':record_id' => $rows[0]['record_id']]);
        if ($firstCheckouts !== 1 || !$storedTimeOut->fetchColumn()) {
            throw new RuntimeException('Concurrent checkouts were not idempotent: ' . json_encode($checkouts));
        }
        echo "Checkout collision passed\n";
        $pdo->prepare('DELETE FROM attendance_records WHERE record_id = :record_id')
            ->execute([':record_id' => $rows[0]['record_id']]);
    }
} finally {
    $pdo->prepare('DELETE FROM attendance_records WHERE event_id = :event_id AND student_number = :student_number')
        ->execute([':event_id' => $eventId, ':student_number' => $number]);
}
