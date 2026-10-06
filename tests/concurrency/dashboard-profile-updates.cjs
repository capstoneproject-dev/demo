const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function functionSource(source, name, nextMarker) {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf(nextMarker, start));
}

for (const [file, resetMarker] of [
    ['assets/js/officerDashboard.js', '// 4. Reset Function'],
    ['assets/js/osaDashboard.app.js', '// 5. Reset Function']
]) {
    const controls = Object.fromEntries(Object.entries({
        'repo-search-input': '', 'repo-filter-type': 'All', 'repo-filter-org': 'all',
        'repo-filter-sem': '1st Semester', 'repo-filter-year': '2026-2027', 'repo-filter-period': 'Midterm'
    }).map(([id, value]) => [id, { value }]));
    controls['repository-table-body'] = { innerHTML: '' };
    controls['repo-current-view-label'] = {};
    const item = { name: 'Matching document', category: 'Others', org: 'Organization',
        semester: '1st Semester', academicYear: '2026-2027', gradingPeriod: 'Midterm', date: '2026-10-05' };
    const context = vm.createContext({
        document: { getElementById: id => controls[id] }, repositoryData: [item],
        repoDateFilter: { from: null, to: null },
        isOfficerDocumentVisibleToActiveOrg: () => true,
        getOsaDocumentOrgFilterValue: () => '1', escapeHtml: s => s, escapeDashboardHtml: s => s
    });
    vm.runInContext(functionSource(fs.readFileSync(file, 'utf8'), 'renderRepoTable', resetMarker), context);
    context.renderRepoTable();
    assert.match(controls['repository-table-body'].innerHTML, /Matching document/);
    for (const [id, mismatch] of [['repo-filter-sem', '2nd Semester'], ['repo-filter-year', '2025-2026'], ['repo-filter-period', 'Finals']]) {
        const previous = controls[id].value;
        controls[id].value = mismatch;
        context.renderRepoTable();
        assert.match(controls['repository-table-body'].innerHTML, /No documents match/);
        controls[id].value = previous;
    }
    context.repoDateFilter = { from: '2026-10-06', to: '2026-10-07' };
    context.renderRepoTable();
    assert.match(controls['repository-table-body'].innerHTML, /No documents match/);
}

{
    const source = fs.readFileSync('assets/js/osaDashboard.app.js', 'utf8');
    const elements = Object.fromEntries(['calendar-month-label', 'selected-from-date', 'selected-to-date', 'activity-date-range-label'].map(id => [id, {}]));
    elements['calendar-dates'] = { children: [], replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } };
    elements['activity-date-range-label'].closest = () => ({ classList: { add() {} } });
    const context = vm.createContext({
        document: {
            getElementById: id => elements[id],
            createElement: () => ({ classList: { add() {} }, setAttribute() {} })
        },
        selectedFromDate: null, selectedToDate: null,
        calendarCurrentMonth: 9, calendarCurrentYear: 2026,
        currentDateContext: 'activity', activityDateFilter: {},
        syncActivityRangeInputs() {}, renderDashboardPreview() {}, closeDatePicker() {}, showToast() {}
    });
    vm.runInContext(functionSource(source, 'renderCalendar', '\nfunction changeCalendarMonth'), context);
    vm.runInContext(functionSource(source, 'applyDateRange', '\nfunction clearActivityDateFilter'), context);
    context.renderCalendar(9, 2026);
    assert.equal(elements['calendar-dates'].children.length, 42);
    assert.equal(elements['calendar-dates'].children[0].textContent, 27);
    elements['calendar-dates'].children[0].onclick();
    assert.equal(context.calendarCurrentMonth, 8);
    context.applyDateRange();
    assert.equal(context.activityDateFilter.from.getTime(), context.activityDateFilter.to.getTime());
    context.selectDate(new Date(2026, 8, 27));
    context.selectDate(new Date(2026, 9, 5));
    assert.equal(context.selectedFromDate.getMonth(), 8);
    assert.equal(context.selectedToDate.getMonth(), 9);
    context.applyDateRange();
    assert.match(elements['activity-date-range-label'].innerText, /2026/);
}

(async () => {
    const requests = [];
    const messages = [];
    const emailInput = { setAttribute() {}, insertAdjacentElement() {} };
    const status = { style: {}, replaceChildren(icon, label) { messages.push({ text: label.textContent, loading: icon.className.includes('fa-spin') }); } };
    const context = vm.createContext({ window: {}, document: {
        querySelector: () => emailInput, getElementById: () => status,
        createElement: () => ({ setAttribute() {} })
    }, fetch: async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ ok: true, challenge_token: 'challenge', verification_token: 'verified' }) };
    } });
    vm.runInContext(fs.readFileSync('assets/js/profile-email-verification.js', 'utf8'), context);
    assert.equal(await context.window.verifyProfileEmailChange('OLD@example.com', 'old@example.com'), '');
    assert.equal(requests.length, 0);
    context.window.appPrompt = async () => '123456';
    assert.equal(await context.window.verifyProfileEmailChange('new@example.com', 'old@example.com'), 'verified');
    assert.equal(requests[0].body.purpose, 'profile_email_change');
    assert.equal(requests[0].body.email, 'new@example.com');
    assert.equal(requests[1].body.challenge_token, 'challenge');
    assert.equal(messages[0].loading, true);
    assert.match(messages[0].text, /Sending/);
    assert.match(messages[1].text, /Verification code sent/);
    assert.equal(messages[2].loading, true);
    assert.equal(messages[3].text, 'New email verified.');
    context.window.appPrompt = async () => null;
    assert.equal(await context.window.verifyProfileEmailChange('another@example.com', 'old@example.com'), null);
    assert.match(messages.at(-1).text, /cancelled/);
    context.fetch = async () => ({ ok: false, json: async () => ({ ok: false, error: 'Mail delivery unavailable' }) });
    await assert.rejects(context.window.verifyProfileEmailChange('failure@example.com', 'old@example.com'), /Mail delivery unavailable/);
    assert.equal(messages.at(-1).loading, false);
    assert.equal(messages.at(-1).text, 'Mail delivery unavailable');
    console.log('Repository filters, calendar selection, and profile email verification checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
