// --- DATA SIMULATION ---
const servicesData = [
    // NEW: Parent Group Items
    { name: "Calculator", org: "Combined", icon: "fa-calculator", color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/businessscical.png" },
    { name: "Rulers", org: "Combined", icon: "fa-ruler", color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/rulerbackground.png" },

    // Existing Specific Items
    { name: "Shoe Rag", org: "AISERS", icon: "fa-shoe-prints", color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/shoerag.png" },
    { name: "Business Calculator", org: "AISERS", icon: "fa-calculator", color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/businesscalculator.png" },
    { name: "Scientific Calculator", org: "SSC, AERO-ATSO", icon: "fa-square-root-variable", color: "#ef4444", backgroundImage: "../assets/photos/studentDashboard/Services/scical.png" },
    { name: "Arnis", org: "AISERS", icon: "fa-hand-fist", color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/arnis.png" },
    { name: "Printing", org: "SSC, CYC, AMTSO, AET", icon: "fa-print", color: "#ef4444" },
    { name: "Network Crimping Tool", org: "ELITECH", icon: "fa-pliers", color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/crimpingtool.png" },
    { name: "Mini Fan", org: "ELITECH", icon: "fa-fan", color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/minifan.png" },
    { name: "Network Cable Tester", org: "ELITECH", icon: "fa-bolt", color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/tester.png" },
    { name: "T-Square", org: "General", icon: "fa-ruler-combined", color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/tsquare.png" },
    { name: "Triangle Ruler", org: "General", icon: "fa-shapes", color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/triangle.png" },
    { name: "Protractor", org: "General", icon: "fa-rotate", color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/protractor.png" },
    { name: "1x1 Photo Processing", org: "SSC", icon: "fa-camera", color: "#ef4444" },
    { name: "Lockers", org: "SSC", icon: "fa-box-archive", color: "#ef4444", backgroundImage: "../assets/photos/studentDashboard/Services/locker.png" }
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
    { name: "Supreme Student Council", category: "Council", imgSeed: "council", color: "#002147", image: "../assets/photos/studentDashboard/Organization/SSC.png", banner: "../assets/photos/studentDashboard/Organization/banners/sscbanner.png" },
    // ICS
    {
        name: "AISERS",
        category: "ICS",
        imgSeed: "network",
        color: "#f59e0b",
        image: "../assets/photos/studentDashboard/Organization/AISERS.png",
        banner: "../assets/photos/studentDashboard/Organization/banners/aisersbanner.jpg"
    },
    // ILAS
    { name: "ILASSO", category: "ILAS", imgSeed: "book", color: "#ef4444", image: "../assets/photos/studentDashboard/Organization/ILASSO.png", banner: "../assets/photos/studentDashboard/Organization/banners/ilassobanner.jpg" },
    // INET
    { name: "ELITECH", category: "INET", imgSeed: "electronic", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/ELITECH.png", banner: "../assets/photos/studentDashboard/Organization/banners/elitechbanner.png" },
    { name: "AERO-ATSO", category: "INET", imgSeed: "plane", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AEROATSO.png", banner: "../assets/photos/studentDashboard/Organization/banners/aeroatsobanner.png" },
    { name: "AETSO", category: "INET", imgSeed: "industry", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AET.png", banner: "../assets/photos/studentDashboard/Organization/banners/aetsobanner.jpg" },
    { name: "AMTSO", category: "INET", imgSeed: "gear", color: "#6366f1", image: "../assets/photos/studentDashboard/Organization/AMT.png", banner: "../assets/photos/studentDashboard/Organization/banners/amtbanner.png" },
    // Interest Club
    { name: "RCYC", category: "Interest Club", imgSeed: "bicycle", color: "#059669", image: "../assets/photos/studentDashboard/Organization/RCYC.png", banner: "../assets/photos/studentDashboard/Organization/banners/rcycbanner.png" },
    { name: "CYC", category: "Interest Club", imgSeed: "child", color: "#059669", image: "../assets/photos/studentDashboard/Organization/CYC.png", banner: "../assets/photos/studentDashboard/Organization/banners/cycbanner.png" },
    { name: "Scholar’s Guild", category: "Interest Club", imgSeed: "grad", color: "#059669", image: "../assets/photos/studentDashboard/Organization/PSG.png", banner: "../assets/photos/studentDashboard/Organization/banners/scholarsguildbanner.jpg" },
    { name: "Aeronautica", category: "Interest Club", imgSeed: "rocket", color: "#059669", image: "../assets/photos/studentDashboard/Organization/AERONAUTICA.png", banner: "../assets/photos/studentDashboard/Organization/banners/aeronauticabanner.jpg" }
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
    },
    {
        title: "AIS-SAHAN: Constinuency Check",
        date: "Feb. 05, 2026",
        time: "TBA",
        venue: "TBA",
        participants: 0,
        description: "Consistency check for AIS-SAHAN.",
        org: "General",
        img: "https://picsum.photos/seed/ais-sahan/600/400",
        gallery: [
            "https://picsum.photos/seed/ais-sahan/600/400"
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
        `;
    } else if (tabName === 'membership') {
        // --- MEMBERSHIP LAYOUT (Grid + Modal) ---
        contentDiv.innerHTML = `
            <div class="membership-dashboard-wrapper">

                <div class="membership-split-layout">
                    <div class="recruitment-feed">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h3 class="section-title" style="margin:0; font-size:1.5rem; color:var(--primary);">Recruiting Organizations</h3>
                            <span style="font-size:0.9rem; color:var(--muted);">Select an organization to apply</span>
                        </div>
                        
                        <div class="recruitment-grid" id="recruitmentGrid">
                            </div>
                    </div>
                </div>

                <div id="membershipApplicationModal" class="modal-overlay">
                    <div class="modal-content membership-modal-content">
                        
                        <div class="modal-header">
                            <button class="close-modal" onclick="closeMembershipModal()">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div class="modal-body">
                            <h3 style="color: var(--primary); font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">
                                Application for Membership
                            </h3>
                            <p class="form-description">
                                To apply, verify the organization details, complete the form below, attach required documents, then click Submit.
                            </p>
                            
                            <form id="membershipForm" onsubmit="handleMembershipSubmit(event)">
                                
                                <div class="form-group">
                                    <label style="font-weight: 600; font-size: 0.9rem; color: var(--primary);">Full Name</label>
                                    <input type="text" id="mem-fullname" 
                                        style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9;" required>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 600; font-size: 0.9rem; color: var(--primary);">Email</label>
                                    <input type="email" id="mem-email" 
                                        style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9;" required>
                                </div>

                                <div class="role-toggle-group">
                                    <button type="button" class="role-btn" onclick="selectRole('Officer', this)">Officer</button>
                                    <button type="button" class="role-btn" onclick="selectRole('Junior Officer', this)" style="background: #002147;">Junior Officer</button>
                                    <input type="hidden" id="mem-role-input" value="Junior Officer">
                                </div>

                                <div class="download-form-container">
                                    <div class="download-text-group">
                                        <i class="fa-solid fa-file-pdf download-icon"></i>
                                        <span>Download Application Form</span>
                                    </div>
                                    <button type="button" class="btn-download-app" onclick="downloadApplicationForm()">
                                        Download
                                    </button>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 600; font-size: 0.9rem; color: var(--primary);">Upload file here</label>
                                    
                                    <div class="custom-upload-box" id="mem-upload-box" onclick="triggerFileUpload()">
                                        <span class="upload-placeholder-text">Upload Application Form</span>
                                        <div class="upload-plus-icon"><i class="fa-solid fa-plus"></i></div>
                                    </div>
                                    
                                    <input type="file" id="mem-file-upload" hidden onchange="handleFilePreview(this)" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                                </div>

                                <button type="submit" class="btn-submit-wide">
                                    Submit Application
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Inject Recruitment Cards
        const grid = document.getElementById('recruitmentGrid');

        // NEW: Check if data is empty before rendering
        if (organizationData.length === 0) {
            grid.innerHTML = `
                <div class="recruitment-empty-state">
                    <i class="fa-solid fa-folder-open empty-state-icon"></i>
                    <div class="empty-state-title">No Available Organizations</div>
                    <div class="empty-state-desc">
                        There are currently no organizations accepting applications. 
                        Please check back later for future recruitment announcements.
                    </div>
                </div>
            `;
        } else {
            // EXISTING LOGIC: Loop through data if items exist
            organizationData.forEach((org, index) => {
                const card = document.createElement('div');
                card.className = 'recruit-card';
                card.id = `recruit-card-${index}`;

                card.innerHTML = `
                <div class="recruit-header" style="background:${org.color}"></div>
                <div class="recruit-body">
                    <img src="${org.image || `https://picsum.photos/seed/${org.imgSeed}/100/100`}" class="recruit-logo">
                    <div class="recruit-info-group">
                        <h4>${org.name}</h4>
                        <span class="recruit-badge">Open for Officers</span>
                        <p class="recruit-desc">We are looking for passionate individuals to lead our upcoming projects.</p>
                    </div>
                    <button class="btn-apply-recruit" onclick="openMembershipModal('${org.name}', 'recruit-card-${index}')">
                        Apply Now
                    </button>
                </div>
            `;
                grid.appendChild(card);
            });
        }

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
                        <div class="event-actions">
                            <!-- NEW SHARE BUTTON -->
                            <button class="btn-share" onclick="shareEvent('${ev.title}')">
                                Share <i class="fa-solid fa-share-nodes"></i>
                            </button>
                            
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



// --- CALENDAR STATE ---
let currentCalendarDate = new Date();

// --- CALENDAR FUNCTIONS ---

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth(); // 0-11

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Update Header
    document.getElementById('calendarMonthYear').innerText = `${monthNames[month]} ${year}`;

    const daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';

    // Logic to get days in month and start day
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous Month Days (Trailing)
    const prevMonthDays = new Date(year, month, 0).getDate();

    // We want a fixed 6 rows * 7 days = 42 cells
    // 1. Previous Month Days
    for (let x = firstDayIndex; x > 0; x--) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        dayDiv.innerText = prevMonthDays - x + 1;
        daysContainer.appendChild(dayDiv);
    }

    // 2. Current Month Days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        dayDiv.innerText = i;

        // Highlight today
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }

        // ADD CLICK HANDLER
        dayDiv.onclick = (e) => handleDateClick(year, month, i, e);

        // Check for events on this day
        const dayEvents = getEventsForDate(year, month, i);
        if (dayEvents.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.classList.add('event-dots');
            dayEvents.slice(0, 3).forEach(() => {
                const dot = document.createElement('div');
                dot.classList.add('event-dot');
                dotsContainer.appendChild(dot);
            });
            dayDiv.appendChild(dotsContainer);

            const eventTitles = dayEvents.map(e => e.title).join(', ');
            dayDiv.title = eventTitles;
        }

        daysContainer.appendChild(dayDiv);
    }

    // 3. Next Month Days (Leading) to fill 42 cells
    const filledCells = firstDayIndex + daysInMonth;
    const nextDays = 42 - filledCells;

    for (let j = 1; j <= nextDays; j++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        dayDiv.innerText = j;
        daysContainer.appendChild(dayDiv);
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

// --- CALENDAR DATE CLICK & POPOVER LOGIC ---

function handleDateClick(year, month, day, event) {
    const clickedDate = new Date(year, month, day);
    const options = { month: 'short', day: 'numeric' };
    const dateStr = clickedDate.toLocaleDateString('en-US', options);

    // Find events
    const events = getEventsForDate(year, month, day);

    // Populate Popover
    const popoverTitle = document.getElementById('popoverDateTitle');
    const popoverList = document.getElementById('popoverEventList');

    popoverTitle.innerText = `Events on ${dateStr}`;
    popoverList.innerHTML = '';

    if (events.length > 0) {
        events.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'popover-event-item';
            item.innerHTML = `
                <span class="popover-event-title">${ev.title}</span>
                <button class="btn-popover-view" onclick="navigateToEventDetails('${ev.title}')">View</button>
            `;
            popoverList.appendChild(item);
        });
    } else {
        popoverList.innerHTML = `<div class="no-events-msg">No events scheduled.</div>`;
    }

    // Position Popover
    const popover = document.getElementById('calendarPopover');

    if (window.innerWidth <= 768) {
        // Mobile: handled by CSS (center fixed)
        popover.style.position = '';
        popover.style.left = '';
        popover.style.top = '';
    } else {
        // Desktop: Position near the click, but don't go off screen
        const clickX = event.clientX;
        const clickY = event.clientY;

        popover.style.position = 'fixed';
        popover.style.left = `${clickX + 10}px`;
        popover.style.top = `${clickY + 10}px`;

        // Simple boundary check (prevent going off right edge)
        if (clickX + 300 > window.innerWidth) {
            popover.style.left = `${clickX - 290}px`;
        }
    }

    // Show
    hideCalendarPopover();
    popover.classList.remove('hidden');
    setTimeout(() => {
        popover.classList.add('visible');
    }, 10);
}

function hideCalendarPopover() {
    const popover = document.getElementById('calendarPopover');
    if (!popover) return;
    popover.classList.remove('visible');
    popover.classList.add('hidden');
}

function navigateToEventDetails(eventTitle) {
    hideCalendarPopover();
    navigate('organizations');

    const buttons = document.querySelectorAll('.tab-btn');
    let eventsTabBtn = null;
    buttons.forEach(btn => {
        if (btn.innerText.includes('Events')) eventsTabBtn = btn;
    });

    if (eventsTabBtn) {
        switchOrgTab('events', eventsTabBtn);
    }

    setTimeout(() => {
        openDetailsModal(eventTitle);
    }, 100);
}

// --- GLOBAL LISTENER TO CLOSE POPOVER ON OUTSIDE CLICK ---
document.addEventListener('click', function (e) {
    const popover = document.getElementById('calendarPopover');
    const calendarGrid = document.getElementById('calendarDays');
    if (!popover || !calendarGrid) return;

    if (popover.classList.contains('visible') &&
        !popover.contains(e.target) &&
        !calendarGrid.contains(e.target)) {
        hideCalendarPopover();
    }
});

// Helper to check if extendedEvents match the current calendar day
function getEventsForDate(year, month, day) {
    return extendedEvents.filter(event => {
        // Extended Events Date Format: "Nov. 11-24, 2024" or "Nov. 11, 2024"
        const dateStr = event.date;

        // Simple regex to extract parts
        // Matches: "Month. Start-End, Year" or "Month. Start, Year"
        const regex = /([a-zA-Z]+)\.\s+(\d+)(?:-(\d+))?,\s+(\d+)/;
        const match = dateStr.match(regex);

        if (match) {
            const eventYear = parseInt(match[4]);
            const eventMonthStr = match[1];
            const startDay = parseInt(match[2]);
            const endDay = match[3] ? parseInt(match[3]) : startDay;

            // Convert month string to index (e.g., "Nov" -> 10)
            const monthMap = {
                "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
                "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
            };

            const eventMonthIndex = monthMap[eventMonthStr.substring(0, 3)]; // Handle "November" vs "Nov"

            if (eventYear === year && eventMonthIndex === month) {
                return day >= startDay && day <= endDay;
            }
        }
        return false;
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

    // NEW: Render Calendar
    renderCalendar();
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


// --- DASHBOARD EVENT TODAY CAROUSEL LOGIC ---

let carouselInterval;
let currentDashboardSlideIndex = 0;

function initDashboardCarousel() {
    const track = document.getElementById('dashboardCarouselTrack');
    if (!track) return;

    track.innerHTML = ''; // Clear previous

    // 1. Determine which event to show (Logic from previous step)
    const today = new Date();
    const currentMonth = today.toLocaleString('en-us', { month: 'short' });
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    let todaysEvent = extendedEvents.find(ev => {
        const regex = /([a-zA-Z]+)\.\s+(\d+)(?:-(\d+))?,\s+(\d+)/;
        const match = ev.date.match(regex);
        if (match) {
            const eventYear = parseInt(match[4]);
            const eventMonthStr = match[1];
            const startDay = parseInt(match[2]);
            const endDay = match[3] ? parseInt(match[3]) : startDay;

            if (eventYear === currentYear && eventMonthStr.includes(currentMonth)) {
                if (currentDay >= startDay && currentDay <= endDay) return true;
            }
        }
        return false;
    });

    // Fallback to first event
    if (!todaysEvent) {
        todaysEvent = extendedEvents[0];
    }

    // 2. Prepare Images
    let images = [];
    if (todaysEvent.gallery && todaysEvent.gallery.length > 0) {
        images = todaysEvent.gallery;
    } else {
        images = [todaysEvent.img];
    }

    // 3. Create Image Elements
    images.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'carousel-slide-img';
        if (index === 0) img.classList.add('active');
        track.appendChild(img);
    });

    // 4. Reset state
    currentDashboardSlideIndex = 0;

    // 5. Start Auto-Rotation (3 seconds)
    if (carouselInterval) clearInterval(carouselInterval);

    const slides = track.getElementsByClassName('carousel-slide-img');

    if (slides.length > 1) {
        carouselInterval = setInterval(() => {
            moveDashboardSlide(1);
        }, 3000);
    }
}

// Function to manually move slides (for arrows)
function moveDashboardSlide(direction) {
    const track = document.getElementById('dashboardCarouselTrack');
    if (!track) return;

    const slides = track.getElementsByClassName('carousel-slide-img');
    if (slides.length === 0) return;

    // Remove active from current
    slides[currentDashboardSlideIndex].classList.remove('active');

    // Calculate new index
    currentDashboardSlideIndex = currentDashboardSlideIndex + direction;

    // Wrap around logic
    if (currentDashboardSlideIndex >= slides.length) {
        currentDashboardSlideIndex = 0;
    } else if (currentDashboardSlideIndex < 0) {
        currentDashboardSlideIndex = slides.length - 1;
    }

    // Add active to new
    slides[currentDashboardSlideIndex].classList.add('active');

    // Reset timer on manual interaction so it doesn't jump immediately after click
    if (slides.length > 1) {
        clearInterval(carouselInterval);
        carouselInterval = setInterval(() => {
            moveDashboardSlide(1);
        }, 3000);
    }
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    renderDashboard();
    renderServices();
    renderProfile();
    switchOrgTab('about', document.querySelector('.tab-btn'));

    // Initialize Dashboard Carousel for the new layout
    initDashboardCarousel();
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

// --- SHARE EVENT FUNCTION ---
function shareEvent(eventTitle) {
    // Create a mock shareable URL
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?event=${encodeURIComponent(eventTitle)}`;

    // Check if Web Share API is supported (Mobile devices mostly)
    if (navigator.share) {
        navigator.share({
            title: eventTitle,
            text: `Check out this event: ${eventTitle}`,
            url: shareUrl
        }).catch((error) => console.log('Error sharing:', error));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast("Event link copied to clipboard!");
        }).catch((err) => {
            console.error('Failed to copy: ', err);
            showToast("Failed to copy link.");
        });
    }
}

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
        items: ["Calculator", "Rulers"] // Replaced specific items with generic ones
    },
    laboratory: {
        title: "Laboratory",
        icon: "fa-flask",
        items: ["Shoe Rag", "Network Crimping Tool", "Network Cable Tester"]
    },
    equipment: {
        title: "Equipment & Utilities",
        icon: "fa-toolbox",
        items: ["Arnis", "Mini Fan", "Lockers"]
    }
};

// Configuration for Parent -> Children mapping
const serviceGroups = {
    "Calculator": ["Business Calculator", "Scientific Calculator"],
    "Rulers": ["Rulers", "T-Square", "Triangle Ruler", "Protractor"]
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
                card.className = 'service-card'; // Base class

                // --- UPDATED LOGIC FOR OPTION 1 ---
                if (service.backgroundImage) {
                    // Apply Gallery Layout Class
                    card.classList.add('gallery-card');

                    // New HTML Structure: Image Top, Text Bottom
                    card.innerHTML = `
                        <div class="gallery-img-wrapper">
                            <img src="${service.backgroundImage}" alt="${service.name}" loading="lazy">
                        </div>
                        <div class="gallery-content">
                            <div class="service-name">${service.name}</div>
                        </div>
                    `;
                } else {
                    // Fallback for Icon-only items (No change needed here)
                    card.innerHTML = `
                        <div class="service-icon">
                            <i class="fa-solid ${service.icon}"></i>
                        </div>
                        <div>
                            <div class="service-name">${service.name}</div>
                        </div>
                    `;
                }

                // INTERACTION LOGIC
                if (serviceGroups[service.name]) {
                    // NEW: Check if this item is a Parent Group
                    card.onclick = () => openItemSelectModal(service.name);
                    card.style.cursor = "pointer";
                    card.setAttribute('role', 'button');
                    card.setAttribute('aria-label', `Select type for ${service.name}`);
                    card.setAttribute('tabindex', '0');
                    card.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openItemSelectModal(service.name);
                        }
                    };
                } else {
                    // Existing Logic: Regular Service
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
    "Business Calculator": ["AISERS"],
    "Scientific Calculator": ["SSC", "AERO-ATSO"],
    "Arnis": ["AISERS"],
    "Printing": ["SSC", "CYC", "AMTSO", "AET"],
    "Network Crimping Tool": ["ELITECH"],
    "Mini Fan": ["ELITECH"],
    "Network Cable Tester": ["ELITECH"],
    "Rulers": ["AMTSO"],
    "T-Square": ["AMTSO", "AERO-ATSO"],
    "Triangle Ruler": ["AMTSO"],
    "Protractor": ["AMTSO"],
    "1x1 Photo Processing": ["SSC"],
    "Lockers": ["SSC"]
};

// --- CONFIGURATION CONSTANTS ---
const OPERATING_HOURS = {
    OPEN: 7 * 60,  // 7:00 AM in minutes
    CLOSE: 16 * 60, // 4:00 PM in minutes
    OPEN_STR: "07:00 AM",
    CLOSE_STR: "04:00 PM"
};
const MAX_ADVANCE_DAYS = 1;  // 1 day ahead only
const RATE_PER_HOUR = 10.00;  // ₱10 per hour
const RATE_PER_HALF_HOUR = 5.00;  // ₱5 per 30 minutes

// --- GLOBAL STATE ---
let currentSelectedService = null;
let currentSelectedOrg = null;
let currentParentGroup = null; // Track if we came from a group (e.g. Calculator)
let rentalData = {
    date: "",
    startTime: "",
    duration: "",
    endTime: "",
    hours: 0,
    amount: 0
};

// --- MODAL FUNCTIONS ---

// --- MODAL NAVIGATION (STEP 1 <-> STEP 2) ---

// --- ITEM SELECTION MODAL LOGIC ---

function openItemSelectModal(parentName) {
    // Reset State
    resetModalState();

    const modal = document.getElementById('serviceSelectModal');
    const titleEl = document.getElementById('modalTitle');
    const subtitleEl = document.getElementById('modalSubtitle');
    const listContainer = document.getElementById('itemSelectList');

    // Set State
    currentParentGroup = parentName;

    // Get children from config
    const children = serviceGroups[parentName] || [];

    // Set Content
    titleEl.innerText = `Select ${parentName} Type`;
    titleEl.className = 'step-0-header'; // Apply large centered title style
    subtitleEl.style.display = 'none'; // Hide subtitle for this clean layout
    listContainer.innerHTML = '';

    // Switch to horizontal grid layout, add grid-2x2 for 4 items, grid-1x2 for 2 items
    listContainer.className = 'item-type-grid';
    if (children.length === 4) {
        listContainer.classList.add('grid-2x2');
    } else if (children.length === 2) {
        listContainer.classList.add('grid-1x2');
    }

    children.forEach(childName => {
        // Find full data for the child
        const childData = servicesData.find(s => s.name === childName);

        const card = document.createElement('div');
        card.className = 'item-type-card';

        // Interaction: Close item modal, proceed to org modal
        card.onclick = () => {
            closeItemSelectModal();
            openServiceModal(childName, parentName);
        };

        // Accessibility
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        };

        // Render Content
        if (childData && childData.backgroundImage) {
            // Use Background Image
            card.innerHTML = `
                <div class="item-type-image-wrapper">
                    <img src="${childData.backgroundImage}" alt="${childName}">
                </div>
                <div class="item-type-title">${childName}</div>
            `;
        } else {
            // Fallback: Icon + Background Color
            const icon = childData ? childData.icon : 'fa-box';
            card.innerHTML = `
                <div class="item-type-image-wrapper" style="background-color: #e2e8f0;">
                    <i class="fa-solid ${icon} item-type-icon"></i>
                </div>
                <div class="item-type-title">${childName}</div>
            `;
        }

        listContainer.appendChild(card);
    });

    // Show Modal (Step 0)
    showStep0();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(modal);
}

function closeItemSelectModal() {
    closeServiceModal();
}

// Close item modal on ESC
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeServiceModal();
    }
});

function handleBackToItemSelect() {
    if (currentParentGroup) {
        openItemSelectModal(currentParentGroup);
    }
}

function openServiceModal(serviceName, parentGroup = null) {
    // Reset State
    resetModalState();

    const modal = document.getElementById('serviceSelectModal');
    const titleEl = document.getElementById('modalTitle');
    const subtitleEl = document.getElementById('modalSubtitle');
    const listContainer = document.getElementById('orgSelectList');
    const continueBtn = document.getElementById('btnStep1Continue');

    // Set State
    currentSelectedService = serviceName;
    currentSelectedOrg = null;
    currentParentGroup = parentGroup; // Store for back navigation
    continueBtn.disabled = true;

    // Set Content
    titleEl.innerText = "Select an Organization";
    subtitleEl.innerText = `Choose who will provide: ${serviceName}`;
    listContainer.innerHTML = '';

    // Populate Orgs (Existing Logic)
    const orgs = serviceOrgMapping[serviceName] || [];

    // Logo Mapping
    const orgLogos = {
        "AISERS": "../assets/photos/studentDashboard/Organization/AISERS.png",
        "AMTSO": "../assets/photos/studentDashboard/Organization/AMT.png",
        "AERO-ATSO": "../assets/photos/studentDashboard/Organization/AEROATSO.png",
        "ELITECH": "../assets/photos/studentDashboard/Organization/ELITECH.png",
        "SSC": "../assets/photos/studentDashboard/Organization/SSC.png",
        "Supreme Student Council": "../assets/photos/studentDashboard/Organization/SSC.png"
    };

    if (orgs.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--muted); padding:20px;">No organizations found for this service.</div>`;
    } else {
        orgs.forEach((orgName, index) => {
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

            // Check if we have a logo, otherwise initials
            const logoPath = orgLogos[orgName];
            const initials = orgName.substring(0, 2).toUpperCase();

            const avatarContent = logoPath
                ? `<img src="${logoPath}" alt="${orgName} logo">`
                : initials;

            card.innerHTML = `
                <div class="org-info">
                    <div class="org-avatar">${avatarContent}</div>
                    <div class="org-name-text">${orgName}</div>
                </div>
                <i class="fa-solid fa-circle-check check-icon"></i>
            `;
            listContainer.appendChild(card);

            if (orgs.length === 1) selectOrgOption(orgName, card);
        });
    }

    // Show Modal (Step 1)
    showStep1();
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
    resetModalState();
}

function selectOrgOption(orgName, cardElement) {
    currentSelectedOrg = orgName;
    const allCards = document.querySelectorAll('.org-option-card');
    allCards.forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    document.getElementById('btnStep1Continue').disabled = false;
}

function handleServiceContinue() {
    if (!currentSelectedService || !currentSelectedOrg) return;
    // Transition to Step 2
    showStep2();
}

function handleBackToStep1() {
    // Return to Step 1
    showStep1();
}

function resetModalState() {
    currentSelectedService = null;
    currentSelectedOrg = null;
    currentParentGroup = null;
    rentalData = { date: "", startTime: "", duration: "", endTime: "", hours: 0, amount: 0 };

    // Reset Inputs
    document.getElementById('rentalDate').value = "";
    document.getElementById('startTime').value = "";
    document.getElementById('duration').value = "";

    // Reset Displays
    document.getElementById('endTimeDisplay').innerText = "--:-- --";
    document.getElementById('totalAmountDisplay').innerText = "₱0.00";
    document.getElementById('rentalErrorMessage').innerText = "";
    document.getElementById('rentalErrorMessage').classList.remove('visible');

    // Reset Buttons
    document.getElementById('btnStep1Continue').disabled = true;
    document.getElementById('btnStep2Confirm').disabled = true;
    document.getElementById('btnModalBack').style.display = 'none';

    // Clear Org Selection visual
    document.querySelectorAll('.org-option-card').forEach(c => c.classList.remove('selected'));
}

// --- VIEW CONTROLLERS ---

function showStep0() {
    document.getElementById('step0-item-selection').style.display = 'block';
    document.getElementById('step1-org-selection').style.display = 'none';
    document.getElementById('step2-rental-details').style.display = 'none';

    document.getElementById('modalTitle').innerText = `Select ${currentParentGroup || 'Item'} Type`;
    document.getElementById('modalSubtitle').innerText = "Choose the specific type you need...";

    // Footer Buttons for Step 0
    document.getElementById('btnStep1Cancel').style.display = 'inline-block';
    document.getElementById('btnStep1Continue').style.display = 'none';

    // Header Back Button
    document.getElementById('btnModalBack').style.display = 'none';
}

function showStep1() {
    document.getElementById('step0-item-selection').style.display = 'none';
    document.getElementById('step1-org-selection').style.display = 'block';
    document.getElementById('step2-rental-details').style.display = 'none';

    document.getElementById('modalTitle').innerText = "Select an Organization";
    document.getElementById('modalSubtitle').innerText = `Choose who will provide: ${currentSelectedService || '...'}`;

    // Header Back Button visibility & action
    const backBtn = document.getElementById('btnModalBack');
    if (currentParentGroup) {
        backBtn.style.display = 'flex';
        backBtn.onclick = handleBackToItemSelect;
        document.getElementById('btnStep1Cancel').style.display = 'none';
    } else {
        backBtn.style.display = 'none';
        document.getElementById('btnStep1Cancel').style.display = 'inline-block';
    }

    document.getElementById('btnStep1Continue').style.display = 'inline-block';
    document.getElementById('btnStep2Confirm').style.display = 'none';
}

function showStep2() {
    document.getElementById('step0-item-selection').style.display = 'none';
    document.getElementById('step1-org-selection').style.display = 'none';
    document.getElementById('step2-rental-details').style.display = 'block';

    document.getElementById('modalTitle').innerText = "Rental Details";
    document.getElementById('modalSubtitle').innerText = `Provider: ${currentSelectedOrg}`;

    // Header Back Button
    const backBtn = document.getElementById('btnModalBack');
    backBtn.style.display = 'flex';
    backBtn.onclick = handleBackToStep1;

    // Toggle Footer Buttons
    document.getElementById('btnStep1Cancel').style.display = 'none';
    document.getElementById('btnStep1Continue').style.display = 'none';
    document.getElementById('btnStep2Confirm').style.display = 'inline-block';

    // Set Date Input Constraints (Min = Today, Max = Today + 1 day)
    const dateInput = document.getElementById('rentalDate');
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + MAX_ADVANCE_DAYS);

    dateInput.min = today.toISOString().split('T')[0];
    dateInput.max = maxDate.toISOString().split('T')[0];

    // Trigger initial calculation
    calculateRental();
}

// --- RENTAL LOGIC & VALIDATION ---

// Helper: Convert "HH:mm" to minutes from midnight
function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

// Helper: Convert minutes from midnight to "HH:mm AM/PM"
function minutesToTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}

function calculateRental() {
    const dateInput = document.getElementById('rentalDate');
    const startInput = document.getElementById('startTime');
    const durationInput = document.getElementById('duration');
    const endDisplay = document.getElementById('endTimeDisplay');
    const priceDisplay = document.getElementById('totalAmountDisplay');
    const errorMsg = document.getElementById('rentalErrorMessage');
    const confirmBtn = document.getElementById('btnStep2Confirm');

    // Clear previous errors
    errorMsg.innerText = "";
    errorMsg.classList.remove('visible');
    startInput.classList.remove('input-error');
    durationInput.classList.remove('input-error');

    const dateVal = dateInput.value;
    const startVal = startInput.value;
    const durationVal = parseFloat(durationInput.value);

    // 1. Base Validation (Presence)
    if (!dateVal || !startVal || !durationVal) {
        endDisplay.innerText = "--:-- --";
        confirmBtn.disabled = true;
        return;
    }

    const startMinutes = timeToMinutes(startVal);
    const durationMinutes = durationVal * 60;
    const endMinutes = startMinutes + durationMinutes;
    const totalHours = durationVal;

    // 2. Date Validation (Max 1 day ahead)
    const selectedDate = new Date(dateVal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + MAX_ADVANCE_DAYS);

    if (selectedDate < today || selectedDate > maxDate) {
        showError("Date must be today or tomorrow only.");
        confirmBtn.disabled = true;
        return;
    }

    // 3. Operating Hours Validation (7:00 AM - 4:00 PM)
    if (startMinutes < OPERATING_HOURS.OPEN) {
        showError(`Reservations start at ${OPERATING_HOURS.OPEN_STR}.`);
        startInput.classList.add('input-error');
        confirmBtn.disabled = true;
        return;
    }

    if (endMinutes > OPERATING_HOURS.CLOSE) {
        showError(`End time exceeds ${OPERATING_HOURS.CLOSE_STR}. Please shorten duration.`);
        startInput.classList.add('input-error');
        durationInput.classList.add('input-error');
        confirmBtn.disabled = true;
        return;
    }

    // 4. Calculate Price (₱10 per hour + ₱5 per 30 minutes)
    const wholeHours = Math.floor(totalHours);
    const halfHours = (totalHours - wholeHours) > 0 ? 1 : 0;
    const calculatedAmount = (wholeHours * RATE_PER_HOUR) + (halfHours * RATE_PER_HALF_HOUR);

    // 5. Valid State: Update UI
    rentalData.date = dateVal;
    rentalData.startTime = startVal;
    rentalData.hours = totalHours;
    rentalData.endTime = minutesToTime(endMinutes);
    rentalData.amount = calculatedAmount;

    // Update Displays
    endDisplay.innerText = rentalData.endTime;
    priceDisplay.innerText = `₱${rentalData.amount.toFixed(2)}`;

    // Enable Confirm
    confirmBtn.disabled = false;
}

function showError(message) {
    const errorMsg = document.getElementById('rentalErrorMessage');
    errorMsg.innerText = message;
    errorMsg.classList.add('visible');

    // Reset calculated displays on error
    document.getElementById('endTimeDisplay').innerText = "--:-- --";
    document.getElementById('totalAmountDisplay').innerText = "₱0.00";
}

function confirmRental() {
    // Final Data Model check
    console.log("FINAL RENTAL DATA:", {
        service: currentSelectedService,
        organization: currentSelectedOrg,
        ...rentalData
    });

    showToast(`Rental Confirmed: ${currentSelectedOrg} - ${rentalData.date} @ ${rentalData.startTime}`);
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

// 3. Step 1 Continue Button Click
document.getElementById('btnStep1Continue').addEventListener('click', handleServiceContinue);

// 4. Step 2 Rental Form Input Listeners
document.addEventListener('DOMContentLoaded', () => {
    const inputs = ['rentalDate', 'startTime', 'duration'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateRental);
            el.addEventListener('change', calculateRental); // For date pickers/time pickers
        }
    });

    // 5. Confirm Button Logic
    const confirmBtn = document.getElementById('btnStep2Confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmRental);
    }
});

// --- MEMBERSHIP FORM LOGIC ---

// 1. Open Modal and Fill Data
function openMembershipModal(orgName, cardId) {
    const modal = document.getElementById('membershipApplicationModal');

    // Store the organization name in a data attribute for submission
    if (modal) {
        modal.setAttribute('data-selected-org', orgName);
    }

    // --- NEW: BANNER LOGIC ---
    // Find the organization data
    const orgData = organizationData.find(o => o.name === orgName);
    const modalHeader = modal ? modal.querySelector('.modal-header') : null;

    if (modalHeader && orgData) {
        if (orgData.banner) {
            // Set the specific banner if available
            modalHeader.style.backgroundImage = `url('${orgData.banner}')`;
        } else {
            // Fallback: Clear image or set a default pattern/color
            modalHeader.style.backgroundImage = 'none';
            modalHeader.style.backgroundColor = orgData.color || 'var(--panel-2)';
        }
    }
    // -------------------------

    // Highlight selected card visually (in the background grid)
    document.querySelectorAll('.recruit-card').forEach(c => c.classList.remove('selected-org-card'));
    const card = document.getElementById(cardId);
    if (card) card.classList.add('selected-org-card');

    // Show Modal
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

// 2. Close Modal
function closeMembershipModal() {
    const modal = document.getElementById('membershipApplicationModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';

        // --- NEW: CLEANUP ---
        // Reset the background image to avoid flashing the wrong one next time
        const modalHeader = modal.querySelector('.modal-header');
        if (modalHeader) {
            setTimeout(() => {
                modalHeader.style.backgroundImage = '';
            }, 300); // Wait for transition to finish
        }
    }
}

// 3. Close Modal on Outside Click
window.addEventListener('click', (e) => {
    const modal = document.getElementById('membershipApplicationModal');
    if (e.target === modal) {
        closeMembershipModal();
    }
});

// 2. Role Selection Logic (Visual Toggle)
function selectRole(role, btnElement) {
    // Set hidden input value
    document.getElementById('mem-role-input').value = role;

    // Visual update (Reset all buttons to look like the image - solid dark blue)
    // Note: The image shows both as dark buttons, but usually one is active. 
    // I will add a slight opacity change to indicate selection for UX.
    const buttons = btnElement.parentElement.querySelectorAll('.role-btn');
    buttons.forEach(b => {
        b.style.opacity = "0.6"; // Dim others
        b.style.border = "none";
    });

    btnElement.style.opacity = "1"; // Active one is fully opaque
}

// --- FILE PREVIEW LOGIC (With PDF Pagination) ---

// State variables for PDF navigation
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;

// 1. Trigger the hidden input
function triggerFileUpload() {
    const box = document.getElementById('mem-upload-box');
    if (!box.classList.contains('has-preview')) {
        document.getElementById('mem-file-upload').click();
    }
}

// 2. Handle File Selection
function handleFilePreview(input) {
    const box = document.getElementById('mem-upload-box');

    if (input.files && input.files[0]) {
        const file = input.files[0];
        box.classList.add('has-preview');

        // A. Handle PDF (Multi-page)
        if (file.type === 'application/pdf') {
            const fileReader = new FileReader();

            fileReader.onload = function () {
                const typedarray = new Uint8Array(this.result);

                // Initialize PDF Loader
                pdfjsLib.getDocument(typedarray).promise.then(function (pdf) {
                    // Set Global State
                    pdfDoc = pdf;
                    pageNum = 1;

                    // Setup HTML Structure with Nav Controls
                    box.innerHTML = `
                        <div class="file-preview-wrapper">
                            <canvas id="pdf-render-canvas" class="pdf-preview-canvas"></canvas>
                            
                            <div class="pdf-nav-controls">
                                <button type="button" class="pdf-nav-btn" id="pdf-prev" onclick="changePdfPage(-1)">
                                    <i class="fa-solid fa-chevron-left"></i>
                                </button>
                                <span class="pdf-page-info">
                                    <span id="page_num">1</span> / <span id="page_count">${pdf.numPages}</span>
                                </span>
                                <button type="button" class="pdf-nav-btn" id="pdf-next" onclick="changePdfPage(1)">
                                    <i class="fa-solid fa-chevron-right"></i>
                                </button>
                            </div>

                            <button type="button" class="btn-remove-file" onclick="removeFile(event)">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    `;

                    // Initial Render
                    renderPage(pageNum);

                }, function (error) {
                    console.error(error);
                    box.innerHTML = `<div style="color:red; font-size:0.9rem;">Error loading PDF.</div>`;
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
        // B. Handle Image
        else if (file.type.match('image.*')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                box.innerHTML = `
                    <div class="file-preview-wrapper">
                        <img src="${e.target.result}" class="file-preview-img" alt="Preview" style="margin-bottom:10px;">
                        <button type="button" class="btn-remove-file" onclick="removeFile(event)">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `;
            }
            reader.readAsDataURL(file);
        }
        // C. Fallback
        else {
            box.innerHTML = `
                <div class="file-preview-wrapper" style="height: 100px;">
                    <i class="fa-regular fa-file-lines" style="font-size:2rem; color:var(--muted); margin-bottom:8px;"></i>
                    <span class="file-name-text" style="font-size:0.85rem;">${file.name}</span>
                    <button type="button" class="btn-remove-file" onclick="removeFile(event)">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }
    }
}

// 3. Render Specific PDF Page
function renderPage(num) {
    pageRendering = true;

    // Fetch page
    pdfDoc.getPage(num).then(function (page) {
        const canvas = document.getElementById('pdf-render-canvas');
        const ctx = canvas.getContext('2d');

        // Scale 1.5 for clarity
        const scale = 1.5;
        const viewport = page.getViewport({ scale: scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render Context
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        // Wait for render to finish
        renderTask.promise.then(function () {
            pageRendering = false;
            if (pageNumPending !== null) {
                // If a page change was requested while rendering, do it now
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Update Counters UI
    document.getElementById('page_num').textContent = num;

    // Update Buttons State
    document.getElementById('pdf-prev').disabled = (num <= 1);
    document.getElementById('pdf-next').disabled = (num >= pdfDoc.numPages);
}

// 4. Handle Page Change Clicks
function changePdfPage(offset) {
    if (!pdfDoc) return;

    // Calculate new page number
    const newPage = pageNum + offset;

    // If request comes while rendering, queue it
    if (pageRendering) {
        pageNumPending = newPage;
    } else {
        // Only proceed if within bounds
        if (newPage > 0 && newPage <= pdfDoc.numPages) {
            pageNum = newPage;
            renderPage(pageNum);
        }
    }

    // Stop click bubbling
    if (typeof event !== 'undefined') event.stopPropagation();
}

// 5. Remove File & Reset
function removeFile(event) {
    event.stopPropagation();

    const box = document.getElementById('mem-upload-box');
    const input = document.getElementById('mem-file-upload');

    // Clear Global PDF State
    pdfDoc = null;
    pageNum = 1;
    pageRendering = false;
    pageNumPending = null;

    input.value = '';
    box.classList.remove('has-preview');
    box.style = "";

    box.innerHTML = `
        <span class="upload-placeholder-text">Upload Here</span>
        <div class="upload-plus-icon"><i class="fa-solid fa-plus"></i></div>
    `;
}

function handleMembershipSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('membershipApplicationModal');
    const org = modal ? modal.getAttribute('data-selected-org') : null;

    if (!org) {
        alert("Organization info missing. Please try again.");
        return;
    }

    // Success Simulation
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    btn.innerText = "Submitting...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    setTimeout(() => {
        // Show success alert
        alert(`Application to ${org} submitted successfully!`);

        // Reset and Close
        e.target.reset();

        // Reset File Preview Box
        const box = document.getElementById('mem-upload-box');
        if (box) {
            box.classList.remove('has-preview');
            box.style = "";
            box.innerHTML = `
                <span class="upload-placeholder-text">Upload Here</span>
                <div class="upload-plus-icon"><i class="fa-solid fa-plus"></i></div>
            `;
        }

        // Reset Global PDF State
        pdfDoc = null;
        pageNum = 1;
        pageRendering = false;
        pageNumPending = null;

        // Reset Button
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.opacity = "1";

        closeMembershipModal();

    }, 1500);
}

function downloadApplicationForm() {
    // Correctly formatted path with forward slashes and encoded spaces
    const filePath = '../assets/pdf%20files/membership/AISERS%20RECRUITMENT%20FORM.pdf';
    const fileName = 'AISERS RECRUITMENT FORM.pdf';

    // 1. Visual Feedback (Spinner)
    const btn = document.querySelector('.btn-download-app');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Downloading...`;
        btn.disabled = true;

        // 2. Trigger Download
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = filePath;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);

            // Trigger click
            link.click();

            // Clean up
            document.body.removeChild(link);

            // 3. Reset Button & Show Success
            btn.innerHTML = originalText;
            btn.disabled = false;

            // Uses your existing toast function
            if (typeof showToast === "function") {
                showToast("Form downloaded successfully!");
            }
        }, 1000); // 1s delay for visual feedback
    }
}
