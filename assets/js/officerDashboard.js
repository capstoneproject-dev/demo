// --- DATA SIMULATION ---
const rentalsData = [
    { item: "Scientific Calculator", renter: "Juan Dela Cruz (2021-12345)", due: "Oct 25, 2023", status: "Borrowed" },
    { item: "Locker Unit 04", renter: "Maria Santos (2020-54321)", due: "Nov 30, 2023", status: "Rented" },
    { item: "T-Square", renter: "Pedro Reyes (2022-99999)", due: "Oct 20, 2023", status: "Overdue" },
    { item: "Crimping Tool", renter: "Anna Lee (2021-11111)", due: "Oct 26, 2023", status: "Borrowed" }
];

const docsData = [
    { title: "September Financial Statement", type: "Financial Statement", date: "Oct 05", status: "Approved" },
    { title: "Team Building Proposal", type: "Proposal", date: "Oct 18", status: "Sent to OSA" },
    { title: "Election Guidelines", type: "Document", date: "Oct 20", status: "Pending" },
    { title: "Constitution Amendment", type: "Legal", date: "Oct 24", status: "SSC Approved" }
];

let announcementsData = [
    { title: "General Assembly Tomorrow", date: "Just now", content: "Mandatory attendance for all members at Room 301." },
    { title: "Office Closure", date: "Yesterday", content: "Office will be closed due to University Holiday." }
];

// --- LOGOUT HANDLER ---
function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '../pages/login.html'; // Updated path per user code
    }
}

// --- THEME LOGIC ---
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

// Click handler for mobile button
function toggleThemeMobile() {
    switchThemeLogic();
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
});

// --- NAVIGATION LOGIC ---
function navigate(viewId, element) {
    // 1. Sidebar active state
    if (element) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        element.classList.add('active');
    } else {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(l => {
            if (l.getAttribute('onclick').includes(viewId)) l.classList.add('active');
            else l.classList.remove('active');
        });
    }

    // 2. Section visibility
    document.querySelectorAll('.section-view').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');

    // 3. Title & Header Update
    const titleEl = document.getElementById('page-title');
    const dateEl = document.getElementById('current-date');
    const mainHeaderTitle = document.querySelector('.header-title');

    // Ensure header is visible
    if (mainHeaderTitle) mainHeaderTitle.style.display = 'block';

    if (viewId === 'documents') {
        // Custom Header for Documents Repository
        if (titleEl) titleEl.innerText = 'Documents Repository';
        if (dateEl) dateEl.innerText = 'Manage and track all organizational document submissions.';
    } else {
        // Standard Header for other views
        const titleMap = {
            'dashboard': 'Dashboard',
            'tracker': 'Services Tracker',
            'analytics': 'Data Analytics',
            'announcements': 'Manage Announcements',
            'events': 'Events Management'
        };
        if (titleEl) titleEl.innerText = titleMap[viewId] || 'Org Manager';

        // Restore Date
        setDate();
    }

    // 4. Resize charts if Analytics tab is opened
    if (viewId === 'analytics') {
        window.dispatchEvent(new Event('resize'));
    }
}

// --- RENDER FUNCTIONS ---

function renderRentals() {
    // Dashboard preview (top 3)
    const dashTable = document.getElementById('dashboard-rentals-table');
    dashTable.innerHTML = rentalsData.slice(0, 3).map(item => {
        let badgeClass = item.status === 'Rented' ? 'status-borrowed' : (item.status === 'Overdue' ? 'status-overdue' : 'status-borrowed');
        return `
        <tr>
            <td>${item.item}</td>
            <td>${item.renter.split(' ')[0]}</td>
            <td>${item.due}</td>
            <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
        </tr>`;
    }).join('');
}

// --- MODAL FUNCTIONS ---

function openSubmitModal() {
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.add('show');
}

function closeSubmitModal() {
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.remove('show');
    // Optional: Reset form on close if desired
    // document.getElementById('doc-form').reset();
}

// Close modal when clicking outside content
window.addEventListener('click', function (event) {
    const modal = document.getElementById('submit-doc-modal');
    if (event.target === modal) {
        closeSubmitModal();
    }
});

// --- REPOSITORY & SUBMIT LOGIC ---

let currentDocFilter = 'All';

