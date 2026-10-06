<?php
require_once __DIR__ . '/../../includes/rental_charges.php';

class QuoteTestStatement extends PDOStatement
{
    public function __construct(private array $rows) {}
    public function execute(?array $params = null): bool { return true; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array
    {
        return $this->rows;
    }
}
class QuoteTestPdo extends PDO
{
    public array $queries = [];
    public float $adjustment = 0;
    public function __construct() {}
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->queries[] = $query;
        return new QuoteTestStatement(str_contains($query, 'FROM audit_logs')
            ? [['target_id' => 1, 'adjustment_total' => $this->adjustment]]
            : [['rental_id' => 1, 'quantity' => 2, 'item_cost' => 40,
                'overtime_interval_minutes' => 30, 'overtime_rate_per_block' => 5]]);
    }
}
function quoteCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
$pdo = new QuoteTestPdo();
$base = ['rental_id' => 1, 'status' => 'active', 'total_cost' => 40,
    'expected_return_time' => '2026-10-06 17:00:00'];
$now = new DateTimeImmutable('2026-10-06T17:30:01+08:00');
$quotes = igpAttachCurrentRentalCharges($pdo, [$base,
    array_replace($base, ['rental_id' => 2, 'status' => 'returned', 'total_cost' => 70]),
    array_replace($base, ['rental_id' => 3, 'status' => 'reserved']),
    array_replace($base, ['rental_id' => 4, 'service_kind' => 'locker'])], $now);
quoteCheck($quotes[0]['current_total_cost'] === 60.0, 'Active quote includes two overtime blocks for two items.');
quoteCheck($quotes[0]['overtime_cost'] === 20.0, 'Overtime breakdown matches checkout.');
quoteCheck($quotes[0]['pricing_as_of'] === '2026-10-06T17:30:01+08:00', 'Quote includes server time.');
quoteCheck($quotes[1]['current_total_cost'] === 70.0, 'Finalized rentals retain their final total.');
quoteCheck($quotes[2]['current_total_cost'] === 40.0, 'Reservations do not accrue overtime.');
quoteCheck($quotes[3]['current_total_cost'] === 40.0, 'Locker charges are unchanged.');
quoteCheck(count($pdo->queries) === 2, 'Pricing and adjustment lookups each use one batch query.');
$pdo->adjustment = -40;
$adjusted = igpAttachCurrentRentalCharges($pdo, [$base], $now)[0];
quoteCheck($adjusted['current_total_cost'] === 20.0, 'Active quote includes the approved reduction.');
quoteCheck($adjusted['charge_adjustment_total'] === -40.0, 'Adjustment remains separate from original rates.');
$later = igpAttachCurrentRentalCharges($pdo, [$base], $now->modify('+30 minutes'))[0];
quoteCheck($later['current_total_cost'] === 30.0, 'Future overtime accrues after an adjustment.');
$openOverdue = array_replace($base, ['status' => 'overdue', 'actual_return_time' => null]);
quoteCheck(igpRentalIsOpenEquipment($openOverdue), 'Unreturned overdue equipment remains open.');
$overdueQuote = igpAttachCurrentRentalCharges($pdo, [$openOverdue], $now)[0];
quoteCheck($overdueQuote['current_total_cost'] === 20.0, 'Open overdue quote includes the approved reduction.');
quoteCheck(igpAttachCurrentRentalCharges($pdo, [$openOverdue], $now->modify('+30 minutes'))[0]['current_total_cost'] === 30.0,
    'Open overdue adjustment retains future overtime charges.');
$closedOverdue = array_replace($openOverdue, ['actual_return_time' => '2026-10-06 17:30:01', 'total_cost' => 20]);
quoteCheck(!igpRentalIsOpenEquipment($closedOverdue), 'Returned overdue equipment is closed.');
quoteCheck(igpAttachCurrentRentalCharges($pdo, [$closedOverdue], $now->modify('+1 day'))[0]['current_total_cost'] === 20.0,
    'Returned overdue equipment does not accrue or apply the ledger twice.');
$finalized = igpAttachCurrentRentalCharges($pdo, [array_replace($base, ['status' => 'returned', 'total_cost' => 20])], $now)[0];
quoteCheck($finalized['current_total_cost'] === 20.0, 'Closed rentals do not apply an adjustment twice.');
quoteCheck(igpAttachCurrentRentalCharges($pdo, [], $now) === [], 'Empty list remains empty.');
echo "Shared student/officer rental quote checks passed.\n";
