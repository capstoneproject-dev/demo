<?php
/**
 * Student transaction notification services.
 *
 * Builds plain, channel-neutral messages from existing transaction records so
 * the same rules can later be reused by an email delivery process.
 */

require_once __DIR__ . '/../config/db.php';

const STUDENT_NOTIFICATION_HISTORY_HOURS = 24;
const STUDENT_NOTIFICATION_RECENT_LIMIT = 5;
const STUDENT_NOTIFICATION_LOCKER_WARNING_DAYS = 7;

function studentNotificationDate(?string $value): ?DateTimeImmutable
{
    $raw = trim((string)$value);
    if ($raw === '') {
        return null;
    }

    try {
        return new DateTimeImmutable($raw, new DateTimeZone('Asia/Manila'));
    } catch (Throwable $_) {
        return null;
    }
}

function studentNotificationFormatDate(?DateTimeImmutable $date): string
{
    return $date ? $date->format('M j, Y \a\t g:i A') : 'the scheduled time';
}

function studentNotificationLatestDate(?DateTimeImmutable ...$dates): ?DateTimeImmutable
{
    $latest = null;
    foreach ($dates as $date) {
        if ($date && (!$latest || $date > $latest)) {
            $latest = $date;
        }
    }
    return $latest;
}

function studentNotificationItem(
    string $id,
    string $sourceType,
    int $sourceId,
    string $status,
    string $severity,
    string $title,
    string $message,
    string $organization,
    ?DateTimeImmutable $activityAt,
    ?DateTimeImmutable $dueAt,
    bool $isUnresolved,
    int $orgId = 0
): array {
    return [
        'id' => $id,
        'source_type' => $sourceType,
        'source_id' => $sourceId,
        'status' => $status,
        'severity' => $severity,
        'title' => $title,
        'message' => $message,
        'organization' => $organization,
        'activity_at' => $activityAt?->format('Y-m-d H:i:s'),
        'due_at' => $dueAt?->format('Y-m-d H:i:s'),
        'is_unresolved' => $isUnresolved,
        'org_id' => $orgId,
    ];
}

function studentNotificationAppendPayment(string $message, string $paymentStatus): string
{
    return strtolower($paymentStatus) === 'paid'
        ? $message . ' Payment has been recorded.'
        : $message . ' Payment is still unpaid; please coordinate with the organization.';
}

function studentNotificationRentalRows(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT r.rental_id,
                r.org_id,
                r.service_kind,
                r.locker_period_type,
                r.rent_time,
                r.expected_return_time,
                r.actual_return_time,
                r.total_cost,
                r.payment_status,
                r.paid_at,
                r.status,
                r.created_at,
                r.updated_at,
                r.locker_notice_sent_at,
                r.locker_notice_message,
                r.locker_upcoming_notice_sent_at,
                r.locker_upcoming_notice_message,
                COALESCE(o.org_code, o.org_name, 'Organization') AS organization,
                COALESCE(
                    GROUP_CONCAT(CONCAT(i.item_name, CASE WHEN ri.quantity > 1 THEN CONCAT(' (', ri.quantity, 'x)') ELSE '' END)
                                 ORDER BY i.item_name SEPARATOR ', '),
                    CASE WHEN r.service_kind = 'locker' THEN 'Locker' ELSE 'Rental item' END
                ) AS items_label
         FROM rentals r
         JOIN organizations o ON o.org_id = r.org_id
         LEFT JOIN rental_items ri ON ri.rental_id = r.rental_id
         LEFT JOIN inventory_items i ON i.item_id = ri.item_id
         WHERE r.renter_user_id = :user_id
         GROUP BY r.rental_id
         ORDER BY COALESCE(r.updated_at, r.created_at, r.rent_time) DESC"
    );
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchAll();
}

