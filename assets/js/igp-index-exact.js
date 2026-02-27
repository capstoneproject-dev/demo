(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let activeRentals = [];
    let students = [];
    let officers = [];
    let scanInputTimer = null;
    let pendingRent = null;
    let pendingReturn = null;
    let pendingPaymentRentalId = 0;
    const scanCtx = {
        rent: { studentId: '', officerId: '' },
        return: { officerId: '' }
    };

    function fmtDate(s) {
        if (!s) return '-';
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function dueClock(expectedReturn) {
        if (!expectedReturn) return '-';
        const now = Date.now();
        const due = new Date(expectedReturn).getTime();
        if (Number.isNaN(due)) return '-';
        let diff = due - now;
        const neg = diff < 0;
        if (neg) diff *= -1;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        return (neg ? '-' : '') + `${h}:${m}:${s}`;
    }

    function statusByItem(item) {
        const rental = activeRentals.find((r) => String(r.items_label || '').includes(`[${item.barcode}]`));
        if (rental) return { status: 'rented', renter: `${rental.renter_name} (${rental.renter_student_number || '-'})`, rentTime: rental.rent_time, due: rental.expected_return_time };
        return { status: item.available_quantity > 0 ? 'available' : item.status, renter: '', rentTime: null, due: null };
    }

    function renderAvailable() {
        const tbody = $('availableItems');
        if (!tbody) return;
        const nameFilter = $('itemFilter') ? $('itemFilter').value : 'all';
        tbody.innerHTML = '';
        inventory
            .filter((it) => nameFilter === 'all' || String(it.item_name).toLowerCase().includes(nameFilter.toLowerCase()))
            .forEach((it) => {
                const st = statusByItem(it);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${it.item_id}</td>
                    <td>${it.item_name}</td>
                    <td>${st.status}</td>
                    <td>${st.renter || '-'}</td>
                    <td>${fmtDate(st.rentTime)}</td>
                    <td>${fmtDate(st.due)}</td>
                `;
                tbody.appendChild(tr);
            });
    }

    function renderCurrent() {
        const tbody = $('rentalRecords');
        if (!tbody) return;
        tbody.innerHTML = '';
        activeRentals.forEach((r) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><button class="btn btn-warning btn-sm js-return" data-rid="${r.rental_id}">Return</button></td>
                <td>${r.rental_id}</td>
                <td>${r.items_label || '-'}</td>
                <td>${r.renter_name || '-'} (${r.renter_student_number || '-'})</td>
                <td>-</td>
                <td>${fmtDate(r.rent_time)}</td>
                <td>${fmtDate(r.expected_return_time)}</td>
                <td>${dueClock(r.expected_return_time)}</td>
                <td>${Number(r.total_cost || 0).toFixed(2)}</td>
                <td>${r.status}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function populateManualItems() {
        const sel = $('itemSelect');
        if (!sel) return;
        const mode = $('returnMode') && $('returnMode').checked ? 'return' : 'rent';
        sel.innerHTML = '<option value="">Choose an item...</option>';
        inventory.forEach((it) => {
            const st = statusByItem(it);
            if (mode === 'rent' && st.status !== 'available') return;
            if (mode === 'return' && st.status !== 'rented') return;
            const opt = document.createElement('option');
            opt.value = String(it.item_id);
            opt.textContent = `${it.item_name} (${it.item_id}) [${it.barcode}]`;
            sel.appendChild(opt);
        });
    }

    async function refresh() {
        const [inv, rent, stu, off] = await Promise.all([
            window.igpApi.getInventory({}),
            window.igpApi.getRentals({ status: 'active' }),
            window.igpApi.getStudents(),
            window.igpApi.getOfficers(),
        ]);
        inventory = inv.items || [];
        activeRentals = rent.items || [];
        students = stu.items || [];
        officers = off.items || [];
        renderAvailable();
        renderCurrent();
        populateManualItems();
    }

    function setScanResult(message, kind = 'info') {
        const el = $('scanResult');
        if (!el) return;
        const cls = kind === 'error' ? 'error' : (kind === 'success' ? 'success' : 'info');
        el.innerHTML = `<span class="${cls}">${message}</span>`;
    }

    function resetScanContext() {
        scanCtx.rent.studentId = '';
        scanCtx.rent.officerId = '';
        scanCtx.return.officerId = '';
        const input = $('barcodeInput');
        if (input) input.value = '';
    }

    function currentMode() {
        return $('returnMode') && $('returnMode').checked ? 'return' : 'rent';
    }

    function findStudentByScan(value) {
        const v = String(value || '').trim().toLowerCase();
        return students.find((s) => {
            const studentId = String(s.studentId || '');
            return studentId.toLowerCase() === v || encodeRef(studentId, 'S').toLowerCase() === v;
        }) || null;
    }

    function findOfficerByScan(value) {
        const v = String(value || '').trim().toLowerCase();
        return officers.find((o) => {
            // Officers payload comes from organization_members-scoped API rows.
            const idCandidates = [
                String(o.student_number || ''),
                String(o.employee_number || ''),
                String(o.officerId || ''),
            ].filter(Boolean);

            return idCandidates.some((id) =>
                id.toLowerCase() === v ||
                encodeRef(id, 'O').toLowerCase() === v ||
                // Some generated officer cards used student-style encoder prefix.
                encodeRef(id, 'S').toLowerCase() === v
            );
        }) || null;
    }

    function findItemByBarcode(value) {
        const v = String(value || '').trim().toLowerCase();
        return inventory.find((it) => String(it.barcode || '').toLowerCase() === v) || null;
    }

    function peso(v) {
        return `PHP ${Number(v || 0).toFixed(2)}`;
    }

    function getModalInstance(id) {
        const el = $(id);
        if (!el || !window.bootstrap) return null;
        return window.bootstrap.Modal.getOrCreateInstance(el);
    }

    function openRentHoursModal(item, renterIdentifier, officerIdentifier) {
        pendingRent = { item, renterIdentifier, officerIdentifier };
        const itemText = $('rentalHoursItemText');
        const rateText = $('rentalHoursRateText');
        const hoursInput = $('rentalHoursInput');
        const details = $('rentalHoursDetails');
        const confirmBtn = $('confirmRentalHoursBtn');
        const renderPreview = () => {
            const hours = Math.max(1, Number((hoursInput && hoursInput.value) || 1));
            const baseCost = (Number(item.hourly_rate) || 0) * hours;
            if (details) {
                details.classList.remove('d-none');
                details.innerHTML =
                    `Item: <strong>${item.item_name}</strong> [${item.barcode}]<br>` +
                    `Renter: <strong>${renterIdentifier}</strong><br>` +
                    `Officer: <strong>${officerIdentifier || '-'}</strong><br>` +
                    `Hours: <strong>${hours}</strong><br>` +
                    `Estimated Base Cost: <strong>${peso(baseCost)}</strong>`;
            }
            if (rateText) rateText.textContent = `Rate: ${peso(item.hourly_rate)} per hour`;
        };
        if (itemText) itemText.textContent = `Item: ${item.item_name} [${item.barcode}]`;
        if (hoursInput) hoursInput.value = '1';
        if (details) {
            details.classList.remove('d-none');
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Rental';
        }
        if (hoursInput) {
            hoursInput.oninput = renderPreview;
        }
        renderPreview();
        const modal = getModalInstance('rentalHoursModal');
        if (modal) modal.show();
    }

    function openConfirmReturnModal(rental, item) {
        pendingReturn = { rental, item };
        const text = $('confirmReturnText');
        if (text) text.textContent = `Are you sure you want to return ${item.item_name} [${item.barcode}]?`;
        const modal = getModalInstance('confirmReturnModal');
        if (modal) modal.show();
    }

    function openPaymentModal(summary, rentalId) {
        pendingPaymentRentalId = Number(rentalId || 0);
        if ($('paymentBaseCost')) $('paymentBaseCost').textContent = peso(summary.base_cost);
        if ($('paymentOvertimeCost')) $('paymentOvertimeCost').textContent = peso(summary.overtime_cost);
        if ($('paymentTotalCost')) $('paymentTotalCost').textContent = peso(summary.total_cost);
        const modal = getModalInstance('returnPaymentModal');
        if (modal) modal.show();
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

    async function processScanToken(rawToken) {
        const token = String(rawToken || '').trim();
        if (!token) return;

        const mode = currentMode();
        if (mode === 'rent') {
            if (!scanCtx.rent.studentId) {
                const student = findStudentByScan(token);
                if (!student) {
                    setScanResult('Unknown student ID. Scan a registered student barcode first.', 'error');
                    return;
                }
                scanCtx.rent.studentId = student.studentId;
                setScanResult(`Student verified: ${student.studentName || student.studentId}. Next: scan officer ID.`, 'info');
                return;
            }

            if (!scanCtx.rent.officerId) {
                const officer = findOfficerByScan(token);
                if (!officer) {
                    setScanResult('Unknown officer ID. Scan a valid officer barcode.', 'error');
                    return;
                }
                scanCtx.rent.officerId = officer.student_number || officer.employee_number || '';
                setScanResult(`Officer verified: ${officer.officer_name || scanCtx.rent.officerId}. Next: scan item barcode.`, 'info');
                return;
            }

            const item = findItemByBarcode(token);
            if (!item) {
                setScanResult('Unknown item barcode.', 'error');
                return;
            }
            const st = statusByItem(item);
            if (st.status !== 'available') {
                setScanResult(`Item is not available (${st.status}).`, 'error');
                return;
            }

            openRentHoursModal(item, scanCtx.rent.studentId, scanCtx.rent.officerId);
            return;
        }

        // return mode
        if (!scanCtx.return.officerId) {
            const officer = findOfficerByScan(token);
            if (!officer) {
                setScanResult('Unknown officer ID. Scan a valid officer barcode first.', 'error');
                return;
            }
            scanCtx.return.officerId = officer.student_number || officer.employee_number || '';
            setScanResult(`Officer verified: ${officer.officer_name || scanCtx.return.officerId}. Next: scan item barcode to return.`, 'info');
            return;
        }

        const item = findItemByBarcode(token);
        if (!item) {
            setScanResult('Unknown item barcode.', 'error');
            return;
        }

        const rental = activeRentals.find((r) => String(r.items_label || '').includes(`[${item.barcode}]`));
        if (!rental) {
            setScanResult('No active rental found for this item.', 'error');
            return;
        }

        openConfirmReturnModal(rental, item);
    }

    async function processBarcodeInputField() {
        const input = $('barcodeInput');
        if (!input) return;
        const token = String(input.value || '').trim();
        if (!token) return;
        input.value = '';
        try {
            await processScanToken(token);
        } catch (err) {
            setScanResult(err.message, 'error');
        }
    }

    function ensureManualButton() {
        if ($('processManualTransaction')) return;
        const btn = document.createElement('button');
        btn.id = 'processManualTransaction';
        btn.type = 'button';
        btn.className = 'btn btn-primary btn-sm mt-2 ms-2';
        btn.textContent = 'Process Manual Transaction';
        const cancel = $('cancelTransaction');
        if (cancel && cancel.parentNode) cancel.parentNode.insertBefore(btn, cancel.nextSibling);
    }

    async function doManualTransaction() {
        const mode = $('returnMode') && $('returnMode').checked ? 'return' : 'rent';
        const itemId = Number(($('itemSelect') || {}).value || 0);
        const msg = $('scanResult');
        if (!itemId) {
            if (msg) msg.innerHTML = "<span class='error'>Select an item first.</span>";
            return;
        }

        try {
            if (mode === 'rent') {
                const renterId = (($('studentId') || {}).value || '').trim();
                const officerId = (($('barcodeInputOfficer') || {}).value || '').trim();
                if (!renterId) throw new Error('Student ID is required.');
                const item = inventory.find((it) => Number(it.item_id) === itemId);
                if (!item) throw new Error('Item not found.');
                openRentHoursModal(item, renterId, officerId);
                if (msg) msg.innerHTML = "<span class='info'>Set rental duration, then confirm.</span>";
            } else {
                const active = activeRentals.find((r) => String(r.items_label || '').includes(`(${itemId})`) || String(r.items_label || '').includes(`[${itemId}]`) );
                const fallback = activeRentals.find((r) => {
                    const item = inventory.find((it) => it.item_id === itemId);
                    return item ? String(r.items_label || '').includes(`[${item.barcode}]`) : false;
                });
                const rental = active || fallback;
                if (!rental) throw new Error('No active rental found for selected item.');
                const item = inventory.find((it) => Number(it.item_id) === itemId);
                if (!item) throw new Error('Item not found.');
                openConfirmReturnModal(rental, item);
                if (msg) msg.innerHTML = "<span class='info'>Confirm return in modal.</span>";
            }
        } catch (e) {
            if (msg) msg.innerHTML = `<span class='error'>${e.message}</span>`;
        }
    }

    async function confirmRentalFromModal() {
        if (!pendingRent) return;
        const hours = Number((($('rentalHoursInput') || {}).value || 1));
        if (!Number.isFinite(hours) || hours < 1) {
            setScanResult('Rental hours must be at least 1.', 'error');
            return;
        }
        const modal = getModalInstance('rentalHoursModal');
        try {
            await window.igpApi.rentItem({
                item_id: Number(pendingRent.item.item_id),
                renter_identifier: pendingRent.renterIdentifier,
                officer_identifier: pendingRent.officerIdentifier,
                hours,
            });
            if (modal) modal.hide();
            await refresh();
            setScanResult(`Rental recorded for ${pendingRent.item.item_name} [${pendingRent.item.barcode}] for ${hours} hour(s).`, 'success');
            resetScanContext();
            pendingRent = null;
        } catch (err) {
            setScanResult(err.message, 'error');
        }
    }

    async function confirmReturnFromModal() {
        if (!pendingReturn) return;
        const modal = getModalInstance('confirmReturnModal');
        try {
            const res = await window.igpApi.returnRental(Number(pendingReturn.rental.rental_id));
            if (modal) modal.hide();
            await refresh();
            setScanResult(`Return recorded for ${pendingReturn.item.item_name} [${pendingReturn.item.barcode}].`, 'success');
            resetScanContext();
            openPaymentModal(res, res.rental_id || pendingReturn.rental.rental_id);
            pendingReturn = null;
        } catch (err) {
            setScanResult(err.message, 'error');
        }
    }

    async function markReturnPaidFromModal() {
        if (!pendingPaymentRentalId) return;
        try {
            await window.igpApi.markPaid(pendingPaymentRentalId, 'cash');
            const modal = getModalInstance('returnPaymentModal');
            if (modal) modal.hide();
            await refresh();
            setScanResult('Payment marked as paid.', 'success');
            pendingPaymentRentalId = 0;
        } catch (err) {
            setScanResult(err.message, 'error');
        }
    }

    function bindEvents() {
        if ($('itemFilter')) $('itemFilter').addEventListener('change', renderAvailable);
        if ($('rentMode')) $('rentMode').addEventListener('change', populateManualItems);
        if ($('returnMode')) $('returnMode').addEventListener('change', populateManualItems);

        const manual = $('manualMode');
        const scan = $('scanMode');
        const barcodeSection = $('barcodeInputSection');
        const manualSection = $('manualInputSection');
        if (manual && scan && barcodeSection && manualSection) {
            manual.addEventListener('change', () => {
                if (manual.checked) {
                    barcodeSection.style.display = 'none';
                    manualSection.style.display = 'block';
                }
            });
            scan.addEventListener('change', () => {
                if (scan.checked) {
                    barcodeSection.style.display = 'block';
                    manualSection.style.display = 'none';
                    setScanResult('Scan mode ready.', 'info');
                    if ($('barcodeInput')) $('barcodeInput').focus();
                }
            });
        }

        if ($('rentMode')) {
            $('rentMode').addEventListener('change', () => {
                resetScanContext();
                setScanResult('Rent mode: scan student ID, then officer ID, then item barcode.', 'info');
            });
        }
        if ($('returnMode')) {
            $('returnMode').addEventListener('change', () => {
                resetScanContext();
                setScanResult('Return mode: scan officer ID, then item barcode.', 'info');
            });
        }

        if ($('barcodeInput')) {
            $('barcodeInput').addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (scanInputTimer) {
                    clearTimeout(scanInputTimer);
                    scanInputTimer = null;
                }
                await processBarcodeInputField();
            });
            $('barcodeInput').addEventListener('input', () => {
                if (scanInputTimer) clearTimeout(scanInputTimer);
                // Auto-process scanner input when typing pauses briefly.
                scanInputTimer = setTimeout(() => {
                    processBarcodeInputField();
                }, 180);
            });
        }

        if ($('processManualTransaction')) $('processManualTransaction').addEventListener('click', doManualTransaction);
        if ($('confirmRentalHoursBtn')) $('confirmRentalHoursBtn').addEventListener('click', confirmRentalFromModal);
        if ($('confirmReturnBtn')) $('confirmReturnBtn').addEventListener('click', confirmReturnFromModal);
        if ($('markReturnPaidBtn')) $('markReturnPaidBtn').addEventListener('click', markReturnPaidFromModal);
        if ($('cancelTransaction')) $('cancelTransaction').addEventListener('click', () => {
            ['studentName', 'studentId', 'studentSection', 'barcodeInputOfficer', 'barcodeInput', 'barcodeInputItemManual'].forEach((id) => {
                const el = $(id); if (el) el.value = '';
            });
            resetScanContext();
            setScanResult('Transaction reset.', 'info');
        });

        if ($('rentalRecords')) {
            $('rentalRecords').addEventListener('click', async (e) => {
                const btn = e.target.closest('.js-return');
                if (!btn) return;
                const rid = Number(btn.dataset.rid);
                if (!rid) return;
                try {
                    await window.igpApi.returnRental(rid);
                    await refresh();
                } catch (err) {
                    if ($('scanResult')) $('scanResult').innerHTML = `<span class='error'>${err.message}</span>`;
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        ensureManualButton();
        bindEvents();
        try {
            await refresh();
            setScanResult('Scan mode ready.', 'info');
            setInterval(renderCurrent, 1000);
        } catch (err) {
            setScanResult(err.message, 'error');
        }
    });
})();
