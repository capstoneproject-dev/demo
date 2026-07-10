<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/mailer.php';

const OTP_EXPIRES_SECONDS = 600;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_VERIFICATION_SECONDS = 600;

class OtpRateLimitException extends RuntimeException
{
    public int $retryAfter;

    public function __construct(int $retryAfter)
    {
        parent::__construct('Please wait before requesting another code.', 429);
        $this->retryAfter = max(1, $retryAfter);
    }
}

function normalizeOtpEmail(string $email): string
{
    return strtolower(trim($email));
}

function hashOtpToken(string $token): string
{
    return hash('sha256', $token);
}

function generateOpaqueToken(): string
{
    return bin2hex(random_bytes(32));
}

function isAllowedOtpPurpose(string $purpose): bool
{
    return in_array($purpose, [
        'student_registration',
        'org_registration',
        'osa_registration',
        'password_reset',
    ], true);
}

/**
 * Check whether a code should actually be delivered. Ineligible requests are
 * still answered generically by the API so account existence is not exposed.
 */
function otpRecipientIsEligible(PDO $pdo, string $purpose, string $email, string $identifier): bool
{
    if ($purpose === 'student_registration') {
        $stmt = $pdo->prepare(
            "SELECT 1
             FROM student_numbers sn
             WHERE sn.student_number = :identifier AND sn.is_active = 1
               AND NOT EXISTS (
                   SELECT 1 FROM users u
                   WHERE u.student_number COLLATE utf8mb4_unicode_ci = sn.student_number COLLATE utf8mb4_unicode_ci
               )
               AND NOT EXISTS (
                   SELECT 1 FROM pending_registrations pr
                   WHERE pr.student_number COLLATE utf8mb4_unicode_ci = sn.student_number COLLATE utf8mb4_unicode_ci
                     AND pr.status = 'pending'
               )
             LIMIT 1"
        );
        $stmt->execute([':identifier' => $identifier]);
        return (bool)$stmt->fetchColumn();
    }

    if ($purpose === 'org_registration') {
        $stmt = $pdo->prepare(
            "SELECT 1
             FROM users u
             WHERE u.student_number = :identifier
               AND LOWER(u.email) = :email
               AND u.is_active = 1
               AND NOT EXISTS (
                   SELECT 1 FROM organization_members om WHERE om.user_id = u.user_id
               )
             LIMIT 1"
        );
        $stmt->execute([':identifier' => $identifier, ':email' => $email]);
        return (bool)$stmt->fetchColumn();
    }

    if ($purpose === 'osa_registration') {
        $stmt = $pdo->prepare(
            "SELECT 1
             WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = :email)
               AND NOT EXISTS (SELECT 1 FROM users WHERE employee_number = :identifier)"
        );
        $stmt->execute([':email' => $email, ':identifier' => $identifier]);
        return (bool)$stmt->fetchColumn();
    }

    $stmt = $pdo->prepare(
        "SELECT 1 FROM users
         WHERE student_number = :identifier AND LOWER(email) = :email AND is_active = 1
         LIMIT 1"
    );
    $stmt->execute([':identifier' => $identifier, ':email' => $email]);
    return (bool)$stmt->fetchColumn();
}

