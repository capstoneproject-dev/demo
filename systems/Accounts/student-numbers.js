// Student Numbers Management System
// Uses accountsLocalStorageService (local-storage-service.js) — no direct key access!

var studentNumbers = [];

function getService() { return window.accountsLocalStorageService; }

function formatDate(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleString(); } catch (_) { return '—'; }
}

function generateId() {
    return 'sn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(title, message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'toast-notification toast-' + (type || 'success');
    div.innerHTML = '<span class="toast-title">' + escHtml(title) + '</span> ' + escHtml(message || '');
    container.appendChild(div);
    requestAnimationFrame(function() { div.classList.add('show'); });
    var remove = function() { div.classList.remove('show'); setTimeout(function() { div.remove(); }, 180); };
    setTimeout(remove, 3000);
}

// ── Institute/Program dropdowns ──
var INSTITUTE_LIST = Object.keys(INSTITUTE_PROGRAMS);

function populateInstituteSelect(selectEl, currentValue) {
    while (selectEl.options.length > 1) selectEl.remove(1);
    INSTITUTE_LIST.forEach(function(inst) { selectEl.add(new Option(inst, inst)); });
    if (currentValue) selectEl.value = currentValue;
}

function populateProgramSelect(selectEl, institute, currentValue) {
    while (selectEl.options.length > 1) selectEl.remove(1);
    if (institute) {
        (INSTITUTE_PROGRAMS[institute] || []).forEach(function(p) { selectEl.add(new Option(p, p)); });
    }
    if (currentValue) selectEl.value = currentValue;
}

// ── Load / Save via service ──
async function loadStudentNumbers() {
    var svc = getService();
    if (svc) {
        studentNumbers = await svc.getStudentNumbers();
    } else {
        studentNumbers = [];
        console.error('accountsLocalStorageService not available');
    }
}

