(function () {
    'use strict';

    const BASE = '../../api/igp';

    function buildQuery(params) {
        const search = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                search.set(k, String(v));
            }
        });
        const q = search.toString();
        return q ? `?${q}` : '';
    }

    async function req(path, opts) {
        const res = await fetch(BASE + path, {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            throw new Error(data.error || `Request failed (${res.status})`);
        }
        return data;
    }

    window.igpApi = {
        getInventory(filters = {}) {
            return req('/inventory/list.php' + buildQuery(filters), { method: 'GET' });
        },
        saveInventory(payload) {
            return req('/inventory/save.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        deleteInventory(itemId) {
            return req('/inventory/delete.php', { method: 'POST', body: JSON.stringify({ item_id: itemId }) });
        },
        getRentals(filters = {}) {
            return req('/rentals/list.php' + buildQuery(filters), { method: 'GET' });
        },
        rentItem(payload) {
            return req('/rentals/rent.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        returnRental(rentalId) {
            return req('/rentals/return.php', { method: 'POST', body: JSON.stringify({ rental_id: rentalId }) });
        },
        markPaid(rentalId, paymentMethod = 'cash') {
            return req('/rentals/mark-paid.php', {
                method: 'POST',
                body: JSON.stringify({ rental_id: rentalId, payment_method: paymentMethod }),
            });
        },
        getFinancialSummary(filters = {}) {
            return req('/reports/financial-summary.php' + buildQuery(filters), { method: 'GET' });
        },
        getOfficers() {
            return req('/reference/officers.php', { method: 'GET' });
        },
        importLegacy(payload) {
            return req('/migration/import-localstorage.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        getStudents() {
            return req('/students/list.php', { method: 'GET' });
        },
        saveStudent(payload) {
            return req('/students/save.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        deleteStudent(payload) {
            return req('/students/delete.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        getOrgOfficers() {
            return req('/officers/list.php', { method: 'GET' });
        },
        saveOrgOfficer(payload) {
            return req('/officers/save.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        deleteOrgOfficer(id) {
            return req('/officers/delete.php', { method: 'POST', body: JSON.stringify({ id }) });
        },
    };
})();
