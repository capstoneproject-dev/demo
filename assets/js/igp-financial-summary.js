(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    function peso(v) {
        return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function refresh() {
        const filters = {
            q: $('fs_q').value.trim(),
            payment_status: $('fs_payment').value,
            date_from: $('fs_date_from').value,
            date_to: $('fs_date_to').value,
        };
        const data = await window.igpApi.getFinancialSummary(filters);
        $('fs_total_transactions').textContent = data.total_transactions;
        $('fs_paid_transactions').textContent = data.paid_transactions;
        $('fs_unpaid_transactions').textContent = data.unpaid_transactions;
        $('fs_total_revenue').textContent = peso(data.total_revenue);
        $('fs_total_unpaid').textContent = peso(data.total_unpaid);

        const tbody = $('fs_rows');
        tbody.innerHTML = '';
        (data.items || []).forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.rental_id}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'}</td>
                <td>${new Date(r.rent_time).toLocaleString()}</td>
                <td>${Number(r.total_cost).toFixed(2)}</td>
                <td>${r.payment_status}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function bind() {
        ['fs_q', 'fs_payment', 'fs_date_from', 'fs_date_to'].forEach((id) => {
            $(id).addEventListener('input', () => { refresh().catch(() => {}); });
            $(id).addEventListener('change', () => { refresh().catch(() => {}); });
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bind();
        try {
            await refresh();
        } catch (err) {
            $('fs_msg').textContent = err.message;
        }
    });
})();