function studentNotificationPrintingRows(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT pj.print_job_id,
                pj.org_id,
                pj.user_id,
                pj.provider_auto_assigned,
                pj.provider_accepted_at,
                pj.file_name,
                pj.status,
                pj.queue_order,
                pj.submitted_at,
                pj.processing_started_at,
                pj.ready_at,
                pj.claimed_at,
                pj.updated_at,
                COALESCE(o.org_code, o.org_name, 'Organization') AS organization
         FROM print_jobs pj
         JOIN organizations o ON o.org_id = pj.org_id
         WHERE pj.user_id = :user_id
         ORDER BY COALESCE(pj.claimed_at, pj.ready_at, pj.processing_started_at, pj.provider_accepted_at, pj.updated_at, pj.submitted_at) DESC"
    );
    $stmt->execute([':user_id' => $userId]);
    return $stmt->fetchAll();
}

function studentNotificationBuildPrinting(array $row, DateTimeImmutable $cutoff): ?array
{
    $printJobId = (int)$row['print_job_id'];
    $status = strtolower(trim((string)$row['status']));
    $organization = (string)$row['organization'];
    $orgId = (int)($row['org_id'] ?? 0);
    $fileName = trim((string)($row['file_name'] ?? '')) ?: 'Your document';
    $submittedAt = studentNotificationDate($row['submitted_at'] ?? null);
    $acceptedAt = studentNotificationDate($row['provider_accepted_at'] ?? null);
    $processingAt = studentNotificationDate($row['processing_started_at'] ?? null);
    $readyAt = studentNotificationDate($row['ready_at'] ?? null);
    $claimedAt = studentNotificationDate($row['claimed_at'] ?? null);
    $updatedAt = studentNotificationDate($row['updated_at'] ?? null) ?? $submittedAt;
    $isAwaitingProvider = (int)($row['provider_auto_assigned'] ?? 0) === 1;

    if ($status === 'queued') {
        if ($acceptedAt) {
            return studentNotificationItem(
                "printing:{$printJobId}:accepted", 'printing', $printJobId, 'accepted', 'info',
                'Printing request accepted',
                "{$organization} accepted {$fileName}. It is now in the printing queue.",
                $organization, $acceptedAt, null, true, $orgId
            );
        }

        $message = $isAwaitingProvider
            ? "{$fileName} was submitted and is waiting for an authorized printing provider to accept it."
            : "{$fileName} was submitted to {$organization} and added to the printing queue.";
        return studentNotificationItem(
            "printing:{$printJobId}:submitted", 'printing', $printJobId, 'submitted', 'info',
            'Printing request submitted', $message,
            $organization, $submittedAt ?? $updatedAt, null, true, $orgId
        );
    }

    if ($status === 'processing') {
        return studentNotificationItem(
            "printing:{$printJobId}:processing", 'printing', $printJobId, 'processing', 'info',
            'Document is being printed',
            "{$organization} started processing {$fileName}.",
            $organization, $processingAt ?? $updatedAt, null, true, $orgId
        );
    }

    if ($status === 'ready_to_claim') {
        return studentNotificationItem(
            "printing:{$printJobId}:ready_to_claim", 'printing', $printJobId, 'ready_to_claim', 'urgent',
            'Document ready to claim',
            "{$fileName} is ready to claim from {$organization}.",
            $organization, $readyAt ?? $updatedAt, null, true, $orgId
        );
    }

    $completedAt = $status === 'claimed'
        ? ($claimedAt ?? $updatedAt)
        : $updatedAt;
    if (!$completedAt || $completedAt < $cutoff) {
        return null;
    }

    if ($status === 'claimed') {
        return studentNotificationItem(
            "printing:{$printJobId}:claimed", 'printing', $printJobId, 'claimed', 'success',
            'Printed document claimed',
            "{$fileName} was marked as successfully claimed from {$organization}.",
            $organization, $completedAt, null, false, $orgId
        );
    }

    if ($status === 'cancelled') {
        return studentNotificationItem(
            "printing:{$printJobId}:cancelled", 'printing', $printJobId, 'cancelled', 'warning',
            'Printing request cancelled',
            "The printing request for {$fileName} was cancelled.",
            $organization, $completedAt, null, false, $orgId
        );
    }

    return null;
}

