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

/** Timeout values are whole seconds; reject invalid settings rather than disabling limits. */
function dbTimeoutSetting(string $name, int $default): int
{
    $value = appRuntimeValue($name, (string)$default);
    if (!preg_match('/^[1-9][0-9]*$/D', (string)$value)
        || strlen($value) > 3 || (int)$value > 300) {
        throw new RuntimeException($name . ' must be a whole number from 1 to 300 seconds.');
    }
    return (int)$value;
}

function getPdo(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $connectTimeout = dbTimeoutSetting('DB_CONNECT_TIMEOUT', 5);
        $rowLockTimeout = dbTimeoutSetting('DB_LOCK_WAIT_TIMEOUT', 5);
        $metadataLockTimeout = dbTimeoutSetting('DB_METADATA_LOCK_WAIT_TIMEOUT', 5);
        $connection = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            // PDO MySQL uses this for connection establishment, not query execution.
            PDO::ATTR_TIMEOUT           => $connectTimeout,
        ]);
        // Session-only settings leave server defaults and other applications unchanged.
        $connection->exec('SET SESSION innodb_lock_wait_timeout = ' . $rowLockTimeout);
        $connection->exec('SET SESSION lock_wait_timeout = ' . $metadataLockTimeout);
        // Publish only after all initialization succeeds.
        $pdo = $connection;
    }
    return $pdo;
}

/**
 * Opt-in only: the callback must be a replay-safe, database-only InnoDB operation.
 * It must redo all checks/reads on every attempt and must not control transactions,
 * execute DDL, change session settings, or perform file/network/session side effects.
 * Existing workflow transaction owners should not be wrapped by this helper.
 * Retries use the session's isolation level; one-shot SET TRANSACTION is unsuitable.
 * Database errors must escape the callback; do not swallow failed statements.
 * Lock timeouts and commit failures are propagated, never automatically retried.
 */
function dbRunTransaction(PDO $pdo, callable $operation, int $maxAttempts = 3): mixed
{
    if ($maxAttempts < 1 || $maxAttempts > 3) {
        throw new InvalidArgumentException('Transaction attempts must be between 1 and 3.');
    }
    if ($pdo->inTransaction()) {
        throw new LogicException('Transaction retry requires its own transaction.');
    }
    if ((int)$pdo->getAttribute(PDO::ATTR_ERRMODE) !== PDO::ERRMODE_EXCEPTION) {
        throw new LogicException('Transaction retry requires PDO exception error mode.');
    }

    for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
        if (!$pdo->beginTransaction()) {
            throw new RuntimeException('Unable to begin database transaction.');
        }
        try {
            $result = $operation($pdo);
            if (!$pdo->inTransaction()) {
                throw new LogicException('Transaction callback ended its transaction.');
            }
        } catch (Throwable $error) {
            // Deadlocks may already have rolled back; lock timeouts usually have not.
            // If cleanup fails, propagate that failure and do not replay any work.
            if ($pdo->inTransaction()) {
                if (!$pdo->rollBack()) {
                    throw new RuntimeException('Unable to roll back database transaction.', 0, $error);
                }
            }
            $deadlock = $error instanceof PDOException
                && (string)($error->errorInfo[0] ?? '') === '40001'
                && (int)($error->errorInfo[1] ?? 0) === 1213;
            if (!$deadlock || $attempt === $maxAttempts) {
                throw $error;
            }
            // Bounded jitter avoids making competing transactions retry in lockstep.
            usleep(random_int(10000, 30000) * $attempt);
            continue;
        }

        // A lost connection during COMMIT can leave its outcome unknown: never replay.
        try {
            if (!$pdo->commit()) {
                throw new RuntimeException('Unable to commit database transaction.');
            }
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                if (!$pdo->rollBack()) {
                    throw new RuntimeException('Unable to roll back database transaction.', 0, $error);
                }
            }
            throw $error;
        }
        return $result;
    }
    throw new LogicException('Transaction attempt limit exhausted.');
}
