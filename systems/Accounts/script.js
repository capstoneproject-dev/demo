// Account Management System — script.js
// Handles Students tab, Officers tab, Account Requests, modals, filters.


// --- State ---
let students = [];
let officers = [];
let pendingRequests = [];
let studentNumbers = [];

var lastFingerprint = null;  // realtime poll baseline (null = not yet set)
var pollTimer       = null;
var POLL_INTERVAL   = 3000; // ms
var FORCE_REFRESH_EVERY = 30000; // ms
var lastFullRefreshAt = 0;

// --- Helpers ---
function getService() { return window.accountsLocalStorageService; }

function redirectFromAccounts(path) {
    if (window.top && window.top !== window) window.top.location.href = path;
    else window.location.href = path;
}

/**
 * authorizeIncomingUser
 * Validates the PHP session; only OSA staff may access this page.
 * Returns true if authorised, false (+ redirects) otherwise.
 */
async function authorizeIncomingUser() {
    try {
        const res  = await fetch('../../api/auth/session.php', { credentials: 'include' });
        const json = await res.json();
        if (!json.authenticated) { redirectFromAccounts('../../pages/login.html'); return false; }
        const acct = json.session?.account_type || json.user?.account_type || '';
        const role = json.session?.login_role   || '';
        if (acct === 'osa_staff' || role === 'osa') return true;
        if (role === 'org') { redirectFromAccounts('../../pages/officerDashboard.html'); return false; }
        redirectFromAccounts('../../pages/login.html');
        return false;
    } catch (_) {
        redirectFromAccounts('../../pages/login.html');
        return false;
    }
}

function formatDate(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleString(); } catch (_) { return '—'; }
}

function formatDateShort(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString(); } catch (_) { return '—'; }
}

function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function showToast(msg, type) {
    if (!type) type = 'success';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + type + ' py-2 px-3 mb-0 shadow-sm';
    div.style.minWidth = '220px';
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(function() { div.remove(); }, 3500);
}

function escHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- Institute / Program / Org helpers ---
var INSTITUTE_LIST = Object.keys(INSTITUTE_PROGRAMS);

function programsForInstitute(institute) {
    return INSTITUTE_PROGRAMS[institute] || [];
}

function orgsForInstitute(institute) {
    var specific = INSTITUTE_ORGS[institute] || [];
    return specific.concat(COLLEGE_WIDE_ORGS);
}

function populateInstituteSelect(selectEl) {
    var current = selectEl.value;
    while (selectEl.options.length > 1) selectEl.remove(1);
    INSTITUTE_LIST.forEach(function(inst) { selectEl.add(new Option(inst, inst)); });
    if (current) selectEl.value = current;
}

function populateProgramSelect(selectEl, institute, currentValue) {
    while (selectEl.options.length > 1) selectEl.remove(1);
    if (institute) {
        programsForInstitute(institute).forEach(function(prog) { selectEl.add(new Option(prog, prog)); });
    }
    if (currentValue) selectEl.value = currentValue;
}

function populateOrgSelect(selectEl, institute, currentValue) {
    while (selectEl.options.length > 1) selectEl.remove(1);
    orgsForInstitute(institute || '').forEach(function(org) { selectEl.add(new Option(org, org)); });
    if (currentValue) selectEl.value = currentValue;
}

// --- Data Loading ---
async function loadData() {
    var svc = getService();
    if (!svc) { console.error('accountsLocalStorageService not found'); return; }
    students        = await svc.getStudentAccounts();
    officers        = await svc.getOfficers();
    pendingRequests = await svc.getPendingRequests();
    studentNumbers  = await svc.getStudentNumbers();
}

// --- Render: Students tab ---
function getFilteredStudents() {
    var instFilter  = (document.getElementById('studentInstituteFilter') || {}).value || 'all';
    var progFilter  = (document.getElementById('studentProgramFilter')   || {}).value || 'all';
    var searchTerm  = ((document.getElementById('studentSearch')         || {}).value || '').toLowerCase();

    return students.filter(function(s) {
        if (instFilter !== 'all' && s.institute   !== instFilter) return false;
        if (progFilter !== 'all' && s.programCode !== progFilter) return false;
        if (searchTerm) {
            var hay = (s.studentId + ' ' + s.studentName + ' ' + s.programCode + ' ' + s.yearSection).toLowerCase();
            if (hay.indexOf(searchTerm) === -1) return false;
        }
        return true;
    });
}

