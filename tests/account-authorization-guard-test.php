<?php
declare(strict_types=1);

$scenario = strtolower(trim((string)($argv[1] ?? '')));

if ($scenario === '') {
    $expected = [
        'anonymous' => '"error":"Not authenticated."',
        'student' => '"error":"You are not authorized to perform this action."',
        'officer' => '"error":"You are not authorized to perform this action."',
        'osa' => '"authorized":true',
    ];
    $failed = false;

    foreach ($expected as $name => $needle) {
        $pipes = [];
        $process = proc_open(
            [PHP_BINARY, __FILE__, $name],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes
        );
        if (!is_resource($process)) {
            fwrite(STDERR, "FAIL {$name}: could not start test process.\n");
            $failed = true;
            continue;
        }

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);

        if ($exitCode !== 0 || !str_contains($stdout, $needle)) {
            fwrite(STDERR, "FAIL {$name}: {$stdout}{$stderr}\n");
            $failed = true;
            continue;
        }

        echo "PASS {$name}\n";
    }

    exit($failed ? 1 : 0);
}

if (!in_array($scenario, ['anonymous', 'student', 'officer', 'osa'], true)) {
    fwrite(STDERR, "Usage: php tests/account-authorization-guard-test.php anonymous|student|officer|osa\n");
    exit(2);
}

ini_set('session.save_path', sys_get_temp_dir());
require_once __DIR__ . '/../includes/auth.php';

$_SESSION = [];

if ($scenario !== 'anonymous') {
    $accountType = $scenario === 'osa' ? 'osa_staff' : 'student';
    if ($scenario === 'officer') {
        $stmt = getPdo()->prepare(
            "SELECT u.user_id
             FROM users u
             JOIN organization_members om
               ON om.user_id = u.user_id
              AND om.is_active = 1
             JOIN org_roles r
               ON r.role_id = om.role_id
              AND r.org_id = om.org_id
              AND r.is_active = 1
              AND r.can_access_org_dashboard = 1
             WHERE u.account_type = 'student'
               AND u.is_active = 1
             ORDER BY u.user_id
             LIMIT 1"
        );
        $stmt->execute();
    } else {
        $stmt = getPdo()->prepare(
            "SELECT user_id
             FROM users
             WHERE account_type = :account_type
               AND is_active = 1
             ORDER BY user_id
             LIMIT 1"
        );
        $stmt->execute([':account_type' => $accountType]);
    }
    $userId = (int)$stmt->fetchColumn();
    if ($userId <= 0) {
        fwrite(STDERR, "No active {$accountType} test account exists.\n");
        exit(2);
    }

    $_SESSION['user_id'] = $userId;
    $_SESSION['naap_session'] = [
        'user_id' => $userId,
        'account_type' => $accountType,
        'login_role' => $scenario === 'osa' ? 'osa' : ($scenario === 'officer' ? 'org' : 'student'),
    ];
}

apiRequireOsaSystemAdministrator();
echo json_encode(['ok' => true, 'authorized' => true, 'scenario' => $scenario]) . PHP_EOL;
