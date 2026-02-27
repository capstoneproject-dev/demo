(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let data = null;

    function peso(v) {
        return `₱${Number(v || 0).toFixed(2)}`;
    }

    function parseDate(v) {
        if (!v) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function byFilters(items) {
        const itemName = ($('fsItemFilter') || {}).value || '';
        const payment = ($('fsPaymentStatus') || {}).value || '';
        const start = parseDate(($('fsStartDate') || {}).value ? `${$('fsStartDate').value}T00:00:00` : '');
        const end = parseDate(($('fsEndDate') || {}).value ? `${$('fsEndDate').value}T23:59:59` : '');
        return (items || []).filter((r) => {
            if (itemName && String(r.items_label || '').indexOf(itemName) === -1) return false;
            if (payment && r.payment_status !== payment) return false;
            const d = parseDate(r.actual_return_time || r.rent_time);
            if (!d) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });
    }

    function render() {
        if (!data) return;
        const rows = byFilters(data.items || []);

        const names = Array.from(new Set((data.items || []).map((r) => (r.items_label || '').split(',')[0]?.trim() || '-')));
        if ($('fsItemFilter')) {
            const cur = $('fsItemFilter').value;
            $('fsItemFilter').innerHTML = '<option value="">All</option>' + names.map((n) => `<option value="${n}">${n}</option>`).join('');
            $('fsItemFilter').value = cur;
        }

        let totalProfit = 0;
        let totalUnpaid = 0;
        let paid = 0;
        let unpaid = 0;
        let highest = { val: -1, rec: null };
        let lowest = { val: Number.MAX_VALUE, rec: null };
        const dates = [];
        rows.forEach((r) => {
            const v = Number(r.total_cost || 0);
            if (r.payment_status === 'paid') { totalProfit += v; paid++; } else { totalUnpaid += v; unpaid++; }
            if (v > highest.val) highest = { val: v, rec: r };
            if (v < lowest.val) lowest = { val: v, rec: r };
            const d = parseDate(r.rent_time); if (d) dates.push(d);
        });

        if ($('fsTotalProfit')) $('fsTotalProfit').textContent = peso(totalProfit);
        if ($('fsTotalUnpaid')) $('fsTotalUnpaid').textContent = peso(totalUnpaid);
        if ($('fsTotalTransactions')) $('fsTotalTransactions').textContent = String(rows.length);
        if ($('fsPaidTransactions')) $('fsPaidTransactions').textContent = String(paid);
        if ($('fsUnpaidTransactions')) $('fsUnpaidTransactions').textContent = String(unpaid);
        if ($('fsAvgPaid')) $('fsAvgPaid').textContent = peso(paid ? totalProfit / paid : 0);
        if ($('fsHighest')) $('fsHighest').textContent = highest.rec ? peso(highest.val) : '₱0.00';
        if ($('fsHighestStudent')) $('fsHighestStudent').textContent = highest.rec ? `${highest.rec.renter_name || '-'} (${highest.rec.renter_student_number || '-'})` : '';
        if ($('fsLowest')) $('fsLowest').textContent = lowest.rec && lowest.val < Number.MAX_VALUE ? peso(lowest.val) : '₱0.00';
        if ($('fsLowestStudent')) $('fsLowestStudent').textContent = lowest.rec ? `${lowest.rec.renter_name || '-'} (${lowest.rec.renter_student_number || '-'})` : '';
        if ($('fsDateRange')) {
            if (!dates.length) $('fsDateRange').textContent = '-';
            else {
                dates.sort((a, b) => a - b);
                $('fsDateRange').textContent = `${dates[0].toLocaleDateString()} - ${dates[dates.length - 1].toLocaleDateString()}`;
            }
        }

        const tbody = $('fsAllTransactions');
        if (tbody) {
            tbody.innerHTML = '';
            rows.sort((a, b) => new Date(b.rent_time) - new Date(a.rent_time)).forEach((r) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(r.rent_time).toLocaleDateString()}</td>
                    <td>${r.items_label || '-'}</td>
                    <td>${r.renter_name || '-'} (${r.renter_student_number || '-'})</td>
                    <td>-</td>
                    <td>${r.processor_name || '-'}</td>
                    <td>${r.actual_return_time ? (r.processor_name || '-') : '-'}</td>
                    <td>${peso(r.total_cost || 0)}</td>
                    <td>${peso(0)}</td>
                    <td>${peso(r.total_cost || 0)}</td>
                    <td>${r.status}</td>
                    <td>${r.payment_status}</td>
                    <td>${(r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? `<button class="btn btn-success btn-sm js-paid" data-id="${r.rental_id}">Mark as Paid</button>` : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        const monthly = {};
        rows.forEach((r) => {
            const d = parseDate(r.rent_time); if (!d) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[key]) monthly[key] = { profit: 0, unpaid: 0, tx: 0, paid: 0, unpaidTx: 0 };
            const v = Number(r.total_cost || 0);
            monthly[key].tx++;
            if (r.payment_status === 'paid') { monthly[key].profit += v; monthly[key].paid++; }
            else { monthly[key].unpaid += v; monthly[key].unpaidTx++; }
        });
        const mb = $('fsMonthlyBreakdown');
        if (mb) {
            mb.innerHTML = '';
            Object.keys(monthly).sort().forEach((k) => {
                const m = monthly[k];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${k}</td>
                    <td>${peso(m.profit)}</td>
                    <td>${peso(m.unpaid)}</td>
                    <td>${m.tx}</td>
                    <td>${m.paid}</td>
                    <td>${m.unpaidTx}</td>
                    <td>-</td>
                `;
                mb.appendChild(tr);
            });
        }
    }

    async function refresh() {
        data = await window.igpApi.getFinancialSummary({});
        render();
    }

    function bind() {
        ['fsItemFilter', 'fsStartDate', 'fsEndDate', 'fsPaymentStatus'].forEach((id) => {
            const el = $(id);
            if (el) {
                el.addEventListener('input', render);
                el.addEventListener('change', render);
            }
        });
        if ($('fsClearFilters')) $('fsClearFilters').addEventListener('click', () => {
            ['fsItemFilter', 'fsStartDate', 'fsEndDate', 'fsPaymentStatus'].forEach((id) => {
                const el = $(id);
                if (!el) return;
                if (el.tagName === 'SELECT') el.value = '';
                else el.value = '';
            });
            render();
        });
        if ($('fsAllTransactions')) $('fsAllTransactions').addEventListener('click', async (e) => {
            const btn = e.target.closest('.js-paid');
            if (!btn) return;
            try {
                await window.igpApi.markPaid(Number(btn.dataset.id));
                await refresh();
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