function studentNotificationBuildEquipment(array $row, DateTimeImmutable $now, DateTimeImmutable $cutoff): ?array
{
    $rentalId = (int)$row['rental_id'];
    $status = strtolower(trim((string)$row['status']));
    $paymentStatus = strtolower(trim((string)$row['payment_status']));
    $organization = (string)$row['organization'];
    $orgId = (int)($row['org_id'] ?? 0);
    $items = trim((string)$row['items_label']) ?: 'your rented item';
    $rentAt = studentNotificationDate($row['rent_time'] ?? null);
    $dueAt = studentNotificationDate($row['expected_return_time'] ?? null);
    $actualAt = studentNotificationDate($row['actual_return_time'] ?? null);
    $paidAt = studentNotificationDate($row['paid_at'] ?? null);
    $updatedAt = studentNotificationDate($row['updated_at'] ?? null)
        ?? studentNotificationDate($row['created_at'] ?? null)
        ?? $rentAt;

    if ($status === 'reserved') {
        if ($dueAt && $dueAt <= $now) {
            return studentNotificationItem(
                "rental:{$rentalId}:no_show", 'rental', $rentalId, 'no_show', 'danger',
                'Rental reservation missed',
                "The reservation period for {$items} ended on " . studentNotificationFormatDate($dueAt) . '. Please contact ' . $organization . ' if you need assistance.',
                $organization, $dueAt, $dueAt, true, $orgId
            );
        }

        return studentNotificationItem(
            "rental:{$rentalId}:reserved", 'rental', $rentalId, 'reserved', 'info',
            'Rental reservation confirmed',
            "{$items} is reserved from " . studentNotificationFormatDate($rentAt) . ' until ' . studentNotificationFormatDate($dueAt) . '.',
            $organization, $updatedAt, $dueAt, true, $orgId
        );
    }

    if ($status === 'active') {
        $secondsRemaining = $dueAt ? $dueAt->getTimestamp() - $now->getTimestamp() : PHP_INT_MAX;
        if ($secondsRemaining <= 0) {
            return studentNotificationItem(
                "rental:{$rentalId}:overtime", 'rental', $rentalId, 'overtime', 'danger',
                'Rental is now overtime',
                "{$items} was due on " . studentNotificationFormatDate($dueAt) . '. Return it immediately to avoid additional overtime charges.',
                $organization, $dueAt ?? $now, $dueAt, true, $orgId
            );
        }
        if ($secondsRemaining <= 15 * 60) {
            return studentNotificationItem(
                "rental:{$rentalId}:urgent", 'rental', $rentalId, 'urgent', 'urgent',
                'Rental due within 15 minutes',
                "{$items} must be returned by " . studentNotificationFormatDate($dueAt) . '. Please prepare to return it now.',
                $organization, $dueAt?->modify('-15 minutes') ?? $now, $dueAt, true, $orgId
            );
        }
        if ($secondsRemaining <= 30 * 60) {
            return studentNotificationItem(
                "rental:{$rentalId}:due_soon", 'rental', $rentalId, 'due_soon', 'warning',
                'Rental due within 30 minutes',
                "{$items} must be returned by " . studentNotificationFormatDate($dueAt) . '.',
                $organization, $dueAt?->modify('-30 minutes') ?? $now, $dueAt, true, $orgId
            );
        }

        return studentNotificationItem(
            "rental:{$rentalId}:active", 'rental', $rentalId, 'active', 'info',
            'Equipment rental active',
            "You currently have {$items}. It is due on " . studentNotificationFormatDate($dueAt) . '.',
            $organization, $rentAt ?? $updatedAt, $dueAt, true, $orgId
        );
    }

    $completedAt = studentNotificationLatestDate($actualAt, $paidAt, $updatedAt);
    if (!$completedAt || $completedAt < $cutoff) {
        return null;
    }

    if ($status === 'returned') {
        $message = studentNotificationAppendPayment("{$items} was returned successfully.", $paymentStatus);
        return studentNotificationItem(
            "rental:{$rentalId}:returned_{$paymentStatus}", 'rental', $rentalId, 'returned',
            $paymentStatus === 'paid' ? 'success' : 'warning',
            'Equipment returned', $message, $organization, $completedAt, $dueAt, false, $orgId
        );
    }

    if ($status === 'overdue') {
        $message = studentNotificationAppendPayment("{$items} was returned after its expected return time.", $paymentStatus);
        return studentNotificationItem(
            "rental:{$rentalId}:returned_late_{$paymentStatus}", 'rental', $rentalId, 'returned_late',
            $paymentStatus === 'paid' ? 'warning' : 'danger',
            'Equipment returned late', $message, $organization, $completedAt, $dueAt, false, $orgId
        );
    }

    if ($status === 'cancelled') {
        return studentNotificationItem(
            "rental:{$rentalId}:no_show", 'rental', $rentalId, 'no_show', 'danger',
            'Rental reservation cancelled',
            "The reservation for {$items} was cancelled or recorded as a no-show.",
            $organization, $completedAt, $dueAt, false, $orgId
        );
    }

    return null;
}

