// --- INTEGRATED THEME LOGIC ---

// Helper function to switch the theme
function switchThemeLogic() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');

    // Update Mobile Icon
    const mobIcon = document.getElementById('mobile-theme-icon');
    if (mobIcon) {
        mobIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // Update Sidebar Icon
    const sbIcon = document.querySelector('#themeBtn .nav-icon');
    const sbText = document.querySelector('#themeBtn .nav-label');

    if (sbIcon && sbText) {
        if (isDark) {
            sbIcon.className = 'fa-solid fa-sun nav-icon';
            sbText.innerText = 'Light Mode';
        } else {
            sbIcon.className = 'fa-solid fa-moon nav-icon';
            sbText.innerText = 'Dark Mode';
        }
    }

    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Logout handler
function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        showToast('Logging out...', 'info');
        setTimeout(() => {
            window.location.href = '../pages/login.html'; // Change to your login page
        }, 1000);
    }
}

// Initialize Theme on Load
document.addEventListener('DOMContentLoaded', () => {
    // Check if user previously selected dark mode
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');

        // Set icons to Sun immediately
        const mobIcon = document.getElementById('mobile-theme-icon');
        if (mobIcon) mobIcon.className = 'fa-solid fa-sun';

        // If sidebar exists
        const sbIcon = document.querySelector('#themeBtn .nav-icon');
        const sbText = document.querySelector('#themeBtn .nav-label');
        if (sbIcon) sbIcon.className = 'fa-solid fa-sun nav-icon';
        if (sbText) sbText.innerText = 'Light Mode';
    }

    // Initialize Sidebar Theme Button Click Event
    const sidebarThemeBtn = document.getElementById('themeBtn');
    if (sidebarThemeBtn) {
        sidebarThemeBtn.onclick = switchThemeLogic;
    }
});

