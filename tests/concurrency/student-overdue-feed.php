<?php
// The actual student endpoint runs against connection-local temporary fixtures.
session_set_save_handler(static fn() => true, static fn() => true,
    static fn() => '', static fn() => true, static fn() => true, static fn() => 0);
require_once __DIR__ . '/../../includes/auth.php';
$pdo = getPdo();
$pdo->exec("CREATE TEMPORARY TABLE rentals (rental_id INT PRIMARY KEY, org_id INT, renter_user_id INT,
    processed_by_user_id INT, rent_time DATETIME, expected_return_time DATETIME, actual_return_time DATETIME NULL,
    total_cost DECIMAL(10,2), payment_status VARCHAR(20), paid_at DATETIME NULL, status VARCHAR(30), notes TEXT,
    service_kind VARCHAR(20), locker_period_type VARCHAR(20), locker_period_quantity INT,
    locker_notice_sent_at DATETIME NULL, locker_notice_message TEXT) ENGINE=InnoDB");
$pdo->exec("CREATE TEMPORARY TABLE users (user_id INT, first_name VARCHAR(50), last_name VARCHAR(50)) ENGINE=InnoDB");
$pdo->exec("INSERT INTO users VALUES (1, 'Test', 'Officer')");
$pdo->exec("CREATE TEMPORARY TABLE organizations (org_id INT, org_name VARCHAR(50), org_code VARCHAR(20)) ENGINE=InnoDB");
$pdo->exec("INSERT INTO organizations VALUES (1, 'Test Org', 'TEST')");
$pdo->exec("CREATE TEMPORARY TABLE inventory_items (item_id INT, item_name VARCHAR(50), barcode VARCHAR(20)) ENGINE=InnoDB");
$pdo->exec("INSERT INTO inventory_items VALUES (3, 'Calculator', 'CALC')");
$pdo->exec("CREATE TEMPORARY TABLE rental_items (rental_id INT, item_id INT, quantity INT, unit_rate DECIMAL(10,2),
    item_cost DECIMAL(10,2), overtime_interval_minutes INT, overtime_rate_per_block DECIMAL(10,2)) ENGINE=InnoDB");
$insert = $pdo->prepare("INSERT INTO rentals VALUES (?, 1, ?, 1, '2026-10-01 00:00:00', '2026-10-02 00:00:00', ?, 20,
    'unpaid', NULL, ?, NULL, ?, NULL, NULL, NULL, NULL)");
foreach ([[7, 2, null, 'overdue', 'rental'], [8, 2, '2026-10-03 00:00:00', 'overdue', 'rental'],
    [10, 2, null, 'locker_overdue', 'locker'], [11, 2, null, 'overdue', 'locker'], [12, 99, null, 'overdue', 'rental']] as $row) {
    $insert->execute($row);
    $pdo->prepare('INSERT INTO rental_items VALUES (?, 3, 1, 20, 20, 30, 0)')->execute([$row[0]]);
}
$pdo->exec("CREATE TEMPORARY TABLE audit_logs (target_id VARCHAR(50), action VARCHAR(100), target_type VARCHAR(50),
    result VARCHAR(20), after_state LONGTEXT) ENGINE=InnoDB");
$pdo->prepare("INSERT INTO audit_logs VALUES ('7', 'rental_charge_adjusted', 'rental', 'success', ?)")
    ->execute([json_encode(['adjustment_delta' => -5, 'applies_to_active_rental' => true])]);
startUserSession(['user_id' => 2, 'account_type' => 'student']);
$_SESSION['capstone_security'] = ['version' => CAPSTONE_SESSION_SECURITY_VERSION, 'created_at' => time(), 'last_activity_at' => time()];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = ['status' => $argv[1] ?? 'open'];
ob_start();
register_shutdown_function(static function (): void {
    $response = json_decode(ob_get_clean(), true);
    if (empty($response['ok'])) { fwrite(STDERR, $response['error'] ?? 'Invalid feed response'); exit(1); }
    $rows = array_column($response['items'], null, 'rental_id');
    $ids = array_keys($rows); sort($ids);
    if ($ids !== [7, 10] || $rows[7]['current_total_cost'] != 15 || empty($rows[7]['overtime_pricing_items'])) {
        fwrite(STDERR, 'Open overdue feed, isolation, locker separation, or live adjustment failed.'); exit(1);
    }
    echo "Actual student overdue feed and adjusted quote passed.\n";
});
require __DIR__ . '/../../api/student/rentals/my-rentals.php';
