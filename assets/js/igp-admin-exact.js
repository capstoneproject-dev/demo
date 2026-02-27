(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let officers = [];
    let officerToDelete = null;

    function normalizeRows(rows) {
        return (rows || [])
            .map((row) => ({
                id: Number(row.id || 0),
                officerId: String(row.officerId || ''),
                officerName: String(row.officerName || ''),
                department: String(row.department || ''),
                roleName: String(row.roleName || 'officer'),
                joinedAt: String(row.joinedAt || '').slice(0, 10),
                isActive: row.isActive !== false,
            }))
            .filter((row) => row.isActive);
    }

    function groupByDepartment(list) {
        const grouped = {};
        list.forEach((officer) => {
            const key = officer.department || 'Unassigned';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(officer);
        });
        return grouped;
    }

    function filteredOfficers() {
        const term = (($('searchInput') || {}).value || '').trim().toLowerCase();
        if (!term) return officers;
        return officers.filter((officer) =>
            officer.officerId.toLowerCase().includes(term) ||
            officer.officerName.toLowerCase().includes(term) ||
            officer.department.toLowerCase().includes(term)
        );
    }

    function renderDatabase() {
        const dbDiv = $('database');
        if (!dbDiv) return;
        dbDiv.innerHTML = '';

        const departments = groupByDepartment(filteredOfficers());
        Object.keys(departments).sort().forEach((department) => {
            const departmentDiv = document.createElement('div');
            departmentDiv.innerHTML = `<h2 class="section-title">Department: ${department}</h2>`;

            departments[department].forEach((officer) => {
                const ref = window.encodeStudentData ? window.encodeStudentData(officer.officerId) : officer.officerId;
                const safeRef = ref.replace(/[^A-Za-z0-9_-]/g, '_');
                const card = document.createElement('div');
                card.className = 'officer-card row align-items-center';
                card.innerHTML = `
                    <div class="col-md-3 col-12 text-center">
                        <svg id="barcode-${safeRef}"></svg>
                    </div>
                    <div class="col-md-8 col-12">
                        <strong>ID:</strong> ${officer.officerId}<br>
                        <strong>Name:</strong> ${officer.officerName}<br>
                        <strong>Department:</strong> ${officer.department}<br>
                        <strong>Barcode Ref:</strong> ${ref}<br>
                        <small class="text-muted">Unique ID: ${officer.officerId}</small>
                    </div>
                    <div class="col-md-1 col-12 text-end">
                        <button class="btn btn-sm btn-danger delete-officer" title="Delete Officer" data-id="${officer.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                departmentDiv.appendChild(card);
                setTimeout(() => {
                    if (window.JsBarcode) {
                        window.JsBarcode(`#barcode-${safeRef}`, ref, {
                            format: 'CODE128',
                            width: 2,
                            height: 60,
                            displayValue: true,
                        });
                    }
                }, 0);
            });

            dbDiv.appendChild(departmentDiv);
        });

        document.querySelectorAll('.delete-officer').forEach((button) => {
            button.addEventListener('click', () => {
                officerToDelete = officers.find((officer) => officer.id === Number(button.dataset.id)) || null;
                if ($('deleteOfficerConfirmInput')) $('deleteOfficerConfirmInput').value = '';
                if ($('deleteOfficerConfirmError')) $('deleteOfficerConfirmError').style.display = 'none';
                if (window.bootstrap) new window.bootstrap.Modal($('deleteOfficerModal')).show();
            });
        });
    }

    async function refresh() {
        const result = await window.igpApi.getOrgOfficers();
        officers = normalizeRows(result.items || []);
        renderDatabase();
    }

    async function saveOfficerFromForm() {
        const officerId = (($('addOfficerId') || {}).value || '').trim();
        const officerName = (($('addOfficerName') || {}).value || '').trim();
        const department = (($('addOfficerDepartment') || {}).value || '').trim();
        if (!officerId || !officerName || !department) return;

        const existing = officers.find((officer) => officer.officerId === officerId);
        await window.igpApi.saveOrgOfficer({
            id: existing ? existing.id : 0,
            officerId,
            officerName,
            department,
            roleName: existing ? existing.roleName : 'officer',
            joinedAt: existing && existing.joinedAt ? existing.joinedAt : new Date().toISOString().slice(0, 10),
            isActive: 1,
        });

        if ($('addOfficerForm')) $('addOfficerForm').reset();
        await refresh();
    }

    async function importExcel(file) {
        if (!file || !window.XLSX) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const header = (rows[0] || []).map((value) => String(value).toLowerCase().trim());

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i] || [];
                let officerId = row[header.indexOf('officer id')] || row[header.indexOf('officerid')];
                let officerName = row[header.indexOf('officer name')] || row[header.indexOf('officername')];
                let department = row[header.indexOf('department')];

                if (!officerId) officerId = row[header.indexOf('student id')] || row[header.indexOf('studentid')];
                if (!officerName) officerName = row[header.indexOf('student name')] || row[header.indexOf('studentname')];
                if (!department) department = row[header.indexOf('section')];
                if (!officerId || !officerName || !department) continue;

                const existing = officers.find((officer) => officer.officerId === String(officerId).trim());
                await window.igpApi.saveOrgOfficer({
                    id: existing ? existing.id : 0,
                    officerId: String(officerId).trim(),
                    officerName: String(officerName).trim(),
                    department: String(department).trim(),
                    roleName: existing ? existing.roleName : 'officer',
                    joinedAt: existing && existing.joinedAt ? existing.joinedAt : new Date().toISOString().slice(0, 10),
                    isActive: 1,
                });
            }

            await refresh();
        };
        reader.readAsArrayBuffer(file);
    }

    function bindEvents() {
        if ($('addOfficerId')) {
            $('addOfficerId').addEventListener('input', () => {
                const id = $('addOfficerId').value.trim();
                const existing = officers.find((officer) => officer.officerId === id);
                $('addOfficerName').value = existing ? existing.officerName : '';
                $('addOfficerDepartment').value = existing ? existing.department : '';
            });
        }

        if ($('addOfficerForm')) {
            $('addOfficerForm').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await saveOfficerFromForm();
                } catch (error) {
                    alert(error.message);
                }
            });
        }

        if ($('searchInput')) $('searchInput').addEventListener('input', renderDatabase);
        if ($('clearSearch')) {
            $('clearSearch').addEventListener('click', () => {
                $('searchInput').value = '';
                renderDatabase();
            });
        }

        if ($('clearAll')) {
            $('clearAll').addEventListener('click', () => {
                if ($('deleteConfirmInput')) $('deleteConfirmInput').value = '';
                if ($('deleteConfirmError')) $('deleteConfirmError').style.display = 'none';
                if (window.bootstrap) new window.bootstrap.Modal($('deleteConfirmModal')).show();
            });
        }

        if ($('deleteConfirmInput')) {
            $('deleteConfirmInput').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    $('deleteConfirmBtn').click();
                }
            });
        }

        if ($('deleteConfirmBtn')) {
            $('deleteConfirmBtn').addEventListener('click', async () => {
                if ($('deleteConfirmInput').value.trim() !== 'Delete') {
                    if ($('deleteConfirmError')) {
                        $('deleteConfirmError').textContent = "You must type 'Delete' to confirm.";
                        $('deleteConfirmError').style.display = 'block';
                    }
                    return;
                }

                for (const officer of officers) {
                    await window.igpApi.deleteOrgOfficer(officer.id);
                }

                const modal = window.bootstrap && window.bootstrap.Modal.getInstance($('deleteConfirmModal'));
                if (modal) modal.hide();
                await refresh();
            });
        }

        if ($('deleteOfficerConfirmInput')) {
            $('deleteOfficerConfirmInput').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    $('deleteOfficerConfirmBtn').click();
                }
            });
        }

        if ($('deleteOfficerConfirmBtn')) {
            $('deleteOfficerConfirmBtn').addEventListener('click', async () => {
                if (!officerToDelete) return;
                if ($('deleteOfficerConfirmInput').value.trim() !== 'Delete') {
                    if ($('deleteOfficerConfirmError')) {
                        $('deleteOfficerConfirmError').textContent = "You must type 'Delete' to confirm.";
                        $('deleteOfficerConfirmError').style.display = 'block';
                    }
                    return;
                }

                await window.igpApi.deleteOrgOfficer(officerToDelete.id);
                officerToDelete = null;
                const modal = window.bootstrap && window.bootstrap.Modal.getInstance($('deleteOfficerModal'));
                if (modal) modal.hide();
                await refresh();
            });
        }

        if ($('excelInput')) {
            $('excelInput').addEventListener('change', async (event) => {
                try {
                    await importExcel(event.target.files[0]);
                } catch (error) {
                    alert(error.message);
                } finally {
                    event.target.value = '';
                }
            });
        }

        if ($('exportExcel')) {
            $('exportExcel').addEventListener('click', () => {
                if (!window.XLSX) return;
                const rows = officers.map((officer) => ({
                    'Officer ID': officer.officerId,
                    'Officer Name': officer.officerName,
                    Department: officer.department,
                }));
                const ws = window.XLSX.utils.json_to_sheet(rows);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'Officers');
                window.XLSX.writeFile(wb, 'officer_database.xlsx');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindEvents();
        try {
            await refresh();
        } catch (error) {
            alert(error.message);
        }
    });
})();
