<?php
/**
 * Database connection configuration.
 * Returns a singleton PDO instance.
 */

require_once __DIR__ . '/environment.php';

define('DB_HOST',    appRuntimeValue('DB_HOST', 'localhost'));
define('DB_PORT',    appRuntimeValue('DB_PORT', '3306'));
define('DB_NAME',    appRuntimeValue('DB_NAME', 'capstone_db'));
define('DB_USER',    appRuntimeValue('DB_USER', 'root'));
define('DB_PASS',    appRuntimeValue('DB_PASS', ''));
define('DB_CHARSET', appRuntimeValue('DB_CHARSET', 'utf8mb4'));

function getPdo(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
