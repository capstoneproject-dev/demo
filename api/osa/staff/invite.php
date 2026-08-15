<?php

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/osa_staff.php';

header('Content-Type: application/json');
requirePost();
$session = apiRequirePrimaryOsaAdministrator();
apiRequireRecentReauthentication();
$body = getRequestBody();
$email = normalizeOsaInvitationEmail((string)($body['email'] ?? ''));
$employeeNumber = trim((string)($body['employee_number'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $employeeNumber === '' || strlen($employeeNumber) > 20) {
    jsonError('A valid official email and employee number are required.', 422);
}

$pdo = getPdo();
$actor = getUserById((int)$session['user_id']);
$rawToken = bin2hex(random_bytes(32));
try {
    $pdo->beginTransaction();
    expirePendingOsaInvitations($pdo);
    $duplicateUser = $pdo->prepare(
        "SELECT 1 FROM users WHERE LOWER(email) = :email OR employee_number = :employee_number LIMIT 1"
    );
    $duplicateUser->execute([':email' => $email, ':employee_number' => $employeeNumber]);
    $duplicateInvite = $pdo->prepare(
        "SELECT 1 FROM osa_staff_invitations
         WHERE status = 'pending' AND (email = :email OR employee_number = :employee_number)
         LIMIT 1"
    );
    $duplicateInvite->execute([':email' => $email, ':employee_number' => $employeeNumber]);
    if ($duplicateUser->fetchColumn() || $duplicateInvite->fetchColumn()) {
        throw new InvalidArgumentException('That email or employee number is already in use or has a pending invitation.');
    }

    $insert = $pdo->prepare(
        "INSERT INTO osa_staff_invitations
            (employee_number, email, token_hash, invited_by_user_id, expires_at)
         VALUES
            (:employee_number, :email, :token_hash, :invited_by,
             DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR))"
    );
    $insert->execute([
        ':employee_number' => $employeeNumber,
        ':email' => $email,
        ':token_hash' => hashOsaInvitationToken($rawToken),
        ':invited_by' => (int)$session['user_id'],
    ]);
    $invitationId = (int)$pdo->lastInsertId();
    appendAuditLog(
        'osa_invitation_created',
        'osa_staff_invitation',
        (string)$invitationId,
        $actor,
        ['email' => $email, 'employee_number' => $employeeNumber],
        null,
        ['status' => 'pending', 'expires_in_hours' => OSA_INVITATION_EXPIRY_HOURS],
        'success',
        $pdo
    );
    $pdo->commit();
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[api/osa/staff/invite] ' . $e->getMessage());
    jsonError('Could not create the invitation right now.', 500);
}

$invite = ['email' => $email, 'employee_number' => $employeeNumber];
try {
    sendOsaInvitationEmail($invite, $rawToken);
    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET delivery_status = 'sent', delivery_error = NULL, last_sent_at = CURRENT_TIMESTAMP
         WHERE invitation_id = :id"
    )->execute([':id' => $invitationId]);
    jsonOk(['message' => 'Invitation sent.', 'invitation_id' => $invitationId]);
} catch (Throwable $e) {
    $message = substr($e->getMessage(), 0, 255);
    $pdo->prepare(
        "UPDATE osa_staff_invitations
         SET delivery_status = 'failed', delivery_error = :error
         WHERE invitation_id = :id"
    )->execute([':error' => $message, ':id' => $invitationId]);
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
    jsonError('The invitation was saved, but email delivery failed. You can resend it.', 503);
}
