const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const XLSX = require('../systems/Accounts/lib/xlsx.full.min.js');

const adviser = {employeeNumber: '0007', firstName: 'Ana', lastName: 'Cruz', email: 'ana@example.test', phone: '+63 9000000000', isActive: 0, orgCode: 'CLUB', orgName: 'Club', joinedAt: '2026-09-01', membershipActive: 0};
test('Export identifiers survive XLSX serialization and reject cross-page and unmarked files', () => {
    const api = context().window.AdviserWorkbook;
    for (const kind of ['active_users', 'users']) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['studentId'], ['001']]), 'Students');
        assert.throws(() => api.validateType(wb, kind), /new XLSX export/);
        api.stamp(wb, kind);
        const restored = XLSX.read(XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'}), {type: 'buffer'});
        assert.doesNotThrow(() => api.validateType(restored, kind));
        assert.throws(() => api.validateType(restored, kind === 'users' ? 'active_users' : 'users'), /Wrong file type/);
    }
});
function context() {
    const ctx = vm.createContext({window: {}, document: {addEventListener() {}, getElementById() { return null; }}, XLSX,
        fetch: async () => ({ok: true, json: async () => ({ok: true, items: [adviser]})})});
    vm.runInContext(fs.readFileSync('systems/Accounts/advisers.js', 'utf8'), ctx);
    return ctx;
}
test('Advisers XLSX export/import preserves employee numbers and inactive states', async () => {
    const ctx = context();
    const workbook = XLSX.utils.book_new();
    await ctx.window.AdviserWorkbook.appendSheet(workbook);
    const bytes = XLSX.write(workbook, {type: 'buffer', bookType: 'xlsx'});
    const parsed = ctx.window.AdviserWorkbook.parse(XLSX.read(bytes, {type: 'buffer'}));
    assert.equal(parsed[0].employeeNumber, '0007');
    assert.equal(parsed[0].isActive, 'false');
    assert.equal(parsed[0].membershipActive, 'false');
    assert.equal(parsed[0].email, adviser.email);
    assert.equal(ctx.window.AdviserWorkbook.isAdviserOnly(workbook), true);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{studentId: '001'}]), 'Students');
    assert.equal(ctx.window.AdviserWorkbook.isAdviserOnly(workbook), false);
});
test('Both page importers pass advisers to preview and retain them for apply', async () => {
    for (const [file, fn, input, pending] of [
        ['script.js', 'processStudentsXLSXImport', 'importStudentsFile', 'pendingAccountRoster'],
        ['student-numbers.js', 'processXLSXImport', 'csvFile', 'pendingAnnualRoster']
    ]) {
        const ctx = context();
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{studentId: '001', studentName: 'Test Student', institute: '', programCode: '', yearSection: '', academicYear: '', isActive: 'false'}]), 'Students');
        await ctx.window.AdviserWorkbook.appendSheet(wb);
        ctx.window.AdviserWorkbook.stamp(wb, file === 'script.js' ? 'active_users' : 'users');
        const bytes = XLSX.write(wb, {type: 'buffer', bookType: 'xlsx'});
        ctx.document.getElementById = id => id === input ? {files: [{arrayBuffer: async () => bytes}]} : {appendChild() {}, classList: {add() {}, remove() {}}};
        ctx.INSTITUTE_PROGRAMS = {};
        ctx.console = console;
        let received;
        ctx.window.accountsLocalStorageService = {previewAnnualRoster: async (students, advisers) => {
            received = {students, advisers}; return {academicYear: '2026-2027'};
        }};
        vm.runInContext(fs.readFileSync('systems/Accounts/' + file, 'utf8'), ctx);
        vm.runInContext('renderAccountRosterPreview = renderAnnualRosterPreview = function() {}; showToast = function(message) { throw new Error(message); };', ctx);
        ctx.window.AdviserWorkbook.describe = () => {};
        ctx.AdviserWorkbook = ctx.window.AdviserWorkbook;
        await ctx[fn]();
        assert.equal(received.advisers[0].employeeNumber, '0007');
        assert.equal(received.students[0].isActive, false);
        assert.equal(vm.runInContext(pending + '.advisers[0].membershipActive', ctx), 'false');
    }
});

