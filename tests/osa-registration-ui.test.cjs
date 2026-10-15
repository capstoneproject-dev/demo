const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const login = fs.readFileSync(require.resolve('../assets/js/login.js'), 'utf8');
const accounts = fs.readFileSync(require.resolve('../systems/Accounts/script.js'), 'utf8');

test('OSA registration waits for OTP, submits a pending request, and never starts a session', async () => {
    const values = {
        'osa-employee-number-input': '12-123-abcd', 'osa-name-input': 'Incoming Admin',
        'osa-email-input': 'incoming@example.invalid', 'osa-phone-input': '+63 9000000000',
        'osa-password-input': 'TestPassword123!', 'osa-confirm-password-input': 'TestPassword123!',
    };
    const fields = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }]));
    let reset = false;
    fields['form-osa'] = { reset() { reset = true; } };
    fields.osaRegisterBtn = {};
    let otpArgs;
    let submitted;
    const alerts = [];
    const context = vm.createContext({
        document: { getElementById: id => fields[id] },
        normalizePhoneInput: value => value, validateRequiredRegistrationFields: () => true,
        isValidPhoneInput: () => true, validatePasswordPair: () => true, hasPrivacyConsent: () => true,
        splitName: () => ({ first_name: 'Incoming', last_name: 'Admin' }),
        startRegistrationOtpFlow: (...args) => { otpArgs = args; },
        alert: text => alerts.push(text), container: { classList: { contains: () => false } },
        fetch: async (url, options) => {
            assert.equal(url, '../api/auth/register-osa.php');
            submitted = JSON.parse(options.body);
            return { ok: true, json: async () => ({ ok: true, status: 'pending', reg_id: 1 }) };
        },
        localStorage: { setItem() { throw Error('Registration must not set a login session'); } },
        console,
    });
    vm.runInContext(login.slice(login.indexOf('async function registerOsa()'), login.indexOf('const osaLoginOtpState')), context);
    await context.registerOsa();
    assert.equal(submitted, undefined);
    assert.equal(otpArgs[1], values['osa-email-input']);
    assert.equal(otpArgs[2], '12-123-ABCD');
    assert.equal(otpArgs[3], 'osa_registration');
    await otpArgs[4]('verified-token');
    assert.equal(submitted.verification_token, 'verified-token');
    assert.equal(submitted.employee_number, '12-123-ABCD');
    assert.equal(submitted.invitation_token, undefined);
    assert.equal(reset, true);
    assert.ok(alerts.includes('Email verified. Registration submitted for administrator approval.'));
});