// --- DATA SIMULATION ---
const organizations = [
    { id: 1, name: "Supreme Student Council", category: "Student Council", president: "TBD", members: "N/A", status: "Active" },
    { id: 2, name: "AISERS", category: "ICS", president: "TBD", members: "N/A", status: "Active" },
    { id: 3, name: "ELITECH", category: "ICS", president: "TBD", members: "N/A", status: "Active" },
    { id: 4, name: "ILASSO", category: "ILAS", president: "TBD", members: "N/A", status: "Active" },
    { id: 5, name: "AERO-ATSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 6, name: "AETSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 7, name: "AMTSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 8, name: "RCYC", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 9, name: "CYC", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 10, name: "SCHOLAR'S GUILD", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 11, name: "AERONAUTICA", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" }
];

const requests = [
    { id: 101, type: "Event Proposal", org: "AISERS", sender: "Pres. Alano", title: "AIS-AHAN: Constituency Check", date: "Oct 24, 2023", status: "Pending" },
    { id: 102, type: "Posting", org: "Supreme Student Council", sender: "VPI Flores", title: "Love Surge", date: "Oct 24, 2023", status: "Pending" },
    { id: 103, type: "Document", org: "AERO-ATSO", sender: "Tres. Beltrano", title: "Semestral Financial Report", date: "Oct 23, 2023", status: "Pending" },
    { id: 104, type: "Event Proposal", org: "SCHOLAR'S GUILD", sender: "PO Martinez", title: "Mental Health Week", date: "Oct 22, 2023", status: "Pending" }
];

const docsData = [
    { title: "September Financial Statement", type: "Financial Statement", date: "Oct 05", status: "Approved" },
    { title: "Team Building Proposal", type: "Proposal", date: "Oct 18", status: "Sent to OSA" },
    { title: "Election Guidelines", type: "Document", date: "Oct 20", status: "Pending" },
    { title: "Constitution Amendment", type: "Legal", date: "Oct 24", status: "SSC Approved" }
];

let currentDocFilter = 'All';

const transactions = [
    { org: "Supreme Student Council", sender: "Juan Dela Cruz", doc: "Budget Proposal Q4", date: "Oct 25, 2023", status: "Pending" },
    { org: "AISERS", sender: "Maria Clara", doc: "Seminar Speaker Fee", date: "Oct 25, 2023", status: "Approved" },
    { org: "ELITECH", sender: "Jose Rizal", doc: "Hackathon Venue Receipt", date: "Oct 24, 2023", status: "Approved" },
    { org: "ILASSO", sender: "Andres Bonifacio", doc: "Outreach Permit", date: "Oct 24, 2023", status: "Rejected" },
    { org: "RCYC", sender: "Gabriela Silang", doc: "Monthly Dues Report", date: "Oct 23, 2023", status: "Pending" },
    { org: "AETSO", sender: "Emilio Aguinaldo", doc: "Flight Simulation Log", date: "Oct 23, 2023", status: "Approved" }
];

// --- RECENT ACTIVITY DATA & RENDER ---
const recentActivities = [
    { type: 'upload', icon: 'fa-file-arrow-up', title: 'New Proposal Submitted', desc: 'Computer Science Society submitted "Tech Week 2026"', time: '10 mins ago' },
    { type: 'user', icon: 'fa-user-plus', title: 'New Student Registration', desc: 'Mark Santos (2023-10023) verified enrollment', time: '25 mins ago' },
    { type: 'success', icon: 'fa-check-double', title: 'Audit Approved', desc: 'JPIA Financial Report Q1 marked as Passed', time: '1 hour ago' },
    { type: 'alert', icon: 'fa-triangle-exclamation', title: 'Late Submission Warning', desc: 'Sent automated reminder to Junior Marketing Assn', time: '2 hours ago' },
    { type: 'upload', icon: 'fa-file-signature', title: 'Constitution Updated', desc: 'Supreme Student Council uploaded v2.0', time: 'Yesterday' }
];

// --- DASHBOARD MOCK DATA ---
const dashboardRequestsMock = [
    { type: "Event Proposal", org: "AISERS", title: "Tech Summit 2026", status: "Pending" },
    { type: "Posting", org: "Supreme Student Council", title: "Election Guidelines", status: "Pending" },
    { type: "Document", org: "ELITECH", title: "Constitution v2", status: "Pending" },
    { type: "Event Proposal", org: "RCYC", title: "Blood Drive", status: "Pending" }
];

function renderRecentActivities() {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    container.innerHTML = recentActivities.map(act => `
        <div class="activity-item">
            <div class="activity-icon ${act.type}">
                <i class="fa-solid ${act.icon}"></i>
            </div>
            <div class="activity-info">
                <h5>${act.title}</h5>
                <p>${act.desc}</p>
                <div class="activity-meta">
                    <i class="fa-regular fa-clock"></i> ${act.time}
                </div>
            </div>
        </div>
    `).join('');
}

// --- UPDATED DASHBOARD PREVIEW RENDER ---
function renderDashboardPreview() {
    const tbody = document.getElementById('dashboard-requests-preview');
    if (!tbody) return;

    // Use the mock data for visualization
    tbody.innerHTML = dashboardRequestsMock.map(req => `
        <tr>
            <td><span class="status-badge status-submitted">${req.type}</span></td>
            <td style="font-weight:600;">${req.org}</td>
            <td>${req.title}</td>
            <td><span class="status-badge status-pending">${req.status}</span></td>
        </tr>
    `).join('');
}

// --- PDF UPLOAD HANDLER (uses PDFViewer module) ---
async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Use the PDFViewer module to handle upload
        const result = await PDFViewer.handleUpload(file);

        // Add to transactions list for display
        transactions.unshift({
            id: result.docId,
            org: 'Current User',
            sender: 'Me',
            doc: result.name,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Pending'
        });

        // Re-render transactions table
        renderTransactions();
        showToast('PDF uploaded successfully!', 'success');

        // Open the PDF viewer
        PDFViewer.open(result.docId);
    } catch (error) {
        showToast(error.message || 'Failed to upload PDF', 'error');
    }

    // Reset input
    event.target.value = '';
}
let currentOrgId = null;

// --- NAVIGATION ---
function navigate(viewId, element) {
    // Update Sidebar Active State
    if (element) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        element.classList.add('active');
    } else {
        // Handling manual navigation (like back button)
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('onclick').includes(viewId)) link.classList.add('active');
            else link.classList.remove('active');
        });
    }

    // Show View
    document.querySelectorAll('.section-view').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');

    // Update Title
    const titleMap = {
        'dashboard': 'OSA Dashboard',
        'organizations': 'Student Organizations',
        'monitoring': 'Organization Monitoring Panel',
        'requests': 'Requests & Approvals',
        'documents': 'Document Repository'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'OSA Portal';
}

