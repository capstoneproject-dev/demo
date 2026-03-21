<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

try {
    $organization = trim((string)($_GET['organization'] ?? ''));
    $itemName = trim((string)($_GET['item_name'] ?? ''));
    $hours = (float)($_GET['hours'] ?? 0);

    if ($organization === '' || $itemName === '') {
        jsonError('organization and item_name are required.', 400);
    }

    $quote = igpGetStudentRentalQuote(getPdo(), $organization, $itemName, $hours);
    jsonOk($quote);
} catch (PDOException $e) {
    error_log('[api/student/rentals/quote] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
