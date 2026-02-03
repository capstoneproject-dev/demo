// --- DATA SIMULATION ---
const servicesData = [
    { name: "Shoe Rag", org: "AISERS", icon: "fa-shoe-prints", color: "#f59e0b" },
    { name: "Calculator", org: "AISERS", icon: "fa-calculator", color: "#f59e0b" },
    { name: "Business Calculator", org: "AISERS", icon: "fa-calculator", color: "#f59e0b" },
    { name: "Scientific Calculator", org: "SSC, AERO-ATSO", icon: "fa-square-root-variable", color: "#ef4444" },
    { name: "Arnis Equipment", org: "AISERS", icon: "fa-hand-fist", color: "#f59e0b" },
    { name: "Printing", org: "SSC, CYC, AMTSO, AET", icon: "fa-print", color: "#ef4444" },
    { name: "Crimping Tools", org: "ELITECH", icon: "fa-pliers", color: "#6366f1" },
    { name: "Mini Fan", org: "ELITECH", icon: "fa-fan", color: "#6366f1" },
    { name: "Tester", org: "ELITECH", icon: "fa-bolt", color: "#6366f1" },
    { name: "Rulers", org: "General", icon: "fa-ruler", color: "#64748b" },
    { name: "T-Square", org: "General", icon: "fa-ruler-combined", color: "#64748b" },
    { name: "Triangle Ruler", org: "General", icon: "fa-shapes", color: "#64748b" },
    { name: "Protractor", org: "General", icon: "fa-rotate", color: "#64748b" },
    { name: "1x1 Photo Processing", org: "SSC", icon: "fa-camera", color: "#ef4444" },
    { name: "Locker Rental", org: "SSC", icon: "fa-box-archive", color: "#ef4444" },
    { name: "Others", org: "Various", icon: "fa-plus", color: "#64748b" }
];

const eventsData = [
    { title: "Annual Tech Summit", date: "Oct 25", org: "AISERS", desc: "A gathering of tech enthusiasts." },
    { title: "Sports Fest 2023", date: "Nov 02", org: "SSC", desc: "Inter-department sports league." },
    { title: "Aero Workshop", date: "Nov 10", org: "AERO-ATSO", desc: "Drone flying basics." }
];

const announcementsData = [
    { title: "Enrollment for 2nd Sem", date: "Today", content: "Please settle your balance before 25th." },
    { title: "Office Hours", date: "Yesterday", content: "Org offices will be closed on holidays." },
    { title: "Job Fair", date: "2 days ago", content: "Prepare your resumes for upcoming fair." }
];

const transactionsData = [
    { date: "Oct 20, 2023", item: "Locker Rental (Sem 1)", org: "SSC", status: "Completed" },
    { date: "Oct 18, 2023", item: "Printing (5 pages)", org: "SSC", status: "Completed" },
    { date: "Oct 15, 2023", item: "Calculator Borrowing", org: "AISERS", status: "Returned" },
    { date: "Oct 10, 2023", item: "Membership Application", org: "ELITECH", status: "Pending" }
];