// --- RENDER FUNCTIONS ---
function renderOrgs() {
    const tbody = document.getElementById('org-list-body');
    tbody.innerHTML = organizations.map(org => `
        <tr>
            <td><strong>${org.name}</strong></td>
            <td class="text-right">
                <button class="btn btn-sm btn-primary" onclick="openMonitoring(${org.id})">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

// --- REQUESTS & APPROVALS STATE ---
let currentReqStatus = 'all';
let pendingRequestAction = null; // Stores {id, action} for modal confirmation

// Date picker state
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();
let selectedFromDate = null;
let selectedToDate = null;

function initReqOrgFilter() {
    const orgSelect = document.getElementById('req-org-filter');
    if (!orgSelect) return;

    // Populate Organizations Dropdown
    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

function switchReqStatus(status, btnElement) {
    currentReqStatus = status;
    const tabs = document.querySelectorAll('.req-tab');
    tabs.forEach(t => t.classList.remove('active'));
    btnElement.classList.add('active');
    renderRequests();
}

function renderRequests() {
    const tbody = document.getElementById('requests-table');
    const statusFilter = currentReqStatus;
    const typeFilter = document.getElementById('req-type-filter').value;
    const orgFilter = document.getElementById('req-org-filter').value;

    tbody.innerHTML = '';

    const filtered = requests.filter(req => {
        const matchesType = typeFilter === 'all' || req.type === typeFilter;
        const matchesOrg = orgFilter === 'all' || req.org.includes(orgFilter);
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

        // Date range filtering
        let matchesDate = true;
        if (selectedFromDate && selectedToDate) {
            const reqDate = new Date(req.date);
            matchesDate = reqDate >= selectedFromDate && reqDate <= selectedToDate;
        }

        return matchesType && matchesOrg && matchesStatus && matchesDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--muted);">No requests found matching your criteria.</td></tr>`;
        return;
    }

    filtered.forEach(req => {
        let actionButtons = '';
        if (req.status === 'Pending') {
            actionButtons = `
                <button class="btn btn-sm btn-success" onclick="handleRequest(${req.id}, 'Approved')"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="handleRequest(${req.id}, 'Rejected')"><i class="fa-solid fa-xmark"></i></button>
            `;
        } else {
            actionButtons = `
                <span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span>
            `;
        }

        // Split sender name and position for styling (assumes format: "Pos. Name")
        const senderParts = (req.sender || 'TBD User').split(' ');
        const position = senderParts[0];
        const name = senderParts.slice(1).join(' ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="status-badge status-submitted">${req.type}</span></td>
            <td style="font-weight: 600;">${req.org}</td>
            <td>
                <div class="sender-info">
                    <span class="sender-name">${name}</span>
                    <span class="sender-position">${position}</span>
                </div>
            </td>
            <td>${req.title || req.name}</td>
            <td>${req.date || '---'}</td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- DOCUMENT REPOSITORY LOGIC ---

// Renders the main document list with 5-column grid
function renderDocs(filter = 'All', btnElement = null) {
    currentDocFilter = filter;
    const list = document.getElementById('docs-list');
    if (!list) return; // Guard clause

    // Update active tab UI
    if (btnElement) {
        document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const dateVal = document.getElementById('filter-by-date') ? document.getElementById('filter-by-date').value : '';
    const monthVal = document.getElementById('filter-by-month') ? document.getElementById('filter-by-month').value : '';

    // Data Simulation Pools
    const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];
    const sscOfficers = ["Pres. Cruz", "VP Santos", "Sec. Reyes"];
    const osaAdmins = ["Dir. Fury", "Mrs. Potts", "Admin Stark"];

    // Filter Logic
    let filteredData = docsData.filter(doc => {
        if (filter === 'All') return true;
        if (filter === 'Pending') return doc.status.includes('Sent') || doc.status.includes('Pending') || doc.status === 'SSC Approved';
        return doc.status.includes(filter);
    });

    // Date Filter Logic
    if (dateVal || monthVal) {
        filteredData = filteredData.filter(doc => {
            let docDate = new Date(`${doc.date}, 2026`); // Simulating current year
            if (dateVal) {
                return formatDateForComparison(docDate) === dateVal;
            } else if (monthVal) {
                const docMonth = `${docDate.getFullYear()}-${String(docDate.getMonth() + 1).padStart(2, '0')}`;
                return docMonth === monthVal;
            }
            return true;
        });
    }

    if (filteredData.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted); grid-column: 1/-1;">No documents match these filters.</div>`;
        return;
    }

    list.innerHTML = filteredData.map((doc, index) => {
        // Deterministic mock data for columns
        const sender = senders[doc.title.length % senders.length];
        const sscOfficer = sscOfficers[doc.title.length % sscOfficers.length];
        const osaAdmin = osaAdmins[doc.title.length % osaAdmins.length];

        let sscHtml = '', osaHtml = '', actionButtons = '', statusBadge = '';

        if (doc.status === 'Approved') {
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span>${osaAdmin}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            actionButtons = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')"><i class="fa-solid fa-eye"></i> View</button>`;
            statusBadge = '<span class="status-badge status-completed" style="margin-left:8px;">Approved</span>';
        } else if (doc.status === 'SSC Approved') {
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status waiting">Action Required</span>`;
            actionButtons = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); alert('Submit to OSA?')">Submit <i class="fa-solid fa-paper-plane"></i></button>`;
            statusBadge = '<span class="status-badge status-pending" style="margin-left:8px;">Ready</span>';
        } else if (doc.status.includes('Sent to OSA')) {
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            actionButtons = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')"><i class="fa-solid fa-eye"></i> View</button>`;
            statusBadge = '<span class="status-badge status-sent" style="margin-left:8px;">Sent to OSA</span>';
        } else {
            sscHtml = `<span style="color:var(--muted)">--</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status waiting">Waiting</span>`;
            actionButtons = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')"><i class="fa-solid fa-eye"></i> View</button>`;
            statusBadge = '<span class="status-badge status-pending" style="margin-left:8px;">Pending</span>';
        }

        return `
        <div class="list-item" onclick="openPdfViewer('doc_${index}')">
            <div class="col-name" style="display: flex; gap: 15px; align-items: center;">
                <div style="background: var(--panel-2); min-width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div style="overflow: hidden;">
                    <div style="display:flex; align-items:center;">
                        <h4 style="font-size:0.95rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${doc.title}</h4>
                        ${statusBadge}
                    </div>
                    <p style="font-size:0.8rem; color:var(--muted);">${doc.type} • ${doc.date}</p>
                </div>
            </div>
            <div class="col-sent mobile-hide">${sender}</div>
            <div class="col-ssc mobile-hide">${sscHtml}</div>
            <div class="col-osa mobile-hide">${osaHtml}</div>
            <div class="col-status">${actionButtons}</div>
        </div>`;
    }).join('');
}

// Renders the Sidebar Recent List
function renderRecentDocs() {
    const list = document.getElementById('recent-docs-list');
    if (!list) return;
    const recentItems = docsData.slice(0, 3);
    list.innerHTML = recentItems.map(doc => `
        <div class="recent-item">
            <div class="recent-icon"><i class="fa-solid fa-file-contract"></i></div>
            <div class="recent-info">
                <h5>${doc.title}</h5>
                <span>${doc.date} • ${doc.status}</span>
            </div>
        </div>
    `).join('');
}

// Helper: Format Date
function formatDateForComparison(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1), day = '' + d.getDate(), year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

// Reset Filters
function resetDateFilters() {
    document.getElementById('filter-by-date').value = '';
    document.getElementById('filter-by-month').value = '';
    renderDocs(currentDocFilter);
}

// Modal & Submit Handlers
function filterDocs(filter, btn) { renderDocs(filter, btn); }

function openSubmitModal() {
    document.getElementById('submit-doc-modal').classList.add('show');
}
function closeSubmitModal() {
    document.getElementById('submit-doc-modal').classList.remove('show');
}
function handleDocSubmit(e) {
    e.preventDefault();
    const recipient = document.getElementById('doc-recipient').value;
    const title = e.currentTarget.querySelector('input[type="text"]').value;
    const type = document.getElementById('doc-type').value;

    docsData.unshift({ title: title, type: type, date: "Just now", status: `Sent to ${recipient}` });

    // Refresh
    renderDocs('All', document.querySelector('.repo-filters .filter-tab:first-child'));
    renderRecentDocs();
    closeSubmitModal();
    showToast(`Document sent to ${recipient}`, 'success');
}

function formatShortDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = transactions.map((t, index) => `
        <tr>
            <td>${t.org}</td>
            <td>${t.sender}</td>
            <td>${t.doc}</td>
            <td>${t.date}</td>
            <td><span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openPdfViewer('${t.id || 'doc_' + index}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

// --- ACTIONS ---

function openMonitoring(orgId) {
    currentOrgId = orgId;
    const org = organizations.find(o => o.id === orgId);
    if (org) {
        document.getElementById('monitoring-org-name').innerText = org.name;
        document.getElementById('monitoring-org-details').innerText = `${org.category} • President: ${org.president}`;

        // Mock event history for this org
        const eventTable = document.getElementById('monitoring-events-table');
        eventTable.innerHTML = `
            <tr>
                <td>${org.category} General Assembly</td>
                <td>Aug 15, 2023</td>
                <td>98%</td>
                <td><span class="status-badge status-approved">Completed</span></td>
            </tr>
            <tr>
                <td>Semester Planning</td>
                <td>Sep 01, 2023</td>
                <td>100%</td>
                <td><span class="status-badge status-approved">Completed</span></td>
            </tr>
        `;
    }
    navigate('monitoring');
}

function handleRequest(id, action) {
    // Store the pending action and show confirmation modal
    pendingRequestAction = { id, action };
    showRequestActionModal(action);
}

function showRequestActionModal(action) {
    const modal = document.getElementById('request-action-modal');
    const title = document.getElementById('request-action-title');
    const message = document.getElementById('request-action-message');
    const instruction = document.getElementById('request-action-instruction');
    const keyword = document.getElementById('request-action-keyword');
    const input = document.getElementById('request-action-input');
    const confirmBtn = document.getElementById('request-action-confirm-btn');

    // Customize modal based on action
    if (action === 'Approved') {
        title.innerText = 'Approve Request';
        message.innerText = 'Are you sure you want to approve this request? This action cannot be undone.';
        keyword.innerText = '"Approve"';
        confirmBtn.className = 'btn btn-success';
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Approve Request';
    } else if (action === 'Rejected') {
        title.innerText = 'Reject Request';
        message.innerText = 'Are you sure you want to reject this request? This action cannot be undone.';
        keyword.innerText = '"Reject"';
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Reject Request';
    }

    instruction.innerHTML = `Type <strong id="request-action-keyword">${keyword.innerText}</strong> to confirm:`;
    input.value = '';
    modal.classList.add('active');
    input.focus();
}

function closeRequestActionModal() {
    const modal = document.getElementById('request-action-modal');
    const input = document.getElementById('request-action-input');
    modal.classList.remove('active');
    input.value = '';
    pendingRequestAction = null;
}

function confirmRequestAction() {
    if (!pendingRequestAction) return;

    const input = document.getElementById('request-action-input');
    // Determine expected keyword (Approve/Reject) from the action (Approved/Rejected)
    const expectedKeyword = pendingRequestAction.action === 'Approved' ? 'Approve' : 'Reject';
    const userInput = input.value.trim();

    // Validate input (case-insensitive)
    if (userInput.toLowerCase() !== expectedKeyword.toLowerCase()) {
        showToast(`Please type "${expectedKeyword}" to confirm`, 'error');
        input.focus();
        return;
    }

    // Process the action
    const { id, action } = pendingRequestAction;
    const index = requests.findIndex(r => r.id === id);
    if (index > -1) {
        const req = requests[index];
        req.status = action;
        showToast(`Request "${req.title}" has been ${action}`, action === 'Approved' ? 'success' : 'error');
        renderRequests();
    }

    closeRequestActionModal();
}

// --- DATE PICKER CALENDAR FUNCTIONS ---
function openDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    modal.classList.add('active');
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function closeDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    modal.classList.remove('active');
}

function renderCalendar(month, year) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calendar-month-label').innerText = `${monthNames[month]} ${year}`;

    const datesContainer = document.getElementById('calendar-dates');
    datesContainer.innerHTML = '';

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date other-month';
        dateDiv.innerText = day;
        datesContainer.appendChild(dateDiv);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);

        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date';
        dateDiv.innerText = day;

        // Mark today
        if (date.getTime() === today.getTime()) {
            dateDiv.classList.add('today');
        }

        // Mark selected dates
        if (selectedFromDate && date.getTime() === selectedFromDate.getTime()) {
            dateDiv.classList.add('selected');
        }
        if (selectedToDate && date.getTime() === selectedToDate.getTime()) {
            dateDiv.classList.add('selected');
        }

        // Mark dates in range
        if (selectedFromDate && selectedToDate &&
            date > selectedFromDate && date < selectedToDate) {
            dateDiv.classList.add('in-range');
        }

        dateDiv.onclick = () => selectDate(date);
        datesContainer.appendChild(dateDiv);
    }

    // Next month days to fill grid
    const totalCells = datesContainer.children.length;
    const remainingCells = 42 - totalCells; // 6 rows x 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date other-month';
        dateDiv.innerText = day;
        datesContainer.appendChild(dateDiv);
    }
}

function selectDate(date) {
    if (!selectedFromDate || (selectedFromDate && selectedToDate)) {
        // Start new selection
        selectedFromDate = date;
        selectedToDate = null;
    } else {
        // Complete selection
        if (date < selectedFromDate) {
            selectedToDate = selectedFromDate;
            selectedFromDate = date;
        } else {
            selectedToDate = date;
        }
    }

    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function updateDateRangeDisplay() {
    const fromLabel = document.getElementById('selected-from-date');
    const toLabel = document.getElementById('selected-to-date');

    if (selectedFromDate) {
        fromLabel.innerText = selectedFromDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } else {
        fromLabel.innerText = 'Not selected';
    }

    if (selectedToDate) {
        toLabel.innerText = selectedToDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } else {
        toLabel.innerText = 'Not selected';
    }
}

function changeCalendarMonth(offset) {
    calendarCurrentMonth += offset;

    if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    } else if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    }

    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function clearDateRange() {
    selectedFromDate = null;
    selectedToDate = null;
    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function applyDateRange() {
    if (selectedFromDate && selectedToDate) {
        const dateBtn = document.querySelector('.date-range-btn');
        const label = document.getElementById('date-range-label');

        const fromStr = selectedFromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const toStr = selectedToDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        label.innerText = `${fromStr} - ${toStr}`;
        dateBtn.classList.add('active');

        renderRequests();
        closeDatePicker();
        showToast('Date filter applied', 'success');
    } else {
        showToast('Please select both start and end dates', 'error');
    }
}

function clearRequestFilters() {
    // Reset all filters
    document.getElementById('req-type-filter').value = 'all';
    document.getElementById('req-org-filter').value = 'all';

    // Clear date range
    selectedFromDate = null;
    selectedToDate = null;
    const dateBtn = document.querySelector('.date-range-btn');
    const label = document.getElementById('date-range-label');
    label.innerText = 'Select Date Range';
    dateBtn.classList.remove('active');

    // Re-render
    renderRequests();
    showToast('Filters cleared', 'success');
}

// function filterRequests() {} // Removed as it is replaced by renderRequests internal logic


// --- UTILS ---
function setDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', options);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid ${icon} ${type}"></i>
            <span>${message}</span>
        </div>
        <i class="fa-solid fa-xmark" style="cursor:pointer; opacity:0.5;" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderOrgs();
    renderRequests();
    renderDocs();
    renderRecentDocs();
    renderTransactions();
    initReqOrgFilter();

    // NEW FUNCTION CALL
    renderDashboardPreview();
    renderRecentActivities();
    // Add Enter key listener for confirmation modal
    const actionInput = document.getElementById('request-action-input');
    if (actionInput) {
        actionInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                confirmRequestAction();
            }
        });
    }
});

document.addEventListener('pdfviewer:ready', () => {
    // syncPdfUploadsIntoTransactions(); // Removed as we use docsData now
    renderTransactions();
});
