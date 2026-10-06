const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const source = fs.readFileSync('assets/js/studentDashboard.js', 'utf8');
const helper = source.slice(source.indexOf('function getStudentRentalCurrentCost('), source.indexOf('function createRentalCard('));
const clock = 1000000;
class TestDate extends Date { static now() { return clock; } }
const context = vm.createContext({ Date: TestDate });
vm.runInContext(helper, context);
const item = { quantity: 1, item_cost: 20, overtime_interval_minutes: 30, overtime_rate_per_block: 5 };
const fixtures = [
    { asOf: '2026-10-06T16:59:59+08:00', items: [item], total: 20 },
    { asOf: '2026-10-06T17:00:00+08:00', items: [item], total: 20 },
    { asOf: '2026-10-06T17:00:01+08:00', items: [item], total: 25 },
    { asOf: '2026-10-06T17:30:00+08:00', items: [item], total: 25 },
    { asOf: '2026-10-06T17:30:01+08:00', items: [item], total: 30 },
    { asOf: '2026-10-06T18:01:00+08:00', items: [item, { quantity: 2, item_cost: 40, overtime_interval_minutes: 60, overtime_rate_per_block: 3 }], total: 87 },
    { asOf: '2026-10-06T18:00:00+08:00', items: [{ ...item, overtime_rate_per_block: null }], total: 20 },
    { asOf: '2026-10-06T18:00:00+08:00', items: [{ ...item, overtime_interval_minutes: null }], total: 20 },
    { asOf: '2026-10-08T17:00:00+08:00', items: [item], total: 500 }
];
const php = process.env.PHP_BINARY || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const code = `require 'includes/rental_charges.php';
$cases = json_decode(stream_get_contents(STDIN), true);
$expected = new DateTimeImmutable('2026-10-06 17:00:00', new DateTimeZone('Asia/Manila'));
echo json_encode(array_map(fn($case) => igpCalculateRentalCharges($case['items'], $expected, new DateTimeImmutable($case['asOf'])), $cases));`;
const results = JSON.parse(execFileSync(php, ['-r', code], { cwd: path.resolve(__dirname, '../..'), input: JSON.stringify(fixtures), encoding: 'utf8' }));
const rental = {
    rental_id: 1, status: 'active', service_kind: 'rental', total_cost: 20,
    expected_return_time: '2026-10-06 17:00:00', pricing_received_at_ms: clock
};
fixtures.forEach((fixture, i) => {
    assert.equal(results[i].total_cost, fixture.total, `Server fixture ${i}`);
    assert.equal(context.getStudentRentalCurrentCost({ ...rental, pricing_as_of: fixture.asOf, overtime_pricing_items: fixture.items }), fixture.total, `Card fixture ${i}`);
});
const active = { ...rental, pricing_as_of: fixtures[3].asOf, overtime_pricing_items: [item] };
assert.equal(context.getStudentRentalCurrentCost(active, clock + 1000), 30, 'Price advances at the next overtime block');
assert.equal(context.getStudentRentalCurrentCost({ ...active, charge_adjustment_total: -10 }), 15, 'Student card applies the approved adjustment');
assert.equal(context.getStudentRentalCurrentCost({ ...active, status: 'overdue', actual_return_time: null, charge_adjustment_total: -10 }, clock + 1000), 20,
    'Unreturned overdue card retains its adjustment and advances with overtime');
assert.equal(context.getStudentRentalCurrentCost({ ...active, status: 'overdue', actual_return_time: '2026-10-06 17:30:00', current_total_cost: 15, charge_adjustment_total: -10 }, clock + 1000), 15,
    'Returned overdue card keeps the finalized balance');
assert.equal(context.getStudentRentalCurrentCost({ ...active, charge_adjustment_total: -100 }), 0, 'Displayed charge cannot become negative');
for (const extra of [{ status: 'reserved' }, { status: 'returned' }, { service_kind: 'locker' }, { pendingSync: true }, { actual_return_time: '2026-10-06 17:30:00' }]) {
    assert.equal(context.getStudentRentalCurrentCost({ ...active, ...extra }), 20, 'Do not accrue charges for non-active equipment');
}
assert.equal(context.getStudentRentalCurrentCost({ ...rental, current_total_cost: 35 }), 35, 'Use server quote if pricing metadata is unavailable');

const officerSource = fs.readFileSync('assets/js/igp-index-exact.js', 'utf8');
vm.runInContext(officerSource.slice(officerSource.indexOf('    function accumulatedPrice('), officerSource.indexOf('    function getModalInstance(')), context);
fixtures.forEach((fixture, i) => {
    assert.equal(context.accumulatedPrice({ ...rental, current_total_cost: results[i].total_cost, hourly_total: 20 }), fixture.total, 'Officer table uses backend quote');
});
assert.equal(context.accumulatedPrice({ total_cost: 0, current_total_cost: 0 }), 0);
assert.equal(context.accumulatedPrice({ total_cost: 20 }), 20);
vm.runInContext(officerSource.slice(officerSource.indexOf('    function getOpenRentalsSnapshot('), officerSource.indexOf('    function isRentalTrackerVisible(')), context);
assert.notEqual(context.getOpenRentalsSnapshot([{ ...rental, current_total_cost: 25 }]), context.getOpenRentalsSnapshot([{ ...rental, current_total_cost: 30 }]), 'Polling detects a new overdue charge');

const costs = [{}, {}];
const timers = [{ style: {} }, { style: {} }];
context.currentRentalsData = [active];
context.document = { querySelectorAll: selector => selector.includes('.rental-cost') ? costs : timers };
vm.runInContext(source.slice(source.indexOf('function updateRentalTimers()'), source.indexOf('function formatDateTime(', source.indexOf('function updateRentalTimers()'))), context);
context.updateRentalTimers();
assert.deepEqual(costs.map(cost => cost.textContent), ['₱25.00', '₱25.00']);
assert.deepEqual(timers.map(timer => timer.textContent), ['OVERDUE', 'OVERDUE']);
console.log('Rental charges match checkout rules; boundary, quantity, live-price, and both-card checks passed.');
