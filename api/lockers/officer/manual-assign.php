<?php
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo = getPdo();
    $context = stRequireLockerOfficerContext($pdo);
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];

    $itemId = (int)($payload['item_id'] ?? 0);
    $studentUserId = (int)($payload['student_user_id'] ?? 0);
    if ($itemId <= 0) {
        throw new ServiceTrackerValidationException('Locker not found.');
    }
    if ($studentUserId <= 0) {
        throw new ServiceTrackerValidationException('A student must be selected.');
    }

    $result = stAssignLockerManually(
        $pdo,
        (int)$context['org_id'],
        (int)$context['user_id'],
        $itemId,
        $studentUserId,
        $payload
    );
    jsonOk($result);
} catch (PDOException $e) {
    error_log('[api/lockers/officer/manual-assign] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
