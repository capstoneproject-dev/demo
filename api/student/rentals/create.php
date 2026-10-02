<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        jsonError('Not authenticated.', 401);
    }

    $body = getRequestBody();
    $organization = trim((string)($body['organization'] ?? ''));
    $itemName = trim((string)($body['item_name'] ?? ''));
    $hours = (float)($body['hours'] ?? 0);
    $scheduledStart = trim((string)($body['scheduled_start'] ?? ''));

    $rentalId = igpCreateStudentRental(getPdo(), $userId, $organization, $itemName, $hours, $scheduledStart);
    jsonOk(['rental_id' => $rentalId]);
} catch (IgpConflictException $e) {
    jsonError($e->getMessage(), 409, ['code' => 'RENTAL_CONFLICT']);
} catch (PDOException $e) {
    if (igpIsConcurrencyError($e)) {
        jsonError('Another rental operation is in progress. Refresh and try again.', 409, ['code' => 'RENTAL_CONFLICT']);
    }
    error_log('[api/student/rentals/create] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
