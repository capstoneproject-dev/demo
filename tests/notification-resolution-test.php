<?php

ini_set('session.save_path', __DIR__ . '/../storage/private');
require_once __DIR__ . '/../includes/student_notifications.php';

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

$now = new DateTimeImmutable('2026-08-22 16:00:00', new DateTimeZone('Asia/Manila'));
$cutoff = $now->modify('-24 hours');
$baseRental = [
    'rental_id' => 900001,
    'org_id' => 1,
    'organization' => 'TEST ORG',
    'items_label' => 'Test Item',
    'payment_status' => 'unpaid',
    'rent_time' => '2026-08-22 14:00:00',
    'expected_return_time' => '2026-08-22 15:00:00',
    'created_at' => '2026-08-22 13:00:00',
    'updated_at' => '2026-08-22 15:05:00',
    'paid_at' => null,
];

$unresolvedEquipment = studentNotificationBuildEquipment(
    $baseRental + ['status' => 'active', 'actual_return_time' => null],
    $now,
    $cutoff
);
$assert(!empty($unresolvedEquipment['is_unresolved']), 'A genuinely overdue active rental was hidden.');

$resolvedEquipment = studentNotificationBuildEquipment(
    $baseRental + ['status' => 'active', 'actual_return_time' => '2026-08-22 15:10:00'],
    $now,
    $cutoff
);
$assert($resolvedEquipment === null, 'A returned rental with stale active status remained actionable.');

$resolvedLocker = studentNotificationBuildLocker($baseRental + [
    'status' => 'locker_overdue',
    'locker_period_type' => 'semester',
    'actual_return_time' => '2026-08-22 15:10:00',
    'locker_notice_sent_at' => '2026-08-22 15:00:00',
    'locker_notice_message' => 'Return locker.',
    'locker_upcoming_notice_sent_at' => null,
    'locker_upcoming_notice_message' => null,
], $now, $cutoff);
$assert($resolvedLocker === null, 'A released locker with stale overdue status remained actionable.');

$resolvedPrinting = studentNotificationBuildPrinting([
    'print_job_id' => 900001,
    'org_id' => 1,
    'organization' => 'TEST ORG',
    'file_name' => 'test.pdf',
    'status' => 'queued',
    'provider_auto_assigned' => 0,
    'provider_accepted_at' => null,
    'submitted_at' => '2026-08-22 14:00:00',
    'processing_started_at' => null,
    'ready_at' => null,
    'claimed_at' => '2026-08-22 15:10:00',
    'updated_at' => '2026-08-22 15:10:00',
], $cutoff);
$assert($resolvedPrinting === null, 'A claimed print job with stale queued status remained actionable.');

echo "PASS: resolved overdue and transaction states are excluded from Needs Attention.\n";
