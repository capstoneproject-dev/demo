<?php

$sessionDir = __DIR__ . '/.otp-test-sessions-' . bin2hex(random_bytes(4));
mkdir($sessionDir, 0700);
ini_set('session.save_path', $sessionDir);

require_once __DIR__ . '/../includes/otp.php';

$pdo = getPdo();
$createdIds = [];

function createTestChallenge(PDO $pdo, array &$createdIds, array $overrides = []): array
{
    $token = generateOpaqueToken();
    $otp = '123456';
    $data = array_merge([
        'purpose' => 'password_reset',
        'email' => 'otp-test@example.invalid',
        'identifier' => 'OTP-TEST',
        'expires_at' => date('Y-m-d H:i:s', time() + 600),
        'attempt_count' => 0,
    ], $overrides);

    $stmt = $pdo->prepare(
        "INSERT INTO email_otp_challenges
            (challenge_token_hash, purpose, email, identifier, otp_hash,
             expires_at, resend_available_at, attempt_count, max_attempts)
         VALUES
            (:token_hash, :purpose, :email, :identifier, :otp_hash,
             :expires_at, CURRENT_TIMESTAMP, :attempt_count, 5)"
    );
    $stmt->execute([
        ':token_hash' => hashOtpToken($token),
        ':purpose' => $data['purpose'],
        ':email' => $data['email'],
        ':identifier' => $data['identifier'],
        ':otp_hash' => password_hash($otp, PASSWORD_DEFAULT),
        ':expires_at' => $data['expires_at'],
        ':attempt_count' => $data['attempt_count'],
    ]);
    $createdIds[] = (int)$pdo->lastInsertId();
    return ['token' => $token, 'otp' => $otp, ...$data];
}

function expectFailure(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (InvalidArgumentException $e) {
        return;
    }
    throw new RuntimeException($message);
}

try {
    $valid = createTestChallenge($pdo, $createdIds);
    $verificationToken = verifyOtpChallenge($valid['token'], $valid['otp']);
    if (!preg_match('/^[a-f0-9]{64}$/', $verificationToken)) {
        throw new RuntimeException('Verification did not return an opaque token.');
    }

    $pdo->beginTransaction();
    consumeOtpVerification(
        $pdo,
        $verificationToken,
        $valid['purpose'],
        $valid['email'],
        $valid['identifier']
    );
    expectFailure(
        fn() => consumeOtpVerification(
            $pdo,
            $verificationToken,
            $valid['purpose'],
            $valid['email'],
            $valid['identifier']
        ),
        'A verification token was consumed twice.'
    );
    $pdo->rollBack();

    $expired = createTestChallenge($pdo, $createdIds, [
        'expires_at' => date('Y-m-d H:i:s', time() - 60),
    ]);
    expectFailure(
        fn() => verifyOtpChallenge($expired['token'], $expired['otp']),
        'An expired OTP was accepted.'
    );

    $locked = createTestChallenge($pdo, $createdIds, ['attempt_count' => 5]);
    expectFailure(
        fn() => verifyOtpChallenge($locked['token'], $locked['otp']),
        'A locked OTP was accepted.'
    );

    $attemptLimited = createTestChallenge($pdo, $createdIds);
    for ($attempt = 0; $attempt < 5; $attempt++) {
        expectFailure(
            fn() => verifyOtpChallenge($attemptLimited['token'], '000000'),
            'An incorrect OTP was accepted.'
        );
    }
    expectFailure(
        fn() => verifyOtpChallenge($attemptLimited['token'], $attemptLimited['otp']),
        'An OTP was accepted after five failed attempts.'
    );

    $pdo->beginTransaction();
    expectFailure(
        fn() => consumeOtpVerification(
            $pdo,
            str_repeat('a', 64),
            'password_reset',
            'otp-test@example.invalid',
            'OTP-TEST'
        ),
        'An unknown verification token was accepted.'
    );
    $pdo->rollBack();

    echo "OTP service tests passed.\n";
} finally {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($createdIds) {
        $placeholders = implode(',', array_fill(0, count($createdIds), '?'));
        $pdo->prepare("DELETE FROM email_otp_challenges WHERE challenge_id IN ($placeholders)")
            ->execute($createdIds);
    }
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    foreach (glob($sessionDir . '/*') ?: [] as $sessionFile) unlink($sessionFile);
    rmdir($sessionDir);
}
