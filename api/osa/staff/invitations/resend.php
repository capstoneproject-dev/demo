<?php

require_once __DIR__ . '/../../../../includes/auth.php';
require_once __DIR__ . '/../../../../includes/functions.php';
require_once __DIR__ . '/../../../../includes/osa_staff.php';

header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
apiRequireRecentReauthentication();
$body = getRequestBody();
$invitationId = (int)($body['invitation_id'] ?? 0);
if ($invitationId <= 0) jsonError('Invalid invitation.', 422);

$pdo = getPdo();
$actor = getUserById((int)$session['user_id']);
$rawToken = bin2hex(random_bytes(32));
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        "SELECT * FROM osa_staff_invitations
         WHERE invitation_id = :id AND status = 'pending'
         LIMIT 1 FOR UPDATE"
    );
    $stmt->execute([':id' => $invitationId]);
    $invite = $stmt->fetch();
    if (!$invite) throw new InvalidArgumentException('That pending invitation is no longer available.');

    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET token_hash = :token_hash,
             expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR),
             delivery_status = 'pending', delivery_error = NULL
         WHERE invitation_id = :id"
    )->execute([':token_hash' => hashOsaInvitationToken($rawToken), ':id' => $invitationId]);
    appendAuditLog(
        'osa_invitation_resent',
        'osa_staff_invitation',
        (string)$invitationId,
        $actor,
        $invite,
        ['expires_at' => $invite['expires_at'], 'delivery_status' => $invite['delivery_status']],
        ['expires_in_hours' => OSA_INVITATION_EXPIRY_HOURS, 'delivery_status' => 'pending'],
        'success',
        $pdo
    );
    $pdo->commit();
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/invitations/resend] ' . $e->getMessage());
    jsonError('Could not resend the invitation right now.', 500);
}

try {
    sendOsaInvitationEmail($invite, $rawToken);
    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET delivery_status = 'sent', delivery_error = NULL, last_sent_at = CURRENT_TIMESTAMP
         WHERE invitation_id = :id"
    )->execute([':id' => $invitationId]);
    jsonOk(['message' => 'A new invitation link was sent. The old link is invalid.']);
} catch (Throwable $e) {
    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET delivery_status = 'failed', delivery_error = :error
         WHERE invitation_id = :id"
    )->execute([':error' => substr($e->getMessage(), 0, 255), ':id' => $invitationId]);
    appendAuditLog(
        'osa_invitation_delivery_failed',
        'osa_staff_invitation',
        (string)$invitationId,
        $actor,
        $invite,
        ['delivery_status' => 'pending'],
        ['delivery_status' => 'failed'],
        'failed',
        $pdo
    );
    jsonError('The invitation was updated, but email delivery failed. You can resend it.', 503);
}
