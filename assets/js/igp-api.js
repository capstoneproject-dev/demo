(function () {
    'use strict';

    function resolveBase() {
        const path = (window.location && window.location.pathname) || '';
        if (path.includes('/pages/igp/') || path.includes('/pages/shared/')) {
            return '../../api/igp';
        }
        return '../api/igp';
    }

    const BASE = resolveBase();

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
        const isFormData = opts && opts.body instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
        const res = await fetch(BASE + path, {
            credentials: 'same-origin',
            headers,
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
        getInventoryCategories() {
            return req('/inventory/categories.php', { method: 'GET' });
        },
        getInventoryItemNames(categoryName = '') {
            return req('/inventory/item-names.php' + buildQuery({ category_name: categoryName }), { method: 'GET' });
        },
        saveInventory(payload) {
            return req('/inventory/save.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        saveInventoryForm(payload) {
            return req('/inventory/save.php', { method: 'POST', body: payload });
        },
        deleteInventory(itemId) {
            return req('/inventory/delete.php', { method: 'POST', body: JSON.stringify({ item_id: itemId }) });
        },
        getRentals(filters = {}) {
            return req('/rentals/list.php' + buildQuery(filters), { method: 'GET' });
        },
        startRental(rentalId) {
            return req('/rentals/start.php', { method: 'POST', body: JSON.stringify({ rental_id: rentalId }) });
        },
        markNoShow(rentalId) {
            return req('/rentals/no-show.php', { method: 'POST', body: JSON.stringify({ rental_id: rentalId }) });
        },
        rentItem(payload) {
            return req('/rentals/rent.php', { method: 'POST', body: JSON.stringify(payload) });
        },
        returnRental(rentalId) {
            return req('/rentals/return.php', { method: 'POST', body: JSON.stringify({ rental_id: rentalId }) });
        },
        markPaid(rentalId) {
            return req('/rentals/mark-paid.php', {
                method: 'POST',
                body: JSON.stringify({ rental_id: rentalId }),
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