function studentNotificationBuildLocker(array $row, DateTimeImmutable $now, DateTimeImmutable $cutoff): ?array
{
    $rentalId = (int)$row['rental_id'];
    $rawStatus = strtolower(trim((string)$row['status']));
    $periodType = strtolower(trim((string)$row['locker_period_type']));
    $status = $rawStatus === 'locker_released' && $periodType === 'pending' ? 'locker_rejected' : $rawStatus;
    $paymentStatus = strtolower(trim((string)$row['payment_status']));
    $organization = (string)$row['organization'];
    $orgId = (int)($row['org_id'] ?? 0);
    $locker = trim((string)$row['items_label']) ?: 'Your locker';
    $dueAt = studentNotificationDate($row['expected_return_time'] ?? null);
    $createdAt = studentNotificationDate($row['created_at'] ?? null);
    $updatedAt = studentNotificationDate($row['updated_at'] ?? null) ?? $createdAt;
    $actualAt = studentNotificationDate($row['actual_return_time'] ?? null);
    $paidAt = studentNotificationDate($row['paid_at'] ?? null);
    $upcomingAt = studentNotificationDate($row['locker_upcoming_notice_sent_at'] ?? null);
    $overdueAt = studentNotificationDate($row['locker_notice_sent_at'] ?? null);
    $upcomingMessage = trim((string)($row['locker_upcoming_notice_message'] ?? ''));
    $overdueMessage = trim((string)($row['locker_notice_message'] ?? ''));

    if ($status === 'locker_pending') {
        return studentNotificationItem(
            "locker:{$rentalId}:pending", 'locker', $rentalId, 'pending', 'info',
            'Locker request awaiting approval',
            "Your request for {$locker} is waiting for SSC officer approval.",
            $organization, $updatedAt, $dueAt, true, $orgId
        );
    }

    $isEffectivelyOverdue = $status === 'locker_overdue'
        || ($status === 'locker_active' && $dueAt && $dueAt < $now);
    if ($isEffectivelyOverdue) {
        $message = $overdueMessage !== ''
            ? $overdueMessage
            : "{$locker} has exceeded its rental due date. Please coordinate with SSC immediately to settle the rental and avoid pull-out action.";
        return studentNotificationItem(
            "locker:{$rentalId}:overdue", 'locker', $rentalId, 'overdue', 'danger',
            'Locker rental overdue', $message, $organization, $overdueAt ?? $dueAt ?? $updatedAt, $dueAt, true, $orgId
        );
    }

    if ($status === 'locker_active') {
        $warningEnd = $now->modify('+' . STUDENT_NOTIFICATION_LOCKER_WARNING_DAYS . ' days');
        if ($dueAt && $dueAt >= $now && $dueAt <= $warningEnd) {
            $message = $upcomingMessage !== ''
                ? $upcomingMessage
                : "{$locker} is due within 7 days. Please coordinate with SSC before " . studentNotificationFormatDate($dueAt) . ' if you need assistance.';
            return studentNotificationItem(
                "locker:{$rentalId}:upcoming", 'locker', $rentalId, 'upcoming', 'warning',
                'Locker rental ending soon', $message, $organization,
                $upcomingAt ?? $dueAt?->modify('-' . STUDENT_NOTIFICATION_LOCKER_WARNING_DAYS . ' days') ?? $now,
                $dueAt, true, $orgId
            );
        }

        $message = studentNotificationAppendPayment("{$locker} is assigned to you until " . studentNotificationFormatDate($dueAt) . '.', $paymentStatus);
        return studentNotificationItem(
            "locker:{$rentalId}:active_{$paymentStatus}", 'locker', $rentalId, 'active',
            $paymentStatus === 'paid' ? 'info' : 'warning',
            'Locker rental active', $message, $organization, $updatedAt, $dueAt, true, $orgId
        );
    }

    $completedAt = studentNotificationLatestDate($actualAt, $paidAt, $updatedAt);
    if (!$completedAt || $completedAt < $cutoff) {
        return null;
    }

    if ($status === 'locker_rejected') {
        return studentNotificationItem(
            "locker:{$rentalId}:rejected", 'locker', $rentalId, 'rejected', 'warning',
            'Locker request not approved',
            "Your request for {$locker} was not approved. You may contact SSC for more information.",
            $organization, $completedAt, $dueAt, false, $orgId
        );
    }

    if ($status === 'locker_released') {
        $message = $overdueMessage !== '' ? $overdueMessage : "{$locker} has been released.";
        $message = studentNotificationAppendPayment($message, $paymentStatus);
        return studentNotificationItem(
            "locker:{$rentalId}:released_{$paymentStatus}", 'locker', $rentalId, 'released',
            $paymentStatus === 'paid' ? 'success' : 'warning',
            'Locker rental released', $message, $organization, $completedAt, $dueAt, false, $orgId
        );
    }

    return null;
}