test('One deactivation card separates students, officers, and advisers and downloads all 11+ affected entries', async () => {
    const ctx = context();
    const api = ctx.window.AdviserWorkbook;
    const students = Array.from({length: 10}, (_, index) => ({studentId: 'S' + index, studentName: 'Student ' + index}));
    const result = {
        changes: {deactivated: students, officersAffected: [students[0], students[1]]},
        adviserOmissions: {
            accounts: [{employeeNumber: 'A1', name: 'Adviser One'}],
            memberships: [{employeeNumber: 'A1', name: 'Adviser One', orgCode: 'CLUB'}]
        }
    };
    assert.equal(api.deactivationCount(result), 13);
    assert.match(api.deactivationCard(result), /Deactivate/);
    assert.match(api.deactivationCard(result), /10<\/strong><br>Students/);
    assert.match(api.deactivationCard(result), /2<\/strong><br>Officers/);
    assert.match(api.deactivationCard(result), /1<\/strong><br>Advisers/);
    const target = {children: [], appendChild(child) { this.children.push(child); }};
    const elements = [];
    ctx.document.getElementById = () => target;
    ctx.document.createElement = tag => {
        const element = {tag, children: [], appendChild(child) { this.children.push(child); }, addEventListener(name, fn) { this[name] = fn; }, click() {}, remove() {}};
        elements.push(element);
        return element;
    };
    ctx.document.body = {appendChild() {}};
    let downloaded;
    ctx.Blob = Blob;
    ctx.URL = {createObjectURL(blob) { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {}};
    ctx.setTimeout = () => {};
    api.appendDeactivationDetails(result, 'details');
    const headings = elements.filter(element => element.tag === 'strong').map(element => element.textContent);
    assert.deepEqual(headings, ['Students affected (10)', 'Officers affected (2)', 'Advisers affected (1)']);
    const button = elements.find(element => element.tag === 'button');
    assert.equal(button.textContent, 'Show full list (.txt)');
    button.click();
    const content = await downloaded.text();
    for (const section of ['Students (10)', 'Officers (2)', 'Advisers (1)', 'S9', 'A1', 'CLUB']) assert.ok(content.includes(section));
    assert.equal(elements.find(element => element.tag === 'a').download.endsWith('.txt'), true);
    assert.equal(api.deactivationCount({changes: {deactivated: [students[0]], officersAffected: [students[0]]}}), 2);
});

test('Adviser additions appear in the New card and preview list', () => {
    const ctx = context();
    const api = ctx.window.AdviserWorkbook;
    const result = {summary: {new: 0}, adviserChanges: {new: [{employeeNumber: 'A9', name: 'New Adviser', orgCodes: ['CLUB']}]},
        officerChanges: {new: [{studentId: 'S1', name: 'New Officer', orgCode: 'CLUB', roleName: 'President'}]}};
    assert.match(api.changeCard(result, 'new', 'New', 'text-primary'), />2<\/div><div class="text-muted">New/);
    assert.match(api.changeCard(result, 'new', 'New', 'text-primary'), /Officers/);
    const target = {children: [], appendChild(child) { this.children.push(child); }};
    ctx.document.getElementById = () => target;
    ctx.document.createElement = tag => ({tag, children: [], appendChild(child) { this.children.push(child); }});
    api.appendChangeDetails(result, 'details');
    assert.equal(target.children[0].children[0].textContent, 'New officers (1)');
    assert.match(target.children[0].children[1].children[0].textContent, /S1.*New Officer.*CLUB/);
    assert.equal(target.children[1].children[0].textContent, 'New advisers (1)');
    assert.match(target.children[1].children[1].children[0].textContent, /A9.*New Adviser.*CLUB/);
});

test('Only changed, nonzero category cells receive low-opacity green or red backgrounds', () => {
    const api = context().window.AdviserWorkbook;
    const result = {
        summary: {new: 0, unchanged: 1},
        adviserChanges: {new: [{employeeNumber: 'A1'}]},
        adviserOmissions: {accounts: [{employeeNumber: 'A1'}], memberships: []}
    };
    const added = api.changeCard(result, 'new', 'New', 'text-primary');
    assert.equal((added.match(/background:rgba\(25,135,84,\.12\)/g) || []).length, 1);
    assert.doesNotMatch(api.changeCard(result, 'unchanged', 'Unchanged', 'text-secondary'), /background:rgba/);
    const removed = api.deactivationCard(result);
    assert.equal((removed.match(/background:rgba\(220,53,69,\.12\)/g) || []).length, 1);
});
