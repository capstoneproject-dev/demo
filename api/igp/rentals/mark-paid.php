<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $ctx = igpRequireOfficerOrgContext();
    $body = getRequestBody();
    $rentalId = (int)($body['rental_id'] ?? 0);
    igpMarkRentalPaid(getPdo(), $ctx['org_id'], $rentalId);
    jsonOk();
} catch (IgpAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/igp/rentals/mark-paid] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