// Flattened Organization Data (Based on your provided list)
const organizationData = [
    // Supreme Student Council
    { name: "Supreme Student Council", category: "Council", imgSeed: "council", color: "#002147", image: "../assets/photos/studentDashboard/Organization/SSC.png" },
    // ICS
    { name: "AISERS", category: "ICS", imgSeed: "network", color: "#f59e0b", image: "../assets/photos/studentDashboard/Organization/AISERS.png" },
    // ILAS
    { name: "ILASSO", category: "ILAS", imgSeed: "book", color: "#ef4444", image: "../assets/photos/studentDashboard/Organization/ILASSO.png" },
    // INET
    { name: "ELITECH", category: "INET", imgSeed: "electronic", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/ELITECH.png" },
    { name: "AERO-ATSO", category: "INET", imgSeed: "plane", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AEROATSO.png" },
    { name: "AETSO", category: "INET", imgSeed: "industry", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AET.png" },
    { name: "AMTSO", category: "INET", imgSeed: "gear", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AMT.png" },
    // Interest Club
    { name: "RCYC", category: "Interest Club", imgSeed: "bicycle", color: "#059669", image: "../assets/photos/studentDashboard/Organization/RCYC.png" },
    { name: "CYC", category: "Interest Club", imgSeed: "child", color: "#059669", image: "../assets/photos/studentDashboard/Organization/CYC.png" },
    { name: "Scholar’s Guild", category: "Interest Club", imgSeed: "grad", color: "#059669", image: "../assets/photos/studentDashboard/Organization/PSG.png" },
    { name: "Aeronautica", category: "Interest Club", imgSeed: "rocket", color: "#059669", image: "../assets/photos/studentDashboard/Organization/AERONAUTICA.png" }
];

// Extended Events Data (for Events Tab)
const extendedEvents = [
    {
        title: "The Summit 2024",
        date: "Nov. 11-24, 2024",
        time: "08:00 AM - 05:00 PM",
        venue: "Main Auditorium",
        participants: 120,
        description: "Join us for the biggest gathering of tech leaders and students. Featuring keynote speakers, workshops, and networking opportunities.",
        org: "SSC",
        img: "https://picsum.photos/seed/summit/600/400",
        gallery: [
            "https://picsum.photos/seed/summit/600/400",
            "https://picsum.photos/seed/summit2/600/400",
            "https://picsum.photos/seed/summit3/600/400"
        ]
    },
    {
        title: "Collision Conference",
        date: "June 17-20, 2024",
        time: "09:00 AM - 04:00 PM",
        venue: "Tech Hall B",
        participants: 85,
        description: "A deep dive into collision technology and future innovations. Hands-on labs available for all participants.",
        org: "AISERS",
        img: "https://picsum.photos/seed/collision/600/400",
        gallery: [
            "https://picsum.photos/seed/collision/600/400",
            "https://picsum.photos/seed/collision2/600/400"
        ]
    },
    {
        title: "Web Summit 2024",
        date: "Feb. 26-29, 2024",
        time: "10:00 AM - 03:00 PM",
        venue: "Computer Lab 3",
        participants: 45,
        description: "Explore the latest web frameworks and design trends. Perfect for CS and IT students looking to upgrade their portfolio.",
        org: "ELITECH",
        img: "https://picsum.photos/seed/websummit/600/400",
        gallery: [
            "https://picsum.photos/seed/websummit/600/400",
            "https://picsum.photos/seed/websummit2/600/400",
            "https://picsum.photos/seed/websummit3/600/400"
        ]
    },
    {
        title: "Tech Expo 2024",
        date: "Dec. 05-10, 2024",
        time: "08:00 AM - 05:00 PM",
        venue: "Open Grounds",
        participants: 300,
        description: "Showcasing student inventions and capstone projects. Open to all departments.",
        org: "AERO-ATSO",
        img: "https://picsum.photos/seed/techexpo/600/400",
        gallery: [
            "https://picsum.photos/seed/techexpo/600/400",
            "https://picsum.photos/seed/techexpo2/600/400"
        ]
    },
    {
        title: "Innovation Week",
        date: "Jan. 15-20, 2025",
        time: "TBA",
        venue: "Student Hub",
        participants: 12,
        description: "A week-long hackathon and brainstorming session to solve campus problems.",
        org: "AMTSO",
        img: "https://picsum.photos/seed/innovation/600/400",
        gallery: [
            "https://picsum.photos/seed/innovation/600/400",
            "https://picsum.photos/seed/innovation2/600/400",
            "https://picsum.photos/seed/innovation3/600/400"
        ]
    }
];

// --- CORE NAVIGATION LOGIC ---
function navigate(viewId, element) {
    // Update Active Link
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

    // Hide all sections
    document.querySelectorAll('.section-view').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
    }

    // Update Page Title
    const titleMap = {
        'dashboard': 'Dashboard',
        'organizations': 'Organizations',
        'services': 'Services',
        'profile': 'My Profile'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'Student Hub';

    // Scroll to top
    window.scrollTo(0, 0);
}

// --- ORGANIZATION TABS LOGIC ---
function switchOrgTab(tabName, btn) {
    // Update Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update Content
    const contentDiv = document.getElementById('tab-content');
    contentDiv.innerHTML = ''; // Clear previous content

    if (tabName === 'about') {
        // --- FILTER BUTTONS ---
        const filterBar = document.createElement('div');
        filterBar.style.display = 'flex';
        filterBar.style.gap = '12px';
        filterBar.style.marginBottom = '24px';
        filterBar.style.flexWrap = 'wrap';

        // Category definitions
        const categories = [
            { key: 'all', label: 'All', icon: 'fa-layer-group' },
            { key: 'Council', label: 'Council', icon: 'fa-university' },
            { key: 'ICS', label: 'ICS', icon: 'fa-microchip' },
            { key: 'ILAS', label: 'ILAS', icon: 'fa-book' },
            { key: 'INET', label: 'INET', icon: 'fa-network-wired' },
            { key: 'Interest Club', label: 'Interest Club', icon: 'fa-star' }
        ];

        // Create filter buttons
        categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = 'org-filter-btn';
            btn.innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.label}`;
            btn.setAttribute('data-category', cat.key);
            btn.style.padding = '8px 18px';
            btn.style.borderRadius = '20px';
            btn.style.border = 'none';
            btn.style.background = idx === 0 ? 'var(--primary)' : 'var(--panel-2)';
            btn.style.color = idx === 0 ? '#fff' : 'var(--text)';
            btn.style.fontWeight = '500';
            btn.style.fontSize = '1rem';
            btn.style.cursor = 'pointer';
            btn.style.boxShadow = 'var(--shadow)';
            btn.style.transition = 'background 0.2s, color 0.2s';
            if (idx === 0) btn.classList.add('active');
            filterBar.appendChild(btn);
        });
        contentDiv.appendChild(filterBar);

        // --- ORG GRID CONTAINER ---
        const grid = document.createElement('div');
        grid.className = 'org-grid-layout';
        contentDiv.appendChild(grid);

        // --- FILTER LOGIC ---
        function renderOrgs(categoryKey) {
            grid.innerHTML = '';
            let orgsToShow = [];
            if (!categoryKey || categoryKey === 'all') {
                orgsToShow = organizationData;
            } else if (categoryKey === 'Council') {
                orgsToShow = organizationData.filter(o => o.name === 'Supreme Student Council');
            } else if (categoryKey === 'ICS') {
                orgsToShow = organizationData.filter(o => o.name === 'AISERS' || o.name === 'ELITECH');
            } else if (categoryKey === 'ILAS') {
                orgsToShow = organizationData.filter(o => o.name === 'ILASSO');
            } else if (categoryKey === 'INET') {
                orgsToShow = organizationData.filter(o => ['AERO-ATSO', 'AETSO', 'AMTSO'].includes(o.name));
            } else if (categoryKey === 'Interest Club') {
                orgsToShow = organizationData.filter(o => [
                    'RCYC', 'CYC', "Scholar’s Guild", 'Aeronautica'
                ].includes(o.name));
            }

            if (orgsToShow.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">No organizations found for this category.</div>';
                return;
            }

            orgsToShow.forEach(org => {
                // Create Card
                const card = document.createElement('div');
                card.className = 'org-card';

                // Image
                const img = document.createElement('img');
                img.src = org.image ? org.image : `https://picsum.photos/seed/${org.imgSeed}/400/225`;
                img.className = 'org-card-image';
                img.alt = org.name;

                // Overlay
                const overlay = document.createElement('div');
                overlay.className = 'org-overlay';

                // Title
                const title = document.createElement('div');
                title.className = 'org-title';
                title.innerText = org.name;

                overlay.appendChild(title);

                card.appendChild(img);
                card.appendChild(overlay);
                grid.appendChild(card);
            });
        }

        // Initial render (All)
        renderOrgs('all');

        // Add event listeners to filter buttons
        filterBar.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function () {
                // Remove active from all
                filterBar.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'var(--panel-2)';
                    b.style.color = 'var(--text)';
                });
                // Set active
                this.classList.add('active');
                this.style.background = 'var(--primary)';
                this.style.color = '#fff';
                renderOrgs(this.getAttribute('data-category'));
            });
        });
    } else if (tabName === 'my-organization') {
        contentDiv.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
                <i class="fa-solid fa-users-slash" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
                <h3 style="margin-bottom: 10px; color: var(--text);">No Organizations Joined</h3>
                <p style="max-width: 400px; margin: 0 auto; line-height: 1.5;">
                    You haven't joined any student organizations yet. Visit to "About" tab to explore and join!
                </p>
            </div>
        `;
    } else if (tabName === 'membership') {
        contentDiv.innerHTML = `
            <div style="padding: 20px;">
                <h3 style="margin-bottom: 15px;">Apply for Officer Membership</h3>
                <p style="color: var(--muted); margin-bottom: 20px;">
                    Aspiring to lead? Fill out form below to apply for officer roles in our partner organizations.
                </p>
                <form onsubmit="event.preventDefault(); alert('Application Submitted Successfully!');" style="display: grid; gap: 15px; max-width: 500px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Full Name</label>
                        <input type="text" style="width:100%; padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-2); color:var(--text);" required>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Desired Organization</label>
                        <select style="width:100%; padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-2); color:var(--text);">
                            <option>SSC</option>
                            <option>AISERS</option>
                            <option>ELITECH</option>
                            <option>AERO-ATSO</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Position</label>
                        <input type="text" style="width:100%; padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--panel-2); color:var(--text);" required>
                    </div>
                    <button type="submit" style="background: var(--primary); color: white; padding: 12px; border-radius: var(--radius-md); border: none; cursor: pointer; font-weight: 600;">Submit Application</button>
                </form>
            </div>
        `;
    } else if (tabName === 'events') {
        // Filter Bar
        const filterBar = document.createElement('div');
        filterBar.className = 'events-filter-bar';
        filterBar.innerHTML = `
            <div class="filter-input-group">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="eventSearch" placeholder="Search by keywords">
            </div>
            <div class="filter-date-group">
                <input type="date" id="eventDate">
                <i class="fa-regular fa-calendar"></i>
            </div>
            <div class="reset-filter" id="resetEvents">
                <i class="fa-solid fa-xmark"></i>
                <span>Reset</span>
            </div>
        `;
        contentDiv.appendChild(filterBar);

        // Events Grid Container
        const grid = document.createElement('div');
        grid.className = 'events-grid-layout';
        grid.id = 'eventsGridContainer';
        contentDiv.appendChild(grid);

        function renderEvents(filteredEvents) {
            grid.innerHTML = '';
            if (filteredEvents.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">No events found matching your criteria.</div>';
                return;
            }
            filteredEvents.forEach(ev => {
                const isRegistered = isEventRegistered(ev.title);
                const card = document.createElement('div');
                card.className = 'event-card-ref';
                card.innerHTML = `
                    <img src="${ev.img}" class="event-card-thumb" alt="${ev.title}">
                    <div class="event-card-body">
                        <div class="event-card-header">
                            <div class="event-org-icon">${ev.org.charAt(0)}</div>
                            <div class="event-card-info">
                                <h4>${ev.title}</h4>
                                <p>${ev.date}</p>
                            </div>
                        </div>
                    </div>
                    <div class="event-card-footer">
                        <div class="event-stat"><i class="fa-regular fa-heart"></i> 5</div>
                        <div class="event-stat"><i class="fa-regular fa-comment"></i> 5</div>
                        <div class="event-actions">
                            <button class="btn-view-details" onclick="openDetailsModal('${ev.title}')">
                                Details <i class="fa-solid fa-circle-info"></i>
                            </button>
                            <button class="btn-register-card ${isRegistered ? 'registered' : ''}" 
                                    onclick="openRegistrationModal('${ev.title}')" 
                                    ${isRegistered ? 'disabled style="cursor: not-allowed;"' : ''}>
                                ${isRegistered ? 'Registered <i class="fa-solid fa-check"></i>' : 'Pre-Register <i class="fa-solid fa-arrow-right"></i>'}
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function filterEvents() {
            const searchTerm = document.getElementById('eventSearch').value.toLowerCase();
            const dateTerm = document.getElementById('eventDate').value;

            const filtered = extendedEvents.filter(ev => {
                const matchesSearch = ev.title.toLowerCase().includes(searchTerm) || ev.org.toLowerCase().includes(searchTerm);
                // Simple date match for simulation (checking if year matches if a date is picked)
                const matchesDate = !dateTerm || ev.date.includes(dateTerm.split('-')[0]);
                return matchesSearch && matchesDate;
            });
            renderEvents(filtered);
        }

        // Event Listeners
        document.getElementById('eventSearch').addEventListener('input', filterEvents);
        document.getElementById('eventDate').addEventListener('change', filterEvents);
        document.getElementById('resetEvents').addEventListener('click', () => {
            document.getElementById('eventSearch').value = '';
            document.getElementById('eventDate').value = '';
            renderEvents(extendedEvents);
        });

        // Initial Render
        renderEvents(extendedEvents);
    } else if (tabName === 'contacts') {
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        grid.style.gap = '20px';

        [
            { name: "John Doe", role: "President, SSC", contact: "0912-345-6789" },
            { name: "Alice Smith", role: "Head, AISERS", contact: "0998-765-4321" },
            { name: "Bob Ross", role: "Rep, ELITECH", contact: "0917-123-4567" }
        ].forEach(person => {
            const card = document.createElement('div');
            card.style.textAlign = 'center';
            card.style.padding = '20px';
            card.style.border = '1px solid var(--border)';
            card.style.borderRadius = 'var(--radius-md)';

            card.innerHTML = `
                <div style="width: 60px; height: 60px; background: var(--panel-2); border-radius: 50%; margin: 0 auto 10px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text);">${person.name.charAt(0)}${person.name.split(' ')[1]}</div>
                <h4>${person.role}</h4>
                <p style="color:var(--muted); font-size:0.85rem;"><i class="fa-solid fa-phone"></i> ${person.contact}</p>
            `;
            grid.appendChild(card);
        });
        contentDiv.appendChild(grid);
    }

    // Add fade animation
    contentDiv.style.animation = 'none';
    contentDiv.offsetHeight; /* trigger reflow */
    contentDiv.style.animation = 'fadeIn 0.4s ease';
}

