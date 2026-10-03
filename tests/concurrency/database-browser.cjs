// Headless Edge checks for isolated accounts prepared by database-features.php.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const delay = ms => new Promise(r => setTimeout(r, ms));
const manifestPath = path.join(os.tmpdir(), 'capstone-feature-check-' + crypto.createHash('sha256').update(__dirname).digest('hex').slice(0, 12) + '.json');
const fixture = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'capstone-edge-'));
const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const results = [];
console.log('Starting isolated Edge browser verification.');
(async () => {
    let socket;
    try {
        for (let i = 0; i < 40; i++) { try { await fetch('http://127.0.0.1:9224/json/version'); break; } catch { await delay(250); } }
        const target = await (await fetch('http://127.0.0.1:9224/json/new?about:blank', { method: 'PUT' })).json();
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        let id = 0;
        const pending = new Map();
        const errors = [];
        const failedRequests = [];
        socket.onmessage = event => {
            const value = JSON.parse(event.data);
            if (value.id) { const callback = pending.get(value.id); if (callback) { pending.delete(value.id); value.error ? callback.reject(new Error(value.error.message)) : callback.resolve(value.result); } }
            if (value.method === 'Runtime.exceptionThrown') errors.push(value.params.exceptionDetails.text + ': ' + (value.params.exceptionDetails.exception?.description || ''));
            if (value.method === 'Network.responseReceived' && value.params.response.status >= 400 && value.params.response.url.startsWith('http://localhost/CAPSTONE/demo/')) failedRequests.push({ url: value.params.response.url.split('?')[0], status: value.params.response.status, requestId: value.params.requestId });
        };
        const call = (method, params = {}) => new Promise((resolve, reject) => {
            const key = ++id;
            const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 10000);
            pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
            socket.send(JSON.stringify({ id: key, method, params }));
        });
        const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
        await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
        for (const role of ['student', 'officer', 'osa']) {
            await call('Network.clearBrowserCookies');
            await call('Page.navigate', { url: 'http://localhost/CAPSTONE/demo/' }); await delay(1500);
            await evaluate('localStorage.clear(); sessionStorage.clear();');
            errors.length = 0; failedRequests.length = 0;
            await evaluate(`document.getElementById('loginIdentifier').value=${JSON.stringify(fixture.token + role + '@example.invalid')}; document.getElementById('loginPassword').value=${JSON.stringify(fixture.password)}; document.getElementById(${JSON.stringify(role === 'osa' ? 'localOsaOtpBypassBtn' : 'loginBtn')}).click();`);
            await delay(1500);
            if (role === 'officer') {
                await evaluate("document.getElementById('goOfficerDashboardBtn').click()"); await delay(300);
                await evaluate(`const choice = Array.from(document.querySelectorAll('#officerOrganizationOptions button')).find(b => b.textContent.includes(${JSON.stringify(fixture.token)})); if(choice) choice.click();`);
            }
            await delay(2500);
            for (const response of failedRequests) {
                try { const body = await call('Network.getResponseBody', { requestId: response.requestId }); const json = JSON.parse(body.body); response.error = json.error; response.error_code = json.error_code; } catch {}
                delete response.requestId;
            }
            const authState = await evaluate("fetch('/CAPSTONE/demo/api/auth/session.php').then(r=>r.json()).then(s=>({authenticated:s.authenticated,role:s.session?.login_role,org:s.session?.active_org_id}))");
            const state = await evaluate("({url:location.href,title:document.title,buttons:Array.from(document.querySelectorAll('.sidebar a,.sidebar button')).map((e,i)=>({i,text:e.textContent.trim(),href:e.getAttribute('href')})).filter(x=>x.text)})");
            const passed = state.url.includes('/' + (role === 'officer' ? 'officer' : role === 'osa' ? 'osa' : 'student') + '/') && authState.authenticated && authState.role === (role === 'officer' ? 'org' : role === 'osa' ? 'osa' : 'student') && (role !== 'officer' || authState.org === fixture.org);
            results.push({ role, check: 'Browser login and dashboard load', passed, url: state.url, errors: [...errors], failedRequests: [...failedRequests], navigation: state.buttons });
            console.log((passed ? 'PASS: ' : 'FAIL: ') + role + ' browser login/dashboard; runtime errors=' + errors.length + ', HTTP failures=' + failedRequests.length);
            for (const entry of state.buttons.slice(0, 12)) {
                if (/logout|log out|sign out/i.test(entry.text) || entry.href && !['#', ''].includes(entry.href)) continue;
                errors.length = 0; failedRequests.length = 0;
                await evaluate(`document.querySelectorAll('.sidebar a,.sidebar button')[${entry.i}]?.click()`); await delay(700);
                results.push({ role, check: 'Navigation ' + entry.text, passed: errors.length === 0 && !failedRequests.some(r => r.status >= 500), errors: [...errors], failedRequests: [...failedRequests] });
                console.log((errors.length || failedRequests.some(r => r.status >= 500) ? 'FAIL: ' : 'PASS: ') + role + ' navigation ' + entry.text);
            }
            await evaluate("fetch('/CAPSTONE/demo/api/auth/logout.php',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})");
        }
        fs.writeFileSync(path.join(os.tmpdir(), 'capstone-browser-results.json'), JSON.stringify(results, null, 2));
        console.log('Browser results written to temporary report.');
    } finally {
        if (socket) socket.close();
        edge.kill();
    }
})().catch(error => { console.error(error.message); edge.kill(); process.exitCode = 1; });
