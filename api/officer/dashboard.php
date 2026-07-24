<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/announcements.php';
require_once __DIR__ . '/../../includes/documents.php';
require_once __DIR__ . '/../../includes/igp.php';
require_once __DIR__ . '/../../includes/qr_attendance.php';
require_once __DIR__ . '/../../includes/notification_email_delivery.php';

header('Content-Type: application/json');
apiGuard();

try {
    $ctx = igpRequireOfficerOrgContext();
    $orgId = (int)$ctx['org_id'];
    $pdo = getPdo();
    $timezone = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $timezone);
    $monthStart = $now->modify('first day of this month')->setTime(0, 0);
    $nextMonthStart = $monthStart->modify('+1 month');
    $previousMonthStart = $monthStart->modify('-1 month');

    $financial = igpGetFinancialSummary($pdo, $orgId);
    $transactions = $financial['items'] ?? [];
    $currentRevenue = 0.0;
    $previousRevenue = 0.0;
    $activeServices = [];

    $openStatuses = [
        'rental' => ['reserved', 'active'],
        'locker' => ['reserved', 'active', 'pending', 'approved', 'locker_pending', 'locker_assigned', 'locker_active'],
        'printing' => ['queued', 'printing', 'processing', 'ready'],
    ];

    foreach ($transactions as $transaction) {
        $revenueDate = $transaction['paid_at'] ?? $transaction['transaction_date'] ?? '';
        $transactionDate = !empty($revenueDate)
            ? new DateTimeImmutable((string)$revenueDate, $timezone)
            : null;

        if (($transaction['payment_status'] ?? '') === 'paid' && $transactionDate) {
            $amount = (float)($transaction['total_cost'] ?? 0);
            if ($transactionDate >= $monthStart && $transactionDate < $nextMonthStart) {
                $currentRevenue += $amount;
            } elseif ($transactionDate >= $previousMonthStart && $transactionDate < $monthStart) {
                $previousRevenue += $amount;
            }
        }

        $serviceType = strtolower((string)($transaction['service_type'] ?? 'rental'));
        $status = strtolower((string)($transaction['status'] ?? ''));
        if (in_array($status, $openStatuses[$serviceType] ?? [], true)) {
            $activeServices[] = [
                'service_type' => $serviceType,
                'item' => trim((string)($transaction['item_label'] ?? '')) ?: ucfirst($serviceType),
                'borrower' => trim((string)($transaction['customer_name'] ?? '')) ?: '-',
                'date' => (string)($transaction['expected_return_time'] ?: $transaction['transaction_date'] ?? ''),
                'status' => $status,
            ];
        }
    }

    usort($activeServices, static fn(array $a, array $b): int => strcmp($a['date'], $b['date']));

    $revenueChange = null;
    if ($previousRevenue > 0) {
        $revenueChange = (($currentRevenue - $previousRevenue) / $previousRevenue) * 100;
    } elseif ($currentRevenue > 0) {
        $revenueChange = 100.0;
    }

    $documents = docListSubmissions($pdo, [
        'from' => $monthStart->format('Y-m-d H:i:s'),
        'to' => $nextMonthStart->modify('-1 second')->format('Y-m-d H:i:s'),
    ], $orgId);
    $documentCounts = ['pending' => 0, 'approved' => 0, 'rejected' => 0];
    foreach ($documents as $document) {
        $status = strtolower((string)($document['status'] ?? ''));
        if (array_key_exists($status, $documentCounts)) {
            $documentCounts[$status]++;
        }
    }

    $announcements = array_values(array_filter(
        annListAnnouncements($pdo, $orgId, ['published' => 1]),
        static fn(array $item): bool => (int)($item['is_published'] ?? 0) === 1
    ));
    $latestUpdates = array_map(static fn(array $item): array => [
        'id' => (int)$item['announcement_id'],
        'title' => (string)$item['title'],
        'content' => (string)$item['content'],
        'published_at' => (string)($item['published_at'] ?: $item['created_at']),
    ], array_slice($announcements, 0, 5));

    $events = qrListEvents($pdo, $orgId);
    $upcomingEvents = [];
    $completedEvents = [];
    foreach ($events as $event) {
        if (empty($event['event_datetime'])) continue;
        $eventDate = new DateTimeImmutable((string)$event['event_datetime'], $timezone);
        if ((int)($event['is_published'] ?? 0) === 1 && $eventDate >= $now) {
            $upcomingEvents[] = [
                'id' => (int)$event['event_id'],
                'name' => (string)$event['event_name'],
                'location' => (string)($event['location'] ?? ''),
                'event_datetime' => (string)$event['event_datetime'],
            ];
        } elseif ($eventDate < $now) {
            $completedEvents[] = $event;
        }
    }
    usort($upcomingEvents, static fn(array $a, array $b): int => strcmp($a['event_datetime'], $b['event_datetime']));
    usort($completedEvents, static fn(array $a, array $b): int => strcmp($b['event_datetime'], $a['event_datetime']));

    $participation = [
        'growth_percent' => null,
        'latest_event' => null,
        'latest_count' => null,
        'previous_count' => null,
    ];

    $emailDelivery = notificationEmailGetOrgFailureSummary($pdo, $orgId);
    if (count($completedEvents) >= 2) {
        $latest = $completedEvents[0];
        $previous = $completedEvents[1];
        $latestCount = (int)($latest['attended_count'] ?? $latest['attendance_count'] ?? 0);
        $previousCount = (int)($previous['attended_count'] ?? $previous['attendance_count'] ?? 0);
        $participation = [
            'growth_percent' => $previousCount > 0
                ? (($latestCount - $previousCount) / $previousCount) * 100
                : ($latestCount > 0 ? 100.0 : 0.0),
            'latest_event' => (string)$latest['event_name'],
            'latest_event_date' => (string)$latest['event_datetime'],
            'latest_count' => $latestCount,
            'previous_count' => $previousCount,
        ];
    }

    jsonOk([
        'generated_at' => $now->format(DateTimeInterface::ATOM),
        'revenue' => [
            'current' => $currentRevenue,
            'previous' => $previousRevenue,
            'change_percent' => $revenueChange,
            'period' => $monthStart->format('F Y'),
        ],
        'participation' => $participation,
        'active_services' => [
            'count' => count($activeServices),
            'items' => array_slice($activeServices, 0, 5),
        ],
        'documents' => [
            'period' => $monthStart->format('F Y'),
            'pending' => $documentCounts['pending'],
            'approved' => $documentCounts['approved'],
            'rejected' => $documentCounts['rejected'],
        ],
        'latest_updates' => array_slice($latestUpdates, 0, 2),
        'notifications' => $latestUpdates,
        'upcoming_events' => array_slice($upcomingEvents, 0, 3),
        'email_delivery' => $emailDelivery,
    ]);
} catch (IgpAuthorizationException|DocumentAuthorizationException|AnnouncementAuthorizationException|QrAttendanceAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/officer/dashboard] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    error_log('[api/officer/dashboard] ' . $e->getMessage());
    jsonError('Could not load dashboard data.', 500);
}
