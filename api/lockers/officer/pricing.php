<?php
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo = getPdo();
    $context = stRequireLockerOfficerContext($pdo);
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $itemId = (int)($payload['item_id'] ?? 0);
    if ($itemId <= 0) {
        throw new ServiceTrackerValidationException('Locker item not found.');
    }

    $result = stSaveLockerPricing($pdo, (int)$context['org_id'], $itemId, $payload);
    jsonOk($result);
} catch (PDOException $e) {
    error_log('[api/lockers/officer/pricing] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
