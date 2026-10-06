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
    let nowMs = 1001000;
    class TestDate extends Date { static now() { return nowMs; } }
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
    const targets = Object.fromEntries(['currentRentalsSection', 'servicesCurrentRentalsSection',
        'currentRentalsContainer', 'servicesCurrentRentalsContainer'].map(id => [id, { style: {}, cards: [],
            appendChild(card) { this.cards.push(card); } }]));
    context.document.getElementById = id => targets[id];
    const scheduled = new Map(); let sequence = 0;
    context.setInterval = (callback, delay) => {
        assert.equal(delay, 1000); scheduled.set(++sequence, callback); return sequence;
    };
    context.clearInterval = id => { scheduled.delete(id); };
    context.rentalTimerInterval = null;
    vm.runInContext(source.slice(source.indexOf('function renderCurrentRentals('), source.indexOf('function getStudentRentalCurrentCost(')), context);
    context.currentRentalsData = [rental];
    context.renderCurrentRentals();
    assert.equal(scheduled.size, 1, 'An overdue-only feed must start one timer loop');
    assert.deepEqual(timers.map(node => node.textContent), ['OVERDUE', 'OVERDUE'], 'Render must initialize both timers immediately');
    assert.equal(targets.currentRentalsContainer.cards.length, 1);
    assert.equal(targets.servicesCurrentRentalsContainer.cards.length, 1);
    nowMs += 30 * 60 * 1000;
    [...scheduled.values()][0]();
    assert.deepEqual(costs.map(node => node.textContent), ['₱25.00', '₱25.00'], 'Scheduled tick must advance both prices');
    context.renderCurrentRentals();
    assert.equal(scheduled.size, 1, 'Rerender must replace the loop instead of duplicating it');
    for (const record of [{ ...rental, status: 'reserved' },
        { ...rental, actual_return_time: '2026-10-06 17:20:00' }, { ...rental, service_kind: 'locker' }]) {
        context.currentRentalsData = [record];
        context.renderCurrentRentals();
        assert.equal(scheduled.size, 0, 'Reservations, returned records, and lockers must not start an equipment timer');
    }
    context.currentRentalsData = [{ ...rental, status: 'active' }];
    context.renderCurrentRentals();
    assert.equal(scheduled.size, 1, 'Active rental timer remains supported');
    context.currentRentalsData = [];
    context.renderCurrentRentals();
    assert.equal(scheduled.size, 0, 'Empty feed must clear the timer');
    assert.equal(targets.currentRentalsSection.style.display, 'none');
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
