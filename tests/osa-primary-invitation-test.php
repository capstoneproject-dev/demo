<?php
declare(strict_types=1);

$scenario = (string)($argv[1] ?? '');
if ($scenario === 'guard') {
    ini_set('session.save_path', sys_get_temp_dir());
    require_once __DIR__ . '/../includes/auth.php';
    $userId = (int)($argv[2] ?? 0);
    $_SESSION = [
        'user_id' => $userId,
        'naap_session' => [
            'user_id' => $userId,
            'account_type' => 'osa_staff',
            'login_role' => 'osa',
            // Deliberately forged. The guard must ignore this value.
            'is_primary_osa' => true,
        ],
    ];
    apiRequirePrimaryOsaAdministrator();
    echo json_encode(['ok' => true, 'authorized' => true]) . PHP_EOL;
    exit;
}

$sessionDir = sys_get_temp_dir();
ini_set('session.save_path', $sessionDir);
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/otp.php';

$pdo = getPdo();
$regularUserId = 0;

function assertTrue(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function runGuardScenario(int $userId): string
{
    $pipes = [];
    $process = proc_open(
        [PHP_BINARY, __FILE__, 'guard', (string)$userId],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes
    );
    if (!is_resource($process)) throw new RuntimeException('Could not start guard test process.');
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exit = proc_close($process);
    if ($exit !== 0) throw new RuntimeException("Guard subprocess failed: {$stderr}");
    return $stdout;
}

try {
    $primaryRows = $pdo->query(
        "SELECT user_id FROM users
         WHERE account_type = 'osa_staff' AND is_active = 1 AND is_primary_osa = 1"
    )->fetchAll(PDO::FETCH_COLUMN);
    assertTrue(count($primaryRows) === 1, 'There must be exactly one active Primary OSA.');
    $primaryUserId = (int)$primaryRows[0];

    foreach (['osa_staff_invitations', 'audit_logs'] as $table) {
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = :table_name"
        );
        $stmt->execute([':table_name' => $table]);
        assertTrue((int)$stmt->fetchColumn() === 1, "Missing {$table} table.");
    }

    $suffix = bin2hex(random_bytes(6));
    $employee = 'TEST-' . substr($suffix, 0, 10);
    $email = "osa-test-{$suffix}@example.invalid";
    $insertUser = $pdo->prepare(
        "INSERT INTO users
            (employee_number, email, password_hash, first_name, last_name,
             account_type, is_primary_osa, is_active)
         VALUES
            (:employee, :email, :password_hash, 'Guard', 'Test',
             'osa_staff', 0, 1)"
    );
    $insertUser->execute([
        ':employee' => $employee,
        ':email' => $email,
        ':password_hash' => password_hash(bin2hex(random_bytes(12)), PASSWORD_BCRYPT),
    ]);
    $regularUserId = (int)$pdo->lastInsertId();

    assertTrue(str_contains(runGuardScenario($primaryUserId), '"authorized":true'), 'Primary OSA was rejected.');
    assertTrue(
        str_contains(runGuardScenario($regularUserId), '"error":"Primary OSA authorization is required."'),
        'A regular OSA bypassed the Primary guard with a forged session flag.'
    );

    $pdo->beginTransaction();
    $rawToken = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare(
        "INSERT INTO osa_staff_invitations
            (employee_number, email, token_hash, invited_by_user_id, expires_at)
         VALUES (:employee, :email, :token_hash, :inviter, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR))"
    );
    $stmt->execute([
        ':employee' => 'INV-' . substr($suffix, 0, 10),
        ':email' => "invite-{$suffix}@example.invalid",
        ':token_hash' => hashOsaInvitationToken($rawToken),
        ':inviter' => $primaryUserId,
    ]);
    $invitationId = (int)$pdo->lastInsertId();
    $invite = requireMatchingOsaInvitation(
        $pdo,
        $rawToken,
        "invite-{$suffix}@example.invalid",
        'INV-' . substr($suffix, 0, 10),
        true
    );
    assertTrue((int)$invite['invitation_id'] === $invitationId, 'Valid invitation was not accepted.');
    assertTrue(
        otpRecipientIsEligible($pdo, 'osa_registration', $invite['email'], $invite['employee_number'], $rawToken),
        'A matching invitation was not eligible for OSA OTP delivery.'
    );
    assertTrue(
        !otpRecipientIsEligible($pdo, 'osa_registration', 'wrong@example.invalid', $invite['employee_number'], $rawToken),
        'A mismatched email was eligible for OSA OTP delivery.'
    );

    $mismatchRejected = false;
    try {
        requireMatchingOsaInvitation($pdo, $rawToken, 'wrong@example.invalid', $invite['employee_number']);
    } catch (InvalidArgumentException $e) {
        $mismatchRejected = true;
    }
    assertTrue($mismatchRejected, 'Invitation email mismatch was accepted.');

    $pdo->prepare("UPDATE osa_staff_invitations SET expires_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE) WHERE invitation_id = :id")
        ->execute([':id' => $invitationId]);
    assertTrue(findUsableOsaInvitation($pdo, $rawToken) === null, 'Expired invitation was accepted.');
    $pdo->prepare("UPDATE osa_staff_invitations SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR), status = 'revoked' WHERE invitation_id = :id")
        ->execute([':id' => $invitationId]);
    assertTrue(findUsableOsaInvitation($pdo, $rawToken) === null, 'Revoked invitation was accepted.');
    $pdo->prepare("UPDATE osa_staff_invitations SET status = 'accepted' WHERE invitation_id = :id")
        ->execute([':id' => $invitationId]);
    assertTrue(findUsableOsaInvitation($pdo, $rawToken) === null, 'Accepted invitation was reused.');
    $pdo->prepare("UPDATE osa_staff_invitations SET status = 'pending' WHERE invitation_id = :id")
        ->execute([':id' => $invitationId]);

    $rotatedToken = bin2hex(random_bytes(32));
    $pdo->prepare("UPDATE osa_staff_invitations SET token_hash = :hash WHERE invitation_id = :id")
        ->execute([':hash' => hashOsaInvitationToken($rotatedToken), ':id' => $invitationId]);
    assertTrue(findUsableOsaInvitation($pdo, $rawToken) === null, 'Resend did not invalidate the old token.');
    assertTrue(findUsableOsaInvitation($pdo, $rotatedToken) !== null, 'Rotated token is not usable.');

    $actor = getUserById($primaryUserId);
    $auditId = appendAuditLog(
        'osa_test_event',
        'osa_staff_invitation',
        (string)$invitationId,
        $actor,
        ['email' => $invite['email'], 'employee_number' => $invite['employee_number']],
        null,
        ['status' => 'pending'],
        'success',
        $pdo
    );
    $appendOnlyProtected = false;
    try {
        $pdo->prepare("UPDATE audit_logs SET result = 'changed' WHERE audit_id = :id")
            ->execute([':id' => $auditId]);
    } catch (PDOException $e) {
        $appendOnlyProtected = true;
    }
    assertTrue($appendOnlyProtected, 'Audit entry could be updated.');
    $deleteProtected = false;
    try {
        $pdo->prepare("DELETE FROM audit_logs WHERE audit_id = :id")
            ->execute([':id' => $auditId]);
    } catch (PDOException $e) {
        $deleteProtected = true;
    }
    assertTrue($deleteProtected, 'Audit entry could be deleted.');
    $pdo->rollBack();

    echo "Primary OSA invitation and audit tests passed.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($regularUserId > 0) {
        $pdo->prepare("DELETE FROM users WHERE user_id = :id")->execute([':id' => $regularUserId]);
    }
}