function studentNotificationAttendanceItems(
    PDO $pdo,
    int $userId,
    string $studentNumber,
    DateTimeImmutable $cutoff
): array {
    $whereIdentity = 'ar.user_id = :user_id';
    $params = [
        ':user_id' => $userId,
        ':created_cutoff' => $cutoff->format('Y-m-d H:i:s'),
        ':checkin_cutoff' => $cutoff->format('Y-m-d H:i:s'),
        ':checkout_cutoff' => $cutoff->format('Y-m-d H:i:s'),
    ];
    if ($studentNumber !== '') {
        $whereIdentity = '(ar.user_id = :user_id OR (ar.user_id IS NULL AND ar.student_number = :student_number))';
        $params[':student_number'] = $studentNumber;
    }

    $stmt = $pdo->prepare(
        "SELECT ar.record_id,
                e.org_id,
                ar.created_at,
                ar.time_in,
                ar.time_out,
                e.event_name,
                COALESCE(o.org_code, o.org_name, 'Organization') AS organization
         FROM attendance_records ar
         JOIN events e ON e.event_id = ar.event_id
         JOIN organizations o ON o.org_id = e.org_id
         WHERE {$whereIdentity}
           AND (ar.created_at >= :created_cutoff OR ar.time_in >= :checkin_cutoff OR ar.time_out >= :checkout_cutoff)
         ORDER BY COALESCE(ar.time_out, ar.time_in, ar.created_at) DESC"
    );
    $stmt->execute($params);

    $items = [];
    foreach ($stmt->fetchAll() as $row) {
        $recordId = (int)$row['record_id'];
        $organization = (string)$row['organization'];
        $orgId = (int)($row['org_id'] ?? 0);
        $eventName = trim((string)$row['event_name']) ?: 'the event';
        $createdAt = studentNotificationDate($row['created_at'] ?? null);
        $timeIn = studentNotificationDate($row['time_in'] ?? null);
        $timeOut = studentNotificationDate($row['time_out'] ?? null);

        $wasPreRegistered = !$timeIn
            || ($createdAt && $timeIn && ($timeIn->getTimestamp() - $createdAt->getTimestamp()) > 5);
        if ($wasPreRegistered && $createdAt && $createdAt >= $cutoff) {
            $items[] = studentNotificationItem(
                "attendance:{$recordId}:registered", 'attendance', $recordId, 'registered', 'info',
                'Event registration confirmed',
                "You are registered for {$eventName}.",
                $organization, $createdAt, null, false, $orgId
            );
        }
        if ($timeIn && $timeIn >= $cutoff) {
            $items[] = studentNotificationItem(
                "attendance:{$recordId}:checked_in", 'attendance', $recordId, 'checked_in', 'success',
                'Attendance time-in recorded',
                "Your attendance for {$eventName} was recorded at " . studentNotificationFormatDate($timeIn) . '.',
                $organization, $timeIn, null, false, $orgId
            );
        }
        if ($timeOut && $timeOut >= $cutoff) {
            $items[] = studentNotificationItem(
                "attendance:{$recordId}:checked_out", 'attendance', $recordId, 'checked_out', 'success',
                'Attendance time-out recorded',
                "Your checkout from {$eventName} was recorded at " . studentNotificationFormatDate($timeOut) . '.',
                $organization, $timeOut, null, false, $orgId
            );
        }
    }

    return $items;
}

