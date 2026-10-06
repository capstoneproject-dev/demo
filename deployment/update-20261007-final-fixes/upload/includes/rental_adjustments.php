<?php

function osaRentalAdjustmentId(mixed $value): int
{
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^[1-9][0-9]*$/D', (string)$value)
        || filter_var($value, FILTER_VALIDATE_INT) === false) {
        throw new InvalidArgumentException('Choose a valid rental.', 422);
    }
    return (int)$value;
}

function osaRentalAdjustmentMoney(mixed $value): float
{
    if ((!is_int($value) && !is_float($value) && !is_string($value)) || !is_numeric($value)) {
        throw new InvalidArgumentException('Enter a valid amount with up to two decimal places.', 422);
    }
    $amount = (float)$value;
    if (!is_finite($amount) || $amount < 0 || $amount > 99999999.99 || abs($amount - round($amount, 2)) > 0.000001) {
        throw new InvalidArgumentException('Enter a non-negative amount with up to two decimal places.', 422);
    }
    return round($amount, 2);
}

function normalizeOsaRentalAdjustmentRequest(array $body): array
{
    $reason = $body['reason'] ?? null;
    if (!is_string($reason) || preg_match('/[^\s\p{Z}\p{C}]/u', $reason) !== 1) {
        throw new InvalidArgumentException('A written reason is required.', 422);
    }
    $reason = trim($reason);
    $length = function_exists('mb_strlen') ? mb_strlen($reason, 'UTF-8') : strlen($reason);
    if ($length > 2000) throw new InvalidArgumentException('The reason must not exceed 2,000 characters.', 422);
    return ['amount' => osaRentalAdjustmentMoney($body['revised_amount'] ?? null),
        'expected' => osaRentalAdjustmentMoney($body['expected_amount'] ?? null), 'reason' => $reason];
}

/** Bind an approval code to the administrator and exact reviewed adjustment. */
function osaRentalAdjustmentOtpIdentifier(int $userId, int $rentalId, array $body): string
{
    if ($userId <= 0 || $rentalId <= 0) {
        throw new InvalidArgumentException('A rental, revised amount, current amount, and reason are required.', 422);
    }
    $request = normalizeOsaRentalAdjustmentRequest($body);
    $details = json_encode([$rentalId, number_format($request['amount'], 2, '.', ''),
        number_format($request['expected'], 2, '.', ''), $request['reason']], JSON_THROW_ON_ERROR);
    return $userId . ':' . substr(hash('sha256', $details), 0, 32);
}

/** Validate the reviewed charge before an administrator changes it. */
function validateOsaRentalAdjustment(array $rental, array $body, float $currentAmount): array
{
    if (!in_array($rental['status'] ?? '', ['active', 'returned', 'overdue'], true)
        || ($rental['payment_status'] ?? '') !== 'unpaid'
        || ($rental['service_kind'] ?? 'rental') === 'locker') {
        throw new InvalidArgumentException('Only unpaid equipment rentals can be adjusted. Paid records must retain their original payment history.', 409);
    }
    $request = normalizeOsaRentalAdjustmentRequest($body);
    $amount = $request['amount'];
    $reason = $request['reason'];
    $before = round($currentAmount, 2);
    if (abs($request['expected'] - $before) > 0.005)
        throw new InvalidArgumentException('The rental amount changed. Reopen the adjustment form to review the latest amount.', 409);
    if (abs($amount - $before) < 0.005) throw new InvalidArgumentException('The revised amount must differ from the current amount.', 422);
    return ['amount' => $amount, 'before' => $before, 'delta' => round($amount - $before, 2), 'reason' => $reason];
}
