(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let deleteTargetId = 0;

    function safeGroupName(name) {
        return String(name || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function statusOf(item) {
        const status = String(item.status || '').toLowerCase();
        if (status === 'reserved' || status === 'maintenance' || status === 'rented' || status === 'available') {
            return status;
        }
        return Number(item.available_quantity) <= 0 ? 'rented' : 'available';
    }

    function statusBadge(status) {
        if (status === 'reserved') return '<span class="badge bg-warning text-dark">Reserved</span>';
        if (status === 'rented') return '<span class="badge bg-danger">Rented</span>';
        if (status === 'maintenance') return '<span class="badge bg-secondary">Maintenance</span>';
        return '<span class="badge bg-success">Available</span>';
    }

    function fmtNumber(v) {
        const n = Number(v || 0);
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }

    function groupedItems() {
        return inventory.reduce((acc, item) => {
            const key = item.item_name || 'Unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
    }

    function renderSummary(groups) {
        const summaryBody = $('inventorySummary');
        if (!summaryBody) return;
        summaryBody.innerHTML = '';

        Object.keys(groups).sort().forEach((groupName) => {
            const items = groups[groupName];
            const available = items.filter((i) => statusOf(i) === 'available').length;
            const rented = items.filter((i) => statusOf(i) === 'rented').length;
            const reserved = items.filter((i) => statusOf(i) === 'reserved').length;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${groupName}</td>
                <td>${items.length}</td>
                <td>${available}</td>
                <td>${rented}</td>
                <td>${reserved}</td>
            `;
            summaryBody.appendChild(row);
        });
    }

    function renderList(groups) {
        const tbody = $('inventoryList');
        if (!tbody) return;
        tbody.innerHTML = '';

        Object.keys(groups).sort().forEach((groupName) => {
            const safe = safeGroupName(groupName);
            const items = [...groups[groupName]].sort((a, b) => Number(a.item_id) - Number(b.item_id));
            const rep = items[0] || {};

            const headerRow = document.createElement('tr');
            headerRow.className = 'group-header';
            headerRow.innerHTML = `
                <td colspan="8">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong>${groupName}</strong>
                        <button class="btn btn-sm btn-outline-secondary toggle-group" data-group="${safe}">Show Items</button>
                    </div>
                </td>
            `;
            tbody.appendChild(headerRow);

            const pricingRow = document.createElement('tr');
            pricingRow.className = `group-pricing-row group-${safe}`;
            pricingRow.style.display = 'none';
            const pricingCell = document.createElement('td');
            pricingCell.colSpan = 8;
            pricingCell.innerHTML = `
                <div class="group-pricing-card" data-category="${groupName}">
                    <strong class="d-block mb-2">Pricing for all "${groupName}" items (${items.length} item${items.length !== 1 ? 's' : ''})</strong>
                    <div class="row g-2 align-items-end">
                        <div class="col-md-3 col-6">
                            <label class="form-label form-label-sm mb-1">Price Per Hour (PHP)</label>
                            <input type="number" class="form-control form-control-sm group-price-input" min="0" step="0.01"
                                value="${fmtNumber(rep.hourly_rate)}" placeholder="e.g. 10">
                        </div>
                        <div class="col-md-3 col-6">
                            <label class="form-label form-label-sm mb-1">Overtime Every (mins)</label>
                            <input type="number" class="form-control form-control-sm group-interval-input" min="1" step="1"
                                value="${rep.overtime_interval_minutes ?? ''}" placeholder="e.g. 30">
                        </div>
                        <div class="col-md-3 col-6">
                            <label class="form-label form-label-sm mb-1">Overtime Rate (PHP/block)</label>
                            <input type="number" class="form-control form-control-sm group-rate-input" min="0" step="0.01"
                                value="${rep.overtime_rate_per_block ?? ''}" placeholder="e.g. 5">
                        </div>
                        <div class="col-md-3 col-6 d-flex align-items-end">
                            <button class="btn btn-success btn-sm w-100 save-group-pricing-btn" data-category="${groupName}">Save Pricing</button>
                        </div>
                    </div>
                    <small class="text-muted d-block mt-1">Leave overtime fields blank to disable overtime charges for this group.</small>
                </div>
            `;
            pricingRow.appendChild(pricingCell);
            tbody.appendChild(pricingRow);

            const itemsContainer = document.createElement('tr');
            itemsContainer.className = `group-items group-${safe}`;
            itemsContainer.style.display = 'none';
            const itemsCell = document.createElement('td');
            itemsCell.colSpan = 8;
            itemsCell.innerHTML = `
                <table class="table table-sm mb-0">
                    <thead>
                        <tr>
                            <th>Item ID</th>
                            <th>Barcode</th>
                            <th>Last Renter</th>
                            <th>Current Renter / Reserved By</th>
                            <th>Status</th>
                            <th>Rental Start Time</th>
                            <th>Rental End Time</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item) => {
                            const status = statusOf(item);
                            return `
                                <tr>
                                    <td>${item.item_id}</td>
                                    <td>${item.barcode}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>${statusBadge(status)}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>
                                        <button class="btn btn-sm btn-danger js-delete" data-id="${item.item_id}">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            itemsContainer.appendChild(itemsCell);
            tbody.appendChild(itemsContainer);
        });
    }

    async function refresh() {
        const { items } = await window.igpApi.getInventory({});
        inventory = items || [];
        const groups = groupedItems();
        renderSummary(groups);
        renderList(groups);
    }

    async function saveGroupPricing(category, card) {
        const priceInput = card.querySelector('.group-price-input');
        const intervalInput = card.querySelector('.group-interval-input');
        const rateInput = card.querySelector('.group-rate-input');
        const saveBtn = card.querySelector('.save-group-pricing-btn');

        const newPrice = Number(priceInput?.value || 0);
        const parsedInterval = Number(intervalInput?.value || '');
        const parsedRate = Number(rateInput?.value || '');
        const overtimeInterval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : '';
        const overtimeRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : '';

        const toUpdate = inventory.filter((item) => item.item_name === category);
        if (toUpdate.length === 0) return;

        saveBtn.disabled = true;
        try {
            await Promise.all(toUpdate.map((item) => window.igpApi.saveInventory({
                item_id: item.item_id,
                item_name: item.item_name,
                barcode: item.barcode,
                category_name: item.category_name,
                stock_quantity: item.stock_quantity,
                hourly_rate: Number.isFinite(newPrice) && newPrice >= 0 ? newPrice : Number(item.hourly_rate || 0),
                status: item.status || 'available',
                overtime_interval_minutes: overtimeInterval,
                overtime_rate_per_block: overtimeRate,
            })));

            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved';
            await refresh();
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1200);
        } catch (err) {
            saveBtn.disabled = false;
            alert(err.message);
        }
    }

    function bindDeleteModal() {
        const confirmBtn = $('deleteItemConfirmBtn');
        const input = $('deleteItemConfirmInput');
        const err = $('deleteItemConfirmError');
        if (!confirmBtn || !input) return;

        confirmBtn.addEventListener('click', async () => {
            if (String(input.value || '').trim() !== 'Delete') {
                if (err) {
                    err.textContent = "You must type 'Delete' to confirm.";
                    err.style.display = 'block';
                }
                return;
            }

            try {
                await window.igpApi.deleteInventory(deleteTargetId);
                const modalEl = $('deleteItemModal');
                const modal = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                input.value = '';
                if (err) err.style.display = 'none';
                await refresh();
            } catch (e) {
                if (err) {
                    err.textContent = e.message;
                    err.style.display = 'block';
                }
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn.click();
            }
        });
    }

    function bindActions() {
        const root = $('inventoryList');
        if (!root) return;

        root.addEventListener('click', async (e) => {
            const toggle = e.target.closest('.toggle-group');
            if (toggle) {
                const group = toggle.dataset.group;
                const pricingRow = root.querySelector(`.group-pricing-row.group-${group}`);
                const itemsRow = root.querySelector(`.group-items.group-${group}`);
                const shouldShow = itemsRow && itemsRow.style.display === 'none';
                if (pricingRow) pricingRow.style.display = shouldShow ? 'table-row' : 'none';
                if (itemsRow) itemsRow.style.display = shouldShow ? 'table-row' : 'none';
                toggle.textContent = shouldShow ? 'Hide Items' : 'Show Items';
                return;
            }

            const savePricing = e.target.closest('.save-group-pricing-btn');
            if (savePricing) {
                const card = savePricing.closest('.group-pricing-card');
                const category = savePricing.dataset.category;
                if (card && category) {
                    await saveGroupPricing(category, card);
                }
                return;
            }

            const del = e.target.closest('.js-delete');
            if (del) {
                deleteTargetId = Number(del.dataset.id || 0);
                const modalEl = $('deleteItemModal');
                if (modalEl && window.bootstrap) {
                    const modal = new window.bootstrap.Modal(modalEl);
                    modal.show();
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindDeleteModal();
        bindActions();
        try {
            await refresh();
        } catch (e) {
            alert(e.message);
        }
    });
})();
