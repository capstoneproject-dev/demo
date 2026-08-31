<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/offline_sync.php';

header('Content-Type: application/json');
apiGuard();
requirePost();
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== 0) {
    jsonError('Content-Type must be multipart/form-data.', 415, ['error_code' => 'UNSUPPORTED_MEDIA_TYPE']);
}

$pdo = getPdo();
$session = getPhpSession();
$userId = (int)($session['user_id'] ?? 0);
$envelope = null;
$claimed = false;

try {
    $payload = json_decode((string)($_POST['payload'] ?? '{}'), true, 64, JSON_THROW_ON_ERROR);
    $envelope = offlineValidateEnvelope([
        'operation_id' => $_POST['operation_id'] ?? '',
        'operation_type' => $_POST['operation_type'] ?? '',
        'created_at' => $_POST['created_at'] ?? '',
        'payload' => $payload,
    ]);
    if (in_array($envelope['operation_type'], ['document.submit', 'inventory.save'], true)) apiRequireOrgManageAccess();
    if (!in_array($envelope['operation_type'], ['student.printing.submit', 'document.submit', 'inventory.save'], true)) {
        throw new OfflineSyncValidationException('This upload operation is not allowed.');
    }
    $files = offlineNormalizedFiles($_FILES);
    if (!$files) throw new OfflineSyncValidationException('At least one uploaded file is required.');
    $totalUploadBytes = array_sum(array_map(static fn(array $file): int => (int)($file['size'] ?? 0), $files));
    if ($totalUploadBytes > 100 * 1024 * 1024) {
        throw new OfflineSyncValidationException('A synchronized upload batch cannot exceed 100 MB.');
    }
    $fileHashes = [];
    foreach ($files as $index => $file) {
        if ((int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)($file['tmp_name'] ?? ''))) {
            throw new OfflineSyncValidationException('One of the queued files could not be uploaded.');
        }
        $fileHashes[] = implode(':', [
            (string)$index,
            (string)($file['field'] ?? ''),
            (string)($file['name'] ?? ''),
            hash_file('sha256', (string)$file['tmp_name']) ?: '',
        ]);
    }
    $hash = offlinePayloadHash($envelope['operation_type'], $envelope['payload'], $fileHashes);
    $prior = offlineBegin($pdo, $userId, $envelope, $hash);
    if ($prior) {
        http_response_code($prior['status']);
        echo json_encode($prior['body']);
        exit;
    }
    $claimed = true;
    $result = ['ok' => true, 'operation_id' => $envelope['operation_id']] + offlineDispatchUpload($pdo, $envelope, $files);
    offlineFinish($pdo, $userId, $envelope['operation_id'], 'completed', 200, $result);
    jsonOk($result);
} catch (JsonException|OfflineSyncValidationException|DocumentValidationException|UploadValidationException|IgpValidationException|ServiceTrackerValidationException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_VALIDATION'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 422, $result);
    jsonError($e->getMessage(), 422, ['error_code' => 'OFFLINE_VALIDATION']);
} catch (OfflineSyncConflictException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_CONFLICT'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 409, $result);
    jsonError($e->getMessage(), 409, ['error_code' => 'OFFLINE_CONFLICT']);
} catch (DocumentAuthorizationException|IgpAuthorizationException|ServiceTrackerAuthorizationException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_PERMISSION_CHANGED'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 403, $result);
    jsonError($e->getMessage(), 403, ['error_code' => 'OFFLINE_PERMISSION_CHANGED']);
} catch (Throwable $e) {
    error_log('[api/offline/sync-upload] ' . $e->getMessage());
    jsonError('The offline upload could not be synchronized yet.', 500);
}
