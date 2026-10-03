<?php
if (PHP_SAPI !== 'cli') exit;
require_once __DIR__ . '/../../config/db.php';
if (!preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', DB_NAME)) throw new RuntimeException('Disposable database required.');
$control = json_decode(file_get_contents(sys_get_temp_dir() . '/capstone-disposable-control.json'), true, 512, JSON_THROW_ON_ERROR);
if ($control['database'] !== DB_NAME || $control['source'] === DB_NAME) throw new RuntimeException('Database isolation mismatch.');
$source = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, $control['source']), DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$target = getPdo();
$user = $target->prepare('UPDATE users SET is_active = ? WHERE user_id = ?');
foreach ($source->query('SELECT user_id, is_active FROM users') as $row) $user->execute([$row['is_active'], $row['user_id']]);
echo "Original accounts re-enabled in the disposable copy after the deliberate account-import omission test; source only read.\n";
