<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/notification_email_delivery.php';

header('Content-Type: application/json');
apiGuard();

try {
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0 || ($session['login_role'] ?? '') !== 'student') {
        jsonError('Student account required.', 403);
    }

    $pdo = getPdo();
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        jsonOk(['preferences' => notificationEmailGetPreferences($pdo, $userId)]);
    }
    if ($method !== 'PUT') {
        jsonError('Method not allowed.', 405);
    }

    $preferences = notificationEmailSavePreferences($pdo, $userId, getRequestBody());
    jsonOk([
        'preferences' => $preferences,
        'message' => 'Email notification preferences updated.',
    ]);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[api/student/notifications/email-preferences] ' . $e->getMessage());
    jsonError('Could not update email preferences right now.', 500);
} catch (Throwable $e) {
    error_log('[api/student/notifications/email-preferences] ' . $e->getMessage());
    jsonError('Could not load email preferences.', 500);
}
