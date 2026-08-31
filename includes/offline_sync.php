<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/announcements.php';
require_once __DIR__ . '/qr_attendance.php';
require_once __DIR__ . '/igp.php';
require_once __DIR__ . '/services_tracker.php';
require_once __DIR__ . '/documents.php';
require_once __DIR__ . '/private_pdf_storage.php';
require_once __DIR__ . '/notification_email_delivery.php';
require_once __DIR__ . '/upload_security.php';

class OfflineSyncValidationException extends RuntimeException {}
class OfflineSyncConflictException extends RuntimeException {}

const OFFLINE_SYNC_TYPES = [
    'announcement.create',
    'event.create',
    'attendance.checkin',
    'attendance.checkout',
    'student.event.register',
    'student.rental.create',
    'student.printing.submit',
    'document.submit',
    'announcement.archive',
    'announcement.restore',
    'event.delete',
    'event.archive',
    'attendance.student.delete',
    'inventory.save',
    'inventory.delete',
    'rental.return',
    'rental.mark_paid',
    'rental.no_show',
    'igp.student.delete',
    'igp.officer.delete',
    'document.review',
    'document.cancel',
    'document.forward_ssc',
    'document.forward_osa',
    'document.annotation.create',
    'document.annotation.delete',
    'printing.accept',
    'printing.update_status',
    'printing.mark_paid',
    'locker.approve',
    'locker.reject',
    'locker.release',
    'locker.manual_assign',
    'locker.pricing',
    'locker.notice',
    'locker.clear_notice',
];

const OFFLINE_ORG_MANAGE_TYPES = [
    'announcement.create', 'announcement.archive', 'announcement.restore',
    'event.create', 'event.delete', 'event.archive', 'attendance.student.delete',
    'attendance.checkin', 'attendance.checkout',
    'inventory.save', 'inventory.delete', 'rental.return', 'rental.mark_paid',
    'rental.no_show', 'igp.student.delete', 'igp.officer.delete',
    'document.cancel', 'document.forward_ssc', 'document.forward_osa',
    'printing.accept', 'printing.update_status', 'printing.mark_paid',
    'locker.approve', 'locker.reject', 'locker.release', 'locker.manual_assign',
    'locker.pricing', 'locker.notice', 'locker.clear_notice',
];

function offlineRequiresOrgManageAccess(string $type): bool
{
    return in_array($type, OFFLINE_ORG_MANAGE_TYPES, true);
}

