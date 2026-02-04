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
    { id: 101, type: "Event Proposal", org: "Computer Science Society", title: "Tech Summit 2023", date: "Oct 24, 2023", status: "Pending" },
    { id: 102, type: "Posting", org: "Student Council", title: "General Assembly Notice", date: "Oct 24, 2023", status: "Pending" },
    { id: 103, type: "Document", org: "Engineering Club", title: "Semestral Financial Report", date: "Oct 23, 2023", status: "Pending" },
    { id: 104, type: "Event Proposal", org: "Peer Facilitators", title: "Mental Health Week", date: "Oct 22, 2023", status: "Pending" }
];

const documents = [
    { name: "Constitution & By-Laws", org: "Computer Science Society", type: "Legal", status: "Approved" },
    { name: "Q1 Financial Report", org: "University Chorale", type: "Financial", status: "Archived" },
    { name: "List of Officers", org: "Engineering Club", type: "Admin", status: "Approved" }
];

const transactions = [
    { org: "Supreme Student Council", doc: "Budget Proposal Q4", date: "Oct 25, 2023", status: "Pending" },
    { org: "AISERS", doc: "Seminar Speaker Fee", date: "Oct 25, 2023", status: "Approved" },
    { org: "ELITECH", doc: "Hackathon Venue Receipt", date: "Oct 24, 2023", status: "Approved" },
    { org: "ILASSO", doc: "Outreach Permit", date: "Oct 24, 2023", status: "Rejected" },
    { org: "RCYC", doc: "Monthly Dues Report", date: "Oct 23, 2023", status: "Pending" },
    { org: "AETSO", doc: "Flight Simulation Log", date: "Oct 23, 2023", status: "Approved" }
];

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
        'verification': 'Student Verification'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'OSA Portal';
}

// --- RENDER FUNCTIONS ---
function renderOrgs() {
    const tbody = document.getElementById('org-list-body');
    tbody.innerHTML = organizations.map(org => `
        <tr>
            <td><strong>${org.name}</strong></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openMonitoring(${org.id})">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

function renderRequests(filter = 'all') {
    const tbody = document.getElementById('requests-table');
    const filtered = filter === 'all' ? requests : requests.filter(r => r.type.includes(filter));

    tbody.innerHTML = filtered.map(req => `
        <tr>
            <td><span class="status-badge status-submitted">${req.type}</span></td>
            <td>${req.org}</td>
            <td>${req.title}</td>
            <td>${req.date}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="handleRequest(${req.id}, 'Approved')"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="handleRequest(${req.id}, 'Rejected')"><i class="fa-solid fa-xmark"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderDocs() {
    const tbody = document.getElementById('docs-table');
    tbody.innerHTML = documents.map(doc => `
        <tr>
            <td>${doc.name}</td>
            <td>${doc.org}</td>
            <td>${doc.type}</td>
            <td><span class="status-badge status-${doc.status.toLowerCase()}">${doc.status}</span></td>
            <td><button class="btn btn-sm btn-outline"><i class="fa-solid fa-download"></i></button></td>
        </tr>
    `).join('');
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td>${t.org}</td>
            <td>${t.doc}</td>
            <td>${t.date}</td>
            <td><span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary">
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
    const index = requests.findIndex(r => r.id === id);
    if (index > -1) {
        const req = requests[index];
        showToast(`Request "${req.title}" has been ${action}`, action === 'Approved' ? 'success' : 'error');

        // Remove from pending list to simulate DB update
        requests.splice(index, 1);
        renderRequests(document.getElementById('request-filter').value);
    }
}

function filterRequests() {
    const filter = document.getElementById('request-filter').value;
    renderRequests(filter);
}

// --- VERIFICATION LOGIC ---
function verifyStudent() {
    const idInput = document.getElementById('verify-input').value;
    const nameInput = document.getElementById('verify-name').value;
    const resultArea = document.getElementById('verify-result-area');

    if (!idInput || !nameInput) {
        showToast('Please enter both ID and Name', 'error');
        return;
    }

    // Simulate Loading
    resultArea.innerHTML = `<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i><p style="margin-top:10px;">Checking Database...</p></div>`;

    setTimeout(() => {
        // Logic: Mock validation. If ID starts with 2023, assume enrolled.
        const isEnrolled = idInput.startsWith("2023") || idInput.startsWith("2022");

        if (isEnrolled) {
            resultArea.innerHTML = `
                <div class="verification-box" style="background: rgba(16, 185, 129, 0.1); border-color: #10b981; border-style: solid;">
                    <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: #059669; margin-bottom: 15px;"></i>
                    <h3 style="color: #059669;">Verified Enrolled</h3>
                    <p style="font-size: 0.9rem;"><strong>${nameInput}</strong></p>
                    <p style="font-size: 0.9rem;">ID: ${idInput}</p>
                    <div style="margin-top: 15px; font-size: 0.8rem; color: var(--muted);">
                        Course: BS Computer Science<br>
                        Year: 2nd Year<br>
                        Status: No Balances
                    </div>
                </div>
            `;
            showToast('Student verified successfully', 'success');
        } else {
            resultArea.innerHTML = `
                <div class="verification-box" style="background: rgba(239, 68, 68, 0.1); border-color: #ef4444; border-style: solid;">
                    <i class="fa-solid fa-circle-xmark" style="font-size: 3rem; color: #dc2626; margin-bottom: 15px;"></i>
                    <h3 style="color: #dc2626;">Not Enrolled / Not Found</h3>
                    <p style="font-size: 0.9rem;">Student record does not exist for current semester.</p>
                </div>
            `;
            showToast('Verification failed', 'error');
        }
    }, 1000); // 1 second simulated delay
}

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
    renderTransactions();
});