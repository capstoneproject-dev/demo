<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/services_tracker.php';
require_once __DIR__ . '/../../../includes/documents.php';
require_once __DIR__ . '/../../../includes/igp.php';

header('Content-Type: application/json');
apiGuard();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed.', 405);
}

function officerActionCenterItem(
    string $key,
    string $category,
    string $severity,
    string $title,
    string $summary,
    string $occurredAt,
    string $status,
    bool $requiresAttention,
    array $target
): array {
    return [
        'key' => $key,
        'category' => $category,
        'severity' => $severity,
        'title' => $title,
        'summary' => $summary,
        'occurred_at' => $occurredAt,
        'status' => $status,
        'requires_attention' => $requiresAttention,
        'target' => $target,
    ];
}

function officerActionCenterStudentName(array $row): string
{
    $name = trim((string)($row['student_name'] ?? $row['renter_name'] ?? ''));
    return $name !== '' ? $name : 'A student';
}

function officerActionCenterSort(array &$items): void
{
    usort($items, static function (array $left, array $right): int {
        $dateCompare = strcmp((string)($right['occurred_at'] ?? ''), (string)($left['occurred_at'] ?? ''));
        return $dateCompare !== 0
            ? $dateCompare
            : strcmp((string)($right['key'] ?? ''), (string)($left['key'] ?? ''));
    });
}

