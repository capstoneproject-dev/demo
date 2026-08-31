(function (scope) {
    'use strict';

    const DB_NAME = 'naap-offline-v1';
    const DB_VERSION = 1;
    const MAX_ACCOUNT_BYTES = 100 * 1024 * 1024;
    const CHANNEL_NAME = 'naap-offline-status';
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
        });
    }

    function transactionDone(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
            transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
        });
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('snapshots')) {
                    const store = db.createObjectStore('snapshots', { keyPath: 'id' });
                    store.createIndex('account_key', 'accountKey');
                }
                if (!db.objectStoreNames.contains('outbox')) {
                    const store = db.createObjectStore('outbox', { keyPath: 'operationId' });
                    store.createIndex('account_key', 'accountKey');
                    store.createIndex('account_status', ['accountKey', 'status']);
                    store.createIndex('created_at', 'createdAt');
                }
                if (!db.objectStoreNames.contains('sync_results')) {
                    const store = db.createObjectStore('sync_results', { keyPath: 'operationId' });
                    store.createIndex('account_key', 'accountKey');
                }
                if (!db.objectStoreNames.contains('accounts')) {
                    db.createObjectStore('accounts', { keyPath: 'accountKey' });
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
        });
    }

    function readSession() {
        if (!scope.localStorage) return null;
        try {
            const value = JSON.parse(scope.localStorage.getItem('naapAuthSession') || 'null');
            return value && Number(value.user_id) > 0 ? value : null;
        } catch (_error) {
            return null;
        }
    }

    function accountIdentity(session) {
        const userId = Number(session?.user_id || 0);
        if (!userId) return null;
        const orgId = Number(session?.active_org_id || 0);
        const role = String(session?.login_role || session?.account_type || 'account').toLowerCase();
        return {
            accountKey: `${userId}:${orgId}:${role}`,
            userId,
            orgId,
            role,
        };
    }

    function currentIdentity() {
        return accountIdentity(readSession());
    }

    async function getAccount(accountKey) {
        const db = await openDatabase();
        const tx = db.transaction('accounts', 'readonly');
        const result = await requestResult(tx.objectStore('accounts').get(accountKey));
        db.close();
        return result || null;
    }

    async function ensureAccount(identity) {
        if (!identity?.accountKey) throw new Error('An authenticated account is required for offline storage.');
        const existing = await getAccount(identity.accountKey);
        if (existing?.cryptoKey) return existing;
        const cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const row = {
            ...identity,
            cryptoKey,
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            locked: false,
        };
        const db = await openDatabase();
        const tx = db.transaction('accounts', 'readwrite');
        const store = tx.objectStore('accounts');
        const winner = await requestResult(store.get(identity.accountKey));
        if (winner?.cryptoKey) {
            await transactionDone(tx);
            db.close();
            return winner;
        }
        store.add(row);
        await transactionDone(tx);
        db.close();
        return row;
    }

    async function encryptValue(account, value, aad) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = encoder.encode(JSON.stringify(value));
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
            account.cryptoKey,
            encoded
        );
        return { iv, cipher };
    }

    async function decryptValue(account, encrypted, aad) {
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: encrypted.iv, additionalData: encoder.encode(aad) },
            account.cryptoKey,
            encrypted.cipher
        );
        return JSON.parse(decoder.decode(plain));
    }

    function approximateBytes(value) {
        if (value instanceof Blob) return value.size;
        if (value instanceof ArrayBuffer) return value.byteLength;
        if (ArrayBuffer.isView(value)) return value.byteLength;
        if (Array.isArray(value)) return value.reduce((sum, item) => sum + approximateBytes(item), 0);
        if (value && typeof value === 'object') {
            return Object.entries(value).reduce((sum, pair) => sum + approximateBytes(pair[0]) + approximateBytes(pair[1]), 0);
        }
        return encoder.encode(String(value ?? '')).byteLength;
    }

    async function accountUsage(accountKey) {
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readonly');
        const rows = await requestResult(tx.objectStore('outbox').index('account_key').getAll(accountKey));
        db.close();
        return rows.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0);
    }

    async function assertStorageAvailable(accountKey, additionalBytes) {
        const used = await accountUsage(accountKey);
        if (used + additionalBytes > MAX_ACCOUNT_BYTES) {
            throw new Error('Offline pending work is limited to 100 MB per account. Sync or discard existing items first.');
        }
        if (navigator.storage?.estimate) {
            const estimate = await navigator.storage.estimate();
            const available = Math.max(0, Number(estimate.quota || 0) - Number(estimate.usage || 0));
            if (available && additionalBytes > available * 0.9) {
                throw new Error('This browser does not have enough available storage for that offline file.');
            }
        }
    }

    async function queueOperation(operation) {
        const identity = operation.identity || currentIdentity();
        const account = await ensureAccount(identity);
        if (account.locked) throw new Error('Offline work is locked. Sign in to the same account to continue.');
        const operationId = String(operation.operationId || crypto.randomUUID());
        const createdAt = String(operation.createdAt || new Date().toISOString());
        const rawFiles = Array.isArray(operation.files) ? operation.files : [];
        const value = {
            type: String(operation.type || ''),
            endpoint: String(operation.endpoint || ''),
            payload: operation.payload || {},
            createdAt,
        };
        const sizeBytes = approximateBytes(value) + rawFiles.reduce((sum, file) => sum + Number(file?.blob?.size || 0), 0);
        await assertStorageAvailable(identity.accountKey, sizeBytes);
        const encrypted = await encryptValue(account, value, `${identity.accountKey}:outbox:${operationId}`);
        const encryptedFiles = [];
        for (let index = 0; index < rawFiles.length; index += 1) {
            const item = rawFiles[index];
            const blob = item?.blob instanceof Blob ? item.blob : item;
            if (!(blob instanceof Blob)) continue;
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const aad = `${identity.accountKey}:file:${operationId}:${index}`;
            const cipher = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
                account.cryptoKey,
                await blob.arrayBuffer()
            );
            encryptedFiles.push({
                iv,
                cipher,
                name: String(item?.name || blob.name || `file-${index + 1}`),
                type: String(item?.type || blob.type || 'application/octet-stream'),
                field: String(item?.field || 'file'),
                index,
            });
        }
        const row = {
            operationId,
            accountKey: identity.accountKey,
            userId: identity.userId,
            orgId: identity.orgId,
            role: identity.role,
            type: value.type,
            endpoint: value.endpoint,
            createdAt,
            updatedAt: createdAt,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: 0,
            sizeBytes,
            fileCount: encryptedFiles.length,
            encrypted,
            encryptedFiles,
        };
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').add(row);
        await transactionDone(tx);
        db.close();
        broadcast({ type: 'outbox-changed', accountKey: identity.accountKey });
        return row;
    }

    async function listOutbox(accountKey, includeAttention = true, includeFileContents = true) {
        const identity = currentIdentity();
        const key = accountKey || identity?.accountKey;
        if (!key) return [];
        const account = await getAccount(key);
        if (!account?.cryptoKey || account.locked) return [];
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readonly');
        const rows = await requestResult(tx.objectStore('outbox').index('account_key').getAll(key));
        db.close();
        const visible = includeAttention ? rows : rows.filter((row) => row.status !== 'attention');
        const output = [];
        for (const row of visible.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
            try {
                const value = await decryptValue(account, row.encrypted, `${key}:outbox:${row.operationId}`);
                const files = [];
                for (const item of (row.encryptedFiles || [])) {
                    if (!includeFileContents) {
                        files.push({
                            name: item.name,
                            type: item.type,
                            field: item.field,
                            index: item.index,
                            size: Number(item.cipher?.byteLength || 0),
                        });
                        continue;
                    }
                    const plain = await crypto.subtle.decrypt(
                        {
                            name: 'AES-GCM',
                            iv: item.iv,
                            additionalData: encoder.encode(`${key}:file:${row.operationId}:${item.index}`),
                        },
                        account.cryptoKey,
                        item.cipher
                    );
                    files.push({ ...item, blob: new Blob([plain], { type: item.type }) });
                }
                output.push({ ...row, value: { ...value, files } });
            } catch (_error) {
                output.push({ ...row, status: 'attention', decryptError: true });
            }
        }
        return output;
    }

    async function listOutboxForUser(userId, includeAttention = true, includeFileContents = false) {
        const summary = await userOfflineSummary(userId);
        const groups = await Promise.all(
            summary.accountKeys.map((accountKey) => listOutbox(accountKey, includeAttention, includeFileContents))
        );
        return groups
            .flat()
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    }

    async function outboxSummary(accountKey) {
        const identity = currentIdentity();
        const key = accountKey || identity?.accountKey;
        if (!key) return { count: 0, fileCount: 0, attentionCount: 0, bytes: 0 };
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readonly');
        const rows = await requestResult(tx.objectStore('outbox').index('account_key').getAll(key));
        db.close();
        return {
            count: rows.length,
            fileCount: rows.reduce((sum, row) => sum + Number(row.fileCount || 0), 0),
            attentionCount: rows.filter((row) => row.status === 'attention').length,
            bytes: rows.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0),
        };
    }

    async function userOfflineSummary(userId) {
        const targetUserId = Number(userId || 0);
        if (targetUserId <= 0) return { count: 0, fileCount: 0, attentionCount: 0, bytes: 0, accountKeys: [] };
        const db = await openDatabase();
        const tx = db.transaction(['accounts', 'outbox'], 'readonly');
        const accountsRequest = tx.objectStore('accounts').getAll();
        const outboxRequest = tx.objectStore('outbox').getAll();
        const [accounts, rows] = await Promise.all([
            requestResult(accountsRequest),
            requestResult(outboxRequest),
        ]);
        db.close();
        const userRows = rows.filter((row) => Number(row.userId || 0) === targetUserId);
        const accountKeys = new Set(
            accounts
                .filter((account) => Number(account.userId || 0) === targetUserId)
                .map((account) => account.accountKey)
        );
        userRows.forEach((row) => accountKeys.add(row.accountKey));
        return {
            count: userRows.length,
            fileCount: userRows.reduce((sum, row) => sum + Number(row.fileCount || 0), 0),
            attentionCount: userRows.filter((row) => row.status === 'attention').length,
            bytes: userRows.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0),
            accountKeys: [...accountKeys],
        };
    }

    async function updateOutbox(operationId, changes) {
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const row = await requestResult(store.get(operationId));
        if (row) store.put({ ...row, ...changes, updatedAt: new Date().toISOString() });
        await transactionDone(tx);
        db.close();
    }

    async function discardOperation(operationId) {
        const db = await openDatabase();
        const tx = db.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        const row = await requestResult(store.get(operationId));
        if (row) store.delete(operationId);
        await transactionDone(tx);
        db.close();
        if (row) broadcast({ type: 'outbox-changed', accountKey: row.accountKey });
    }

    async function recordSyncFailure(row, result, status = 'rejected') {
        const account = await getAccount(row.accountKey);
        const encrypted = account?.cryptoKey
            ? await encryptValue(account, result || {}, `${row.accountKey}:result:${row.operationId}`)
            : null;
        const db = await openDatabase();
        const tx = db.transaction('sync_results', 'readwrite');
        tx.objectStore('sync_results').put({
            operationId: row.operationId,
            accountKey: row.accountKey,
            type: row.type,
            status,
            completedAt: new Date().toISOString(),
            encrypted,
        });
        await transactionDone(tx);
        db.close();
    }

    async function completeOperation(row, result) {
        const account = await getAccount(row.accountKey);
        const encrypted = account?.cryptoKey
            ? await encryptValue(account, result || {}, `${row.accountKey}:result:${row.operationId}`)
            : null;
        const db = await openDatabase();
        const tx = db.transaction(['outbox', 'sync_results'], 'readwrite');
        tx.objectStore('outbox').delete(row.operationId);
        tx.objectStore('sync_results').put({
            operationId: row.operationId,
            accountKey: row.accountKey,
            type: row.type,
            status: 'success',
            completedAt: new Date().toISOString(),
            encrypted,
        });
        await transactionDone(tx);
        db.close();
        broadcast({ type: 'outbox-changed', accountKey: row.accountKey });
    }

    async function saveSnapshot(url, data, identity) {
        const owner = identity || currentIdentity();
        if (!owner) return;
        const account = await ensureAccount(owner);
        const id = `${owner.accountKey}:${url}`;
        const encrypted = await encryptValue(account, data, `${owner.accountKey}:snapshot:${url}`);
        const db = await openDatabase();
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put({ id, accountKey: owner.accountKey, url, savedAt: new Date().toISOString(), encrypted });
        await transactionDone(tx);
        db.close();
    }

    async function readSnapshot(url, identity) {
        const owner = identity || currentIdentity();
        if (!owner) return null;
        const account = await getAccount(owner.accountKey);
        if (!account?.cryptoKey || account.locked) return null;
        const id = `${owner.accountKey}:${url}`;
        const db = await openDatabase();
        const tx = db.transaction('snapshots', 'readonly');
        const row = await requestResult(tx.objectStore('snapshots').get(id));
        db.close();
        if (!row || row.binary) return null;
        return decryptValue(account, row.encrypted, `${owner.accountKey}:snapshot:${url}`);
    }

    async function saveBinarySnapshot(url, blob, identity) {
        const owner = identity || currentIdentity();
        if (!owner || !(blob instanceof Blob)) return;
        const account = await ensureAccount(owner);
        const id = `${owner.accountKey}:${url}`;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: encoder.encode(`${owner.accountKey}:binary:${url}`) },
            account.cryptoKey,
            await blob.arrayBuffer()
        );
        const db = await openDatabase();
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put({
            id, accountKey: owner.accountKey, url, binary: true,
            contentType: blob.type || 'application/octet-stream', sizeBytes: blob.size,
            savedAt: new Date().toISOString(), encrypted: { iv, cipher },
        });
        await transactionDone(tx);
        db.close();
    }

    async function readBinarySnapshot(url, identity) {
        const owner = identity || currentIdentity();
        if (!owner) return null;
        const account = await getAccount(owner.accountKey);
        if (!account?.cryptoKey || account.locked) return null;
        const id = `${owner.accountKey}:${url}`;
        const db = await openDatabase();
        const tx = db.transaction('snapshots', 'readonly');
        const row = await requestResult(tx.objectStore('snapshots').get(id));
        db.close();
        if (!row?.binary) return null;
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: row.encrypted.iv, additionalData: encoder.encode(`${owner.accountKey}:binary:${url}`) },
            account.cryptoKey,
            row.encrypted.cipher
        );
        return new Blob([plain], { type: row.contentType || 'application/octet-stream' });
    }

    async function listSnapshotUrls(accountKey) {
        if (!accountKey) return [];
        const db = await openDatabase();
        const tx = db.transaction('snapshots', 'readonly');
        const rows = await requestResult(tx.objectStore('snapshots').index('account_key').getAll(accountKey));
        db.close();
        return rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).map((row) => ({ url: row.url, binary: Boolean(row.binary) }));
    }

    async function setAccountLocked(accountKey, locked) {
        const account = await getAccount(accountKey);
        if (!account) return;
        const db = await openDatabase();
        const tx = db.transaction('accounts', 'readwrite');
        tx.objectStore('accounts').put({ ...account, locked: Boolean(locked), lastUsedAt: new Date().toISOString() });
        await transactionDone(tx);
        db.close();
    }

    async function purgeAccount(accountKey) {
        if (!accountKey) return;
        const db = await openDatabase();
        const stores = ['snapshots', 'outbox', 'sync_results'];
        const tx = db.transaction([...stores, 'accounts'], 'readwrite');
        for (const storeName of stores) {
            const store = tx.objectStore(storeName);
            const rows = await requestResult(store.index('account_key').getAllKeys(accountKey));
            rows.forEach((key) => store.delete(key));
        }
        tx.objectStore('accounts').delete(accountKey);
        await transactionDone(tx);
        db.close();
        broadcast({ type: 'account-purged', accountKey });
    }

    async function setMeta(key, value) {
        const db = await openDatabase();
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ key, value, updatedAt: new Date().toISOString() });
        await transactionDone(tx);
        db.close();
    }

    async function getMeta(key) {
        const db = await openDatabase();
        const tx = db.transaction('meta', 'readonly');
        const row = await requestResult(tx.objectStore('meta').get(key));
        db.close();
        return row?.value;
    }

    async function acquireSyncLock(accountKey, owner, ttlMs = 60000) {
        const key = `sync_lock:${accountKey}`;
        const db = await openDatabase();
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const existing = await requestResult(store.get(key));
        const now = Date.now();
        if (existing?.value?.expiresAt > now && existing.value.owner !== owner) {
            await transactionDone(tx);
            db.close();
            return false;
        }
        store.put({ key, value: { owner, expiresAt: now + ttlMs }, updatedAt: new Date().toISOString() });
        await transactionDone(tx);
        db.close();
        return true;
    }

    async function releaseSyncLock(accountKey, owner) {
        const key = `sync_lock:${accountKey}`;
        const db = await openDatabase();
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const existing = await requestResult(store.get(key));
        if (existing?.value?.owner === owner) store.delete(key);
        await transactionDone(tx);
        db.close();
    }

    function broadcast(message) {
        try {
            const channel = new BroadcastChannel(CHANNEL_NAME);
            channel.postMessage(message);
            channel.close();
        } catch (_error) {
        }
    }

    scope.NAAPOfflineStore = {
        DB_NAME,
        MAX_ACCOUNT_BYTES,
        CHANNEL_NAME,
        accountIdentity,
        currentIdentity,
        getAccount,
        ensureAccount,
        queueOperation,
        listOutbox,
        listOutboxForUser,
        outboxSummary,
        userOfflineSummary,
        updateOutbox,
        discardOperation,
        recordSyncFailure,
        completeOperation,
        saveSnapshot,
        readSnapshot,
        saveBinarySnapshot,
        readBinarySnapshot,
        listSnapshotUrls,
        setAccountLocked,
        purgeAccount,
        setMeta,
        getMeta,
        acquireSyncLock,
        releaseSyncLock,
        broadcast,
    };
})(typeof self !== 'undefined' ? self : window);
