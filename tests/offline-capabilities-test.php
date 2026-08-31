<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/offline_sync.php';

$failures = [];
$operationId = '123e4567-e89b-42d3-a456-426614174000';

try {
    $recent = offlineValidateEnvelope([
        'operation_id' => $operationId,
        'operation_type' => 'attendance.checkin',
        'created_at' => gmdate(DateTimeInterface::ATOM),
        'payload' => [],
    ]);
    if (($recent['operation_type'] ?? '') !== 'attendance.checkin') {
        $failures[] = 'A valid recent attendance timestamp was not preserved.';
    }
} catch (Throwable $e) {
    $failures[] = 'A valid recent attendance timestamp was rejected: ' . $e->getMessage();
}

try {
    offlineValidateEnvelope([
        'operation_id' => $operationId,
        'operation_type' => 'attendance.checkin',
        'created_at' => gmdate(DateTimeInterface::ATOM, time() - (8 * 86400)),
        'payload' => [],
    ]);
    $failures[] = 'An attendance timestamp older than seven days was accepted.';
} catch (OfflineSyncValidationException $e) {
    if (!str_contains($e->getMessage(), 'seven days')) {
        $failures[] = 'The old attendance timestamp returned the wrong validation error.';
    }
}

$firstHash = offlinePayloadHash('document.submit', [], [
    '0:file:a.pdf:aaa',
    '1:file:b.pdf:bbb',
]);
$reorderedHash = offlinePayloadHash('document.submit', [], [
    '1:file:b.pdf:bbb',
    '0:file:a.pdf:aaa',
]);
if (hash_equals($firstHash, $reorderedHash)) {
    $failures[] = 'Upload order was not bound into the idempotency hash.';
}

$newOfficerTypes = [
    'announcement.archive', 'announcement.restore', 'event.delete', 'event.archive',
    'attendance.student.delete', 'inventory.save', 'inventory.delete', 'rental.return',
    'rental.mark_paid', 'rental.no_show', 'igp.student.delete', 'igp.officer.delete',
    'document.review', 'document.cancel', 'document.forward_ssc', 'document.forward_osa',
    'document.annotation.create', 'document.annotation.delete', 'printing.accept',
    'printing.update_status', 'printing.mark_paid', 'locker.approve', 'locker.reject', 'locker.release',
    'locker.manual_assign', 'locker.pricing', 'locker.notice', 'locker.clear_notice',
];
foreach ($newOfficerTypes as $type) {
    try {
        $validated = offlineValidateEnvelope([
            'operation_id' => $operationId,
            'operation_type' => $type,
            'created_at' => gmdate(DateTimeInterface::ATOM),
            'payload' => [],
        ]);
        if (($validated['operation_type'] ?? '') !== $type) $failures[] = "Offline operation type {$type} was changed during validation.";
    } catch (Throwable $e) {
        $failures[] = "Offline operation type {$type} was rejected: " . $e->getMessage();
    }
}

if ($failures) {
    fwrite(STDERR, "Offline capability test failed:\n- " . implode("\n- ", $failures) . PHP_EOL);
    exit(1);
}

echo "Offline capability tests passed.\n";
