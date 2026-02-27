(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    function pickLocalStoragePayload() {
        const read = (k) => {
            try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
        };
        return {
            inventoryItems: read('inventoryItems') || [],
            rentalRecords: read('rentalRecords') || [],
            barcodeStudents: read('barcodeStudents') || [],
            barcodeOfficers: read('barcodeOfficers') || [],
        };
    }

    function showResult(result) {
        $('import_result').textContent = JSON.stringify(result, null, 2);
    }

    async function runImport(payload) {
        const msg = $('import_msg');
        msg.textContent = '';
        try {
            const res = await window.igpApi.importLegacy(payload);
            showResult(res.result);
            msg.textContent = 'Import completed.';
        } catch (err) {
            msg.textContent = err.message;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        $('import_from_local').addEventListener('click', async () => {
            await runImport(pickLocalStoragePayload());
        });

        $('import_from_json').addEventListener('click', async () => {
            try {
                const raw = $('import_json').value.trim();
                const payload = JSON.parse(raw);
                await runImport(payload);
            } catch (err) {
                $('import_msg').textContent = 'Invalid JSON payload.';
            }
        });
    });
})();
