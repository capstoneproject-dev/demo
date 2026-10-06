<?php
session_set_save_handler(static fn() => true, static fn() => true,
    static fn() => '', static fn() => true, static fn() => true, static fn() => 0);
require_once __DIR__ . '/../../includes/student_notifications.php';
$now = new DateTimeImmutable('2026-10-06T12:00:00+08:00');
$cutoff = $now->modify('-24 hours');
$base = ['rental_id' => 7, 'org_id' => 1, 'organization' => 'Test Org', 'items_label' => 'Calculator',
    'status' => 'returned', 'payment_status' => 'waived', 'rent_time' => '2026-10-06 09:00:00',
    'expected_return_time' => '2026-10-06 11:00:00', 'actual_return_time' => '2026-10-06 11:30:00'];
foreach (['returned', 'overdue'] as $status) {
    foreach (['paid', 'waived', 'unpaid'] as $payment) {
        $item = studentNotificationBuildEquipment(array_replace($base, ['status' => $status, 'payment_status' => $payment]), $now, $cutoff);
        $expected = $status === 'returned' ? ($payment === 'unpaid' ? 'warning' : 'success') : ($payment === 'unpaid' ? 'danger' : 'warning');
        if ($item['severity'] !== $expected) throw new RuntimeException('Incorrect payment notification severity.');
        if ($payment === 'waived' && (!str_contains($item['message'], 'no payment is due') || str_contains($item['message'], 'unpaid') || str_contains($item['message'], 'Payment has been recorded')))
            throw new RuntimeException('Waived rental implies debt or collected payment.');
        if ($payment === 'unpaid' && !str_contains($item['message'], 'still unpaid')) throw new RuntimeException('Actual unpaid balance must still warn.');
    }
}
$open = studentNotificationBuildEquipment(array_replace($base, ['status' => 'overdue', 'payment_status' => 'unpaid', 'actual_return_time' => null]), $now, $cutoff);
if ($open['status'] !== 'overtime' || !$open['is_unresolved'] || str_contains($open['message'], 'was returned'))
    throw new RuntimeException('Unreturned overdue rental incorrectly claims a return.');
if (!str_contains(studentNotificationAppendPayment('Returned.', ' WAIVED '), 'no payment is due')) throw new RuntimeException('Payment normalization failed.');
echo "Waived, paid, unpaid, and unreturned overdue notification checks passed.\n";
