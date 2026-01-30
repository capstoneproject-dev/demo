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

// --- NAVIGATION LOGIC ---
function navigate(viewId, element) {
    // Sidebar active state
    if (element) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        element.classList.add('active');
    } else {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(l => {
            if(l.getAttribute('onclick').includes(viewId)) l.classList.add('active');
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
        'announcements': 'Manage Announcements'
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
window.onclick = function(event) {
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
        
    announcementsData.unshift({
        title: title,
        content: content,
        date: "Just now"
    });
    renderAnnouncements();
    e.target.reset();
}

function returnItem(index) {
    const item = rentalsData[index];
    if(confirm(`Mark ${item.item} as returned by ${item.renter}?`)) {
        rentalsData.splice(index, 1);
        renderRentals(); // Re-render both tables
    }
}

// --- UTILS ---
function setDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', options);
}

// Theme Toggling
const themeBtn = document.getElementById('themeBtn');
const icon = themeBtn.querySelector('i');
const text = themeBtn.querySelector('span');

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    if (isDark) {
        icon.className = 'fa-solid fa-sun nav-icon';
        text.innerText = 'Light Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fa-solid fa-moon nav-icon';
        text.innerText = 'Dark Mode';
        localStorage.setItem('theme', 'light');
    }
});

// Check saved theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    icon.className = 'fa-solid fa-sun nav-icon';
    text.innerText = 'Light Mode';
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderRentals();
    renderDocs();
    renderAnnouncements();
});