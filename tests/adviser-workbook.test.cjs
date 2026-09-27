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
