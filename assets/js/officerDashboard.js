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
    { title: "Election Guidelines", type: "Document", date: "Oct 20", status: "Pending" }
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
    // Sidebar active state
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

    // Section visibility
    document.querySelectorAll('.section-view').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');

    // Title update
    const titleMap = {
        'dashboard': 'Dashboard',
        'tracker': 'Services Tracker',
        'documents': 'Document Organizer',
        'analytics': 'Data Analytics',
        'announcements': 'Manage Announcements',
        'events': 'Events Management'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'Org Manager';
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

    // Full Tracker Table
    const trackTable = document.getElementById('tracker-table');
    trackTable.innerHTML = rentalsData.map((item, index) => {
        let badgeClass = item.status === 'Rented' ? 'status-borrowed' : (item.status === 'Overdue' ? 'status-overdue' : 'status-borrowed');
        return `
        <tr>
            <td>${item.item}</td>
            <td>${item.renter}</td>
            <td>${item.due}</td>
            <td>${item.status === 'Overdue' ? '<span style="color:#ef4444">Damaged</span>' : 'Good'}</td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="returnItem(${index})">
                    <i class="fa-solid fa-rotate-left"></i> Return
                </button>
            </td>
        </tr>`;
    }).join('');
}

function renderDocs() {
    const list = document.getElementById('docs-list');
    list.innerHTML = docsData.map(doc => {
        let badgeClass = doc.status === 'Approved' ? 'status-completed' : (doc.status === 'Sent to OSA' ? 'status-sent' : 'status-pending');
        return `
        <div class="list-item" style="padding: 12px 0; border-bottom: 1px solid var(--border);">
            <div>
                <h4 style="font-size:0.9rem;">${doc.title}</h4>
                <p style="font-size:0.8rem; color:var(--muted);">${doc.type} • ${doc.date}</p>
            </div>
            <span class="status-badge ${badgeClass}">${doc.status}</span>
        </div>`;
    }).join('');
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
}

function handleDocSubmit(e) {
    e.preventDefault();
    // Simulate adding to list
    const type = e.target.querySelector('select').value;
    const title = e.target.querySelector('input').value;

    docsData.unshift({
        title: title,
        type: type,
        date: "Just now",
        status: "Sent to OSA"
    });
    renderDocs();
    e.target.reset();
    alert("Document successfully sent to OSA for checking.");
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
    renderAnnouncements();
});