<?php
require_once __DIR__ . '/../../includes/rental_adjustments.php';
$rental = ['status' => 'active', 'payment_status' => 'unpaid', 'service_kind' => 'rental'];
$body = ['revised_amount' => 20, 'expected_amount' => 100, 'reason' => 'Approved charge correction'];
$adjustment = validateOsaRentalAdjustment($rental, $body, 100);
if ($adjustment['delta'] !== -80.0 || $adjustment['amount'] !== 20.0) throw new RuntimeException('Incorrect adjustment delta.');
foreach ([
    [$rental, array_replace($body, ['reason' => '  ']), 100, 422],
    [$rental, array_replace($body, ['revised_amount' => -1]), 100, 422],
    [$rental, array_replace($body, ['revised_amount' => 'invalid']), 100, 422],
    [$rental, array_replace($body, ['revised_amount' => 100]), 100, 422],
    [$rental, $body, 105, 409],
    [array_replace($rental, ['payment_status' => 'paid']), $body, 100, 409],
    [array_replace($rental, ['status' => 'reserved']), $body, 100, 409],
    [array_replace($rental, ['service_kind' => 'locker']), $body, 100, 409],
] as [$record, $request, $current, $code]) {
    try { validateOsaRentalAdjustment($record, $request, $current); }
    catch (InvalidArgumentException $e) {
        if ($e->getCode() !== $code) throw new RuntimeException('Incorrect rejection status.');
        continue;
    }
    throw new RuntimeException('Unsafe adjustment was accepted.');
}
if (validateOsaRentalAdjustment($rental, array_replace($body, ['revised_amount' => 0]), 100)['amount'] !== 0.0)
    throw new RuntimeException('Waiver must be supported.');
echo "Adjustment validation, paid-record protection, and stale-amount checks passed.\n";
$identifier = osaRentalAdjustmentOtpIdentifier(5, 7, $body);
if (strlen($identifier) > 50) throw new RuntimeException('OTP identifier exceeds the schema limit.');
foreach ([
    [6, 7, $body], [5, 8, $body],
    [5, 7, array_replace($body, ['revised_amount' => 25])],
    [5, 7, array_replace($body, ['expected_amount' => 105])],
    [5, 7, array_replace($body, ['reason' => 'Another adjustment'])],
] as [$userId, $rentalId, $details]) {
    if (osaRentalAdjustmentOtpIdentifier($userId, $rentalId, $details) === $identifier)
        throw new RuntimeException('OTP approval must be bound to the user, rental, amounts, and reason.');
}
echo "OTP approval binding checks passed.\n";
foreach ([['reason' => []], ['reason' => true], ['reason' => "\xFF"],
    ['reason' => "\u{00A0}\u{200B}"], ['reason' => str_repeat('x', 2001)],
    ['revised_amount' => 1.234], ['revised_amount' => 100000000],
    ['revised_amount' => INF], ['revised_amount' => NAN], ['revised_amount' => true],
    ['revised_amount' => []], ['expected_amount' => INF], ['expected_amount' => []]] as $invalid) {
    try { osaRentalAdjustmentOtpIdentifier(5, 7, array_replace($body, $invalid)); }
    catch (InvalidArgumentException $e) { continue; }
    throw new RuntimeException('Malformed OTP approval details were accepted.');
}
foreach ([0, -1, true, [], 7.5, '7.5', '07', '92233720368547758070'] as $invalid) {
    try { osaRentalAdjustmentId($invalid); }
    catch (InvalidArgumentException $e) { continue; }
    throw new RuntimeException('Malformed rental ID was accepted.');
}
if (osaRentalAdjustmentId('7') !== 7) throw new RuntimeException('Valid rental ID rejected.');
echo "Malformed approval and rental ID checks passed.\n";
