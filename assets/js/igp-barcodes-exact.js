(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const ADD_NEW_TYPE_VALUE = '__add_new__';
    const ADD_NEW_ITEM_NAME_VALUE = '__add_new__';
    let inventory = [];
    let sharedCategories = [];
    let sharedItemNames = [];
    let lastSelectedItemName = '';
    let deletingId = 0;

    function isLockerCategory(categoryName) {
        return String(categoryName || '').trim().toLowerCase() === 'locker';
    }

    function fmtRate(v) {
        const n = Number(v || 0);
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }

    function resolveImagePath(path) {
        const raw = String(path || '').trim();
        if (!raw) return '';
        if (/^(https?:)?\/\//i.test(raw)) return raw;
        return `../../${raw.replace(/^\/+/, '')}`;
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function group(items) {
        const out = {};
        items.forEach((it) => {
            const key = String(it.category_name || '').trim() || 'Uncategorized';
            if (!out[key]) out[key] = [];
            out[key].push(it);
        });
        return out;
    }

    function getAvailableTypes() {
        return [...new Set([
            ...sharedCategories
                .map((category) => String(category.category_name || '').trim())
                .filter((category) => !isLockerCategory(category)),
            ...inventory
                .map((it) => String(it.category_name || '').trim())
                .filter((category) => !isLockerCategory(category)),
        ].filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
    }

    function populateTypeMenu(selectedType = '') {
        const select = $('itemType');
        if (!select) return;
        const types = getAvailableTypes();
        const selected = String(selectedType || '').trim();
        const hasSelected = selected !== '' && types.includes(selected);
        if (selected !== '' && !hasSelected) {
            types.unshift(selected);
        }
        select.innerHTML = `
            <option value="">Item Type</option>
            ${types.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}
            <option value="${ADD_NEW_TYPE_VALUE}">+ Add new type...</option>
        `;
        select.value = selected || '';
        toggleCustomTypeInput(select.value === ADD_NEW_TYPE_VALUE);
    }

    function toggleCustomTypeInput(show) {
        const select = $('itemType');
        const input = $('itemTypeCustom');
        if (!select || !input) return;
        select.classList.toggle('d-none', show);
        input.classList.toggle('d-none', !show);
        if (show) {
            input.focus();
        } else {
            input.value = '';
        }
    }

    function getSelectedType() {
        const selectValue = String((($('itemType') || {}).value || '')).trim();
        if (selectValue === ADD_NEW_TYPE_VALUE) {
            return String((($('itemTypeCustom') || {}).value || '')).trim();
        }
        return selectValue;
    }

    function getAvailableItemNames(categoryName = '') {
        const category = String(categoryName || '').trim().toLowerCase();
        const seen = new Map();
        [...sharedItemNames, ...inventory].forEach((item) => {
            const name = String(item.item_name || '').trim();
            const itemCategory = String(item.category_name || '').trim().toLowerCase();
            if (!name) return;
            if (itemCategory === 'locker') return;
            if (category && itemCategory && itemCategory !== category) return;
            const key = name.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, name);
            }
        });
        return [...seen.values()].sort((a, b) => a.localeCompare(b));
    }

    function findMatchingItemRecord(itemName, categoryName = '') {
        const targetName = String(itemName || '').trim().toLowerCase();
        const targetCategory = String(categoryName || '').trim().toLowerCase();
        if (!targetName) return null;

        return [...inventory, ...sharedItemNames].find((item) => {
            const name = String(item.item_name || '').trim().toLowerCase();
            const category = String(item.category_name || '').trim().toLowerCase();
            if (name !== targetName) return false;
            if (targetCategory && category && category !== targetCategory) return false;
            return true;
        }) || null;
    }

    function populateItemNameMenu(selectedName = '') {
        const select = $('itemName');
        if (!select) return;
        const selectedType = getSelectedType();
        const names = getAvailableItemNames(selectedType);
        const selected = String(selectedName || '').trim();
        if (selected && !names.some((name) => name.toLowerCase() === selected.toLowerCase())) {
            names.unshift(selected);
        }
        select.innerHTML = `
            <option value="">Item Name</option>
            ${names.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
            <option value="${ADD_NEW_ITEM_NAME_VALUE}">+ Add new item name...</option>
        `;
        select.value = selected || '';
        lastSelectedItemName = selected || '';
        toggleCustomItemNameInput(select.value === ADD_NEW_ITEM_NAME_VALUE);
    }

    function toggleCustomItemNameInput(show) {
        const select = $('itemName');
        const input = $('itemNameCustom');
        if (!select || !input) return;
        select.classList.toggle('d-none', show);
        input.classList.toggle('d-none', !show);
        select.required = !show;
        input.required = show;
        if (show) {
            input.focus();
        } else {
            input.value = '';
        }
    }

    function getSelectedItemName() {
        const selectValue = String((($('itemName') || {}).value || '')).trim();
        if (selectValue === ADD_NEW_ITEM_NAME_VALUE) {
            return String((($('itemNameCustom') || {}).value || '')).trim();
        }
        return selectValue;
    }

    function syncItemImageFromSelection() {
        const imageInput = $('itemImage');
        const selectedImage = $('itemImage') && $('itemImage').files ? $('itemImage').files[0] : null;
        if (selectedImage) {
            if (imageInput) imageInput.required = false;
            return;
        }

        const selectedName = getSelectedItemName();
        const selectedType = getSelectedType();
        const match = findMatchingItemRecord(selectedName, selectedType);
        const hasReusableImage = !!(match && match.image_path);
        updateImagePreview(resolveImagePath(hasReusableImage ? match.image_path : ''));
        if (imageInput) imageInput.required = !hasReusableImage;
    }

    function updateImagePreview(src) {
        const preview = $('itemImagePreview');
        const placeholder = $('itemImagePlaceholder');
        if (!preview) return;
        if (src) {
            preview.src = src;
            preview.classList.add('is-visible');
            if (placeholder) placeholder.classList.add('hidden');
            return;
        }
        preview.removeAttribute('src');
        preview.classList.remove('is-visible');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    function setEditMode(editing) {
        const submitBtn = $('saveItemButton');
        const cancelBtn = $('cancelEditButton');
        if (submitBtn) {
            submitBtn.textContent = editing ? 'Save' : 'Add Item';
        }
        if (cancelBtn) {
            cancelBtn.classList.toggle('d-none', !editing);
        }
    }

    function resetItemForm() {
        const form = $('addItemForm');
        if (form) {
            form.reset();
            delete form.dataset.editId;
        }
        populateTypeMenu();
        populateItemNameMenu();
        setEditMode(false);
        if ($('itemImage')) $('itemImage').required = true;
        updateImagePreview('');
    }

    function render() {
        const q = (($('searchInput') || {}).value || '').toLowerCase();
        const filtered = !q ? inventory : inventory.filter((it) =>
            String(it.item_name || '').toLowerCase().includes(q) ||
            String(it.barcode || '').toLowerCase().includes(q) ||
            String(it.item_id || '').toLowerCase().includes(q)
        );
        const display = $('barcodeDisplay');
        if (!display) return;
        display.innerHTML = '';

        const grouped = group(filtered);
        Object.keys(grouped).sort().forEach((cat) => {
            const h = document.createElement('h3');
            h.className = 'category-title';
            h.textContent = cat;
            display.appendChild(h);

            grouped[cat].sort((a, b) => a.item_id - b.item_id).forEach((it) => {
                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                      <div class="d-flex gap-3 align-items-start">
                        ${it.image_path ? `<img src="${resolveImagePath(it.image_path)}" alt="${esc(it.item_name)}" class="inventory-thumb">` : ''}
                        <div>
                            <strong>${it.item_name}</strong><br>
                            <small>ID: ${it.item_id} | Barcode: ${it.barcode}</small><br>
                            <small>Rate: ₱${fmtRate(it.hourly_rate)}/hr</small>
                        </div>
                      </div>
                      <div>
                        <button class="btn btn-sm btn-outline-primary js-edit" data-id="${it.item_id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger js-delete" data-id="${it.item_id}" data-bs-toggle="modal" data-bs-target="#deleteItemModal">Delete</button>
                      </div>
                    </div>
                    <div class="barcode-container mt-2"><svg id="bc_${it.item_id}"></svg></div>
                `;
                display.appendChild(card);
                if (window.JsBarcode) {
                    window.JsBarcode(`#bc_${it.item_id}`, it.barcode, { width: 2, height: 50, displayValue: true });
                }
            });
        });
    }

    function sanitizeDownloadName(value) {
        return String(value || '')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') || 'barcode';
    }

    function normalizeHeader(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ');
    }

    function findHeaderIndex(headers, names) {
        return headers.findIndex((header) => names.includes(header));
    }

    function readCell(row, index) {
        if (index < 0) return '';
        return row[index];
    }

    function parseOptionalNumber(value) {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function findInventoryByBarcode(barcode) {
        const key = String(barcode || '').trim().toLowerCase();
        if (!key) return null;
        return inventory.find((item) => String(item.barcode || '').trim().toLowerCase() === key) || null;
    }

    async function importInventoryWorkbook(file) {
        if (!window.XLSX) {
            throw new Error('Excel import is not available right now.');
        }

        const buffer = await file.arrayBuffer();
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
            throw new Error('The selected Excel file has no sheets to import.');
        }

        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rows.length) {
            throw new Error('The selected Excel file is empty.');
        }

        const headers = rows[0].map(normalizeHeader);
        const nameIndex = findHeaderIndex(headers, ['name', 'item name', 'itemname']);
        const barcodeIndex = findHeaderIndex(headers, ['barcode', 'barcode id']);
        const categoryIndex = findHeaderIndex(headers, ['category', 'category name', 'item type', 'type']);
        const statusIndex = findHeaderIndex(headers, ['status']);
        const rateIndex = findHeaderIndex(headers, ['price per hour', 'price/hour', 'hourly rate', 'price']);
        const overtimeIntervalIndex = findHeaderIndex(headers, ['overtime interval (mins)', 'overtime interval', 'overtime every (mins)']);
        const overtimeRateIndex = findHeaderIndex(headers, ['overtime rate (php)', 'overtime rate', 'overtime price']);

        if (nameIndex === -1 || barcodeIndex === -1) {
            throw new Error('Excel file must include Name and Barcode columns.');
        }

        const payloads = [];
        for (let i = 1; i < rows.length; i += 1) {
            const row = rows[i];
            if (!Array.isArray(row) || row.every((cell) => String(cell || '').trim() === '')) continue;

            const itemName = String(readCell(row, nameIndex) || '').trim();
            const barcode = String(readCell(row, barcodeIndex) || '').trim();
            if (!itemName || !barcode) continue;

            const existing = findInventoryByBarcode(barcode);
            const categoryName = String(readCell(row, categoryIndex) || existing?.category_name || '').trim();
            if (!categoryName) {
                throw new Error(`Row ${i + 1}: Category is required for new items.`);
            }

            const rateRaw = parseOptionalNumber(readCell(row, rateIndex));
            if (Number.isNaN(rateRaw) || (rateRaw !== null && rateRaw < 0)) {
                throw new Error(`Row ${i + 1}: Price per hour must be a non-negative number.`);
            }

            const intervalRaw = parseOptionalNumber(readCell(row, overtimeIntervalIndex));
            if (Number.isNaN(intervalRaw) || (intervalRaw !== null && intervalRaw <= 0)) {
                throw new Error(`Row ${i + 1}: Overtime interval must be greater than zero.`);
            }

            const overtimeRateRaw = parseOptionalNumber(readCell(row, overtimeRateIndex));
            if (Number.isNaN(overtimeRateRaw) || (overtimeRateRaw !== null && overtimeRateRaw < 0)) {
                throw new Error(`Row ${i + 1}: Overtime rate must be a non-negative number.`);
            }

            payloads.push({
                item_id: existing ? existing.item_id : 0,
                item_name: itemName,
                barcode,
                category_name: categoryName,
                hourly_rate: rateRaw !== null ? rateRaw : Number(existing?.hourly_rate || 0),
                overtime_interval_minutes: intervalRaw !== null ? Math.trunc(intervalRaw) : (existing?.overtime_interval_minutes ?? null),
                overtime_rate_per_block: overtimeRateRaw !== null ? overtimeRateRaw : (existing?.overtime_rate_per_block ?? null),
                status: String(readCell(row, statusIndex) || existing?.status || 'available').trim() || 'available',
                image_path: existing?.image_path || '',
            });
        }

        if (!payloads.length) {
            throw new Error('No valid inventory rows were found in the Excel file.');
        }

        for (const payload of payloads) {
            await window.igpApi.saveInventory(payload);
        }

        return payloads.length;
    }

    function svgToPngData(svg) {
        return new Promise((resolve, reject) => {
            if (!svg) {
                reject(new Error('Barcode image not found.'));
                return;
            }

            const sourceWidth = Number(svg.getAttribute('width')) || svg.viewBox.baseVal.width || svg.getBoundingClientRect().width || 300;
            const sourceHeight = Number(svg.getAttribute('height')) || svg.viewBox.baseVal.height || svg.getBoundingClientRect().height || 150;
            const svgMarkup = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
            const objectUrl = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(sourceWidth);
                canvas.height = Math.ceil(sourceHeight);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Unable to prepare PNG export.'));
                    return;
                }

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngData = canvas.toDataURL('image/png').split(',')[1];
                URL.revokeObjectURL(objectUrl);
                resolve(pngData);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Unable to convert barcode to PNG.'));
            };

            img.src = objectUrl;
        });
    }

    async function downloadAllBarcodes() {
        if (!window.JSZip) {
            alert('ZIP export is not available right now.');
            return;
        }
        if (!inventory.length) {
            alert('There are no barcodes to download.');
            return;
        }

        const zip = new window.JSZip();

        for (const item of inventory) {
            const svg = document.getElementById(`bc_${item.item_id}`);
            if (!svg) continue;
            const pngData = await svgToPngData(svg);
            const filename = `${sanitizeDownloadName(item.item_name)}_${item.item_id}_barcode.png`;
            zip.file(filename, pngData, { base64: true });
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        const objectUrl = URL.createObjectURL(content);
        downloadLink.href = objectUrl;
        downloadLink.download = 'inventory_barcodes.zip';
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            if (downloadLink.parentNode) {
                downloadLink.parentNode.removeChild(downloadLink);
            }
        }, 1000);
    }

    async function refresh() {
        const [inventoryRes, categoryRes, itemNameRes] = await Promise.all([
            window.igpApi.getInventory({}),
            window.igpApi.getInventoryCategories(),
            window.igpApi.getInventoryItemNames(),
        ]);
        const { items } = inventoryRes;
        sharedCategories = Array.isArray(categoryRes.categories) ? categoryRes.categories : [];
        sharedItemNames = Array.isArray(itemNameRes.items) ? itemNameRes.items : [];
        inventory = items || [];
        populateTypeMenu();
        populateItemNameMenu(getSelectedItemName());
        render();
    }

    async function saveItem(existing) {
        const item_name = getSelectedItemName();
        const item_type = getSelectedType();
        const barcode = (($('barcode') || {}).value || '').trim();
        const pricePerHour = Number((($('pricePerHour') || {}).value || '0'));
        const overtimeInterval = (($('overtimeInterval') || {}).value || '').trim();
        const overtimeRate = (($('overtimeRate') || {}).value || '').trim();
        const imageInput = $('itemImage');
        const selectedImage = imageInput && imageInput.files ? imageInput.files[0] : null;
        const matchingItem = findMatchingItemRecord(item_name, item_type);
        if (!item_name || !item_type || !barcode) {
            alert('Item name, item type, and barcode are required.');
            return;
        }
        if (!existing && !selectedImage && !(matchingItem && matchingItem.image_path)) {
            alert('Item image is required.');
            return;
        }
        const payload = new FormData();
        payload.append('item_id', existing ? String(existing.item_id) : '0');
        payload.append('item_name', item_name);
        payload.append('barcode', barcode);
        payload.append('category_name', item_type);
        payload.append('hourly_rate', String(Number.isFinite(pricePerHour) ? pricePerHour : 0));
        payload.append('status', existing ? existing.status : 'available');
        payload.append('overtime_interval_minutes', overtimeInterval);
        payload.append('overtime_rate_per_block', overtimeRate);
        if (selectedImage) {
            payload.append('image', selectedImage);
        }
        await window.igpApi.saveInventoryForm(payload);
        resetItemForm();
        await refresh();
    }

    function bind() {
        if ($('searchInput')) $('searchInput').addEventListener('input', render);
        if ($('clearSearch')) $('clearSearch').addEventListener('click', () => { $('searchInput').value = ''; render(); });

        if ($('addItemForm')) {
            $('addItemForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const editId = Number(($('addItemForm').dataset.editId || '0'));
                    const existing = editId ? inventory.find((x) => x.item_id === editId) : null;
                    await saveItem(existing || null);
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        if ($('cancelEditButton')) {
            $('cancelEditButton').addEventListener('click', () => {
                resetItemForm();
            });
        }

        if ($('itemType')) {
            $('itemType').addEventListener('change', () => {
                toggleCustomTypeInput($('itemType').value === ADD_NEW_TYPE_VALUE);
                populateItemNameMenu(getSelectedItemName());
                syncItemImageFromSelection();
            });
        }

        if ($('itemTypeCustom')) {
            $('itemTypeCustom').addEventListener('input', () => {
                populateItemNameMenu(getSelectedItemName());
                syncItemImageFromSelection();
            });
            $('itemTypeCustom').addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    toggleCustomTypeInput(false);
                    if ($('itemType')) $('itemType').value = '';
                    populateItemNameMenu(getSelectedItemName());
                    syncItemImageFromSelection();
                }
            });
            $('itemTypeCustom').addEventListener('blur', () => {
                const value = String($('itemTypeCustom').value || '').trim();
                if (value === '') {
                    toggleCustomTypeInput(false);
                    if ($('itemType')) $('itemType').value = '';
                    populateItemNameMenu(getSelectedItemName());
                    syncItemImageFromSelection();
                }
            });
        }

        if ($('itemName')) {
            $('itemName').addEventListener('change', () => {
                const select = $('itemName');
                const input = $('itemNameCustom');
                if (!select || !input) return;
                if (select.value === ADD_NEW_ITEM_NAME_VALUE) {
                    input.value = lastSelectedItemName;
                    toggleCustomItemNameInput(true);
                    return;
                }
                lastSelectedItemName = String(select.value || '').trim();
                toggleCustomItemNameInput(false);
                syncItemImageFromSelection();
            });
        }

        if ($('itemNameCustom')) {
            $('itemNameCustom').addEventListener('input', () => {
                syncItemImageFromSelection();
            });
            $('itemNameCustom').addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    toggleCustomItemNameInput(false);
                    if ($('itemName')) $('itemName').value = '';
                    syncItemImageFromSelection();
                }
            });
            $('itemNameCustom').addEventListener('blur', () => {
                const value = String($('itemNameCustom').value || '').trim();
                if (value === '') {
                    toggleCustomItemNameInput(false);
                    if ($('itemName')) $('itemName').value = '';
                    syncItemImageFromSelection();
                }
            });
        }

        if ($('barcodeDisplay')) $('barcodeDisplay').addEventListener('click', async (e) => {
            const edit = e.target.closest('.js-edit');
            if (edit) {
                const it = inventory.find((x) => x.item_id === Number(edit.dataset.id));
                if (!it) return;
                populateTypeMenu(it.category_name || '');
                populateItemNameMenu(it.item_name || '');
                lastSelectedItemName = it.item_name || '';
                if ($('itemName')) $('itemName').value = ADD_NEW_ITEM_NAME_VALUE;
                if ($('itemNameCustom')) $('itemNameCustom').value = it.item_name || '';
                toggleCustomItemNameInput(true);
                $('barcode').value = it.barcode || '';
                $('pricePerHour').value = fmtRate(it.hourly_rate);
                $('overtimeInterval').value = it.overtime_interval_minutes ?? '';
                $('overtimeRate').value = it.overtime_rate_per_block ?? '';
                if ($('itemImage')) $('itemImage').required = false;
                updateImagePreview(resolveImagePath(it.image_path || ''));
                $('addItemForm').dataset.editId = String(it.item_id);
                setEditMode(true);
                return;
            }
            const del = e.target.closest('.js-delete');
            if (del) deletingId = Number(del.dataset.id || 0);
        });

        if ($('confirmDeleteItem')) {
            $('confirmDeleteItem').addEventListener('click', async () => {
                const txt = (($('deleteItemConfirmInput') || {}).value || '').trim();
                if (txt !== 'Delete') {
                    if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'block';
                    return;
                }
                try {
                    await window.igpApi.deleteInventory(deletingId);
                    const modalEl = $('deleteItemModal');
                    const inst = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                    if ($('deleteItemConfirmInput')) $('deleteItemConfirmInput').value = '';
                    if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'none';
                    await refresh();
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        if ($('deleteItemConfirmInput')) {
            $('deleteItemConfirmInput').addEventListener('input', () => {
                const ok = $('deleteItemConfirmInput').value.trim() === 'Delete';
                if ($('confirmDeleteItem')) $('confirmDeleteItem').disabled = !ok;
                if ($('deleteItemConfirmError')) $('deleteItemConfirmError').style.display = 'none';
            });
        }

        if ($('deleteAll')) $('deleteAll').addEventListener('click', () => alert('Delete-all is disabled in DB mode.'));
        if ($('confirmDeleteAll')) $('confirmDeleteAll').addEventListener('click', () => {});
        if ($('importExcel')) $('importExcel').addEventListener('click', () => {
            if ($('excelInput')) $('excelInput').click();
        });
        if ($('excelInput')) $('excelInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const count = await importInventoryWorkbook(file);
                await refresh();
                alert(`Successfully imported ${count} item(s) to the database.`);
            } catch (err) {
                alert(err.message || 'Unable to import the Excel file.');
            } finally {
                e.target.value = '';
            }
        });
        if ($('exportExcel')) $('exportExcel').addEventListener('click', () => {
            if (!window.XLSX) return;
            const rows = inventory.map((it) => ({
                'Category': it.category_name,
                'Name': it.item_name,
                'Barcode': it.barcode,
                'Status': it.status,
                'Price Per Hour': it.hourly_rate,
                'Overtime Interval (mins)': it.overtime_interval_minutes ?? '',
                'Overtime Rate (PHP)': it.overtime_rate_per_block ?? ''
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            XLSX.writeFile(wb, 'inventory.xlsx');
        });
        if ($('downloadAll')) $('downloadAll').addEventListener('click', async () => {
            try {
                await downloadAllBarcodes();
            } catch (err) {
                alert(err.message || 'Unable to download barcodes.');
            }
        });
        if ($('itemImage')) {
            $('itemImage').addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                updateImagePreview(file ? URL.createObjectURL(file) : '');
                if ($('itemImage')) $('itemImage').required = !file;
                if (!file) syncItemImageFromSelection();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bind();
        setEditMode(false);
        try {
            await refresh();
        } catch (err) {
            alert(err.message);
        }
    });
})();
