const AUTH_SESSION_KEY = 'naapAuthSession';

function readAuthSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function initOsaAuthContext() {
    const session = readAuthSession();
    const isOsaSession = session && (session.login_role === 'osa' || session.account_type === 'osa_staff') && session.user_id;
    if (!isOsaSession) {
        window.location.href = '../pages/login.html';
        return;
    }

    const fullName = session.display_name || 'OSA Staff';
    const roleLabel = session.active_role_name || 'osa_staff';

    const headerName = document.querySelector('.user-info span');
    const headerRole = document.querySelector('.user-info small');
    if (headerName) headerName.innerText = fullName;
    if (headerRole) headerRole.innerText = String(roleLabel).replace('_', ' ').toUpperCase();

    const profileName = document.querySelector('.profile-name');
    const profileRole = document.querySelector('.profile-role');
    if (profileName) profileName.innerText = fullName;
    if (profileRole) profileRole.innerText = String(roleLabel).replace('_', ' ').toUpperCase();
}

const DOCUMENTS_API_BASE = '../api/documents';

function fmtDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function resolvePdfUrl(fileUrl) {
    if (!fileUrl) return '';
    let raw = String(fileUrl).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('./')) raw = raw.slice(2);
    if (raw.startsWith('../')) raw = raw.slice(3);
    if (!raw.includes('/')) raw = `uploads/documents/${raw}`;
    if (raw.startsWith('documents/')) raw = `uploads/${raw}`;
    if (!raw.startsWith('uploads/')) raw = `uploads/documents/${raw.replace(/^uploads?\/?/i, '')}`;
    return `../${raw}`;
}

