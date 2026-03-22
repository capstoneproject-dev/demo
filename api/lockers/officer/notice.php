<?php
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo = getPdo();
    $context = stRequireLockerOfficerContext($pdo);
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $rentalId = (int)($payload['rental_id'] ?? 0);
    if ($rentalId <= 0) {
        throw new ServiceTrackerValidationException('Locker assignment not found.');
    }

    $result = stSendLockerNotice(
        $pdo,
        (int)$context['org_id'],
        (int)$context['user_id'],
        $rentalId,
        (string)($payload['message'] ?? '')
    );
    jsonOk($result);
} catch (PDOException $e) {
    error_log('[api/lockers/officer/notice] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
