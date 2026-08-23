<?php
declare(strict_types=1);

$scenario = strtolower(trim((string)($argv[1] ?? '')));
if ($scenario !== '') {
    if (!in_array($scenario, ['adviser', 'officer'], true)) exit(2);
    ini_set('session.save_path', sys_get_temp_dir());
    require_once __DIR__ . '/../includes/auth.php';
    $userId = (int)($argv[2] ?? 0);
    $orgId = (int)($argv[3] ?? 0);
    $_SESSION = [
        'user_id' => $userId,
        'naap_session' => [
            'user_id' => $userId,
            'account_type' => $scenario === 'adviser' ? 'organization_adviser' : 'student',
            'login_role' => 'org',
            'active_org_id' => $orgId,
        ],
    ];
    apiRequireOrgManageAccess();
    echo json_encode(['authorized' => true]);
    exit;
}

require_once __DIR__ . '/../config/db.php';
$pdo = getPdo();
$suffix = strtoupper(bin2hex(random_bytes(4)));
$orgId = 0;
$userIds = [];

try {
    $pdo->prepare("INSERT INTO organizations (org_name, org_code, status) VALUES (:name, :code, 'active')")
        ->execute([':name' => "Guard Test {$suffix}", ':code' => "GT{$suffix}"]);
    $orgId = (int)$pdo->lastInsertId();

    $roleIds = [];
    foreach ([['organization_adviser', 0], ['officer', 1]] as [$roleName, $canManage]) {
        $pdo->prepare(
            "INSERT INTO org_roles
                (org_id, role_name, can_access_org_dashboard, can_manage_org_dashboard, is_active)
             VALUES (:org_id, :role_name, 1, :can_manage, 1)"
        )->execute([':org_id' => $orgId, ':role_name' => $roleName, ':can_manage' => $canManage]);
        $roleIds[$roleName] = (int)$pdo->lastInsertId();
    }

    foreach ([['adviser', 'organization_adviser'], ['officer', 'student']] as [$name, $accountType]) {
        $employee = $name === 'adviser' ? "GTA-{$suffix}" : null;
        $student = $name === 'officer' ? "GTO-{$suffix}" : null;
        $pdo->prepare(
            "INSERT INTO users
                (student_number, employee_number, email, password_hash, first_name, last_name, account_type, is_active)
             VALUES (:student, :employee, :email, :password, :first_name, 'Guard', :account_type, 1)"
        )->execute([
            ':student' => $student,
            ':employee' => $employee,
            ':email' => strtolower($name . $suffix) . '@guard-test.invalid',
            ':password' => password_hash('test-password', PASSWORD_DEFAULT),
            ':first_name' => ucfirst($name),
            ':account_type' => $accountType,
        ]);
        $userIds[$name] = (int)$pdo->lastInsertId();
        $roleName = $name === 'adviser' ? 'organization_adviser' : 'officer';
        $pdo->prepare(
            "INSERT INTO organization_members
                (user_id, org_id, role_id, position_title, joined_at, is_active)
             VALUES (:user_id, :org_id, :role_id, :position, CURDATE(), 1)"
        )->execute([
            ':user_id' => $userIds[$name],
            ':org_id' => $orgId,
            ':role_id' => $roleIds[$roleName],
            ':position' => $name === 'adviser' ? 'Organization Adviser' : 'President',
        ]);
    }

    $expectations = [
        'adviser' => '"error_code":"ORG_READ_ONLY"',
        'officer' => '"authorized":true',
    ];
    foreach ($expectations as $name => $needle) {
        $pipes = [];
        $process = proc_open(
            [PHP_BINARY, __FILE__, $name, (string)$userIds[$name], (string)$orgId],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes
        );
        if (!is_resource($process)) throw new RuntimeException("Could not start {$name} guard process.");
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        if ($exitCode !== 0 || !str_contains($stdout, $needle)) {
            throw new RuntimeException("{$name} guard failed: {$stdout}{$stderr}");
        }
        echo "PASS {$name} organization manage guard\n";
    }
} finally {
    if ($orgId > 0) {
        $pdo->prepare('DELETE FROM organizations WHERE org_id = :org_id')->execute([':org_id' => $orgId]);
    }
    foreach ($userIds as $userId) {
        $pdo->prepare('DELETE FROM users WHERE user_id = :user_id')->execute([':user_id' => $userId]);
    }
}
