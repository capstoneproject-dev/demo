<?php
require_once __DIR__ . '/../../../includes/igp.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/functions.php';
require_once __DIR__ . '/../../../includes/audit.php';
require_once __DIR__ . '/../../../includes/rental_adjustments.php';
require_once __DIR__ . '/../../../includes/otp.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
apiGuard();
$session = apiRequireOsaSystemAdministrator();
$pdo = getPdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    jsonError('Method not allowed.', 405);
}
$write = $method === 'POST';
if ($write) {
    requirePost();
    apiRequireRecentReauthentication();
}
$body = $write ? getRequestBody() : $_GET;
try { $rentalId = osaRentalAdjustmentId($body['rental_id'] ?? null); }
catch (InvalidArgumentException $e) { jsonError($e->getMessage(), 422); }

try {
    if ($write) {
        igpBeginTransaction($pdo);
        igpLockRentalInventory($pdo, $rentalId);
    }
    $stmt = $pdo->prepare('SELECT * FROM rentals WHERE rental_id = :id' . ($write ? ' FOR UPDATE' : ''));
    $stmt->execute([':id' => $rentalId]);
    $rental = $stmt->fetch();
    if (!$rental) throw new IgpValidationException('Rental not found.');
    $quote = igpAttachCurrentRentalCharges($pdo, [$rental])[0];
    $canAdjust = in_array($rental['status'], ['active', 'returned', 'overdue'], true)
        && $rental['payment_status'] === 'unpaid'
        && ($rental['service_kind'] ?? 'rental') !== 'locker';
    if (!$write) {
        $student = getUserById((int)$rental['renter_user_id']);
        $organization = $pdo->prepare('SELECT org_name FROM organizations WHERE org_id = :id');
        $organization->execute([':id' => $rental['org_id']]);
        jsonOk(['rental' => [
            'rental_id' => $rentalId, 'student_name' => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
            'organization' => $organization->fetchColumn(), 'status' => $rental['status'],
            'payment_status' => $rental['payment_status'], 'current_total_cost' => $quote['current_total_cost'],
            'can_adjust' => $canAdjust,
        ]]);
    }
    $adjustment = validateOsaRentalAdjustment($rental, $body, (float)$quote['current_total_cost']);
    $amount = $adjustment['amount'];
    $before = $adjustment['before'];
    $delta = $adjustment['delta'];
    $reason = $adjustment['reason'];
    $actor = getUserById((int)$session['user_id']);
    if (!is_string($body['verification_token'] ?? null)) throw new InvalidArgumentException('Email verification is required.', 422);
    consumeOtpVerification($pdo, (string)($body['verification_token'] ?? ''), 'osa_rental_adjustment',
        (string)$actor['email'], osaRentalAdjustmentOtpIdentifier((int)$session['user_id'], $rentalId, $body));
    // Active rentals keep their original fee; the audit adjustment is applied to
    // live quotes and final checkout. Closed rentals have a finalized balance.
    if ($rental['status'] !== 'active') {
        $pdo->prepare('UPDATE rentals SET total_cost = :amount WHERE rental_id = :id')
            ->execute([':amount' => $amount, ':id' => $rentalId]);
    }
    $auditId = appendAuditLog('rental_charge_adjusted', 'rental', (string)$rentalId, $actor,
        getUserById((int)$rental['renter_user_id']),
        ['total_cost' => $before, 'stored_total_cost' => (float)$rental['total_cost'], 'status' => $rental['status'], 'payment_status' => $rental['payment_status']],
        ['total_cost' => $amount, 'adjustment_delta' => $delta, 'applies_to_active_rental' => $rental['status'] === 'active',
            'reason' => $reason, 'org_id' => (int)$rental['org_id'], 'approved_by_user_id' => (int)$session['user_id'], 'approval_method' => 'email_otp'],
        'success', $pdo);
    igpRefreshUserDebtFlag($pdo, (int)$rental['renter_user_id']);
    $pdo->commit();
    jsonOk(['message' => 'Rental adjustment saved and audited.', 'audit_id' => $auditId, 'current_total_cost' => $amount]);
} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), $e->getCode() === 409 ? 409 : 422);
} catch (IgpValidationException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 422);
} catch (IgpConflictException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonError($e->getMessage(), 409);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if (igpIsConcurrencyError($e)) jsonError('Another rental operation is in progress. Reopen the form and try again.', 409);
    error_log('[osa/rentals/adjust] ' . $e->getMessage());
    jsonError('Could not save the rental adjustment. Please try again.', 500);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[osa/rentals/adjust] ' . $e->getMessage());
    jsonError('Could not save the rental adjustment. Please try again.', 500);
}
