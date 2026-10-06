<?php
// Connection-local temporary tables shadow production tables; no real records are changed.
session_set_save_handler(static fn() => true, static fn() => true,
    static fn() => '', static fn() => true, static fn() => true, static fn() => 0);
register_shutdown_function(static function (): void { if (session_status() === PHP_SESSION_ACTIVE) session_destroy(); });
require_once __DIR__ . '/../../includes/otp.php';
require_once __DIR__ . '/../../includes/rental_charges.php';
require_once __DIR__ . '/../../includes/rental_adjustments.php';
$pdo = getPdo();
$pdo->exec("CREATE TEMPORARY TABLE audit_logs (target_id VARCHAR(50), action VARCHAR(100), target_type VARCHAR(50), result VARCHAR(20), after_state LONGTEXT) ENGINE=InnoDB");
$insert = $pdo->prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)');
foreach ([[-80, true, 'success'], [10, true, 'success'], [999, false, 'success'], [999, true, 'failure']] as [$delta, $active, $result]) {
    $insert->execute(['7', 'rental_charge_adjusted', 'rental', $result,
        json_encode(['adjustment_delta' => $delta, 'applies_to_active_rental' => $active])]);
}
if (igpRentalAdjustmentTotals($pdo, [7, 8]) !== [7 => -70.0]) throw new RuntimeException('SQL adjustment ledger filters or sum failed.');
$pdo->exec("CREATE TEMPORARY TABLE email_otp_challenges (
    challenge_id INT PRIMARY KEY, verification_token_hash CHAR(64), purpose VARCHAR(32),
    email VARCHAR(255), identifier VARCHAR(50), verified_at DATETIME,
    verification_expires_at DATETIME, consumed_at DATETIME NULL) ENGINE=InnoDB");
$token = str_repeat('a', 64);
$identifier = osaRentalAdjustmentOtpIdentifier(5, 7, ['revised_amount' => 20, 'expected_amount' => 100, 'reason' => 'Correction']);
$pdo->prepare("INSERT INTO email_otp_challenges VALUES (1, ?, 'osa_rental_adjustment', 'osa@example.com', ?, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE), NULL)")
    ->execute([hashOtpToken($token), $identifier]);
foreach ([['other@example.com', $identifier], ['osa@example.com', 'wrong-details']] as [$email, $binding]) {
    $pdo->beginTransaction();
    try { consumeOtpVerification($pdo, $token, 'osa_rental_adjustment', $email, $binding); throw new RuntimeException('Wrong OTP binding accepted.'); }
    catch (InvalidArgumentException $e) {} finally { $pdo->rollBack(); }
}
$pdo->beginTransaction();
consumeOtpVerification($pdo, $token, 'osa_rental_adjustment', 'osa@example.com', $identifier);
$pdo->rollBack();
$pdo->beginTransaction();
consumeOtpVerification($pdo, $token, 'osa_rental_adjustment', 'osa@example.com', $identifier);
$pdo->commit();
$pdo->beginTransaction();
try { consumeOtpVerification($pdo, $token, 'osa_rental_adjustment', 'osa@example.com', $identifier); throw new RuntimeException('Consumed OTP reused.'); }
catch (InvalidArgumentException $e) {} finally { $pdo->rollBack(); }
echo "Database ledger filtering, OTP binding, atomic rollback, and single-use checks passed.\n";
