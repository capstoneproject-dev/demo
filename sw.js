'use strict';

const APP_BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const appPath = (path) => `${APP_BASE}${path}`;

const STATIC_CACHE = 'naap-static-v33';
const RUNTIME_CACHE = 'naap-runtime-v33';
const ASSET_REVALIDATE_MS = 5 * 60 * 1000;
const assetLastChecked = new Map();
const OFFLINE_PAGE = appPath('/offline.html');
const PRECACHE = [
    '/', '/index.html', '/offline.html', '/manifest.webmanifest',
    '/pages/login.html', '/pages/studentDashboard.html', '/pages/officerDashboard.html', '/pages/osaDashboard.html',
    '/assets/js/app-dialog.js', '/assets/js/offline-store.js', '/assets/js/offline-client.js',
    '/assets/js/login.js', '/assets/js/studentDashboard.js', '/assets/js/officerDashboard.js', '/assets/js/osaDashboard.js',
    '/assets/css/login.css', '/assets/css/studentDashboard.css', '/assets/css/officerDashboard.css', '/assets/css/osaDashboard.css',
    '/assets/css/pdfViewer.css', '/assets/css/organizationColorThemes.css',
    '/assets/vendor/chart.umd.min.js', '/assets/vendor/jspdf.umd.min.js', '/assets/vendor/jspdf.plugin.autotable.min.js',
    '/assets/vendor/pdf.min.js', '/assets/vendor/pdf.worker.min.js', '/assets/vendor/pdf_viewer.min.css',
    '/assets/vendor/fontawesome/css/all.min.css', '/assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
    '/assets/vendor/fontawesome/webfonts/fa-regular-400.woff2', '/assets/vendor/fontawesome/webfonts/fa-brands-400.woff2',
    '/assets/favicon.png', '/assets/photos/LoginPage/philsca%20%20logo.png'
].map(appPath);

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(STATIC_CACHE);
        await Promise.all(PRECACHE.map(async (url) => {
            try {
                const response = await fetch(url, { cache: 'reload' });
                if (response.status === 200) await cache.put(url, response);
            } catch (_error) {
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith('naap-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(name)).map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

function isPublicAsset(request, url) {
    if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
    if (url.pathname.startsWith(appPath('/api/'))) return false;
    return /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp3)$/i.test(url.pathname);
}

async function fetchAndCacheAsset(request) {
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            try { await (await caches.open(RUNTIME_CACHE)).put(request, response.clone()); }
            catch (_cacheError) { /* Unsupported responses are simply not cached. */ }
        }
        return response;
    } catch (_error) {
        return null;
    }
}

async function findCachedAsset(request) {
    // The static cache was rebuilt when this worker installed, so query-string
    // cache busters can safely reuse that fresh precached response.
    const staticResponse = await (await caches.open(STATIC_CACHE)).match(request, { ignoreSearch: true });
    if (staticResponse) return { response: staticResponse, runtime: false };
    const runtimeResponse = await (await caches.open(RUNTIME_CACHE)).match(request);
    return runtimeResponse ? { response: runtimeResponse, runtime: true } : null;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(appPath('/api/'))) return;
    // Audio, video, and PDF viewers commonly request byte ranges. A 206
    // response is intentionally partial and the Cache API rejects it. Let the
    // browser perform these requests normally; complete responses are cached
    // when the same asset is requested without a Range header.
    if (request.headers.has('Range')) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.status === 200) {
                    try { await (await caches.open(RUNTIME_CACHE)).put(request, response.clone()); }
                    catch (_cacheError) { /* The network response remains usable. */ }
                }
                return response;
            } catch (_error) {
                return (await caches.match(request)) || (await caches.match(OFFLINE_PAGE));
            }
        })());
        return;
    }

    if (isPublicAsset(request, url)) {
        const cachedAsset = findCachedAsset(request);
        event.respondWith(cachedAsset.then(async (cached) => {
            if (cached) return cached.response;
            return (await fetchAndCacheAsset(request)) || Response.error();
        }));
        event.waitUntil(cachedAsset.then(async (cached) => {
            if (!cached?.runtime) return;
            const lastChecked = assetLastChecked.get(request.url) || 0;
            if (Date.now() - lastChecked < ASSET_REVALIDATE_MS) return;
            assetLastChecked.set(request.url, Date.now());
            await fetchAndCacheAsset(request);
        }));
    }
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
