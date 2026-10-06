'use strict';

const APP_BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const appPath = (path) => `${APP_BASE}${path}`;

const STATIC_CACHE = 'naap-static-v71';
const RUNTIME_CACHE = 'naap-runtime-v71';
const ASSET_REVALIDATE_MS = 5 * 60 * 1000;
const assetLastChecked = new Map();
const OFFLINE_PAGE = appPath('/offline.html');
const QR_OFFLINE_ROUTES = [
    appPath('/pages/qr-attendance/events.php'),
    appPath('/pages/qr-attendance/index.php')
];
const QR_OFFLINE_ASSETS = [
    '/assets/js/app-dialog.js?v=20260927-complete-ui-1',
    '/assets/js/offline-store.js?v=20260927-complete-ui-1',
    '/assets/js/offline-client.js?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/bootstrap.min.css?v=20260927-complete-ui-1',
    '/assets/vendor/fontawesome/css/all.min.css?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/styles.css?v=20260927-complete-ui-1',
    '/assets/css/responsive-tables.css?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/bootstrap.bundle.min.js?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/encoder.js?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/xlsx.full.min.js?v=20260927-complete-ui-1',
    '/assets/js/responsive-tables.js?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/script.js?v=20261005-attendance-profile-1',
    '/assets/js/readonly-org-dashboard.js?v=20260927-complete-ui-1',
    '/systems/QR-Attendance/lib/Barcode%20scanner%20beep%20sound%20(sound%20effect).mp3',
].map(appPath);
// Match the exact versioned URLs referenced by the cached dashboard pages.
const PRECACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.webmanifest',
    '/pages/login.html',
    '/pages/studentDashboard.html',
    '/pages/officerDashboard.html',
    '/pages/osaDashboard.html',
    '/assets/vendor/pdf.worker.min.js',
    '/assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
    '/assets/vendor/fontawesome/webfonts/fa-regular-400.woff2',
    '/assets/vendor/fontawesome/webfonts/fa-brands-400.woff2',
    '/assets/favicon.png',
    '/assets/photos/LoginPage/philsca%20%20logo.png',
    '/assets/js/app-dialog.js?v=20260927-complete-ui-1',
    '/assets/css/login.css?v=20261004-registration-tabs-1',
    '/assets/js/login.js?v=20261004-section-format-1',
    '/assets/js/app-environment.js?v=20261004-local-mocks-1',
    '/assets/js/offline-store.js?v=20261002-printing-notes-1',
    '/assets/js/offline-client.js?v=20261002-printing-notes-1',
    '/assets/vendor/fontawesome/css/all.min.css?v=20260927-complete-ui-1',
    '/assets/css/studentDashboard.css?v=20260930-locker-request-schedule-1',
    '/assets/css/organizationColorThemes.css?v=20260927-complete-ui-1',
    '/assets/vendor/pdf.min.js?v=20260927-complete-ui-1',
    '/data/orgData.js?v=20260927-complete-ui-1',
    '/assets/js/organizationFavicon.js?v=20260927-complete-ui-1',
    '/assets/js/profile-email-verification.js?v=20261005-email-loading-2',
    '/assets/js/studentDashboard.js?v=20261006-rental-waiver-open-1',
    '/assets/js/offline-store.js?v=20260927-complete-ui-1',
    '/assets/js/offline-client.js?v=20260927-complete-ui-1',
    '/assets/vendor/chart.umd.min.js?v=20260927-complete-ui-1',
    '/assets/vendor/jspdf.umd.min.js?v=20260927-complete-ui-1',
    '/assets/vendor/jspdf.plugin.autotable.min.js?v=20260927-complete-ui-1',
    '/assets/vendor/pdf_viewer.min.css?v=20260927-complete-ui-1',
    '/assets/css/officerDashboard.css?v=20261004-printing-numbers-1',
    '/assets/css/pdfViewer.css?v=20260927-complete-ui-1',
    '/assets/js/igp-api.js?v=20260927-complete-ui-1',
    '/assets/js/pdfViewer.js?v=20261004-defense-page-count-1',
    '/systems/IGPRentalSystem/lib/xlsx.full.min.js?v=20260927-complete-ui-1',
    '/assets/js/officerAnalytics.js?v=20261005-analytics-privacy-2',
    '/assets/js/officerDashboard.js?v=20261005-profile-updates-1',
    '/assets/js/readonly-org-dashboard.js?v=20260927-complete-ui-1',
    '/assets/css/osaDashboard.css?v=20261006-activity-modal-scroll-2',
    '/assets/css/responsive-tables.css?v=20260927-complete-ui-1',
    '/assets/js/responsive-tables.js?v=20260927-complete-ui-1',
    '/assets/js/osaDashboard.app.js?v=20261006-rental-review-1',
    '/assets/js/osa-rental-adjustment.js?v=20261006-rental-waiver-open-1',
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
    // Match the full request URL so a changed query string cannot be replaced
    // by an older precached asset during the next application load.
    const staticResponse = await (await caches.open(STATIC_CACHE)).match(request);
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
                const exact = await caches.match(request);
                if (exact) return exact;
                // The scanner uses ?event=... and ?event_id=... per active event.
                // Reuse its authenticated cached shell while preserving the
                // requested query string in window.location for the page code.
                const canonicalUrl = new URL(request.url);
                canonicalUrl.search = '';
                const qrShell = QR_OFFLINE_ROUTES.includes(canonicalUrl.pathname)
                    ? await caches.match(canonicalUrl.href)
                    : null;
                return qrShell || (await caches.match(OFFLINE_PAGE));
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
    if (event.data?.type === 'NAAP_WARM_QR_ATTENDANCE') {
        event.waitUntil((async () => {
            const cache = await caches.open(RUNTIME_CACHE);
            await Promise.all([...QR_OFFLINE_ROUTES, ...QR_OFFLINE_ASSETS].map(async (path) => {
                const url = new URL(path, self.location.origin).href;
                try {
                    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
                    const contentType = response.headers.get('Content-Type') || '';
                    const isPrivateRoute = QR_OFFLINE_ROUTES.includes(new URL(url).pathname);
                    const cacheable = response.status === 200
                        && !response.redirected
                        && (!isPrivateRoute || contentType.includes('text/html'));
                    if (cacheable) {
                        await cache.put(url, response);
                    }
                } catch (_error) {
                    // A previous authenticated shell remains available.
                }
            }));
        })());
    }
});
