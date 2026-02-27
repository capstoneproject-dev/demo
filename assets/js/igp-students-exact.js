(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let students = [];
    let studentToDelete = null;

    function normalizeRows(rows) {
        return (rows || [])
            .map((row) => ({
                userId: Number(row.user_id || 0),
                studentId: String(row.studentId || ''),
                studentName: String(row.studentName || ''),
                section: String(row.section || ''),
                programCode: String(row.programCode || 'BSAIS'),
                isActive: row.isActive !== false,
            }));
    }

    function groupBySection(list) {
        const grouped = {};
        list.forEach((student) => {
            const key = student.section || 'Unassigned';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(student);
        });
        return grouped;
    }

    function filteredStudents() {
        const term = (($('searchInput') || {}).value || '').trim().toLowerCase();
        if (!term) return students;
        return students.filter((student) =>
            student.studentId.toLowerCase().includes(term) ||
            student.studentName.toLowerCase().includes(term) ||
            student.section.toLowerCase().includes(term)
        );
    }

    function renderDatabase() {
        const dbDiv = $('database');
        if (!dbDiv) return;
        dbDiv.innerHTML = '';

        const grouped = groupBySection(filteredStudents());
        Object.keys(grouped).sort().forEach((section) => {
            const sectionDiv = document.createElement('div');
            sectionDiv.innerHTML = `<h2 class="section-title">Section ${section}</h2>`;

            grouped[section].forEach((student) => {
                const ref = window.encodeStudentData ? window.encodeStudentData(student.studentId) : student.studentId;
                const safeRef = ref.replace(/[^A-Za-z0-9_-]/g, '_');
                const card = document.createElement('div');
                card.className = 'student-card row align-items-center';
                card.innerHTML = `
                    <div class="col-md-3 col-12 text-center">
                        <svg id="barcode-${safeRef}"></svg>
                    </div>
                    <div class="col-md-8 col-12">
                        <strong>ID:</strong> ${student.studentId}<br>
                        <strong>Name:</strong> ${student.studentName}<br>
                        <strong>Section:</strong> ${student.section}<br>
                        <strong>Barcode Ref:</strong> ${ref}<br>
                        <small class="text-muted">Unique ID: ${student.studentId}</small>
                    </div>
                    <div class="col-md-1 col-12 text-end">
                        <button class="btn btn-sm btn-danger delete-student" title="Delete Student" data-studentid="${student.studentId}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                sectionDiv.appendChild(card);
                setTimeout(() => {
                    if (window.JsBarcode) {
                        window.JsBarcode(`#barcode-${safeRef}`, ref, {
                            format: 'CODE128',
                            width: 2,
                            height: 60,
                            displayValue: true
                        });
                    }
                }, 0);
            });

            dbDiv.appendChild(sectionDiv);
        });

        document.querySelectorAll('.delete-student').forEach((button) => {
            button.addEventListener('click', () => {
                studentToDelete = students.find((student) => student.studentId === button.dataset.studentid) || null;
                if ($('deleteStudentConfirmInput')) $('deleteStudentConfirmInput').value = '';
                if ($('confirmDeleteStudent')) $('confirmDeleteStudent').disabled = true;
                if (window.bootstrap) new window.bootstrap.Modal($('deleteStudentModal')).show();
            });
        });
    }

    async function refresh() {
        const result = await window.igpApi.getStudents();
        students = normalizeRows(result.items || []);
        renderDatabase();
    }

    async function saveStudentFromForm() {
        const studentId = (($('addStudentId') || {}).value || '').trim();
        const studentName = (($('addStudentName') || {}).value || '').trim();
        const section = (($('addStudentSection') || {}).value || '').trim();
        if (!studentId || !studentName || !section) return;

        const existing = students.find((student) => student.studentId === studentId);
        await window.igpApi.saveStudent({
            userId: existing ? existing.userId : 0,
            studentId,
            studentName,
            section,
            programCode: existing ? existing.programCode : 'BSAIS',
        });

        if ($('addStudentForm')) $('addStudentForm').reset();
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
                const studentId = row[header.indexOf('studentid')] || row[header.indexOf('student id')];
                const studentName = row[header.indexOf('studentname')] || row[header.indexOf('student name')];
                const section = row[header.indexOf('section')];
                if (!studentId || !studentName || !section) continue;

                const existing = students.find((student) => student.studentId === String(studentId).trim());
                await window.igpApi.saveStudent({
                    userId: existing ? existing.userId : 0,
                    studentId: String(studentId).trim(),
                    studentName: String(studentName).trim(),
                    section: String(section).trim(),
                    programCode: existing ? existing.programCode : 'BSAIS',
                });
            }

            await refresh();
        };
        reader.readAsArrayBuffer(file);
    }

    function bindEvents() {
        if ($('addStudentId')) {
            $('addStudentId').addEventListener('input', () => {
                const id = $('addStudentId').value.trim();
                const existing = students.find((student) => student.studentId === id);
                $('addStudentName').value = existing ? existing.studentName : '';
                $('addStudentSection').value = existing ? existing.section : '';
            });
        }

        if ($('addStudentForm')) {
            $('addStudentForm').addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    await saveStudentFromForm();
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
                if ($('confirmDeleteAll')) $('confirmDeleteAll').disabled = true;
                if (window.bootstrap) new window.bootstrap.Modal($('clearAllModal')).show();
            });
        }

        if ($('deleteConfirmInput')) {
            $('deleteConfirmInput').addEventListener('input', () => {
                $('confirmDeleteAll').disabled = $('deleteConfirmInput').value !== 'Delete';
            });
            $('deleteConfirmInput').addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && $('deleteConfirmInput').value === 'Delete') {
                    event.preventDefault();
                    $('confirmDeleteAll').click();
                }
            });
        }

        if ($('confirmDeleteAll')) {
            $('confirmDeleteAll').addEventListener('click', async () => {
                if ($('deleteConfirmInput').value !== 'Delete') return;
                for (const student of students) {
                    await window.igpApi.deleteStudent({ userId: student.userId, studentId: student.studentId });
                }
                const modal = window.bootstrap && window.bootstrap.Modal.getInstance($('clearAllModal'));
                if (modal) modal.hide();
                await refresh();
            });
        }

        if ($('deleteStudentConfirmInput')) {
            $('deleteStudentConfirmInput').addEventListener('input', () => {
                $('confirmDeleteStudent').disabled = $('deleteStudentConfirmInput').value !== 'Delete';
            });
            $('deleteStudentConfirmInput').addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && $('deleteStudentConfirmInput').value === 'Delete') {
                    event.preventDefault();
                    $('confirmDeleteStudent').click();
                }
            });
        }

        if ($('confirmDeleteStudent')) {
            $('confirmDeleteStudent').addEventListener('click', async () => {
                if (!studentToDelete || $('deleteStudentConfirmInput').value !== 'Delete') return;
                await window.igpApi.deleteStudent({
                    userId: studentToDelete.userId,
                    studentId: studentToDelete.studentId,
                });
                studentToDelete = null;
                const modal = window.bootstrap && window.bootstrap.Modal.getInstance($('deleteStudentModal'));
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
                const exportData = [['uniqueId', 'studentId', 'studentName', 'section']];
                students.forEach((student) => {
                    exportData.push([student.studentId, student.studentId, student.studentName, student.section]);
                });
                const ws = window.XLSX.utils.aoa_to_sheet(exportData);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'Students');
                window.XLSX.writeFile(wb, 'barcode-students.xlsx');
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
