(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let deleteTargetId = 0;
    let editingPriceItemId = 0;

    function safeGroupName(name) {
        return String(name || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function categoryKey(item) {
        return String(item.category_name || '').trim() || 'Uncategorized';
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
            const key = categoryKey(item);
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
                            <th>Rate / Overtime</th>
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
                                    <td>PHP ${fmtNumber(item.hourly_rate)}/hr${item.overtime_interval_minutes ? `<br><small class="text-muted">+ PHP ${fmtNumber(item.overtime_rate_per_block)} / ${item.overtime_interval_minutes} mins</small>` : ''}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>${statusBadge(status)}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>
                                        <div class="inventory-actions d-flex gap-2 flex-wrap">
                                            <button class="btn btn-sm btn-outline-primary js-edit-price" data-id="${item.item_id}">Edit Price</button>
                                            <button class="btn btn-sm btn-danger js-delete" data-id="${item.item_id}">Delete</button>
                                        </div>
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

    function openPriceModal(item) {
        editingPriceItemId = Number(item.item_id);
        const label = $('priceEditItemLabel');
        const rate = $('priceModalHourlyRate');
        const interval = $('priceModalOvertimeInterval');
        const overtime = $('priceModalOvertimeRate');
        const applyAll = $('priceModalApplyAll');
        const err = $('priceModalError');

        if (label) label.textContent = `Item ${item.item_id} - ${item.item_name} (${categoryKey(item)})`;
        if (rate) rate.value = fmtNumber(item.hourly_rate);
        if (interval) interval.value = item.overtime_interval_minutes ?? '';
        if (overtime) overtime.value = item.overtime_rate_per_block ?? '';
        if (applyAll) applyAll.checked = false;
        if (err) err.style.display = 'none';

        const modalEl = $('priceEditModal');
        if (modalEl && window.bootstrap) {
            const modal = new window.bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    async function savePriceModal() {
        const currentItem = inventory.find((it) => Number(it.item_id) === editingPriceItemId);
        if (!currentItem) return;

        const rateVal = Number((($('priceModalHourlyRate') || {}).value || ''));
        const intervalRaw = String((($('priceModalOvertimeInterval') || {}).value || '')).trim();
        const overtimeRaw = String((($('priceModalOvertimeRate') || {}).value || '')).trim();
        const applyAll = Boolean((($('priceModalApplyAll') || {}).checked));
        const err = $('priceModalError');

        if (!Number.isFinite(rateVal) || rateVal < 0) {
            if (err) {
                err.textContent = 'Hourly rate must be a non-negative number.';
                err.style.display = 'block';
            }
            return;
        }

        const intervalVal = intervalRaw === '' ? '' : Number(intervalRaw);
        if (intervalVal !== '' && (!Number.isFinite(intervalVal) || intervalVal <= 0)) {
            if (err) {
                err.textContent = 'Overtime interval must be a positive number.';
                err.style.display = 'block';
            }
            return;
        }

        const overtimeVal = overtimeRaw === '' ? '' : Number(overtimeRaw);
        if (overtimeVal !== '' && (!Number.isFinite(overtimeVal) || overtimeVal < 0)) {
            if (err) {
                err.textContent = 'Overtime rate must be a non-negative number.';
                err.style.display = 'block';
            }
            return;
        }

        const targets = applyAll
            ? inventory.filter((it) => categoryKey(it) === categoryKey(currentItem))
            : [currentItem];

        const saveBtn = $('priceModalSaveBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await Promise.all(targets.map((item) => window.igpApi.saveInventory({
                item_id: item.item_id,
                item_name: item.item_name,
                barcode: item.barcode,
                category_name: item.category_name,
                stock_quantity: item.stock_quantity,
                hourly_rate: rateVal,
                status: item.status || 'available',
                overtime_interval_minutes: intervalVal,
                overtime_rate_per_block: overtimeVal,
            })));

            const modalEl = $('priceEditModal');
            const modal = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            await refresh();
        } catch (e) {
            if (err) {
                err.textContent = e.message;
                err.style.display = 'block';
            }
        } finally {
            if (saveBtn) saveBtn.disabled = false;
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

        root.addEventListener('click', (e) => {
            const toggle = e.target.closest('.toggle-group');
            if (toggle) {
                const group = toggle.dataset.group;
                const itemsRow = root.querySelector(`.group-items.group-${group}`);
                const shouldShow = itemsRow && itemsRow.style.display === 'none';
                if (itemsRow) itemsRow.style.display = shouldShow ? 'table-row' : 'none';
                toggle.textContent = shouldShow ? 'Hide Items' : 'Show Items';
                return;
            }

            const editPrice = e.target.closest('.js-edit-price');
            if (editPrice) {
                const item = inventory.find((x) => x.item_id === Number(editPrice.dataset.id || 0));
                if (!item) return;
                openPriceModal(item);
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
        if ($('priceModalSaveBtn')) {
            $('priceModalSaveBtn').addEventListener('click', async () => {
                await savePriceModal();
            });
        }
        try {
            await refresh();
        } catch (e) {
            alert(e.message);
        }
    });
})();
