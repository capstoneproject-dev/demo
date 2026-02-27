(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const ADD_NEW_TYPE_VALUE = '__add_new__';
    let inventory = [];
    let deletingId = 0;

    function fmtRate(v) {
        const n = Number(v || 0);
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function group(items) {
        const out = {};
        items.forEach((it) => {
            const key = String(it.category_name || '').trim() || 'Uncategorized';
            if (!out[key]) out[key] = [];
            out[key].push(it);
        });
        return out;
    }

    function getAvailableTypes() {
        return [...new Set(inventory.map((it) => String(it.category_name || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
    }

    function populateTypeMenu(selectedType = '') {
        const select = $('itemType');
        if (!select) return;
        const types = getAvailableTypes();
        const selected = String(selectedType || '').trim();
        const hasSelected = selected !== '' && types.includes(selected);
        if (selected !== '' && !hasSelected) {
            types.unshift(selected);
        }
        select.innerHTML = `
            <option value="">Item Type</option>
            ${types.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}
            <option value="${ADD_NEW_TYPE_VALUE}">+ Add new type...</option>
        `;
        select.value = selected || '';
        toggleCustomTypeInput(select.value === ADD_NEW_TYPE_VALUE);
    }

    function toggleCustomTypeInput(show) {
        const select = $('itemType');
        const input = $('itemTypeCustom');
        if (!select || !input) return;
        select.classList.toggle('d-none', show);
        input.classList.toggle('d-none', !show);
        if (show) {
            input.focus();
        } else {
            input.value = '';
        }
    }

    function getSelectedType() {
        const selectValue = String((($('itemType') || {}).value || '')).trim();
        if (selectValue === ADD_NEW_TYPE_VALUE) {
            return String((($('itemTypeCustom') || {}).value || '')).trim();
        }
        return selectValue;
    }

    function render() {
        const q = (($('searchInput') || {}).value || '').toLowerCase();
        const filtered = !q ? inventory : inventory.filter((it) =>
            String(it.item_name || '').toLowerCase().includes(q) ||
            String(it.barcode || '').toLowerCase().includes(q) ||
            String(it.item_id || '').toLowerCase().includes(q)
        );
        const display = $('barcodeDisplay');
        if (!display) return;
        display.innerHTML = '';

        const grouped = group(filtered);
        Object.keys(grouped).sort().forEach((cat) => {
            const h = document.createElement('h3');
            h.className = 'category-title';
            h.textContent = cat;
            display.appendChild(h);

            grouped[cat].sort((a, b) => a.item_id - b.item_id).forEach((it) => {
                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <strong>${it.item_name}</strong><br>
                        <small>ID: ${it.item_id} | Barcode: ${it.barcode}</small><br>
                        <small>Rate: ₱${fmtRate(it.hourly_rate)}/hr</small>
                      </div>
                      <div>
                        <button class="btn btn-sm btn-outline-primary js-edit" data-id="${it.item_id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger js-delete" data-id="${it.item_id}" data-bs-toggle="modal" data-bs-target="#deleteItemModal">Delete</button>
                      </div>
                    </div>
                    <div class="barcode-container mt-2"><svg id="bc_${it.item_id}"></svg></div>
                `;
                display.appendChild(card);
                if (window.JsBarcode) {
                    window.JsBarcode(`#bc_${it.item_id}`, it.barcode, { width: 2, height: 50, displayValue: true });
                }
            });
        });
    }

    async function refresh() {
        const { items } = await window.igpApi.getInventory({});
        inventory = items || [];
        populateTypeMenu();
        render();
    }

    async function saveItem(existing) {
        const item_name = (($('itemName') || {}).value || '').trim();
        const item_type = getSelectedType();
        const barcode = (($('barcode') || {}).value || '').trim();
        const pricePerHour = Number((($('pricePerHour') || {}).value || '0'));
        const overtimeInterval = (($('overtimeInterval') || {}).value || '').trim();
        const overtimeRate = (($('overtimeRate') || {}).value || '').trim();
        if (!item_name || !item_type || !barcode) {
            alert('Item name, item type, and barcode are required.');
            return;
        }
        await window.igpApi.saveInventory({
            item_id: existing ? existing.item_id : 0,
            item_name,
            barcode,
            category_name: item_type,
            stock_quantity: 1,
            hourly_rate: Number.isFinite(pricePerHour) ? pricePerHour : 0,
            status: existing ? existing.status : 'available',
            overtime_interval_minutes: overtimeInterval,
            overtime_rate_per_block: overtimeRate,
        });
        if ($('addItemForm')) {
            $('addItemForm').reset();
            delete $('addItemForm').dataset.editId;
            populateTypeMenu();
        }
        await refresh();
    }

    function bind() {
        if ($('searchInput')) $('searchInput').addEventListener('input', render);
        if ($('clearSearch')) $('clearSearch').addEventListener('click', () => { $('searchInput').value = ''; render(); });

        if ($('addItemForm')) {
            $('addItemForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const editId = Number(($('addItemForm').dataset.editId || '0'));
                    const existing = editId ? inventory.find((x) => x.item_id === editId) : null;
                    await saveItem(existing || null);
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        if ($('itemType')) {
            $('itemType').addEventListener('change', () => {
                toggleCustomTypeInput($('itemType').value === ADD_NEW_TYPE_VALUE);
            });
        }

        if ($('itemTypeCustom')) {
            $('itemTypeCustom').addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    toggleCustomTypeInput(false);
                    if ($('itemType')) $('itemType').value = '';
                }
            });
            $('itemTypeCustom').addEventListener('blur', () => {
                const value = String($('itemTypeCustom').value || '').trim();
                if (value === '') {
                    toggleCustomTypeInput(false);
                    if ($('itemType')) $('itemType').value = '';
                }
            });
        }

        if ($('barcodeDisplay')) $('barcodeDisplay').addEventListener('click', async (e) => {
            const edit = e.target.closest('.js-edit');
            if (edit) {
                const it = inventory.find((x) => x.item_id === Number(edit.dataset.id));
                if (!it) return;
                $('itemName').value = it.item_name || '';
                populateTypeMenu(it.category_name || '');
                $('barcode').value = it.barcode || '';
                $('pricePerHour').value = fmtRate(it.hourly_rate);
                $('overtimeInterval').value = it.overtime_interval_minutes ?? '';
                $('overtimeRate').value = it.overtime_rate_per_block ?? '';
                $('addItemForm').dataset.editId = String(it.item_id);
                return;
            }
            const del = e.target.closest('.js-delete');
            if (del) deletingId = Number(del.dataset.id || 0);
        });

        if ($('confirmDeleteItem')) {
            $('confirmDeleteItem').addEventListener('click', async () => {
                const txt = (($('deleteItemConfirmInput') || {}).value || '').trim();
                if (txt !== 'Delete') {
                    if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'block';
                    return;
                }
                try {
                    await window.igpApi.deleteInventory(deletingId);
                    const modalEl = $('deleteItemModal');
                    const inst = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                    if ($('deleteItemConfirmInput')) $('deleteItemConfirmInput').value = '';
                    if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'none';
                    await refresh();
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        if ($('deleteItemConfirmInput')) {
            $('deleteItemConfirmInput').addEventListener('input', () => {
                const ok = $('deleteItemConfirmInput').value.trim() === 'Delete';
                if ($('confirmDeleteItem')) $('confirmDeleteItem').disabled = !ok;
                if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'none';
            });
        }

        if ($('deleteAll')) $('deleteAll').addEventListener('click', () => alert('Delete-all is disabled in DB mode.'));
        if ($('confirmDeleteAll')) $('confirmDeleteAll').addEventListener('click', () => {});
        if ($('importExcel')) $('importExcel').addEventListener('click', () => alert('Excel import is disabled in DB mode.'));
        if ($('exportExcel')) $('exportExcel').addEventListener('click', () => {
            if (!window.XLSX) return;
            const rows = inventory.map((it) => ({
                item_id: it.item_id,
                item_name: it.item_name,
                barcode: it.barcode,
                hourly_rate: it.hourly_rate,
                overtime_interval_minutes: it.overtime_interval_minutes,
                overtime_rate_per_block: it.overtime_rate_per_block,
                status: it.status
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            XLSX.writeFile(wb, 'inventory.xlsx');
        });
        if ($('downloadAll')) $('downloadAll').addEventListener('click', () => window.print());
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bind();
        try {
            await refresh();
        } catch (err) {
            alert(err.message);
        }
    });
})();
