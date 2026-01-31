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
    { name: "Supreme Student Council", category: "Council", imgSeed: "council", color: "#002147" },
    { name: "AISERS", category: "ICS", imgSeed: "network", color: "#f59e0b" },
    { name: "ELITECH", category: "ICS", imgSeed: "electronic", color: "#6366f1" },
    { name: "ILASSO", category: "ILAS", imgSeed: "book", color: "#ef4444" },
    { name: "AERO-ATSO", category: "INET", imgSeed: "plane", color: "#6366f1" },
    { name: "AETSO", category: "INET", imgSeed: "industry", color: "#6366f1" },
    { name: "AMTSO", category: "INET", imgSeed: "gear", color: "#6366f1" },
    { name: "RCYC", category: "Interest Club", imgSeed: "bicycle", color: "#059669" },
    { name: "CYC", category: "Interest Club", imgSeed: "child", color: "#059669" },
    { name: "Scholar’s Guild", category: "Interest Club", imgSeed: "grad", color: "#059669" },
    { name: "Aeronautica", category: "Interest Club", imgSeed: "rocket", color: "#059669" }
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
            if(l.getAttribute('onclick').includes(viewId)) l.classList.add('active');
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
const orgTabsContent = {
    'about': `
        <style>
            /* Desktop: 4 columns */
            .org-grid-layout {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                margin-top: 10px;
            }
            /* Mobile: 1 column (Vertical Stack) */
            @media (max-width: 768px) {
                .org-grid-layout {
                    grid-template-columns: 1fr;
                }
            }
        </style>
        <div class="org-grid-layout">
            ${organizationData.map(org => `
                <div style="
                    aspect-ratio: 16/9;
                    border-radius: 12px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.25);
                    transition: transform 0.3s;
                    cursor: pointer;
                    background-color: #000;
                ">
                    <!-- Movie Poster Image -->
                    <img src="https://picsum.photos/seed/${org.imgSeed}/400/225" style="width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.9;" alt="${org.name}">
                    
                    <!-- Gradient Overlay -->
                    <div style="
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        height: 60%;
                        background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 100%);
                        display: flex;
                        align-items: center;
                        padding-bottom: 12px;
                    ">
                        <!-- Organization Name Text -->
                        <div style="
                            color: white;
                            font-weight: 800;
                            font-size: 1.1rem;
                            text-align: center;
                            width: 100%;
                            text-shadow: 0 2px 10px rgba(0,0,0,0.8);
                            letter-spacing: 0.5px;
                            line-height: 1.2;
                        ">
                            ${org.name}
                        </div>
                    </div>

                    <!-- Category Badge (Top Left) -->
                    <div style="
                        position: absolute;
                        top: 12px;
                        left: 12px;
                        background: var(--accent);
                        color: var(--primary);
                        padding: 5px 12px;
                        border-radius: 4px;
                        font-weight: 700;
                        font-size: 0.8rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">
                        ${org.category}
                    </div>
                </div>
            `).join('')}
        </div>
    `,
    'my-organization': `
        <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
            <i class="fa-solid fa-users-slash" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
            <h3 style="margin-bottom: 10px; color: var(--text);">No Organizations Joined</h3>
            <p style="max-width: 400px; margin: 0 auto; line-height: 1.5;">
                You haven't joined any student organizations yet. Visit the "About" tab to explore and join!
            </p>
        </div>
    `,
    'membership': `
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
    `,
    'events': `
        <div style="display: grid; gap: 15px;">
            ${eventsData.map(ev => `
                <div class="list-item" style="border:1px solid var(--border); border-radius:var(--radius-md); padding:15px; background: var(--panel-2);">
                    <div class="item-icon"><i class="fa-regular fa-calendar"></i></div>
                    <div class="item-content">
                        <h4>${ev.title} <span style="font-size:0.75rem; background:var(--primary); color:white; padding:2px 6px; border-radius:4px;">${ev.org}</span></h4>
                        <p>${ev.desc}</p>
                    </div>
                    <div class="date-badge" style="background:var(--accent); color:var(--primary);">${ev.date}</div>
                </div>
            `).join('')}
        </div>
    `,
    'contacts': `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
            <div style="text-align: center; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-md);">
                <div style="width: 60px; height: 60px; background: var(--panel-2); border-radius: 50%; margin: 0 auto 10px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text);">JD</div>
                <h4>John Doe</h4>
                <p style="color:var(--muted); font-size:0.85rem;">President, SSC</p>
                <p style="margin-top:5px; font-size:0.85rem;"><i class="fa-solid fa-phone"></i> 0912-345-6789</p>
            </div>
            <div style="text-align: center; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-md);">
                <div style="width: 60px; height: 60px; background: var(--panel-2); border-radius: 50%; margin: 0 auto 10px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text);">AS</div>
                <h4>Alice Smith</h4>
                <p style="color:var(--muted); font-size:0.85rem;">Head, AISERS</p>
                <p style="margin-top:5px; font-size:0.85rem;"><i class="fa-solid fa-phone"></i> 0998-765-4321</p>
            </div>
            <div style="text-align: center; padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-md);">
                <div style="width: 60px; height: 60px; background: var(--panel-2); border-radius: 50%; margin: 0 auto 10px; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text);">BR</div>
                <h4>Bob Ross</h4>
                <p style="color:var(--muted); font-size:0.85rem;">Rep, ELITECH</p>
                <p style="margin-top:5px; font-size:0.85rem;"><i class="fa-solid fa-phone"></i> 0917-123-4567</p>
            </div>
        </div>
    `
};

function switchOrgTab(tabName, btn) {
    // Update Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update Content
    const contentDiv = document.getElementById('tab-content');
    contentDiv.innerHTML = orgTabsContent[tabName];
    
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
    if(confirm('Are you sure you want to logout?')) {
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
    
    if(sbIcon) sbIcon.className = 'fa-solid fa-sun nav-icon';
    if(sbText) sbText.innerText = 'Light Mode';
    if(mobIcon) mobIcon.className = 'fa-solid fa-sun';
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderDashboard();
    renderServices();
    renderProfile();
    switchOrgTab('about', document.querySelector('.tab-btn')); // Init tab
});