const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/studentDashboard.js', 'utf8');
(async () => {
    const rental = { rental_id: 7, service_kind: 'rental', status: 'overdue', actual_return_time: null,
        payment_status: 'unpaid', rent_time: '2026-10-06 16:00:00', expected_return_time: '2026-10-06 17:00:00',
        current_total_cost: 25, total_cost: 20, pricing_as_of: '2026-10-06T17:30:00+08:00', pricing_received_at_ms: 1000000,
        charge_adjustment_total: -10, overtime_pricing_items: [{ quantity: 1, item_cost: 20, overtime_interval_minutes: 30, overtime_rate_per_block: 5 }] };
    const costs = [{}, {}], timers = [{ style: {} }, { style: {} }];
    class TestDate extends Date { static now() { return 1001000; } }
    const context = vm.createContext({ Date: TestDate, console,
        document: { createElement: () => ({ dataset: {}, setAttribute() {}, querySelector: () => null }),
            querySelectorAll: selector => selector.includes('.rental-cost') ? costs : timers },
        isStudentRentalNoShow: () => false, canStudentCancelReservation: () => false,
        formatDateTime: String, formatDate: String, renderRentalHistory() {},
        currentRentalsData: [rental], rentalHistoryData: [],
        fetch: async () => ({ ok: true, json: async () => ({ ok: true, items: [rental,
            { ...rental, rental_id: 8, actual_return_time: '2026-10-06 17:20:00' }] }) }),
        rentalFilters: { startDate: null, endDate: null, items: [], organizations: [], statuses: [], search: '' }
    });
    vm.runInContext(source.slice(source.indexOf('function getStudentRentalCurrentCost('), source.indexOf('function formatDateTime(')), context);
    const card = context.createRentalCard(rental);
    assert.match(card.innerHTML, />Overdue</);
    assert.match(card.innerHTML, /rental-timer/);
    assert.match(card.innerHTML, /Started:/);
    assert.doesNotMatch(card.innerHTML, />Reserved</);
    context.updateRentalTimers();
    assert.deepEqual(costs.map(node => node.textContent), ['₱20.00', '₱20.00']);
    assert.deepEqual(timers.map(node => node.textContent), ['OVERDUE', 'OVERDUE']);
    costs.forEach(node => { node.textContent = 'finalized'; });
    context.currentRentalsData = [{ ...rental, actual_return_time: '2026-10-06 17:20:00' }];
    context.updateRentalTimers();
    assert.ok(costs.every(node => node.textContent === 'finalized'), 'Returned records must stop accruing');
    vm.runInContext(source.slice(source.indexOf('async function loadRentalHistory('), source.indexOf('function renderRentalHistory(')), context);
    await context.loadRentalHistory();
    assert.deepEqual(Array.from(context.rentalHistoryData, row => row.rental_id), [8], 'Only returned overdue equipment belongs in history');
    vm.runInContext(source.match(/function getStatusClass\([\s\S]*?\n\}/)[0]
        + '\n' + source.match(/function getStatusText\([\s\S]*?\n\}/)[0], context);
    assert.equal(context.getStatusText('returned_late'), 'Returned Late');
    vm.runInContext(source.slice(source.indexOf('function filterRentals('), source.indexOf('// RESET ALL FILTERS')), context);
    const records = [rental, { ...rental, rental_id: 8, actual_return_time: '2026-10-06 17:20:00' }];
    context.rentalFilters.statuses = ['active'];
    assert.deepEqual(Array.from(context.filterRentals(records), row => row.rental_id), [7]);
    context.rentalFilters.statuses = ['returned'];
    assert.deepEqual(Array.from(context.filterRentals(records), row => row.rental_id), [8]);
    context.rentalFilters.statuses = [];
    context.rentalFilters.search = 'returned late';
    assert.deepEqual(Array.from(context.filterRentals(records), row => row.rental_id), [8]);
    console.log('Overdue cards, live timers, completed history, status filters, and search checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