function offlineEnsureSchema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS offline_operations (
            offline_operation_pk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            operation_id CHAR(36) NOT NULL,
            operation_type VARCHAR(80) NOT NULL,
            payload_hash CHAR(64) NOT NULL,
            status ENUM('processing','completed','rejected') NOT NULL DEFAULT 'processing',
            http_status SMALLINT UNSIGNED NULL,
            result_json LONGTEXT NULL,
            client_created_at DATETIME NOT NULL,
            received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME NULL,
            PRIMARY KEY (offline_operation_pk),
            UNIQUE KEY uq_offline_user_operation (user_id, operation_id),
            KEY idx_offline_status_received (status, received_at),
            KEY idx_offline_user_created (user_id, client_created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function offlineCanonicalize(mixed $value): mixed
{
    if (!is_array($value)) return $value;
    if (array_is_list($value)) return array_map('offlineCanonicalize', $value);
    ksort($value, SORT_STRING);
    foreach ($value as $key => $item) $value[$key] = offlineCanonicalize($item);
    return $value;
}

function offlinePayloadHash(string $type, array $payload, array $fileHashes = []): string
{
    return hash('sha256', json_encode([
        'type' => $type,
        'payload' => offlineCanonicalize($payload),
        'files' => $fileHashes,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
}

function offlineValidateEnvelope(array $body): array
{
    $operationId = strtolower(trim((string)($body['operation_id'] ?? '')));
    $type = trim((string)($body['operation_type'] ?? ''));
    $createdAtRaw = trim((string)($body['created_at'] ?? ''));
    $payload = $body['payload'] ?? [];

    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $operationId)) {
        throw new OfflineSyncValidationException('operation_id must be a valid UUID.');
    }
    if (!in_array($type, OFFLINE_SYNC_TYPES, true)) {
        throw new OfflineSyncValidationException('This operation is not available for offline synchronization.');
    }
    if (!is_array($payload)) throw new OfflineSyncValidationException('payload must be a JSON object.');
    try {
        $created = new DateTimeImmutable($createdAtRaw);
    } catch (Throwable $_) {
        throw new OfflineSyncValidationException('created_at must be a valid timestamp.');
    }
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $createdUtc = $created->setTimezone(new DateTimeZone('UTC'));
    if ($createdUtc > $now->modify('+5 minutes')) {
        throw new OfflineSyncValidationException('The offline timestamp is more than five minutes in the future.');
    }
    if (in_array($type, ['attendance.checkin', 'attendance.checkout'], true) && $createdUtc < $now->modify('-7 days')) {
        throw new OfflineSyncValidationException('Offline attendance records cannot be more than seven days old.');
    }
    return [
        'operation_id' => $operationId,
        'operation_type' => $type,
        'created_at' => $createdUtc->format('Y-m-d H:i:s'),
        'created_at_iso' => $createdUtc->format(DateTimeInterface::ATOM),
        'payload' => $payload,
    ];
}

/** Returns a prior response when this operation was already received. */
function offlineBegin(PDO $pdo, int $userId, array $envelope, string $payloadHash): ?array
{
    offlineEnsureSchema($pdo);
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO offline_operations
                (user_id, operation_id, operation_type, payload_hash, status, client_created_at)
             VALUES (:user_id, :operation_id, :operation_type, :payload_hash, 'processing', :client_created_at)"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':operation_id' => $envelope['operation_id'],
            ':operation_type' => $envelope['operation_type'],
            ':payload_hash' => $payloadHash,
            ':client_created_at' => $envelope['created_at'],
        ]);
        return null;
    } catch (PDOException $e) {
        if ((int)($e->errorInfo[1] ?? 0) !== 1062) throw $e;
    }

    $stmt = $pdo->prepare(
        "SELECT operation_type, payload_hash, status, http_status, result_json, received_at
         FROM offline_operations WHERE user_id = :user_id AND operation_id = :operation_id LIMIT 1"
    );
    $stmt->execute([':user_id' => $userId, ':operation_id' => $envelope['operation_id']]);
    $row = $stmt->fetch();
    if (!$row) throw new OfflineSyncConflictException('The operation could not be claimed.');
    if (!hash_equals((string)$row['payload_hash'], $payloadHash) || (string)$row['operation_type'] !== $envelope['operation_type']) {
        throw new OfflineSyncConflictException('This operation ID was already used with different content.');
    }
    if ($row['status'] === 'processing') {
        $receivedAt = strtotime((string)($row['received_at'] ?? '')) ?: 0;
        if ($receivedAt > 0 && $receivedAt >= time() - 600) {
            return [
                'status' => 202,
                'body' => [
                    'ok' => false,
                    'pending' => true,
                    'operation_id' => $envelope['operation_id'],
                    'error' => 'This operation is still being processed. It will be retried safely.',
                ],
            ];
        }
        throw new OfflineSyncConflictException('A previous attempt was interrupted while processing. Review this item before retrying it.');
    }
    $result = json_decode((string)($row['result_json'] ?? ''), true);
    return [
        'status' => (int)($row['http_status'] ?: ($row['status'] === 'completed' ? 200 : 422)),
        'body' => is_array($result) ? $result : ['ok' => $row['status'] === 'completed'],
    ];
}

function offlineFinish(PDO $pdo, int $userId, string $operationId, string $status, int $httpStatus, array $result): void
{
    $stmt = $pdo->prepare(
        "UPDATE offline_operations
         SET status = :status, http_status = :http_status, result_json = :result_json, completed_at = CURRENT_TIMESTAMP
         WHERE user_id = :user_id AND operation_id = :operation_id AND status = 'processing'"
    );
    $stmt->execute([
        ':status' => $status,
        ':http_status' => $httpStatus,
        ':result_json' => json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ':user_id' => $userId,
        ':operation_id' => $operationId,
    ]);
}

function offlineRequireStudentContext(): array
{
    $session = getPhpSession();
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0 || (string)($session['account_type'] ?? '') !== 'student') {
        throw new OfflineSyncValidationException('A student account is required for this operation.');
    }
    return ['session' => $session, 'user_id' => $userId];
}

