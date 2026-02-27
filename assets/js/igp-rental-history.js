(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    async function refresh() {
        const filters = {
            q: $('rh_q').value.trim(),
            status: $('rh_status').value,
            payment_status: $('rh_payment').value,
            date_from: $('rh_date_from').value,
            date_to: $('rh_date_to').value,
        };
        const { items } = await window.igpApi.getRentals(filters);
        const tbody = $('rh_rows');
        tbody.innerHTML = '';
        items.forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.rental_id}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'} (${r.renter_student_number || '-'})</td>
                <td>${new Date(r.rent_time).toLocaleString()}</td>
                <td>${r.actual_return_time ? new Date(r.actual_return_time).toLocaleString() : '-'}</td>
                <td>${Number(r.total_cost).toFixed(2)}</td>
                <td>${r.status}</td>
                <td>${r.payment_status}</td>
                <td>${(r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? `<button class="btn btn-sm btn-success js-paid" data-id="${r.rental_id}">Mark Paid</button>` : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function bind() {
        ['rh_q', 'rh_status', 'rh_payment', 'rh_date_from', 'rh_date_to'].forEach((id) => {
            $(id).addEventListener('input', () => { refresh().catch(() => {}); });
            $(id).addEventListener('change', () => { refresh().catch(() => {}); });
        });
        $('rh_rows').addEventListener('click', async (e) => {
            const btn = e.target.closest('.js-paid');
            if (!btn) return;
            const rid = Number(btn.dataset.id);
            try {
                await window.igpApi.markPaid(rid);
                await refresh();
            } catch (err) {
                $('rh_msg').textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bind();
        try {
            await refresh();
        } catch (err) {
            $('rh_msg').textContent = err.message;
        }
    });
})();