function renderRecentDocs() {
    const list = document.getElementById('recent-docs-list');
    if (!list) return;

    // Take only the first 3 items for the sidebar
    const recentItems = docsData.slice(0, 3);

    list.innerHTML = recentItems.map(doc => `
        <div class="recent-item">
            <div class="recent-icon">
                <i class="fa-solid fa-file-contract"></i>
            </div>
            <div class="recent-info">
                <h5>${doc.title}</h5>
                <span>${doc.date} • ${doc.status}</span>
            </div>
        </div>
    `).join('');
}

// --- UPDATED RENDERING LOGIC WITH DATE FILTERS ---

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
    const dateVal = document.getElementById('filter-by-date') ? document.getElementById('filter-by-date').value : '';
    const monthVal = document.getElementById('filter-by-month') ? document.getElementById('filter-by-month').value : '';

    // DATA SIMULATION POOLS
    const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];
    const sscOfficers = ["Pres. Cruz", "VP Santos", "Sec. Reyes"];
    const osaAdmins = ["Dir. Fury", "Mrs. Potts", "Admin Stark"];

    // 1. Filter by Status (Existing Logic)
    let filteredData = docsData.filter(doc => {
        if (filter === 'All') return true;
        if (filter === 'Pending') return doc.status.includes('Sent') || doc.status.includes('Pending') || doc.status === 'SSC Approved';
        return doc.status.includes(filter);
    });

    // 2. Filter by Date/Month (New Logic)
    if (dateVal || monthVal) {
        filteredData = filteredData.filter(doc => {
            // Convert simulated dates ("Oct 18") to a comparable object
            // Note: Since no year is in your simulation, we assume 2026 for comparison
            // "Just now" or "Yesterday" cases need handling ideally, but strictly following user logic for now or defaulting to current date
            let docDate;
            if (doc.date === "Just now") {
                docDate = new Date();
            } else if (doc.date === "Yesterday") {
                docDate = new Date();
                docDate.setDate(docDate.getDate() - 1);
            } else {
                docDate = new Date(`${doc.date}, 2026`);
            }

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
        // --- WORKFLOW LOGIC ---
        let sscHtml = '';
        let osaHtml = '';
        let actionButtons = '';
        let statusBadge = '';

        // Deterministic random names based on title length (keeps it consistent per render)
        const sender = senders[doc.title.length % senders.length];
        const sscOfficer = sscOfficers[doc.title.length % sscOfficers.length];
        const osaAdmin = osaAdmins[doc.title.length % osaAdmins.length];

        if (doc.status === 'Approved') {
            // Both Approved
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span>${osaAdmin}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>`;
            statusBadge = '<span class="status-badge status-completed" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Approved</span>';
        }
        else if (doc.status === 'SSC Approved') {
            // SSC Approved - User must Submit to OSA
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status waiting">Action Required</span>`;
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); submitToOSA(${index})">
                    Submit <i class="fa-solid fa-paper-plane"></i>
                </button>`;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Ready</span>';
        }
        else if (doc.status.includes('Sent to OSA')) {
            // SSC Approved, OSA Pending
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>`;
            statusBadge = '<span class="status-badge status-sent" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Sent to OSA</span>';
        }
        else if (doc.status.includes('Rejected')) {
            // Rejected by either SSC or OSA
            const rejectedBySSC = (doc.title.length % 2 === 0);
            if (rejectedBySSC) {
                sscHtml = `<span>${sscOfficer}</span><span class="sub-status rejected"><i class="fa-solid fa-xmark"></i> Rejected</span>`;
                osaHtml = `<span style="color:var(--muted)">--</span>`;
            } else {
                sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
                osaHtml = `<span>${osaAdmin}</span><span class="sub-status rejected"><i class="fa-solid fa-xmark"></i> Rejected</span>`;
            }
            actionButtons = `
                <button class="btn btn-outline btn-sm" style="color:#dc2626; border-color:#dc2626;" onclick="event.stopPropagation(); alert('Redirect to edit...')">
                    <i class="fa-solid fa-rotate-right"></i> Resubmit
                </button>`;
            statusBadge = '<span class="status-badge status-rejected" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Rejected</span>';
        }
        else {
            // Pending SSC
            sscHtml = `<span style="color:var(--muted)">--</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            osaHtml = `<span style="color:var(--muted)">--</span><span class="sub-status waiting">Waiting</span>`;
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('doc_${index}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>`;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Pending</span>';
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

            <div class="col-status">
                <div class="action-btn-group">
                    ${actionButtons}
                </div>
            </div>
        </div>`;
    }).join('');
}

// Helper: Clear filters
function resetDateFilters() {
    const dateInput = document.getElementById('filter-by-date');
    const monthInput = document.getElementById('filter-by-month');
    if (dateInput) dateInput.value = '';
    if (monthInput) monthInput.value = '';
    renderDocs(currentDocFilter);
}

// Helper: Format Date to YYYY-MM-DD
function formatDateForComparison(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
}

function filterDocs(filter, btnElement) {
    renderDocs(filter, btnElement);
}

function renderAnnouncements() {
    const feed = document.getElementById('announcement-feed');
    feed.innerHTML = announcementsData.map(ann => `
        <div class="announcement-card">
            <div class="announcement-meta">
                <strong>${ann.title}</strong>
                <span>${ann.date}</span>
            </div>
            <p style="font-size: 0.9rem;">${ann.content}</p>
        </div>
    `).join('');
}

// --- ACTIONS ---

function toggleNotifs() {
    document.getElementById('notif-dropdown').classList.toggle('show');
    // Close export if open
    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.remove('show');
}

function toggleExportMenu() {
    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.toggle('show');
    // Close notif if open
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifDropdown) notifDropdown.classList.remove('show');
}

// Close dropdown if clicked outside
window.onclick = function (event) {
    if (!event.target.closest('.notif-wrapper')) {
        var dropdowns = document.getElementsByClassName("notif-dropdown");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
    if (!event.target.closest('.export-wrapper')) {
        var exports = document.getElementsByClassName("export-dropdown");
        for (var i = 0; i < exports.length; i++) {
            if (exports[i].classList.contains('show')) {
                exports[i].classList.remove('show');
            }
        }
    }
}

function handleDocSubmit(e) {
    e.preventDefault();

    const recipient = document.getElementById('doc-recipient').value;
    const type = document.getElementById('doc-type').value;
    const title = e.currentTarget.querySelector('input[type="text"]').value;

    docsData.unshift({
        title: title,
        type: type,
        date: "Just now",
        status: `Sent to ${recipient}`
    });

    // Refresh list
    // If we are currently on "Rejected" or "Approved", switch to "All" or "Pending" to see new item
    const allBtn = document.querySelector('.repo-filters .filter-tab:first-child');
    renderDocs('All', allBtn);
    renderRecentDocs(); // Refresh the sidebar

    e.target.reset();
    closeSubmitModal();
    alert(`Document successfully sent to ${recipient}.`);
}

function postAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;
    const syncEvent = document.getElementById('sync-event').checked; // Get checkbox state

    // 1. Add to Local Dashboard Feed
    announcementsData.unshift({
        title: title,
        content: content,
        date: "Just now"
    });
    renderAnnouncements();

    // 2. CROSS-POSTING LOGIC
    if (syncEvent) {
        // Find the Events iframe
        const eventsFrame = document.querySelector('#events iframe');

        // Send message to the iframe
        if (eventsFrame && eventsFrame.contentWindow) {
            eventsFrame.contentWindow.postMessage({
                type: 'CREATE_EVENT',
                eventName: title,
                description: content,
                date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
            }, '*');

            alert(`Announcement Posted & Event "${title}" created in Attendance System!`);
        } else {
            alert("Announcement posted, but could not sync to Events tab (Frame not loaded).");
        }
    } else {
        alert("Announcement Posted!");
    }

    e.target.reset();
}

function returnItem(index) {
    const item = rentalsData[index];
    if (confirm(`Mark ${item.item} as returned by ${item.renter}?`)) {
        rentalsData.splice(index, 1);
        renderRentals(); // Re-render both tables
    }
}

function viewAllRentals() {
    // 1. Switch to the Services Tracker tab
    navigate('tracker');

    // 2. Find the iframe
    const trackerFrame = document.querySelector('#tracker iframe');

    if (trackerFrame) {
        // Smooth approach: Send a message to the iframe
        trackerFrame.contentWindow.postMessage({ action: 'scrollTo', target: 'rental-records' }, '*');
    }
}

function viewEventsList() {
    // 1. Switch to the Events tab
    navigate('events');

    // 2. Change the iframe source to the Events List page
    const eventsFrame = document.querySelector('#events iframe');
    if (eventsFrame) {
        eventsFrame.src = "../systems/QR-Attendance/events.html";
    }
}

// --- ANALYTICS FILTERING & CHART SYNC ---

function filterAnalyticsByDate() {
    const dateVal = document.getElementById('analytics-date').value;
    if (dateVal) {
        document.getElementById('filter-month').value = '';
        syncCharts(dateVal, 'day');
    }
}

function filterAnalyticsByMonth() {
    const monthVal = document.getElementById('filter-month').value;
    if (monthVal) {
        document.getElementById('analytics-date').value = '';
        syncCharts(monthVal, 'month');
    }
}

function resetAnalyticsFilters() {
    const dateInput = document.getElementById('analytics-date');
    const monthInput = document.getElementById('filter-month');
    if (dateInput) dateInput.value = '';
    if (monthInput) monthInput.value = '';
    syncCharts(null, 'all');
}

/**
 * Sends the selected filter to the Analytics logic.
 */
function syncCharts(value, type) {
    console.log(`Syncing charts for ${type}: ${value}`);

    // Update Stat Cards UI immediately
    const revenueDisplay = document.querySelector('.stat-card h3');
    if (revenueDisplay) {
        if (type === 'day') {
            revenueDisplay.innerText = "₱1,050"; // Simulated filtered value
        } else if (type === 'all') {
            revenueDisplay.innerText = "₱12.5k"; // Original value
        }
    }

    // Call the refresh function in officerAnalytics.js
    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts(value, type);
    }

    // Force chart container resize to prevent layout glitches
    window.dispatchEvent(new Event('resize'));
}

// --- EXPORT FUNCTIONS ---

function getReportMetadata() {
    const filterYear = document.getElementById('filter-year');
    const filterMonth = document.getElementById('filter-month');

    const year = filterYear ? filterYear.value : "Unknown Year";
    const monthInput = filterMonth ? filterMonth.value : "";

    let dateLabel = "All Time";
    if (monthInput) {
        const dateObj = new Date(monthInput + "-01");
        dateLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return { year, dateLabel, monthInput };
}

function exportCSV() {
    const meta = getReportMetadata();

    // 1. Define Data Structure
    const reportData = [
        ['ORGANIZATION MANAGEMENT REPORT'],
        ['Generated On', new Date().toLocaleString()],
        ['Period Covered', meta.dateLabel],
        ['Academic Year', meta.year],
        [],
        ['--- FINANCIAL & PARTICIPATION ---'],
        ['Metric', 'Value', 'Trend/Notes'],
        ['Total Revenue', '₱12,500', '+8.5% vs last month'],
        ['Avg Attendance', '150', 'High Retention'],
        ['Participation Growth', '+12%', 'Based on recent events'],
        [],
        ['--- INVENTORY UTILIZATION (Breakdown) ---'],
        ['Status', 'Count'],
        ['Active (Rented)', '14'],
        ['Pending Requests', '4'],
        ['Overdue/Damaged', '2'],
        [],
        ['--- DOCUMENT WORKFLOW (Breakdown) ---'],
        ['Status', 'Count'],
        ['Accepted', '15'],
        ['Pending Review', '2'],
        ['Rejected', '1'],
        [],
        ['--- RECENT RENTAL TRANSACTIONS ---'],
        ['Item', 'Borrower', 'Due Date', 'Status']
    ];

    // 2. Append Rentals Data
    rentalsData.forEach(item => {
        reportData.push([item.item, item.renter, item.due, item.status]);
    });

    // 3. Build CSV String
    let csvContent = "data:text/csv;charset=utf-8,";
    reportData.forEach(rowArray => {
        let row = rowArray.map(item => {
            let str = String(item);
            // Escape quotes and commas
            if (str.includes(',')) return `"${str}"`;
            return str;
        }).join(",");
        csvContent += row + "\r\n";
    });

    // 4. Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `OrgReport_Full_${meta.monthInput || 'Summary'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const meta = getReportMetadata();

    // -- HEADER --
    doc.setFontSize(18);
    doc.setTextColor(0, 33, 71); // Navy
    doc.text("Organization Management Report", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Period: ${meta.dateLabel} | A.Y. ${meta.year}`, 14, 34);

    // -- SECTION 1: KEY METRICS SUMMARY --
    doc.setDrawColor(200);
    doc.setFillColor(247, 249, 255);
    doc.rect(14, 40, 182, 18, 'F'); // Light Blue Box

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text("Financials & Growth", 20, 48);
    doc.setFont(undefined, 'normal');
    doc.text("Revenue: 12,500 (+8.5%)", 20, 54);

    doc.setFont(undefined, 'bold');
    doc.text("Participation", 100, 48);
    doc.setFont(undefined, 'normal');
    doc.text("Avg: 150 | Growth: +12%", 100, 54);

    // -- SECTION 2: DETAILED ANALYTICS (Inventory & Docs) --
    doc.setFontSize(12);
    doc.setTextColor(0, 33, 71);
    doc.text("Detailed Analytics Breakdown", 14, 70);

    // We use autoTable to create side-by-side tables for Inventory and Docs
    doc.autoTable({
        startY: 74,
        head: [['Inventory Status', 'Count', 'Document Status', 'Count']],
        body: [
            ['Active (Rented)', '14', 'Accepted', '15'],
            ['Pending Requests', '4', 'Pending', '2'],
            ['Overdue', '2', 'Rejected', '1'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 33, 71] },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
            0: { fontStyle: 'bold', width: 40 },
            1: { halign: 'center', width: 20 },
            2: { fontStyle: 'bold', width: 40 },
            3: { halign: 'center', width: 20 }
        }
    });

    // -- SECTION 3: RENTAL TRANSACTIONS --
    // Get the Y position where the previous table ended
    let finalY = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setTextColor(0, 33, 71);
    doc.text("Recent Rental Transactions", 14, finalY);

    const rentalBody = rentalsData.map(item => [item.item, item.renter, item.due, item.status]);

    doc.autoTable({
        startY: finalY + 4,
        head: [['Item', 'Borrower', 'Due Date', 'Status']],
        body: rentalBody,
        theme: 'striped',
        headStyles: { fillColor: [244, 208, 63], textColor: [0, 0, 0] }, // Gold Header
        styles: { fontSize: 9 }
    });

    // -- DOWNLOAD --
    doc.save(`OrgReport_Full_${meta.monthInput || 'Summary'}.pdf`);
}

// --- WORKFLOW ACTION: Submit to OSA ---
function submitToOSA(index) {
    if (confirm('Submit this approved document to OSA for final review?')) {
        // Update the document status
        if (docsData[index]) {
            docsData[index].status = "Sent to OSA";
            renderDocs(currentDocFilter); // Re-render
            alert('Document sent to OSA successfully!');
        }
    }
}



// --- UTILS ---
function setDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = new Date().toLocaleDateString('en-US', options);

    // Update Main Header Date
    const headerDate = document.getElementById('current-date');
    if (headerDate) headerDate.innerText = dateString;

    // Update Active Rentals Table Date
    const rentalDate = document.getElementById('rentals-date');
    if (rentalDate) rentalDate.innerText = dateString;

    // Update Active Rentals Stat Card Date
    const statDate = document.getElementById('rentals-stat-date');
    if (statDate) statDate.innerText = dateString;
}

// Attach sidebar theme event listener
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', switchThemeLogic);
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderRentals();
    renderDocs();
    renderRecentDocs();
    renderAnnouncements();
    // Initialize repository counts
    if (typeof updateFolderCounts === 'function') {
        updateFolderCounts();
    }
});


// --- DOCUMENT REPOSITORY LOGIC ---

// 1. Switch View Function (Status Board <-> Repository)
// 1. Switch View Function (Status Board <-> Repository)
function switchDocsSubView(view, btn) {
    // Toggle Button Active State
    const buttons = document.querySelectorAll('.sub-nav-btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle Container Visibility
    const statusView = document.getElementById('docs-status-view');
    const repoView = document.getElementById('docs-repository-view');

    if (view === 'repository') {
        statusView.style.display = 'none';
        repoView.style.display = 'block';
        initRepository(); // Recalculates counts and renders table
    } else {
        statusView.style.display = 'flex'; // Restore flex layout
        repoView.style.display = 'none';
    }
}

// 2. Mock Data for Repository
const repositoryData = [
    { id: 'r1', name: "Annual Activity Report 2023", category: "Activity Report", org: "Supreme Student Council", date: "Jan 10, 2024" },
    { id: 'r2', name: "Q4 Financial Statement", category: "Financial Statement", org: "AISERS", date: "Jan 15, 2024" },
    { id: 'r3', name: "Tech Week Proposal", category: "Event Proposal", org: "ELITECH", date: "Feb 01, 2024" },
    { id: 'r4', name: "Res. 2024-001: Budget Allocation", category: "Resolution", org: "SSC", date: "Jan 05, 2024" },
    { id: 'r5', name: "Semestral Operational Plan", category: "Operational Plan", org: "ILASSO", date: "Aug 12, 2023" },
    { id: 'r6', name: "Outreach Activity Report", category: "Activity Report", org: "RCYC", date: "Dec 20, 2023" },
    { id: 'r7', name: "Audit Report 2023", category: "Financial Statement", org: "AETSO", date: "Dec 15, 2023" },
    { id: 'r8', name: "General Assembly Proposal", category: "Event Proposal", org: "AERO-ATSO", date: "Feb 05, 2024" },
    { id: 'r9', name: "Res. 2023-09: Constitution Amendment", category: "Resolution", org: "SSC", date: "Nov 10, 2023" },
    { id: 'r10', name: "Year-End Operational Plan", category: "Operational Plan", org: "Scholars Guild", date: "Dec 01, 2023" }
];

let currentRepoCategory = 'All';

// 3. Render Repository
// --- UPDATED REPOSITORY LOGIC ---

// 1. Initialize Repository (Call this when view loads)
function initRepository() {
    updateRepoCategoryDropdown(); // Calculates counts and updates Dropdown text
    renderRepoTable();
}

// 2. Update File Type Dropdown with Counts
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
    if (typeSelect.options.length > 0) {
        typeSelect.options[0].text = `All Types (${totalCount})`;
    }

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

// 3. Render Repository Table with ALL Filters
function renderRepoTable() {
    const tbody = document.getElementById('repository-table-body');
    if (!tbody) return;

    // Get Filter Values
    const searchInput = document.getElementById('repo-search-input')?.value.toLowerCase() || '';
    const filterType = document.getElementById('repo-filter-type')?.value || 'All';
    const filterSem = document.getElementById('repo-filter-sem')?.value || 'all';
    const filterMonth = document.getElementById('repo-filter-month')?.value || '';
    const filterDate = document.getElementById('repo-filter-date')?.value || '';

    // Filter Logic
    const filtered = repositoryData.filter(item => {
        // 1. File Type
        const matchesType = filterType === 'All' || item.category === filterType;

        // 2. Search Text
        const matchesSearch = item.name.toLowerCase().includes(searchInput) ||
            item.category.toLowerCase().includes(searchInput);

        // 3. Date Logic
        const itemDate = new Date(item.date);
        let matchesDate = true;

        if (filterDate) {
            matchesDate = formatDateForComparison(itemDate) === filterDate;
        } else if (filterMonth) {
            const itemMonthStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
            matchesDate = itemMonthStr === filterMonth;
        } else if (filterSem !== 'all') {
            const month = itemDate.getMonth(); // 0-11
            if (filterSem === '1st') {
                // Aug(7) to Dec(11)
                matchesDate = month >= 7 && month <= 11;
            } else if (filterSem === '2nd') {
                // Jan(0) to May(4)
                matchesDate = month >= 0 && month <= 4;
            }
        }

        return matchesType && matchesSearch && matchesDate;
    });

    // Update Label
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
                <button class="btn btn-sm btn-outline" onclick="openPdfViewer('repo_${item.id}')">
                    <i class="fa-solid fa-download"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 4. Reset Function
function resetRepoFilters() {
    document.getElementById('repo-filter-type').value = 'All';
    document.getElementById('repo-filter-sem').value = 'all';
    document.getElementById('repo-filter-month').value = '';
    document.getElementById('repo-filter-date').value = '';
    document.getElementById('repo-search-input').value = '';

    renderRepoTable();
    // Assuming showToast exists in your main scripts, otherwise alert
    if (typeof showToast === 'function') showToast('Filters reset', 'info');
}