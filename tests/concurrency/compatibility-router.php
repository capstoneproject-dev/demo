<?php
// Local CLI server only: run with php -S 127.0.0.1:8937 -t . this-file.php.
if (PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) { http_response_code(404); exit; }
$root = dirname(__DIR__, 2);
ini_set('session.save_path', sys_get_temp_dir());
$path = realpath($root . '/' . rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)));
if (!$path || !str_starts_with(strtolower($path), strtolower($root . DIRECTORY_SEPARATOR))) { http_response_code(404); exit; }
if (pathinfo($path, PATHINFO_EXTENSION) !== 'php') return false;
require_once $root . '/config/db.php';
// Reproduce the previous session lock limits without editing application code.
getPdo()->exec('SET SESSION innodb_lock_wait_timeout = @@global.innodb_lock_wait_timeout');
getPdo()->exec('SET SESSION lock_wait_timeout = @@global.lock_wait_timeout');
chdir(dirname($path));
require $path;
