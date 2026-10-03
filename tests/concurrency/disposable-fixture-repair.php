<?php
if (PHP_SAPI !== 'cli') exit;
require_once __DIR__ . '/../../config/db.php';
if (!preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', DB_NAME)) throw new RuntimeException('Disposable database required.');
$manifestPath = sys_get_temp_dir() . '/capstone-feature-check-' . substr(hash('sha256', __DIR__), 0, 12) . '.json';
$manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
foreach ($manifest['users'] as $role => $user) getPdo()->prepare('UPDATE users SET email = ? WHERE user_id = ?')->execute([$manifest['token'] . $role . '@example.invalid', $user['id']]);
echo "Fixture email names corrected; identifiers remain within column limits.\n";
