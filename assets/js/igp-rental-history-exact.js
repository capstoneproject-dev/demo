(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let rentals = [];

    function formatDate(val) {
        if (!val) return '';
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    }

    function formatTime(val) {
        if (!val) return '';
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
    }

    function overdueText(r) {
        if (!r.actual_return_time || !r.expected_return_time) return '-';
        const a = new Date(r.actual_return_time).getTime();
        const e = new Date(r.expected_return_time).getTime();
        if (Number.isNaN(a) || Number.isNaN(e) || a <= e) return '-';
        let diff = Math.floor((a - e) / 1000);
        const h = Math.floor(diff / 3600); diff %= 3600;
        const m = Math.floor(diff / 60); const s = diff % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function totalProfitAndUnpaid(rows) {
        let paid = 0;
        let unpaid = 0;
        rows.forEach((r) => {
            const cost = Number(r.total_cost || 0);
            if (r.payment_status === 'paid') paid += cost;
            else if (r.status !== 'active') unpaid += cost;
        });
        return { paid, unpaid };
    }

    function render(rows) {
        const tbody = $('rentalHistoryRecords');
        tbody.innerHTML = '';
        rows.forEach((r) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.rental_id}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'}</td>
                <td>-</td>
                <td>${formatDate(r.rent_time)}</td>
                <td>${formatTime(r.rent_time)}</td>
                <td>${formatTime(r.expected_return_time)}</td>
                <td>${formatTime(r.actual_return_time)}</td>
                <td>${overdueText(r)}</td>
                <td>${r.status || '-'}</td>
                <td>${r.processor_name || '-'}</td>
                <td>${r.actual_return_time ? (r.processor_name || '-') : '-'}</td>
                <td>₱${Number(r.total_cost || 0).toFixed(2)}</td>
                <td>${r.payment_status || '-'}</td>
                <td>${(r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? `<button class="btn btn-success btn-sm js-paid" data-id="${r.rental_id}">Mark as Paid</button>` : '-'}</td>
                <td>-</td>
            `;
            tbody.appendChild(tr);
        });

        const totals = totalProfitAndUnpaid(rows);
        if ($('totalProfit')) $('totalProfit').textContent = `₱${totals.paid.toFixed(2)}`;
        if ($('totalUnpaid')) $('totalUnpaid').textContent = `₱${totals.unpaid.toFixed(2)}`;
        if ($('payAllBtn')) $('payAllBtn').style.display = rows.some((r) => r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? '' : 'none';
    }

    function applyFilters() {
        const dateVal = ($('historyDateFilter') || {}).value || '';
        const monthVal = ($('historyMonthFilter') || {}).value || '';
        let rows = rentals.slice();
        if (monthVal) {
            rows = rows.filter((r) => {
                const d = new Date(r.rent_time);
                if (Number.isNaN(d.getTime())) return false;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === monthVal;
            });
        } else if (dateVal) {
            rows = rows.filter((r) => formatDate(r.rent_time) === formatDate(`${dateVal}T00:00:00`));
        }
        render(rows);
    }

    async function refresh() {
        const { items } = await window.igpApi.getRentals({});
        rentals = items || [];
        applyFilters();
    }

    async function markPaid(id) {
        await window.igpApi.markPaid(Number(id));
        await refresh();
    }

    function exportExcel() {
        if (!window.XLSX) return;
        const rows = rentals.map((r) => ({
            RentalID: r.rental_id,
            Items: r.items_label,
            Renter: r.renter_name,
            RentDate: r.rent_time,
            ExpectedReturn: r.expected_return_time,
            ActualReturn: r.actual_return_time,
            Status: r.status,
            PaymentStatus: r.payment_status,
            Total: r.total_cost
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RentalHistory');
        XLSX.writeFile(wb, 'rental-history.xlsx');
    }

    function bind() {
        if ($('historyDateFilter')) $('historyDateFilter').addEventListener('input', applyFilters);
        if ($('historyMonthFilter')) $('historyMonthFilter').addEventListener('change', applyFilters);
        if ($('showAllDatesBtn')) $('showAllDatesBtn').addEventListener('click', () => {
            if ($('historyDateFilter')) $('historyDateFilter').value = '';
            if ($('historyMonthFilter')) $('historyMonthFilter').value = '';
            applyFilters();
        });
        if ($('exportExcel')) $('exportExcel').addEventListener('click', exportExcel);
        if ($('clearHistory')) $('clearHistory').addEventListener('click', () => alert('Clear history is disabled in DB mode.'));
        if ($('importExcel')) $('importExcel').addEventListener('change', () => alert('Import from Excel is disabled in DB mode.'));
        if ($('payAllBtn')) $('payAllBtn').addEventListener('click', async () => {
            const pending = rentals.filter((r) => r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue'));
            for (const r of pending) {
                await window.igpApi.markPaid(Number(r.rental_id));
            }
            await refresh();
        });
        if ($('rentalHistoryRecords')) $('rentalHistoryRecords').addEventListener('click', async (e) => {
            const btn = e.target.closest('.js-paid');
            if (!btn) return;
            try {
                await markPaid(btn.dataset.id);
            } catch (err) {
                alert(err.message);
            }
        });
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
