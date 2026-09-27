<?php
require_once '../../../config/db.php';
require_once '../../../includes/auth.php';
require_once __DIR__ . '/roster.php';
header('Content-Type: application/json');
apiRequireOsaSystemAdministrator();
try {
    jsonOk(['items' => adviserRows(getPdo())]);
} catch (PDOException $e) {
    jsonError('Could not load advisers.', 500);
}
