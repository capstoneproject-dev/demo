<?php

require_once __DIR__ . '/../../../../includes/auth.php';
require_once __DIR__ . '/../../../../includes/functions.php';
require_once __DIR__ . '/../../../../includes/osa_staff.php';

header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
$body = getRequestBody();
$invitationId = (int)($body['invitation_id'] ?? 0);
if ($invitationId <= 0) jsonError('Invalid invitation.', 422);

$pdo = getPdo();
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
         SET status = 'revoked', revoked_by_user_id = :actor_id, revoked_at = CURRENT_TIMESTAMP
         WHERE invitation_id = :id"
    )->execute([':actor_id' => (int)$session['user_id'], ':id' => $invitationId]);
    appendAuditLog(
        'osa_invitation_revoked',
        'osa_staff_invitation',
        (string)$invitationId,
        getUserById((int)$session['user_id']),
        $invite,
        ['status' => 'pending'],
        ['status' => 'revoked'],
        'success',
        $pdo
    );
    $pdo->commit();
    jsonOk(['message' => 'Invitation revoked.']);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/invitations/revoke] ' . $e->getMessage());
    jsonError('Could not revoke the invitation right now.', 500);
}
