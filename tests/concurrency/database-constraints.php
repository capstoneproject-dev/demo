<?php
/** CLI only: clones the configured database, tests the migration, drops its own copy.
 * Run: C:/xampp/php/php.exe tests/concurrency/database-constraints.php
 * Requires MariaDB mysql/mysqldump clients (MYSQL_BIN_DIR may override XAMPP).
 * Never applies the migration or writes fixtures to the source database.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../includes/services_tracker.php';
require_once __DIR__ . '/../../includes/igp.php';
$testSession = session_id();
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
if ($testSession !== '' && preg_match('/^[a-zA-Z0-9,-]+$/D', $testSession)) {
    $sessionFile = sys_get_temp_dir() . '/sess_' . $testSession;
    if (is_file($sessionFile)) unlink($sessionFile);
}
function constraintsCheck(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
}
function constraintsDuplicate(callable $action): void {
    try { $action(); } catch (PDOException $e) {
        constraintsCheck((int)($e->errorInfo[1] ?? 0) === 1062, 'Expected uniqueness rejection: ' . $e->getMessage());
        return;
    }
    throw new RuntimeException('Conflicting write was accepted.');
}
function constraintsReject(callable $action): void {
    try { $action(); } catch (PDOException $e) {
        constraintsCheck(in_array((int)($e->errorInfo[1] ?? 0), [1644, 4025, 1452], true), 'Unexpected validation rejection: ' . $e->getMessage());
        return;
    }
    throw new RuntimeException('Invalid write was accepted.');
}
function constraintsRental(PDO $pdo, int $org, int $user, int $item, string $status): int {
    $pdo->prepare("INSERT INTO rentals (org_id,renter_user_id,processed_by_user_id,rent_time,expected_return_time,status,service_kind,locker_item_id)
        VALUES (?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL 1 MONTH),?,'locker',?)")->execute([$org, $user, $user, $status, $item]);
    return (int)$pdo->lastInsertId();
}
function constraintsHelperInsert(PDO $pdo, int $org, int $user, int $item): int {
    return stInsertLockerRental($pdo, $item, [':org_id'=>$org, ':user_id'=>$user, ':processed_by_user_id'=>$user,
        ':rent_time'=>'2026-10-03 10:00:00', ':expected_return_time'=>'2026-11-03 10:00:00', ':total_cost'=>50,
        ':status'=>'locker_pending', ':service_kind'=>'locker', ':locker_period_type'=>'monthly', ':locker_period_quantity'=>1]);
}
function constraintsExistingKeys(PDO $pdo): void {
    foreach ([['attendance_records',['event_id','student_number']], ['offline_operations',['user_id','operation_id']],
        ['document_decisions',['submission_id','review_stage']], ['document_versions',['submission_id']],
        ['document_versions',['root_submission_id','version_number']], ['document_versions',['parent_submission_id']],
        ['documents_approved',['submission_id']], ['rental_items',['rental_id','item_id']]] as [$table,$columns]) {
        $query = $pdo->prepare('SELECT index_name,column_name,sub_part FROM information_schema.statistics
            WHERE table_schema=DATABASE() AND table_name=? AND non_unique=0 ORDER BY index_name,seq_in_index');
        $query->execute([$table]); $keys = [];
        foreach ($query as $row) $keys[$row['index_name']][] = $row['sub_part'] === null ? $row['column_name'] : '<prefix>';
        constraintsCheck(in_array($columns, $keys, true), 'Missing full-column business uniqueness: ' . $table . '(' . implode(',', $columns) . ')');
    }
    echo "PASS: eight existing attendance, retry, document and rental-item unique keys.\n";
}
function constraintsFingerprint(PDO $pdo): array {
    $result = [];
    foreach ($pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $quoted = '`' . str_replace('`', '``', $table) . '`';
        $rows = [];
        foreach ($pdo->query('SELECT * FROM ' . $quoted) as $row) $rows[] = hash('sha256', serialize($row));
        sort($rows);
        $result[$table] = [$pdo->query('SHOW CREATE TABLE ' . $quoted)->fetch(PDO::FETCH_NUM)[1], hash('sha256', implode('', $rows))];
    }
    return $result;
}
function constraintsProcess(array $command, array $env, ?string $input = null): array {
    $process = proc_open($command, [0 => $input ? ['file', $input, 'r'] : ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
    constraintsCheck(is_resource($process), 'Cannot start child process.');
    if (!$input) fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    return [proc_close($process), $output, $error];
}
if (($argv[1] ?? '') === 'worker') {
    constraintsCheck(preg_match('/^capstone_constraints_[a-f0-9]{12}$/D', DB_NAME) === 1, 'Worker requires the disposable database.');
    $pdo = getPdo();
    echo "READY\n"; flush();
    constraintsCheck(trim((string)fgets(STDIN)) === 'GO', 'Missing worker signal.');
    try {
        constraintsRental($pdo, (int)$argv[2], (int)$argv[3], (int)$argv[4], 'locker_pending');
        echo "SAVED\n";
    } catch (PDOException $e) { echo (int)($e->errorInfo[1] ?? 0), "\n"; }
    exit;
}
$source = getPdo();
$baseline = constraintsFingerprint($source);
$name = 'capstone_constraints_' . bin2hex(random_bytes(6));
$directory = sys_get_temp_dir() . '/capstone-constraints-' . bin2hex(random_bytes(6));
constraintsCheck(mkdir($directory, 0700), 'Cannot create temporary directory.');
$env = getenv(); $env['MYSQL_PWD'] = DB_PASS;
$bin = rtrim(getenv('MYSQL_BIN_DIR') ?: 'C:/xampp/mysql/bin', '/\\');
$common = ['--host=' . DB_HOST, '--port=' . DB_PORT, '--user=' . DB_USER];
$dump = $directory . '/source.sql';
$created = false; $copy = null; $reader = null;
try {
    [$code, , $error] = constraintsProcess(array_merge([$bin . '/mysqldump'], $common, ['--single-transaction', '--routines', '--triggers', '--skip-events', '--result-file=' . $dump, DB_NAME]), $env);
    constraintsCheck($code === 0, 'Dump failed: ' . $error);
    $source->exec('CREATE DATABASE `' . $name . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); $created = true;
    [$code, , $error] = constraintsProcess(array_merge([$bin . '/mysql'], $common, [$name]), $env, $dump);
    constraintsCheck($code === 0, 'Clone import failed: ' . $error);
    $copy = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $name), DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
    constraintsCheck(constraintsFingerprint($copy) === $baseline, 'Clone differs from source snapshot.');
    constraintsExistingKeys($copy);
    $childEnv = $env; $childEnv['DB_NAME'] = $name;
    [$code, $output, $error] = constraintsProcess([PHP_BINARY, __DIR__ . '/printing-queue.php'], $childEnv);
    echo $output;
    constraintsCheck($code === 0, 'Original-schema printing regression failed: ' . $error);
    echo "PASS: modified printing workflows support the original schema.\n";
    $tables = $copy->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $migration = __DIR__ . '/../../migrations/20261003_business_constraints.sql';
    $fixtureOrg = (int)$copy->query('SELECT org_id FROM inventory_items LIMIT 1')->fetchColumn();
    $fixtureUser = (int)$copy->query('SELECT user_id FROM users WHERE has_unpaid_debt=0 LIMIT 1')->fetchColumn();
    $fixtureItem = (int)$copy->query("SELECT item_id FROM inventory_items WHERE org_id=$fixtureOrg LIMIT 1")->fetchColumn();
    constraintsCheck($fixtureOrg > 0 && $fixtureUser > 0 && $fixtureItem > 0, 'Fixture organization requires inventory.');
    $copy->beginTransaction();
    $legacyId = constraintsHelperInsert($copy, $fixtureOrg, $fixtureUser, $fixtureItem);
    constraintsCheck($legacyId > 0, 'Legacy-schema locker insertion failed.');
    $copy->rollBack();
    echo "PASS: modified locker insert supports the original schema.\n";
    // Link reactivation relies on the original full-column pair uniqueness.
    $copy->exec('ALTER TABLE rental_items DROP INDEX uq_rental_item');
    [$code, , $error] = constraintsProcess(array_merge([$bin . '/mysql'], $common, [$name]), $env, $migration);
    constraintsCheck($code !== 0 && str_contains($error, 'Required unique rental/item pair key is missing'),
        'Preflight accepted a schema without the link upsert key.');
    $copy->exec('DROP PROCEDURE capstone_business_constraints_preflight');
    $copy->exec('ALTER TABLE rental_items ADD UNIQUE KEY uq_rental_item (rental_id,item_id)');
    echo "PASS: preflight refuses a missing rental/item uniqueness prerequisite.\n";
    // A known invalid queue must fail before the first schema alteration.
    $queue = (int)$copy->query("SELECT COALESCE(MAX(queue_order),0)+1 FROM print_jobs WHERE org_id=$fixtureOrg AND status='queued'")->fetchColumn();
    $invalidIds = [];
    for ($i=0;$i<2;$i++) {
        $copy->prepare("INSERT INTO print_jobs (org_id,user_id,file_name,file_url,queue_order) VALUES (?,?,'preflight.pdf','preflight.pdf',?)")
            ->execute([$fixtureOrg,$fixtureUser,$queue]);
        $invalidIds[] = (int)$copy->lastInsertId();
    }
    [$code, , $error] = constraintsProcess(array_merge([$bin . '/mysql'], $common, [$name]), $env, $migration);
    constraintsCheck($code !== 0 && str_contains($error,'Invalid or duplicate queue positions'), 'Preflight did not reject duplicate queue data.');
    constraintsCheck(!(bool)$copy->query("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE()
        AND table_name='rentals' AND column_name='locker_item_id'")->fetchColumn(), 'Failed preflight altered tables.');
    $copy->exec('DROP PROCEDURE capstone_business_constraints_preflight');
    $copy->exec('DELETE FROM print_jobs WHERE print_job_id IN (' . implode(',', $invalidIds) . ')');
    echo "PASS: conflicting data stops migration before table alterations, without deleting records.\n";
    [$code, , $error] = constraintsProcess(array_merge([$bin . '/mysql'], $common, [$name]), $env, $migration);
    constraintsCheck($code === 0, 'Migration failed: ' . $error);
    constraintsCheck($copy->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) === $tables, 'Migration changed table count.');
    echo "PASS: migration applied to matching disposable copy; no new tables.\n";

    $item = $copy->query('SELECT * FROM inventory_items LIMIT 1')->fetch();
    constraintsCheck((bool)$item, 'An existing inventory category/organization is required.');
    $user = (int)$copy->query("SELECT u.user_id FROM users u WHERE u.has_unpaid_debt = 0
        AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.renter_user_id = u.user_id AND r.service_kind='locker'
        AND r.status IN ('locker_pending','locker_active','locker_overdue')) LIMIT 1")->fetchColumn();
    constraintsCheck($user > 0, 'A debt-free user without a current locker is required.');
    $newItem = function () use ($copy, $item): int {
        $copy->prepare('INSERT INTO inventory_items (org_id,item_name,barcode,category_id) VALUES (?,?,?,?)')
            ->execute([$item['org_id'], 'Constraint test', 'constraint-' . bin2hex(random_bytes(8)), $item['category_id']]);
        return (int)$copy->lastInsertId();
    };
    $attach = function (int $rental, int $inventory, float $rate = 0, float $cost = 0) use ($copy): void {
        $copy->prepare('INSERT INTO rental_items (rental_id,item_id,unit_rate,item_cost) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE unit_rate=VALUES(unit_rate),item_cost=VALUES(item_cost)')->execute([$rental, $inventory, $rate, $cost]);
    };
    $inventory = $newItem(); $otherItem = $newItem();
    $newRental = fn(string $status, int $locker = 0): int => constraintsRental($copy, (int)$item['org_id'], $user, $locker ?: $inventory, $status);
    $first = $newRental('locker_pending');
    constraintsCheck((int)$copy->query("SELECT COUNT(*) FROM rental_items WHERE rental_id=$first AND item_id=$inventory AND quantity=1")->fetchColumn() === 1,
        'Direct locker insert did not create its item link.');
    constraintsCheck((int)(stGetActiveLockerRentalByStudent($copy, $user)['rental_id'] ?? 0) === $first,
        'Direct locker insert is invisible to the student reader.');
    constraintsCheck((int)(stGetActiveLockerRentalByItem($copy, $inventory)['rental_id'] ?? 0) === $first,
        'Direct locker insert is invisible to the item reader.');
    $lockerCategory = stGetOrCreateLockerCategoryId($copy, (int)$item['org_id']);
    $copy->exec("UPDATE inventory_items SET category_id=$lockerCategory WHERE item_id=$inventory");
    stSyncLockerStatuses($copy, (int)$item['org_id']);
    constraintsCheck($copy->query("SELECT status FROM inventory_items WHERE item_id=$inventory")->fetchColumn() === 'locker_pending',
        'Synchronization marked a direct pending assignment available.');
    $attach($first, $inventory);
    constraintsDuplicate(fn() => $newRental('locker_active', $otherItem));
    $copy->exec("UPDATE rentals SET status='locker_overdue' WHERE rental_id=$first");
    constraintsDuplicate(fn() => $newRental('locker_pending', $otherItem));
    constraintsReject(fn() => $copy->exec("UPDATE rentals SET locker_item_id=NULL WHERE rental_id=$first"));
    constraintsReject(fn() => $copy->exec("UPDATE rentals SET locker_item_id=$otherItem WHERE rental_id=$first"));
    constraintsReject(fn() => $copy->exec("UPDATE rentals SET service_kind='rental' WHERE rental_id=$first"));
    constraintsReject(fn() => $copy->exec("UPDATE rental_items SET item_id=$otherItem WHERE rental_id=$first"));
    constraintsReject(fn() => $copy->exec("UPDATE rental_items SET quantity=2 WHERE rental_id=$first"));
    constraintsReject(fn() => $copy->exec("DELETE FROM rental_items WHERE rental_id=$first"));
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$first");
    $second = $newRental('locker_active'); $attach($second, $inventory);
    constraintsDuplicate(fn() => $copy->exec("UPDATE rentals SET status='locker_pending' WHERE rental_id=$first"));
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$second");
    $copy->exec("DELETE FROM rental_items WHERE rental_id=$second");
    $copy->exec("UPDATE rentals SET status='locker_active' WHERE rental_id=$second");
    constraintsCheck((int)$copy->query("SELECT COUNT(*) FROM rental_items WHERE rental_id=$second AND item_id=$inventory")->fetchColumn() === 1,
        'Reactivation did not recreate the deleted historical link.');
    constraintsCheck((int)(stGetActiveLockerRentalByStudent($copy, $user)['rental_id'] ?? 0) === $second,
        'Reactivated locker is invisible to the student reader.');
    constraintsCheck((int)(stGetActiveLockerRentalByItem($copy, $inventory)['rental_id'] ?? 0) === $second,
        'Reactivated locker is invisible to the item reader.');
    stSyncLockerStatuses($copy, (int)$item['org_id']);
    constraintsCheck($copy->query("SELECT status FROM inventory_items WHERE item_id=$inventory")->fetchColumn() === 'locker_occupied',
        'Synchronization marked a reactivated assignment available.');
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$second");
    $copy->exec("UPDATE rental_items SET unit_rate=7.5,item_cost=22.5 WHERE rental_id=$second");
    $copy->exec("UPDATE rentals SET status='locker_active' WHERE rental_id=$second");
    $preservedPrice = $copy->query("SELECT unit_rate,item_cost FROM rental_items WHERE rental_id=$second")->fetch();
    constraintsCheck((float)$preservedPrice['unit_rate'] === 7.5 && (float)$preservedPrice['item_cost'] === 22.5,
        'Reactivation overwrote an existing price snapshot.');
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$second");
    try {
        igpDeleteInventoryItem($copy, (int)$item['org_id'], $inventory);
        throw new RuntimeException('Inventory with assignment history was deleted.');
    } catch (IgpValidationException $e) {
        constraintsCheck(str_contains($e->getMessage(), 'history'), 'Unexpected history deletion response.');
    }
    $reader = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $name), DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $reader->beginTransaction();
    $reader->query("SELECT item_id FROM rental_items WHERE rental_id=$second")->fetchColumn();
    $copy->exec("DELETE FROM rental_items WHERE rental_id=$second");
    $reader->exec("UPDATE rentals SET status='locker_active' WHERE rental_id=$second");
    constraintsCheck((int)$reader->query("SELECT COUNT(*) FROM rental_items WHERE rental_id=$second AND item_id=$inventory")->fetchColumn() === 1,
        'Stale child snapshot prevented recreation of a deleted link.');
    $reader->commit(); $reader = null;
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$second");
    $copy->beginTransaction();
    $helperId = constraintsHelperInsert($copy, (int)$item['org_id'], $user, $inventory);
    constraintsCheck((int)$copy->query("SELECT locker_item_id FROM rentals WHERE rental_id=$helperId")->fetchColumn() === $inventory,
        'Modified insert did not save canonical locker identity.');
    $savedPrice = $copy->query("SELECT unit_rate,item_cost FROM rental_items WHERE rental_id=$helperId")->fetch();
    constraintsCheck((float)$savedPrice['unit_rate'] === 50.0 && (float)$savedPrice['item_cost'] === 50.0,
        'Automatic link did not preserve the saved rental price.');
    $attach($helperId, $inventory, 50, 50);
    constraintsCheck((int)$copy->query("SELECT COUNT(*) FROM rental_items WHERE rental_id=$helperId")->fetchColumn() === 1,
        'Application item upsert duplicated the automatic link.');
    $copy->rollBack();
    $blockedItem = $newItem();
    $copy->exec("CREATE TRIGGER test_locker_link_failure BEFORE INSERT ON rental_items FOR EACH ROW
        BEGIN IF NEW.item_id=$blockedItem THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test child failure'; END IF; END");
    constraintsReject(fn() => $newRental('locker_pending', $blockedItem));
    constraintsCheck((int)$copy->query("SELECT COUNT(*) FROM rentals WHERE locker_item_id=$blockedItem")->fetchColumn() === 0,
        'Child failure left an incomplete parent assignment.');
    $copy->exec('DROP TRIGGER test_locker_link_failure');
    $newRental('locker_released', $blockedItem);
    constraintsReject(fn() => $copy->prepare("INSERT INTO rentals (org_id,renter_user_id,processed_by_user_id,rent_time,expected_return_time,status,service_kind)
        VALUES (?,?,?,NOW(),NOW(),'locker_pending','locker')")->execute([$item['org_id'],$user,$user]));
    $differentOrg = (int)$copy->query('SELECT org_id FROM organizations WHERE org_id <> ' . (int)$item['org_id'] . ' LIMIT 1')->fetchColumn();
    constraintsCheck($differentOrg > 0, 'A second organization is required for ownership validation.');
    constraintsReject(fn() => constraintsRental($copy, $differentOrg, $user, $inventory, 'locker_pending'));
    echo "PASS: locker holder uniqueness, history, overdue, immutable identity, matching items and quantity.\n";
    echo "PASS: direct insert/reactivation visibility and synchronization, price snapshots, item upsert and child-failure rollback.\n";

    $otherUser = (int)$copy->query("SELECT user_id FROM users WHERE user_id <> $user AND has_unpaid_debt=0
        AND NOT EXISTS (SELECT 1 FROM rentals r WHERE r.renter_user_id=users.user_id AND r.current_locker_student IS NOT NULL) LIMIT 1")->fetchColumn();
    constraintsCheck($otherUser > 0, 'A second eligible test user is required.');
    $raceItem = $newItem();
    $childEnv = $env; $childEnv['DB_NAME'] = $name;
    $process = proc_open([PHP_BINARY, __FILE__, 'worker', (string)$item['org_id'], (string)$otherUser, (string)$raceItem],
        [0 => ['pipe','r'],1 => ['pipe','w'],2 => ['pipe','w']], $pipes, null, $childEnv);
    constraintsCheck(is_resource($process), 'Cannot start collision worker.');
    try {
        constraintsCheck(trim((string)fgets($pipes[1])) === 'READY', 'Worker not ready.');
        $copy->beginTransaction(); $raceA = $newRental('locker_pending', $raceItem); $attach($raceA, $raceItem);
        fwrite($pipes[0], "GO\n"); fclose($pipes[0]);
        usleep(200000); $copy->commit();
        $output = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]);
        constraintsCheck($output === '1062', 'Concurrent direct claim not rejected: ' . $output . $error);
    } finally {
        if ($copy->inTransaction()) $copy->rollBack();
        foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
        proc_close($process);
    }
    echo "PASS: independent-process direct locker claim collision.\n";

    $reader = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $name), DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $reader->beginTransaction();
    $reader->query("SELECT status FROM rentals WHERE rental_id=$raceA")->fetchColumn();
    $copy->exec("UPDATE rentals SET status='locker_released' WHERE rental_id=$raceA");
    constraintsRental($copy, (int)$item['org_id'], $otherUser, $raceItem, 'locker_active');
    constraintsDuplicate(fn() => $reader->exec("UPDATE rentals SET status='locker_active' WHERE rental_id=$raceA"));
    $reader->commit();
    echo "PASS: stale transaction cannot reclaim an assigned locker.\n";
    // Unlike the first race, these writers share a student but use different lockers.
    $raceItem2 = $newItem(); $raceItem3 = $newItem();
    $process = proc_open([PHP_BINARY, __FILE__, 'worker', (string)$item['org_id'], (string)$user, (string)$raceItem3],
        [0 => ['pipe','r'],1 => ['pipe','w'],2 => ['pipe','w']], $pipes, null, $childEnv);
    constraintsCheck(is_resource($process), 'Cannot start student collision worker.');
    try {
        constraintsCheck(trim((string)fgets($pipes[1])) === 'READY', 'Student worker not ready.');
        $copy->beginTransaction(); $newRental('locker_pending', $raceItem2);
        fwrite($pipes[0], "GO\n"); fclose($pipes[0]);
        usleep(200000); $copy->commit();
        $output = trim(stream_get_contents($pipes[1])); $error = stream_get_contents($pipes[2]);
        constraintsCheck($output === '1062', 'Concurrent same-student claim not rejected: ' . $output . $error);
    } finally {
        if ($copy->inTransaction()) $copy->rollBack();
        foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
        proc_close($process);
    }
    echo "PASS: independent-process same-student/different-locker collision.\n";

    foreach (['database-connection.php','printing-queue.php','printing-offline-conflicts.php','equipment-rentals.php','attendance.php','offline-sync.php'] as $suite) {
        [$code, $output, $error] = constraintsProcess([PHP_BINARY, __DIR__ . '/' . $suite], $childEnv);
        echo $output;
        constraintsCheck($code === 0, $suite . ' failed: ' . $error);
    }
    constraintsExistingKeys($copy);
    constraintsCheck($copy->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) === $tables, 'Regression suites created tables.');
    echo "PASS: all migrated-schema regression suites.\n";
} finally {
    if ($reader && $reader->inTransaction()) $reader->rollBack();
    $reader = null;
    if ($copy && $copy->inTransaction()) $copy->rollBack();
    $copy = null;
    // Only this invocation's random database may be dropped.
    if ($created && $name !== DB_NAME && preg_match('/^capstone_constraints_[a-f0-9]{12}$/D', $name)) {
        $source->exec('DROP DATABASE `' . $name . '`');
        echo "Disposable database removed.\n";
    }
    if (is_file($dump)) unlink($dump);
    rmdir($directory);
    $after = constraintsFingerprint($source);
    $differences = []; $runtimeDifferences = [];
    if (array_keys($after) !== array_keys($baseline)) $differences[] = 'source table list';
    foreach ($baseline as $table => $before) {
        if (($after[$table] ?? null) === $before) continue;
        // Existing dispatch polling can update this singleton while tests run.
        // Never hide schema changes or changes to original business records.
        if ($table === 'notification_email_dispatch_state' && ($after[$table][0] ?? null) === $before[0]) {
            $runtimeDifferences[] = $table;
        } else $differences[] = $table;
    }
    constraintsCheck(!$differences, 'Source data/schema changed during verification: ' . implode(', ', $differences));
    echo $runtimeDifferences
        ? "PASS: source schemas and business data unchanged; runtime dispatch data changed during verification.\n"
        : "PASS: source database data and schema unchanged.\n";
}
