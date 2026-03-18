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
} catch (PDOException $e) {
    error_log('[api/student/rentals/create] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