function studentNotificationTimestamp(array $item): int
{
    $date = studentNotificationDate($item['activity_at'] ?? null);
    return $date?->getTimestamp() ?? 0;
}

function studentNotificationSeverityRank(string $severity): int
{
    return match ($severity) {
        'danger' => 0,
        'urgent' => 1,
        'warning' => 2,
        'info' => 3,
        'success' => 4,
        default => 5,
    };
}

function studentBuildTransactionNotifications(
    PDO $pdo,
    int $userId,
    string $studentNumber = '',
    int $recentLimit = STUDENT_NOTIFICATION_RECENT_LIMIT
): array
{
    $tz = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $tz);
    $cutoff = $now->modify('-' . STUDENT_NOTIFICATION_HISTORY_HOURS . ' hours');
    $unresolved = [];
    $recent = [];

    foreach (studentNotificationRentalRows($pdo, $userId) as $row) {
        $serviceKind = strtolower(trim((string)($row['service_kind'] ?? 'rental')));
        $item = $serviceKind === 'locker'
            ? studentNotificationBuildLocker($row, $now, $cutoff)
            : studentNotificationBuildEquipment($row, $now, $cutoff);
        if (!$item) {
            continue;
        }
        if (!empty($item['is_unresolved'])) {
            $unresolved[] = $item;
        } else {
            $recent[] = $item;
        }
    }

    foreach (studentNotificationPrintingRows($pdo, $userId) as $row) {
        $item = studentNotificationBuildPrinting($row, $cutoff);
        if (!$item) {
            continue;
        }
        if (!empty($item['is_unresolved'])) {
            $unresolved[] = $item;
        } else {
            $recent[] = $item;
        }
    }

    array_push($recent, ...studentNotificationAttendanceItems($pdo, $userId, trim($studentNumber), $cutoff));

    usort($unresolved, static function (array $a, array $b): int {
        $severity = studentNotificationSeverityRank((string)$a['severity'])
            <=> studentNotificationSeverityRank((string)$b['severity']);
        return $severity !== 0 ? $severity : studentNotificationTimestamp($b) <=> studentNotificationTimestamp($a);
    });
    usort($recent, static fn(array $a, array $b): int => studentNotificationTimestamp($b) <=> studentNotificationTimestamp($a));

    return array_merge($unresolved, $recentLimit > 0 ? array_slice($recent, 0, $recentLimit) : $recent);
}
