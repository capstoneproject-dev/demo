<?php
/** Run: C:/xampp/php/php.exe tests/concurrency/printing-offline-conflicts.php */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/offline_sync.php';

function printingOfflineCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = getPdo();
$userId = 0;
$orgId = 0;
$operations = [];
$token = 'PO' . bin2hex(random_bytes(6));
try {
    offlineEnsureSchema($pdo);
    $pdo->prepare("INSERT INTO users (first_name, last_name, email, password_hash)
        VALUES ('Printing', 'Offline test', ?, 'unusable-test-hash')")
        ->execute([$token . '@example.invalid']);
    $userId = (int)$pdo->lastInsertId();
    stEnsureSchema($pdo);
    $pdo->prepare('INSERT INTO organizations (org_name, org_code, can_offer_printing) VALUES (?, ?, 1)')->execute([$token, $token]);
    $orgId = (int)$pdo->lastInsertId();
    foreach ([1205, 1213, 'validation', 'unexpected'] as $failure) {
        $hex = bin2hex(random_bytes(16));
        $id = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
            . '-8' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
        $operations[] = $id;
        $envelope = offlineValidateEnvelope(['operation_id' => $id, 'operation_type' => 'student.printing.submit',
            'created_at' => gmdate('c'), 'payload' => []]);
        $hash = offlinePayloadHash($envelope['operation_type'], []);
        printingOfflineCheck(offlineBegin($pdo, $userId, $envelope, $hash) === null, 'Batch claim failed.');
        $files = [['name' => 'A.pdf'], ['name' => 'B.pdf'], ['name' => 'C.pdf']];
        $calls = 0;
        try {
            offlineSubmitPrintingBatch($files, static function (array $file, int $index) use ($pdo, $orgId, $userId, $failure, &$calls): array {
                $calls++;
                if ($index === 1) {
                    if (is_int($failure)) {
                        $error = new PDOException('Sensitive SQL');
                        $error->errorInfo = ['HY000', $failure, 'Sensitive SQL'];
                        throw $error;
                    }
                    if ($failure === 'validation') throw new ServiceTrackerValidationException('Invalid file');
                    throw new RuntimeException('Sensitive internal failure');
                }
                stBeginPrintingTransaction($pdo);
                $order = stGetNextQueueOrder($pdo, $orgId);
                $pdo->prepare('INSERT INTO print_jobs (org_id, user_id, file_name, file_url, queue_order) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$orgId, $userId, $file['name'], 'test/no-upload.pdf', $order]);
                $jobId = (int)$pdo->lastInsertId();
                $result = stFetchPrintJob($pdo, $jobId);
                $pdo->commit();
                return $result;
            });
            throw new RuntimeException('Expected partial batch.');
        } catch (OfflinePrintingPartialException $e) {
            $result = $e->result + ['operation_id' => $id];
            printingOfflineCheck($calls === 2 && $result['count'] === 1, 'Batch did not stop after failure.');
            printingOfflineCheck($result['remaining_files'] === [['index' => 1, 'file_name' => 'B.pdf'], ['index' => 2, 'file_name' => 'C.pdf']], 'Remaining files are incorrect.');
            printingOfflineCheck(!str_contains($result['error'], 'Sensitive'), 'Partial response leaked internals.');
            offlineFinish($pdo, $userId, $id, 'completed', 409, $result);
            for ($retry = 0; $retry < 3; $retry++) {
                $prior = offlineBegin($pdo, $userId, $envelope, $hash);
                printingOfflineCheck($prior['status'] === 409 && $prior['body'] === json_decode(json_encode($result), true), 'Partial receipt changed on replay.');
            }
            $count = $pdo->prepare('SELECT COUNT(*) FROM print_jobs WHERE org_id = ?');
            $count->execute([$orgId]);
            printingOfflineCheck((int)$count->fetchColumn() === 1, 'Replay duplicated committed jobs.');
            $pdo->prepare('DELETE FROM print_jobs WHERE org_id = ?')->execute([$orgId]);
        }
        echo 'Partial batch / ' . $failure . " passed\n";
    }
    $original = new ServiceTrackerConflictException('First file failed');
    try {
        offlineSubmitPrintingBatch([['name' => 'A.pdf']], static function () use ($original): array { throw $original; });
        throw new RuntimeException('Expected first-file failure.');
    } catch (ServiceTrackerConflictException $e) {
        printingOfflineCheck($e === $original, 'First-file failure was converted to partial success.');
    }
    printingOfflineCheck(offlineSubmitPrintingBatch([['name' => 'A.pdf']], static fn() => ['print_job_id' => 1]) === [['print_job_id' => 1]], 'Full success changed.');
    foreach (['printing.accept', 'printing.update_status', 'student.printing.submit'] as $type) {
        foreach (['business', 1205, 1213] as $scenario) {
            $hex = bin2hex(random_bytes(16));
            $id = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
                . '-8' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
            $operations[] = $id;
            $envelope = offlineValidateEnvelope(['operation_id' => $id, 'operation_type' => $type,
                'created_at' => gmdate('c'), 'payload' => ['print_job_id' => 1]]);
            $hash = offlinePayloadHash($type, $envelope['payload']);
            printingOfflineCheck(offlineBegin($pdo, $userId, $envelope, $hash) === null, 'Claim failed.');
            if ($scenario === 'business') {
                $error = new ServiceTrackerConflictException('Request already accepted.');
            } else {
                $error = new PDOException('Sensitive database details');
                $error->errorInfo = ['HY000', $scenario, 'Sensitive database details'];
            }
            printingOfflineCheck(offlineRejectPrintingConflict($pdo, $userId, $envelope, false, $error) === null,
                'Unclaimed operation was finalized.');
            $pdo->beginTransaction();
            $pdo->prepare("UPDATE users SET first_name = 'Should roll back' WHERE user_id = ?")->execute([$userId]);
            $result = offlineRejectPrintingConflict($pdo, $userId, $envelope, true, $error);
            printingOfflineCheck(!$pdo->inTransaction(), 'Transaction left open.');
            $stmt = $pdo->prepare('SELECT first_name FROM users WHERE user_id = ?');
            $stmt->execute([$userId]);
            printingOfflineCheck($stmt->fetchColumn() === 'Printing', 'Business update was not rolled back.');
            printingOfflineCheck($result !== null && $result['error_code'] === 'OFFLINE_CONFLICT', 'Conflict not classified.');
            if ($scenario !== 'business') printingOfflineCheck(!str_contains($result['error'], 'Sensitive'), 'Database details leaked.');
            $prior = offlineBegin($pdo, $userId, $envelope, $hash);
            printingOfflineCheck($prior['status'] === 409 && $prior['body'] === $result, 'Replay remained pending.');
            $stmt = $pdo->prepare('SELECT status, completed_at FROM offline_operations WHERE user_id = ? AND operation_id = ?');
            $stmt->execute([$userId, $id]);
            $row = $stmt->fetch();
            printingOfflineCheck($row['status'] === 'rejected' && $row['completed_at'] !== null, 'Rejection not persisted.');
            echo $type . ' / ' . $scenario . " passed\n";
        }
    }
    foreach (['locker.approve', 'rental.return', 'document.review', 'printing.mark_paid'] as $type) {
        $other = array_merge($envelope, ['operation_type' => $type]);
        printingOfflineCheck(offlineRejectPrintingConflict($pdo, $userId, $other, true,
            new ServiceTrackerConflictException('Conflict')) === null, 'Unrelated operation was changed.');
    }
    printingOfflineCheck(offlineRejectPrintingConflict($pdo, $userId, null, true,
        new ServiceTrackerConflictException('Conflict')) === null, 'Missing envelope accepted.');
    printingOfflineCheck(offlineRejectPrintingConflict($pdo, $userId, $envelope, true,
        new PDOException('Unrelated failure')) === null, 'Unrelated database error misclassified.');
    echo "Scope / missing envelope / unrelated error guards passed\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($orgId) {
        $pdo->prepare('DELETE FROM print_jobs WHERE org_id = ?')->execute([$orgId]);
        $pdo->prepare('DELETE FROM organizations WHERE org_id = ?')->execute([$orgId]);
    }
    foreach ($operations as $id) $pdo->prepare('DELETE FROM offline_operations WHERE user_id = ? AND operation_id = ?')->execute([$userId, $id]);
    if ($userId) $pdo->prepare('DELETE FROM users WHERE user_id = ?')->execute([$userId]);
}
