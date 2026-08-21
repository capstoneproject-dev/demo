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
    $rentalId = (int)($body['rental_id'] ?? 0);
    igpCancelStudentReservation(getPdo(), $userId, $rentalId);

    jsonOk(['message' => 'Reservation cancelled successfully.']);
} catch (PDOException $e) {
    error_log('[api/student/rentals/cancel] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
