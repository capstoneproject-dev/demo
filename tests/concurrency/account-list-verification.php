<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../../includes/auth.php';
$pdo = getPdo();
$user = $pdo->query("SELECT user_id, account_type, is_primary_osa FROM users WHERE account_type = 'osa_staff' AND is_active = 1 ORDER BY user_id LIMIT 1")->fetch();
if (!$user) throw new RuntimeException('No active OSA account available for the read-only endpoint check.');
// A CLI-only temporary authenticated session exercises the real guards and handler.
// It does not perform a login or modify the account or its presence record.
startUserSession($user);
$_SESSION['capstone_security'] = ['version' => CAPSTONE_SESSION_SECURITY_VERSION, 'created_at' => time(), 'last_activity_at' => time(), 'reauthenticated_at' => time()];
$testSessionId = session_id();
ob_start();
register_shutdown_function(static function () use ($testSessionId): void {
    $body = ob_get_clean();
    $data = json_decode($body, true);
    if (session_status() !== PHP_SESSION_ACTIVE) { session_id($testSessionId); session_start(); }
    session_destroy();
    if (($data['ok'] ?? false) !== true || !isset($data['items']) || !is_array($data['items'])) {
        fwrite(STDERR, 'FAIL: Account list handler: ' . ($data['error'] ?? 'invalid response') . "\n");
        exit(1);
    }
    foreach ($data['items'] as $item) {
        if (!array_key_exists('yearSection', $item) || !is_string($item['yearSection'])) {
            fwrite(STDERR, "FAIL: Invalid yearSection response.\n"); exit(1);
        }
    }
    echo 'PASS: Authenticated account list handler returned ok=true and ' . count($data['items']) . " valid student records (CLI, not browser).\n";
});
chdir(__DIR__ . '/../../api/accounts/students');
require 'list.php';