function renderStudentsTable() {
    var tbody = document.getElementById('studentRecords');
    if (!tbody) return;
    var rows = getFilteredStudents();
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No student accounts match filters</td></tr>';
        document.getElementById('studentsTotalBadge').textContent = '0';
        return;
    }
    tbody.innerHTML = rows.map(function(s, i) {
        return '<tr>' +
            '<td>' + (i+1) + '</td>' +
            '<td>' + escHtml(s.studentId) + '</td>' +
            '<td>' + escHtml(s.studentName) + '</td>' +
            '<td><small>' + escHtml(s.institute || '—') + '</small></td>' +
            '<td>' + escHtml(s.programCode || '—') + '</td>' +
            '<td>' + escHtml(s.yearSection || '—') + '</td>' +
            '<td><small>' + escHtml(s.email || '—') + '</small></td>' +
            '<td><small>' + escHtml(s.phone || '—') + '</small></td>' +
            '<td>' +
                '<button class="btn btn-sm btn-outline-primary py-0 px-1" onclick="openEditStudentModal(\'' + escHtml(s.studentId) + '\')">Edit</button> ' +
                '<button class="btn btn-sm btn-outline-danger py-0 px-1"  onclick="deleteStudent(\'' + escHtml(s.studentId) + '\')">Del</button>' +
            '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('studentsTotalBadge').textContent = rows.length;
}

function onStudentInstituteFilterChange() {
    var inst    = document.getElementById('studentInstituteFilter').value;
    var progSel = document.getElementById('studentProgramFilter');
    while (progSel.options.length > 1) progSel.remove(1);
    if (inst !== 'all') {
        programsForInstitute(inst).forEach(function(prog) { progSel.add(new Option(prog, prog)); });
    }
    renderStudentsTable();
}

// --- Render: Officers tab ---
function getFilteredOfficers() {
    var instFilter = (document.getElementById('officerInstituteFilter') || {}).value || 'all';
    var orgFilter  = (document.getElementById('officerOrgFilter')       || {}).value || 'all';
    var searchTerm = ((document.getElementById('officerSearch')         || {}).value || '').toLowerCase();

    return officers.filter(function(o) {
        if (instFilter !== 'all' && o.institute !== instFilter) return false;
        if (orgFilter  !== 'all' && o.orgCode   !== orgFilter)  return false;
        if (searchTerm) {
            var hay = (o.studentId + ' ' + o.studentName + ' ' + o.orgCode + ' ' + o.roleName).toLowerCase();
            if (hay.indexOf(searchTerm) === -1) return false;
        }
        return true;
    });
}

function renderOfficersTable() {
    var tbody = document.getElementById('officerRecords');
    if (!tbody) return;
    var rows = getFilteredOfficers();
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No officers match filters</td></tr>';
        document.getElementById('officersTotalBadge').textContent = '0';
        return;
    }
    tbody.innerHTML = rows.map(function(o, i) {
        var badge = o.isActive
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>';
        return '<tr>' +
            '<td>' + (i+1) + '</td>' +
            '<td>' + escHtml(o.studentId) + '</td>' +
            '<td>' + escHtml(o.studentName) + '</td>' +
            '<td><small>' + escHtml(o.institute || '—') + '</small></td>' +
            '<td>' + escHtml(o.orgCode || '—') + '</td>' +
            '<td>' + escHtml(o.roleName || '—') + '</td>' +
            '<td>' + formatDateShort(o.joinedAt) + '</td>' +
            '<td>' + badge + '</td>' +
            '<td>' +
                '<button class="btn btn-sm btn-outline-primary py-0 px-1" onclick="openEditOfficerModal(\'' + escHtml(o.id) + '\')">Edit</button> ' +
                '<button class="btn btn-sm btn-outline-danger py-0 px-1"  onclick="deleteOfficerRecord(\'' + escHtml(o.id) + '\')">Del</button>' +
            '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('officersTotalBadge').textContent = rows.length;
}

function onOfficerInstituteFilterChange() {
    var inst   = document.getElementById('officerInstituteFilter').value;
    var orgSel = document.getElementById('officerOrgFilter');
    while (orgSel.options.length > 1) orgSel.remove(1);
    if (inst === 'all') {
        Object.values(INSTITUTE_ORGS).reduce(function(a,b){return a.concat(b);}, [])
            .concat(COLLEGE_WIDE_ORGS)
            .forEach(function(org) { orgSel.add(new Option(org, org)); });
    } else {
        orgsForInstitute(inst).forEach(function(org) { orgSel.add(new Option(org, org)); });
    }
    renderOfficersTable();
}

// --- Render: Account Requests ---
function renderRequestTables() {
    var pending  = pendingRequests.filter(function(r) { return r.status === 'pending';  });
    var approved = pendingRequests.filter(function(r) { return r.status === 'approved'; });
    var rejected = pendingRequests.filter(function(r) { return r.status === 'rejected'; });

    document.getElementById('pendingCount').textContent  = pending.length;
    document.getElementById('approvedCount').textContent = approved.length;
    document.getElementById('rejectedCount').textContent = rejected.length;
    document.getElementById('pendingRequestsBadge').textContent = pending.length;

    var pendingTbody = document.getElementById('pendingRequestsTable');
    pendingTbody.innerHTML = pending.length === 0
        ? '<tr><td colspan="6" class="text-center text-muted">No pending requests</td></tr>'
        : pending.map(function(r, i) {
            return '<tr>' +
                '<td>' + (i+1) + '</td>' +
                '<td>' + escHtml(r.studentId || '') + '</td>' +
                '<td>' + escHtml(r.studentName || r.name || '') + '</td>' +
                '<td>' + escHtml(r.programCode || r.course || '—') + '</td>' +
                '<td>' + formatDate(r.requestedAt || r.requestTime || r.timestamp) + '</td>' +
                '<td>' +
                    '<button class="btn btn-sm btn-success py-0 px-1"  onclick="approveRequest(\'' + escHtml(r.id) + '\')">Approve</button> ' +
                    '<button class="btn btn-sm btn-danger py-0 px-1"   onclick="rejectRequest(\'' + escHtml(r.id) + '\')">Reject</button>' +
                '</td>' +
            '</tr>';
          }).join('');

    var approvedTbody = document.getElementById('approvedRequestsTable');
    approvedTbody.innerHTML = approved.length === 0
        ? '<tr><td colspan="6" class="text-center text-muted">No approved requests</td></tr>'
        : approved.map(function(r, i) {
            return '<tr>' +
                '<td>' + (i+1) + '</td>' +
                '<td>' + escHtml(r.studentId || '') + '</td>' +
                '<td>' + escHtml(r.studentName || r.name || '') + '</td>' +
                '<td>' + escHtml(r.programCode || r.course || '—') + '</td>' +
                '<td>' + formatDate(r.requestedAt || r.requestTime || r.timestamp) + '</td>' +
                '<td>' + formatDate(r.approvedAt) + '</td>' +
            '</tr>';
          }).join('');

    var rejectedTbody = document.getElementById('rejectedRequestsTable');
    rejectedTbody.innerHTML = rejected.length === 0
        ? '<tr><td colspan="7" class="text-center text-muted">No rejected requests</td></tr>'
        : rejected.map(function(r, i) {
            return '<tr>' +
                '<td>' + (i+1) + '</td>' +
                '<td>' + escHtml(r.studentId || '') + '</td>' +
                '<td>' + escHtml(r.studentName || r.name || '') + '</td>' +
                '<td>' + escHtml(r.programCode || r.course || '—') + '</td>' +
                '<td>' + formatDate(r.requestedAt || r.requestTime || r.timestamp) + '</td>' +
                '<td>' + formatDate(r.rejectedAt) + '</td>' +
                '<td><button class="btn btn-sm btn-warning py-0 px-1" onclick="reopenRequest(\'' + escHtml(r.id) + '\')">Reopen</button></td>' +
            '</tr>';
          }).join('');
}

// --- Full refresh ---
function refreshAll() {
    renderStudentsTable();
    renderOfficersTable();
    renderRequestTables();
}

// --- Student CRUD ---
async function handleAddStudent(e) {
    e.preventDefault();
    var studentId   = document.getElementById('studentId').value.trim();
    var studentName = document.getElementById('studentName').value.trim();
    var institute   = document.getElementById('addInstitute').value;
    var programCode = document.getElementById('addProgram').value;
    var yearSection = document.getElementById('yearSection').value.trim();
    var email       = document.getElementById('email').value.trim();
    var phone       = document.getElementById('phone').value.trim();

    if (!studentId || !studentName || !institute || !programCode || !yearSection) {
        showToast('Please fill in all required fields.', 'warning'); return;
    }
    if (students.find(function(s) { return s.studentId === studentId; })) {
        showToast('Student number already exists.', 'danger'); return;
    }

    var record = {
        studentId: studentId,
        studentName: studentName,
        institute: institute,
        programCode: programCode,
        yearSection: yearSection,
        email: email,
        phone: phone,
        hasUnpaidDebt: false,
        isActive: true
    };

    try {
        await getService().addStudentAccount(record);
        lastFingerprint = null;
        await loadData();
        bootstrap.Modal.getInstance(document.getElementById('addStudentModal'))?.hide();
        document.getElementById('addStudentForm').reset();
        document.getElementById('addProgram').innerHTML = '<option value="">Select Program</option>';
        showToast('Student added.');
        renderStudentsTable();
    } catch (err) {
        showToast(err.message || 'Failed to add student.', 'danger');
    }
}

function openEditStudentModal(studentId) {
    var s = students.find(function(s) { return s.studentId === studentId; });
    if (!s) { showToast('Student not found.', 'danger'); return; }

    document.getElementById('editOriginalStudentId').value = s.studentId;
    document.getElementById('editStudentId').value   = s.studentId;
    document.getElementById('editStudentName').value = s.studentName;
    document.getElementById('editYearSection').value = s.yearSection || '';
    document.getElementById('editEmail').value = s.email || '';
    document.getElementById('editPhone').value = s.phone || '';

    var instSel = document.getElementById('editInstitute');
    populateInstituteSelect(instSel);
    instSel.value = s.institute || '';

    var progSel = document.getElementById('editProgram');
    populateProgramSelect(progSel, s.institute, s.programCode);

    new bootstrap.Modal(document.getElementById('editStudentModal')).show();
}

async function handleEditStudent(e) {
    e.preventDefault();
    var origId      = document.getElementById('editOriginalStudentId').value;
    var newId       = document.getElementById('editStudentId').value.trim();
    var studentName = document.getElementById('editStudentName').value.trim();
    var institute   = document.getElementById('editInstitute').value;
    var programCode = document.getElementById('editProgram').value;
    var yearSection = document.getElementById('editYearSection').value.trim();
    var email       = document.getElementById('editEmail').value.trim();
    var phone       = document.getElementById('editPhone').value.trim();

    if (!newId || !studentName || !institute || !programCode || !yearSection) {
        showToast('Please fill in all required fields.', 'warning'); return;
    }
    if (newId !== origId && students.find(function(s) { return s.studentId === newId; })) {
        showToast('That student number already exists.', 'danger'); return;
    }

    var idx = students.findIndex(function(s) { return s.studentId === origId; });
    if (idx === -1) { showToast('Student not found.', 'danger'); return; }

    var updated = Object.assign({}, students[idx], { studentId: newId, studentName: studentName, institute: institute, programCode: programCode, yearSection: yearSection, email: email, phone: phone });

    try {
        await getService().updateStudentAccount(updated.id, updated);
        lastFingerprint = null;
        await loadData();
        bootstrap.Modal.getInstance(document.getElementById('editStudentModal'))?.hide();
        showToast('Student updated.');
        renderStudentsTable();
    } catch (err) {
        showToast(err.message || 'Failed to update student.', 'danger');
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Delete student ' + studentId + '?')) return;
    var idx = students.findIndex(function(s) { return s.studentId === studentId; });
    if (idx === -1) return;
    try {
        await getService().deleteStudentAccount(students[idx].id);
        lastFingerprint = null;
        students.splice(idx, 1);
        showToast('Student deleted.', 'warning');
        renderStudentsTable();
    } catch (err) {
        showToast(err.message || 'Failed to delete student.', 'danger');
    }
}

// --- Officer CRUD ---
async function handleAddOfficer(e) {
    e.preventDefault();
    var studentId = document.getElementById('officerStudentId').value.trim();
    var institute = document.getElementById('officerInstitute').value;
    var orgCode   = document.getElementById('officerOrg').value;
    var roleName  = document.getElementById('officerRole').value;
    var joinedAt  = document.getElementById('officerJoinedAt').value;

    if (!studentId || !institute || !orgCode || !roleName) {
        showToast('Please fill in all required fields.', 'warning'); return;
    }

    var acct  = students.find(function(s) { return s.studentId === studentId; });
    var numE  = studentNumbers.find(function(s) { return s.studentId === studentId; });
    var found = acct || numE;
    var studentName = found ? (found.studentName || studentId) : studentId;

    var record = {
        id: generateId(),
        studentId: studentId,
        studentName: studentName,
        institute: institute,
        orgCode: orgCode,
        orgName: orgCode,
        roleName: roleName,
        joinedAt: joinedAt || new Date().toISOString().slice(0, 10),
        isActive: true,
        addedAt: new Date().toISOString(),
        addedBy: 'Admin'
    };

    try {
        await getService().addOfficer(record);
        lastFingerprint = null;
        await loadData();
        bootstrap.Modal.getInstance(document.getElementById('addOfficerModal'))?.hide();
        document.getElementById('addOfficerForm').reset();
        document.getElementById('officerOrg').innerHTML = '<option value="">Select Organization</option>';
        document.getElementById('officerStudentLookup').textContent = '';
        showToast('Officer added.');
        renderOfficersTable();
    } catch (err) {
        showToast(err.message || 'Failed to add officer.', 'danger');
    }
}

function openEditOfficerModal(officerId) {
    var o = officers.find(function(o) { return o.id === officerId; });
    if (!o) { showToast('Officer not found.', 'danger'); return; }

    document.getElementById('editOfficerId').value = o.id;
    document.getElementById('editOfficerStudentId').value   = o.studentId;
    document.getElementById('editOfficerStudentName').value = o.studentName;
    document.getElementById('editOfficerJoinedAt').value    = o.joinedAt || '';
    document.getElementById('editOfficerIsActive').checked  = !!o.isActive;
    document.getElementById('editOfficerRole').value        = o.roleName || '';

    var instSel = document.getElementById('editOfficerInstitute');
    populateInstituteSelect(instSel);
    instSel.value = o.institute || '';

    var orgSel = document.getElementById('editOfficerOrg');
    populateOrgSelect(orgSel, o.institute, o.orgCode);

    new bootstrap.Modal(document.getElementById('editOfficerModal')).show();
}

async function handleEditOfficer(e) {
    e.preventDefault();
    var id        = document.getElementById('editOfficerId').value;
    var institute = document.getElementById('editOfficerInstitute').value;
    var orgCode   = document.getElementById('editOfficerOrg').value;
    var roleName  = document.getElementById('editOfficerRole').value;
    var joinedAt  = document.getElementById('editOfficerJoinedAt').value;
    var isActive  = document.getElementById('editOfficerIsActive').checked;

    if (!institute || !orgCode || !roleName) {
        showToast('Please fill in all required fields.', 'warning'); return;
    }

    var idx = officers.findIndex(function(o) { return o.id === id; });
    if (idx === -1) { showToast('Officer not found.', 'danger'); return; }

    var updated = Object.assign({}, officers[idx], { institute: institute, orgCode: orgCode, orgName: orgCode, roleName: roleName, joinedAt: joinedAt, isActive: isActive });

    try {
        await getService().updateOfficer(id, updated);
        lastFingerprint = null;
        await loadData();
        bootstrap.Modal.getInstance(document.getElementById('editOfficerModal'))?.hide();
        showToast('Officer updated.');
        renderOfficersTable();
    } catch (err) {
        showToast(err.message || 'Failed to update officer.', 'danger');
    }
}

async function deleteOfficerRecord(officerId) {
    var o = officers.find(function(o) { return o.id === officerId; });
    if (!o) return;
    if (!confirm('Remove ' + o.studentName + ' from ' + o.orgCode + '?')) return;
    try {
        await getService().deleteOfficer(officerId);
        lastFingerprint = null;
        officers = officers.filter(function(x) { return x.id !== officerId; });
        showToast('Officer removed.', 'warning');
        renderOfficersTable();
    } catch (err) {
        showToast(err.message || 'Failed to remove officer.', 'danger');
    }
}

// --- Account Request actions ---
async function approveRequest(requestId) {
    requestId = String(requestId);
    var request = pendingRequests.find(function(r) { return String(r.id) === requestId; });
    if (!request) return;
    try {
        await getService().updatePendingRequest(requestId, { status: 'approved' });
        lastFingerprint = null;
        await loadData();
        showToast('Approved: ' + (request.studentName || request.name || request.studentId));
        renderStudentsTable();
        renderRequestTables();
    } catch (err) {
        showToast(err.message || 'Failed to approve request.', 'danger');
    }
}

async function rejectRequest(requestId) {
    requestId = String(requestId);
    var request = pendingRequests.find(function(r) { return String(r.id) === requestId; });
    if (!request) return;
    try {
        await getService().updatePendingRequest(requestId, { status: 'rejected' });
        lastFingerprint = null;
        await loadData();
        showToast('Request rejected.', 'warning');
        renderRequestTables();
    } catch (err) {
        showToast(err.message || 'Failed to reject request.', 'danger');
    }
}

async function reopenRequest(requestId) {
    requestId = String(requestId);
    var request = pendingRequests.find(function(r) { return String(r.id) === requestId; });
    if (!request) return;
    try {
        await getService().updatePendingRequest(requestId, { status: 'pending' });
        lastFingerprint = null;
        await loadData();
        showToast('Request moved back to pending.');
        renderRequestTables();
    } catch (err) {
        showToast(err.message || 'Failed to reopen request.', 'danger');
    }
}

// --- Import XLSX ---
async function processStudentsXLSXImport() {
    var fileInput = document.getElementById('importStudentsFile');
    var file = fileInput ? fileInput.files[0] : null;
    if (!file) { showToast('Please select an XLSX file.', 'warning'); return; }

    try {
        var data = await file.arrayBuffer();
        var workbook = XLSX.read(data, { type: 'array' });
        var ws = workbook.Sheets[workbook.SheetNames[0]];
        var jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!jsonData || jsonData.length < 2) {
            showToast('File needs at least a header row and one data row.', 'warning'); return;
        }

        var headers = jsonData[0].map(function(h) {
            return String(h || '').trim().toLowerCase().replace(/[\s_-]/g, '');
        });

        function col(names) {
            for (var i = 0; i < names.length; i++) {
                var idx = headers.indexOf(names[i]);
                if (idx !== -1) return idx;
            }
            return -1;
        }

        var idIdx    = col(['studentid', 'studentnumber', 'id']);
        var nameIdx  = col(['studentname', 'name', 'fullname']);
        var instIdx  = col(['institute', 'institutename']);
        var progIdx  = col(['programcode', 'program', 'course']);
        var ysIdx    = col(['yearsection', 'section', 'yearsec']);
        var emailIdx = col(['email', 'emailaddress']);
        var phoneIdx = col(['phone', 'phonenumber', 'mobile']);

        if (idIdx === -1 || nameIdx === -1) {
            showToast('File must have studentId and studentName columns.', 'danger'); return;
        }

        var imported = 0, skipped = 0, errors = 0;
        var svc = getService();

        for (var i = 1; i < jsonData.length; i++) {
            var row = jsonData[i];
            if (!row || row.length === 0) continue;

            var studentId   = String(row[idIdx]   || '').trim();
            var studentName = String(row[nameIdx] || '').trim();
            if (!studentId || !studentName) { errors++; continue; }

            if (students.find(function(s) { return s.studentId === studentId; })) { skipped++; continue; }

            var institute   = instIdx  !== -1 ? String(row[instIdx]  || '').trim() : '';
            var programCode = progIdx  !== -1 ? String(row[progIdx]  || '').trim() : '';
            var yearSection = ysIdx    !== -1 ? String(row[ysIdx]    || '').trim() : '';
            var email       = emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '';
            var phone       = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';

            var record = {
                id: generateId(),
                studentId: studentId,
                studentName: studentName,
                institute: institute,
                programCode: programCode,
                yearSection: yearSection,
                email: email,
                phone: phone,
                hasUnpaidDebt: false,
                isActive: true,
                addedAt: new Date().toISOString(),
                addedBy: 'XLSX Import'
            };

            try {
                await svc.addStudentAccount(record);
                students.push(record);
                // Note: no addPendingRequest needed – direct DB insert is equivalent to approved import
                imported++;
            } catch (_) { errors++; }
        }

        bootstrap.Modal.getInstance(document.getElementById('importStudentsModal'))?.hide();
        if (fileInput) fileInput.value = '';
        renderStudentsTable();
        renderRequestTables();

        var msg = 'Imported ' + imported + ' student(s).';
        if (skipped > 0) msg += ' Skipped ' + skipped + ' duplicates.';
        if (errors  > 0) msg += ' ' + errors + ' error(s).';
        showToast(msg, imported > 0 ? 'success' : 'warning');

    } catch (err) {
        showToast('Failed to process XLSX: ' + err.message, 'danger');
        console.error('XLSX import error:', err);
    }
}

// --- Export ---
function exportData() {
    var data = {
        exportedAt: new Date().toISOString(),
        studentAccounts: students,
        officers: officers,
        pendingRequests: pendingRequests
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'accounts_export_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// --- Filter Dropdowns init ---
function initFilterDropdowns() {
    // Students: institute filter
    var sInstSel = document.getElementById('studentInstituteFilter');
    INSTITUTE_LIST.forEach(function(inst) { sInstSel.add(new Option(inst, inst)); });

    // Officers: institute filter
    var oInstSel = document.getElementById('officerInstituteFilter');
    INSTITUTE_LIST.forEach(function(inst) { oInstSel.add(new Option(inst, inst)); });

    // Officers: org filter (all orgs initially)
    var oOrgSel = document.getElementById('officerOrgFilter');
    Object.values(INSTITUTE_ORGS).reduce(function(a,b){return a.concat(b);}, [])
        .concat(COLLEGE_WIDE_ORGS)
        .forEach(function(org) { oOrgSel.add(new Option(org, org)); });

    // Add modals
    populateInstituteSelect(document.getElementById('addInstitute'));
    populateInstituteSelect(document.getElementById('officerInstitute'));
}

// --- Event Wiring ---
function setupEventListeners() {
    var el;

    el = document.getElementById('refreshData');
    if (el) el.addEventListener('click', async function() { lastFingerprint = null; await loadData(); refreshAll(); showToast('Data refreshed.'); });

    el = document.getElementById('exportData');
    if (el) el.addEventListener('click', exportData);

    // Student filters
    el = document.getElementById('studentInstituteFilter');
    if (el) el.addEventListener('change', onStudentInstituteFilterChange);

    el = document.getElementById('studentProgramFilter');
    if (el) el.addEventListener('change', renderStudentsTable);

    el = document.getElementById('studentSearch');
    if (el) el.addEventListener('input', renderStudentsTable);

    // Officers filters
    el = document.getElementById('officerInstituteFilter');
    if (el) el.addEventListener('change', onOfficerInstituteFilterChange);

    el = document.getElementById('officerOrgFilter');
    if (el) el.addEventListener('change', renderOfficersTable);

    el = document.getElementById('officerSearch');
    if (el) el.addEventListener('input', renderOfficersTable);

    // Add Student modal: institute -> program cascade
    el = document.getElementById('addInstitute');
    if (el) el.addEventListener('change', function() {
        populateProgramSelect(document.getElementById('addProgram'), this.value);
    });

    // Edit Student modal: institute -> program cascade
    el = document.getElementById('editInstitute');
    if (el) el.addEventListener('change', function() {
        populateProgramSelect(document.getElementById('editProgram'), this.value);
    });

    // Add Officer modal: institute -> org cascade
    el = document.getElementById('officerInstitute');
    if (el) el.addEventListener('change', function() {
        populateOrgSelect(document.getElementById('officerOrg'), this.value);
    });

    // Edit Officer modal: institute -> org cascade
    el = document.getElementById('editOfficerInstitute');
    if (el) el.addEventListener('change', function() {
        populateOrgSelect(document.getElementById('editOfficerOrg'), this.value);
    });

    // Officer add: student ID live lookup
    el = document.getElementById('officerStudentId');
    if (el) el.addEventListener('input', function() {
        var val  = this.value.trim();
        var acct = students.find(function(s) { return s.studentId === val; });
        var numE = studentNumbers.find(function(s) { return s.studentId === val; });
        var found = acct || numE;
        var lookup = document.getElementById('officerStudentLookup');
        if (found) {
            lookup.textContent = 'Found: ' + (found.studentName || '') + ' — ' + (found.programCode || found.course || '');
            lookup.style.color = 'green';
        } else if (val.length > 4) {
            lookup.textContent = 'Student number not found in records.';
            lookup.style.color = 'crimson';
        } else {
            lookup.textContent = '';
        }
    });

    // Forms
    el = document.getElementById('addStudentForm');
    if (el) el.addEventListener('submit', handleAddStudent);

    el = document.getElementById('editStudentForm');
    if (el) el.addEventListener('submit', handleEditStudent);

    el = document.getElementById('addOfficerForm');
    if (el) el.addEventListener('submit', handleAddOfficer);

    el = document.getElementById('editOfficerForm');
    if (el) el.addEventListener('submit', handleEditOfficer);

    // Clear add-student form on modal close
    el = document.getElementById('addStudentModal');
    if (el) el.addEventListener('hidden.bs.modal', function() {
        document.getElementById('addStudentForm').reset();
        document.getElementById('addProgram').innerHTML = '<option value="">Select Program</option>';
    });

    // Clear add-officer form on modal close
    el = document.getElementById('addOfficerModal');
    if (el) el.addEventListener('hidden.bs.modal', function() {
        document.getElementById('addOfficerForm').reset();
        document.getElementById('officerOrg').innerHTML = '<option value="">Select Organization</option>';
        document.getElementById('officerStudentLookup').textContent = '';
    });
}

// --- Realtime Polling ---

function anyModalOpen() {
    return !!document.querySelector('.modal.show');
}

async function pollForChanges() {
    if (anyModalOpen()) return; // pause while user has a modal open
    try {
        var res  = await fetch('../../api/accounts/poll.php', { credentials: 'include' });
        if (!res.ok) return;
        var json = await res.json();
        if (!json.ok) return;
        var key = json.students.lastUpdated + '|' + json.students.count
                + '|' + json.officers.lastUpdated + '|' + json.officers.count
                + '|' + json.requests.lastUpdated + '|' + json.requests.count
                + '|' + json.studentNumbers.lastUpdated + '|' + json.studentNumbers.count;

        if (lastFingerprint === null) {
            lastFingerprint = key;
            lastFullRefreshAt = Date.now();
            return;
        }

        var now = Date.now();
        var changed = key !== lastFingerprint;
        var shouldForceRefresh = (now - lastFullRefreshAt) >= FORCE_REFRESH_EVERY;

        if (changed || shouldForceRefresh) {
            lastFingerprint = key;
            await loadData();
            refreshAll();
            lastFullRefreshAt = now;
            if (changed) showToast('Data updated.', 'info');
        }
    } catch (_) {
        // Silent - retry on next interval
    }
}

function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollForChanges, POLL_INTERVAL);
}

function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// Pause polling when tab is hidden, resume when visible
document.addEventListener('visibilitychange', function() {
    if (document.hidden) { stopPolling(); } else { startPolling(); }
});

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', async function() {
    if (!await authorizeIncomingUser()) return;
    await loadData();
    initFilterDropdowns();
    setupEventListeners();
    refreshAll();
    startPolling();
});

