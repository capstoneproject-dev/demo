const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
    const calls = [];
    const elements = {
        'osa-rental-adjustment-panel': { isConnected: true, innerHTML: '', replaceChildren() {} },
        'osa-rental-adjustment-save': { disabled: false },
        'osa-rental-adjustment-status': { textContent: '' },
        'osa-rental-revised-amount': { value: '20' },
        'osa-rental-adjustment-reason': { value: '  Approved reduction  ' }
    };
    let confirmed = false;
    let otpAnswers = [null];
    const context = vm.createContext({
        document: { getElementById: id => elements[id] },
        window: { appConfirm: async () => confirmed, appPrompt: async () => otpAnswers.shift(), appAlert: async () => {} },
        escapeDashboardHtml: text => String(text), formatActivityMoney: amount => `PHP ${amount}`,
        showToast() {}, loadOsaActivityFeed: async () => {}, osaActivityFeed: [],
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('/otp/send.php')) return { ok: true, json: async () => ({ ok: true, challenge_token: 'challenge', expires_in: 600, recipient_email: 'osa@example.com' }) };
            if (url.includes('/otp/verify.php')) {
                const valid = JSON.parse(options.body).otp === '123456';
                return { ok: valid, status: valid ? 200 : 422, json: async () => valid ? { ok: true, verification_token: 'verified-approval' } : { ok: false, error: 'Invalid code' } };
            }
            return { ok: true, json: async () => options.method === 'POST'
                ? { ok: true, current_total_cost: 20 }
                : { ok: true, rental: { rental_id: 7, student_name: 'Student', organization: 'Organization',
                    current_total_cost: 100, status: 'active', can_adjust: true } } };
        }
    });
    vm.runInContext(fs.readFileSync('assets/js/osa-rental-adjustment.js', 'utf8'), context);
    await context.openOsaRentalAdjustment(7);
    assert.match(elements['osa-rental-adjustment-panel'].innerHTML, /Future overdue charges/);
    await context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 0, 'Cancellation never writes');
    assert.equal(elements['osa-rental-adjustment-save'].disabled, false);
    confirmed = true;
    await context.saveOsaRentalAdjustment({ preventDefault() {} });
    assert.equal(calls.filter(call => call.url.includes('/osa/rentals/adjust.php') && call.options.method === 'POST').length, 0, 'Cancelled OTP never saves');
    otpAnswers = ['000000', '123456'];
    await context.saveOsaRentalAdjustment({ preventDefault() {} });
    const post = calls.find(call => call.url.includes('/osa/rentals/adjust.php') && call.options.method === 'POST');
    const send = calls.find(call => call.url.includes('/otp/send.php'));
    assert.equal(JSON.parse(send.options.body).purpose, 'osa_rental_adjustment');
    assert.equal(calls.filter(call => call.url.includes('/otp/send.php')).length, 1, 'Cancelled approval reuses its unexpired challenge');
    assert.equal(calls.filter(call => call.url.includes('/otp/verify.php')).length, 2, 'Incorrect code requires a successful retry');
    assert.deepEqual(JSON.parse(post.options.body), { rental_id: 7, revised_amount: 20, expected_amount: 100, reason: 'Approved reduction', verification_token: 'verified-approval' });
    assert.match(elements['osa-rental-adjustment-panel'].textContent, /saved and audited/);
    assert.equal(elements['osa-rental-adjustment-save'].disabled, false);
    console.log('OSA adjustment confirmation, request, and saving-state checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