function offlineRegisterStudentEvent(PDO $pdo, int $userId, array $payload): array
{
    qrEnsureEventArchiveColumns($pdo);
    $eventId = (int)($payload['event_id'] ?? 0);
    if ($eventId <= 0) throw new OfflineSyncValidationException('A database-backed event is required.');

    $event = $pdo->prepare("SELECT event_id FROM events WHERE event_id = :event_id AND is_published = 1 AND archived_at IS NULL LIMIT 1");
    $event->execute([':event_id' => $eventId]);
    if (!$event->fetch()) throw new OfflineSyncValidationException('This event is no longer available for student registration.');

    $profile = $pdo->prepare(
        "SELECT u.student_number, CONCAT(u.first_name, ' ', u.last_name) AS full_name, sn.year_section AS section
         FROM users u LEFT JOIN student_numbers sn ON sn.student_number = u.student_number
         WHERE u.user_id = :user_id AND u.account_type = 'student' AND u.is_active = 1 LIMIT 1"
    );
    $profile->execute([':user_id' => $userId]);
    $student = $profile->fetch();
    if (!$student || trim((string)$student['student_number']) === '') throw new OfflineSyncValidationException('Student profile not found.');

    $number = trim((string)$student['student_number']);
    $existingStmt = $pdo->prepare(
        "SELECT record_id, time_in, time_out FROM attendance_records
         WHERE event_id = :event_id AND (user_id = :user_id OR student_number = :student_number) LIMIT 1"
    );
    $params = [':event_id' => $eventId, ':user_id' => $userId, ':student_number' => $number];
    $existingStmt->execute($params);
    $existing = $existingStmt->fetch();
    if ($existing) {
        if (!empty($existing['time_in']) || !empty($existing['time_out'])) {
            throw new OfflineSyncConflictException('Attendance has already been recorded; pre-registration is no longer available.');
        }
        return ['record_id' => (int)$existing['record_id'], 'already_registered' => true];
    }

    $insert = $pdo->prepare(
        "INSERT INTO attendance_records (event_id, user_id, student_number, student_name, section, time_in, time_out)
         VALUES (:event_id, :user_id, :student_number, :student_name, :section, NULL, NULL)"
    );
    try {
        $insert->execute([
            ':event_id' => $eventId,
            ':user_id' => $userId,
            ':student_number' => $number,
            ':student_name' => trim((string)$student['full_name']) ?: $number,
            ':section' => trim((string)($student['section'] ?? '')) ?: null,
        ]);
        return ['record_id' => (int)$pdo->lastInsertId(), 'already_registered' => false];
    } catch (PDOException $e) {
        if ((int)($e->errorInfo[1] ?? 0) !== 1062) throw $e;
        $existingStmt->execute($params);
        $existing = $existingStmt->fetch();
        if (!$existing || !empty($existing['time_in']) || !empty($existing['time_out'])) throw new OfflineSyncConflictException('The event registration conflicts with a newer attendance record.');
        return ['record_id' => (int)$existing['record_id'], 'already_registered' => true];
    }
}

