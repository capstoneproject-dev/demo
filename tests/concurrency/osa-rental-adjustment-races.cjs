const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
    const calls = [], toasts = [];
    const elements = Object.fromEntries(['panel', 'save', 'status'].map(name => ['osa-rental-adjustment-' + name, { isConnected: true }]));
    elements['osa-rental-revised-amount'] = { value: '20' };
    elements['osa-rental-adjustment-reason'] = { value: 'Approved correction' };
    let active = true;
    elements['activity-detail-modal'] = { classList: { contains: () => active } };
    const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
    const context = vm.createContext({ document: { getElementById: id => elements[id] },
        window: { appConfirm: async () => true, appPrompt: async () => '123456', appAlert: async () => {} },
        escapeDashboardHtml: String, formatActivityMoney: String, showToast: (...args) => toasts.push(args),
        loadOsaActivityFeed: async () => {}, osaActivityFeed: [],
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('/otp/send')) return response({ ok: true, challenge_token: 'challenge', expires_in: 600, recipient_email: 'osa@example.com' });
            if (url.includes('/otp/verify')) return response({ ok: true, verification_token: 'approval' });
            return response({ ok: true, rental: { rental_id: 7, current_total_cost: 100, status: 'active', can_adjust: true } });
        }
    });
    vm.runInContext(fs.readFileSync('assets/js/osa-rental-adjustment.js', 'utf8'), context);
    return { context, elements, calls, toasts, response, close: () => { active = false; },
        writes: () => calls.filter(call => call.url.includes('/osa/rentals/adjust') && call.options.method === 'POST') };
}
(async () => {
    let f = fixture();
    const first = deferred(), second = deferred();
    f.context.fetch = url => url.endsWith('=7') ? first.promise : second.promise;
    const a = f.context.openOsaRentalAdjustment(7), b = f.context.openOsaRentalAdjustment(8);
    second.resolve(f.response({ ok: true, rental: { rental_id: 8, current_total_cost: 80, can_adjust: true } })); await b;
    first.resolve(f.response({ ok: true, rental: { rental_id: 7, current_total_cost: 100, can_adjust: true } })); await a;
    assert.equal(vm.runInContext('osaRentalAdjustmentQuote.rental_id', f.context), 8, 'Late quote must not replace newer rental');

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    const confirm = deferred(); f.context.window.appConfirm = () => confirm.promise;
    const save = f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(f.elements['osa-rental-revised-amount'].readOnly, true);
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    f.close(); confirm.resolve(true); await save;
    assert.equal(f.calls.length, 1, 'Closed modal cancels pending confirmation without OTP or save');
    assert.equal(f.elements['osa-rental-revised-amount'].readOnly, false);

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    f.context.window.appPrompt = async () => { f.close(); return '123456'; };
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(f.writes().length, 0, 'Closing during OTP must not save');

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    f.context.loadOsaActivityFeed = async () => { throw new Error('Refresh failed'); };
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(f.writes().length, 1);
    assert.match(f.elements['osa-rental-adjustment-panel'].textContent, /saved and audited/);
    assert.ok(f.toasts.every(toast => toast[1] === 'success'), 'Refresh failure must not claim a successful save failed');

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    const originalFetch = f.context.fetch;
    f.context.fetch = (url, options) => url.includes('/otp/verify') ? Promise.resolve(f.response({ ok: false, error: 'Unavailable' }, 500)) : originalFetch(url, options);
    let prompts = 0; f.context.window.appPrompt = async () => { prompts++; return '123456'; };
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(prompts, 1, 'Server failures must not consume incorrect-code retry attempts');
    assert.equal(f.writes().length, 0);
    assert.equal(vm.runInContext('osaRentalAdjustmentOtpChallenge', f.context), null);

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    for (const value of ['', '-1', '1.234', '100000000']) {
        f.elements['osa-rental-revised-amount'].value = value;
        await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    }
    assert.equal(f.calls.length, 1, 'Invalid amounts must be rejected before requesting email');
    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    const failureFetch = f.context.fetch;
    let verifyCount = 0;
    f.context.fetch = (url, options) => {
        if (url.includes('/otp/verify')) { verifyCount++; return Promise.resolve(f.response({ ok: false, error: 'Invalid code' }, 422)); }
        return failureFetch(url, options);
    };
    let answers = ['000000', '000000', '000000', '000000', null];
    f.context.window.appPrompt = async () => answers.shift();
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(vm.runInContext('osaRentalAdjustmentOtpChallenge.attempts', f.context), 4);
    answers = ['000000'];
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(verifyCount, 5, 'Cancelled prompt must preserve already-used attempts');
    assert.equal(vm.runInContext('osaRentalAdjustmentOtpChallenge', f.context), null);

    f = fixture(); await f.context.openOsaRentalAdjustment(7);
    const networkFetch = f.context.fetch;
    f.context.fetch = (url, options) => url.includes('/osa/rentals/adjust') && options.method === 'POST'
        ? Promise.reject(new Error('Connection lost')) : networkFetch(url, options);
    await f.context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(vm.runInContext('osaRentalAdjustmentQuote', f.context), null, 'Uncertain save cannot be submitted again without reopening');
    assert.match(f.elements['osa-rental-adjustment-panel'].textContent, /Reopen this rental/);
    console.log('Stale quotes, modal closure, duplicate saves, refresh errors, OTP retries, and uncertain-save checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