// --- RENDER FUNCTIONS ---
function renderServices(filter = "") {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = "";

    servicesData.forEach(service => {
        if (service.name.toLowerCase().includes(filter.toLowerCase()) || service.org.toLowerCase().includes(filter.toLowerCase())) {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <div class="service-icon">
                    <i class="fa-solid ${service.icon}"></i>
                </div>
                <div>
                    <div class="service-name">${service.name}</div>
                    <span class="org-badge" style="background-color: ${service.color}">${service.org}</span>
                </div>
            `;
            grid.appendChild(card);
        }
    });
}

function renderDashboard() {
    // Render Announcements
    const annList = document.getElementById('announcements-list');
    annList.innerHTML = announcementsData.map(item => `
        <div class="list-item">
            <div class="item-icon"><i class="fa-solid fa-bullhorn"></i></div>
            <div class="item-content">
                <h4>${item.title}</h4>
                <p>${item.content}</p>
            </div>
            <span class="date-badge">${item.date}</span>
        </div>
    `).join('');

    // Render Event Cards (Preview)
    const eventContainer = document.getElementById('events-preview-container');
    eventContainer.innerHTML = eventsData.map(ev => `
        <div style="background: var(--panel-2); padding: 15px; border-radius: var(--radius-md); flex: 1;">
            <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-bottom: 5px;">${ev.date}</div>
            <h4 style="margin-bottom: 5px;">${ev.title}</h4>
            <p style="font-size: 0.85rem; color: var(--muted);">${ev.org}</p>
        </div>
    `).join('');
}

function renderProfile() {
    const tableBody = document.getElementById('transaction-table');
    tableBody.innerHTML = transactionsData.map(t => {
        let statusClass = t.status === 'Completed' ? 'status-completed' : (t.status === 'Returned' ? 'status-completed' : 'status-pending');
        return `
            <tr>
                <td>${t.date}</td>
                <td>${t.item}</td>
                <td>${t.org}</td>
                <td><span class="status-badge ${statusClass}">${t.status}</span></td>
            </tr>
        `;
    }).join('');
}

function filterServices() {
    const input = document.getElementById('serviceSearch');
    renderServices(input.value);
}

// --- UTILS ---

function setDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    document.getElementById('current-date').innerText = today.toLocaleDateString('en-US', options);
}

// Helper to switch to actual theme logic
function switchThemeLogic() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');

    // Update Sidebar Footer Button
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

    // Update Mobile Header Button
    const mobIcon = document.getElementById('mobile-theme-icon');
    if (mobIcon) {
        mobIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Event Listener for Sidebar Button
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', switchThemeLogic);
}

// Function for Mobile Header Button
function toggleThemeMobile() {
    switchThemeLogic();
}

// Logout Handler
function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '../pages/login.html';
    }
}

// Check saved theme on load
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    // Update icons manually on load
    const sbIcon = document.querySelector('#themeBtn .nav-icon');
    const sbText = document.querySelector('#themeBtn .nav-label');
    const mobIcon = document.getElementById('mobile-theme-icon');

    if (sbIcon) sbIcon.className = 'fa-solid fa-sun nav-icon';
    if (sbText) sbText.innerText = 'Light Mode';
    if (mobIcon) mobIcon.className = 'fa-solid fa-sun';
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderDashboard();
    renderServices();
    renderProfile();
    switchOrgTab('about', document.querySelector('.tab-btn')); // Init tab
});

// --- MODAL LOGIC ---

// Track registered events in localStorage
function getRegisteredEvents() {
    const registered = localStorage.getItem('registeredEvents');
    return registered ? JSON.parse(registered) : [];
}

function addRegisteredEvent(eventTitle) {
    const registered = getRegisteredEvents();
    if (!registered.includes(eventTitle)) {
        registered.push(eventTitle);
        localStorage.setItem('registeredEvents', JSON.stringify(registered));
    }
}

function isEventRegistered(eventTitle) {
    return getRegisteredEvents().includes(eventTitle);
}

function openRegistrationModal(eventTitle) {
    const modal = document.getElementById('eventRegistrationModal');
    const titleEl = document.getElementById('modalEventTitle');

    if (modal && titleEl) {
        titleEl.innerText = 'Registering for: ' + eventTitle;
        // Store the event title in modal for later use
        modal.setAttribute('data-event-title', eventTitle);
        modal.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function closeRegistrationModal() {
    const modal = document.getElementById('eventRegistrationModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
    // Optional: Reset form
    document.getElementById('registrationForm').reset();
}

function handleRegistrationSubmit(e) {
    e.preventDefault();

    // Get the event title from the modal
    const modal = document.getElementById('eventRegistrationModal');
    const eventTitle = modal.getAttribute('data-event-title');

    // Here you would normally gather data and send to backend
    // For now, we'll just mark it as registered
    addRegisteredEvent(eventTitle);

    alert('Registration Submitted Successfully!');
    closeRegistrationModal();

    // Update the button for this event
    updateEventButton(eventTitle);
}

function updateEventButton(eventTitle) {
    // Find all buttons with this event title and update them
    const buttons = document.querySelectorAll('.btn-register-card');
    buttons.forEach(btn => {
        const btnEventTitle = btn.getAttribute('onclick').match(/openRegistrationModal\('(.+?)'\)/)?.[1];
        if (btnEventTitle === eventTitle) {
            btn.classList.add('registered');
            btn.innerHTML = 'Registered <i class="fa-solid fa-check"></i>';
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
        }
    });
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('eventRegistrationModal');
    if (e.target === modal) {
        closeRegistrationModal();
    }
});

// --- EVENT DETAILS MODAL & CAROUSEL LOGIC ---

let currentSlide = 0;
let currentEventGallery = [];

function openDetailsModal(eventTitle) {
    // Find event object
    const eventObj = extendedEvents.find(e => e.title === eventTitle);
    if (!eventObj) return;

    const modal = document.getElementById('eventDetailsModal');

    // Populate Details
    document.getElementById('detailsEventTitle').innerText = eventObj.title;
    document.getElementById('detailsDate').innerText = eventObj.date;
    document.getElementById('detailsTime').innerText = eventObj.time || "TBA";
    document.getElementById('detailsVenue').innerText = eventObj.venue || "TBA";
    document.getElementById('detailsParticipants').innerText = eventObj.participants + " Registered";
    document.getElementById('detailsDesc').innerText = eventObj.description;

    // Setup Carousel
    currentEventGallery = eventObj.gallery || [eventObj.img];
    currentSlide = 0;
    renderCarousel();

    // Show Modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    const modal = document.getElementById('eventDetailsModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

function renderCarousel() {
    const track = document.getElementById('carouselTrack');
    const indicators = document.getElementById('carouselIndicators');

    track.innerHTML = '';
    indicators.innerHTML = '';

    // Create Slides
    currentEventGallery.forEach((imgSrc, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.innerHTML = `<img src="${imgSrc}" alt="Gallery Image">`;
        track.appendChild(slide);

        // Create Indicator Dot
        const dot = document.createElement('div');
        dot.className = `indicator ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => {
            currentSlide = index;
            updateCarousel();
        };
        indicators.appendChild(dot);
    });

    updateCarousel();
}

function updateCarousel() {
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.indicator');

    const translateValue = -(currentSlide * 100);
    track.style.transform = `translateX(${translateValue}%)`;

    dots.forEach((dot, idx) => {
        if (idx === currentSlide) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

function moveSlide(direction) {
    const totalSlides = currentEventGallery.length;
    currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
    updateCarousel();
}

// --- DATA CATEGORIES CONFIGURATION ---
const serviceCategories = {
    academic: {
        title: "Academic & Study Tools",
        icon: "fa-calculator",
        items: ["Calculator", "Business Calculator", "Scientific Calculator", "Rulers", "T-Square", "Triangle Ruler", "Protractor"]
    },
    laboratory: {
        title: "Laboratory",
        icon: "fa-flask",
        items: ["Shoe Rag", "Crimping Tools", "Tester"]
    },
    equipment: {
        title: "Equipment & Utilities",
        icon: "fa-toolbox",
        items: ["Arnis Equipment", "Mini Fan", "Locker Rental"]
    },
    others: {
        title: "Others",
        icon: "fa-layer-group",
        items: ["Others"]
    }
};

// --- RENDER SERVICES (UPDATED) ---
function renderServices(filter = "") {
    const grid = document.getElementById('servicesGrid');
    const hero = document.getElementById('printingHero');
    const filterLower = filter.toLowerCase();

    // 1. Handle Printing Hero Visibility
    // Show hero if filter is empty, or if it matches "printing" or "photo" (since 1x1 is listed there)
    const printingKeywords = ["printing", "photo", "1x1"];
    const showHero = filterLower === "" || printingKeywords.some(keyword => filterLower.includes(keyword));

    if (showHero) {
        hero.style.display = "block";
    } else {
        hero.style.display = "none";
    }

    // 2. Render Categorized Services
    grid.innerHTML = ""; // Clear current content

    let hasResults = false;

    // Iterate through defined categories
    for (const [key, category] of Object.entries(serviceCategories)) {
        // Find matching services in servicesData for this category
        const matchingServices = servicesData.filter(service =>
            category.items.includes(service.name) &&
            (service.name.toLowerCase().includes(filterLower) || service.org.toLowerCase().includes(filterLower))
        );

        // If we have matches, render the section
        if (matchingServices.length > 0) {
            hasResults = true;

            // Create Section Container
            const section = document.createElement('div');
            section.className = 'category-section';

            // Create Header
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `
                <div class="category-icon"><i class="fa-solid ${category.icon}"></i></div>
                <div class="category-title">${category.title}</div>
            `;
            section.appendChild(header);

            // Create Grid for Cards
            const cardGrid = document.createElement('div');
            cardGrid.className = 'category-grid';

            matchingServices.forEach(service => {
                const card = document.createElement('div');
                card.className = 'service-card'; // Use existing card class
                card.innerHTML = `
                    <div class="service-icon">
                        <i class="fa-solid ${service.icon}"></i>
                    </div>
                    <div>
                        <div class="service-name">${service.name}</div>
                        <span class="org-badge" style="background-color: ${service.color}">${service.org}</span>
                    </div>
                `;

                // NEW INTERACTION LOGIC
                if (service.name !== "Others") {
                    card.onclick = () => openServiceModal(service.name);
                    card.style.cursor = "pointer";
                    card.setAttribute('role', 'button');
                    card.setAttribute('aria-label', `Select organization for ${service.name}`);
                    card.setAttribute('tabindex', '0');
                    card.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openServiceModal(service.name);
                        }
                    };
                }

                cardGrid.appendChild(card);
            });

            section.appendChild(cardGrid);
            grid.appendChild(section);
        }
    }

    // Optional: Show "No results" if everything is empty (and hero is hidden)
    if (!hasResults && !showHero) {
        grid.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 40px;">No services found matching "${filter}".</div>`;
    }
}

// --- FILTER SERVICES ---
function filterServices() {
    const searchInput = document.getElementById('serviceSearch');
    const query = searchInput.value;
    renderServices(query);
}

// --- UPLOAD ZONE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const uploadContent = uploadZone?.querySelector('.upload-content');
    const fileSelectedState = document.getElementById('fileSelectedState');
    const filenameText = document.getElementById('filenameText');
    const btnUploadSubmit = document.getElementById('btnUploadSubmit');

    if (!uploadZone) return;

    // Click to browse
    uploadZone.addEventListener('click', (e) => {
        // Prevent triggering click if user clicked the submit button
        if (e.target !== btnUploadSubmit) {
            fileInput.click();
        }
    });

    // Drag & Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('drag-over'), false);
    });

    // Handle Drop
    uploadZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Handle Input Change
    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];

            // Validate format
            const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg'];
            // Simple extension check as backup
            const validExtensions = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
            const fileExtension = file.name.split('.').pop().toLowerCase();

            if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
                showFileSelected(file);
            } else {
                alert('Invalid file format. Please upload PDF, DOCX, PNG, or JPG.');
                resetUploadUI();
            }
        }
    }

    function showFileSelected(file) {
        uploadContent.style.display = 'none';
        fileSelectedState.style.display = 'flex';
        filenameText.textContent = file.name;
        btnUploadSubmit.disabled = false;
    }

    function resetUploadUI() {
        uploadContent.style.display = 'block';
        fileSelectedState.style.display = 'none';
        fileInput.value = ''; // Reset input
        btnUploadSubmit.disabled = true;
    }

    // Handle Submit (Mock)
    btnUploadSubmit.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop bubbling to uploadZone click
        const file = fileInput.files[0];
        if (file) {
            alert(`Uploading "${file.name}" to print queue... (Demo)`);
            // Optional: Reset after success
            setTimeout(resetUploadUI, 1000);
        }
    });
});

