// Run: node tests/concurrency/printing-partial-client.cjs
// Exercise real encryption and replacement logic with an in-memory IndexedDB adapter.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

(async () => {
    const account = { cryptoKey: await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) };
    const outbox = new Map();
    const receipts = new Map();
    let abortNext = false;
    const db = {
        close() {},
        transaction() {
            const staged = { outbox: new Map(outbox), sync_results: new Map(receipts) };
            const tx = {
                objectStore(name) {
                    const rows = staged[name];
                    return {
                        get(id) {
                            const req = {};
                            setImmediate(() => {
                                req.result = rows.get(id);
                                req.onsuccess();
                                setImmediate(() => {
                                    if (abortNext) { abortNext = false; tx.onabort(); return; }
                                    outbox.clear(); receipts.clear();
                                    for (const [k, v] of staged.outbox) outbox.set(k, v);
                                    for (const [k, v] of staged.sync_results) receipts.set(k, v);
                                    tx.oncomplete();
                                });
                            });
                            return req;
                        },
                        delete(id) { rows.delete(id); },
                        add(row) { assert(!rows.has(row.operationId)); rows.set(row.operationId, row); },
                        put(row) { rows.set(row.operationId, row); },
                    };
                },
            };
            return tx;
        },
    };
    const scope = {};
    const source = fs.readFileSync('assets/js/offline-store.js', 'utf8').replace('    scope.NAAPOfflineStore = {',
        '    getAccount = async () => scope.testAccount; openDatabase = async () => scope.testDb; broadcast = () => {}; scope.NAAPOfflineStore = {');
    scope.testAccount = account;
    scope.testDb = db;
    vm.runInNewContext(source, { window: scope, crypto: webcrypto, TextEncoder, TextDecoder, Blob, ArrayBuffer, Uint8Array, console });
    const row = {
        operationId: 'original', accountKey: 'account', type: 'student.printing.submit', endpoint: '/submit',
        value: { payload: { org_id: 3, notes: ['note A', 'note B', 'note C'] }, files:
            ['A', 'B', 'C'].map(name => ({ name: name + '.pdf', type: 'application/pdf', field: 'files[]', blob: new Blob([name]) })) },
    };
    const result = { partial: true, error: 'A saved; B and C remain', items: [{ print_job_id: 7 }], remaining_files: [{ index: 1 }, { index: 2 }] };
    const replace = scope.NAAPOfflineStore.replacePartialPrintingOperation;
    outbox.set(row.operationId, row);
    await replace(row, result);
    assert.equal(outbox.size, 1);
    const remaining = [...outbox.values()][0];
    assert.notEqual(remaining.operationId, row.operationId);
    assert.equal(remaining.status, 'pending');
    assert.equal(remaining.fileCount, 2);
    assert.equal(remaining.value, undefined);
    assert.deepEqual(Array.from(remaining.encryptedFiles, f => f.name), ['B.pdf', 'C.pdf']);
    async function decrypt(encrypted, aad) {
        return new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: encrypted.iv,
            additionalData: new TextEncoder().encode(aad) }, account.cryptoKey, encrypted.cipher));
    }
    const payload = JSON.parse(await decrypt(remaining.encrypted, `account:outbox:${remaining.operationId}`));
    assert.deepEqual(payload.payload.notes, ['note B', 'note C']);
    assert.equal(payload.payload.org_id, 3);
    for (let i = 0; i < 2; i++) assert.equal(await decrypt(remaining.encryptedFiles[i], `account:file:${remaining.operationId}:${i}`), ['B', 'C'][i]);
    assert.deepEqual(JSON.parse(await decrypt(receipts.get('original').encrypted, 'account:result:original')), result);
    await replace(row, result);
    assert.equal(outbox.size, 1, 'Old receipt replay must not create a second replacement');
    await assert.rejects(replace(row, { ...result, remaining_files: [{ index: 0 }, { index: 0 }] }));
    outbox.clear(); receipts.clear();
    const legacyRow = { ...row, value: { ...row.value, payload: { org_id: 3, 'notes[]': ['note A', 'note B', 'note C'] } } };
    outbox.set('original', legacyRow);
    await replace(legacyRow, result);
    const legacyReplacement = [...outbox.values()][0];
    const legacyValue = JSON.parse(await decrypt(legacyReplacement.encrypted, `account:outbox:${legacyReplacement.operationId}`));
    assert.deepEqual(legacyValue.payload.notes, ['note B', 'note C']);
    assert.equal(legacyValue.payload['notes[]'], undefined);
    outbox.clear(); receipts.clear(); outbox.set('original', row);
    abortNext = true;
    await assert.rejects(replace(row, result));
    assert.equal(outbox.get('original'), row, 'Aborted replacement must keep original');
    assert.equal(receipts.size, 0);
    console.log('Remaining-file encryption, matching notes, new ID, replay, validation, and atomic rollback passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
