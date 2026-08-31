<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/offline_sync.php';

header('Content-Type: application/json');
apiGuard();
requirePost();
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    jsonError('Content-Type must be application/json.', 415, ['error_code' => 'UNSUPPORTED_MEDIA_TYPE']);
}

$pdo = getPdo();
$session = getPhpSession();
$userId = (int)($session['user_id'] ?? 0);
$envelope = null;
$claimed = false;

try {
    $envelope = offlineValidateEnvelope(getRequestBody());
    if (offlineRequiresOrgManageAccess($envelope['operation_type'])) {
        apiRequireOrgManageAccess();
    }
    if (in_array($envelope['operation_type'], ['student.printing.submit', 'document.submit'], true)
        || ($envelope['operation_type'] === 'inventory.save' && !empty($envelope['payload']['image']))) {
        throw new OfflineSyncValidationException('Use the upload synchronization endpoint for this operation.');
    }
    $hash = offlinePayloadHash($envelope['operation_type'], $envelope['payload']);
    $prior = offlineBegin($pdo, $userId, $envelope, $hash);
    if ($prior) {
        http_response_code($prior['status']);
        echo json_encode($prior['body']);
        exit;
    }
    $claimed = true;
    $result = ['ok' => true, 'operation_id' => $envelope['operation_id']] + offlineDispatchJson($pdo, $envelope);
    offlineFinish($pdo, $userId, $envelope['operation_id'], 'completed', 200, $result);
    jsonOk($result);
} catch (OfflineSyncConflictException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_CONFLICT'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 409, $result);
    jsonError($e->getMessage(), 409, ['error_code' => 'OFFLINE_CONFLICT']);
} catch (OfflineSyncValidationException|AnnouncementValidationException|QrAttendanceValidationException|DocumentValidationException|UploadValidationException|IgpValidationException|ServiceTrackerValidationException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_VALIDATION'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 422, $result);
    jsonError($e->getMessage(), 422, ['error_code' => 'OFFLINE_VALIDATION']);
} catch (AnnouncementAuthorizationException|QrAttendanceAuthorizationException|DocumentAuthorizationException|IgpAuthorizationException|ServiceTrackerAuthorizationException $e) {
    $result = ['ok' => false, 'error' => $e->getMessage(), 'error_code' => 'OFFLINE_PERMISSION_CHANGED'];
    if ($envelope && $claimed) offlineFinish($pdo, $userId, $envelope['operation_id'], 'rejected', 403, $result);
    jsonError($e->getMessage(), 403, ['error_code' => 'OFFLINE_PERMISSION_CHANGED']);
} catch (Throwable $e) {
    error_log('[api/offline/sync] ' . $e->getMessage());
    jsonError('The offline operation could not be synchronized yet.', 500);
}