function offlineReviewDocument(PDO $pdo, array $payload): array
{
    $session = getPhpSession();
    $isOsa = ($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff';
    $requiredRecipient = 'OSA';
    $disallowedReviewerOrgId = null;
    $requiredSubmissionOrgId = null;

    if ($isOsa) {
        $ctx = docRequireOsaContext();
        $reviewStage = 'OSA';
    } else {
        $ctx = docRequireOfficerOrgContext();
        $membership = authRequireActiveOrgMembership(false);
        $isAdviserReviewer = ($membership['account_type'] ?? '') === 'organization_adviser'
            && (int)($membership['can_review_org_documents'] ?? 0) === 1
            && (int)($membership['can_manage_org_dashboard'] ?? 0) === 0;
        if ($isAdviserReviewer) {
            $requiredRecipient = 'ADVISER';
            $requiredSubmissionOrgId = (int)$ctx['org_id'];
            $reviewStage = 'ADVISER';
        } else {
            apiRequireOrgManageAccess();
            if (!docIsSscOrganization($pdo, (int)$ctx['org_id'])) {
                throw new DocumentAuthorizationException('Only SSC officers can review SSC-addressed documents.');
            }
            $requiredRecipient = 'SSC';
            $disallowedReviewerOrgId = (int)$ctx['org_id'];
            $reviewStage = 'SSC';
        }
    }

    $submissionId = (int)($payload['submission_id'] ?? 0);
    if ($submissionId <= 0) throw new DocumentValidationException('submission_id is required.');
    $item = docReviewSubmission(
        $pdo,
        $submissionId,
        (int)$ctx['user_id'],
        (string)($payload['decision'] ?? ''),
        $payload['notes'] ?? null,
        $requiredRecipient,
        $disallowedReviewerOrgId,
        $reviewStage,
        $requiredSubmissionOrgId
    );
    return ['item' => privatePdfDecorateDocumentRow(docRedactExternalAdviserFeedback($item, getPhpSession()))];
}

function offlineDeleteIgpStudent(PDO $pdo, int $orgId, array $payload): array
{
    $userId = (int)($payload['userId'] ?? 0);
    $studentId = trim((string)($payload['studentId'] ?? ''));
    if ($userId <= 0 && $studentId === '') throw new OfflineSyncValidationException('userId or studentId is required.');
    if ($userId <= 0) {
        $lookup = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn AND account_type = 'student' LIMIT 1");
        $lookup->execute([':sn' => $studentId]);
        $userId = (int)($lookup->fetchColumn() ?: 0);
    }
    if ($userId <= 0) throw new OfflineSyncConflictException('Student not found.');
    $role = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id = :org AND role_name = 'member' LIMIT 1");
    $role->execute([':org' => $orgId]);
    $roleId = (int)($role->fetchColumn() ?: 0);
    if ($roleId <= 0) throw new OfflineSyncValidationException('Member role is not configured for this organization.');
    $stmt = $pdo->prepare("UPDATE organization_members SET is_active = 0 WHERE user_id = :uid AND org_id = :org AND role_id = :role AND is_active = 1");
    $stmt->execute([':uid' => $userId, ':org' => $orgId, ':role' => $roleId]);
    if ($stmt->rowCount() === 0) throw new OfflineSyncConflictException('Student membership was already removed or changed.');
    return ['deleted' => 1];
}

function offlineDeleteIgpOfficer(PDO $pdo, int $orgId, array $payload): array
{
    $membershipId = (int)($payload['id'] ?? 0);
    if ($membershipId <= 0) throw new OfflineSyncValidationException('id is required.');
    $stmt = $pdo->prepare("DELETE FROM organization_members WHERE membership_id = :id AND org_id = :org");
    $stmt->execute([':id' => $membershipId, ':org' => $orgId]);
    if ($stmt->rowCount() === 0) throw new OfflineSyncConflictException('Officer membership was already removed or changed.');
    return ['deleted' => 1];
}

function offlineSaveInventory(PDO $pdo, int $orgId, array $payload): array
{
    $pdo->beginTransaction();
    try {
        $itemId = igpSaveInventoryItem($pdo, $orgId, $payload);
        if ((int)($payload['apply_pricing_to_group'] ?? 0) === 1) igpApplyInventoryGroupPricing($pdo, $orgId, $itemId);
        $pdo->commit();
        return ['item_id' => $itemId];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function offlineDeleteManagedUpload(string $relativePath): void
{
    $normalized = str_replace('\\', '/', trim($relativePath));
    if (!str_starts_with($normalized, 'uploads/')) return;
    $root = realpath(dirname(__DIR__) . '/uploads');
    $target = realpath(dirname(__DIR__) . '/' . $normalized);
    if ($root && $target && str_starts_with($target, $root . DIRECTORY_SEPARATOR) && is_file($target)) @unlink($target);
}

function offlineDispatchJson(PDO $pdo, array $envelope): array
{
    $type = $envelope['operation_type'];
    $payload = $envelope['payload'];
    $payload['captured_at'] = $envelope['created_at_iso'];

    switch ($type) {
        case 'announcement.create':
            $ctx = annRequireOfficerOrgContext();
            return ['item' => annCreateAnnouncement($pdo, $ctx['org_id'], $ctx['user_id'], $payload)];
        case 'announcement.archive':
        case 'announcement.restore':
            $ctx = annRequireOfficerOrgContext();
            $announcementId = (int)($payload['announcement_id'] ?? 0);
            if ($announcementId <= 0) throw new AnnouncementValidationException('Invalid announcement.');
            return ['item' => annSetArchivedState($pdo, $ctx['org_id'], $ctx['user_id'], $announcementId, $type === 'announcement.archive')];
        case 'event.create':
            $ctx = qrRequireOfficerOrgContext();
            if ((int)($payload['event_id'] ?? 0) > 0) throw new OfflineSyncValidationException('Event updates are online-only.');
            return ['event_id' => qrSaveEvent($pdo, $ctx['org_id'], $ctx['user_id'], $payload)];
        case 'event.delete':
            $ctx = qrRequireOfficerOrgContext();
            qrDeleteEvent($pdo, $ctx['org_id'], (int)($payload['event_id'] ?? 0));
            return ['deleted' => 1];
        case 'event.archive':
            $ctx = qrRequireOfficerOrgContext();
            qrSetEventArchived($pdo, $ctx['org_id'], $ctx['user_id'], (int)($payload['event_id'] ?? 0), (string)($payload['action'] ?? ''));
            return ['event_id' => (int)($payload['event_id'] ?? 0), 'action' => strtolower((string)($payload['action'] ?? ''))];
        case 'attendance.student.delete':
            $ctx = qrRequireOfficerOrgContext();
            qrDeleteStudent($pdo, $ctx['org_id'], $payload);
            return ['deleted' => 1];
        case 'attendance.checkin':
            $ctx = qrRequireOfficerOrgContext();
            return qrCheckIn($pdo, $ctx['org_id'], $ctx['user_id'], $payload);
        case 'attendance.checkout':
            $ctx = qrRequireOfficerOrgContext();
            return qrCheckOut($pdo, $ctx['org_id'], $ctx['user_id'], $payload);
        case 'student.event.register':
            $ctx = offlineRequireStudentContext();
            return offlineRegisterStudentEvent($pdo, $ctx['user_id'], $payload);
        case 'student.rental.create':
            $ctx = offlineRequireStudentContext();
            return ['rental_id' => igpCreateStudentRental(
                $pdo,
                $ctx['user_id'],
                trim((string)($payload['organization'] ?? '')),
                trim((string)($payload['item_name'] ?? '')),
                (float)($payload['hours'] ?? 0),
                trim((string)($payload['scheduled_start'] ?? ''))
            )];
        case 'inventory.save':
            $ctx = igpRequireOfficerOrgContext();
            return offlineSaveInventory($pdo, (int)$ctx['org_id'], $payload);
        case 'inventory.delete':
            $ctx = igpRequireOfficerOrgContext();
            igpDeleteInventoryItem($pdo, (int)$ctx['org_id'], (int)($payload['item_id'] ?? 0));
            return ['deleted' => 1];
        case 'rental.return':
            $ctx = igpRequireOfficerOrgContext();
            return igpReturnRental($pdo, (int)$ctx['org_id'], $payload);
        case 'rental.mark_paid':
            $ctx = igpRequireOfficerOrgContext();
            igpMarkRentalPaid($pdo, (int)$ctx['org_id'], (int)($payload['rental_id'] ?? 0), trim((string)($payload['officer_identifier'] ?? '')));
            return ['rental_id' => (int)($payload['rental_id'] ?? 0), 'payment_status' => 'paid'];
        case 'rental.no_show':
            $ctx = igpRequireOfficerOrgContext();
            igpMarkReservationNoShow($pdo, (int)$ctx['org_id'], (int)($payload['rental_id'] ?? 0));
            return ['rental_id' => (int)($payload['rental_id'] ?? 0)];
        case 'igp.student.delete':
            $ctx = igpRequireOfficerOrgContext();
            return offlineDeleteIgpStudent($pdo, (int)$ctx['org_id'], $payload);
        case 'igp.officer.delete':
            $ctx = igpRequireOfficerOrgContext();
            return offlineDeleteIgpOfficer($pdo, (int)$ctx['org_id'], $payload);
        case 'document.review':
            return offlineReviewDocument($pdo, $payload);
        case 'document.cancel':
            $ctx = docRequireOfficerOrgContext();
            $submissionId = (int)($payload['submission_id'] ?? 0);
            if ($submissionId <= 0) throw new DocumentValidationException('submission_id is required.');
            return ['item' => privatePdfDecorateDocumentRow(docCancelSubmission($pdo, $submissionId, (int)$ctx['org_id'], (int)$ctx['user_id']))];
        case 'document.forward_ssc':
        case 'document.forward_osa':
            $ctx = docRequireOfficerOrgContext();
            $submissionId = (int)($payload['submission_id'] ?? 0);
            if ($submissionId <= 0) throw new DocumentValidationException('submission_id is required.');
            $item = $type === 'document.forward_ssc'
                ? docForwardSubmissionToSsc($pdo, $submissionId, (int)$ctx['org_id'], (int)$ctx['user_id'])
                : docForwardSubmissionToOsa($pdo, $submissionId, (int)$ctx['org_id'], (int)$ctx['user_id']);
            return ['item' => privatePdfDecorateDocumentRow($item)];
        case 'document.annotation.create':
            $session = getPhpSession();
            if (($session['login_role'] ?? '') === 'org') apiRequireOrgManageOrDocumentReviewAccess();
            $submissionId = (int)($payload['submission_id'] ?? 0);
            if ($submissionId <= 0) throw new DocumentValidationException('submission_id is required.');
            return ['item' => docCreateAnnotation($pdo, $submissionId, (int)($session['user_id'] ?? 0), $session, $payload)];
        case 'document.annotation.delete':
            $session = getPhpSession();
            if (($session['login_role'] ?? '') === 'org') apiRequireOrgManageOrDocumentReviewAccess();
            $annotationId = (int)($payload['annotation_id'] ?? 0);
            if ($annotationId <= 0) throw new DocumentValidationException('annotation_id is required.');
            return ['deleted' => docDeleteAnnotation($pdo, $annotationId, (int)($session['user_id'] ?? 0), $session) ? 1 : 0];
        case 'printing.accept':
            $ctx = stRequireOfficerContext();
            if (!stServiceEnabledForOrg($pdo, (int)$ctx['org_id'], 'printing')) throw new ServiceTrackerAuthorizationException('OSA has not enabled printing services for this organization yet.');
            $printJobId = (int)($payload['print_job_id'] ?? 0);
            $item = stAcceptPendingPrintJob($pdo, (int)$ctx['org_id'], $printJobId, (int)$ctx['user_id']);
            notificationEmailDispatchPrintingJobsBestEffort($pdo, [$printJobId]);
            return ['item' => $item];
        case 'printing.update_status':
            $ctx = stRequireOfficerContext();
            $printJobId = (int)($payload['print_job_id'] ?? 0);
            $item = stUpdatePrintJobStatus($pdo, (int)$ctx['org_id'], $printJobId, (string)($payload['status'] ?? ''), (int)$ctx['user_id'], [
                'total_cost' => $payload['total_cost'] ?? null,
                'payment_status' => $payload['payment_status'] ?? 'unpaid',
                'officer_identifier' => $payload['officer_identifier'] ?? '',
            ]);
            notificationEmailDispatchPrintingJobsBestEffort($pdo, [$printJobId]);
            return ['item' => $item];
        case 'printing.mark_paid':
            $ctx = stRequireOfficerContext();
            return ['item' => stMarkPrintJobPaid($pdo, (int)$ctx['org_id'], (int)($payload['print_job_id'] ?? 0), trim((string)($payload['officer_identifier'] ?? '')))];
        case 'locker.approve':
        case 'locker.reject':
        case 'locker.release':
            $ctx = stRequireLockerOfficerContext($pdo);
            $rentalId = (int)($payload['rental_id'] ?? 0);
            if ($rentalId <= 0) throw new ServiceTrackerValidationException('Locker request not found.');
            if ($type === 'locker.approve') return stApproveLockerRequest($pdo, (int)$ctx['org_id'], (int)$ctx['user_id'], $rentalId, $payload);
            if ($type === 'locker.reject') return stRejectLockerRequest($pdo, (int)$ctx['org_id'], (int)$ctx['user_id'], $rentalId);
            return stReleaseLocker($pdo, (int)$ctx['org_id'], (int)$ctx['user_id'], $rentalId);
        case 'locker.manual_assign':
            $ctx = stRequireLockerOfficerContext($pdo);
            return stAssignLockerManually(
                $pdo,
                (int)$ctx['org_id'],
                (int)$ctx['user_id'],
                (int)($payload['item_id'] ?? 0),
                (int)($payload['student_user_id'] ?? 0),
                $payload
            );
        case 'locker.pricing':
            $ctx = stRequireLockerOfficerContext($pdo);
            return stSaveLockerPricing($pdo, (int)$ctx['org_id'], (int)($payload['item_id'] ?? 0), $payload);
        case 'locker.notice':
            $ctx = stRequireLockerOfficerContext($pdo);
            return stSendLockerNotice(
                $pdo,
                (int)$ctx['org_id'],
                (int)$ctx['user_id'],
                (int)($payload['rental_id'] ?? 0),
                (string)($payload['notice_type'] ?? 'overdue'),
                (string)($payload['message'] ?? '')
            );
        case 'locker.clear_notice':
            $ctx = stRequireLockerOfficerContext($pdo);
            return stClearLockerNotice($pdo, (int)$ctx['org_id'], (int)$ctx['user_id'], (int)($payload['rental_id'] ?? 0));
        default:
            throw new OfflineSyncValidationException('This operation requires the upload synchronization endpoint.');
    }
}

function offlineNormalizedFiles(array $files): array
{
    $normalized = [];
    foreach ($files as $field => $entry) {
        if (!isset($entry['name'])) continue;
        if (!is_array($entry['name'])) {
            $normalized[] = ['field' => $field] + $entry;
            continue;
        }
        foreach ($entry['name'] as $index => $name) {
            $normalized[] = [
                'field' => $field,
                'name' => $name,
                'type' => $entry['type'][$index] ?? '',
                'tmp_name' => $entry['tmp_name'][$index] ?? '',
                'error' => $entry['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $entry['size'][$index] ?? 0,
            ];
        }
    }
    return $normalized;
}

function offlineDispatchUpload(PDO $pdo, array $envelope, array $files): array
{
    if ($envelope['operation_type'] === 'inventory.save') {
        $ctx = igpRequireOfficerOrgContext();
        if (count($files) !== 1 || (string)($files[0]['field'] ?? '') !== 'image') {
            throw new OfflineSyncValidationException('Exactly one inventory image is required.');
        }
        try {
            $imagePath = uploadStoreImageFile(
                $files[0],
                'inventory-items',
                'inventory_' . date('Ymd_His'),
                ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'],
                5 * 1024 * 1024,
                8000
            );
        } catch (UploadValidationException $e) {
            throw new IgpValidationException($e->getMessage(), 0, $e);
        }
        $payload = $envelope['payload'];
        $payload['image_path'] = $imagePath;
        try {
            return offlineSaveInventory($pdo, (int)$ctx['org_id'], $payload);
        } catch (Throwable $e) {
            offlineDeleteManagedUpload($imagePath);
            throw $e;
        }
    }

    if ($envelope['operation_type'] === 'student.printing.submit') {
        $ctx = stRequireStudentContext();
        if (!$files) throw new OfflineSyncValidationException('At least one printing file is required.');
        $notes = $envelope['payload']['notes'] ?? [];
        if (!is_array($notes)) $notes = [$notes];
        $items = [];
        foreach ($files as $index => $file) {
            $payload = $envelope['payload'];
            $payload['notes'] = trim((string)($notes[$index] ?? ''));
            $items[] = stSubmitPrintJob($pdo, (int)$ctx['user_id'], $payload, $file);
        }
        notificationEmailDispatchPrintingJobsBestEffort($pdo, array_column($items, 'print_job_id'));
        return ['items' => $items, 'count' => count($items)];
    }

    if ($envelope['operation_type'] === 'document.submit') {
        $ctx = docRequireOfficerOrgContext();
        if (count($files) !== 1) throw new OfflineSyncValidationException('Exactly one PDF is required for a document submission.');
        $stored = privatePdfStoreUploadedFile($files[0], 'documents', 20 * 1024 * 1024);
        try {
            $payload = $envelope['payload'];
            unset($payload['upload_token']);
            $payload['storage_key'] = $stored['storage_key'];
            $item = docCreateSubmission($pdo, $ctx['org_id'], $ctx['user_id'], $payload);
            return ['item' => privatePdfDecorateDocumentRow($item)];
        } catch (Throwable $e) {
            privatePdfDeleteStorageKey((string)$stored['storage_key']);
            throw $e;
        }
    }
    throw new OfflineSyncValidationException('This operation does not accept uploaded files.');
}