// --- DATA MAPPING (Service -> Organizations) ---
const serviceOrgMapping = {
    "Shoe Rag": ["AISERS"],
    "Calculator": ["AISERS"],
    "Business Calculator": ["AISERS"],
    "Scientific Calculator": ["SSC", "AERO-ATSO"],
    "Arnis Equipment": ["AISERS"],
    "Printing": ["SSC", "CYC", "AMTSO", "AET"],
    "Crimping Tools": ["ELITECH"],
    "Mini Fan": ["ELITECH"],
    "Tester": ["ELITECH"],
    "Rulers": ["AMTSO"],
    "T-Square": ["AMTSO", "AERO-ATSO"],
    "Triangle Ruler": ["AMTSO"],
    "Protractor": ["AMTSO"],
    "1x1 Photo Processing": ["SSC"],
    "Locker Rental": ["SSC"],
    "Others": ["Various"]
};

// --- GLOBAL STATE ---
let currentSelectedService = null;
let currentSelectedOrg = null;

// --- MODAL FUNCTIONS ---

function openServiceModal(serviceName) {
    const modal = document.getElementById('serviceSelectModal');
    const listContainer = document.getElementById('orgSelectList');
    const subtitle = document.getElementById('modalServiceSubtitle');
    const continueBtn = document.getElementById('btnContinueService');

    // 1. Set State
    currentSelectedService = serviceName;
    currentSelectedOrg = null;
    continueBtn.disabled = true;

    // 2. Set Content
    subtitle.textContent = `Choose who will provide: ${serviceName}`;
    listContainer.innerHTML = ''; // Clear previous

    // 3. Get Orgs for this service
    const orgs = serviceOrgMapping[serviceName] || [];

    if (orgs.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--muted); padding:20px;">No organizations found for this service.</div>`;
    } else {
        orgs.forEach((orgName, index) => {
            // Create Option Card
            const card = document.createElement('div');
            card.className = 'org-option-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.onclick = () => selectOrgOption(orgName, card);
            card.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectOrgOption(orgName, card);
                }
            };

            // Initials for avatar
            const initials = orgName.substring(0, 2).toUpperCase();

            card.innerHTML = `
                <div class="org-info">
                    <div class="org-avatar">${initials}</div>
                    <div class="org-name-text">${orgName}</div>
                </div>
                <i class="fa-solid fa-circle-check check-icon"></i>
            `;
            listContainer.appendChild(card);

            // Auto-select if only one option exists
            if (orgs.length === 1) {
                selectOrgOption(orgName, card);
            }
        });
    }

    // 4. Show Modal & Accessibility
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(modal);
}

