(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    async function loadInventorySelect() {
        const { items } = await window.igpApi.getInventory({ status: 'available' });
        const sel = $('rent_item_id');
        sel.innerHTML = '<option value="">Select item</option>';
        items.forEach((it) => {
            const opt = document.createElement('option');
            opt.value = String(it.item_id);
            opt.textContent = `${it.item_name} [${it.barcode}] (avail: ${it.available_quantity})`;
            sel.appendChild(opt);
        });
    }

    async function loadCurrentRentals() {
        const { items } = await window.igpApi.getRentals({ status: 'active' });
        const tbody = $('current_rentals');
        tbody.innerHTML = '';
        items.forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.rental_id}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'} (${r.renter_student_number || '-'})</td>
                <td>${new Date(r.rent_time).toLocaleString()}</td>
                <td>${new Date(r.expected_return_time).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-warning js-return" data-rid="${r.rental_id}">Return</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function bindActions() {
        $('rent_form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = $('rent_msg');
            msg.textContent = '';
            try {
                await window.igpApi.rentItem({
                    item_id: Number($('rent_item_id').value),
                    renter_identifier: $('rent_renter_identifier').value.trim(),
                    officer_identifier: $('rent_officer_identifier').value.trim(),
                    hours: Number($('rent_hours').value),
                    notes: $('rent_notes').value.trim(),
                });
                msg.textContent = 'Rental created successfully.';
                e.target.reset();
                await Promise.all([loadInventorySelect(), loadCurrentRentals()]);
            } catch (err) {
                msg.textContent = err.message;
            }
        });

        $('current_rentals').addEventListener('click', async (e) => {
            const btn = e.target.closest('.js-return');
            if (!btn) return;
            const rid = Number(btn.dataset.rid);
            if (!rid) return;
            const msg = $('rent_msg');
            msg.textContent = '';
            try {
                await window.igpApi.returnRental(rid);
                msg.textContent = `Rental #${rid} returned successfully.`;
                await Promise.all([loadInventorySelect(), loadCurrentRentals()]);
            } catch (err) {
                msg.textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindActions();
        try {
            await Promise.all([loadInventorySelect(), loadCurrentRentals()]);
        } catch (err) {
            $('rent_msg').textContent = err.message;
        }
    });
})();
