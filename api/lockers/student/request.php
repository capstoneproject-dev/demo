<?php
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $context = stRequireStudentContext();
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $itemId = (int)($payload['item_id'] ?? 0);
    if ($itemId <= 0) {
        throw new ServiceTrackerValidationException('A locker selection is required.');
    }

    $pdo = getPdo();
    $result = stRequestLocker($pdo, (int)$context['user_id'], $itemId);
    jsonOk($result);
} catch (PDOException $e) {
    error_log('[api/lockers/student/request] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