function closeServiceModal() {
    const modal = document.getElementById('serviceSelectModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Clean up state
    currentSelectedService = null;
    currentSelectedOrg = null;
}

function selectOrgOption(orgName, cardElement) {
    currentSelectedOrg = orgName;

    // Visual Update: Remove 'selected' from all, add to clicked
    const allCards = document.querySelectorAll('.org-option-card');
    allCards.forEach(c => c.classList.remove('selected'));

    cardElement.classList.add('selected');

    // Enable Continue Button
    const continueBtn = document.getElementById('btnContinueService');
    continueBtn.disabled = false;
}

function handleServiceContinue() {
    if (!currentSelectedService || !currentSelectedOrg) return;

    // 1. Store Data (Frontend Only)
    console.log(`Service: ${currentSelectedService}, Org: ${currentSelectedOrg}`);

    // 2. Show Success Toast
    showToast(`Selected ${currentSelectedOrg} for ${currentSelectedService}`);

    // 3. Close Modal
    closeServiceModal();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const msgSpan = document.getElementById('toastMessage');

    msgSpan.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- ACCESSIBILITY: FOCUS TRAP ---
function trapFocus(element) {
    const focusableEls = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusableEl = focusableEls[0];
    const lastFocusableEl = focusableEls[focusableEls.length - 1];

    element.addEventListener('keydown', function (e) {
        const isTabPressed = e.key === 'Tab' || e.keyCode === 9;

        if (!isTabPressed) return;

        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstFocusableEl) {
                lastFocusableEl.focus();
                e.preventDefault();
            }
        } else { // Tab
            if (document.activeElement === lastFocusableEl) {
                firstFocusableEl.focus();
                e.preventDefault();
            }
        }
    });

    // Set initial focus
    if (firstFocusableEl) firstFocusableEl.focus();
}

// --- EVENT LISTENERS FOR MODAL ---

// 1. Click outside to close
document.getElementById('serviceSelectModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeServiceModal();
    }
});

// 2. ESC key to close
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('serviceSelectModal');
        if (modal.classList.contains('open')) {
            closeServiceModal();
        }
    }
});

// 3. Continue Button Click
document.getElementById('btnContinueService').addEventListener('click', handleServiceContinue);