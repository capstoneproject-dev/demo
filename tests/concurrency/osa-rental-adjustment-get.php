<?php
// Exercise the real GET handler and its includes against existing read-only data.
// Use an isolated in-memory session; no browser session or account record is changed.
session_set_save_handler(static fn() => true, static fn() => true,
    static fn() => '', static fn() => true, static fn() => true, static fn() => 0);
require_once __DIR__ . '/../../includes/auth.php';
$pdo = getPdo();
$administrator = $pdo->query("SELECT user_id, account_type FROM users WHERE account_type = 'osa_staff' AND is_active = 1 LIMIT 1")->fetch();
$rentalId = isset($argv[1]) ? (int)$argv[1] : (int)$pdo->query('SELECT rental_id FROM rentals ORDER BY rental_id LIMIT 1')->fetchColumn();
if (!$administrator || $rentalId <= 0) throw new RuntimeException('An active administrator and rental are required for this read-only test.');
startUserSession($administrator);
$_SESSION['capstone_security'] = ['version' => CAPSTONE_SESSION_SECURITY_VERSION,
    'created_at' => time(), 'last_activity_at' => time(), 'reauthenticated_at' => time()];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = ['rental_id' => (string)$rentalId];
ob_start();
register_shutdown_function(static function () use ($rentalId): void {
    $response = json_decode(ob_get_clean(), true);
    if (empty($response['ok']) || (int)($response['rental']['rental_id'] ?? 0) !== $rentalId) {
        fwrite(STDERR, 'Adjustment GET failed: ' . ($response['error'] ?? 'Invalid response') . PHP_EOL);
        exit(1);
    }
    if (!function_exists('getUserById')) throw new RuntimeException('User lookup dependency was not loaded.');
    echo "Real adjustment GET handler and user lookup dependency passed.\n";
});
require __DIR__ . '/../../api/osa/rentals/adjust.php';
