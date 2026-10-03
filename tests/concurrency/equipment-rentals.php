<?php
/** Run: C:/xampp/php/php.exe tests/concurrency/equipment-rentals.php
 * Uses temporary users/items in existing tables and removes them in finally.
 * Separate processes exercise domain services through independent DB connections.
 */
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/igp.php';
require_once __DIR__ . '/../../includes/offline_sync.php';

if (($argv[1] ?? '') === 'worker') {
    $args = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    try {
        $pdo = getPdo();
        // Complete existing schema initialization before the collision barrier.
        stServiceEnabledForOrg($pdo, $args['org'], 'rentals');
        echo "READY\n";
        flush();
        if (trim((string)fgets(STDIN)) !== 'GO') throw new RuntimeException('Missing collision signal.');
        while (microtime(true) < $args['start_at']) usleep(1000);
        switch ($args['action']) {
            case 'student':
                $id = igpCreateStudentRental($pdo, $args['user'], $args['org_code'], $args['name'], 1, $args['scheduled']);
                break;
            case 'officer':
                $id = igpCreateRental($pdo, $args['org'], ['item_id' => $args['item'], 'hours' => 1,
                    'renter_identifier' => $args['number'], 'processor_user_id' => $args['officer']]);
                break;
            case 'return':
                $id = igpReturnRental($pdo, $args['org'], ['rental_id' => $args['rental']])['rental_id'];
                break;
            case 'paid':
                igpMarkRentalPaid($pdo, $args['org'], $args['rental'], $args['officer_number']);
                break;
            case 'cancel':
                igpCancelStudentReservation($pdo, $args['user'], $args['rental']);
                break;
            case 'start':
                igpStartReservedRental($pdo, $args['org'], $args['rental']);
                break;
            case 'no-show':
                igpMarkReservationNoShow($pdo, $args['org'], $args['rental']);
                break;
            case 'expire':
                $id = igpExpireUnfulfilledReservations($pdo, null, $args['user']);
                break;
            case 'edit':
                $id = igpSaveInventoryItem($pdo, $args['org'], $args['inventory']);
                break;
            case 'import':
                $result = igpImportLegacyPayload($pdo, $args['org'], ['rentalRecords' => [$args['legacy']]]);
                echo json_encode(['ok' => $result['rentals']['inserted'] === 1, 'import' => $result]);
                exit;
            default: throw new RuntimeException('Unknown test action.');
        }
        echo json_encode(['ok' => true, 'id' => $id ?? null]);
    } catch (IgpConflictException $e) {
        echo json_encode(['ok' => false, 'conflict' => $e->getMessage()]);
    } catch (Throwable $e) {
        fwrite(STDERR, (string)$e);
        exit(1);
    }
    exit;
}

function rentalCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function rentalCollision(PDO $pdo, array $base, array $actions): array
{
    $workers = [];
    $startAt = microtime(true);
    try {
        foreach ($actions as $action) {
            $args = array_merge($base, $action, ['start_at' => $startAt]);
            $command = [PHP_BINARY, __FILE__, 'worker', json_encode($args, JSON_THROW_ON_ERROR)];
            $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            rentalCheck(is_resource($process), 'Could not start rental worker.');
            $workers[] = [$process, $pipes];
        }
        // Schema initialization must finish before holding inventory locks.
        foreach ($workers as [$process, $pipes]) {
            rentalCheck(trim((string)fgets($pipes[1])) === 'READY', 'Worker did not reach collision barrier.');
        }
        $pdo->beginTransaction();
        $itemIds = [$base['item']];
        foreach ($actions as $action) $itemIds[] = $action['item'] ?? $base['item'];
        $itemIds = array_unique($itemIds);
        sort($itemIds, SORT_NUMERIC);
        $lock = $pdo->prepare('SELECT item_id FROM inventory_items WHERE item_id = ? FOR UPDATE');
        foreach ($itemIds as $itemId) $lock->execute([$itemId]);
        foreach ($workers as [$process, $pipes]) {
            fwrite($pipes[0], "GO\n");
            fclose($pipes[0]);
        }
        usleep(150000);
        $pdo->commit();
    } finally {
        if ($pdo->inTransaction()) $pdo->rollBack();
    }
    $results = [];
    foreach ($workers as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        rentalCheck(proc_close($process) === 0, $error);
        $results[] = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    }
    return $results;
}

