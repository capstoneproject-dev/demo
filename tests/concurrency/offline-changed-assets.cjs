const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
    const origin = 'http://localhost';
    const base = origin + '/CAPSTONE/demo/';
    const stores = new Map(), handlers = {};
    const key = input => new URL(typeof input === 'string' ? input : input.url, base).href;
    let online = true;
    const caches = {
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const store = stores.get(name);
            return { async put(request, response) { store.set(key(request), response.clone()); },
                async match(request) { return store.get(key(request))?.clone(); } };
        },
        async keys() { return [...stores.keys()]; },
        async delete(name) { return stores.delete(name); },
        async match(request) { for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)).clone(); }
    };
    const context = vm.createContext({ URL, Response, caches,
        self: { location: { origin, pathname: '/CAPSTONE/demo/sw.js' },
            addEventListener: (name, handler) => { handlers[name] = handler; },
            skipWaiting: async () => {}, clients: { claim: async () => {} } },
        fetch: async request => {
            if (!online) throw new Error('Offline');
            const url = key(request);
            return new Response(url, { headers: { 'Content-Type': /\.(html|php)$/.test(new URL(url).pathname) ? 'text/html' : 'text/javascript' } });
        }
    });
    vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
    const dashboardAssets = new Set(vm.runInContext('PRECACHE', context).map(key));
    const scannerAssets = new Set(vm.runInContext('QR_OFFLINE_ASSETS', context).map(key));
    const required = new Set();
    for (const [files, manifest] of [
        [['pages/login.html', 'pages/studentDashboard.html', 'pages/officerDashboard.html', 'pages/osaDashboard.html'], dashboardAssets],
        [['pages/qr-attendance/index.php', 'pages/qr-attendance/events.php'], scannerAssets]
    ]) {
        for (const file of files) {
            for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
                const url = new URL(match[1], base + file);
                if (url.origin !== origin || !/\.(js|css)$/.test(url.pathname)) continue;
                assert.ok(manifest.has(url.href), `${file} needs exact cached asset ${url.href}`);
                required.add(url.href);
            }
        }
    }
    async function lifecycle(name, extra = {}) {
        let pending;
        handlers[name]({ ...extra, waitUntil: promise => { pending = promise; } });
        await pending;
    }
    await lifecycle('install');
    await lifecycle('activate');
    await lifecycle('message', { data: { type: 'NAAP_WARM_QR_ATTENDANCE' } });
    online = false;
    for (const url of required) {
        let pending, maintenance;
        handlers.fetch({ request: { url, method: 'GET', mode: 'cors', headers: new Headers() },
            respondWith: promise => { pending = promise; }, waitUntil: promise => { maintenance = promise; } });
        const response = await pending;
        assert.equal(response?.type === 'error', false, `Offline asset failed: ${url}`);
        assert.equal(await response.text(), url);
        await maintenance;
    }
    console.log('Exact dashboard/scanner manifests and offline asset delivery passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