function createOtpChallenge(string $purpose, string $email, string $identifier): array
{
    $email = normalizeOtpEmail($email);
    $identifier = trim($identifier);
    if (!isAllowedOtpPurpose($purpose) || !filter_var($email, FILTER_VALIDATE_EMAIL) || $identifier === '') {
        throw new InvalidArgumentException('Valid email, identifier, and purpose are required.');
    }

    $pdo = getPdo();
    $ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    $recent = $pdo->prepare(
        "SELECT TIMESTAMPDIFF(SECOND, CURRENT_TIMESTAMP, resend_available_at) AS retry_after
         FROM email_otp_challenges
         WHERE email = :email AND purpose = :purpose
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)
         ORDER BY challenge_id DESC LIMIT 1"
    );
    $recent->execute([':email' => $email, ':purpose' => $purpose]);
    $cooldown = $recent->fetch();
    if ($cooldown && (int)$cooldown['retry_after'] > 0) {
        throw new OtpRateLimitException((int)$cooldown['retry_after']);
    }

    if ($ip !== '') {
        $ipLimit = $pdo->prepare(
            "SELECT COUNT(*) FROM email_otp_challenges
             WHERE request_ip = :request_ip
               AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE)"
        );
        $ipLimit->execute([':request_ip' => $ip]);
        if ((int)$ipLimit->fetchColumn() >= 10) {
            throw new OtpRateLimitException(600);
        }
    }

    $eligible = otpRecipientIsEligible($pdo, $purpose, $email, $identifier);
    if (!$eligible && $purpose !== 'password_reset') {
        throw new InvalidArgumentException('These registration details are not eligible for email verification. Check the identifier or contact the OSA.');
    }
    $otp = (string)random_int(100000, 999999);
    $challengeToken = generateOpaqueToken();

    $pdo->beginTransaction();
    try {
        $invalidate = $pdo->prepare(
            "UPDATE email_otp_challenges
             SET consumed_at = CURRENT_TIMESTAMP
             WHERE email = :email AND purpose = :purpose AND consumed_at IS NULL"
        );
        $invalidate->execute([':email' => $email, ':purpose' => $purpose]);

        $insert = $pdo->prepare(
            "INSERT INTO email_otp_challenges
                (challenge_token_hash, purpose, email, identifier, otp_hash,
                 expires_at, resend_available_at, max_attempts, request_ip)
             VALUES
                (:token_hash, :purpose, :email, :identifier, :otp_hash,
                 DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE),
                 DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 SECOND), :max_attempts, :request_ip)"
        );
        $insert->execute([
            ':token_hash' => hashOtpToken($challengeToken),
            ':purpose' => $purpose,
            ':email' => $email,
            ':identifier' => $identifier,
            ':otp_hash' => password_hash($otp, PASSWORD_DEFAULT),
            ':max_attempts' => OTP_MAX_ATTEMPTS,
            ':request_ip' => $ip ?: null,
        ]);
        $challengeId = (int)$pdo->lastInsertId();
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    if ($eligible) {
        try {
            sendOtpEmail($email, $otp, $purpose);
        } catch (Throwable $e) {
            $pdo->prepare("UPDATE email_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = :id")
                ->execute([':id' => $challengeId]);
            throw $e;
        }
    }

    return [
        'challenge_token' => $challengeToken,
        'expires_in' => OTP_EXPIRES_SECONDS,
        'resend_after' => OTP_RESEND_SECONDS,
    ];
}

function verifyOtpChallenge(string $challengeToken, string $otp): string
{
    if (!preg_match('/^[a-f0-9]{64}$/', $challengeToken) || !preg_match('/^\d{6}$/', $otp)) {
        throw new InvalidArgumentException('Invalid or expired verification code.');
    }

    $pdo = getPdo();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT * FROM email_otp_challenges
             WHERE challenge_token_hash = :token_hash LIMIT 1 FOR UPDATE"
        );
        $stmt->execute([':token_hash' => hashOtpToken($challengeToken)]);
        $challenge = $stmt->fetch();

        $unusable = !$challenge
            || $challenge['consumed_at'] !== null
            || $challenge['verified_at'] !== null
            || strtotime($challenge['expires_at']) < time()
            || (int)$challenge['attempt_count'] >= (int)$challenge['max_attempts'];
        if ($unusable) {
            throw new InvalidArgumentException('Invalid or expired verification code.');
        }

        if (!password_verify($otp, $challenge['otp_hash'])) {
            $pdo->prepare(
                "UPDATE email_otp_challenges SET attempt_count = attempt_count + 1 WHERE challenge_id = :id"
            )->execute([':id' => (int)$challenge['challenge_id']]);
            $pdo->commit();
            throw new InvalidArgumentException('Invalid or expired verification code.');
        }

        $verificationToken = generateOpaqueToken();
        $pdo->prepare(
            "UPDATE email_otp_challenges
             SET verified_at = CURRENT_TIMESTAMP,
                 verification_token_hash = :verification_hash,
                 verification_expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE)
             WHERE challenge_id = :id"
        )->execute([
            ':verification_hash' => hashOtpToken($verificationToken),
            ':id' => (int)$challenge['challenge_id'],
        ]);
        $pdo->commit();
        return $verificationToken;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

/** Must be called inside the same transaction as the protected operation. */
function consumeOtpVerification(
    PDO $pdo,
    string $verificationToken,
    string $purpose,
    string $email,
    string $identifier
): void {
    if (!preg_match('/^[a-f0-9]{64}$/', $verificationToken)) {
        throw new InvalidArgumentException('Email verification is required.');
    }

    $stmt = $pdo->prepare(
        "SELECT challenge_id
         FROM email_otp_challenges
         WHERE verification_token_hash = :token_hash
           AND purpose = :purpose
           AND email = :email
           AND identifier = :identifier
           AND verified_at IS NOT NULL
           AND verification_expires_at >= CURRENT_TIMESTAMP
           AND consumed_at IS NULL
         LIMIT 1 FOR UPDATE"
    );
    $stmt->execute([
        ':token_hash' => hashOtpToken($verificationToken),
        ':purpose' => $purpose,
        ':email' => normalizeOtpEmail($email),
        ':identifier' => trim($identifier),
    ]);
    $challengeId = $stmt->fetchColumn();
    if (!$challengeId) {
        throw new InvalidArgumentException('Email verification is invalid or expired.');
    }

    $pdo->prepare(
        "UPDATE email_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = :id"
    )->execute([':id' => (int)$challengeId]);
}
