<?php

/** Apply the rental's saved rates, rounding each started overtime block up. */
function igpCalculateRentalCharges(array $items, DateTimeInterface $expected, DateTimeInterface $asOf): array
{
    $overMin = max(0, (int)ceil(($asOf->getTimestamp() - $expected->getTimestamp()) / 60));
    $baseCost = 0.0;
    $overtimeCost = 0.0;
    foreach ($items as $item) {
        $baseCost += (float)($item['item_cost'] ?? 0);
        $interval = (int)($item['overtime_interval_minutes'] ?? 0);
        $rate = (float)($item['overtime_rate_per_block'] ?? 0);
        if ($overMin > 0 && $interval > 0 && $rate > 0) {
            $overtimeCost += ceil($overMin / $interval) * $rate * (int)$item['quantity'];
        }
    }
    return [
        'base_cost' => $baseCost,
        'overtime_minutes' => $overMin,
        'overtime_cost' => $overtimeCost,
        'total_cost' => $baseCost + $overtimeCost,
    ];
}

/** Active-rental corrections are retained in the append-only audit ledger. */
function igpRentalAdjustmentTotals(PDO $pdo, array $ids): array
{
    if (!$ids) return [];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT target_id, SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(after_state, '$.adjustment_delta')) AS DECIMAL(12,2))) AS adjustment_total
        FROM audit_logs WHERE action = 'rental_charge_adjusted' AND target_type = 'rental'
        AND result = 'success' AND JSON_UNQUOTE(JSON_EXTRACT(after_state, '$.applies_to_active_rental')) = 'true'
        AND target_id IN ({$placeholders}) GROUP BY target_id");
    $stmt->execute(array_map('strval', $ids));
    $totals = [];
    foreach ($stmt->fetchAll() as $row) $totals[(int)$row['target_id']] = (float)$row['adjustment_total'];
    return $totals;
}

/** Add the same current quote to student and officer rental responses. */
function igpAttachCurrentRentalCharges(PDO $pdo, array $rentals, ?DateTimeImmutable $asOf = null): array
{
    $timezone = new DateTimeZone('Asia/Manila');
    $asOf = $asOf ?? new DateTimeImmutable('now', $timezone);
    $active = array_filter($rentals, static fn(array $r): bool => ($r['status'] ?? '') === 'active'
        && empty($r['actual_return_time']) && ($r['service_kind'] ?? 'rental') !== 'locker');
    $pricingItems = [];
    if ($active) {
        $ids = array_column($active, 'rental_id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT rental_id, quantity, item_cost, overtime_interval_minutes, overtime_rate_per_block
            FROM rental_items WHERE rental_id IN ({$placeholders})");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $item) {
            $pricingItems[(int)$item['rental_id']][] = [
                'quantity' => (int)$item['quantity'],
                'item_cost' => (float)$item['item_cost'],
                'overtime_interval_minutes' => (int)($item['overtime_interval_minutes'] ?? 0),
                'overtime_rate_per_block' => (float)($item['overtime_rate_per_block'] ?? 0),
            ];
        }
    }
    $adjustments = igpRentalAdjustmentTotals($pdo, array_column($active, 'rental_id'));
    foreach ($rentals as &$rental) {
        $rental['current_total_cost'] = (float)$rental['total_cost'];
        $items = $pricingItems[(int)$rental['rental_id']] ?? [];
        if (!$items || empty($rental['expected_return_time'])) continue;
        $charges = igpCalculateRentalCharges($items,
            new DateTimeImmutable($rental['expected_return_time'], $timezone), $asOf);
        $rental['charge_adjustment_total'] = $adjustments[(int)$rental['rental_id']] ?? 0.0;
        $rental['current_total_cost'] = round(max(0, $charges['total_cost'] + $rental['charge_adjustment_total']), 2);
        $rental['base_cost'] = $charges['base_cost'];
        $rental['overtime_cost'] = $charges['overtime_cost'];
        $rental['overtime_pricing_items'] = $items;
        $rental['pricing_as_of'] = $asOf->format(DateTimeInterface::ATOM);
    }
    unset($rental);
    return $rentals;
}
