(function () {
    'use strict';

    const Store = window.NAAPOfflineStore;
    if (!Store || window.NAAPOffline) return;

    const scriptPath = new URL(document.currentScript?.src || 'assets/js/offline-client.js', document.baseURI).pathname;
    const APP_BASE = scriptPath.includes('/assets/js/offline-client.js')
        ? scriptPath.slice(0, scriptPath.indexOf('/assets/js/offline-client.js'))
        : '';
    const appUrl = (path) => new URL(`${APP_BASE}${path}`, location.origin);
    const IS_SYNC_COORDINATOR = window.top === window;

    const securedFetch = window.fetch.bind(window);
    const queueableJsonRoutes = new Map([
        ['/api/announcements/create.php', 'announcement.create'],
        ['/api/announcements/archive.php', 'announcement.archive'],
        ['/api/announcements/restore.php', 'announcement.restore'],
        ['/api/qr-attendance/events/save.php', 'event.create'],
        ['/api/qr-attendance/events/delete.php', 'event.delete'],
        ['/api/qr-attendance/events/archive.php', 'event.archive'],
        ['/api/qr-attendance/students/delete.php', 'attendance.student.delete'],
        ['/api/qr-attendance/attendance/checkin.php', 'attendance.checkin'],
        ['/api/qr-attendance/attendance/checkout.php', 'attendance.checkout'],
        ['/api/student/events/register.php', 'student.event.register'],
        ['/api/student/rentals/create.php', 'student.rental.create'],
        ['/api/igp/inventory/save.php', 'inventory.save'],
        ['/api/igp/inventory/delete.php', 'inventory.delete'],
        ['/api/igp/rentals/return.php', 'rental.return'],
        ['/api/igp/rentals/mark-paid.php', 'rental.mark_paid'],
        ['/api/igp/rentals/no-show.php', 'rental.no_show'],
        ['/api/igp/students/delete.php', 'igp.student.delete'],
        ['/api/igp/officers/delete.php', 'igp.officer.delete'],
        ['/api/documents/review.php', 'document.review'],
        ['/api/documents/cancel.php', 'document.cancel'],
        ['/api/documents/forward-to-ssc.php', 'document.forward_ssc'],
        ['/api/documents/forward-to-osa.php', 'document.forward_osa'],
        ['/api/documents/annotations/create.php', 'document.annotation.create'],
        ['/api/documents/annotations/delete.php', 'document.annotation.delete'],
        ['/api/printing/officer/accept.php', 'printing.accept'],
        ['/api/printing/officer/update-status.php', 'printing.update_status'],
        ['/api/printing/officer/mark-paid.php', 'printing.mark_paid'],
        ['/api/lockers/officer/approve.php', 'locker.approve'],
        ['/api/lockers/officer/reject.php', 'locker.reject'],
        ['/api/lockers/officer/release.php', 'locker.release'],
        ['/api/lockers/officer/manual-assign.php', 'locker.manual_assign'],
        ['/api/lockers/officer/pricing.php', 'locker.pricing'],
        ['/api/lockers/officer/notice.php', 'locker.notice'],
        ['/api/lockers/officer/clear-notice.php', 'locker.clear_notice'],
    ]);
    const queueableUploadRoutes = new Map([
        ['/api/printing/student/submit.php', 'student.printing.submit'],
        ['/api/igp/inventory/save.php', 'inventory.save'],
    ]);
    const excludedSnapshotPaths = [
        '/api/auth/', '/api/offline/', '/api/audit/', '/activity.php', '/csrf.php',
        '/logout.php', '/reauthenticate.php', '/notifications/read', '/notifications/mark',
    ];
    const privatePdfPathParts = ['/api/documents/download.php', '/api/printing/file.php'];
    let syncPromise = null;
    let statusNode = null;
    let queuePreviewNode = null;
    let badgeNodes = [];
    let activeIdentity = Store.currentIdentity();
    let channel = null;
    let legacyPendingCount = 0;
    const syncOwner = `page:${crypto.randomUUID()}`;
    let uiUpdateTimer = null;
    let localDataDisabled = false;
    let reconnectPromptOpen = false;
    let reconnectPromptHandledForCycle = false;
    let queuePreviewCollapsed = true;
    let currentStatus = null;
    let statusHideTimer = null;

    function pathOf(input) {
        try {
            const pathname = new URL(input instanceof Request ? input.url : String(input), document.baseURI).pathname;
            return APP_BASE && pathname.startsWith(`${APP_BASE}/`) ? pathname.slice(APP_BASE.length) : pathname;
        }
        catch (_error) { return ''; }
    }

    function methodOf(input, init) {
        return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    }

    function isSameOrigin(input) {
        try { return new URL(input instanceof Request ? input.url : String(input), document.baseURI).origin === location.origin; }
        catch (_error) { return false; }
    }

    function isSnapshotCandidate(path) {
        return path.includes('/api/') && !excludedSnapshotPaths.some((part) => path.includes(part));
    }

    function jsonResponse(body, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', 'X-NAAP-Offline': '1' },
        });
    }

    function syntheticQueuedResult(type, operationId, payload) {
        const base = { ok: true, queued: true, offline: true, operation_id: operationId };
        if (type === 'attendance.checkin') return { ...base, record_id: 0, event_id: Number(payload.event_id || 0), time_in: payload.captured_at, time_out: null };
        if (type === 'attendance.checkout') return { ...base, record_id: Number(payload.record_id || 0), event_id: Number(payload.event_id || 0), time_out: payload.captured_at };
        if (type === 'student.event.register') return { ...base, record_id: 0, already_registered: false };
        if (type === 'student.rental.create') return { ...base, rental_id: 0 };
        if (type === 'event.create') return { ...base, event_id: 0 };
        if (type === 'announcement.create') return { ...base, item: { ...payload, announcement_id: 0, pending_sync: true } };
        if (type === 'student.printing.submit') return { ...base, items: [], count: 0 };
        if (type === 'document.submit') return { ...base, item: { ...payload, submission_id: 0, pending_sync: true } };
        if (type === 'inventory.save') return { ...base, item_id: Number(payload.item_id || 0) };
        if (type === 'rental.return') return { ...base, rental_id: Number(payload.rental_id || 0), payment_status: 'unpaid' };
        if (type === 'document.annotation.create') {
            return {
                ...base,
                item: {
                    annotation_id: 0,
                    submission_id: Number(payload.submission_id || 0),
                    page_number: Number(payload.page || 0),
                    selected_text: payload.text || '',
                    rects_json: JSON.stringify(payload.rects || []),
                    comment_text: payload.comment || '',
                    created_at: payload.captured_at || new Date().toISOString(),
                    pending_sync: true,
                    offline_operation_id: operationId,
                }
            };
        }
        if (['document.review', 'document.cancel', 'document.forward_ssc', 'document.forward_osa',
            'document.annotation.delete', 'printing.accept', 'printing.update_status', 'printing.mark_paid',
            'locker.approve', 'locker.reject', 'locker.release', 'locker.manual_assign', 'locker.pricing',
            'locker.notice', 'locker.clear_notice'].includes(type)) {
            return { ...base, item: { ...payload, pending_sync: true } };
        }
        return base;
    }

    async function formDataParts(formData) {
        const payload = {};
        const files = [];
        for (const [key, value] of formData.entries()) {
            if (value instanceof File || value instanceof Blob) {
                files.push({ field: key, name: value.name || 'upload', type: value.type, blob: value });
            } else if (Object.prototype.hasOwnProperty.call(payload, key)) {
                payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
            } else {
                payload[key] = value;
            }
        }
        return { payload, files };
    }

    async function parseRequestPayload(input, init) {
        const body = init?.body;
        if (body instanceof FormData) return formDataParts(body);
        if (typeof body === 'string') {
            try { return { payload: JSON.parse(body), files: [] }; }
            catch (_error) { return { payload: { raw: body }, files: [] }; }
        }
        if (input instanceof Request) {
            const clone = input.clone();
            const contentType = clone.headers.get('Content-Type') || '';
            if (contentType.includes('multipart/form-data')) return formDataParts(await clone.formData());
            if (contentType.includes('application/json')) return { payload: await clone.json(), files: [] };
        }
        return { payload: {}, files: [] };
    }

    async function queueRequest(type, path, input, init) {
        if (!activeIdentity) throw new Error('Sign in online once before saving offline work.');
        const parsed = await parseRequestPayload(input, init);
        if (type === 'event.create' && Number(parsed.payload.event_id || 0) > 0) {
            throw new Error('Updating an event is online-only. Connect to the internet and try again.');
        }
        if (type === 'student.printing.submit') {
            const maxPrintingFileBytes = 20 * 1024 * 1024;
            const oversizedFile = parsed.files.find(file => Number(file.blob?.size || 0) > maxPrintingFileBytes);
            if (oversizedFile) {
                throw new Error(`The file "${oversizedFile.name || 'Selected file'}" is larger than 20 MB. Remove it before submitting.`);
            }
        }
        parsed.payload.captured_at = parsed.payload.captured_at || new Date().toISOString();
        const row = await Store.queueOperation({
            identity: activeIdentity,
            type,
            endpoint: path,
            payload: parsed.payload,
            files: parsed.files,
        });
        updateUi();
        return jsonResponse(syntheticQueuedResult(type, row.operationId, parsed.payload), 202);
    }

    async function offlineFetch(input, init = {}) {
        const method = methodOf(input, init);
        const path = pathOf(input);
        const sameOrigin = isSameOrigin(input);
        const jsonType = method === 'POST' ? queueableJsonRoutes.get(path) : null;
        const uploadType = method === 'POST' ? queueableUploadRoutes.get(path) : null;

        if ((jsonType || uploadType) && !navigator.onLine) {
            return queueRequest(jsonType || uploadType, path, input, init);
        }
        if (sameOrigin && path.includes('/api/') && method !== 'GET' && method !== 'HEAD' && !navigator.onLine) {
            return jsonResponse({
                ok: false,
                error: 'This action is online-only. Connect to the internet and try again.',
                error_code: 'ONLINE_REQUIRED'
            }, 503);
        }

        try {
            const response = await securedFetch(input, init);
            const isPrivateFile = privatePdfPathParts.some((part) => path.includes(part));
            const requestHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            const isCompletePrivateFile = isPrivateFile
                && response.status === 200
                && !requestHeaders.has('Range')
                && !response.headers.has('Content-Range');
            if (!localDataDisabled && activeIdentity && sameOrigin && method === 'GET' && isCompletePrivateFile) {
                const snapshotIdentity = activeIdentity;
                response.clone().blob().then((blob) => {
                    if (!localDataDisabled) return Store.saveBinarySnapshot(new URL(input instanceof Request ? input.url : String(input), document.baseURI).href, blob, snapshotIdentity);
                }).catch(() => {});
            } else if (!localDataDisabled && activeIdentity && sameOrigin && method === 'GET' && response.ok && isSnapshotCandidate(path)) {
                const type = response.headers.get('Content-Type') || '';
                if (type.includes('application/json')) {
                    const snapshotIdentity = activeIdentity;
                    response.clone().json().then((data) => {
                        if (!localDataDisabled) return Store.saveSnapshot(new URL(input instanceof Request ? input.url : String(input), document.baseURI).href, data, snapshotIdentity);
                    }).catch(() => {});
                }
            }
            return response;
        } catch (error) {
            if (jsonType || uploadType) return queueRequest(jsonType || uploadType, path, input, init);
            if (sameOrigin && method === 'GET' && isSnapshotCandidate(path)) {
                const absolute = new URL(input instanceof Request ? input.url : String(input), document.baseURI).href;
                if (privatePdfPathParts.some((part) => path.includes(part))) {
                    const blob = await Store.readBinarySnapshot(absolute, activeIdentity).catch(() => null);
                    if (blob) return new Response(blob, { status: 200, headers: { 'Content-Type': blob.type, 'X-NAAP-Offline': '1' } });
                }
                const cached = await Store.readSnapshot(absolute, activeIdentity).catch(() => null);
                if (cached !== null) return jsonResponse(cached);
            }
            throw error;
        }
    }

    async function csrfToken() {
        const response = await securedFetch(appUrl('/api/auth/csrf.php'), {
            credentials: 'same-origin', cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !data.csrf_token) {
            const error = new Error(data.error || 'Your session must be restored before synchronization.');
            error.sessionExpired = response.status === 401;
            throw error;
        }
        return data.csrf_token;
    }

    async function transmit(row, token) {
        const value = row.value || {};
        const headers = { 'X-CSRF-Token': token };
        let endpoint = appUrl('/api/offline/sync.php');
        let options;
        if ((value.files || []).length) {
            endpoint = appUrl('/api/offline/sync-upload.php');
            const form = new FormData();
            form.append('operation_id', row.operationId);
            form.append('operation_type', row.type);
            form.append('created_at', row.createdAt);
            form.append('payload', JSON.stringify(value.payload || {}));
            value.files.forEach((file) => form.append(file.field || 'file', file.blob, file.name));
            options = { method: 'POST', credentials: 'same-origin', headers, body: form };
        } else {
            headers['Content-Type'] = 'application/json';
            options = {
                method: 'POST', credentials: 'same-origin', headers,
                body: JSON.stringify({
                    operation_id: row.operationId,
                    operation_type: row.type,
                    created_at: row.createdAt,
                    payload: value.payload || {},
                }),
            };
        }
        const response = await securedFetch(endpoint, options);
        const data = await response.json().catch(() => ({}));
        return { response, data };
    }

    async function sync(options = {}) {
        if (syncPromise) return syncPromise;
        syncPromise = (async () => {
            if (!navigator.onLine) throw new Error('Connect to the internet to sync.');
            activeIdentity = Store.currentIdentity();
            if (!activeIdentity) throw new Error('Sign in to the same account to synchronize its offline work.');
            await Store.ensureAccount(activeIdentity);
            await Store.setAccountLocked(activeIdentity.accountKey, false);
            setStatus('syncing');
            const lockName = `naap-offline-sync:${activeIdentity.accountKey}`;
            const execute = async () => {
                const rows = await Store.listOutbox(activeIdentity.accountKey, false);
                // Synchronization is explicitly user-triggered. When the user
                // presses Sync, retry every queued item now instead of waiting
                // for an old automatic-backoff timestamp.
                // Event attendance may be collected before its offline-created
                // event reaches the server. Always commit event definitions
                // before dependent attendance operations, while preserving
                // chronological order within each priority group.
                const operationPriority = (row) => row.type === 'event.create' ? 0 : 1;
                const dueRows = [...rows].sort((a, b) => {
                    const priorityDifference = operationPriority(a) - operationPriority(b);
                    return priorityDifference || String(a.createdAt).localeCompare(String(b.createdAt));
                });
                if (!dueRows.length) {
                    return {
                        ok: true,
                        failed: [],
                        completedCount: 0,
                        summary: await Store.outboxSummary(activeIdentity.accountKey),
                    };
                }
                let token;
                try {
                    token = await csrfToken();
                } catch (error) {
                    if (error.sessionExpired) await Store.setAccountLocked(activeIdentity.accountKey, true);
                    throw error;
                }
                const failed = [];
                let completedCount = 0;
                for (const row of dueRows) {
                    try {
                        let result = await transmit(row, token);
                        if (result.response.status === 419) {
                            token = await csrfToken();
                            result = await transmit(row, token);
                        }
                        if (result.response.ok && result.data.ok) {
                            await Store.completeOperation(row, result.data);
                            completedCount += 1;
                            continue;
                        }
                        if (result.response.status === 401) {
                            await Store.setAccountLocked(row.accountKey, true);
                            const error = new Error(result.data.error || 'Your session expired. Sign in to the same account to resume syncing.');
                            error.sessionExpired = true;
                            throw error;
                        }
                        const permanent = [400, 403, 404, 409, 413, 415, 422].includes(result.response.status);
                        const attempts = Number(row.attempts || 0) + 1;
                        await Store.updateOutbox(row.operationId, permanent
                            ? { status: 'attention', attempts, lastError: result.data.error || 'The server rejected this operation.' }
                            : { status: 'pending', attempts, lastError: result.data.error || 'Server error.', nextAttemptAt: Date.now() + Math.min(300000, 1000 * (2 ** attempts)) });
                        if (permanent) await Store.recordSyncFailure(row, result.data, result.response.status === 409 ? 'conflicted' : 'rejected');
                        failed.push({ operationId: row.operationId, message: result.data.error || `Sync failed (${result.response.status}).` });
                    } catch (error) {
                        if (error.sessionExpired) throw error;
                        const attempts = Number(row.attempts || 0) + 1;
                        await Store.updateOutbox(row.operationId, {
                            status: 'pending', attempts, lastError: error.message,
                            nextAttemptAt: Date.now() + Math.min(300000, 1000 * (2 ** attempts)),
                        });
                        failed.push({ operationId: row.operationId, message: error.message });
                        if (!navigator.onLine) break;
                    }
                }
                return { ok: failed.length === 0, failed, completedCount, summary: await Store.outboxSummary(activeIdentity.accountKey) };
            };
            const executeWithSharedLock = async () => {
                const acquired = await Store.acquireSyncLock(activeIdentity.accountKey, syncOwner);
                if (!acquired) {
                    return { ok: true, failed: [], completedCount: 0, summary: await Store.outboxSummary(activeIdentity.accountKey) };
                }
                try { return await execute(); }
                finally { await Store.releaseSyncLock(activeIdentity.accountKey, syncOwner); }
            };
            const result = navigator.locks?.request
                ? await navigator.locks.request(lockName, { mode: 'exclusive' }, executeWithSharedLock)
                : await executeWithSharedLock();
            if (result.completedCount > 0 && options.refreshSnapshots !== false) {
                await refreshSnapshots(activeIdentity).catch(() => {});
            }
            await updateUi();
            if (result.summary.attentionCount) setStatus('attention');
            else if (result.summary.count) {
                setStatus('waiting');
            }
            else setStatus(navigator.onLine ? 'online' : 'offline');
            if (!result.ok && options.throwOnFailure) throw new Error(`${result.failed.length} offline item(s) could not be synchronized.`);
            return result;
        })().finally(() => { syncPromise = null; });
        return syncPromise;
    }

    async function refreshSnapshots(identity) {
        if (!navigator.onLine || !identity) return;
        const uniqueEntries = [];
        const seenUrls = new Set();
        for (const entry of (await Store.listSnapshotUrls(identity.accountKey))) {
            if (entry.binary || seenUrls.has(entry.url)) continue;
            seenUrls.add(entry.url);
            uniqueEntries.push(entry);
            if (uniqueEntries.length >= 20) break;
        }
        let cursor = 0;
        const refreshOne = async () => {
            while (cursor < uniqueEntries.length) {
                const entry = uniqueEntries[cursor++];
                try {
                    const response = await securedFetch(entry.url, { credentials: 'same-origin', cache: 'no-store' });
                    if (!response.ok || !(response.headers.get('Content-Type') || '').includes('application/json')) continue;
                    await Store.saveSnapshot(entry.url, await response.json(), identity);
                } catch (_error) {
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, uniqueEntries.length) }, refreshOne));
        window.dispatchEvent(new CustomEvent('naap:offline-sync-complete'));
    }

    function scheduleUiUpdate() {
        if (uiUpdateTimer) return;
        uiUpdateTimer = window.setTimeout(() => {
            uiUpdateTimer = null;
            updateUi().catch(() => {});
        }, 50);
    }

    async function handleOnlineReconnect() {
        scheduleUiUpdate();
        if (!IS_SYNC_COORDINATOR || reconnectPromptOpen || reconnectPromptHandledForCycle) return;
        reconnectPromptOpen = true;
        reconnectPromptHandledForCycle = true;
        try {
            const identity = Store.currentIdentity() || activeIdentity;
            const summary = identity
                ? await Store.userOfflineSummary(identity.userId).catch(() => ({ count: 0 }))
                : { count: 0 };
            const queuedText = summary.count
                ? ` ${summary.count} queued offline change(s) are saved safely on this device. Choosing Sync and reload will send all of them before refreshing the page.`
                : '';
            const shouldSyncAndReload = await window.appConfirm(
                `Your internet connection has been restored.${queuedText} Reloading now may discard text or form changes that have not been submitted.`,
                {
                    title: 'Connection restored',
                    confirmText: summary.count ? 'Sync and reload' : 'Reload now',
                    cancelText: 'Continue working',
                }
            );
            if (shouldSyncAndReload) {
                if (!navigator.onLine) {
                    await window.appAlert('The connection was lost again, so queued changes were not synchronized and the page was not reloaded.', {
                        title: 'Still offline',
                        type: 'warning',
                    });
                    return;
                }
                if (summary.count) {
                    const accountVerified = await verifyAndUnlockOfflineAccount();
                    if (!accountVerified) {
                        await window.appAlert('The signed-in account could not be verified. Your queued changes remain safely on this device.', {
                            title: 'Unable to synchronize',
                            type: 'warning',
                        });
                        return;
                    }
                    const result = await sync({ throwOnFailure: false, refreshSnapshots: false });
                    if (result.summary.count) {
                        await window.appAlert(`${result.summary.count} queued change(s) still need attention or are waiting to retry. The page was not reloaded.`, {
                            title: 'Synchronization incomplete',
                            type: 'warning',
                        });
                        queuePreviewCollapsed = false;
                        queuePreviewNode?.classList.remove('is-collapsed');
                        return;
                    }
                }
                if (navigator.onLine) {
                    window.location.reload();
                    return;
                }
                await window.appAlert('The connection was lost again, so the page was not reloaded.', {
                    title: 'Still offline',
                    type: 'warning',
                });
                return;
            }
            queuePreviewCollapsed = true;
            queuePreviewNode?.classList.add('is-collapsed');
            scheduleUiUpdate();
        } catch (error) {
            queuePreviewCollapsed = false;
            queuePreviewNode?.classList.remove('is-collapsed');
            await window.appAlert(error.message || 'Queued changes could not be synchronized. They remain safely on this device.', {
                title: 'Synchronization incomplete',
                type: 'error',
            });
        } finally {
            reconnectPromptOpen = false;
            scheduleUiUpdate();
        }
    }

    function handleOfflineDisconnect() {
        reconnectPromptHandledForCycle = false;
        scheduleUiUpdate();
    }

    function setStatus(status) {
        if (!statusNode) return;
        const labels = {
            online: 'Online', offline: 'Offline', syncing: 'Syncing', waiting: 'Waiting to sync', attention: 'Needs attention'
        };
        statusNode.dataset.status = status;
        statusNode.querySelector('.naap-offline-label').textContent = labels[status] || labels.online;
        if (status === 'offline') {
            currentStatus = status;
            if (statusHideTimer) window.clearTimeout(statusHideTimer);
            statusHideTimer = null;
            statusNode.classList.add('is-visible');
            return;
        }
        if (status === 'online') {
            currentStatus = status;
            if (statusHideTimer) window.clearTimeout(statusHideTimer);
            statusHideTimer = null;
            statusNode.classList.remove('is-visible');
            return;
        }
        if (currentStatus === null) {
            currentStatus = status;
            return;
        }
        if (currentStatus === status) return;
        currentStatus = status;
        statusNode.classList.add('is-visible');
        if (statusHideTimer) window.clearTimeout(statusHideTimer);
        statusHideTimer = window.setTimeout(() => {
            statusNode?.classList.remove('is-visible');
            statusHideTimer = null;
        }, 3200);
    }

    async function listQueuedOperations(types = [], options = {}) {
        const identity = Store.currentIdentity() || activeIdentity;
        if (!identity) return [];
        const requestedTypes = new Set(Array.isArray(types) ? types : [types]);
        const rows = options.allAccountContexts
            ? await Store.listOutboxForUser(identity.userId, true, Boolean(options.includeFiles))
            : await Store.listOutbox(identity.accountKey, true, Boolean(options.includeFiles));
        return rows
            .filter((row) => requestedTypes.size === 0 || requestedTypes.has(row.type))
            .map((row) => ({
                operationId: row.operationId,
                type: row.type,
                status: row.status,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                lastError: row.lastError || '',
                payload: row.value?.payload || {},
                files: row.value?.files || [],
            }));
    }

    async function verifyAndUnlockOfflineAccount() {
        if (!navigator.onLine) return false;
        try {
            const response = await securedFetch(appUrl('/api/auth/session.php'), {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.authenticated || Number(data.user_id || 0) <= 0) return false;
            const verifiedIdentity = Store.accountIdentity({
                ...(data.session || {}),
                user_id: Number(data.user_id)
            });
            if (!verifiedIdentity) return false;
            await Store.ensureAccount(verifiedIdentity);
            await Store.setAccountLocked(verifiedIdentity.accountKey, false);
            const current = Store.currentIdentity();
            if (current?.accountKey === verifiedIdentity.accountKey) activeIdentity = current;
            scheduleUiUpdate();
            return true;
        } catch (_error) {
            // Connection failures do not change the queue lock state.
            return false;
        }
    }

    async function updateUi() {
        activeIdentity = Store.currentIdentity() || activeIdentity;
        if (activeIdentity) Store.setMeta('active_account_key', activeIdentity.accountKey).catch(() => {});
        const summary = activeIdentity
            ? await Store.userOfflineSummary(activeIdentity.userId).catch(() => ({ count: 0, fileCount: 0, attentionCount: 0 }))
            : { count: 0, fileCount: 0, attentionCount: 0 };
        legacyPendingCount = summary.count;
        badgeNodes.forEach((badge) => {
            badge.hidden = summary.count === 0;
            badge.textContent = `⚠ ${summary.count}`;
            badge.title = `${summary.count} unsynced offline change(s)`;
        });
        if (IS_SYNC_COORDINATOR) await renderQueuePreview(summary);
        if (!navigator.onLine) setStatus('offline');
        else if (summary.attentionCount) setStatus('attention');
        else if (summary.count) setStatus('waiting');
        else setStatus('online');
        window.dispatchEvent(new CustomEvent('offlineStatusChanged', { detail: { isOnline: navigator.onLine, pendingCount: summary.count } }));
        window.dispatchEvent(new CustomEvent('naap:offline-queue-changed', { detail: { pendingCount: summary.count } }));
        return summary;
    }

    function installUi() {
        if (!IS_SYNC_COORDINATOR) {
            updateUi().catch(() => {});
            return;
        }
        if (!document.body || statusNode) return;
        const style = document.createElement('style');
        style.textContent = `
            #naap-offline-status{position:fixed;left:50%;bottom:14px;transform:translate(-50%,calc(100% + 32px));opacity:0;visibility:hidden;pointer-events:none;z-index:100000;padding:7px 12px;border-radius:999px;background:#166534;color:#fff;font:600 13px/1.2 system-ui;box-shadow:0 4px 18px #0004;display:flex;gap:7px;align-items:center;transition:transform .28s ease,opacity .22s ease,visibility 0s linear .28s}#naap-offline-status.is-visible{transform:translate(-50%,0);opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}
            #naap-offline-status[data-status="offline"]{background:#9a3412}#naap-offline-status[data-status="syncing"]{background:#1d4ed8}#naap-offline-status[data-status="waiting"]{background:#b45309}#naap-offline-status[data-status="attention"]{background:#b91c1c}
            .naap-offline-dot{width:8px;height:8px;border-radius:50%;background:currentColor}.naap-offline-badge{margin-left:7px;background:#f97316;color:#fff;border-radius:999px;padding:2px 7px;font:700 12px/1.3 system-ui;vertical-align:middle}
            #naap-offline-queue-preview{position:fixed;right:16px;bottom:16px;z-index:99999;width:min(360px,calc(100vw - 32px));background:#fff7ed;color:#431407;border:1px solid #fdba74;border-left:5px solid #f97316;border-radius:12px;box-shadow:0 12px 35px #0003;font-family:system-ui;overflow:hidden;transition:transform .24s ease,right .24s ease}#naap-offline-queue-preview[hidden]{display:none}#naap-offline-queue-preview.is-collapsed{right:0;transform:translateX(calc(100% - 52px))}#naap-offline-queue-preview.is-collapsed:hover,#naap-offline-queue-preview.is-collapsed:focus-within{transform:translateX(0)}#naap-offline-queue-preview button{font:inherit}.naap-queue-preview-header{width:100%;border:0;background:transparent;color:inherit;display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:10px 12px;cursor:pointer;text-align:left}.naap-queue-preview-arrow{flex:0 0 28px;width:28px;height:28px;display:inline-grid;place-items:center;border-radius:999px;background:#f97316;color:#fff;font-size:17px;font-weight:900;line-height:1;box-shadow:0 2px 8px #9a341244;transition:transform .24s ease}.is-collapsed:hover .naap-queue-preview-arrow,.is-collapsed:focus-within .naap-queue-preview-arrow{transform:rotate(180deg)}.naap-queue-preview-title{font-weight:800;white-space:nowrap}.naap-queue-preview-count{margin-left:auto;background:#f97316;color:#fff;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:800}.naap-queue-preview-list{display:grid;gap:7px;padding:0 12px 12px}.naap-queue-preview-item{background:#fff;border:1px solid #fed7aa;border-radius:9px;padding:9px 10px}.naap-queue-preview-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.naap-queue-preview-name{font-size:13px;font-weight:750;overflow-wrap:anywhere}.naap-queue-preview-detail{font-size:12px;color:#7c2d12;margin-top:3px;overflow-wrap:anywhere}.naap-queue-tag{flex:0 0 auto;border-radius:999px;padding:2px 7px;background:#ffedd5;color:#9a3412;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.03em}.naap-queue-tag[data-status="attention"]{background:#fee2e2;color:#b91c1c}.naap-queue-preview-more{font-size:12px;color:#9a3412;font-weight:700;padding:0 2px}.naap-queue-preview-sync{width:100%;border:0;border-radius:8px;padding:9px 12px;background:#0b4b86;color:#fff;font-weight:800;cursor:pointer}.naap-queue-preview-sync:disabled{background:#94a3b8;cursor:not-allowed}.naap-queue-preview-sync i{margin-right:6px}@media(max-width:640px){#naap-offline-queue-preview{right:10px;bottom:56px;width:calc(100vw - 20px)}#naap-offline-queue-preview.is-collapsed{right:0}#naap-offline-status{bottom:10px}}
            .naap-offline-modal-backdrop{position:fixed;inset:0;background:#0009;z-index:100001;display:grid;place-items:center;padding:24px}.naap-offline-modal{box-sizing:border-box;width:min(780px,100%);max-height:88vh;overflow:auto;background:#fff;color:#172033;border-radius:16px;padding:28px;box-shadow:0 20px 60px #0008;font-family:system-ui}.naap-offline-modal h2{margin:0 0 12px}.naap-offline-activity-list{list-style:none;padding:0;margin:16px 0;max-height:62vh;overflow:auto;overscroll-behavior:contain}.naap-offline-modal-actions{position:sticky;bottom:-28px;background:#fff;display:flex;flex-wrap:wrap;gap:10px;margin:20px -28px -28px;padding:16px 28px 28px;border-top:1px solid #e5e7eb}.naap-offline-modal button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}.naap-offline-sync{background:#0b4b86;color:#fff}.naap-offline-stay{background:#e5e7eb}.naap-offline-delete{background:#b91c1c;color:#fff}.naap-offline-modal button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:640px){.naap-offline-modal-backdrop{padding:10px}.naap-offline-modal{max-height:94vh;border-radius:12px;padding:18px}.naap-offline-modal-actions{bottom:-18px;margin:16px -18px -18px;padding:14px 18px 18px}}
            .naap-optimistic-record{position:relative;border-color:#f59e0b!important;box-shadow:inset 4px 0 0 #f59e0b,0 4px 16px #92400e1f!important}.naap-optimistic-record[data-offline-status="attention"]{border-color:#dc2626!important;box-shadow:inset 4px 0 0 #dc2626,0 4px 16px #991b1b1f!important}tr.naap-optimistic-record>th,tr.naap-optimistic-record>td{background:#fff7ed!important;border-top:2px solid #f59e0b!important;border-bottom:2px solid #f59e0b!important}tr.naap-optimistic-record>*:first-child{border-left:4px solid #f59e0b!important}tr.naap-optimistic-record>*:last-child{border-right:2px solid #f59e0b!important}tr.naap-optimistic-record[data-offline-status="attention"]>th,tr.naap-optimistic-record[data-offline-status="attention"]>td{background:#fef2f2!important;border-top-color:#dc2626!important;border-bottom-color:#dc2626!important}tr.naap-optimistic-record[data-offline-status="attention"]>*:first-child{border-left-color:#dc2626!important}tr.naap-optimistic-record[data-offline-status="attention"]>*:last-child{border-right-color:#dc2626!important}.naap-optimistic-badge{display:inline-flex;align-items:center;gap:5px;width:max-content;border-radius:999px;padding:4px 9px;background:#ffedd5;color:#9a3412;font:800 11px/1.2 system-ui;letter-spacing:.02em}.naap-optimistic-badge[data-offline-status="attention"]{background:#fee2e2;color:#b91c1c}.naap-optimistic-note{color:#9a3412;font-size:12px;font-weight:700}
        `;
        document.head.appendChild(style);
        statusNode = document.createElement('div');
        statusNode.id = 'naap-offline-status';
        statusNode.setAttribute('role', 'status');
        statusNode.innerHTML = '<span class="naap-offline-dot"></span><span class="naap-offline-label">Online</span>';
        document.body.appendChild(statusNode);
        statusNode.tabIndex = 0;
        statusNode.title = 'Open pending offline work';
        statusNode.addEventListener('click', showPendingWork);
        statusNode.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') showPendingWork();
        });
        queuePreviewNode = document.createElement('aside');
        queuePreviewNode.id = 'naap-offline-queue-preview';
        queuePreviewNode.hidden = true;
        queuePreviewNode.setAttribute('aria-live', 'polite');
        document.body.appendChild(queuePreviewNode);
        badgeNodes = [];
        document.querySelectorAll('.logout-btn,.logout-icon,[onclick*="handleLogout"]').forEach((button) => {
            if (button.querySelector('.naap-offline-badge')) return;
            const badge = document.createElement('span');
            badge.className = 'naap-offline-badge';
            badge.hidden = true;
            button.appendChild(badge);
            badgeNodes.push(badge);
        });
        updateUi();
    }

    function escapeText(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    function queuedOperationPresentation(row) {
        const payload = row.value?.payload || {};
        const files = row.value?.files || [];
        const fileLabel = files.map((file) => file.name).filter(Boolean).join(', ');
        const presentations = {
            'announcement.create': ['Announcement', payload.title || 'Untitled announcement'],
            'event.create': ['Event', payload.event_name || 'Untitled event'],
            'attendance.checkin': ['Attendance check-in', payload.student_name || payload.student_number || payload.student_id || `Event ${payload.event_id || ''}`],
            'attendance.checkout': ['Attendance check-out', payload.student_name || payload.student_number || payload.student_id || `Record ${payload.record_id || ''}`],
            'student.event.register': ['Event registration', payload.event_name || `Event ${payload.event_id || ''}`],
            'student.rental.create': ['Rental request', [payload.item_name, payload.organization].filter(Boolean).join(' · ')],
            'student.printing.submit': ['Printing request', fileLabel || 'Queued file'],
            'document.submit': ['Document submission', [payload.title, fileLabel].filter(Boolean).join(' · ')],
            'document.forward_ssc': ['Send document to SSC', `Submission ${payload.submission_id || ''}`],
            'document.forward_osa': ['Send document to OSA', `Submission ${payload.submission_id || ''}`],
            'document.annotation.create': [payload.comment ? 'Add PDF comment' : 'Add PDF highlight', `Submission ${payload.submission_id || ''} · Page ${payload.page || ''}`],
            'announcement.archive': ['Archive announcement', payload.title || `Announcement ${payload.announcement_id || ''}`],
            'announcement.restore': ['Restore announcement', payload.title || `Announcement ${payload.announcement_id || ''}`],
            'event.delete': ['Delete event', payload.event_name || `Event ${payload.event_id || ''}`],
            'event.archive': ['Event archive change', payload.event_name || `Event ${payload.event_id || ''}`],
            'attendance.student.delete': ['Remove attendance student', payload.student_name || payload.student_number || 'Student record'],
            'inventory.save': ['Inventory change', payload.item_name || fileLabel || `Item ${payload.item_id || ''}`],
            'inventory.delete': ['Delete inventory item', payload.item_name || `Item ${payload.item_id || ''}`],
            'rental.return': ['Rental return', payload.items_label || `Rental ${payload.rental_id || ''}`],
            'rental.mark_paid': ['Rental payment', payload.items_label || `Rental ${payload.rental_id || ''}`],
            'rental.no_show': ['Rental no-show', payload.items_label || `Rental ${payload.rental_id || ''}`],
            'igp.student.delete': ['Remove organization student', payload.studentId || `User ${payload.userId || ''}`],
            'igp.officer.delete': ['Remove organization officer', payload.officer_name || `Membership ${payload.id || ''}`],
            'document.review': [String(payload.decision || '').toLowerCase() === 'rejected' ? 'Reject document' : 'Approve document', payload.title || `Submission ${payload.submission_id || ''}`],
            'document.cancel': ['Cancel document', payload.title || `Submission ${payload.submission_id || ''}`],
            'document.annotation.delete': ['Delete document annotation', `Annotation ${payload.annotation_id || ''}`],
            'printing.accept': ['Accept printing request', `Print job ${payload.print_job_id || ''}`],
            'printing.update_status': ['Printing status change', `${payload.status || 'Update'} - Job ${payload.print_job_id || ''}`],
            'printing.mark_paid': ['Printing payment', `Print job ${payload.print_job_id || ''}`],
            'locker.approve': ['Approve locker request', `Rental ${payload.rental_id || ''}`],
            'locker.reject': ['Reject locker request', `Rental ${payload.rental_id || ''}`],
            'locker.release': ['Release locker', `Rental ${payload.rental_id || ''}`],
            'locker.manual_assign': ['Assign locker', payload.locker_code || `Locker ${payload.item_id || ''}`],
            'locker.pricing': ['Update locker rates', payload.locker_code || `Locker ${payload.item_id || ''}`],
            'locker.notice': ['Send locker notice', payload.locker_code || `Rental ${payload.rental_id || ''}`],
            'locker.clear_notice': ['Clear locker notice', payload.locker_code || `Rental ${payload.rental_id || ''}`],
        };
        const [name, detail] = presentations[row.type] || ['Offline change', row.type];
        return { name, detail: detail || 'Saved securely on this device' };
    }

    function groupQueuedOperations(rows) {
        const groups = [];
        let attendanceGroup = null;
        rows.forEach((row) => {
            if (row.type === 'attendance.checkin' || row.type === 'attendance.checkout') {
                if (!attendanceGroup) {
                    attendanceGroup = { kind: 'attendance', rows: [] };
                    groups.push(attendanceGroup);
                }
                attendanceGroup.rows.push(row);
                return;
            }
            groups.push({ kind: 'single', rows: [row] });
        });
        return groups.map((group) => {
            const attention = group.rows.some((row) => row.status === 'attention');
            if (group.kind === 'attendance') {
                const checkInCount = group.rows.filter((row) => row.type === 'attendance.checkin').length;
                const checkOutCount = group.rows.filter((row) => row.type === 'attendance.checkout').length;
                const eventNames = new Set(group.rows.map((row) => String(row.value?.payload?.event_name || '').trim()).filter(Boolean));
                const counts = [];
                if (checkInCount) counts.push(`${checkInCount} check-in${checkInCount === 1 ? '' : 's'}`);
                if (checkOutCount) counts.push(`${checkOutCount} check-out${checkOutCount === 1 ? '' : 's'}`);
                const eventDetail = eventNames.size === 1
                    ? ` for ${Array.from(eventNames)[0]}`
                    : eventNames.size > 1 ? ` across ${eventNames.size} events` : '';
                return {
                    rows: group.rows,
                    operationIds: group.rows.map((row) => row.operationId),
                    name: 'Attendance activity',
                    detail: `${counts.join(', ')}${eventDetail}`,
                    attention,
                    lastError: attention
                        ? `${group.rows.filter((row) => row.status === 'attention').length} attendance item(s) need attention`
                        : 'Waiting to sync',
                };
            }
            const row = group.rows[0];
            const item = queuedOperationPresentation(row);
            return {
                rows: group.rows,
                operationIds: [row.operationId],
                name: item.name,
                detail: item.detail,
                attention,
                lastError: row.lastError || 'Waiting to sync',
            };
        });
    }

    async function renderQueuePreview(summary) {
        if (!queuePreviewNode) return;
        if (!activeIdentity || !summary.count) {
            queuePreviewNode.hidden = true;
            queuePreviewNode.replaceChildren();
            return;
        }
        const rows = await Store.listOutboxForUser(activeIdentity.userId, true, false).catch(() => []);
        const groups = groupQueuedOperations(rows);
        const visibleGroups = groups.slice(0, 3);
        const items = visibleGroups.map((group) => {
            return `<div class="naap-queue-preview-item"><div class="naap-queue-preview-row"><div class="naap-queue-preview-name">${escapeText(group.name)}</div><span class="naap-queue-tag" data-status="${group.attention ? 'attention' : 'queued'}">${group.attention ? 'Needs attention' : 'Queued offline'}</span></div><div class="naap-queue-preview-detail">${escapeText(group.detail)}</div></div>`;
        }).join('');
        const hiddenCount = Math.max(0, groups.length - visibleGroups.length);
        queuePreviewNode.innerHTML = `<button type="button" class="naap-queue-preview-header" aria-label="Show queued offline changes"><span class="naap-queue-preview-arrow" aria-hidden="true">&#10094;</span><span class="naap-queue-preview-title">Changes saved on this device</span><span class="naap-queue-preview-count">${summary.count}</span></button><div class="naap-queue-preview-list">${items}${hiddenCount ? `<div class="naap-queue-preview-more">+${hiddenCount} more queued activity group(s)</div>` : ''}<button type="button" class="naap-queue-preview-sync" ${navigator.onLine ? '' : 'disabled title="Connect to the internet to sync"'}><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>${navigator.onLine ? 'Sync queued changes' : 'Offline — waiting to sync'}</button></div>`;
        queuePreviewNode.hidden = false;
        queuePreviewNode.classList.toggle('is-collapsed', queuePreviewCollapsed);
        queuePreviewNode.title = queuePreviewCollapsed ? 'Hover to show queued offline changes' : '';
        queuePreviewNode.querySelector('.naap-queue-preview-header')?.addEventListener('click', showPendingWork);
        queuePreviewNode.querySelector('.naap-queue-preview-sync')?.addEventListener('click', async (event) => {
            event.stopPropagation();
            const button = event.currentTarget;
            if (!navigator.onLine || button.disabled) return;
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>Syncing...';
            try {
                const result = await sync({ throwOnFailure: false, refreshSnapshots: false });
                if (!result.summary.count) {
                    window.location.reload();
                    return;
                }
                await window.appAlert(`${result.summary.count} queued change(s) still need attention or are waiting to retry.`, { type: 'warning' });
            } catch (error) {
                await window.appAlert(error.message || 'Queued changes could not be synchronized.', { type: 'error' });
            } finally {
                scheduleUiUpdate();
            }
        });
    }

    async function showPendingWork() {
        const identity = Store.currentIdentity() || activeIdentity;
        if (!identity) return;
        const rows = await Store.listOutboxForUser(identity.userId, true, false);
        if (!rows.length) return;
        const backdrop = document.createElement('div');
        backdrop.className = 'naap-offline-modal-backdrop';
        const groups = groupQueuedOperations(rows);
        const items = groups.map((group, groupIndex) => {
            const discardLabel = group.rows.length > 1 ? 'Discard all' : 'Discard';
            return `<li style="margin:10px 0;padding:10px;background:#f3f4f6;border-radius:8px">
            <strong>${escapeText(group.name)}</strong> <span class="naap-queue-tag" data-status="${group.attention ? 'attention' : 'queued'}">${group.attention ? 'Needs attention' : 'Queued offline'}</span><br><small>${escapeText(group.detail)}</small><br><small>${escapeText(group.lastError)}</small>
            <button class="naap-offline-delete" data-discard-group="${groupIndex}" style="float:right;padding:5px 8px">${discardLabel}</button></li>`;
        }).join('');
        backdrop.innerHTML = `<div class="naap-offline-modal" role="dialog" aria-modal="true"><h2>Offline work</h2><ul class="naap-offline-activity-list">${items}</ul><div class="naap-offline-modal-actions"><button class="naap-offline-sync" ${navigator.onLine ? '' : 'disabled'}>Sync now</button><button class="naap-offline-stay">Close</button></div></div>`;
        document.body.appendChild(backdrop);
        backdrop.querySelector('.naap-offline-stay').onclick = () => backdrop.remove();
        backdrop.querySelector('.naap-offline-sync').onclick = async () => {
            try {
                const result = await sync({ throwOnFailure: false, refreshSnapshots: false });
                if (!result.summary.count) {
                    window.location.reload();
                    return;
                }
                await window.appAlert(`${result.summary.count} queued change(s) still need attention or are waiting to retry.`, { type: 'warning' });
            } catch (error) {
                await window.appAlert(error.message || 'Queued changes could not be synchronized.', { type: 'error' });
            }
            backdrop.remove();
        };
        backdrop.querySelectorAll('[data-discard-group]').forEach((button) => {
            button.onclick = async () => {
                const group = groups[Number(button.dataset.discardGroup)];
                if (!group) return;
                const confirmed = await window.appConfirm(group.rows.length > 1
                    ? `Discard all ${group.rows.length} queued attendance items permanently?`
                    : 'Discard this offline item permanently?', { title: 'Discard offline work?', confirmText: 'Discard' });
                if (!confirmed) return;
                for (const operationId of group.operationIds) await Store.discardOperation(operationId);
                button.closest('li')?.remove();
                await updateUi();
                if (!(await Store.userOfflineSummary(identity.userId)).count) backdrop.remove();
            };
        });
    }

    function logoutChoice(summary) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'naap-offline-modal-backdrop';
            backdrop.innerHTML = `<div class="naap-offline-modal" role="dialog" aria-modal="true" aria-labelledby="naap-offline-logout-title">
                <h2 id="naap-offline-logout-title">Unsynced offline changes</h2>
                <p>You have ${summary.count} pending change(s) and ${summary.fileCount} file(s) saved only on this device. Logging out before they sync will permanently delete them.</p>
                ${navigator.onLine ? '' : '<p><strong>Connect to the internet to sync.</strong></p>'}
                <div class="naap-offline-modal-actions">
                    <button class="naap-offline-sync" ${navigator.onLine ? '' : 'disabled'}>Sync then log out</button>
                    <button class="naap-offline-stay">Stay signed in</button>
                    <button class="naap-offline-delete">Delete changes and log out</button>
                </div></div>`;
            document.body.appendChild(backdrop);
            const finish = (choice) => { backdrop.remove(); resolve(choice); };
            backdrop.querySelector('.naap-offline-sync').onclick = () => finish('sync');
            backdrop.querySelector('.naap-offline-stay').onclick = () => finish('stay');
            backdrop.querySelector('.naap-offline-delete').onclick = async () => {
                const confirmed = await (window.appConfirm
                    ? window.appConfirm('This permanently deletes all pending offline changes and files on this device. Continue?', { title: 'Delete offline changes?', confirmText: 'Delete and log out', danger: true })
                    : Promise.resolve(window.confirm('Permanently delete all pending offline changes and log out?')));
                if (confirmed) finish('discard');
            };
        });
    }

    async function prepareLogout() {
        activeIdentity = Store.currentIdentity() || activeIdentity;
        if (!activeIdentity) return { proceed: true, purgeAfterSuccess: false };
        const summary = await Store.userOfflineSummary(activeIdentity.userId);
        if (!summary.count) {
            if (!navigator.onLine) {
                await window.appAlert(
                    'You are offline. Connect to the internet before logging out. You remain signed in on this device.',
                    { title: 'Cannot log out while offline', type: 'warning' }
                );
                return { proceed: false };
            }
            const confirmed = await window.appConfirm('Are you sure you want to log out?', { title: 'Log out', confirmText: 'Log out' });
            return {
                proceed: confirmed,
                purgeAfterSuccess: confirmed,
                accountKey: activeIdentity.accountKey,
                accountKeys: summary.accountKeys,
            };
        }
        const choice = await logoutChoice(summary);
        if (choice === 'stay') return { proceed: false };
        if (choice === 'discard' && !navigator.onLine) {
            await window.appAlert(
                'Logout requires an internet connection. Your pending offline changes were not deleted and you remain signed in.',
                { title: 'Cannot log out while offline', type: 'warning' }
            );
            return { proceed: false };
        }
        if (choice === 'sync') {
            let result;
            try {
                result = await sync({ throwOnFailure: false });
            } catch (error) {
                await window.appAlert(error.message || 'Offline work could not be synchronized. You remain signed in.', { type: 'error' });
                return { proceed: false };
            }
            const remaining = await Store.userOfflineSummary(activeIdentity.userId);
            if (remaining.count) {
                const message = remaining.accountKeys.length > 1
                    ? `${remaining.count} item(s) still belong to another organization context or need attention. Switch to that organization and sync them before logging out.`
                    : `${remaining.count} item(s) still need attention. You remain signed in.`;
                await window.appAlert(message, { type: 'error' });
                return { proceed: false };
            }
        }
        return {
            proceed: true,
            purgeAfterSuccess: true,
            accountKey: activeIdentity.accountKey,
            accountKeys: summary.accountKeys,
        };
    }

    async function completeLogout(preparation) {
        if (preparation?.purgeAfterSuccess && preparation.accountKey) {
            const accountKeys = Array.from(new Set(
                Array.isArray(preparation.accountKeys) && preparation.accountKeys.length
                    ? preparation.accountKeys
                    : [preparation.accountKey]
            ));
            localDataDisabled = true;
            activeIdentity = null;
            await Store.setMeta('active_account_key', null);
            for (const accountKey of accountKeys) await Store.purgeAccount(accountKey);
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.filter((name) => name.startsWith('naap-private-') || name.startsWith('naap-runtime-')).map((name) => caches.delete(name)));
            }
        }
    }

    async function lockForExpiredSession() {
        const identity = Store.currentIdentity() || activeIdentity;
        if (identity) await Store.setAccountLocked(identity.accountKey, true);
    }

    async function queueDocumentSubmission(file, payload) {
        const row = await Store.queueOperation({
            identity: activeIdentity || Store.currentIdentity(),
            type: 'document.submit', endpoint: '/api/documents/submit.php',
            payload: { ...payload, captured_at: new Date().toISOString() },
            files: [{ field: 'file', name: file.name, type: file.type, blob: file }],
        });
        updateUi();
        return syntheticQueuedResult('document.submit', row.operationId, payload);
    }

    async function discardQueuedOperation(operationId) {
        if (!operationId) return false;
        await Store.discardOperation(String(operationId));
        await updateUi();
        return true;
    }

    async function registerServiceWorker() {
        if (!IS_SYNC_COORDINATOR || !('serviceWorker' in navigator) || !window.isSecureContext) return;
        try {
            const workerPath = `${APP_BASE}/sw.js`;
            const desiredScope = new URL(`${APP_BASE}/`, window.location.origin).href;
            const registrations = await navigator.serviceWorker.getRegistrations();

            // An earlier build registered this same worker with an origin-wide
            // scope. Remove only that legacy NAAP registration; IndexedDB and
            // its pending outbox are deliberately left untouched.
            await Promise.all(registrations.map(async (registration) => {
                const workers = [registration.installing, registration.waiting, registration.active].filter(Boolean);
                const isThisWorker = workers.some((worker) => {
                    try { return new URL(worker.scriptURL).pathname === workerPath; }
                    catch (_error) { return false; }
                });
                if (isThisWorker && registration.scope !== desiredScope) await registration.unregister();
            }));

            await navigator.serviceWorker.register(`${workerPath}?v=20260829-25`, { scope: `${APP_BASE}/` });
        }
        catch (error) { console.warn('[offline] Service Worker registration failed:', error); }
    }

    window.fetch = offlineFetch;
    window.NAAPOffline = {
        sync, updateUi, prepareLogout, completeLogout, lockForExpiredSession,
        queueDocumentSubmission, listQueuedOperations, discardQueuedOperation, verifyAndUnlockOfflineAccount,
        outboxSummary: () => Store.outboxSummary((Store.currentIdentity() || activeIdentity)?.accountKey),
    };
    // Compatibility for the embedded attendance UI's existing status badge.
    // Mutations still flow through the strict fetch allowlist above.
    window.offlineSync = window.offlineSync || {
        get isOnline() { return navigator.onLine; },
        getPendingSyncCount() { return legacyPendingCount; },
        saveToLocalStorage() {},
    };

    window.addEventListener('online', handleOnlineReconnect);
    window.addEventListener('offline', handleOfflineDisconnect);
    navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'NAAP_SYNC_REQUEST') {
            scheduleUiUpdate();
        }
    });
    try {
        channel = new BroadcastChannel(Store.CHANNEL_NAME);
        channel.onmessage = (event) => {
            if (event.data?.type === 'account-purged' && event.data.accountKey === activeIdentity?.accountKey) {
                localDataDisabled = true;
                activeIdentity = null;
            }
            scheduleUiUpdate();
        };
    } catch (_error) {
    }
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', installUi) : installUi();
    if (activeIdentity) Store.setMeta('active_account_key', activeIdentity.accountKey).catch(() => {});
    if (navigator.onLine) void verifyAndUnlockOfflineAccount();
    registerServiceWorker();
})();