test('Registration employee ID enforces segment lengths and capitalizes typing and pasted values', () => {
    const listeners = {};
    const input = { value: '', selectionStart: 0, selectionEnd: 0,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
    const context = vm.createContext({ document: { getElementById: () => input } });
    vm.runInContext(login.slice(login.indexOf('function setupOsaRegistrationEmployeeNumberInput()'), login.indexOf('async function registerOsa()')), context);
    context.setupOsaRegistrationEmployeeNumberInput();
    const edit = (value, expected) => {
        listeners.beforeinput(); input.value = value; listeners.input(); assert.equal(input.value, expected);
    };
    for (const value of ['1', '12']) edit(value, value);
    edit('123', '12');
    for (const value of ['12-', '12-1', '12-12', '12-123']) edit(value, value);
    edit('12-1234', '12-123');
    for (const [value, expected] of [['12-123-a','12-123-A'],['12-123-abcd','12-123-ABCD'],['12-123-abcde','12-123-ABCD'],['12-123-a1b2','12-123-A1B2'],['','']]) edit(value, expected);
});

test('Approve & Transfer confirms identity, clears outgoing session and redirects outside the iframe', async () => {
    let confirmed;
    let cleared;
    let redirect;
    const context = vm.createContext({
        getService: () => ({ updatePendingRequest: async () => ({ transfer_completed: true, msg: 'Transferred' }) }),
        requestIdentifier: request => request.employeeNumber,
        appConfirm: async text => { confirmed = text; return true; }, appAlert: async () => {},
        localStorage: { removeItem: key => { cleared = key; } },
        redirectFromAccounts: path => { redirect = path; },
        window: { location: { href: 'http://localhost/CAPSTONE/demo/systems/Accounts/index.html' } }, URL,
        showToast: message => { throw Error(message); },
    });
    vm.runInContext(`let pollTimer = null; let pendingRequests = [{id: 1, requestedRole: 'osa_staff', name: 'Incoming Admin', employeeNumber: '12-123-ABCD', email: 'incoming@example.invalid'}];`
        + accounts.slice(accounts.indexOf('async function approveRequest('), accounts.indexOf('async function rejectRequest(')), context);
    await context.approveRequest('1');
    assert.match(confirmed, /Incoming Admin.*12-123-ABCD.*incoming@example.invalid/);
    assert.match(confirmed, /signs you out/);
    assert.equal(cleared, 'naapAuthSession');
    assert.equal(redirect, 'http://localhost/CAPSTONE/demo/pages/login.html');
});

test('Accounts API preserves the transfer response for its caller', async () => {
    const context = vm.createContext({ window: {}, console: { log() {} },
        fetch: async () => ({ json: async () => ({ ok: true, transfer_completed: true }) }) });
    vm.runInContext(fs.readFileSync(require.resolve('../systems/Accounts/accounts-api.js'), 'utf8'), context);
    const result = await context.window.accountsPhpApiService.updatePendingRequest(1, { status: 'approved' });
    assert.equal(result.transfer_completed, true);
});

test('OSA archived accounts appear separately and only inactive accounts have archive actions', () => {
    const elements = { osaStaffRecords: {}, osaArchivedCount: {} };
    const context = vm.createContext({ document: { getElementById: id => elements[id], querySelectorAll: () => [] }, escHtml: String });
    vm.runInContext(`let osaStaffArchiveView = 'current'; let osaStaff = [
        { user_id: 1, first_name: 'Current', is_active: 1, is_primary_osa: 1, osa_archived_at: null },
        { user_id: 2, first_name: 'Former', is_active: 0, is_primary_osa: 0, osa_archived_at: null },
        { user_id: 3, first_name: 'ArchivedPerson', is_active: 0, is_primary_osa: 0, osa_archived_at: '2026-10-15' }
    ];` + accounts.slice(accounts.indexOf('function renderOsaStaffManagement()'), accounts.indexOf('function setupPrimaryOsaManagement()')), context);
    context.renderOsaStaffManagement();
    assert.match(elements.osaStaffRecords.innerHTML, /Current/);
    assert.match(elements.osaStaffRecords.innerHTML, /data-osa-archive-account="2"/);
    assert.match(elements.osaStaffRecords.innerHTML, /data-osa-transfer-account="2"/);
    assert.doesNotMatch(elements.osaStaffRecords.innerHTML, /data-osa-transfer-account="1"/);
    assert.doesNotMatch(elements.osaStaffRecords.innerHTML, /ArchivedPerson|data-osa-archive-account="1"/);
    assert.equal(elements.osaArchivedCount.textContent, 1);
    vm.runInContext("osaStaffArchiveView = 'archived'; renderOsaStaffManagement();", context);
    assert.match(elements.osaStaffRecords.innerHTML, /ArchivedPerson/);
    assert.match(elements.osaStaffRecords.innerHTML, /data-archive-action="restore"/);
    assert.doesNotMatch(elements.osaStaffRecords.innerHTML, /data-osa-transfer-account/);
    assert.doesNotMatch(elements.osaStaffRecords.innerHTML, /data-osa-archive-account="[12]"/);
});

test('Direct authority transfer confirms the target, posts its ID, and signs out the outgoing admin', async () => {
    let confirmation, payload, redirected, cleared;
    const button = { disabled: false, dataset: { osaTransferAccount: '2' } };
    const context = vm.createContext({
        appConfirm: async text => { confirmation = text; return true; }, appAlert: async () => {},
        primaryApi: async (path, options) => { assert.equal(path, 'staff/transfer-primary.php'); payload = JSON.parse(options.body); return { transfer_completed: true, message: 'Transferred' }; },
        localStorage: { removeItem: key => { cleared = key; } },
        redirectFromAccounts: path => { redirected = path; },
        window: { location: { href: 'http://localhost/CAPSTONE/demo/systems/Accounts/index.html' } }, URL,
        showPrimaryOsaNotice: message => { throw Error(message); },
    });
    vm.runInContext(`let pollTimer = null; let osaStaff = [{user_id: 2, first_name: 'Former', last_name: 'Admin', employee_number: '12-123-ABCD', email: 'former@example.invalid'}];`
        + accounts.slice(accounts.indexOf('async function transferOsaStaffAuthority('), accounts.indexOf('function formatDate(')), context);
    await context.transferOsaStaffAuthority(button);
    assert.match(confirmation, /Former Admin.*12-123-ABCD.*former@example.invalid/);
    assert.match(confirmation, /signed out/);
    assert.equal(payload.user_id, 2);
    assert.equal(cleared, 'naapAuthSession');
    assert.equal(redirected, 'http://localhost/CAPSTONE/demo/pages/login.html');
    assert.equal(button.disabled, false);
});

test('OSA registration is visible; staff management has no invitation or mutation controls', () => {
    const html = fs.readFileSync(require.resolve('../pages/login.html'), 'utf8');
    assert.doesNotMatch(html.match(/<button[^>]+id="osaRegistrationTab"[^>]+>/)[0], /hidden/);
    assert.doesNotMatch(html.match(/<input[^>]+id="osa-email-input"[^>]+>/)[0], /readonly/);
    const accountsHtml = fs.readFileSync(require.resolve('../systems/Accounts/index.html'), 'utf8');
    assert.doesNotMatch(accountsHtml, /osaInviteForm|osaInvitationRecords|data-transfer-primary|data-osa-status/);
    assert.match(accounts, /Approve &amp; Transfer/);
});

test('Student section mask supports year edits, separator deletion, and form resets without restoring stale values', () => {
    const listeners = {};
    const input = { value: '-', selectionStart: 0, selectionEnd: 0,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
    const context = vm.createContext({ document: { getElementById: () => input } });
    vm.runInContext(login.slice(login.indexOf('function setupStudentSectionInput()'), login.indexOf('function normalizeOrgName(')), context);
    context.setupStudentSectionInput();
    const edit = value => { listeners.beforeinput(); input.value = value; listeners.input(); };
    input.setSelectionRange(1, 1); listeners.click(); assert.equal(input.selectionStart, 0);
    edit('4-'); assert.equal(input.selectionStart, 2);
    edit('4-20'); assert.equal(input.value, '4-20');
    edit('-20'); edit('3-20'); assert.equal(input.value, '3-20');
    input.setSelectionRange(2, 2);
    let prevented = false; listeners.keydown({ key: 'Backspace', preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(input.selectionStart, 1);
    listeners.keydown({ key: 'Delete', preventDefault() {} }); assert.equal(input.selectionStart, 2);
    input.value = '-'; // Native form reset does not fire input.
    input.setSelectionRange(0, 0); edit('123-4'); assert.equal(input.value, '-');
    assert.equal(input.selectionStart, 0);
    for (let section = 1; section <= 20; section++) { edit('4-' + section); assert.equal(input.value, '4-' + section); }
    edit('4-21'); assert.equal(input.value, '4-20');
});

test('Both employee ID editors allow partial segment edits and reject invisible characters', () => {
    const profile = fs.readFileSync(require.resolve('../assets/js/osaDashboard.app.js'), 'utf8');
    for (const [source, fn, end] of [
        [login, 'setupOsaRegistrationEmployeeNumberInput', 'async function registerOsa()'],
        [profile, 'setupOsaEmployeeNumberInput', 'function setupOsaProfileEditor()'],
    ]) {
        const listeners = {};
        const input = { value: '12-123-ABCD', selectionStart: 0, selectionEnd: 0,
            addEventListener: (name, callback) => { listeners[name] = callback; },
            setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
        const context = vm.createContext({ document: { getElementById: () => input } });
        vm.runInContext(source.slice(source.indexOf('function ' + fn + '()'), source.indexOf(end)), context);
        context[fn]();
        for (const [value, expected] of [['2-123-ABCD','2-123-ABCD'],['12-12-ABCD','12-12-ABCD'],['12-123-éäöü','12-123-ÉÄÖÜ'],['12-123-😀😃😄😁','12-123-😀😃😄😁'],['12-123-AB\u0001D','12-123-😀😃😄😁'],['123-123-ABCD','12-123-😀😃😄😁']]) {
            listeners.beforeinput(); input.value = value; listeners.input(); assert.equal(input.value, expected, fn);
        }
    }
});

test('Student confirmation field blocks clipboard and drop actions', () => {
    const handlers = {};
    const context = vm.createContext({ document: { getElementById: () => ({ addEventListener: (name, fn) => { handlers[name] = fn; } }) } });
    vm.runInContext(login.slice(login.indexOf("  const studentConfirmPasswordInput = document.getElementById('student-confirm-password-input');"), login.indexOf("  setupPhoneInput('student-phone-input');")), context);
    for (const name of ['copy','cut','paste','drop']) {
        let blocked = false; handlers[name]({ preventDefault() { blocked = true; } }); assert.equal(blocked, true);
    }
});
