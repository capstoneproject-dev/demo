<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/system_settings.php';

header('Content-Type: application/json');

apiGuard();

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        jsonError('Method not allowed.', 405);
    }

    jsonOk(['term' => settingsGetActiveAcademicTerm(getPdo())]);
} catch (Throwable $e) {
    error_log('[api/settings/academic-term] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
}