async function loadDocsFromApi() {
    try {
        const params = new URLSearchParams({ status: 'all' });
        const response = await fetch(`${DOCUMENTS_API_BASE}/list.php?${params.toString()}`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data.ok) return;
        docsData = (data.items || []).map(item => ({
            id: item.submission_id,
            submission_id: item.submission_id,
            title: item.title,
            type: item.document_type,
            org: item.org_name || '',
            status: item.status || 'pending',
            date: fmtDateShort(item.submitted_at),
            submittedAt: item.submitted_at || null,
            fileUrl: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`
        }));
        docsData.forEach(doc => {
            if (typeof PDFViewer !== 'undefined' && doc.fileUrl) {
                PDFViewer.registerRemote(doc.viewerId, doc.title, doc.fileUrl, { submissionId: doc.submission_id });
            }
        });
        renderDocs(currentDocFilter);
        renderRecentDocs();
    } catch (error) {
        console.error('loadDocsFromApi failed', error);
    }
}

async function loadRepoFromApi() {
    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/repository.php`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data.ok) return;
        repositoryData = (data.items || []).map(item => ({
            id: item.repo_id,
            submission_id: item.submission_id,
            name: item.title,
            category: item.document_type,
            org: item.org_name || '',
            date: fmtDateShort(item.approved_at),
            approvedAt: item.approved_at || null,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            file_url: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`
        }));
        repositoryData.forEach(item => {
            if (typeof PDFViewer !== 'undefined' && item.file_url) {
                PDFViewer.registerRemote(item.viewerId, item.name, item.file_url, { submissionId: item.submission_id });
            }
        });
        updateRepoCategoryDropdown();
        renderRepoTable();
    } catch (error) {
        console.error('loadRepoFromApi failed', error);
    }
}

async function submitReviewDecision(submissionId, decision, notes = '') {
    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/review.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                submission_id: submissionId,
                decision,
                notes
            })
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to review document.');
        }
        await Promise.all([loadDocsFromApi(), loadRepoFromApi()]);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Failed to review document.');
    }
}

function reviewDocument(submissionId, decision) {
    if (String(decision).toLowerCase() === 'approved') {
        openApproveCommentModal(submissionId);
        return;
    }
    submitReviewDecision(submissionId, decision, '');
}

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
        localStorage.removeItem(AUTH_SESSION_KEY);
        setTimeout(() => {
            window.location.href = '../pages/login.html'; // Change to your login page
        }, 1000);
    }
}

// Initialize Theme on Load
document.addEventListener('DOMContentLoaded', () => {
    initOsaAuthContext();

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

let docsData = [];

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
        'documents': 'Document Repository',
        'account': 'Account Management',
        'profile': 'My Profile' // <-- Add this line
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'OSA Portal';
}

// --- RENDER FUNCTIONS ---
function renderOrgs() {
    const tbody = document.getElementById('org-list-body');
    if (!tbody) return;
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

let serviceAuthorizationMatrix = { service_catalog: [], organizations: [] };
let serviceAuthorizationPromise = null;

async function loadServiceAuthorizations(force = false) {
    if (serviceAuthorizationPromise && !force) {
        return serviceAuthorizationPromise;
    }

    serviceAuthorizationPromise = fetch('../api/services/osa/list.php', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then((resp) => resp.json().catch(() => ({})).then((data) => ({ resp, data })))
        .then(({ resp, data }) => {
            if (!resp.ok || !data.ok) {
                throw new Error(data.error || 'Could not load service authorizations.');
            }
            serviceAuthorizationMatrix = {
                service_catalog: Array.isArray(data.service_catalog) ? data.service_catalog : [],
                organizations: Array.isArray(data.organizations) ? data.organizations : [],
            };
            return serviceAuthorizationMatrix;
        })
        .catch((error) => {
            serviceAuthorizationMatrix = { service_catalog: [], organizations: [] };
            throw error;
        });

    return serviceAuthorizationPromise;
}

function getServiceAuthorizationOrg(orgId) {
    return (serviceAuthorizationMatrix.organizations || []).find(org => Number(org.org_id) === Number(orgId)) || null;
}

function renderMonitoringServiceAuthorizations(orgId) {
    const container = document.getElementById('monitoring-service-toggles');
    if (!container) return;

    const org = getServiceAuthorizationOrg(orgId);
    const services = Array.isArray(serviceAuthorizationMatrix.service_catalog)
        ? serviceAuthorizationMatrix.service_catalog
        : [];

    if (!org || !services.length) {
        container.innerHTML = `<div style="color: var(--muted); font-size: 0.9rem;">Service authorizations are not available right now.</div>`;
        return;
    }

    container.innerHTML = services.map((service) => {
        const checked = !!(org.services || {})[service.service_key];
        const isPrinting = service.service_key === 'printing';
        return `
            <label class="service-toggle-item">
                <div>
                    <strong>${service.service_name}</strong>
                    <div style="color: var(--muted); font-size: 0.82rem; margin-top: 4px;">
                        ${isPrinting
                            ? (service.description || '')
                            : 'Available for active organizations by default.'}
                    </div>
                </div>
                <input type="checkbox"
                       class="service-toggle-checkbox"
                       data-service-key="${service.service_key}"
                       ${checked ? 'checked' : ''}
                       ${isPrinting ? '' : 'disabled'}>
            </label>
        `;
    }).join('');
}

async function saveMonitoringServiceAuthorizations() {
    if (!currentOrgId) {
        return;
    }

    const inputs = document.querySelectorAll('#monitoring-service-toggles .service-toggle-checkbox');
    const services = {};
    inputs.forEach((input) => {
        services[input.dataset.serviceKey] = !!input.checked;
    });

    try {
        const response = await fetch('../api/services/osa/save.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                org_id: currentOrgId,
                services,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not save organization service access.');
        }
        await loadServiceAuthorizations(true);
        renderMonitoringServiceAuthorizations(currentOrgId);
        showToast('Organization service access updated.', 'success');
    } catch (error) {
        showToast(error.message || 'Could not save organization service access.', 'error');
    }
}

// --- REQUESTS & APPROVALS STATE ---
let currentReqStatus = 'all';
let pendingRequestAction = null; // Stores {id, action} for modal confirmation
let pendingApproveSubmissionId = null;

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
    if (!tbody) return;
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
        if (reqDateFilter.from && reqDateFilter.to) {
            const reqDate = new Date(req.date);
            matchesDate = reqDate >= reqDateFilter.from && reqDate <= reqDateFilter.to;
        }

        return matchesType && matchesOrg && matchesStatus && matchesDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--muted);">No requests found matching your criteria.</td></tr>`;
        return;
    }

    filtered.forEach(req => {
        let actionButtons = '';

        // New: View Button (Always available)
        // Uses the existing btn-outline class to differentiate from the main actions
        const viewBtn = `
            <button class="btn btn-sm btn-outline" onclick="openPdfViewer('req_doc_${req.id}')" title="View Document">
                <i class="fa-solid fa-eye"></i>
            </button>
        `;

        if (req.status === 'Pending') {
            // Added wrapper div .req-action-group for styling
            actionButtons = `
                <div class="req-action-group">
                    ${viewBtn}
                    <button class="btn btn-sm btn-success" onclick="handleRequest(${req.id}, 'Approved')" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="handleRequest(${req.id}, 'Rejected')" title="Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        } else {
            // For completed items, show status badge + view button
            actionButtons = `
                <div class="req-action-group">
                    ${viewBtn}
                    <span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span>
                </div>
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

// Initialize Organization filter for Documents
function initDocOrgFilter() {
    const orgSelect = document.getElementById('filter-by-org');
    if (!orgSelect) return;

    // Clear existing except "All"
    orgSelect.innerHTML = '<option value="all">All Organizations</option>';

    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

// --- PORTED DOCUMENT LOGIC ---
let currentDocFilter = 'All';

function renderRecentDocs() {
    const list = document.getElementById('recent-docs-list');
    if (!list) return;

    const recentItems = docsData.slice(0, 5);

    list.innerHTML = recentItems.map((doc, index) => {
        let statusText = '';
        let statusClass = '';

        // Mapping statuses to specific requirements: Approved, Rejected, For Revision
        const status = String(doc.status || '').toLowerCase();
        if (status === 'approved') {
            statusText = 'Approved';
            statusClass = 'status-approved';
        } else if (status === 'rejected') {
            statusText = 'Rejected';
            statusClass = 'status-rejected';
        } else {
            statusText = 'Pending Review';
            statusClass = 'status-pending';
        }

        const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];
        const sender = senders[doc.title.length % senders.length];

        return `
            <div class="recent-activity-item">
                <div class="recent-activity-content">
                    <div class="recent-icon">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div class="recent-info">
                        <h5>${doc.title}</h5>
                        <p>Sent by: <strong>${sender}</strong></p>
                        <span class="status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
                <div class="recent-activity-actions">
                    <button class="btn btn-primary btn-sm icon-only-btn" onclick="openPdfViewer('${doc.viewerId || ('doc_' + index)}')" title="View Document">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderDocs(filter = 'All', btnElement = null) {
    currentDocFilter = filter;

    // Update active tab state
    if (btnElement) {
        const buttons = document.querySelectorAll('.repo-filters .filter-tab');
        buttons.forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    } else if (filter === 'All') {
        const firstTab = document.querySelector('.repo-filters .filter-tab');
        if (firstTab) firstTab.classList.add('active');
    }

    const list = document.getElementById('docs-list');
    if (!list) return;

    const dateVal = document.getElementById('filter-by-date')?.value || '';
    const monthVal = document.getElementById('filter-by-month')?.value || '';
    const orgVal = document.getElementById('filter-by-org')?.value || 'all';

    // DATA SIMULATION POOLS
    const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];

    // Filter Logic
    let filteredData = docsData.filter(doc => {
        const statusText = String(doc.status || '').toLowerCase();

        // 1. Status Filter
        const matchesStatus = (filter === 'All') ||
            (filter === 'Pending' && statusText === 'pending') ||
            (filter === 'Approved' && statusText === 'approved') ||
            (filter === 'Rejected' && statusText === 'rejected');

        // 2. Organization Filter
        const matchesOrg = (orgVal === 'all') || (doc.org === orgVal);
        // 3. Date/Month Filter
        let matchesDate = true;
        let docDateObj;

        docDateObj = doc.submittedAt ? new Date(doc.submittedAt) : new Date(`${doc.date}, 2026`);

        if (docsDateFilter.from && docsDateFilter.to) {
            const fromDate = new Date(docsDateFilter.from);
            const toDate = new Date(docsDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
            matchesDate = docDateObj >= fromDate && docDateObj <= toDate;
        }

        return matchesStatus && matchesOrg && matchesDate;
    });

    if (filteredData.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted); grid-column: 1/-1;">No documents match these filters.</div>`;
        return;
    }

    list.innerHTML = filteredData.map((doc, index) => {
        let statusBadge = '';
        let actionButtons = `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId || ('doc_' + index)}')">
                <i class="fa-solid fa-eye"></i> View
            </button>`;

        const statusText = String(doc.status || '').toLowerCase();
        if (statusText === 'approved') {
            statusBadge = '<span class="status-badge status-completed" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Approved</span>';
        } else if (statusText === 'rejected') {
            statusBadge = '<span class="status-badge status-rejected" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Rejected</span>';
        } else {
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Pending</span>';
            actionButtons += `
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); reviewDocument(${doc.id}, 'approved')">
                    Approve
                </button>
                <button class="btn btn-sm btn-outline" style="color:#dc2626; border-color:#dc2626;" onclick="event.stopPropagation(); reviewDocument(${doc.id}, 'rejected')">
                    Reject
                </button>`;
        }

        const sender = senders[doc.title.length % senders.length];

        return `
        <div class="list-item" onclick="openPdfViewer('${doc.viewerId || ('doc_' + index)}')">
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
            <div class="col-ssc mobile-hide">${doc.org || 'N/A'}</div>
            <div class="col-osa mobile-hide">OSA Internal</div>
            <div class="col-status">
                <div class="action-btn-group">
                    ${actionButtons}
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterDocs(filter, btnElement) {
    renderDocs(filter, btnElement);
}

function resetDateFilters() {
    const orgInput = document.getElementById('filter-by-org');
    if (orgInput) orgInput.value = 'all';

    // Reset Docs Date Filter
    docsDateFilter.from = null;
    docsDateFilter.to = null;

    // Reset UI
    const dateBtn = document.querySelector('#docs-status-view .date-range-btn');
    const label = document.getElementById('docs-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    renderDocs(currentDocFilter);
}




function submitToOSA(index) {
    if (confirm('Submit this approved document to OSA for final review?')) {
        if (docsData[index]) {
            docsData[index].status = "Sent to OSA";
            renderDocs(currentDocFilter);
            alert('Document sent to OSA successfully!');
        }
    }
}

function formatShortDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function syncPdfUploadsIntoTransactions() {
    if (!window.PDFViewer || typeof PDFViewer.getUploadsMeta !== 'function') return;

    const uploads = PDFViewer.getUploadsMeta();
    uploads.forEach(upload => {
        const exists = transactions.some(t => t.id === upload.id);
        if (!exists) {
            transactions.unshift({
                id: upload.id,
                org: 'Current User',
                sender: 'Me',
                doc: upload.name,
                date: formatShortDate(upload.uploadDate),
                status: 'Pending'
            });
        }
    });
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
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
        // 1. Basic Info
        document.getElementById('monitoring-org-name').innerText = org.name;
        document.getElementById('monitoring-org-details').innerText = `${org.category} • ID: ${org.id}`;

        // 2. Activity Recency (Simulated logic based on ID)
        const activityDates = ["Oct 24, 2023", "Oct 20, 2023", "Just now", "Yesterday"];
        document.getElementById('monitoring-recency').innerText = `Last recorded activity: ${activityDates[org.id % activityDates.length]}`;

        // 3. Render Compliance Overview
        const complianceContainer = document.getElementById('monitoring-compliance-list');
        // Simulating status based on org ID for variety
        const isCompliant = org.id % 2 === 0;

        complianceContainer.innerHTML = `
            <div class="compliance-item">
                <span class="compliance-label">Financial Report</span>
                <span class="status-badge ${isCompliant ? 'status-completed' : 'status-pending'}">
                    ${isCompliant ? 'Submitted' : 'Pending'}
                </span>
            </div>
            <div class="compliance-item">
                <span class="compliance-label">Activity Reports</span>
                <span class="status-badge ${isCompliant ? 'status-completed' : 'status-pending'}">
                    ${isCompliant ? 'Complete' : 'Incomplete'}
                </span>
            </div>
            <div class="compliance-item">
                <span class="compliance-label">Audit Status</span>
                <span class="status-badge ${isCompliant ? 'status-completed' : 'status-pending'}">
                    ${isCompliant ? 'Passed' : 'Pending'}
                </span>
            </div>
        `;

        // 4. Render Officers & Adviser List
        const officersContainer = document.getElementById('monitoring-officers-grid');

        // Define the required roles
        const roles = [
            "President", "Vice President (Internal)", "Vice President (External)",
            "Secretary", "Treasurer", "Auditor",
            "Business Manager", "Public Information Officer", "Peace Officer",
            "4th Year Rep", "3rd Year Rep", "2nd Year Rep", "1st Year Rep",
            "Faculty Adviser"
        ];

        // Generate mock names (some TBD for realism)
        let officersHTML = '';
        roles.forEach((role, index) => {
            // Simulate some missing officers (TBD)
            let name = "Student Name";
            if (role === "Faculty Adviser") name = "Prof. Adviser Name";
            if (index > 8 && org.id % 3 === 0) name = "TBD"; // Randomly unassigned reps

            // Special styling for TBD
            const nameStyle = name === "TBD" ? 'color: var(--muted); font-style: italic;' : '';

            officersHTML += `
                <div class="officer-card">
                    <span class="officer-role">${role}</span>
                    <div class="officer-name" style="${nameStyle}">${name}</div>
                </div>
            `;
        });
        officersContainer.innerHTML = officersHTML;

        // 5. Event History (Keep existing mock logic)
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
    renderMonitoringServiceAuthorizations(orgId);
    loadServiceAuthorizations().then(() => {
        renderMonitoringServiceAuthorizations(orgId);
    }).catch((error) => {
        console.error(error);
        renderMonitoringServiceAuthorizations(orgId);
    });
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

function openApproveCommentModal(submissionId) {
    const modal = document.getElementById('approve-comment-modal');
    const textarea = document.getElementById('approve-comment-text');
    if (!modal || !textarea) return;
    pendingApproveSubmissionId = Number(submissionId) || null;
    textarea.value = '';
    modal.classList.add('active');
    textarea.focus();
}

function closeApproveCommentModal() {
    const modal = document.getElementById('approve-comment-modal');
    const textarea = document.getElementById('approve-comment-text');
    if (modal) modal.classList.remove('active');
    if (textarea) textarea.value = '';
    pendingApproveSubmissionId = null;
}

async function confirmApproveWithComment() {
    if (!pendingApproveSubmissionId) return;
    const textarea = document.getElementById('approve-comment-text');
    const notes = (textarea?.value || '').trim();
    const submissionId = pendingApproveSubmissionId;
    closeApproveCommentModal();
    await submitReviewDecision(submissionId, 'approved', notes);
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
// Context-Aware Date Picker Logic
let currentDateContext = 'requests'; // 'requests', 'docs', or 'repo'

// Independent Date Filter States
const reqDateFilter = { from: null, to: null };
const docsDateFilter = { from: null, to: null };
const repoDateFilter = { from: null, to: null };

function openDatePicker(context = 'requests') {
    currentDateContext = context;
    const modal = document.getElementById('date-picker-modal');
    modal.classList.add('active');

    // Load existing state for the context
    if (context === 'requests') {
        selectedFromDate = reqDateFilter.from;
        selectedToDate = reqDateFilter.to;
    } else if (context === 'docs') {
        selectedFromDate = docsDateFilter.from;
        selectedToDate = docsDateFilter.to;
    } else if (context === 'repo') {
        selectedFromDate = repoDateFilter.from;
        selectedToDate = repoDateFilter.to;
    }

    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function closeDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    modal.classList.remove('active');
    // We don't clear selected dates here because they might be pending application or cancellation
    // But to be safe, if cancelled, we should probably reset internal state to saved state?
    // For simplicity, we just close. Next open will re-load from saved state.
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
        const fromStr = selectedFromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const toStr = selectedToDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const labelText = `${fromStr} - ${toStr}`;

        if (currentDateContext === 'requests') {
            reqDateFilter.from = selectedFromDate;
            reqDateFilter.to = selectedToDate;

            const dateBtn = document.querySelector('.requests-filter-bar .date-range-btn');
            const label = document.getElementById('date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderRequests();
        } else if (currentDateContext === 'docs') {
            docsDateFilter.from = selectedFromDate;
            docsDateFilter.to = selectedToDate;

            const dateBtn = document.querySelector('#docs-status-view .date-range-btn');
            const label = document.getElementById('docs-date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderDocs(currentDocFilter);
        } else if (currentDateContext === 'repo') {
            repoDateFilter.from = selectedFromDate;
            repoDateFilter.to = selectedToDate;

            const dateBtn = document.querySelector('#docs-repository-view .date-range-btn');
            const label = document.getElementById('repo-date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderRepoTable();
        }

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

    // Clear date range state for requests
    reqDateFilter.from = null;
    reqDateFilter.to = null;

    // Clear global selection if we are in requests context (which we are if clicking this button)
    if (currentDateContext === 'requests') {
        selectedFromDate = null;
        selectedToDate = null;
    }

    const dateBtn = document.querySelector('.requests-filter-bar .date-range-btn');
    const label = document.getElementById('date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

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
    resetDateFilters(); // Reset date filters on load

    // Initialize Dashboard
    renderRecentActivities();
    renderDashboardPreview();

    // Initialize Documents Logic
    initDocOrgFilter(); // Initialize document organization filter
    renderDocs();
    renderRecentDocs();
    loadDocsFromApi();

    // Initialize Requests
    initReqOrgFilter();
    renderRequests();
    renderOrgs();
    loadServiceAuthorizations().catch((error) => console.error(error));

    // Initialize Date Picker defaults
    const today = new Date();
    document.getElementById('calendar-month-label').innerText =
        `${today.toLocaleString('default', { month: 'long' })} ${today.getFullYear()}`;
    renderCalendar(today.getMonth(), today.getFullYear());

    // Initialize Transactions
    renderTransactions();
    loadRepoFromApi();

    // Add Enter key listener for confirmation modal
    const actionInput = document.getElementById('request-action-input');
    if (actionInput) {
        actionInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                confirmRequestAction();
            }
        });
    }

    const approveCommentInput = document.getElementById('approve-comment-text');
    if (approveCommentInput) {
        approveCommentInput.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                confirmApproveWithComment();
            }
        });
    }
});

document.addEventListener('pdfviewer:ready', () => {
    syncPdfUploadsIntoTransactions();
    renderTransactions();
});

window.addEventListener('click', function (event) {
    const modal = document.getElementById('approve-comment-modal');
    if (modal && event.target === modal) {
        closeApproveCommentModal();
    }
});

// --- DOCUMENT REPOSITORY LOGIC ---

// --- UPDATED REPOSITORY LOGIC ---

let repositoryData = [];

let currentRepoCategory = 'All';

// --- UPDATED REPOSITORY LOGIC ---

// 1. Initialize Repository
function initRepository() {
    initRepoOrgFilter();
    updateRepoCategoryDropdown(); // Calculates counts and updates Dropdown text
    renderRepoTable();
}

// 2. Populate Organization Dropdown
function initRepoOrgFilter() {
    const orgSelect = document.getElementById('repo-filter-org');
    if (!orgSelect) return;

    // Check if we need to repopulate (avoid duplicates if already populated)
    if (orgSelect.options.length > 1) return;

    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

// 3. Update File Type Dropdown with Counts
function updateRepoCategoryDropdown() {
    const typeSelect = document.getElementById('repo-filter-type');
    if (!typeSelect) return;

    const categories = [
        "Activity Report",
        "Financial Statement",
        "Event Proposal",
        "Resolution",
        "Operational Plan"
    ];

    // Calculate total
    const totalCount = repositoryData.length;

    // Update "All" option
    typeSelect.options[0].text = `All Types (${totalCount})`;

    // Update specific category options
    categories.forEach(cat => {
        const count = repositoryData.filter(item => item.category === cat).length;

        // Find the option with this value
        for (let i = 0; i < typeSelect.options.length; i++) {
            if (typeSelect.options[i].value === cat) {
                typeSelect.options[i].text = `${cat} (${count})`;
                break;
            }
        }
    });
}

// 4. Render Repository Table
function renderRepoTable() {
    const tbody = document.getElementById('repository-table-body');
    if (!tbody) return;

    // Get Filter Values
    const searchInput = document.getElementById('repo-search-input')?.value.toLowerCase() || '';
    const filterType = document.getElementById('repo-filter-type')?.value || 'All';
    const filterOrg = document.getElementById('repo-filter-org')?.value || 'all';
    const filterSem = document.getElementById('repo-filter-sem')?.value || 'all';

    // Filter Logic
    const filtered = repositoryData.filter(item => {
        // 1. File Type
        const matchesType = filterType === 'All' || item.category === filterType;

        // 2. Organization
        const matchesOrg = filterOrg === 'all' || item.org === filterOrg;

        // 3. Search Text
        const matchesSearch = item.name.toLowerCase().includes(searchInput) ||
            item.org.toLowerCase().includes(searchInput);

        // 4. Date Logic
        const itemDate = item.approvedAt ? new Date(item.approvedAt) : new Date(item.date);
        let matchesDate = true;

        if (repoDateFilter.from && repoDateFilter.to) {
            const fromDate = new Date(repoDateFilter.from);
            const toDate = new Date(repoDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
            matchesDate = itemDate >= fromDate && itemDate <= toDate;
        } else if (filterSem !== 'all') {
            matchesDate = (item.semester || '').toLowerCase() === filterSem.toLowerCase();
        }

        return matchesType && matchesOrg && matchesSearch && matchesDate;
    });

    // Update Header Label
    const label = document.getElementById('repo-current-view-label');
    if (label) label.innerText = filterType === 'All' ? 'All Documents' : filterType;

    // Render Rows
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--muted);">No documents match your filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>
                    <span style="font-weight:500;">${item.name}</span>
                </div>
            </td>
            <td><span class="repo-category-tag">${item.category}</span></td>
            <td>${item.org}</td>
            <td>${item.date}</td>
            <td class="text-right">
                <button class="btn btn-sm btn-outline" onclick="openPdfViewer('${item.viewerId || ('repo_' + item.id)}')">
                    <i class="fa-solid fa-download"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 5. Reset Function
function resetRepoFilters() {
    document.getElementById('repo-filter-type').value = 'All';
    document.getElementById('repo-filter-org').value = 'all';
    document.getElementById('repo-filter-sem').value = 'all';
    document.getElementById('repo-search-input').value = '';

    // Reset Date Filter
    repoDateFilter.from = null;
    repoDateFilter.to = null;

    const dateBtn = document.querySelector('#docs-repository-view .date-range-btn');
    const label = document.getElementById('repo-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    renderRepoTable();
    showToast('Filters reset', 'info');
}

// Hook initRepository into the switch view logic (Same as before, ensuring init is called)
function switchDocsSubView(view, btn) {
    const buttons = document.querySelectorAll('.sub-nav-btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const statusView = document.getElementById('docs-status-view');
    const repoView = document.getElementById('docs-repository-view');

    if (view === 'repository') {
        statusView.style.display = 'none';
        repoView.style.display = 'block';
        loadRepoFromApi();
        initRepository();
    } else {
        statusView.style.display = 'grid';
        repoView.style.display = 'none';
    }
}