try {
    $context = stRequireOfficerContext();
    $orgId = (int)$context['org_id'];
    $pdo = getPdo();
    $notificationTimezone = new DateTimeZone('Asia/Manila');
    $notificationNow = new DateTimeImmutable('now', $notificationTimezone);

    stEnsureSchema($pdo);
    docEnsureTermColumns($pdo);
    igpExpireUnfulfilledReservations($pdo, $orgId);

    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 30;
    $limit = max(10, min(50, $limit));
    $attentionItems = [];
    $recentItems = [];

    $rentalStmt = $pdo->prepare(
        "SELECT r.rental_id,
                COALESCE(NULLIF(r.service_kind, ''), 'rental') AS service_kind,
                r.status,
                r.rent_time,
                r.expected_return_time,
                r.created_at,
                r.updated_at,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS renter_name,
                GROUP_CONCAT(i.item_name ORDER BY i.item_name SEPARATOR ', ') AS item_names
         FROM rentals r
         JOIN users u ON u.user_id = r.renter_user_id
         LEFT JOIN rental_items ri ON ri.rental_id = r.rental_id
         LEFT JOIN inventory_items i ON i.item_id = ri.item_id
         WHERE r.org_id = :org_id
           AND (
                r.status IN ('reserved', 'overdue', 'locker_pending', 'locker_overdue')
                OR (r.status IN ('active', 'locker_active') AND r.expected_return_time < NOW())
                OR (
                    r.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    AND r.status IN ('active', 'returned', 'cancelled', 'locker_active', 'locker_released', 'locker_rejected')
                )
           )
         GROUP BY r.rental_id
         ORDER BY r.updated_at DESC, r.rental_id DESC"
    );
    $rentalStmt->execute([':org_id' => $orgId]);
    foreach ($rentalStmt->fetchAll() as $row) {
        $rentalId = (int)$row['rental_id'];
        $serviceKind = strtolower((string)$row['service_kind']);
        $status = strtolower((string)$row['status']);
        $isLocker = $serviceKind === ST_LOCKER_SERVICE_KIND;
        $reservationAttentionAt = null;
        if (!$isLocker && $status === 'reserved') {
            $scheduledStartRaw = trim((string)($row['rent_time'] ?? ''));
            if ($scheduledStartRaw === '') {
                continue;
            }
            try {
                $scheduledStart = new DateTimeImmutable($scheduledStartRaw, $notificationTimezone);
            } catch (Throwable $e) {
                continue;
            }
            $reservationAttentionAt = $scheduledStart->modify('-15 minutes');
            if ($notificationNow < $reservationAttentionAt) {
                continue;
            }
        }
        $pastDue = !empty($row['expected_return_time'])
            && strtotime((string)$row['expected_return_time']) < time()
            && in_array($status, ['active', 'locker_active'], true);
        $requiresAttention = in_array($status, ['reserved', 'overdue', 'locker_pending', 'locker_overdue'], true) || $pastDue;
        $studentName = officerActionCenterStudentName($row);
        $itemNames = trim((string)($row['item_names'] ?? ''));
        $occurredAt = $reservationAttentionAt
            ? $reservationAttentionAt->format('Y-m-d H:i:s')
            : (string)($row['updated_at'] ?: $row['created_at'] ?: $row['rent_time']);

        if ($isLocker) {
            $title = ($status === ST_LOCKER_PENDING) ? 'Locker request awaiting approval' : ($requiresAttention ? 'Locker rental needs attention' : 'Locker status updated');
            $summary = $itemNames !== ''
                ? "{$studentName} · Locker {$itemNames}"
                : "{$studentName}'s locker request was updated.";
            $target = [
                'view' => 'tracker',
                'subview' => 'lockers',
                'entity_id' => $rentalId,
                'item_label' => $itemNames,
                'action' => 'open_locker',
            ];
            $category = 'locker';
        } else {
            $title = $status === 'reserved'
                ? 'Rental reservation awaiting action'
                : ($requiresAttention ? 'Rental is overdue' : 'Rental status updated');
            $summary = $itemNames !== ''
                ? "{$studentName} · {$itemNames}"
                : "{$studentName}'s rental was updated.";
            $target = [
                'view' => 'tracker',
                'subview' => 'rentals',
                'entity_id' => $rentalId,
                'action' => 'open_rental',
            ];
            $category = 'rental';
        }

        $item = officerActionCenterItem(
            "{$category}:{$rentalId}:{$status}",
            $category,
            $requiresAttention && ($pastDue || str_contains($status, 'overdue')) ? 'danger' : ($requiresAttention ? 'warning' : 'success'),
            $title,
            $summary,
            $occurredAt,
            $pastDue ? ($isLocker ? ST_LOCKER_OVERDUE : 'overdue') : $status,
            $requiresAttention,
            $target
        );
        if ($requiresAttention) {
            $attentionItems[] = $item;
        } else {
            $recentItems[] = $item;
        }
    }

    $printingStmt = $pdo->prepare(
        "SELECT pj.print_job_id,
                pj.status,
                pj.provider_auto_assigned,
                pj.provider_accepted_at,
                pj.submitted_at,
                pj.updated_at,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name
         FROM print_jobs pj
         JOIN users u ON u.user_id = pj.user_id
         WHERE pj.org_id = :org_id
           AND (
                pj.status = 'queued'
                OR (pj.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND pj.status <> 'queued')
           )
         ORDER BY pj.updated_at DESC, pj.print_job_id DESC"
    );
    $printingStmt->execute([':org_id' => $orgId]);
    foreach ($printingStmt->fetchAll() as $row) {
        $printJobId = (int)$row['print_job_id'];
        $status = strtolower((string)$row['status']);
        $requiresAttention = $status === 'queued';
        $unaccepted = $requiresAttention
            && (int)($row['provider_auto_assigned'] ?? 0) === 1
            && empty($row['provider_accepted_at']);
        $studentName = officerActionCenterStudentName($row);
        $item = officerActionCenterItem(
            "printing:{$printJobId}:{$status}",
            'printing',
            $requiresAttention ? 'warning' : 'success',
            $unaccepted ? 'Printing request awaiting acceptance' : ($requiresAttention ? 'Printing job queued' : 'Printing status updated'),
            "{$studentName}'s printing request is " . str_replace('_', ' ', $status) . '.',
            (string)($row['updated_at'] ?: $row['submitted_at']),
            $status,
            $requiresAttention,
            [
                'view' => 'tracker',
                'subview' => 'printing',
                'entity_id' => $printJobId,
                'action' => 'open_printing',
            ]
        );
        if ($requiresAttention) {
            $attentionItems[] = $item;
        } else {
            $recentItems[] = $item;
        }
    }

    $documentStmt = $pdo->prepare(
        "SELECT submission_id, title, status, reviewer_notes, submitted_at, reviewed_at, updated_at
         FROM document_submissions
         WHERE org_id = :org_id
           AND status IN ('approved', 'rejected')
           AND (
                status = 'rejected'
                OR COALESCE(reviewed_at, updated_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           )
         ORDER BY COALESCE(reviewed_at, updated_at) DESC, submission_id DESC"
    );
    $documentStmt->execute([':org_id' => $orgId]);
    foreach ($documentStmt->fetchAll() as $row) {
        $submissionId = (int)$row['submission_id'];
        $status = strtolower((string)$row['status']);
        $requiresAttention = $status === 'rejected';
        $notes = trim((string)($row['reviewer_notes'] ?? ''));
        $summary = $status === 'rejected'
            ? ($notes !== '' ? $notes : 'Review the submission and prepare a corrected version.')
            : 'The submission was approved.';
        $item = officerActionCenterItem(
            "document:{$submissionId}:{$status}",
            'document',
            $requiresAttention ? 'danger' : 'success',
            ($status === 'rejected' ? 'Document rejected: ' : 'Document approved: ') . (string)$row['title'],
            $summary,
            (string)($row['reviewed_at'] ?: $row['updated_at'] ?: $row['submitted_at']),
            $status,
            $requiresAttention,
            [
                'view' => 'documents',
                'entity_id' => $submissionId,
                'action' => 'open_document',
            ]
        );
        if ($requiresAttention) {
            $attentionItems[] = $item;
        } else {
            $recentItems[] = $item;
        }
    }

    $eventStmt = $pdo->prepare(
        "SELECT event_id, event_name, event_datetime, location
         FROM events
         WHERE org_id = :org_id
           AND is_published = 1
           AND event_datetime IS NOT NULL
           AND event_datetime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
         ORDER BY event_datetime ASC, event_id ASC"
    );
    $eventStmt->execute([':org_id' => $orgId]);
    foreach ($eventStmt->fetchAll() as $row) {
        $eventId = (int)$row['event_id'];
        $location = trim((string)($row['location'] ?? ''));
        $attentionItems[] = officerActionCenterItem(
            "event:{$eventId}:upcoming",
            'event',
            'info',
            'Event begins within 24 hours',
            (string)$row['event_name'] . ($location !== '' ? " · {$location}" : ''),
            (string)$row['event_datetime'],
            'upcoming',
            true,
            [
                'view' => 'events',
                'entity_id' => $eventId,
                'entity_name' => (string)$row['event_name'],
                'action' => 'open_event',
            ]
        );
    }

    $attendanceStmt = $pdo->prepare(
        "SELECT ar.record_id,
                ar.event_id,
                ar.student_name,
                ar.time_in,
                ar.time_out,
                ar.created_at,
                ar.updated_at,
                e.event_name
         FROM attendance_records ar
         JOIN events e ON e.event_id = ar.event_id
         WHERE e.org_id = :org_id
           AND COALESCE(ar.updated_at, ar.created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY COALESCE(ar.updated_at, ar.created_at) DESC, ar.record_id DESC
         LIMIT 100"
    );
    $attendanceStmt->execute([':org_id' => $orgId]);
    foreach ($attendanceStmt->fetchAll() as $row) {
        $recordId = (int)$row['record_id'];
        $eventId = (int)$row['event_id'];
        $studentName = officerActionCenterStudentName($row);
        if (!empty($row['time_out'])) {
            $status = 'checked_out';
            $title = 'Event attendee checked out';
        } elseif (!empty($row['time_in'])) {
            $status = 'checked_in';
            $title = 'Event attendee checked in';
        } else {
            $status = 'registered';
            $title = 'New event registration';
        }
        $recentItems[] = officerActionCenterItem(
            "attendance:{$recordId}:{$status}",
            'event',
            'info',
            $title,
            "{$studentName} · " . (string)$row['event_name'],
            (string)($row['updated_at'] ?: $row['created_at']),
            $status,
            false,
            [
                'view' => 'events',
                'entity_id' => $eventId,
                'entity_name' => (string)$row['event_name'],
                'action' => 'open_event',
            ]
        );
    }

    officerActionCenterSort($attentionItems);
    officerActionCenterSort($recentItems);

    jsonOk([
        'attention_count' => count($attentionItems),
        'attention_items' => array_slice($attentionItems, 0, $limit),
        'recent_items' => array_slice($recentItems, 0, $limit),
        'generated_at' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format(DateTimeInterface::ATOM),
    ]);
} catch (ServiceTrackerAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/officer/notifications/list] ' . $e->getMessage());
    jsonError('A database error occurred while loading alerts.', 500);
} catch (Throwable $e) {
    error_log('[api/officer/notifications/list] ' . $e->getMessage());
    jsonError('Could not load officer alerts.', 500);
}
