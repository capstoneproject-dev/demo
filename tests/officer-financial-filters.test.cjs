const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function dashboard() {
    const elements = {};
    const document = { getElementById(id) {
        return elements[id] ||= { value: '', textContent: '', innerHTML: '' };
    } };
    const context = vm.createContext({ document });
    const source = fs.readFileSync(require.resolve('../assets/js/officerDashboard.js'), 'utf8');
    vm.runInContext(`
        let officerFinancialSummaryData = [];
        let officerFinancialSummaryFilters = {};
        let officerFinancialCalendarSelectedStart = null;
        let officerFinancialCalendarSelectedEnd = null;
        function escapeHtml(value) { return String(value); }
        function formatLocalDateKey(date) {
            return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        }
    ` + source.slice(source.indexOf('function formatOfficerPeso('), source.indexOf('function exportOfficerFinancialSummaryXlsx('))
      + source.slice(source.indexOf('function clearOfficerFinancialSummaryFilters('), source.indexOf('function initializeOfficerFinancialSummaryDefaultDate(')), context);
    vm.runInContext(`officerFinancialSummaryData = [
        { service_type: 'rental', item_label: 'Camera [1]', transaction_date: '2026-10-01T10:00:00', payment_status: 'paid', total_cost: 100 },
        { service_type: 'printing', item_label: 'Poster', transaction_date: '2026-10-02T10:00:00', payment_status: 'unpaid', total_cost: 50 },
        { service_type: 'printing', item_label: 'Flyer', transaction_date: '2026-10-03T10:00:00', payment_status: 'paid', total_cost: 25 },
        { service_type: 'locker', item_label: 'L1', transaction_date: '2026-10-03T10:00:00', payment_status: 'waived', total_cost: 0 }
    ];`, context);
    return {
        elements, document,
        run: (code) => vm.runInContext(code, context),
        filter(id, value) { document.getElementById(id).value = value; vm.runInContext('renderOfficerFinancialSummary()', context); },
        text(id) { return document.getElementById(id).textContent; },
    };
}

test('Service, item, payment and date filters update totals and both tables', () => {
    const d = dashboard();
    d.run('renderOfficerFinancialSummary()');
    assert.equal(d.text('financialSummaryTotalTransactions'), '4');
    assert.equal(d.text('financialSummaryTotalRevenue'), 'P125.00');
    d.filter('financialSummaryServiceFilter', 'printing');
    assert.equal(d.text('financialSummaryTotalTransactions'), '2');
    assert.match(d.elements.financialSummaryItemFilter.innerHTML, /Poster/);
    assert.doesNotMatch(d.elements.financialSummaryTransactionsTable.innerHTML, /Camera/);
    d.filter('financialSummaryItemFilter', 'Poster');
    assert.equal(d.text('financialSummaryTotalTransactions'), '1');
    assert.equal(d.text('financialSummaryTotalUnpaid'), 'P50.00');
    assert.match(d.elements.financialSummaryTransactionsTable.innerHTML, /Poster/);
    assert.doesNotMatch(d.elements.financialSummaryDateBreakdownTable.innerHTML, /Oct 03/);
    d.filter('financialSummaryPaymentFilter', 'paid');
    assert.equal(d.elements.financialSummaryItemFilter.value, 'Poster');
    assert.equal(d.text('financialSummaryTotalTransactions'), '0');
    assert.match(d.elements.financialSummaryTransactionsTable.innerHTML, /No transactions/);
    assert.match(d.elements.financialSummaryDateBreakdownTable.innerHTML, /No date breakdown/);
    d.run('clearOfficerFinancialSummaryFilters()');
    d.run("officerFinancialSummaryFilters = { startDate: '2026-10-03', endDate: null }; renderOfficerFinancialSummary()");
    assert.equal(d.text('financialSummaryTotalTransactions'), '2');
    assert.equal(d.text('financialSummaryTotalRevenue'), 'P25.00');
    assert.doesNotMatch(d.elements.financialSummaryTransactionsTable.innerHTML, /Poster|Camera/);
});

test('Clear Filters removes the date restriction and restores every transaction', () => {
    const d = dashboard();
    d.filter('financialSummaryServiceFilter', 'locker');
    d.filter('financialSummaryPaymentFilter', 'waived');
    d.run("officerFinancialSummaryFilters = { startDate: '2026-10-15', endDate: null }; renderOfficerFinancialSummary()");
    assert.equal(d.text('financialSummaryTotalTransactions'), '0');
    d.run('clearOfficerFinancialSummaryFilters()');
    assert.equal(d.text('financialSummaryTotalTransactions'), '4');
    assert.equal(d.text('financialSummaryDateFilterLabel'), 'All Dates');
    assert.equal(d.text('financialSummaryTotalRevenue'), 'P125.00');
    assert.equal(d.text('financialSummaryTotalUnpaid'), 'P50.00');
});

test('Refreshing printing labels preserves a selected item when only its capitalization changes', () => {
    const d = dashboard();
    d.filter('financialSummaryServiceFilter', 'printing');
    d.filter('financialSummaryItemFilter', 'Poster');
    d.run("officerFinancialSummaryData[1].item_label = 'poster'; renderOfficerFinancialSummary()");
    assert.equal(d.elements.financialSummaryItemFilter.value, 'poster');
    assert.equal(d.text('financialSummaryTotalTransactions'), '1');
});
