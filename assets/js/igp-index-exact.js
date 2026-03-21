(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let activeRentals = [];
    let students = [];
    let officers = [];
    let categories = [];
    let scanInputTimer = null;
    let officerInputTimer = null;
    let pendingRent = null;
    let pendingReturn = null;
    let pendingReservedAction = null;
    let pendingPaymentRentalId = 0;
    const scanCtx = {
        rent: { studentId: '', officerId: '' },
        return: { officerId: '' }
    };

    function fmtDate(s) {
        if (!s) return '-';
        const raw = String(s).trim();
        const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString();
    }

    function dueClock(expectedReturn) {
        if (!expectedReturn) return '-';
        const now = Date.now();
        const raw = String(expectedReturn).trim();
        const due = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime();
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
        if (rental) {
            const openStatus = String(rental.status || '').toLowerCase() === 'reserved' ? 'reserved' : 'rented';
            return { status: openStatus, renter: `${rental.renter_name} (${rental.renter_student_number || '-'})`, rentTime: rental.rent_time, due: rental.expected_return_time };
        }
        return { status: item.status, renter: '', rentTime: null, due: null };
    }

    function renderAvailable() {
        const tbody = $('availableItems');
        if (!tbody) return;
        const categoryFilter = $('itemFilter') ? $('itemFilter').value : 'all';
        tbody.innerHTML = '';
        
        let filtered = inventory.filter((it) => categoryFilter === 'all' || String(it.category_name).toLowerCase() === categoryFilter.toLowerCase());
        
        // Sort items
        if (categoryFilter === 'all') {
            // When "All" is selected: group by category, then sort by barcode within each category
            filtered = filtered.sort((a, b) => {
                const catA = String(a.category_name || '').toLowerCase();
                const catB = String(b.category_name || '').toLowerCase();
                
                // First compare by category
                if (catA !== catB) {
                    return catA.localeCompare(catB);
                }
                
                // Then compare by barcode within same category
                const barcodeA = String(a.barcode || a.item_id || '').toLowerCase();
                const barcodeB = String(b.barcode || b.item_id || '').toLowerCase();
                return barcodeA.localeCompare(barcodeB);
            });
        } else {
            // When specific category is selected: just sort by barcode
            filtered = filtered.sort((a, b) => {
                const barcodeA = String(a.barcode || a.item_id || '').toLowerCase();
                const barcodeB = String(b.barcode || b.item_id || '').toLowerCase();
                return barcodeA.localeCompare(barcodeB);
            });
        }
        
        filtered.forEach((it) => {
            const st = statusByItem(it);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${it.barcode || it.item_id}</td>
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
            // Extract barcode from items_label (format: "ItemName [BARCODE]")
            const barcodeMatch = String(r.items_label || '').match(/\[([^\]]+)\]/);
            const itemBarcode = barcodeMatch ? barcodeMatch[1] : r.rental_id;
            const itemLabelBase = String(r.items_label || '-').replace(/\s*\[[^\]]+\]\s*$/, '').trim() || '-';
            const isReserved = String(r.status || '').toLowerCase() === 'reserved';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${String(r.status || '').toLowerCase() === 'reserved'
                    ? `<div class="d-flex gap-1 flex-wrap">
                            <button class="btn btn-success btn-sm py-1 px-3 js-start" data-rid="${r.rental_id}">Start Rental</button>
                            <button class="btn btn-outline-danger btn-sm py-1 px-3 js-no-show" data-rid="${r.rental_id}">No Show</button>
                       </div>`
                    : `<button class="btn btn-warning btn-sm js-return" data-rid="${r.rental_id}">Return</button>`}</td>
                <td>${itemLabelBase} [${itemBarcode}]</td>
                <td>${r.renter_name || '-'} (${r.renter_student_number || '-'})</td>
                <td>${r.renter_section || '-'}</td>
                <td>${fmtDate(r.rent_time)}</td>
                <td>${fmtDate(r.expected_return_time)}</td>
                <td>${dueClock(r.expected_return_time)}</td>
                <td>${Number(accumulatedPrice(r)).toFixed(2)}</td>
                <td>${isReserved ? '<span class="badge bg-info text-dark">Reserved</span>' : r.status}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function populateCategoryFilter() {
        const sel = $('itemFilter');
        if (!sel) return;
        
        // Extract unique categories from inventory
        const uniqueCategories = [...new Set(inventory.map(it => it.category_name).filter(Boolean))];
        uniqueCategories.sort();
        
        // Store current selection
        const currentValue = sel.value;
        
        // Clear and rebuild options
        sel.innerHTML = '<option value="all">All</option>';
        uniqueCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            sel.appendChild(opt);
        });
        
        // Restore selection if it still exists
        if (currentValue && [...sel.options].some(opt => opt.value === currentValue)) {
            sel.value = currentValue;
        }
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
            window.igpApi.getRentals({ status: 'open' }),
            window.igpApi.getStudents(),
            window.igpApi.getOfficers(),
        ]);
        inventory = inv.items || [];
        activeRentals = rent.items || [];
        students = stu.items || [];
        officers = off.items || [];
        populateCategoryFilter();
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

    function accumulatedPrice(rental) {
        if (!rental) return 0;
        if (String(rental.status || '').toLowerCase() !== 'active') {
            return Number(rental.total_cost || 0);
        }
        const hourly = Number(rental.hourly_total || 0);
        const raw = String(rental.rent_time || '').trim();
        const start = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime();
        if (Number.isNaN(start) || hourly <= 0) {
            return Number(rental.total_cost || 0);
        }
        const elapsedMs = Math.max(0, Date.now() - start);
        const elapsedHours = Math.max(1, Math.ceil(elapsedMs / 3600000));
        return hourly * elapsedHours;
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
        const renterEl = $('confirmReturnRenter');
        
        if (text) text.textContent = `Are you sure you want to return ${item.item_name} (${item.barcode})?`;
        
        if (renterEl) {
            const renterName = rental.renter_name || 'Unknown';
            const renterNumber = rental.renter_student_number || '-';
            renterEl.innerHTML = `Renter: <strong>${renterName} (${renterNumber})</strong>`;
        }
        
        const modal = getModalInstance('confirmReturnModal');
        if (modal) modal.show();
    }

    function openReservedActionModal(rental, actionType) {
        pendingReservedAction = { rental, actionType };
        const title = $('reservedActionModalLabel');
        const text = $('reservedActionText');
        const hint = $('reservedActionHint');
        const confirmBtn = $('confirmReservedActionBtn');
        const itemLabel = String(rental.items_label || '-');

        if (actionType === 'start') {
            if (title) title.textContent = 'Start Reserved Rental';
            if (text) text.textContent = `Start rental #${rental.rental_id} for ${itemLabel}?`;
            if (hint) hint.textContent = 'This will convert the reservation to an active rental and start the rental time now.';
            if (confirmBtn) {
                confirmBtn.textContent = 'Start Rental';
                confirmBtn.className = 'btn btn-success';
            }
        } else {
            if (title) title.textContent = 'Mark Reservation as No Show';
            if (text) text.textContent = `Mark rental #${rental.rental_id} for ${itemLabel} as no-show?`;
            if (hint) hint.textContent = 'This will release the item, keep the balance unpaid, and block the student until payment is settled.';
            if (confirmBtn) {
                confirmBtn.textContent = 'Mark No Show';
                confirmBtn.className = 'btn btn-danger';
            }
        }

        const modal = getModalInstance('reservedActionModal');
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
        if (modal) modal.hide();
        
        // Show officer verification modal
        openOfficerVerificationModal();
    }

    function openOfficerVerificationModal() {
        if (!pendingReturn) return;
        const text = $('officerVerificationText');
        if (text) text.textContent = `Please scan officer barcode to confirm return of ${pendingReturn.item.item_name} [${pendingReturn.item.barcode}].`;
        const input = $('officerVerificationInput');
        if (input) {
            input.value = '';
        }
        const msg = $('officerVerificationMessage');
        if (msg) msg.textContent = '';
        
        const modalEl = $('officerVerificationModal');
        if (modalEl) {
            // Auto-focus input when modal is shown
            modalEl.addEventListener('shown.bs.modal', function focusInput() {
                if (input) input.focus();
                modalEl.removeEventListener('shown.bs.modal', focusInput);
            });
            
            // Clear timer when modal is hidden
            modalEl.addEventListener('hidden.bs.modal', function clearTimer() {
                if (officerInputTimer) {
                    clearTimeout(officerInputTimer);
                    officerInputTimer = null;
                }
                modalEl.removeEventListener('hidden.bs.modal', clearTimer);
            });
        }
        
        const modal = getModalInstance('officerVerificationModal');
        if (modal) modal.show();
    }

    async function verifyOfficerAndProcessReturn() {
        if (!pendingReturn) return;
        
        // Clear any pending timer
        if (officerInputTimer) {
            clearTimeout(officerInputTimer);
            officerInputTimer = null;
        }
        
        const input = $('officerVerificationInput');
        const msg = $('officerVerificationMessage');
        if (!input || !msg) return;

        const scannedValue = input.value.trim();
        if (!scannedValue) {
            msg.textContent = '✗ Please scan officer barcode';
            return;
        }

        const officer = findOfficerByScan(scannedValue);
        if (!officer) {
            msg.textContent = `✗ Invalid officer barcode: ${scannedValue}`;
            input.select();
            return;
        }

        // Officer verified, process return
        const modal = getModalInstance('officerVerificationModal');
        try {
            const res = await window.igpApi.returnRental(Number(pendingReturn.rental.rental_id));
            if (modal) modal.hide();
            await refresh();
            setScanResult(`Return recorded for ${pendingReturn.item.item_name} [${pendingReturn.item.barcode}]. Officer: ${officer.officer_name || officer.student_number}`, 'success');
            resetScanContext();
            openPaymentModal(res, res.rental_id || pendingReturn.rental.rental_id);
            pendingReturn = null;
        } catch (err) {
            if (modal) modal.hide();
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

    async function confirmReservedActionFromModal() {
        if (!pendingReservedAction) return;
        const { rental, actionType } = pendingReservedAction;
        const rid = Number(rental && rental.rental_id);
        if (!rid) return;

        const modal = getModalInstance('reservedActionModal');
        try {
            if (actionType === 'start') {
                await window.igpApi.startRental(rid);
                setScanResult(`Rental #${rid} started successfully.`, 'success');
            } else {
                await window.igpApi.markNoShow(rid);
                setScanResult(`Reservation #${rid} marked as no-show. Student balance remains unpaid.`, 'success');
            }
            if (modal) modal.hide();
            await refresh();
            pendingReservedAction = null;
        } catch (err) {
            if (modal) modal.hide();
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
        if ($('verifyOfficerBtn')) $('verifyOfficerBtn').addEventListener('click', verifyOfficerAndProcessReturn);
        if ($('markReturnPaidBtn')) $('markReturnPaidBtn').addEventListener('click', markReturnPaidFromModal);
        if ($('confirmReservedActionBtn')) $('confirmReservedActionBtn').addEventListener('click', confirmReservedActionFromModal);
        
        // Officer verification input - process on Enter key and auto-process after scan
        if ($('officerVerificationInput')) {
            $('officerVerificationInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (officerInputTimer) {
                        clearTimeout(officerInputTimer);
                        officerInputTimer = null;
                    }
                    verifyOfficerAndProcessReturn();
                }
            });
            $('officerVerificationInput').addEventListener('input', () => {
                if (officerInputTimer) clearTimeout(officerInputTimer);
                // Auto-process scanner input when typing pauses briefly
                officerInputTimer = setTimeout(() => {
                    verifyOfficerAndProcessReturn();
                }, 180);
            });
        }
        if ($('cancelTransaction')) $('cancelTransaction').addEventListener('click', () => {
            ['studentName', 'studentId', 'studentSection', 'barcodeInputOfficer', 'barcodeInput', 'barcodeInputItemManual'].forEach((id) => {
                const el = $(id); if (el) el.value = '';
            });
            resetScanContext();
            setScanResult('Transaction reset.', 'info');
        });

        if ($('rentalRecords')) {
            $('rentalRecords').addEventListener('click', async (e) => {
                const startBtn = e.target.closest('.js-start');
                if (startBtn) {
                    const rid = Number(startBtn.dataset.rid);
                    if (!rid) return;
                    const rental = activeRentals.find((r) => Number(r.rental_id) === rid);
                    if (!rental) {
                        setScanResult('Rental not found.', 'error');
                        return;
                    }
                    openReservedActionModal(rental, 'start');
                    return;
                }

                const noShowBtn = e.target.closest('.js-no-show');
                if (noShowBtn) {
                    const rid = Number(noShowBtn.dataset.rid);
                    if (!rid) return;
                    const rental = activeRentals.find((r) => Number(r.rental_id) === rid);
                    if (!rental) {
                        setScanResult('Rental not found.', 'error');
                        return;
                    }
                    openReservedActionModal(rental, 'no-show');
                    return;
                }

                const btn = e.target.closest('.js-return');
                if (!btn) return;
                const rid = Number(btn.dataset.rid);
                if (!rid) return;
                
                // Find the rental and item
                const rental = activeRentals.find((r) => Number(r.rental_id) === rid);
                if (!rental) {
                    setScanResult('Rental not found.', 'error');
                    return;
                }
                
                // Extract item barcode from items_label
                const barcodeMatch = String(rental.items_label || '').match(/\[([^\]]+)\]/);
                const barcode = barcodeMatch ? barcodeMatch[1] : null;
                const item = barcode ? inventory.find((it) => it.barcode === barcode) : null;
                
                if (!item) {
                    setScanResult('Item not found.', 'error');
                    return;
                }
                
                // Open confirmation modal
                openConfirmReturnModal(rental, item);
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
