const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

let requestCount = 0;
let lastRequestBody = null;
let responsePayload = null;

const context = {
    console,
    window: {},
    document: {
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
    },
    fetch: async (_url, options) => {
        requestCount += 1;
        lastRequestBody = JSON.parse(options.body);
        return {
            ok: true,
            async json() { return responsePayload; },
        };
    },
    formatOfficerPeso(value) {
        return `PHP ${Number(value || 0).toFixed(2)}`;
    },
    setTimeout,
    clearTimeout,
};

vm.createContext(context);
vm.runInContext(
    fs.readFileSync('assets/js/officerAnalytics.js', 'utf8'),
    context,
    { filename: 'assets/js/officerAnalytics.js' }
);

const snapshot = {
    filters: { academicYear: '2026-2027', mode: {} },
    totals: { revenue: 1000, participationAverage: 40, participationTotal: 120 },
    summaries: { participation: 'Medium' },
    counts: {
        financial: { total: 10, paid: 7, outstanding: 3 },
        rentals: { active: 6, pending: 3, overdue: 1 },
        docs: { approved: 12, pending: 6, rejected: 2 },
    },
    charts: {
        revenue: { labels: ['January', 'February'], values: [400, 600] },
        participation: { labels: ['Assembly', 'Workshop'], values: [50, 70] },
    },
    events: [],
};

const rejectionPatterns = context.buildOfficerDocumentRejectionPatterns([
    {
        status: 'Rejected',
        rawStatus: 'rejected',
        osaDecision: 'rejected',
        osaReviewerNotes: 'Missing attachment and signature.',
    },
    {
        status: 'Rejected',
        rawStatus: 'rejected',
        reviewerNotes: 'Incomplete requirements were submitted.',
    },
]);
assert.strictEqual(rejectionPatterns.rejectedWithNotes, 2);
assert.strictEqual(rejectionPatterns.categories[0].key, 'missing_requirements');
assert.strictEqual(rejectionPatterns.categories[0].count, 2);

const rentalPatterns = context.buildOfficerRentalFrequencyPatterns([
    { itemsLabel: 'Camera [CAM-1], Microphone [MIC-1]' },
    { itemsLabel: 'Camera [CAM-1]' },
    { itemsLabel: 'Projector [PRO-1]' },
]);
assert.strictEqual(rentalPatterns.mostRented[0].name, 'Camera');
assert.strictEqual(rentalPatterns.mostRented[0].count, 2);
assert.ok(rentalPatterns.leastRented.some((item) => item.name === 'Projector'));

const balancePatterns = context.buildOfficerFinancialBalancePatterns([
    { customer_identifier: 'S-1', payment_status: 'unpaid', total_cost: 100 },
    { customer_identifier: 'S-1', payment_status: 'unpaid', total_cost: 50 },
    { customer_identifier: 'S-2', payment_status: 'paid', total_cost: 80 },
]);
assert.strictEqual(balancePatterns.customersWithOutstanding, 1);
assert.strictEqual(balancePatterns.repeatOutstandingCustomers, 1);
assert.strictEqual(balancePatterns.outstandingAmount, 150);

const eventPatterns = context.buildOfficerEventParticipationPatterns([
    { participants: 10 },
    { participants: 20 },
    { participants: 60 },
]);
assert.strictEqual(eventPatterns.medianAttendance, 20);
assert.strictEqual(eventPatterns.aboveAverageEvents, 1);

const safeRequest = context.buildOfficerAnalyticsInsightsRequest({
    ...snapshot,
    patterns: {
        documentRejections: rejectionPatterns,
        rentalFrequency: rentalPatterns,
        financialBalances: balancePatterns,
        eventParticipation: eventPatterns,
    },
    docs: [{ reviewerNotes: 'PRIVATE REVIEW NOTE' }],
    financial: [{ customer_identifier: 'PRIVATE-STUDENT-ID' }],
});
const safeRequestText = JSON.stringify(safeRequest);
assert.strictEqual(safeRequestText.includes('PRIVATE REVIEW NOTE'), false);
assert.strictEqual(safeRequestText.includes('PRIVATE-STUDENT-ID'), false);
assert.ok(safeRequest.snapshot.patterns.documentRejections.categories.length > 0);

const ruleBasedPayload = {
    ok: true,
    provider: 'rule-based',
    fallbackUsed: true,
    chartSummaries: {
        financial: 'Rule financial.',
        participation: 'Rule participation.',
        inventory: 'Rule inventory.',
        documents: 'Rule documents.',
    },
    exportSections: {
        revenueSeries: 'Rule revenue section.',
        eventParticipation: 'Rule event section.',
        financialTransactions: 'Rule transaction section.',
        rentalRecords: 'Rule rental section.',
        documentWorkflow: 'Rule document section.',
    },
    exportSummary: 'Rule export summary.',
};

const geminiPayload = {
    ...ruleBasedPayload,
    provider: 'gemini:gemini-2.5-flash',
    fallbackUsed: false,
    exportSummary: 'Gemini export summary.',
};

(async () => {
    const emergency = context.buildOfficerAnalyticsFallbackInsights(snapshot);
    assert.deepStrictEqual(
        Object.keys(emergency.exportSections),
        ['revenueSeries', 'eventParticipation', 'financialTransactions', 'rentalRecords', 'documentWorkflow']
    );
    Object.values(emergency.exportSections).forEach((section) => assert.ok(section.trim()));

    responsePayload = geminiPayload;
    const uncachedExport = await context.getOfficerAnalyticsInsightsData({ snapshot, render: false });
    assert.strictEqual(Object.hasOwn(lastRequestBody, 'ruleBasedOnly'), false, 'Export must not force a provider choice.');
    assert.strictEqual(uncachedExport.provider, 'gemini:gemini-2.5-flash');
    assert.strictEqual(uncachedExport.exportSummary, 'Gemini export summary.');

    const requestsBeforeCachedExport = requestCount;
    const cachedExport = await context.getOfficerAnalyticsInsightsData({ snapshot, render: false });
    assert.strictEqual(requestCount, requestsBeforeCachedExport, 'Export must reuse an exact cached insight result.');
    assert.strictEqual(cachedExport.provider, 'gemini:gemini-2.5-flash');
    assert.strictEqual(cachedExport.exportSummary, 'Gemini export summary.');

    responsePayload = ruleBasedPayload;
    const fallbackSnapshot = {
        ...snapshot,
        filters: { academicYear: '2027-2028', mode: {} },
    };
    const providerFallback = await context.getOfficerAnalyticsInsightsData({
        snapshot: fallbackSnapshot,
        render: false,
    });
    assert.strictEqual(Object.hasOwn(lastRequestBody, 'ruleBasedOnly'), false, 'Fallback export must use the normal provider flow.');
    assert.strictEqual(providerFallback.provider, 'rule-based');
    assert.strictEqual(providerFallback.exportSections.revenueSeries, 'Rule revenue section.');

    console.log('Officer analytics export insight tests passed.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
