<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

function normalizeUploadedFiles(array $files): array
{
    if (isset($files['name']) && !is_array($files['name'])) {
        return [$files];
    }

    $normalized = [];
    $names = $files['name'] ?? [];
    foreach ($names as $index => $_name) {
        $normalized[] = [
            'name' => $files['name'][$index] ?? '',
            'type' => $files['type'][$index] ?? '',
            'tmp_name' => $files['tmp_name'][$index] ?? '',
            'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$index] ?? 0,
        ];
    }

    return $normalized;
}

try {
    $ctx = stRequireStudentContext();
    $uploadedFiles = normalizeUploadedFiles($_FILES['files'] ?? ($_FILES['file'] ?? []));
    $notes = $_POST['notes'] ?? [];
    if (!is_array($notes)) {
        $notes = [$notes];
    }

    if (!$uploadedFiles) {
        throw new RuntimeException('At least one file is required.');
    }

    $jobs = [];
    foreach ($uploadedFiles as $index => $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        $payload = $_POST;
        $payload['notes'] = trim((string)($notes[$index] ?? ''));
        $jobs[] = stSubmitPrintJob(getPdo(), (int)$ctx['user_id'], $payload, $file);
    }

    if (!$jobs) {
        throw new RuntimeException('At least one valid file is required.');
    }

    jsonOk([
        'items' => $jobs,
        'count' => count($jobs),
    ]);
} catch (PDOException $e) {
    error_log('[api/printing/student/submit] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
