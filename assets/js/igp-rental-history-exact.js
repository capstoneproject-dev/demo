(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const RENTAL_COLUMN_PREFERENCE_KEY = 'naap:igp:rental-history:visible-columns:v2';

    let rentals = [];
    const rentalHistoryFilters = {
        startDate: null,
        endDate: null,
        month: null
    };
    let rentalHistoryCalendarCurrentDate = new Date();
    let rentalHistoryCalendarSelectedStart = null;
    let rentalHistoryCalendarSelectedEnd = null;
    let pendingPaymentRentals = [];
    let officers = [];
    let paymentOfficerScanTimer = null;
    let pendingReturnRental = null;
    let returnOfficerScanTimer = null;
    const PAYABLE_RENTAL_STATUSES = new Set(['returned', 'overdue', 'cancelled']);
    let visibleRentalColumns = null;
    let rentalOrderNumbers = new Map();

    function rebuildRentalOrderNumbers() {
        const chronological = rentals.slice().sort((left, right) => {
            const leftTime = new Date(left.rent_time || 0).getTime();
            const rightTime = new Date(right.rent_time || 0).getTime();
            const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
            const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
            if (safeLeftTime !== safeRightTime) return safeLeftTime - safeRightTime;
            return Number(left.rental_id || 0) - Number(right.rental_id || 0);
        });
        rentalOrderNumbers = new Map(
            chronological.map((rental, index) => [String(rental.rental_id), index + 1])
        );
    }

    function rentalOrderNumber(rental) {
        return rentalOrderNumbers.get(String(rental.rental_id)) || '-';
    }

    function rentalColumnStorageKey() {
        const accountKey = window.NAAPOfflineStore?.currentIdentity?.()?.accountKey || 'default';
        return `${RENTAL_COLUMN_PREFERENCE_KEY}:${accountKey}`;
    }

    function rentalColumnHeaders() {
        return [...document.querySelectorAll('.rental-history-card table thead th')];
    }

    function loadVisibleRentalColumns() {
        const count = rentalColumnHeaders().length;
        const all = Array.from({ length: count }, (_, index) => index);
        try {
            const saved = JSON.parse(localStorage.getItem(rentalColumnStorageKey()) || 'null');
            if (Array.isArray(saved)) {
                const valid = saved.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < count);
                if (valid.length) return new Set(valid);
            }
        } catch (_error) {
        }
        return new Set(all);
    }

    function saveVisibleRentalColumns() {
        try {
            localStorage.setItem(rentalColumnStorageKey(), JSON.stringify([...visibleRentalColumns].sort((a, b) => a - b)));
        } catch (_error) {
        }
    }

    function applyRentalColumnVisibility() {
        const headers = rentalColumnHeaders();
        if (!visibleRentalColumns) visibleRentalColumns = loadVisibleRentalColumns();
        headers.forEach((header, index) => {
            header.style.display = visibleRentalColumns.has(index) ? '' : 'none';
        });
        document.querySelectorAll('#rentalHistoryRecords tr').forEach((row) => {
            [...row.children].forEach((cell, index) => {
                cell.style.display = visibleRentalColumns.has(index) ? '' : 'none';
            });
        });
        document.querySelectorAll('#rentalColumnOptions input[data-column-index]').forEach((checkbox) => {
            checkbox.checked = visibleRentalColumns.has(Number(checkbox.dataset.columnIndex));
        });
        const label = $('rentalColumnsButtonLabel');
        if (label) label.textContent = `Columns (${visibleRentalColumns.size}/${headers.length})`;
    }

    function initializeRentalColumnFilter() {
        const options = $('rentalColumnOptions');
        const headers = rentalColumnHeaders();
        if (!options || !headers.length) return;
        visibleRentalColumns = loadVisibleRentalColumns();
        options.innerHTML = headers.map((header, index) => `
            <label class="rental-column-option">
                <input class="form-check-input" type="checkbox" data-column-index="${index}">
                <span>${header.textContent.trim()}</span>
            </label>
        `).join('');
        options.addEventListener('change', (event) => {
            const checkbox = event.target.closest('input[data-column-index]');
            if (!checkbox) return;
            const index = Number(checkbox.dataset.columnIndex);
            if (checkbox.checked) visibleRentalColumns.add(index);
            else visibleRentalColumns.delete(index);
            if (!visibleRentalColumns.size) {
                visibleRentalColumns.add(index);
                checkbox.checked = true;
                return;
            }
            saveVisibleRentalColumns();
            applyRentalColumnVisibility();
        });
        $('showAllRentalColumns')?.addEventListener('click', () => {
            visibleRentalColumns = new Set(headers.map((_header, index) => index));
            saveVisibleRentalColumns();
            applyRentalColumnVisibility();
        });
        applyRentalColumnVisibility();
    }

    function playScanBeep() {
        const beep = $('beepSound');
        if (!beep) return;
        beep.currentTime = 0;
        const playback = beep.play();
        if (playback && typeof playback.catch === 'function') {
            playback.catch(() => { /* Audio may be blocked until the first user interaction. */ });
        }
    }

    function encodeRef(raw, prefix) {
        const source = String(raw || '');
        if (!source) return '';
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            hash = ((hash << 5) - hash) + source.charCodeAt(i);
            hash |= 0;
        }
        let num = Math.abs(hash);
        let encoded = '';
        for (let i = 0; i < 4; i++) {
            encoded = chars[num % 62] + encoded;
            num = Math.floor(num / 62);
        }
        return `${prefix}${encoded}`;
    }

    function findOfficerByScan(value) {
        const scanned = String(value || '').trim().toLowerCase();
        if (!scanned) return null;
        return officers.find((officer) => {
            const identifiers = [
                String(officer.student_number || ''),
                String(officer.employee_number || ''),
                String(officer.officerId || ''),
            ].filter(Boolean);
            return identifiers.some((identifier) =>
                identifier.toLowerCase() === scanned
                || encodeRef(identifier, 'O').toLowerCase() === scanned
                || encodeRef(identifier, 'S').toLowerCase() === scanned
            );
        }) || null;
    }

    function paymentConfirmationIsReady() {
        const confirmation = $('paymentConfirmInput');
        const officerInput = $('paymentOfficerBarcode');
        return confirmation?.value.trim() === 'Confirm'
            && Boolean(officerInput?.dataset.verifiedOfficer)
            && pendingPaymentRentals.length > 0;
    }

    function updatePaymentConfirmButton() {
        const button = $('paymentConfirmBtn');
        if (button) button.disabled = !paymentConfirmationIsReady();
    }

    function verifyPaymentOfficerBarcode() {
        const input = $('paymentOfficerBarcode');
        const feedback = $('paymentOfficerBarcodeFeedback');
        if (!input) return null;

        const scannedValue = String(input.value || '').trim();
        if (!scannedValue) {
            delete input.dataset.verifiedOfficer;
            input.classList.remove('is-valid', 'is-invalid');
            updatePaymentConfirmButton();
            return null;
        }

        playScanBeep();
        const officer = findOfficerByScan(scannedValue);
        if (!officer) {
            delete input.dataset.verifiedOfficer;
            input.value = '';
            input.placeholder = 'Unknown officer ID. Scan a valid officer barcode.';
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            if (feedback) {
                feedback.textContent = 'Unknown officer ID. Scan a valid officer barcode.';
                feedback.className = 'text-danger mt-1';
            }
            updatePaymentConfirmButton();
            input.focus();
            return null;
        }

        const identifier = String(
            officer.student_number || officer.employee_number || officer.officerId || ''
        ).trim();
        input.dataset.verifiedOfficer = identifier;
        input.value = String(officer.officer_name || identifier).trim();
        input.placeholder = 'Scan officer barcode here...';
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        if (feedback) {
            feedback.textContent = `Officer verified: ${officer.officer_name || identifier}`;
            feedback.className = 'text-success mt-1';
        }
        updatePaymentConfirmButton();
        return officer;
    }

    function isPayableRental(rental) {
        const paymentStatus = String(rental?.payment_status || '').toLowerCase();
        const rentalStatus = String(rental?.status || '').toLowerCase();
        return paymentStatus === 'unpaid' && PAYABLE_RENTAL_STATUSES.has(rentalStatus);
    }

    function isReturnableRental(rental) {
        return String(rental?.status || '').toLowerCase() === 'active';
    }

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
            tr.dataset.rentalId = String(r.rental_id || '');
            if (r.pending_sync) {
                tr.classList.add('naap-queued-rental');
                tr.dataset.offlineStatus = r.offline_status === 'attention' ? 'attention' : 'queued';
            }
            tr.innerHTML = `
                <td>${rentalOrderNumber(r)}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'}</td>
                <td>${r.renter_section || '-'}</td>
                <td>${formatDate(r.rent_time)}</td>
                <td>${formatTime(r.rent_time)}</td>
                <td>${formatTime(r.expected_return_time)}</td>
                <td>${formatTime(r.actual_return_time)}</td>
                <td>${overdueText(r)}</td>
                <td>${r.status || '-'}${r.pending_sync ? ` <span class="badge text-bg-warning ms-1">${r.offline_status === 'attention' ? 'Needs attention' : 'Pending sync'}</span>` : ''}</td>
                <td>${r.processor_name || '-'}</td>
                <td>${r.actual_return_time ? (r.processor_name || '-') : '-'}</td>
                <td>P${Number(r.total_cost || 0).toFixed(2)}</td>
                <td>${r.payment_status || '-'}</td>
                <td>${isReturnableRental(r)
                    ? `<button class="btn btn-warning btn-sm js-return" data-id="${r.rental_id}">Return</button>`
                    : (isPayableRental(r) ? `<button class="btn btn-success btn-sm js-paid" data-id="${r.rental_id}">Mark as Paid</button>` : '-')}</td>
            `;
            tbody.appendChild(tr);
        });
        applyRentalColumnVisibility();

        const totals = totalProfitAndUnpaid(rows);
        if ($('totalProfit')) $('totalProfit').textContent = `P${totals.paid.toFixed(2)}`;
        if ($('totalUnpaid')) $('totalUnpaid').textContent = `P${totals.unpaid.toFixed(2)}`;
        if ($('payAllBtn')) $('payAllBtn').style.display = rows.some(isPayableRental) ? '' : 'none';
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

    async function applyQueuedRentalState() {
        const Store = window.NAAPOfflineStore;
        const identity = Store?.currentIdentity?.();
        if (!Store || !identity) return;
        const queuedRows = await Store.listOutbox(identity.accountKey, true, false).catch(() => []);
        for (const row of queuedRows) {
            if (row.type !== 'rental.return' && row.type !== 'rental.mark_paid') continue;
            const payload = row.value?.payload || {};
            const rental = rentals.find((item) => Number(item.rental_id) === Number(payload.rental_id));
            if (!rental) continue;
            rental.pending_sync = true;
            rental.offline_status = row.status === 'attention' ? 'attention' : 'queued';
            if (row.type === 'rental.return') {
                rental.status = 'returned';
                rental.actual_return_time = row.createdAt || payload.captured_at || new Date().toISOString();
            } else if (row.type === 'rental.mark_paid') {
                rental.payment_status = 'paid';
            }
        }
    }

    async function refresh() {
        const { items } = await window.igpApi.getRentals({});
        rentals = items || [];
        await applyQueuedRentalState();
        rebuildRentalOrderNumbers();
        applyFilters();
    }

    function openPaymentConfirmModal(rows) {
        pendingPaymentRentals = (rows || []).filter(isPayableRental);
        if (pendingPaymentRentals.length === 0 || !window.bootstrap) return;

        const input = $('paymentConfirmInput');
        const error = $('paymentConfirmError');
        const confirmBtn = $('paymentConfirmBtn');
        const officerInput = $('paymentOfficerBarcode');
        const officerFeedback = $('paymentOfficerBarcodeFeedback');
        const total = pendingPaymentRentals.reduce((sum, rental) => sum + Number(rental.total_cost || 0), 0);
        const summary = $('paymentConfirmSummary');

        if (summary) {
            summary.textContent = pendingPaymentRentals.length === 1
                ? `Rental #${pendingPaymentRentals[0].rental_id} for ${pendingPaymentRentals[0].renter_name || 'the student'} has a balance of P${total.toFixed(2)}.`
                : `${pendingPaymentRentals.length} rentals with a total balance of P${total.toFixed(2)} will be marked as paid.`;
        }
        if (input) input.value = '';
        if (officerInput) {
            officerInput.value = '';
            officerInput.placeholder = 'Scan officer barcode here...';
            officerInput.classList.remove('is-valid', 'is-invalid');
            delete officerInput.dataset.verifiedOfficer;
        }
        if (officerFeedback) {
            officerFeedback.textContent = 'A valid active officer for this organization must verify the payment.';
            officerFeedback.className = 'form-text';
        }
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = pendingPaymentRentals.length === 1 ? 'Mark as Paid' : 'Mark All as Paid';
        }

        const modalElement = $('paymentConfirmModal');
        window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
        modalElement.addEventListener('shown.bs.modal', () => input?.focus(), { once: true });
    }

    function verifyReturnOfficerBarcode() {
        const input = $('returnOfficerBarcode');
        const feedback = $('returnOfficerFeedback');
        const button = $('returnRentalConfirmBtn');
        if (!input) return null;
        const officer = findOfficerByScan(input.value);
        if (!officer) {
            delete input.dataset.verifiedOfficer;
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            if (feedback) {
                feedback.textContent = 'Unknown officer ID. Scan a valid officer barcode.';
                feedback.className = 'text-danger mt-1';
            }
            if (button) button.disabled = true;
            return null;
        }
        playScanBeep();
        const identifier = String(officer.student_number || officer.employee_number || officer.officerId || '').trim();
        input.dataset.verifiedOfficer = identifier;
        input.value = String(officer.officer_name || identifier).trim();
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        if (feedback) {
            feedback.textContent = `Officer verified: ${officer.officer_name || identifier}`;
            feedback.className = 'text-success mt-1';
        }
        if (button) button.disabled = false;
        return officer;
    }

    function openReturnRentalModal(rental) {
        if (!rental || !window.bootstrap) return;
        pendingReturnRental = rental;
        const input = $('returnOfficerBarcode');
        if (input) {
            input.value = '';
            input.classList.remove('is-valid', 'is-invalid');
            delete input.dataset.verifiedOfficer;
        }
        if ($('returnRentalSummary')) $('returnRentalSummary').textContent = `Return rental #${rental.rental_id} (${rental.items_label || 'item'})?`;
        if ($('returnOfficerFeedback')) {
            $('returnOfficerFeedback').textContent = 'A valid active officer for this organization must verify the return.';
            $('returnOfficerFeedback').className = 'form-text';
        }
        if ($('returnRentalError')) $('returnRentalError').style.display = 'none';
        if ($('returnRentalConfirmBtn')) $('returnRentalConfirmBtn').disabled = true;
        const modal = $('returnRentalModal');
        window.bootstrap.Modal.getOrCreateInstance(modal).show();
        modal.addEventListener('shown.bs.modal', () => input?.focus(), { once: true });
    }

    async function confirmRentalReturn() {
        if (!pendingReturnRental || !$('returnOfficerBarcode')?.dataset.verifiedOfficer) return;
        const button = $('returnRentalConfirmBtn');
        const error = $('returnRentalError');
        if (button) {
            button.disabled = true;
            button.textContent = 'Processing...';
        }
        try {
            const result = await window.igpApi.returnRental(Number(pendingReturnRental.rental_id));
            if (result.queued || !navigator.onLine) {
                await applyQueuedRentalState();
                if (!pendingReturnRental.pending_sync) {
                    pendingReturnRental.status = 'returned';
                    pendingReturnRental.actual_return_time = new Date().toISOString();
                    pendingReturnRental.pending_sync = true;
                    pendingReturnRental.offline_status = 'queued';
                }
                applyFilters();
            }
            window.bootstrap.Modal.getInstance($('returnRentalModal'))?.hide();
            if (!result.queued) await refresh();
        } catch (err) {
            if (error) {
                error.textContent = err.message || 'Could not return this rental.';
                error.style.display = 'block';
            }
            if (button) button.disabled = false;
        } finally {
            if (button) button.textContent = 'Return Item';
        }
    }

    async function confirmPendingPayments() {
        const input = $('paymentConfirmInput');
        const error = $('paymentConfirmError');
        const confirmBtn = $('paymentConfirmBtn');
        const officerInput = $('paymentOfficerBarcode');
        const officerIdentifier = String(officerInput?.dataset.verifiedOfficer || '').trim();
        if (!input || !paymentConfirmationIsReady() || !officerIdentifier) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';
        if (error) error.style.display = 'none';

        try {
            for (const rental of pendingPaymentRentals) {
                const result = await window.igpApi.markPaid(Number(rental.rental_id), officerIdentifier);
                if (result.queued) {
                    rental.payment_status = 'paid';
                    rental.pending_sync = true;
                }
            }
            const hasQueuedPayments = pendingPaymentRentals.some((rental) => rental.pending_sync);
            window.bootstrap.Modal.getInstance($('paymentConfirmModal'))?.hide();
            pendingPaymentRentals = [];
            if (hasQueuedPayments) applyFilters();
            else await refresh();
        } catch (err) {
            if (error) {
                error.textContent = err.message || 'Could not record the payment.';
                error.style.display = 'block';
            }
            updatePaymentConfirmButton();
            confirmBtn.textContent = pendingPaymentRentals.length === 1 ? 'Mark as Paid' : 'Mark All as Paid';
            await refresh();
        }
    }

    function exportExcel() {
        if (!window.XLSX) return;
        const rows = rentals.map((r) => ({
            OrderNumber: rentalOrderNumber(r),
            Items: r.items_label,
            Renter: r.renter_name,
            Section: r.renter_section || '',
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
        $('financialSummaryBtn')?.addEventListener('click', (event) => {
            try {
                if (window.parent !== window && typeof window.parent.switchTrackerSubView === 'function') {
                    event.preventDefault();
                    const parentButton = window.parent.document.getElementById('trackerFinancialBtn');
                    window.parent.switchTrackerSubView('financial-summary', parentButton);
                }
            } catch (error) {
                // The link's target="_top" fallback handles inaccessible parents.
            }
        });

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
        $('importExcel')?.addEventListener('change', () => alert('Import from Excel is disabled in DB mode.'));
        $('payAllBtn')?.addEventListener('click', () => {
            openPaymentConfirmModal(rentals.filter(isPayableRental));
        });

        $('rentalHistoryRecords')?.addEventListener('click', (e) => {
            const returnButton = e.target.closest('.js-return');
            if (returnButton) {
                const rental = rentals.find((item) => Number(item.rental_id) === Number(returnButton.dataset.id));
                if (rental) openReturnRentalModal(rental);
                return;
            }
            const btn = e.target.closest('.js-paid');
            if (!btn) return;
            const rental = rentals.find((item) => Number(item.rental_id) === Number(btn.dataset.id));
            if (rental) openPaymentConfirmModal([rental]);
        });

        $('paymentConfirmInput')?.addEventListener('input', (e) => {
            updatePaymentConfirmButton();
            if ($('paymentConfirmError')) $('paymentConfirmError').style.display = 'none';
        });

        $('returnOfficerBarcode')?.addEventListener('input', (event) => {
            delete event.target.dataset.verifiedOfficer;
            event.target.classList.remove('is-valid', 'is-invalid');
            if ($('returnRentalConfirmBtn')) $('returnRentalConfirmBtn').disabled = true;
            if (returnOfficerScanTimer) clearTimeout(returnOfficerScanTimer);
            returnOfficerScanTimer = setTimeout(() => {
                returnOfficerScanTimer = null;
                verifyReturnOfficerBarcode();
            }, 180);
        });
        $('returnOfficerBarcode')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (returnOfficerScanTimer) clearTimeout(returnOfficerScanTimer);
            returnOfficerScanTimer = null;
            verifyReturnOfficerBarcode();
        });
        $('returnRentalConfirmBtn')?.addEventListener('click', confirmRentalReturn);
        $('returnRentalModal')?.addEventListener('hidden.bs.modal', () => {
            pendingReturnRental = null;
            if (returnOfficerScanTimer) clearTimeout(returnOfficerScanTimer);
            returnOfficerScanTimer = null;
        });

        window.addEventListener('naap:offline-queue-changed', async () => {
            await refresh().catch(() => {});
        });

        $('paymentConfirmInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && paymentConfirmationIsReady()) {
                e.preventDefault();
                $('paymentConfirmBtn')?.click();
            }
        });

        $('paymentOfficerBarcode')?.addEventListener('input', (e) => {
            delete e.target.dataset.verifiedOfficer;
            e.target.classList.remove('is-valid', 'is-invalid');
            updatePaymentConfirmButton();
            if (paymentOfficerScanTimer) clearTimeout(paymentOfficerScanTimer);
            paymentOfficerScanTimer = setTimeout(() => {
                paymentOfficerScanTimer = null;
                verifyPaymentOfficerBarcode();
            }, 180);
        });

        $('paymentOfficerBarcode')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (paymentOfficerScanTimer) {
                clearTimeout(paymentOfficerScanTimer);
                paymentOfficerScanTimer = null;
            }
            verifyPaymentOfficerBarcode();
            if ($('paymentConfirmInput') && e.target.dataset.verifiedOfficer) {
                $('paymentConfirmInput').focus();
            }
        });

        $('paymentConfirmBtn')?.addEventListener('click', confirmPendingPayments);
        $('paymentConfirmModal')?.addEventListener('hidden.bs.modal', () => {
            pendingPaymentRentals = [];
            if (paymentOfficerScanTimer) {
                clearTimeout(paymentOfficerScanTimer);
                paymentOfficerScanTimer = null;
            }
            if ($('paymentConfirmInput')) $('paymentConfirmInput').value = '';
            if ($('paymentOfficerBarcode')) {
                $('paymentOfficerBarcode').value = '';
                $('paymentOfficerBarcode').classList.remove('is-valid', 'is-invalid');
                delete $('paymentOfficerBarcode').dataset.verifiedOfficer;
            }
            if ($('paymentConfirmError')) $('paymentConfirmError').style.display = 'none';
            if ($('paymentConfirmBtn')) $('paymentConfirmBtn').disabled = true;
        });

        $('rentalHistoryFilterModal')?.addEventListener('click', (e) => {
            if (e.target === $('rentalHistoryFilterModal')) {
                closeRentalHistoryFilterModal();
            }
        });
    }

    async function initRentalHistoryPage() {
        bind();
        initializeRentalColumnFilter();
        updateRentalHistoryFilterLabel();
        try {
            const [officerResult] = await Promise.all([
                window.igpApi.getOfficers(),
                refresh(),
            ]);
            officers = officerResult.items || [];
            const targetRentalId = Number(new URLSearchParams(window.location.search).get('action_center_rental_id') || 0);
            if (targetRentalId) {
                clearAllRentalHistoryFilters();
                const row = document.querySelector(`[data-rental-id="${targetRentalId}"]`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.outline = '3px solid #f59e0b';
                    row.style.outlineOffset = '-2px';
                    setTimeout(() => {
                        row.style.outline = '';
                        row.style.outlineOffset = '';
                    }, 2600);
                } else if (window.parent !== window) {
                    window.parent.postMessage({
                        type: 'OFFICER_NAVIGATION_TARGET_MISSING',
                        category: 'rental',
                        entityId: targetRentalId,
                    }, window.location.origin);
                }
            }
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
