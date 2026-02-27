(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let deleteTargetId = 0;

    function statusOf(item) {
        if ((item.status || '').toLowerCase() === 'maintenance') return 'maintenance';
        if (Number(item.available_quantity) <= 0) return 'rented';
        return 'available';
    }

    function grouped() {
        const out = {};
        inventory.forEach((it) => {
            const key = it.item_name || 'Unknown';
            if (!out[key]) out[key] = [];
            out[key].push(it);
        });
        return out;
    }

    function renderSummary() {
        const body = $('inventorySummary');
        body.innerHTML = '';
        const groups = grouped();
        Object.keys(groups).sort().forEach((name) => {
            const items = groups[name];
            const available = items.filter((i) => statusOf(i) === 'available').length;
            const rented = items.filter((i) => statusOf(i) === 'rented').length;
            const reserved = 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${name}</td>
                <td>${items.length}</td>
                <td>${available}</td>
                <td>${rented}</td>
                <td>${reserved}</td>
            `;
            body.appendChild(tr);
        });
    }

    function renderList() {
        const body = $('inventoryList');
        body.innerHTML = '';
        const groups = grouped();
        Object.keys(groups).sort().forEach((name) => {
            const items = groups[name].slice().sort((a, b) => a.item_id - b.item_id);
            const head = document.createElement('tr');
            head.className = 'group-header';
            head.innerHTML = `
                <td colspan="8">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong>${name}</strong>
                        <button class="btn btn-sm btn-outline-primary js-add-like" data-template="${items[0].item_id}">Add Similar Item</button>
                    </div>
                </td>
            `;
            body.appendChild(head);

            items.forEach((it) => {
                const st = statusOf(it);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${it.item_id}</td>
                    <td>${it.barcode}</td>
                    <td>-</td>
                    <td>-</td>
                    <td><span class="badge ${st === 'available' ? 'bg-success' : (st === 'rented' ? 'bg-warning text-dark' : 'bg-secondary')}">${st}</span></td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary js-edit" data-id="${it.item_id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger js-delete" data-id="${it.item_id}">Delete</button>
                    </td>
                `;
                body.appendChild(tr);
            });
        });
    }

    async function refresh() {
        const { items } = await window.igpApi.getInventory({});
        inventory = items || [];
        renderSummary();
        renderList();
    }

    async function savePrompt(existing) {
        const item_name = prompt('Item name:', existing ? existing.item_name : '');
        if (!item_name) return;
        const barcode = prompt('Barcode:', existing ? existing.barcode : '');
        if (!barcode) return;
        const category_name = prompt('Category name:', existing ? existing.category_name : 'General') || 'General';
        const stock_quantity = Number(prompt('Stock quantity:', existing ? existing.stock_quantity : 1) || 1);
        const hourly_rate = Number(prompt('Hourly rate:', existing ? existing.hourly_rate : 0) || 0);
        const overtime_interval_minutes = prompt('Overtime interval minutes (blank to disable):', existing && existing.overtime_interval_minutes != null ? existing.overtime_interval_minutes : '') || '';
        const overtime_rate_per_block = prompt('Overtime rate per block (blank to disable):', existing && existing.overtime_rate_per_block != null ? existing.overtime_rate_per_block : '') || '';

        await window.igpApi.saveInventory({
            item_id: existing ? existing.item_id : 0,
            item_name,
            barcode,
            category_name,
            stock_quantity,
            hourly_rate,
            status: existing ? existing.status : 'available',
            overtime_interval_minutes,
            overtime_rate_per_block,
        });
        await refresh();
    }

    function bindDeleteModal() {
        const confirmBtn = $('deleteItemConfirmBtn');
        const input = $('deleteItemConfirmInput');
        const err = $('deleteItemConfirmError');
        if (!confirmBtn || !input) return;
        confirmBtn.addEventListener('click', async () => {
            if (String(input.value || '').trim() !== 'Delete') {
                if (err) { err.textContent = "Please type 'Delete' to confirm."; err.style.display = 'block'; }
                return;
            }
            try {
                await window.igpApi.deleteInventory(deleteTargetId);
                const modalEl = $('deleteItemModal');
                const inst = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
                input.value = '';
                if (err) err.style.display = 'none';
                await refresh();
            } catch (e) {
                if (err) { err.textContent = e.message; err.style.display = 'block'; }
            }
        });
    }

    function bindActions() {
        const root = $('inventoryList');
        root.addEventListener('click', async (e) => {
            const del = e.target.closest('.js-delete');
            if (del) {
                deleteTargetId = Number(del.dataset.id);
                const modalEl = $('deleteItemModal');
                const inst = new window.bootstrap.Modal(modalEl);
                inst.show();
                return;
            }
            const edit = e.target.closest('.js-edit');
            if (edit) {
                const it = inventory.find((x) => x.item_id === Number(edit.dataset.id));
                if (it) {
                    try { await savePrompt(it); } catch (err) { alert(err.message); }
                }
                return;
            }
            const addLike = e.target.closest('.js-add-like');
            if (addLike) {
                const tpl = inventory.find((x) => x.item_id === Number(addLike.dataset.template));
                try { await savePrompt(tpl || null); } catch (err) { alert(err.message); }
            }
        });

        const headerButtons = document.querySelector('.d-flex.justify-content-between.align-items-center.mb-4 div');
        if (headerButtons && !$('btnAddInventory')) {
            const b = document.createElement('button');
            b.id = 'btnAddInventory';
            b.className = 'btn btn-success me-2';
            b.textContent = 'Add Item';
            b.addEventListener('click', async () => {
                try { await savePrompt(null); } catch (err) { alert(err.message); }
            });
            headerButtons.insertBefore(b, headerButtons.firstChild);
        }
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
