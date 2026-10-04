<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$options=getopt('', ['app-root:', 'backup-dir:', 'org-code:', 'apply', 'verify']);
$appRoot=realpath((string)($options['app-root']??''));
if(!$appRoot || !is_file($appRoot.'/includes/services_tracker.php')) throw new RuntimeException('Provide --app-root pointing to the application directory.');
$backupDir=(string)($options['backup-dir']??'');
if($backupDir==='')throw new RuntimeException('Provide --backup-dir outside the public application directory.');
if(!is_dir($backupDir)&&!mkdir($backupDir,0700,true))throw new RuntimeException('Could not create backup directory.');
$backupDir=realpath($backupDir);
$normalize=static fn(string $path):string=>strtolower(str_replace('\\','/',$path));
if($normalize($backupDir)===$normalize($appRoot)||str_starts_with($normalize($backupDir),$normalize($appRoot).'/'))throw new RuntimeException('Backup directory must be outside the application root.');
if(!is_dir($backupDir.'/sessions'))mkdir($backupDir.'/sessions',0700,true);
ini_set('session.save_path',$backupDir.'/sessions');
require_once $appRoot.'/includes/services_tracker.php';
$pdo=getPdo();
