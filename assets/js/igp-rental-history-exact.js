(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    let rentals = [];
    const rentalHistoryFilters = {
        startDate: null,
        endDate: null,
        month: null
    };
    let rentalHistoryCalendarCurrentDate = new Date();
    let rentalHistoryCalendarSelectedStart = null;
    let rentalHistoryCalendarSelectedEnd = null;

    function formatLocalDateKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');
    }

    function formatMonthKey(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
        ].join('-');
    }

    function parseDateKey(value) {
        if (!value) return null;
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date;
    }

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
        if (!tbody) return;

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
                <td>P${Number(r.total_cost || 0).toFixed(2)}</td>
                <td>${r.payment_status || '-'}</td>
                <td>${(r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? `<button class="btn btn-success btn-sm js-paid" data-id="${r.rental_id}">Mark as Paid</button>` : '-'}</td>
                <td>-</td>
            `;
            tbody.appendChild(tr);
        });

        const totals = totalProfitAndUnpaid(rows);
        if ($('totalProfit')) $('totalProfit').textContent = `P${totals.paid.toFixed(2)}`;
        if ($('totalUnpaid')) $('totalUnpaid').textContent = `P${totals.unpaid.toFixed(2)}`;
        if ($('payAllBtn')) $('payAllBtn').style.display = rows.some((r) => r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue')) ? '' : 'none';
    }

    function applyFilters() {
        let rows = rentals.slice();

        if (rentalHistoryFilters.month) {
            rows = rows.filter((r) => {
                const d = new Date(r.rent_time);
                if (Number.isNaN(d.getTime())) return false;
                return formatMonthKey(d) === rentalHistoryFilters.month;
            });
        } else if (rentalHistoryFilters.startDate || rentalHistoryFilters.endDate) {
            rows = rows.filter((r) => {
                const rentalDate = new Date(r.rent_time);
                if (Number.isNaN(rentalDate.getTime())) return false;
                rentalDate.setHours(0, 0, 0, 0);

                const startDate = rentalHistoryFilters.startDate ? parseDateKey(rentalHistoryFilters.startDate) : null;
                const endDate = rentalHistoryFilters.endDate ? parseDateKey(rentalHistoryFilters.endDate) : null;

                if (startDate && rentalDate < startDate) return false;
                if (endDate && rentalDate > endDate) return false;
                return true;
            });
        }

        render(rows);
    }

    function updateRentalHistoryFilterLabel() {
        const label = $('historyFilterLabel');
        if (!label) return;

        if (rentalHistoryFilters.month) {
            const selectedDate = new Date(`${rentalHistoryFilters.month}-01T00:00:00`);
            label.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            return;
        }

        if (rentalHistoryFilters.startDate && !rentalHistoryFilters.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayKey = formatLocalDateKey(today);
            label.textContent = rentalHistoryFilters.startDate === todayKey
                ? 'Today'
                : new Date(`${rentalHistoryFilters.startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return;
        }

        if (rentalHistoryFilters.startDate || rentalHistoryFilters.endDate) {
            const start = rentalHistoryFilters.startDate
                ? new Date(`${rentalHistoryFilters.startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            const end = rentalHistoryFilters.endDate
                ? new Date(`${rentalHistoryFilters.endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            label.textContent = `${start} - ${end}`;
            return;
        }

        label.textContent = 'All Dates';
    }

    function updateRentalHistorySelectedRangeDisplay() {
        const startDisplay = $('rentalHistorySelectedStartDate');
        const endDisplay = $('rentalHistorySelectedEndDate');

        if (startDisplay) {
            startDisplay.textContent = rentalHistoryCalendarSelectedStart
                ? rentalHistoryCalendarSelectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Not selected';
        }

        if (endDisplay) {
            endDisplay.textContent = rentalHistoryCalendarSelectedEnd
                ? rentalHistoryCalendarSelectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Not selected';
        }
    }

    function syncRentalHistoryCalendarSelectors() {
        const monthSelect = $('rentalHistoryCalendarMonthSelect');
        const yearSelect = $('rentalHistoryCalendarYearSelect');
        const selectedYear = rentalHistoryCalendarCurrentDate.getFullYear();
        const currentYear = new Date().getFullYear();

        if (monthSelect && monthSelect.options.length === 0) {
            monthSelect.innerHTML = MONTH_NAMES.map((monthName, index) => `<option value="${index}">${monthName}</option>`).join('');
        }

        if (yearSelect) {
            const startYear = 2000;
            const endYear = Math.max(currentYear + 10, selectedYear + 1);
            yearSelect.innerHTML = '';
            for (let year = endYear; year >= startYear; year--) {
                const option = document.createElement('option');
                option.value = String(year);
                option.textContent = String(year);
                yearSelect.appendChild(option);
            }
            yearSelect.value = String(selectedYear);
        }

        if (monthSelect) monthSelect.value = String(rentalHistoryCalendarCurrentDate.getMonth());
    }

    function renderRentalHistoryDateCalendar() {
        const year = rentalHistoryCalendarCurrentDate.getFullYear();
        const month = rentalHistoryCalendarCurrentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        syncRentalHistoryCalendarSelectors();

        const calendarDays = $('rentalHistoryCalendarDays');
        if (!calendarDays) return;
        calendarDays.innerHTML = '';

        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'igp-calendar-day empty';
            calendarDays.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            dateObj.setHours(0, 0, 0, 0);

            const dayCell = document.createElement('div');
            dayCell.className = 'igp-calendar-day';
            dayCell.textContent = day;

            if (dateObj.getTime() === today.getTime()) dayCell.classList.add('today');
            if (rentalHistoryCalendarSelectedStart && dateObj.getTime() === rentalHistoryCalendarSelectedStart.getTime()) dayCell.classList.add('selected');
            if (rentalHistoryCalendarSelectedEnd && dateObj.getTime() === rentalHistoryCalendarSelectedEnd.getTime()) dayCell.classList.add('selected');
            if (rentalHistoryCalendarSelectedStart && rentalHistoryCalendarSelectedEnd &&
                dateObj >= rentalHistoryCalendarSelectedStart && dateObj <= rentalHistoryCalendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }

            dayCell.addEventListener('click', () => selectRentalHistoryDate(dateObj));
            calendarDays.appendChild(dayCell);
        }

        updateRentalHistorySelectedRangeDisplay();
    }

    function selectRentalHistoryDate(date) {
        if (!rentalHistoryCalendarSelectedStart || (rentalHistoryCalendarSelectedStart && rentalHistoryCalendarSelectedEnd)) {
            rentalHistoryCalendarSelectedStart = date;
            rentalHistoryCalendarSelectedEnd = null;
        } else if (date < rentalHistoryCalendarSelectedStart) {
            rentalHistoryCalendarSelectedEnd = rentalHistoryCalendarSelectedStart;
            rentalHistoryCalendarSelectedStart = date;
        } else {
            rentalHistoryCalendarSelectedEnd = date;
        }

        renderRentalHistoryDateCalendar();
    }

    function selectEntireRentalHistoryMonth(year = rentalHistoryCalendarCurrentDate.getFullYear(), month = rentalHistoryCalendarCurrentDate.getMonth()) {
        rentalHistoryCalendarSelectedStart = new Date(year, month, 1);
        rentalHistoryCalendarSelectedStart.setHours(0, 0, 0, 0);
        rentalHistoryCalendarSelectedEnd = new Date(year, month + 1, 0);
        rentalHistoryCalendarSelectedEnd.setHours(0, 0, 0, 0);
    }

    function openRentalHistoryFilterModal() {
        const modal = $('rentalHistoryFilterModal');
        if (!modal) return;

        modal.classList.add('show');
        rentalHistoryCalendarSelectedStart = rentalHistoryFilters.startDate ? parseDateKey(rentalHistoryFilters.startDate) : null;
        rentalHistoryCalendarSelectedEnd = rentalHistoryFilters.endDate ? parseDateKey(rentalHistoryFilters.endDate) : null;
        rentalHistoryCalendarCurrentDate = rentalHistoryCalendarSelectedStart ? new Date(rentalHistoryCalendarSelectedStart) : new Date();
        if (rentalHistoryFilters.month) {
            const monthDate = new Date(`${rentalHistoryFilters.month}-01T00:00:00`);
            rentalHistoryCalendarCurrentDate = new Date(monthDate);
            selectEntireRentalHistoryMonth(monthDate.getFullYear(), monthDate.getMonth());
        }
        renderRentalHistoryDateCalendar();
        document.body.style.overflow = 'hidden';
    }

    function closeRentalHistoryFilterModal() {
        const modal = $('rentalHistoryFilterModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    function navigateRentalHistoryCalendarMonth(offset) {
        rentalHistoryCalendarCurrentDate.setMonth(rentalHistoryCalendarCurrentDate.getMonth() + offset);
        renderRentalHistoryDateCalendar();
    }

    function setRentalHistoryCalendarMonth(month) {
        const parsedMonth = Number(month);
        if (Number.isNaN(parsedMonth)) return;
        rentalHistoryCalendarCurrentDate.setMonth(parsedMonth);
        selectEntireRentalHistoryMonth(rentalHistoryCalendarCurrentDate.getFullYear(), parsedMonth);
        renderRentalHistoryDateCalendar();
    }

    function setRentalHistoryCalendarYear(year) {
        const parsedYear = Number(year);
        if (Number.isNaN(parsedYear)) return;
        rentalHistoryCalendarCurrentDate.setFullYear(parsedYear);
        if (rentalHistoryCalendarSelectedStart && rentalHistoryCalendarSelectedEnd) {
            selectEntireRentalHistoryMonth(parsedYear, rentalHistoryCalendarCurrentDate.getMonth());
        }
        renderRentalHistoryDateCalendar();
    }

    function applyRentalHistoryDatePreset(preset) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        rentalHistoryCalendarCurrentDate = new Date(today);

        let startDate;
        let endDate;

        switch (preset) {
            case 'today':
                startDate = new Date(today);
                endDate = null;
                break;
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = new Date(today);
                break;
            case 'month':
                startDate = new Date(today);
                startDate.setMonth(today.getMonth() - 1);
                endDate = new Date(today);
                break;
            default:
                startDate = null;
                endDate = null;
                break;
        }

        rentalHistoryCalendarSelectedStart = startDate;
        rentalHistoryCalendarSelectedEnd = endDate;
        renderRentalHistoryDateCalendar();
    }

    function applyRentalHistoryFilter() {
        rentalHistoryFilters.startDate = rentalHistoryCalendarSelectedStart ? formatLocalDateKey(rentalHistoryCalendarSelectedStart) : null;
        rentalHistoryFilters.endDate = rentalHistoryCalendarSelectedEnd ? formatLocalDateKey(rentalHistoryCalendarSelectedEnd) : null;
        rentalHistoryFilters.month = null;

        if (rentalHistoryCalendarSelectedStart && rentalHistoryCalendarSelectedEnd) {
            const startMonth = formatMonthKey(rentalHistoryCalendarSelectedStart);
            const endMonth = formatMonthKey(rentalHistoryCalendarSelectedEnd);
            const isWholeMonth =
                startMonth === endMonth &&
                rentalHistoryCalendarSelectedStart.getDate() === 1 &&
                rentalHistoryCalendarSelectedEnd.getDate() === new Date(
                    rentalHistoryCalendarSelectedEnd.getFullYear(),
                    rentalHistoryCalendarSelectedEnd.getMonth() + 1,
                    0
                ).getDate();

            if (isWholeMonth) {
                rentalHistoryFilters.month = startMonth;
                rentalHistoryFilters.startDate = null;
                rentalHistoryFilters.endDate = null;
            }
        }

        updateRentalHistoryFilterLabel();
        closeRentalHistoryFilterModal();
        applyFilters();
    }

    function clearAllRentalHistoryFilters() {
        rentalHistoryFilters.startDate = null;
        rentalHistoryFilters.endDate = null;
        rentalHistoryFilters.month = null;
        rentalHistoryCalendarSelectedStart = null;
        rentalHistoryCalendarSelectedEnd = null;
        updateRentalHistoryFilterLabel();
        applyFilters();
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
        $('historyFilterBtn')?.addEventListener('click', openRentalHistoryFilterModal);
        $('rentalHistoryFilterCloseBtn')?.addEventListener('click', closeRentalHistoryFilterModal);
        $('rentalHistoryFilterCancelBtn')?.addEventListener('click', closeRentalHistoryFilterModal);
        $('rentalHistoryFilterApplyBtn')?.addEventListener('click', applyRentalHistoryFilter);

        $('rentalHistoryDatePresetTodayBtn')?.addEventListener('click', () => applyRentalHistoryDatePreset('today'));
        $('rentalHistoryDatePresetWeekBtn')?.addEventListener('click', () => applyRentalHistoryDatePreset('week'));
        $('rentalHistoryDatePresetMonthBtn')?.addEventListener('click', () => applyRentalHistoryDatePreset('month'));
        $('rentalHistoryDatePresetAllBtn')?.addEventListener('click', () => applyRentalHistoryDatePreset('all'));

        $('rentalHistoryCalendarPrevBtn')?.addEventListener('click', () => navigateRentalHistoryCalendarMonth(-1));
        $('rentalHistoryCalendarNextBtn')?.addEventListener('click', () => navigateRentalHistoryCalendarMonth(1));
        $('rentalHistoryCalendarMonthSelect')?.addEventListener('change', (e) => setRentalHistoryCalendarMonth(e.target.value));
        $('rentalHistoryCalendarYearSelect')?.addEventListener('change', (e) => setRentalHistoryCalendarYear(e.target.value));

        $('showAllDatesBtn')?.addEventListener('click', clearAllRentalHistoryFilters);
        $('exportExcel')?.addEventListener('click', exportExcel);
        $('clearHistory')?.addEventListener('click', () => alert('Clear history is disabled in DB mode.'));
        $('importExcel')?.addEventListener('change', () => alert('Import from Excel is disabled in DB mode.'));
        $('payAllBtn')?.addEventListener('click', async () => {
            const pending = rentals.filter((r) => r.payment_status === 'unpaid' && (r.status === 'returned' || r.status === 'overdue'));
            for (const r of pending) {
                await window.igpApi.markPaid(Number(r.rental_id));
            }
            await refresh();
        });

        $('rentalHistoryRecords')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.js-paid');
            if (!btn) return;
            try {
                await markPaid(btn.dataset.id);
            } catch (err) {
                alert(err.message);
            }
        });

        $('rentalHistoryFilterModal')?.addEventListener('click', (e) => {
            if (e.target === $('rentalHistoryFilterModal')) {
                closeRentalHistoryFilterModal();
            }
        });
    }

    async function initRentalHistoryPage() {
        bind();
        updateRentalHistoryFilterLabel();
        try {
            await refresh();
        } catch (err) {
            alert(err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRentalHistoryPage);
    } else {
        initRentalHistoryPage();
    }
})();
