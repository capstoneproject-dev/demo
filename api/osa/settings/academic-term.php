<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/system_settings.php';

header('Content-Type: application/json');

apiGuard();

$session = getPhpSession();
$isOsa = (($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff');
if (!$isOsa) {
    jsonError('OSA staff context required.', 403);
}

try {
    $pdo = getPdo();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        jsonOk(['term' => settingsGetActiveAcademicTerm($pdo)]);
    }

    if ($method === 'POST') {
        $payload = json_decode(file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            jsonError('Invalid JSON payload.', 400);
        }

        $term = settingsUpdateActiveAcademicTerm($pdo, $payload, isset($session['user_id']) ? (int)$session['user_id'] : null);
        jsonOk(['term' => $term]);
    }

    jsonError('Method not allowed.', 405);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 400);
} catch (Throwable $e) {
    error_log('[api/osa/settings/academic-term] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
