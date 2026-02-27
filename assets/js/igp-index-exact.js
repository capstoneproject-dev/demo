(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let inventory = [];
    let activeRentals = [];

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
        const [inv, rent] = await Promise.all([
            window.igpApi.getInventory({}),
            window.igpApi.getRentals({ status: 'active' }),
        ]);
        inventory = inv.items || [];
        activeRentals = rent.items || [];
        renderAvailable();
        renderCurrent();
        populateManualItems();
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
                const hours = 1;
                await window.igpApi.rentItem({
                    item_id: itemId,
                    renter_identifier: renterId,
                    officer_identifier: officerId,
                    hours,
                });
                if (msg) msg.innerHTML = "<span class='success'>Rental recorded.</span>";
            } else {
                const active = activeRentals.find((r) => String(r.items_label || '').includes(`(${itemId})`) || String(r.items_label || '').includes(`[${itemId}]`) );
                const fallback = activeRentals.find((r) => {
                    const item = inventory.find((it) => it.item_id === itemId);
                    return item ? String(r.items_label || '').includes(`[${item.barcode}]`) : false;
                });
                const rental = active || fallback;
                if (!rental) throw new Error('No active rental found for selected item.');
                await window.igpApi.returnRental(Number(rental.rental_id));
                if (msg) msg.innerHTML = "<span class='success'>Return recorded.</span>";
            }
            await refresh();
        } catch (e) {
            if (msg) msg.innerHTML = `<span class='error'>${e.message}</span>`;
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
                    if ($('scanResult')) $('scanResult').innerHTML = "<span class='info'>DB mode: use Manual Input for now.</span>";
                }
            });
        }

        if ($('processManualTransaction')) $('processManualTransaction').addEventListener('click', doManualTransaction);
        if ($('cancelTransaction')) $('cancelTransaction').addEventListener('click', () => {
            ['studentName', 'studentId', 'studentSection', 'barcodeInputOfficer', 'barcodeInput', 'barcodeInputItemManual'].forEach((id) => {
                const el = $(id); if (el) el.value = '';
            });
            if ($('scanResult')) $('scanResult').textContent = 'Transaction reset.';
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
            setInterval(renderCurrent, 1000);
        } catch (err) {
            if ($('scanResult')) $('scanResult').innerHTML = `<span class='error'>${err.message}</span>`;
        }
    });
})();
