<?php
// Run the real save handler using connection-local temporary tables only.
session_set_save_handler(static fn() => true, static fn() => true,
    static fn() => '', static fn() => true, static fn() => true, static fn() => 0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/rental_adjustments.php';
require_once __DIR__ . '/../../includes/rental_charges.php';
require_once __DIR__ . '/../../includes/otp.php';
$mode = $argv[1] ?? 'closed';
if (!in_array($mode, ['closed', 'other-debt', 'open-overdue', 'open-active', 'open-other-debt', 'open-accrued', 'open-paid'], true)) throw new RuntimeException('Unknown test case.');
$open = str_starts_with($mode, 'open-');
$pdo = getPdo();
$pdo->exec("CREATE TEMPORARY TABLE users (user_id INT PRIMARY KEY, account_type VARCHAR(30), is_active INT, is_primary_osa INT, program_id INT NULL, first_name VARCHAR(50), last_name VARCHAR(50), email VARCHAR(255), employee_number VARCHAR(50), has_unpaid_debt INT) ENGINE=InnoDB");
$pdo->exec("INSERT INTO users VALUES (1, 'osa_staff', 1, 1, NULL, 'Test', 'Admin', 'admin@example.com', 'TEST-ADMIN', 0), (2, 'student', 1, 0, NULL, 'Test', 'Student', 'student@example.com', NULL, 1)");
$pdo->exec("CREATE TEMPORARY TABLE rentals (rental_id INT PRIMARY KEY, renter_user_id INT, org_id INT, status VARCHAR(20), payment_status VARCHAR(20), total_cost DECIMAL(10,2), rent_time DATETIME NULL, expected_return_time DATETIME, actual_return_time DATETIME NULL) ENGINE=InnoDB");
$pdo->prepare('INSERT INTO rentals VALUES (7, 2, 1, ?, ?, 100, CURRENT_TIMESTAMP, ?, ?)')->execute([
    $open && $mode !== 'open-overdue' ? 'active' : 'overdue', 'unpaid', '2026-10-01 00:00:00', $open ? null : '2026-10-02 00:00:00']);
if (in_array($mode, ['other-debt', 'open-other-debt'], true)) $pdo->exec("INSERT INTO rentals VALUES (8, 2, 1, 'returned', 'unpaid', 25, CURRENT_TIMESTAMP, '2026-10-01 00:00:00', '2026-10-02 00:00:00')");
$pdo->exec("CREATE TEMPORARY TABLE rental_items (rental_item_id INT, rental_id INT, item_id INT, quantity INT, unit_rate DECIMAL(10,2), item_cost DECIMAL(10,2), overtime_interval_minutes INT, overtime_rate_per_block DECIMAL(10,2)) ENGINE=InnoDB");
$pdo->exec('INSERT INTO rental_items VALUES (1, 7, 3, 1, 100, 100, 30, 0)');
$pdo->exec('CREATE TEMPORARY TABLE inventory_items (item_id INT PRIMARY KEY, org_id INT, status VARCHAR(20)) ENGINE=InnoDB');
$pdo->exec("INSERT INTO inventory_items VALUES (3, 1, 'rented')");
$pdo->exec("CREATE TEMPORARY TABLE audit_logs (audit_id INT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT, actor_name VARCHAR(255), actor_email VARCHAR(255), actor_employee_number VARCHAR(50),
    action VARCHAR(100), target_type VARCHAR(50), target_id VARCHAR(50), target_name VARCHAR(255),
    target_email VARCHAR(255), target_employee_number VARCHAR(50), before_state LONGTEXT, after_state LONGTEXT,
    request_ip VARCHAR(45), user_agent VARCHAR(255), result VARCHAR(20)) ENGINE=InnoDB");
$pdo->exec("CREATE TEMPORARY TABLE email_otp_challenges (challenge_id INT AUTO_INCREMENT PRIMARY KEY,
    challenge_token_hash CHAR(64), verification_token_hash CHAR(64), purpose VARCHAR(32), email VARCHAR(255),
    identifier VARCHAR(50), otp_hash VARCHAR(255), expires_at DATETIME, resend_available_at DATETIME,
    verified_at DATETIME, verification_expires_at DATETIME, consumed_at DATETIME NULL) ENGINE=InnoDB");
$body = ['rental_id' => 7, 'revised_amount' => 0, 'expected_amount' => 100, 'reason' => 'Approved full waiver'];
$token = str_repeat('a', 64);
$pdo->prepare("INSERT INTO email_otp_challenges (challenge_token_hash, verification_token_hash, purpose, email, identifier, otp_hash, expires_at, resend_available_at, verified_at, verification_expires_at)
    VALUES (?, ?, 'osa_rental_adjustment', 'admin@example.com', ?, 'unused', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))")
    ->execute([hashOtpToken(str_repeat('b', 64)), hashOtpToken($token), osaRentalAdjustmentOtpIdentifier(1, 7, $body)]);
startUserSession(['user_id' => 1, 'account_type' => 'osa_staff']);
$_SESSION['capstone_security'] = ['version' => CAPSTONE_SESSION_SECURITY_VERSION,
    'created_at' => time(), 'last_activity_at' => time(), 'reauthenticated_at' => time()];
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = $body + ['verification_token' => $token];
ob_start();
register_shutdown_function(static function () use ($pdo, $mode, $open): void {
    $response = json_decode(ob_get_clean(), true);
    try {
        if (empty($response['ok'])) throw new RuntimeException($response['error'] ?? 'Invalid endpoint response');
        $rental = $pdo->query('SELECT * FROM rentals WHERE rental_id = 7')->fetch();
        if ($rental['payment_status'] !== ($open ? 'unpaid' : 'waived')) throw new RuntimeException('Incorrect waiver payment status');
        if ((float)$rental['total_cost'] !== ($open ? 100.0 : 0.0)) throw new RuntimeException('Original fee or finalized balance was incorrectly changed');
        $hasDebt = (int)$pdo->query('SELECT has_unpaid_debt FROM users WHERE user_id = 2')->fetchColumn();
        $expectedDebt = in_array($mode, ['other-debt', 'open-other-debt', 'open-overdue'], true) ? 1 : 0;
        if ($hasDebt !== $expectedDebt) throw new RuntimeException('Other debt was cleared or waived debt was retained');
        $audit = json_decode($pdo->query("SELECT after_state FROM audit_logs WHERE action = 'rental_charge_adjusted'")->fetchColumn(), true);
        if ($audit['applies_to_active_rental'] !== $open || $audit['payment_status'] !== $rental['payment_status']) throw new RuntimeException('Audit state differs from adjustment');
        if (igpAttachCurrentRentalCharges($pdo, [$rental])[0]['current_total_cost'] !== 0.0) throw new RuntimeException('Approved waiver is not reflected in the quote');
        if ($open) {
            if ($mode === 'open-accrued') {
                $expected = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->modify('-1 minute')->format('Y-m-d H:i:s');
                $pdo->prepare('UPDATE rentals SET expected_return_time = ? WHERE rental_id = 7')->execute([$expected]);
                $pdo->exec('UPDATE rental_items SET overtime_rate_per_block = 5 WHERE rental_id = 7');
            }
            if ($mode === 'open-paid') $pdo->exec("UPDATE rentals SET payment_status = 'paid' WHERE rental_id = 7");
            $result = igpReturnRental($pdo, 1, ['rental_id' => 7]);
            $closed = $pdo->query('SELECT * FROM rentals WHERE rental_id = 7')->fetch();
            $expectedPayment = $mode === 'open-paid' ? 'paid' : ($mode === 'open-accrued' ? 'unpaid' : 'waived');
            $expectedTotal = $mode === 'open-accrued' ? 5.0 : 0.0;
            if ($result['payment_status'] !== $expectedPayment || $closed['payment_status'] !== $expectedPayment
                || (float)$closed['total_cost'] !== $expectedTotal || !$closed['actual_return_time']) throw new RuntimeException('Return did not correctly finalize the balance');
            $expectedFinalDebt = in_array($mode, ['open-other-debt', 'open-accrued'], true) ? 1 : 0;
            if ((int)$pdo->query('SELECT has_unpaid_debt FROM users WHERE user_id = 2')->fetchColumn() !== $expectedFinalDebt) throw new RuntimeException('Incorrect debt flag after return');
            if ($pdo->query('SELECT status FROM inventory_items WHERE item_id = 3')->fetchColumn() !== 'available') throw new RuntimeException('Returned item was not released');
            try { igpReturnRental($pdo, 1, ['rental_id' => 7]); throw new RuntimeException('Duplicate return accepted'); }
            catch (IgpConflictException $e) {}
        }
        echo "Actual save and return handler passed: {$mode}.\n";
    } catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . PHP_EOL); exit(1); }
});
require __DIR__ . '/../../api/osa/rentals/adjust.php';