$pdo = getPdo();
$officer = $pdo->query("SELECT om.org_id, om.user_id, o.org_code FROM organization_members om
    JOIN org_roles r ON r.role_id = om.role_id JOIN organizations o ON o.org_id = om.org_id
    WHERE om.is_active = 1 AND r.is_active = 1 AND r.can_access_org_dashboard = 1
    AND o.status = 'active' AND o.can_offer_services = 1 ORDER BY om.org_id LIMIT 1")->fetch();
rentalCheck((bool)$officer, 'An active rental organization with an officer is required.');
$orgId = (int)$officer['org_id'];
$users = [];
$extraItemIds = [];
$offlineOperations = [];
$itemId = $categoryId = 0;
$token = 'RT' . bin2hex(random_bytes(6));
$tz = new DateTimeZone('Asia/Manila');
$scheduled = (new DateTimeImmutable('tomorrow', $tz))->setTime(9, 0)->format('Y-m-d H:i:s');
try {
    foreach (['inventory_items', 'rentals', 'rental_items'] as $table) {
        $stmt = $pdo->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $stmt->execute([$table]);
        rentalCheck($stmt->fetchColumn() === 'InnoDB', $table . ' must use InnoDB.');
    }
    for ($i = 0; $i < 2; $i++) {
        $number = $token . $i;
        $pdo->prepare("INSERT INTO users (student_number, first_name, last_name, email, password_hash)
            VALUES (?, 'Rental', 'Concurrency test', ?, 'disabled-test-account')")
            ->execute([$number, $number . '@example.invalid']);
        $users[] = ['user' => (int)$pdo->lastInsertId(), 'number' => $number];
    }
    $pdo->prepare('INSERT INTO inventory_categories (org_id, category_name) VALUES (?, ?)')->execute([$orgId, $token]);
    $categoryId = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO inventory_items (org_id, item_name, barcode, category_id, hourly_rate, image_path)
        VALUES (?, ?, ?, ?, 10, 'assets/photos/studentDashboard/Services/scical.png')")
        ->execute([$orgId, $token, $token, $categoryId]);
    $itemId = (int)$pdo->lastInsertId();
    $inventory = ['item_id' => $itemId, 'item_name' => $token, 'barcode' => $token,
        'category_id' => $categoryId, 'hourly_rate' => 10, 'status' => 'available',
        'image_path' => 'assets/photos/studentDashboard/Services/scical.png'];
    $base = array_merge($users[0], ['org' => $orgId, 'org_code' => $officer['org_code'], 'officer' => (int)$officer['user_id'],
        'item' => $itemId, 'name' => $token, 'scheduled' => $scheduled, 'inventory' => $inventory]);
    $reset = static function () use ($pdo, $itemId, $users): void {
        $pdo->prepare('DELETE FROM rentals WHERE rental_id IN (SELECT rental_id FROM rental_items WHERE item_id = ?)')->execute([$itemId]);
        $pdo->prepare('DELETE FROM rental_items WHERE item_id = ?')->execute([$itemId]);
        $pdo->prepare("UPDATE inventory_items SET status = 'available' WHERE item_id = ?")->execute([$itemId]);
        foreach ($users as $user) $pdo->prepare('UPDATE users SET has_unpaid_debt = 0 WHERE user_id = ?')->execute([$user['user']]);
    };
    $assertOne = static function (array $results, string $label) use ($pdo, $itemId): int {
        rentalCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, $label . ': expected one winner: ' . json_encode($results));
        $stmt = $pdo->prepare("SELECT r.rental_id FROM rentals r JOIN rental_items ri ON ri.rental_id = r.rental_id
            WHERE ri.item_id = ? AND r.status IN ('active', 'reserved')");
        $stmt->execute([$itemId]);
        $rows = $stmt->fetchAll();
        rentalCheck(count($rows) === 1, $label . ': expected exactly one open rental.');
        echo $label . " passed\n";
        return (int)$rows[0]['rental_id'];
    };
    foreach ([['student', 'student'], ['officer', 'officer'], ['student', 'officer']] as $pair) {
        $reset();
        $results = rentalCollision($pdo, $base, [['action' => $pair[0]], array_merge($users[1], ['action' => $pair[1]])]);
        $rid = $assertOne($results, implode(' / ', $pair) . ' claim collision');
        $owner = $pdo->query('SELECT renter_user_id FROM rentals WHERE rental_id = ' . $rid)->fetchColumn();
        $status = $pdo->query('SELECT status FROM rentals WHERE rental_id = ' . $rid)->fetchColumn();
        $action = $status === 'reserved' ? 'cancel' : 'return';
        $results = rentalCollision($pdo, array_merge($base, ['rental' => $rid, 'user' => (int)$owner]), [['action' => $action], ['action' => $action]]);
        rentalCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Duplicate ' . $action . ' must have one winner.');
        rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'available', 'Item must be released.');
        echo 'Duplicate ' . $action . " collision passed\n";
    }
    $reset();
    $rid = igpCreateRental($pdo, $orgId, ['item_id' => $itemId, 'hours' => 1,
        'renter_identifier' => $users[0]['number'], 'processor_user_id' => $base['officer']]);
    $results = rentalCollision($pdo, $base, [['action' => 'edit'], array_merge($users[1], ['action' => 'officer'])]);
    rentalCheck(!$results[0]['ok'] && !$results[1]['ok'], 'An inventory edit must not expose a rented item.');
    echo "Inventory edit cannot reopen rented item passed\n";
    // Existing inconsistent status must not bypass the open-rental check.
    $pdo->prepare("UPDATE inventory_items SET status = 'available' WHERE item_id = ?")->execute([$itemId]);
    $results = rentalCollision($pdo, $base, [['action' => 'student'], array_merge($users[1], ['action' => 'officer'])]);
    rentalCheck(!$results[0]['ok'] && !$results[1]['ok'], 'Open rental must prevent a claim even when inventory status is inconsistent.');
    $pdo->prepare("UPDATE inventory_items SET status = 'rented' WHERE item_id = ?")->execute([$itemId]);
    echo "Open rental blocks inconsistent availability passed\n";
    igpReturnRental($pdo, $orgId, ['rental_id' => $rid]);
    $newRid = igpCreateRental($pdo, $orgId, ['item_id' => $itemId, 'hours' => 1,
        'renter_identifier' => $users[1]['number'], 'processor_user_id' => $base['officer']]);
    try {
        igpReturnRental($pdo, $orgId, ['rental_id' => $rid]);
        throw new RuntimeException('Stale return was accepted.');
    } catch (IgpConflictException $e) {}
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'rented', 'Stale return released new rental.');
    echo "Stale return preserves subsequent rental passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    $pdo->prepare('UPDATE rentals SET rent_time = ?, expected_return_time = ? WHERE rental_id = ?')->execute([
        (new DateTimeImmutable('now', $tz))->modify('+5 minutes')->format('Y-m-d H:i:s'),
        (new DateTimeImmutable('now', $tz))->modify('+65 minutes')->format('Y-m-d H:i:s'), $rid]);
    $results = rentalCollision($pdo, array_merge($base, ['rental' => $rid]), [['action' => 'start'], ['action' => 'no-show']]);
    rentalCheck(count(array_filter($results, static fn($r) => $r['ok'])) === 1, 'Start / no-show must have one winner.');
    echo "Start / no-show collision passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    $pdo->prepare('UPDATE rentals SET expected_return_time = ? WHERE rental_id = ?')->execute([
        (new DateTimeImmutable('now', $tz))->modify('-1 minute')->format('Y-m-d H:i:s'), $rid]);
    $results = rentalCollision($pdo, $base, [['action' => 'expire'], ['action' => 'expire']]);
    rentalCheck(array_sum(array_column($results, 'id')) === 1, 'Expiry must process once.');
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'available', 'Expiry must release inventory.');
    echo "Duplicate expiry collision passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    $pdo->prepare('UPDATE rentals SET expected_return_time = ? WHERE rental_id = ?')->execute([
        (new DateTimeImmutable('now', $tz))->modify('-1 minute')->format('Y-m-d H:i:s'), $rid]);
    $results = rentalCollision($pdo, $base, [['action' => 'expire'], array_merge($users[1], ['action' => 'officer'])]);
    rentalCheck($results[0]['ok'] && $results[0]['id'] === 1, 'Expiry must complete during a competing claim.');
    $state = $pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn();
    rentalCheck($state === ($results[1]['ok'] ? 'rented' : 'available'), 'Expiry overwrote a competing rental.');
    echo "Expiry / fresh claim collision passed\n";
    $reset();
    $legacy = ['itemBarcode' => $token, 'renterId' => $users[0]['number'], 'rentalDate' => $scheduled,
        'dueDate' => (new DateTimeImmutable($scheduled, $tz))->modify('+1 hour')->format('Y-m-d H:i:s'),
        'officerId' => (string)$base['officer'], 'status' => 'active'];
    // Officer verification accepts student/employee identifiers rather than a numeric DB id.
    $officerNumber = $pdo->query('SELECT COALESCE(student_number, employee_number) FROM users WHERE user_id = ' . $base['officer'])->fetchColumn();
    $legacy['officerId'] = $officerNumber;
    $results = rentalCollision($pdo, array_merge($base, ['legacy' => $legacy]), [['action' => 'import'], ['action' => 'officer']]);
    $assertOne($results, 'Legacy import / officer claim collision');
    $reset();
    $results = rentalCollision($pdo, array_merge($base, ['legacy' => $legacy]), [['action' => 'import'], ['action' => 'import']]);
    $assertOne($results, 'Duplicate legacy import collision');
    $reset();
    foreach (['active', 'reserved'] as $badStatus) {
        $badLegacy = array_merge($legacy, ['status' => $badStatus, 'returnDate' => $scheduled]);
        $result = igpImportLegacyPayload($pdo, $orgId, ['rentalRecords' => [$badLegacy]]);
        rentalCheck($result['rentals']['failed'] === 1 && $result['rentals']['inserted'] === 0,
            'Contradictory imported status was accepted.');
    }
    echo "Contradictory import fields rejected passed\n";

    $rid = igpCreateRental($pdo, $orgId, ['item_id' => $itemId, 'hours' => 1,
        'renter_identifier' => $users[0]['number'], 'processor_user_id' => $base['officer']]);
    igpSaveInventoryItem($pdo, $orgId, array_merge($inventory, ['status' => 'maintenance']));
    igpReturnRental($pdo, $orgId, ['rental_id' => $rid]);
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'maintenance',
        'Returning equipment must preserve maintenance.');
    echo "Maintenance edit and return passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    igpSaveInventoryItem($pdo, $orgId, array_merge($inventory, ['status' => 'maintenance']));
    igpCancelStudentReservation($pdo, $users[0]['user'], $rid);
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'maintenance',
        'Cancellation must preserve maintenance.');
    echo "Maintenance reservation cancellation passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    igpSaveInventoryItem($pdo, $orgId, array_merge($inventory, ['status' => 'maintenance']));
    igpMarkReservationNoShow($pdo, $orgId, $rid);
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'maintenance',
        'No-show must preserve maintenance.');
    echo "Maintenance no-show passed\n";
    $reset();
    $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
    $pdo->prepare("UPDATE rentals SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE rental_id = ?")
        ->execute([$rid]);
    igpMarkReservationNoShow($pdo, $orgId, $rid);
    $stmt = $pdo->prepare('SELECT status, payment_status, paid_at, total_cost FROM rentals WHERE rental_id = ?');
    $stmt->execute([$rid]);
    $noShow = $stmt->fetch();
    rentalCheck($noShow['status'] === 'cancelled' && $noShow['payment_status'] === 'unpaid'
        && $noShow['paid_at'] === null && (float)$noShow['total_cost'] === 10.0, 'Paid no-show did not retain unpaid charge.');
    $stmt = $pdo->prepare('SELECT has_unpaid_debt FROM users WHERE user_id = ?');
    $stmt->execute([$users[0]['user']]);
    rentalCheck((int)$stmt->fetchColumn() === 1, 'Paid no-show did not block student for unpaid debt.');
    try {
        igpMarkReservationNoShow($pdo, $orgId, $rid);
        throw new RuntimeException('Repeated no-show was accepted.');
    } catch (IgpConflictException $error) {}
    igpMarkRentalPaid($pdo, $orgId, $rid, $pdo->query('SELECT COALESCE(student_number, employee_number) FROM users WHERE user_id = ' . $base['officer'])->fetchColumn());
    try {
        igpMarkReservationNoShow($pdo, $orgId, $rid);
        throw new RuntimeException('Stale no-show was accepted after payment.');
    } catch (IgpConflictException $error) {}
    $stmt->execute([$users[0]['user']]);
    rentalCheck((int)$stmt->fetchColumn() === 0, 'New payment after no-show did not clear debt.');
    echo "Paid no-show debt, repeat rejection, and repayment passed\n";

    // Exercise the shared handler used by both offline endpoints and its persisted replay.
    $schema = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'offline_operations'")->fetchColumn();
    rentalCheck((int)$schema === 1, 'Existing offline_operations table is required; this test does not add tables.');
    foreach (['student.rental.create', 'inventory.save', 'inventory.delete', 'rental.return', 'rental.mark_paid', 'rental.no_show'] as $type) {
        $hex = bin2hex(random_bytes(16));
        $id = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3) . '-8' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
        $offlineOperations[] = $id;
        $envelope = offlineValidateEnvelope(['operation_id' => $id, 'operation_type' => $type,
            'created_at' => gmdate('c'), 'payload' => ['rental_id' => $rid]]);
        $hash = offlinePayloadHash($type, $envelope['payload']);
        rentalCheck(offlineBegin($pdo, $users[0]['user'], $envelope, $hash) === null, 'Offline claim failed.');
        if ($type === 'inventory.save') {
            $pdo->beginTransaction();
            $pdo->prepare("UPDATE inventory_items SET status = 'maintenance' WHERE item_id = ?")->execute([$itemId]);
        }
        $conflict = offlineRejectIgpConflict($pdo, $users[0]['user'], $envelope, true,
            new IgpConflictException('Equipment state changed.'));
        if ($type === 'inventory.save') {
            rentalCheck(!$pdo->inTransaction(), 'Conflict handling left business transaction open.');
            rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'available',
                'Failed inventory transaction was not rolled back before recording rejection.');
        }
        rentalCheck($conflict !== null && $conflict['error_code'] === 'OFFLINE_CONFLICT', 'Equipment conflict was not recognized.');
        $prior = offlineBegin($pdo, $users[0]['user'], $envelope, $hash);
        rentalCheck($prior['status'] === 409 && $prior['body'] === $conflict, 'Conflict replay remained pending or changed response.');
        $row = $pdo->prepare('SELECT status, completed_at FROM offline_operations WHERE user_id = ? AND operation_id = ?');
        $row->execute([$users[0]['user'], $id]);
        $stored = $row->fetch();
        rentalCheck($stored['status'] === 'rejected' && $stored['completed_at'] !== null, 'Offline conflict was not finalized.');
        foreach ([1205, 1213] as $code) {
            $error = new PDOException('Sensitive database details');
            $error->errorInfo = ['HY000', $code, 'Sensitive database details'];
            $result = offlineRejectIgpConflict($pdo, $users[0]['user'], $envelope, false, $error);
            rentalCheck($result === null, 'Pre-claim database error must remain retryable.');
            $dbEnvelope = array_merge($envelope, ['operation_id' => substr($id, 0, 24) . bin2hex(random_bytes(6))]);
            $offlineOperations[] = $dbEnvelope['operation_id'];
            rentalCheck(offlineBegin($pdo, $users[0]['user'], $dbEnvelope, $hash) === null, 'Database-conflict operation claim failed.');
            $result = offlineRejectIgpConflict($pdo, $users[0]['user'], $dbEnvelope, true, $error);
            rentalCheck($result !== null && !str_contains($result['error'], 'Sensitive'), 'Claimed database conflict was leaked or unrecognized.');
            $replay = offlineBegin($pdo, $users[0]['user'], $dbEnvelope, $hash);
            rentalCheck($replay['status'] === 409 && $replay['body'] === $result, 'Claimed database conflict was not finalized for replay.');
        }
        rentalCheck(offlineRejectIgpConflict($pdo, $users[0]['user'], $envelope, true, new PDOException('Unrelated failure')) === null,
            'Unrelated database failure was classified as an equipment conflict.');
    }
    rentalCheck(offlineRejectIgpConflict($pdo, $users[0]['user'], null, false, new IgpConflictException('Conflict')) === null,
        'Missing envelope must not finalize an operation.');
    $otherEnvelope = array_merge($envelope, ['operation_type' => 'document.review']);
    rentalCheck(offlineRejectIgpConflict($pdo, $users[0]['user'], $otherEnvelope, true, new IgpConflictException('Conflict')) === null,
        'Equipment handling must not alter unrelated operation types.');
    echo "Offline equipment conflicts finalize and replay as 409 passed\n";
    foreach (['maintenance', 'available'] as $inconsistentStatus) {
        $reset();
        $rid = igpCreateStudentRental($pdo, $users[0]['user'], $base['org_code'], $token, 1, $scheduled);
        $pdo->prepare("UPDATE inventory_items SET status = ? WHERE item_id = ?")->execute([$inconsistentStatus, $itemId]);
        $pdo->prepare('UPDATE rentals SET expected_return_time = ? WHERE rental_id = ?')->execute([
            (new DateTimeImmutable('now', $tz))->modify('-1 minute')->format('Y-m-d H:i:s'), $rid]);
        rentalCheck(igpExpireUnfulfilledReservations($pdo, null, $users[0]['user']) === 1, 'Inconsistent expiry failed.');
        rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === $inconsistentStatus,
            'Expiry must preserve maintenance or available status.');
    }
    echo "Expiry tolerates inconsistent inventory passed\n";

    $reset();
    $pdo->prepare("INSERT INTO inventory_items (org_id, item_name, barcode, category_id, hourly_rate, image_path)
        VALUES (?, ?, ?, ?, 10, 'assets/photos/studentDashboard/Services/scical.png')")
        ->execute([$orgId, $token, $token . 'B', $categoryId]);
    $secondItemId = (int)$pdo->lastInsertId();
    $extraItemIds[] = $secondItemId;
    $rid = igpCreateRental($pdo, $orgId, ['item_id' => $itemId, 'hours' => 1,
        'renter_identifier' => $users[0]['number'], 'processor_user_id' => $base['officer']]);
    $pdo->prepare("UPDATE inventory_items SET status = 'available' WHERE item_id = ?")->execute([$itemId]);
    $secondRid = igpCreateStudentRental($pdo, $users[1]['user'], $base['org_code'], $token, 1, $scheduled);
    $stmt = $pdo->prepare('SELECT item_id FROM rental_items WHERE rental_id = ?');
    $stmt->execute([$secondRid]);
    rentalCheck((int)$stmt->fetchColumn() === $secondItemId, 'Student allocation did not skip inconsistent first candidate.');
    echo "Student allocation skips inconsistent candidate passed\n";

    $pdo->prepare("UPDATE inventory_items SET status = 'rented' WHERE item_id = ?")->execute([$itemId]);
    igpReturnRental($pdo, $orgId, ['rental_id' => $rid]);
    $pdo->prepare("UPDATE rentals SET status = 'returned', actual_return_time = expected_return_time WHERE rental_id = ?")->execute([$secondRid]);
    // Both debts belong to the same student, so unrelated rental payments must serialize.
    $pdo->prepare('UPDATE rentals SET renter_user_id = ? WHERE rental_id = ?')->execute([$users[0]['user'], $secondRid]);
    $pdo->prepare('UPDATE users SET has_unpaid_debt = 1 WHERE user_id = ?')->execute([$users[0]['user']]);
    $paymentBase = array_merge($base, ['officer_number' => $officerNumber]);
    $results = rentalCollision($pdo, $paymentBase, [['action' => 'paid', 'rental' => $rid],
        ['action' => 'paid', 'rental' => $secondRid, 'item' => $secondItemId]]);
    rentalCheck($results[0]['ok'] && $results[1]['ok'], 'Both independent payments must succeed.');
    $stmt = $pdo->prepare('SELECT has_unpaid_debt FROM users WHERE user_id = ?');
    $stmt->execute([$users[0]['user']]);
    rentalCheck((int)$stmt->fetchColumn() === 0, 'Concurrent payments left stale debt flag.');
    echo "Concurrent payments clear student debt passed\n";
    // A new unpaid return and another rental's payment must leave the new debt visible.
    $pdo->prepare("UPDATE rentals SET status = 'active', actual_return_time = NULL, payment_status = 'unpaid' WHERE rental_id = ?")
        ->execute([$rid]);
    $pdo->prepare("UPDATE inventory_items SET status = 'rented' WHERE item_id = ?")->execute([$itemId]);
    $pdo->prepare("UPDATE rentals SET payment_status = 'unpaid' WHERE rental_id = ?")->execute([$secondRid]);
    $results = rentalCollision($pdo, $paymentBase, [['action' => 'return', 'rental' => $rid],
        ['action' => 'paid', 'rental' => $secondRid, 'item' => $secondItemId]]);
    rentalCheck($results[0]['ok'] && $results[1]['ok'], 'Return and independent payment must succeed.');
    $stmt->execute([$users[0]['user']]);
    rentalCheck((int)$stmt->fetchColumn() === 1, 'Concurrent return and payment lost new debt.');
    echo "Concurrent return and payment preserve new debt passed\n";

    // Expiring an old reservation must not release another live claimant's equipment.
    $pdo->prepare("UPDATE rentals SET status = 'reserved', payment_status = 'unpaid', actual_return_time = NULL,
        expected_return_time = ? WHERE rental_id = ?")->execute([
            (new DateTimeImmutable('now', $tz))->modify('-1 minute')->format('Y-m-d H:i:s'), $rid]);
    $pdo->prepare("UPDATE rentals SET status = 'active', actual_return_time = NULL WHERE rental_id = ?")->execute([$secondRid]);
    $pdo->prepare('UPDATE rental_items SET item_id = ? WHERE rental_id = ?')->execute([$itemId, $secondRid]);
    $pdo->prepare("UPDATE inventory_items SET status = 'rented' WHERE item_id = ?")->execute([$itemId]);
    rentalCheck(igpExpireUnfulfilledReservations($pdo, null, $users[0]['user']) === 1, 'Shared-item expiry did not complete.');
    rentalCheck($pdo->query('SELECT status FROM inventory_items WHERE item_id = ' . $itemId)->fetchColumn() === 'rented',
        'Expiry released another live claimant.');
    echo "Expiry preserves another live claimant passed\n";

    // New items must not block each other's rental-item insert through index gaps.
    $probeIds = [];
    for ($i = 0; $i < 2; $i++) {
        $pdo->prepare('INSERT INTO inventory_items (org_id, item_name, barcode, category_id) VALUES (?, ?, ?, ?)')
            ->execute([$orgId, $token, $token . 'G' . $i, $categoryId]);
        $probeIds[] = (int)$pdo->lastInsertId();
        $extraItemIds[] = end($probeIds);
    }
    $connections = [];
    try {
        foreach ($probeIds as $i => $probeId) {
            $connection = new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET,
                DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
            $connections[] = $connection;
            $connection->exec('SET SESSION innodb_lock_wait_timeout = 2');
            igpBeginTransaction($connection);
            igpLockRenter($connection, $users[$i]['user']);
            $lock = $connection->prepare('SELECT item_id FROM inventory_items WHERE item_id = ? FOR UPDATE');
            $lock->execute([$probeId]);
            igpAssertItemHasNoOpenRental($connection, $probeId);
        }
        foreach ($connections as $i => $connection) {
            $connection->prepare("INSERT INTO rentals (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time)
                VALUES (?, ?, ?, ?, ?)")->execute([$orgId, $users[$i]['user'], $base['officer'], $scheduled, $scheduled]);
            $connection->prepare('INSERT INTO rental_items (rental_id, item_id, unit_rate, item_cost) VALUES (?, ?, 0, 0)')
                ->execute([(int)$connection->lastInsertId(), $probeIds[$i]]);
        }
        echo "Independent item checks do not gap-lock inserts passed\n";
    } finally {
        foreach ($connections as $connection) if ($connection->inTransaction()) $connection->rollBack();
    }
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($offlineOperations as $operationId) {
        $pdo->prepare('DELETE FROM offline_operations WHERE user_id = ? AND operation_id = ?')->execute([$users[0]['user'], $operationId]);
    }
    foreach (array_merge($extraItemIds, $itemId ? [$itemId] : []) as $cleanupId) {
        $pdo->prepare('DELETE FROM rentals WHERE rental_id IN (SELECT rental_id FROM rental_items WHERE item_id = ?)')->execute([$cleanupId]);
        $pdo->prepare('DELETE FROM rental_items WHERE item_id = ?')->execute([$cleanupId]);
        $pdo->prepare('DELETE FROM inventory_items WHERE item_id = ?')->execute([$cleanupId]);
    }
    if ($categoryId) $pdo->prepare('DELETE FROM inventory_categories WHERE category_id = ?')->execute([$categoryId]);
    foreach ($users as $user) $pdo->prepare('DELETE FROM users WHERE user_id = ?')->execute([$user['user']]);
}