// ── Render table ──
function updateStudentNumbersTable() {
    var tbody = document.getElementById('studentNumbersTable');
    if (!tbody) return;

    var instFilter  = (document.getElementById('instituteFilter') || {}).value || 'all';
    var progFilter  = (document.getElementById('programFilter')   || {}).value || 'all';
    var searchTerm  = ((document.getElementById('searchStudentNumbers') || {}).value || '').toLowerCase();

    var filtered = studentNumbers.filter(function(s) {
        if (instFilter !== 'all' && s.institute !== instFilter) return false;
        if (progFilter !== 'all' && s.programCode !== progFilter) return false;
        if (searchTerm) {
            var hay = (s.studentId + ' ' + s.studentName + ' ' + (s.yearSection || '')).toLowerCase();
            if (hay.indexOf(searchTerm) === -1) return false;
        }
        return true;
    });

    filtered.sort(function(a, b) { return a.studentId.localeCompare(b.studentId); });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No student numbers found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(function(s, i) {
        return '<tr>' +
            '<td>' + (i+1) + '</td>' +
            '<td><strong>' + escHtml(s.studentId) + '</strong></td>' +
            '<td>' + escHtml(s.studentName) + '</td>' +
            '<td><small>' + escHtml(s.institute || '—') + '</small></td>' +
            '<td>' + escHtml(s.programCode || '—') + '</td>' +
            '<td>' + escHtml(s.yearSection || '—') + '</td>' +
            '<td>' + formatDate(s.addedAt) + '</td>' +
            '<td>' +
                '<button class="btn btn-sm btn-outline-primary" onclick="editStudentNumber(\'' + escHtml(s.studentId) + '\')">Edit</button> ' +
                '<button class="btn btn-sm btn-outline-danger"  onclick="deleteStudentNumber(\'' + escHtml(s.studentId) + '\')">Delete</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

function updateTotalCount() {
    var el = document.getElementById('totalStudentCount');
    if (el) el.textContent = studentNumbers.length;
}

function clearFilters() {
    var instF  = document.getElementById('instituteFilter');
    var progF  = document.getElementById('programFilter');
    var search = document.getElementById('searchStudentNumbers');
    if (instF)  { instF.value  = 'all'; onInstituteFilterChange(); }
    if (progF)  progF.value  = 'all';
    if (search) search.value = '';
    updateStudentNumbersTable();
}

function onInstituteFilterChange() {
    var inst   = document.getElementById('instituteFilter').value;
    var progSel = document.getElementById('programFilter');
    while (progSel.options.length > 1) progSel.remove(1);
    if (inst !== 'all') {
        (INSTITUTE_PROGRAMS[inst] || []).forEach(function(p) { progSel.add(new Option(p, p)); });
    }
    updateStudentNumbersTable();
}

// ── Add ──
async function handleAddStudentNumber(e) {
    e.preventDefault();
    var studentId   = document.getElementById('newStudentId').value.trim();
    var studentName = document.getElementById('newStudentName').value.trim();
    var institute   = document.getElementById('newInstitute').value;
    var programCode = document.getElementById('newProgram').value;
    var yearSection = document.getElementById('newYearSection').value.trim();
    var email       = document.getElementById('newEmail').value.trim();
    var phone       = document.getElementById('newPhone').value.trim();

    if (!studentId || !studentName) {
        showToast('Error', 'Student Number and Name are required.', 'error'); return;
    }
    if (studentNumbers.find(function(s) { return s.studentId === studentId; })) {
        showToast('Error', 'Student number already exists.', 'error'); return;
    }

    var record = {
        id: generateId(),
        studentId: studentId,
        studentName: studentName,
        institute: institute || '',
        programCode: programCode || '',
        yearSection: yearSection || '',
        email: email,
        phone: phone,
        hasUnpaidDebt: false,
        isActive: true,
        addedAt: new Date().toISOString(),
        addedBy: 'Admin'
    };

    try {
        await getService().addStudentNumber(record);
        studentNumbers.push(record);
        updateStudentNumbersTable();
        updateTotalCount();
        document.getElementById('addStudentNumberForm').reset();
        document.getElementById('newProgram').innerHTML = '<option value="">Select Program (Optional)</option>';
        var modal = bootstrap.Modal.getInstance(document.getElementById('addStudentNumberModal'));
        if (modal) modal.hide();
        showToast('Success', 'Student number ' + studentId + ' added.', 'success');
    } catch (err) {
        showToast('Error', 'Failed to add: ' + err.message, 'error');
    }
}

// ── Edit ──
function editStudentNumber(studentId) {
    var s = studentNumbers.find(function(s) { return s.studentId === studentId; });
    if (!s) return;

    document.getElementById('editStudentId').value    = s.studentId;
    document.getElementById('editStudentNumber').value = s.studentId;
    document.getElementById('editStudentName').value  = s.studentName;
    document.getElementById('editYearSection').value  = s.yearSection || '';
    document.getElementById('editEmail').value        = s.email || '';
    document.getElementById('editPhone').value        = s.phone || '';

    var instSel = document.getElementById('editInstitute');
    populateInstituteSelect(instSel, s.institute);

    var progSel = document.getElementById('editProgram');
    populateProgramSelect(progSel, s.institute, s.programCode);

    new bootstrap.Modal(document.getElementById('editStudentNumberModal')).show();
}

async function handleEditStudentNumber(e) {
    e.preventDefault();
    var origId      = document.getElementById('editStudentId').value;
    var newId       = document.getElementById('editStudentNumber').value.trim();
    var studentName = document.getElementById('editStudentName').value.trim();
    var institute   = document.getElementById('editInstitute').value;
    var programCode = document.getElementById('editProgram').value;
    var yearSection = document.getElementById('editYearSection').value.trim();
    var email       = document.getElementById('editEmail').value.trim();
    var phone       = document.getElementById('editPhone').value.trim();

    if (!newId || !studentName) {
        showToast('Error', 'Student Number and Name are required.', 'error'); return;
    }
    if (newId !== origId && studentNumbers.find(function(s) { return s.studentId === newId; })) {
        showToast('Error', 'Student number already exists.', 'error'); return;
    }

    var idx = studentNumbers.findIndex(function(s) { return s.studentId === origId; });
    if (idx === -1) { showToast('Error', 'Student not found.', 'error'); return; }

    var updated = Object.assign({}, studentNumbers[idx], {
        studentId: newId, studentName: studentName,
        institute: institute, programCode: programCode, yearSection: yearSection,
        email: email, phone: phone, updatedAt: new Date().toISOString(), updatedBy: 'Admin'
    });

    try {
        await getService().updateStudentNumber(origId, updated);
        studentNumbers[idx] = updated;
        updateStudentNumbersTable();
        var modal = bootstrap.Modal.getInstance(document.getElementById('editStudentNumberModal'));
        if (modal) modal.hide();
        showToast('Success', 'Updated ' + newId + '.', 'success');
    } catch (err) {
        showToast('Error', 'Failed to update: ' + err.message, 'error');
    }
}

// ── Delete ──
async function deleteStudentNumber(studentId) {
    var s = studentNumbers.find(function(s) { return s.studentId === studentId; });
    if (!s) return;
    if (!confirm('Delete ' + studentId + ' (' + s.studentName + ')?')) return;
    try {
        await getService().deleteStudentNumber(s.studentId);
        studentNumbers = studentNumbers.filter(function(x) { return x.studentId !== studentId; });
        updateStudentNumbersTable();
        updateTotalCount();
        showToast('Deleted', studentId + ' removed.', 'success');
    } catch (err) {
        showToast('Error', 'Failed to delete: ' + err.message, 'error');
    }
}

// ── Import XLSX ──
function importStudentNumbers() {
    new bootstrap.Modal(document.getElementById('importCSVModal')).show();
}

async function processXLSXImport() {
    var fileInput = document.getElementById('csvFile');
    var file = fileInput.files[0];
    if (!file) { showToast('Error', 'Please select an XLSX file.', 'error'); return; }

    try {
        var data = await file.arrayBuffer();
        var workbook = XLSX.read(data, { type: 'array' });
        var ws = workbook.Sheets[workbook.SheetNames[0]];
        var jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (jsonData.length < 2) { showToast('Error', 'File needs at least a header row and one data row.', 'error'); return; }

        var headers = jsonData[0].map(function(h) { return String(h).trim().toLowerCase().replace(/[\s_-]/g, ''); });

        function col(names) {
            for (var i = 0; i < names.length; i++) {
                var idx = headers.indexOf(names[i]);
                if (idx !== -1) return idx;
            }
            return -1;
        }

        var idIdx        = col(['studentid','studentnumber','id','uniqueid']);
        var nameIdx      = col(['studentname','name','fullname']);
        var instIdx      = col(['institute','institutename']);
        var progIdx      = col(['programcode','program','course']);
        var ysIdx        = col(['yearsection','section','yearsec']);
        var emailIdx     = col(['email','emailaddress']);
        var phoneIdx     = col(['phone','phonenumber','mobile']);

        var missingRequiredHeaders = [];
        if (idIdx === -1)   missingRequiredHeaders.push('studentId');
        if (nameIdx === -1) missingRequiredHeaders.push('studentName');
        if (instIdx === -1) missingRequiredHeaders.push('institute');
        if (progIdx === -1) missingRequiredHeaders.push('programCode');
        if (missingRequiredHeaders.length > 0) {
            showToast('Error', 'Missing required column(s): ' + missingRequiredHeaders.join(', '), 'error'); return;
        }

        var records = [];
        var invalidRows = 0;

        for (var i = 1; i < jsonData.length; i++) {
            var row = jsonData[i];
            if (!row || row.length === 0) continue;

            var studentId   = idIdx   !== -1 ? String(row[idIdx]   || '').trim() : '';
            var studentName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
            var institute   = instIdx  !== -1 ? String(row[instIdx]  || '').trim() : '';
            var programCode = progIdx  !== -1 ? String(row[progIdx]  || '').trim() : '';
            if (!studentId || !studentName || !institute || !programCode) {
                invalidRows++;
                continue;
            }

            records.push({
                studentId: studentId,
                studentName: studentName,
                institute:   institute,
                programCode: programCode,
                yearSection: ysIdx    !== -1 ? String(row[ysIdx]    || '').trim() : '',
                email:       emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '',
                phone:       phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '',
                hasUnpaidDebt: false,
                isActive: true
            });
        }

        if (records.length === 0) {
            showToast('Error', 'No valid rows found to import.', 'error');
            return;
        }

        var result = await getService().bulkImportStudentNumbers(records);
        var imported = Number(result.imported || 0);
        var skipped  = Number(result.skipped  || 0);
        var errors   = Number(result.errors   || 0);

        await loadStudentNumbers();
        updateStudentNumbersTable();
        updateTotalCount();
        var modal = bootstrap.Modal.getInstance(document.getElementById('importCSVModal'));
        if (modal) modal.hide();
        if (fileInput) fileInput.value = '';

        var msg = 'Imported ' + imported + '.';
        if (skipped > 0) msg += ' Skipped ' + skipped + ' duplicates.';
        if (invalidRows > 0) msg += ' Skipped ' + invalidRows + ' row(s) with missing required values.';
        if (errors  > 0) msg += ' ' + errors + ' errors.';
        showToast('Import done', msg, 'success');

    } catch (err) {
        showToast('Error', 'Failed to process XLSX: ' + err.message, 'error');
        console.error('XLSX import error:', err);
    }
}

// ── Export XLSX ──
async function exportStudentNumbers() {
    await loadStudentNumbers();
    if (studentNumbers.length === 0) { showToast('Warning', 'No data to export.', 'warning'); return; }
    try {
        var exportData = studentNumbers.map(function(s) {
            return {
                studentId:   s.studentId,
                studentName: s.studentName,
                institute:   s.institute   || '',
                programCode: s.programCode || '',
                yearSection: s.yearSection || '',
                email:       s.email       || '',
                phone:       s.phone       || '',
                hasUnpaidDebt: s.hasUnpaidDebt ? 'yes' : 'no',
                isActive:    s.isActive    ? 'yes' : 'no',
                addedAt:     s.addedAt     || ''
            };
        });
        var ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [14,30,40,12,14,14,30,16,10,12].map(function(w) { return { wch: w }; });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Student Numbers');
        XLSX.writeFile(wb, 'student_numbers_' + new Date().toISOString().slice(0,10) + '.xlsx');
        showToast('Exported', 'Download started.', 'success');
    } catch (err) {
        showToast('Error', 'Export failed: ' + err.message, 'error');
    }
}

// ── Event listeners ──
function setupEventListeners() {
    var el;

    el = document.getElementById('addStudentNumberForm');
    if (el) el.addEventListener('submit', handleAddStudentNumber);

    el = document.getElementById('editStudentNumberForm');
    if (el) el.addEventListener('submit', handleEditStudentNumber);

    el = document.getElementById('searchStudentNumbers');
    if (el) el.addEventListener('input', updateStudentNumbersTable);

    el = document.getElementById('instituteFilter');
    if (el) el.addEventListener('change', onInstituteFilterChange);

    el = document.getElementById('programFilter');
    if (el) el.addEventListener('change', updateStudentNumbersTable);

    // Add modal: institute cascade
    el = document.getElementById('newInstitute');
    if (el) el.addEventListener('change', function() {
        populateProgramSelect(document.getElementById('newProgram'), this.value);
    });

    // Edit modal: institute cascade
    el = document.getElementById('editInstitute');
    if (el) el.addEventListener('change', function() {
        populateProgramSelect(document.getElementById('editProgram'), this.value);
    });
}

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', async function() {
    // Validate PHP session – OSA staff only
    try {
        var res  = await fetch('../../api/auth/session.php', { credentials: 'include' });
        var json = await res.json();
        if (!json.authenticated) { window.location.href = '../../pages/login.html'; return; }
        var acct = (json.session && json.session.account_type) || '';
        var role = (json.session && json.session.login_role)   || '';
        if (acct !== 'osa_staff' && role !== 'osa') { window.location.href = '../../pages/login.html'; return; }
    } catch (_) { window.location.href = '../../pages/login.html'; return; }

    // Populate filter and modal institute selects
    var instList = Object.keys(INSTITUTE_PROGRAMS);

    var instFilter = document.getElementById('instituteFilter');
    if (instFilter) instList.forEach(function(i) { instFilter.add(new Option(i, i)); });

    var newInstitute = document.getElementById('newInstitute');
    if (newInstitute) instList.forEach(function(i) { newInstitute.add(new Option(i, i)); });

    var editInstitute = document.getElementById('editInstitute');
    if (editInstitute) instList.forEach(function(i) { editInstitute.add(new Option(i, i)); });

    await loadStudentNumbers();
    setupEventListeners();
    updateStudentNumbersTable();
    updateTotalCount();
});
