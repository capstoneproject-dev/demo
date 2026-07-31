<?php

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/mailer.php';

const OSA_INVITATION_EXPIRY_HOURS = 72;
const OSA_INVITATION_GENERIC_ERROR = 'This OSA invitation is invalid or no longer available.';

function normalizeOsaInvitationEmail(string $email): string
{
    return strtolower(trim($email));
}

function hashOsaInvitationToken(string $token): string
{
    return hash('sha256', $token);
}

function validOsaInvitationToken(string $token): bool
{
    return (bool)preg_match('/^[a-f0-9]{64}$/', $token);
}

function expirePendingOsaInvitations(PDO $pdo): int
{
    $stmt = $pdo->prepare(
        "SELECT invitation_id, email, employee_number
         FROM osa_staff_invitations
         WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP"
    );
    $stmt->execute();
    $expired = $stmt->fetchAll();
    if (!$expired) return 0;

    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET status = 'expired'
         WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP"
    )->execute();

    foreach ($expired as $invite) {
        appendAuditLog(
            'osa_invitation_expired',
            'osa_staff_invitation',
            (string)$invite['invitation_id'],
            null,
            ['email' => $invite['email'], 'employee_number' => $invite['employee_number']],
            ['status' => 'pending'],
            ['status' => 'expired'],
            'success',
            $pdo
        );
    }
    return count($expired);
}

function findUsableOsaInvitation(PDO $pdo, string $rawToken, bool $forUpdate = false): ?array
{
    if (!validOsaInvitationToken($rawToken)) return null;
    $sql = "SELECT * FROM osa_staff_invitations
            WHERE token_hash = :token_hash
              AND status = 'pending'
              AND expires_at >= CURRENT_TIMESTAMP
            LIMIT 1" . ($forUpdate ? ' FOR UPDATE' : '');
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':token_hash' => hashOsaInvitationToken($rawToken)]);
    return $stmt->fetch() ?: null;
}

function requireMatchingOsaInvitation(
    PDO $pdo,
    string $rawToken,
    string $email,
    string $employeeNumber,
    bool $forUpdate = false
): array {
    $invite = findUsableOsaInvitation($pdo, $rawToken, $forUpdate);
    if (
        !$invite
        || !hash_equals(normalizeOsaInvitationEmail($invite['email']), normalizeOsaInvitationEmail($email))
        || !hash_equals((string)$invite['employee_number'], trim($employeeNumber))
    ) {
        throw new InvalidArgumentException(OSA_INVITATION_GENERIC_ERROR);
    }
    return $invite;
}

function buildOsaInvitationUrl(string $rawToken): string
{
    $config = getMailConfig();
    return $config['app_base_url'] . '/pages/login.html#osa-invite=' . rawurlencode($rawToken);
}

function sendOsaInvitationEmail(array $invite, string $rawToken): void
{
    $config = getMailConfig();
    $url = buildOsaInvitationUrl($rawToken);
    $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    $body = '<p>You have been invited to create an OSA staff account for NAAP.</p>'
        . '<p><a href="' . $safeUrl . '">Accept your OSA invitation</a></p>'
        . '<p>This one-time invitation expires in 72 hours. If you did not expect it, ignore this email.</p>';
    sendConfiguredEmail(
        $invite['email'],
        'NAAP OSA staff invitation',
        $body,
        "You have been invited to create an OSA staff account. Open this link within 72 hours:\n{$url}",
        (string)$config['from_name']
    );
}
