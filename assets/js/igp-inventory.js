(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    let currentItems = [];

    async function refresh() {
        const q = $('inv_q').value.trim();
        const { items } = await window.igpApi.getInventory({ q });
        currentItems = items;
        const tbody = $('inventory_rows');
        tbody.innerHTML = '';
        items.forEach((it) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${it.item_id}</td>
                <td>${it.item_name}</td>
                <td>${it.barcode}</td>
                <td>${it.category_name}</td>
                <td>${it.available_quantity}/${it.stock_quantity}</td>
                <td>${it.hourly_rate.toFixed(2)}</td>
                <td>${it.status}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary js-edit" data-id="${it.item_id}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger js-del" data-id="${it.item_id}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function fillForm(it) {
        $('item_id').value = it ? it.item_id : '';
        $('item_name').value = it ? it.item_name : '';
        $('barcode').value = it ? it.barcode : '';
        $('category_name').value = it ? it.category_name : '';
        $('stock_quantity').value = it ? it.stock_quantity : 1;
        $('hourly_rate').value = it ? it.hourly_rate : 0;
        $('status').value = it ? it.status : 'available';
        $('overtime_interval_minutes').value = it && it.overtime_interval_minutes !== null ? it.overtime_interval_minutes : '';
        $('overtime_rate_per_block').value = it && it.overtime_rate_per_block !== null ? it.overtime_rate_per_block : '';
    }

    function bind() {
        $('inv_q').addEventListener('input', () => { refresh().catch(() => {}); });
        $('inventory_form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = $('inv_msg');
            msg.textContent = '';
            try {
                await window.igpApi.saveInventory({
                    item_id: $('item_id').value ? Number($('item_id').value) : 0,
                    item_name: $('item_name').value.trim(),
                    barcode: $('barcode').value.trim(),
                    category_name: $('category_name').value.trim(),
                    stock_quantity: Number($('stock_quantity').value),
                    hourly_rate: Number($('hourly_rate').value),
                    status: $('status').value,
                    overtime_interval_minutes: $('overtime_interval_minutes').value.trim(),
                    overtime_rate_per_block: $('overtime_rate_per_block').value.trim(),
                });
                fillForm(null);
                msg.textContent = 'Saved successfully.';
                await refresh();
            } catch (err) {
                msg.textContent = err.message;
            }
        });

        $('clear_form').addEventListener('click', () => fillForm(null));

        $('inventory_rows').addEventListener('click', async (e) => {
            const edit = e.target.closest('.js-edit');
            if (edit) {
                const id = Number(edit.dataset.id);
                const found = currentItems.find((x) => x.item_id === id);
                if (found) fillForm(found);
                return;
            }
            const del = e.target.closest('.js-del');
            if (!del) return;
            const id = Number(del.dataset.id);
            if (!confirm('Delete this inventory item?')) return;
            try {
                await window.igpApi.deleteInventory(id);
                await refresh();
            } catch (err) {
                $('inv_msg').textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bind();
        try {
            await refresh();
        } catch (err) {
            $('inv_msg').textContent = err.message;
        }
    });
})();
