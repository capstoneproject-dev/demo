<?php
// Serve only the isolated app copy, using its disposable database and storage.
if (PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) { http_response_code(404); exit; }
$root = dirname(__DIR__, 2);
require_once $root . '/config/db.php';
if (!preg_match('/^capstone_disposable_[a-f0-9]{12}$/D', DB_NAME)) throw new RuntimeException('Disposable database required.');
ini_set('session.save_path', sys_get_temp_dir());
$route = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (!str_starts_with($route, '/CAPSTONE/demo/')) { http_response_code(404); exit; }
$relative = substr($route, strlen('/CAPSTONE/demo/'));
$rewrites = ['' => 'pages/login.html', 'student/' => 'pages/studentDashboard.html', 'officer/' => 'pages/officerDashboard.html', 'osa/' => 'pages/osaDashboard.html'];
$path = realpath($root . '/' . ($rewrites[$relative] ?? $relative));
if ($path && is_dir($path)) $path = realpath($path . (is_file($path . '/index.php') ? '/index.php' : '/index.html'));
if (!$path || !str_starts_with(strtolower($path), strtolower($root . DIRECTORY_SEPARATOR))) { http_response_code(404); exit; }
if (pathinfo($path, PATHINFO_EXTENSION) === 'php') { chdir(dirname($path)); require $path; return; }
$types = ['js' => 'text/javascript', 'css' => 'text/css', 'json' => 'application/json', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'mp3' => 'audio/mpeg', 'webmanifest' => 'application/manifest+json', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2', 'woff' => 'font/woff', 'html' => 'text/html'];
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!isset($types[$extension])) { http_response_code(404); exit; }
header('Content-Type: ' . $types[$extension]); readfile($path);
