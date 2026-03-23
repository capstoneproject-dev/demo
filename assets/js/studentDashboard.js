// --- DATA SIMULATION ---
// servicesData, announcementsData, and extendedEvents are built from ORG_DATA (data/orgData.js).
// To add or change org-specific content, edit data/orgData.js — NOT this file.

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Flat services list: shared/general items first, then org-specific items tagged with their org key.
const servicesData = [
    ...SHARED_SERVICES,
    ...Object.entries(ORG_DATA).flatMap(([orgKey, d]) =>
        d.services.map(s => ({ ...s, org: orgKey }))
    )
];

const eventsData = [
    { title: "Annual Tech Summit", date: "Oct 25", org: "AISERS", desc: "A gathering of tech enthusiasts." },
    { title: "Sports Fest 2023", date: "Nov 02", org: "SSC", desc: "Inter-department sports league." },
    { title: "Aero Workshop", date: "Nov 10", org: "AERO-ATSO", desc: "Drone flying basics." }
];

// Flat announcements list: system-wide first, then org-specific items tagged with their org key.
const announcementsData = [
    ...SHARED_ANNOUNCEMENTS,
    ...Object.entries(ORG_DATA).flatMap(([orgKey, d]) =>
        d.announcements.map(a => ({ ...a, org: orgKey }))
    )
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

// Extended Events Data (for Events Tab) — built from ORG_DATA, each event tagged with its org key.
const extendedEvents = Object.entries(ORG_DATA).flatMap(([orgKey, d]) =>
    d.events.map(e => ({ ...e, org: orgKey }))
);

// Helper to determine event status relative to "Today" (Feb 7, 2026)
function getEventStatus(dateStr) {
    const today = new Date(2026, 1, 7); // Month is 0-indexed: 1 = Feb. Day = 7.
    today.setHours(0, 0, 0, 0);

    // Parse format "MMM. DD, YYYY" e.g., "Jan. 15, 2026"
    const cleanDateStr = dateStr.replace('.', ''); // "Jan 15, 2026"
    const eventDate = new Date(cleanDateStr);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === today.getTime()) return 'today';
    if (eventDate < today) return 'past';
    return 'upcoming';
}

const courseOrganizationMap = {
    BSAIS: "AISERS",
    BSAIT: "ELITECH",
    BSAET: "AETSO",
    BSAT: "AERO-ATSO",
    BSAMT: "AMTSO",
    BSAEE: "AETSO",
    "BAT-AET": "AETSO",
    AVCOMM: "ILASSO",
    AVLOG: "ILASSO",
    AVSSM: "ILASSO",
    AVTOUR: "ILASSO"
};

const orgProfileConfig = {
    "AISERS": {
        tagline: "Association of Information Systems and Emerging Research Students",
        about: "Builds student capability in information systems, analytics, and applied campus technology.",
        officers: ["President: Charles M. Reyes", "Vice President: Nikki S. Lazo", "Secretary: Mara P. Lim"],
        highlights: ["AIS Research Colloquium", "Systems Design Workshop", "Peer Tutoring for BSAIS"]
    },
    "ELITECH": {
        tagline: "Engineering and Laboratory Innovation Technology Circle",
        about: "Focuses on practical electronics and embedded systems initiatives for student engineers.",
        officers: ["President: Jayson A. Cruz", "Vice President: Bea N. Tan", "Secretary: Ken S. Diaz"],
        highlights: ["IoT Build Camp", "Hardware Troubleshooting Clinic", "Electronics Safety Orientation"]
    },
    "ILASSO": {
        tagline: "Institute of Liberal Arts and Sciences Student Organization",
        about: "Supports humanities and social sciences learners through student-led academic activities.",
        officers: ["President: Monica A. Rivas", "Vice President: Gail P. Santos", "Secretary: Lance D. Prado"],
        highlights: ["Communication Skills Forum", "Community Extension Projects", "Student Welfare Consultations"]
    },
    "AERO-ATSO": {
        tagline: "Aeronautics and Air Transport Student Organization",
        about: "Promotes aviation safety, discipline, and applied training for future aviation professionals.",
        officers: ["President: Mark T. de Vera", "Vice President: Troy M. Fabro", "Secretary: Ella R. Cruz"],
        highlights: ["Flight Operations Seminar", "Aviation Safety Talks", "Simulation Readiness Training"]
    },
    "AETSO": {
        tagline: "Aeronautical Engineering Technology Student Organization",
        about: "Develops competencies in engineering standards, maintenance practices, and technical leadership.",
        officers: ["President: Paolo M. Villanueva", "Vice President: Jessa F. Lim", "Secretary: Ron N. Yumul"],
        highlights: ["Aircraft Structures Forum", "Maintenance Procedures Review", "Engineering Skills Clinics"]
    },
    "AMTSO": {
        tagline: "Aircraft Maintenance Technology Student Organization",
        about: "Strengthens maintenance readiness and practical competencies for aircraft maintenance students.",
        officers: ["President: Nico J. Flores", "Vice President: Reign C. Mateo", "Secretary: Ian P. Solis"],
        highlights: ["Engine Inspection Training", "Tool Handling Certification", "Hangar Procedures Drill"]
    },
    "Supreme Student Council": {
        tagline: "Central student leadership body",
        about: "Represents the student body and leads campus-wide governance, programs, and partnerships.",
        officers: ["President: Erica L. Santos", "Vice President: Carl B. Ramos", "Secretary: Janelle M. Cruz"],
        highlights: ["University Week Programs", "Student Welfare Initiatives", "Leadership Development Camps"]
    },
    "RCYC": {
        tagline: "Red Cross Youth Circle",
        about: "Conducts service-oriented and humanitarian activities for campus and community support.",
        officers: ["President: Faye M. Lazo", "Vice President: Josh R. Cruz", "Secretary: Aimee B. Reyes"],
        highlights: ["Blood Donation Drives", "First Aid Training", "Community Assistance Campaigns"]
    },
    "CYC": {
        tagline: "Campus Youth Circle",
        about: "Builds student engagement through leadership, service, and peer development activities.",
        officers: ["President: Den C. Martinez", "Vice President: Kira T. Solis", "Secretary: Abby D. Flores"],
        highlights: ["Leadership Bootcamp", "Peer Engagement Sessions", "Volunteer Mobilization"]
    },
    "Scholar's Guild": {
        tagline: "Academic excellence and peer support group",
        about: "Supports scholars through mentoring, academic planning, and enrichment programs.",
        officers: ["President: Trisha A. Ong", "Vice President: Yuri P. Lim", "Secretary: Sam J. Cruz"],
        highlights: ["Study Group Program", "Scholar Support Desk", "Academic Mentoring Sessions"]
    },
    "Aeronautica": {
        tagline: "Aviation interest and innovation club",
        about: "Creates opportunities for aviation enthusiasts to collaborate, learn, and innovate together.",
        officers: ["President: Vince P. Rivera", "Vice President: Kaye M. Lopez", "Secretary: Noel F. Dizon"],
        highlights: ["Aviation Talk Series", "Simulation Meetups", "Student Innovation Showcases"]
    }
};

const orgThemeClassMap = {
    "AISERS": "org-theme-aisers",
    "ELITECH": "org-theme-elitech",
    "ILASSO": "org-theme-ilasso",
    "AERO-ATSO": "org-theme-aero-atso",
    "AETSO": "org-theme-aetso",
    "AMTSO": "org-theme-amtso",
    "Supreme Student Council": "org-theme-ssc",
    "RCYC": "org-theme-rcyc",
    "CYC": "org-theme-cyc",
    "Scholar's Guild": "org-theme-scholar-guild",
    "Aeronautica": "org-theme-aero-atso"
};

function normalizeOrgName(name) {
    if (!name) return "";
    const normalized = String(name).trim().toUpperCase();
    const aliases = {
        "AISERS": "AISERS",
        "ELITECH": "ELITECH",
        "ILASSO": "ILASSO",
        "AERO-ATSO": "AERO-ATSO",
        "AETSO": "AETSO",
        "AMTSO": "AMTSO",
        "RCYC": "RCYC",
        "CYC": "CYC",
        "SSC": "Supreme Student Council",
        "SUPREME STUDENT COUNCIL": "Supreme Student Council",
        "SUPREME STUDENT COUNCIL (SSC)": "Supreme Student Council",
        "ALLIANCE IN INFORMATION SYSTEM EMPOWERED RESPONSIVE STUDENTS": "AISERS",
        "ALLIANCE IN INFORMATION SYSTEM EMPOWERED RESPONSIVE STUDENTS ORGANIZATION": "AISERS",
        "ELITE TECHNOLOGIST SOCIETY": "ELITECH",
        "INSTITUTE OF LIBERAL ARTS AND SCIENCES STUDENT ORGANIZATION": "ILASSO",
        "AERONAUTICAL ENGINEERING ORGANIZATION": "AERO-ATSO",
        "AERONAUTICAL ENGINEERING TECHNOLOGY STUDENT ORGANIZATION": "AETSO",
        "AVIATION MAINTENANCE TECHNOLOGY STUDENT ORGANIZATION": "AMTSO",
        "RED CROSS YOUTH COUNCIL": "RCYC",
        "COLLEGE YOUTH CLUB": "CYC",
        "AERONAUTICA": "Aeronautica",
        "ELITECH ORGANIZATION": "ELITECH",
        "SCHOLAR'S GUILD": "Scholar's Guild",
        "SCHOLARS GUILD": "Scholar's Guild",
        "SCHOLAR’S GUILD": "Scholar's Guild",
        "SCHOLARA€™S GUILD": "Scholar's Guild",
        "AMT": "AMTSO",
        "AET": "AETSO"
    };
    return aliases[normalized] || String(name).trim();
}

const AUTH_DB_KEY = "naapAuthDB_v1";
const AUTH_SESSION_KEY = "naapAuthSession";

/**
 * Non-blocking PHP session check.
 * Runs async after initial render — redirects to login if server session is gone.
 */
function validatePhpSession() {
    const authSession = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
    // Only check against server if we actually have a local session
    if (!authSession || !authSession.user_id) {
        window.location.href = '../pages/login.html';
        return;
    }
    fetch('../api/auth/session.php', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
            if (!data.authenticated) {
                localStorage.removeItem(AUTH_SESSION_KEY);
                window.location.href = '../pages/login.html';
            }
        })
        .catch(() => { /* silently ignore — XAMPP may be offline during dev */ });
}

function readJsonStorage(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_error) {
        return fallback;
    }
}

function buildCurrentStudentProfile() {
    const fallbackProfile = {
        fullName: "Juan Dela Cruz",
        studentNumber: "2021-12345",
        course: "BSAIS",
        section: "3A",
        email: ""
    };

    const storedProfile = readJsonStorage("naapStudentProfile", {});
    const authSession = readJsonStorage(AUTH_SESSION_KEY, {});
    const authDb = readJsonStorage(AUTH_DB_KEY, {});
    const sessionBackedProfile = {
        fullName: authSession.display_name || "",
        studentNumber: authSession.student_number || "",
        email: authSession.email || "",
        course: authSession.program_code || "",
        section: authSession.section || "",
        organization: authSession.active_org_name || authSession.mapped_org_name || ""
    };

    let authBackedProfile = {};
    if (authSession && authSession.user_id && Array.isArray(authDb.users)) {
        const authUser = authDb.users.find(user => Number(user.user_id) === Number(authSession.user_id));
        const studentProfile = Array.isArray(authDb.student_profiles)
            ? authDb.student_profiles.find(profile => Number(profile.user_id) === Number(authSession.user_id))
            : null;
        const program = studentProfile && Array.isArray(authDb.academic_programs)
            ? authDb.academic_programs.find(item => Number(item.program_id) === Number(studentProfile.program_id))
            : null;

        if (authUser) {
            const mappedOrg = studentProfile && Array.isArray(authDb.program_org_mappings) && Array.isArray(authDb.organizations)
                ? (() => {
                    const mapping = authDb.program_org_mappings.find(item =>
                        Number(item.program_id) === Number(studentProfile.program_id) && Number(item.is_active) === 1
                    );
                    return mapping
                        ? authDb.organizations.find(item => Number(item.org_id) === Number(mapping.org_id))
                        : null;
                })()
                : null;

            authBackedProfile = {
                fullName: `${authUser.first_name || ""} ${authUser.last_name || ""}`.trim(),
                studentNumber: authUser.student_number || "",
                email: authUser.email || "",
                course: program ? program.program_code : "",
                section: studentProfile ? studentProfile.section || "" : "",
                organization: authSession.active_org_name || authSession.mapped_org_name || (mappedOrg ? mappedOrg.org_name : "")
            };
        }
    }

    const mergedProfile = {
        ...fallbackProfile,
        ...storedProfile,
        ...sessionBackedProfile,
        ...authBackedProfile
    };
    const normalizedCourse = String(mergedProfile.course || "").toUpperCase().trim();
    const mappedOrg = authSession.mapped_org_name || mergedProfile.organization || courseOrganizationMap[normalizedCourse] || "Supreme Student Council";

    // For org-officer logins the session carries the correct active_org_name;
    // for regular student logins active_org_name is null — always derive from course map.
    const isOfficerLogin = authSession && authSession.login_role === 'org';
    const resolvedOrg = isOfficerLogin
        ? (mergedProfile.organization || mappedOrg)
        : mappedOrg;

    return {
        ...mergedProfile,
        course: mergedProfile.course || fallbackProfile.course,
        associatedOrg: normalizeOrgName(resolvedOrg)
    };
}

function parseOrgList(orgText) {
    return String(orgText || "")
        .split(",")
        .map(item => normalizeOrgName(item))
        .filter(Boolean);
}

const currentStudentProfile = buildCurrentStudentProfile();
const activeStudentOrg = normalizeOrgName(currentStudentProfile.associatedOrg);

function studentCanAccessOrg(orgText) {
    const orgs = parseOrgList(orgText);
    if (!orgs.length) return true;
    return orgs.some(org =>
        org === activeStudentOrg ||
        org === "ALL" ||
        org === "GENERAL" ||
        org === "COMBINED"
    );
}

function getStudentScopedExtendedEvents() {
    return extendedEvents.filter(event => studentCanAccessOrg(event.org));
}

function getStudentScopedAnnouncements() {
    return announcementsData.filter(item => studentCanAccessOrg(item.org));
}

function getStudentScopedTransactions() {
    return transactionsData.filter(item => studentCanAccessOrg(item.org));
}

function getStudentScopedServices() {
    return servicesData;
}

function syncStudentIdentity() {
    const userNameEl = document.getElementById("studentHeaderName") || document.querySelector(".user-info span");
    const userCourseEl = document.getElementById("studentHeaderCourse") || document.querySelector(".user-info small");
    const courseLine = currentStudentProfile.section
        ? `${currentStudentProfile.course} - ${currentStudentProfile.section}`
        : currentStudentProfile.course;

    if (userNameEl) userNameEl.innerText = currentStudentProfile.fullName;
    if (userCourseEl) userCourseEl.innerText = courseLine;

    const profileHeaderName = document.getElementById("studentProfileName") || document.querySelector("#profile h2");
    const profileStudentId = document.getElementById("studentProfileStudentId");
    const profileCourse = document.getElementById("studentProfileCourse");
    const profileEmail = document.getElementById("studentProfileEmail");

    if (profileHeaderName) profileHeaderName.innerText = currentStudentProfile.fullName;
    if (profileStudentId) profileStudentId.innerText = `Student ID: ${currentStudentProfile.studentNumber || "-"}`;
    if (profileCourse) profileCourse.innerText = `Course: ${courseLine || "-"}`;
    if (profileEmail) profileEmail.innerText = `Email: ${currentStudentProfile.email || "-"}`;
}

function renderMyOrganizationTab(contentDiv) {
    const targetOrgName = currentStudentProfile.associatedOrg;
    const organization = organizationData.find(item => normalizeOrgName(item.name) === targetOrgName);

    if (!organization) {
        contentDiv.innerHTML = `
            <div style="text-align:center; padding: 60px 20px; color: var(--muted);">
                <i class="fa-solid fa-users-slash" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
                <h3 style="margin-bottom: 10px; color: var(--text);">No Organization Found</h3>
                <p style="max-width: 500px; margin: 0 auto; line-height: 1.5;">
                    No active organization mapping was found for your program.
                </p>
            </div>
        `;
        return;
    }

    const profileConfig = orgProfileConfig[targetOrgName] || orgProfileConfig["Supreme Student Council"];
    const orgThemeClass = orgThemeClassMap[targetOrgName] || "org-theme-ssc";
    const heroBackgroundImage = targetOrgName === "AISERS"
        ? "../assets/photos/studentDashboard/Organizations Gallery/AISERS GROUP PHOTO.png"
        : organization.banner;
    const relevantEvents = extendedEvents.filter(event => normalizeOrgName(event.org) === targetOrgName);
    const relevantServices = servicesData.filter(service => parseOrgList(service.org).includes(targetOrgName)).slice(0, 4);
    const announcementEvents = (relevantEvents.length ? relevantEvents : extendedEvents).slice(0, 2);
    const recentActivities = (relevantEvents.length ? relevantEvents : extendedEvents).slice(0, 3);
    // fullName and motto come from ORG_DATA (data/orgData.js) — edit there, not here.
    const orgEntry = (typeof ORG_DATA !== 'undefined' && ORG_DATA[targetOrgName]) || {};
    const fullOrgName = orgEntry.fullName || organization.name;
    const orgMotto = orgEntry.motto || profileConfig.tagline || "";
    const formattedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const announcementMarkup = announcementEvents.map(event => `
        <div class="my-org-ref-ann-item">
            <img src="${organization.image}" alt="${organization.name} logo" class="my-org-ref-ann-thumb">
            <div>
                <div class="my-org-ref-ann-title">Upcoming Event: ${event.title}</div>
                <div class="my-org-ref-ann-date">${event.date}</div>
            </div>
            <button class="my-org-ref-pill-btn" type="button">Read More</button>
        </div>
    `).join("");

    const activitiesMarkup = recentActivities.map(event => `
        <article class="my-org-ref-activity-card">
            <img src="${event.img}" alt="${event.title}">
            <div class="my-org-ref-activity-caption">${event.title}</div>
        </article>
    `).join("");

    const quickFactsMarkup = `
        <ul>
            <li><strong>Course:</strong> ${currentStudentProfile.course}</li>
            <li><strong>Associated Org:</strong> ${organization.name}</li>
            <li><strong>Services:</strong> ${relevantServices.map(service => service.name).join(", ") || "No active services yet"}</li>
            <li><strong>Core Mission:</strong> ${profileConfig.about}</li>
        </ul>
    `;

    contentDiv.innerHTML = `
        <div class="my-org-page ${orgThemeClass}">
            <section class="my-org-ref-topbar">
                <div class="my-org-ref-top-actions">
                    <div class="my-org-ref-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" placeholder="Search">
                    </div>
                    <img src="${organization.image}" alt="${organization.name} logo" class="my-org-ref-top-logo">
                </div>
            </section>

            <section class="my-org-ref-orgbar">
                <div class="my-org-ref-orgtitle">
                    <img src="${organization.image}" alt="${organization.name} logo">
                    <span>${fullOrgName}</span>
                </div>
                <nav class="my-org-ref-links">
                    <a href="#">Home</a>
                    <a href="#">Events</a>
                    <a href="#">About</a>
                    <a href="#">Officers</a>
                    <a href="#">Contact</a>
                </nav>
            </section>

            <section class="my-org-ref-main">
                <article class="my-org-ref-hero">
                    <img src="${heroBackgroundImage}" alt="${organization.name} banner">
                    <div class="my-org-ref-hero-overlay"></div>
                    <div class="my-org-ref-chip">${organization.category}</div>
                    <div class="my-org-ref-date">${formattedDate}</div>
                    <div class="my-org-ref-hero-content">
                        <h2>WELCOME TO ${fullOrgName.toUpperCase()}!</h2>
                        <p>"${orgMotto}"</p>
                    </div>
                    <div class="my-org-ref-hero-actions">
                        <button type="button"><i class="fa-solid fa-user-plus"></i> Join</button>
                        <button type="button"><i class="fa-solid fa-link"></i> Share</button>
                    </div>
                </article>

                <aside class="my-org-ref-side">
                    <article class="my-org-ref-announcements">
                        <h3>ANNOUNCEMENTS</h3>
                        ${announcementMarkup}
                    </article>
                    <article class="my-org-ref-contact">
                        <h3>${organization.name}</h3>
                        <div class="my-org-ref-contact-search">
                            <input type="text" placeholder="What are you looking for?">
                            <button type="button"><i class="fa-solid fa-magnifying-glass"></i></button>
                        </div>
                        <div class="my-org-ref-socials">
                            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <i class="fa-brands fa-facebook-f"></i>
                            </a>
                            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <i class="fa-brands fa-instagram"></i>
                            </a>
                            <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                                <span class="x-text">X</span>
                            </a>
                            <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                                <i class="fa-brands fa-tiktok"></i>
                            </a>
                        </div>
                    </article>
                </aside>
            </section>

            <section class="my-org-ref-bottom">
                <article class="my-org-ref-quickfacts">
                    <h3>QUICK FACTS</h3>
                    ${quickFactsMarkup}
                </article>
                <article class="my-org-ref-activities">
                    <h3>RECENT ACTIVITIES</h3>
                    <div class="my-org-ref-activities-grid">
                        ${activitiesMarkup}
                    </div>
                </article>
            </section>
        </div>
    `;
}


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

    // Clear rental timer when leaving services view
    if (viewId !== 'services') {
        if (typeof rentalTimerInterval !== 'undefined' && rentalTimerInterval) {
            clearInterval(rentalTimerInterval);
            rentalTimerInterval = null;
        }
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

// ========================================
// SERVICES TAB SWITCHING
// ========================================

function switchServiceTab(tabName, btn) {
    // Update Buttons
    document.querySelectorAll('#services .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Hide all service tab contents
    document.querySelectorAll('.service-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    if (tabName === 'catalog') {
        const catalogTab = document.getElementById('services-catalog-tab');
        if (catalogTab) catalogTab.classList.add('active');
    } else if (tabName === 'my-rentals') {
        const rentalsTab = document.getElementById('services-my-rentals-tab');
        if (rentalsTab) rentalsTab.classList.add('active');

        // Load rental data when switching to My Rentals tab
        loadMyRentalsTab();
    }

    syncStudentServicesPanels();
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
            btn.innerText = cat.label;
            btn.setAttribute('data-category', cat.key);
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
                });
                // Set active
                this.classList.add('active');
                renderOrgs(this.getAttribute('data-category'));
            });
        });
    } else if (tabName === 'my-organization') {
        renderMyOrganizationTab(contentDiv);
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
                <div class="recruit-header" style="background: ${org.banner ? `url('${org.banner}') center/cover no-repeat` : org.color}"></div>
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
        // --- EVENTS TAB CONTENT ---

        // 1. Search Bar (Existing)
        const filterBar = document.createElement('div');
        filterBar.className = 'events-filter-bar';
        filterBar.innerHTML = `
            <div class="filter-input-group">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="eventSearch" placeholder="Search events...">
            </div>

            <div class="filter-select-group">
                <i class="fa-solid fa-filter"></i>
                <select id="eventOrgFilter">
                    <option value="all">All Organizations</option>
                </select>
            </div>
        `;
        contentDiv.appendChild(filterBar);

        // 2. NEW: Time Filter Tabs (Past, Today, Upcoming)
        const timeFilters = document.createElement('div');
        timeFilters.className = 'event-time-filters';
        timeFilters.innerHTML = `
            <button class="time-filter-btn active" data-filter="upcoming">Upcoming</button>
            <button class="time-filter-btn" data-filter="today">Today</button>
            <button class="time-filter-btn" data-filter="past">Past</button>
            <button class="time-filter-btn" data-filter="all">All Events</button>
        `;
        contentDiv.appendChild(timeFilters);

        // 3. Grid Container
        const grid = document.createElement('div');
        grid.className = 'events-grid-layout';
        grid.id = 'eventsGridContainer';
        contentDiv.appendChild(grid);

        // State for filtering
        let currentTimeFilter = 'upcoming';
        let currentOrgFilter = 'all'; // State for Org Filter

        // Helper to populate Org Dropdown
        function populateOrgDropdown() {
            const orgSelect = document.getElementById('eventOrgFilter');
            // Get unique organizations from the events list
            const scopedEvents = getStudentScopedExtendedEvents();
            const uniqueOrgs = [...new Set(scopedEvents.map(ev => ev.org))].sort();

            uniqueOrgs.forEach(org => {
                const option = document.createElement('option');
                option.value = org;
                option.innerText = org;
                orgSelect.appendChild(option);
            });
        }

        function renderEventsList() {
            grid.innerHTML = '';
            const searchTerm = document.getElementById('eventSearch').value.toLowerCase();

            // Filter logic
            const filtered = getStudentScopedExtendedEvents().filter(ev => {
                // 1. Keyword Match
                const matchesSearch = ev.title.toLowerCase().includes(searchTerm) ||
                    ev.org.toLowerCase().includes(searchTerm);

                // 2. Time Match
                const status = getEventStatus(ev.date);
                let matchesTime = false;
                if (currentTimeFilter === 'all') matchesTime = true;
                else matchesTime = (status === currentTimeFilter);

                // 3. Org Match (NEW)
                let matchesOrg = false;
                const orgSelectValue = document.getElementById('eventOrgFilter').value;
                if (orgSelectValue === 'all') matchesOrg = true;
                else matchesOrg = (ev.org === orgSelectValue);

                return matchesSearch && matchesTime && matchesOrg;
            });

            // Empty State
            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
                        <i class="fa-regular fa-calendar-xmark" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>No ${currentTimeFilter !== 'all' ? currentTimeFilter : ''} events found matching your search.</p>
                    </div>`;
                return;
            }

            // Render Cards
            filtered.forEach(ev => {
                const isRegistered = isEventRegistered(ev.title);
                const status = getEventStatus(ev.date);

                // Parse date for Badge (e.g. "Feb. 07")
                const [monthStr, dayStr] = ev.date.split(' '); // ["Feb.", "07,"]
                const cleanDay = dayStr.replace(',', '');

                const card = document.createElement('div');
                card.className = 'event-card-ref'; // Enhanced via CSS
                card.setAttribute('onclick', `openDetailsModal('${ev.title}')`);
                card.setAttribute('style', 'cursor: pointer;');
                card.setAttribute('title', 'View Details');

                // Badge Label
                let statusLabel = '';
                if (currentTimeFilter === 'all') {
                    if (status === 'today') statusLabel = '<span class="event-status-pill status-today">Happening Today</span>';
                    else if (status === 'upcoming') statusLabel = '<span class="event-status-pill status-upcoming">Upcoming</span>';
                    else statusLabel = '<span class="event-status-pill status-past">Completed</span>';
                }

                card.innerHTML = `
                    <div style="position:relative;">
                        <div class="event-date-badge">
                            <span class="event-date-month">${monthStr.replace('.', '')}</span>
                            <span class="event-date-day">${cleanDay}</span>
                        </div>
                        <img src="${ev.img}" class="event-card-thumb" alt="${ev.title}">
                    </div>
                    
                    <div class="event-card-body">
                        ${statusLabel}
                        <div class="event-card-header" style="margin-bottom: 8px;">
                            <div class="event-card-info">
                                <h4>${ev.title}</h4>
                                <p><i class="fa-solid fa-users" style="font-size:0.75rem; color:var(--primary);"></i> ${ev.org}</p>
                            </div>
                        </div>
                        
                        <div style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:var(--muted); margin-bottom:15px;">
                            <span><i class="fa-regular fa-clock"></i> ${ev.time.split(' - ')[0]}</span>
                        </div>
                    </div>

                    <div class="event-card-footer">
                        <div class="event-stat"><i class="fa-regular fa-heart"></i> ${Math.floor(Math.random() * 50) + 10}</div>
                        <div class="event-actions">
                            <button class="btn-share" onclick="shareEvent('${ev.title}')" title="Share">
                                <i class="fa-solid fa-share-nodes"></i>
                            </button>
                            
                            <button class="btn-view-details" onclick="openDetailsModal('${ev.title}')" title="Details">
                                <i class="fa-solid fa-circle-info"></i>
                            </button>
                            
                            <button class="btn-register-card ${isRegistered ? 'registered' : ''}" 
                                    onclick="openRegistrationModal('${ev.title}')" 
                                    ${isRegistered ? 'disabled style="cursor: not-allowed;"' : ''}>
                                ${isRegistered ? 'Joined <i class="fa-solid fa-check"></i>' : 'Join'}
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        // Initialize Options
        populateOrgDropdown();

        // Listeners for Time Tabs
        timeFilters.querySelectorAll('.time-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // UI Toggle
                timeFilters.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                // Logic
                currentTimeFilter = e.target.getAttribute('data-filter');
                renderEventsList();
            });
        });

        // Search Listener
        document.getElementById('eventSearch').addEventListener('keyup', renderEventsList);

        // NEW Listener for Dropdown
        document.getElementById('eventOrgFilter').addEventListener('change', renderEventsList);

        // Initial Render
        renderEventsList();
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
    return getStudentScopedExtendedEvents().filter(event => {
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
    // 1. Render Announcements (Existing Logic)
    const annList = document.getElementById('announcements-list');
    annList.innerHTML = getStudentScopedAnnouncements().map(item => `
        <div class="list-item dashboard-announcement-item">
            <div class="item-icon announcement-icon"><i class="fa-solid fa-bullhorn"></i></div>
            <div class="item-content">
                <h4>${item.title}</h4>
                <p>${item.content}</p>
            </div>
            <span class="date-badge">${item.date}</span>
        </div>
    `).join('');

    // 2. Render ALL Upcoming Events (Grid Layout)
    const eventContainer = document.getElementById('events-preview-container');

    // Filter & Sort
    const upcomingEvents = getStudentScopedExtendedEvents()
        .filter(ev => {
            const status = getEventStatus(ev.date);
            return status === 'upcoming' || status === 'today';
        })
        .sort((a, b) => {
            const dateA = new Date(a.date.replace('.', ''));
            const dateB = new Date(b.date.replace('.', ''));
            return dateA - dateB;
        });

    if (upcomingEvents.length === 0) {
        eventContainer.innerHTML = `
            <div style="grid-column: 1 / -1; width:100%; text-align:center; padding:30px; color:var(--muted); background:var(--panel-2); border-radius:12px; border:1px dashed var(--border);">
                <p>No upcoming events scheduled.</p>
            </div>`;
    } else {
        // Map to the Detailed Card HTML
        eventContainer.innerHTML = upcomingEvents.map(ev => `
            <div class="dashboard-event-preview-card" onclick="navigateToEventDetails('${ev.title}')" title="View Details">
                <div class="card-top-accent"></div>
                <div class="card-content">
                    <div class="preview-date-badge">
                        <span class="p-month">${ev.date.split('.')[0]}</span>
                        <span class="p-day">${ev.date.split(' ')[1].replace(',', '')}</span>
                    </div>
                    <div class="preview-details">
                        <h4 class="preview-title">${ev.title}</h4>
                        <div class="preview-meta">
                            <span class="preview-org"><i class="fa-solid fa-users"></i> ${ev.org}</span>
                            ${ev.time ? `<span class="preview-time"><i class="fa-regular fa-clock"></i> ${ev.time.split(' - ')[0]}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 3. Render Calendar (Existing Logic)
    renderCalendar();
}

function renderProfile() {
    const tableBody = document.getElementById('transaction-table');
    tableBody.innerHTML = getStudentScopedTransactions().map(t => {
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
    renderStudentLockerProfile();
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
async function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        try { await fetch('../api/auth/logout.php', { credentials: 'same-origin' }); } catch (_) {}
        localStorage.removeItem(AUTH_SESSION_KEY);
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

    track.innerHTML = ''; // Clear previous content

    // 1. Filter events that match "Today" status
    // This uses the same helper logic as the Events Tab -> Today Filter
    const scopedEvents = getStudentScopedExtendedEvents();
    const todayEvents = scopedEvents.filter(ev => getEventStatus(ev.date) === 'today');

    let slidesToRender = [];

    if (todayEvents.length > 0) {
        // If we have events today, cycle through their main images
        slidesToRender = todayEvents.map(ev => ({
            src: ev.img,
            title: ev.title
        }));
    } else {
        // Fallback: If no events today, show the next upcoming event to avoid empty white space
        const nextEvent = scopedEvents.find(ev => getEventStatus(ev.date) === 'upcoming');
        if (nextEvent) {
            slidesToRender = [{ src: nextEvent.img, title: nextEvent.title }];
        } else {
            // Ultimate fallback if no upcoming events exist
            slidesToRender = scopedEvents.length ? [{ src: scopedEvents[0].img, title: "Event" }] : [];
        }
    }

    // 2. Generate Slides
    slidesToRender.forEach((item, index) => {
        const img = document.createElement('img');
        img.src = item.src;
        img.className = 'carousel-slide-img';
        img.alt = item.title;
        img.title = item.title; // Tooltip on hover

        // Set first image as active
        if (index === 0) img.classList.add('active');

        track.appendChild(img);
    });

    // 3. Reset Index
    currentDashboardSlideIndex = 0;

    // 4. Restart Interval
    if (carouselInterval) clearInterval(carouselInterval);

    // Only auto-rotate if we have more than 1 image
    if (slidesToRender.length > 1) {
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
window.addEventListener('DOMContentLoaded', async () => {
    validatePhpSession();   // guard: redirect to login if no valid session
    syncStudentIdentity();
    setDate();
    renderDashboard();
    try {
        await loadStudentServicesTracker();
        await loadStudentServiceCatalog();
    } catch (error) {
        console.error(error);
    }
    renderServices();
    renderServicesModuleNav();
    renderPrintingProviderOptions();
    loadStudentPrintJobs().catch((error) => console.error(error));
    loadStudentLockers().catch((error) => console.error(error));
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
    const lockerModal = document.getElementById('studentLockerModal');
    if (e.target === lockerModal) {
        closeStudentLockerModal();
    }
    const lockerConfirmModal = document.getElementById('studentLockerConfirmModal');
    if (e.target === lockerConfirmModal) {
        closeStudentLockerConfirmModal();
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
    const eventObj = getStudentScopedExtendedEvents().find(e => e.title === eventTitle);
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

let studentServiceCatalog = [];
let studentServiceCatalogPromise = null;
let studentServiceCatalogLoaded = false;
let currentSelectedCatalogItem = null;
const serviceGroups = {};
let currentServiceModule = 'rentals';
let studentServicesTracker = {
    modules: [],
    printingProviders: []
};
let studentPrintingJobs = [];
let studentServicesTrackerPromise = null;
let studentLockerState = {
    enabled: false,
    org_name: '',
    org_code: '',
    lockers: [],
    current_locker: null
};
let pendingStudentLockerSelection = null;

function resolveStudentCatalogImage(path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw)) return raw;
    return `../${raw.replace(/^\/+/, '')}`;
}

function getServiceCategoryIcon(categoryName) {
    const value = String(categoryName || '').toLowerCase();
    if (value.includes('labor')) return 'fa-flask';
    if (value.includes('print')) return 'fa-print';
    if (value.includes('tool')) return 'fa-toolbox';
    if (value.includes('utility')) return 'fa-screwdriver-wrench';
    if (value.includes('study') || value.includes('academic')) return 'fa-book';
    if (value.includes('calculator')) return 'fa-calculator';
    return 'fa-box-open';
}

async function loadStudentServiceCatalog(force = false) {
    if (studentServiceCatalogPromise && !force) {
        return studentServiceCatalogPromise;
    }

    studentServiceCatalogPromise = fetch('../api/student/services/catalog.php', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then((resp) => resp.json().catch(() => ({})).then((data) => ({ resp, data })))
        .then(({ resp, data }) => {
            if (!resp.ok || !data.ok) {
                throw new Error(data.error || 'Could not load services.');
            }
            studentServiceCatalog = Array.isArray(data.items) ? data.items : [];
            studentServiceCatalogLoaded = true;
            return studentServiceCatalog;
        })
        .catch((err) => {
            studentServiceCatalog = [];
            studentServiceCatalogLoaded = true;
            throw err;
        });

    return studentServiceCatalogPromise;
}

async function loadStudentServicesTracker(force = false) {
    if (studentServicesTrackerPromise && !force) {
        return studentServicesTrackerPromise;
    }

    studentServicesTrackerPromise = fetch('../api/student/services/tracker.php', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then((resp) => resp.json().catch(() => ({})).then((data) => ({ resp, data })))
        .then(({ resp, data }) => {
            if (!resp.ok || !data.ok) {
                throw new Error(data.error || 'Could not load service modules.');
            }
            studentServicesTracker = {
                modules: Array.isArray(data.modules) ? data.modules : [],
                printingProviders: Array.isArray(data.printing_providers) ? data.printing_providers : [],
            };
            renderServicesModuleNav();
            renderPrintingProviderOptions();
            return studentServicesTracker;
        })
        .catch((error) => {
            studentServicesTracker = { modules: [], printingProviders: [] };
            renderServicesModuleNav();
            renderPrintingProviderOptions();
            throw error;
        });

    return studentServicesTrackerPromise;
}

function getServiceModuleMeta(serviceKey) {
    const normalized = String(serviceKey || '').trim().toLowerCase();
    return (studentServicesTracker.modules || []).find(item => String(item.service_key || '').toLowerCase() === normalized) || null;
}

function renderServicesModuleNav() {
    const sidebar = document.querySelector('#services .services-tracker-sidebar');
    const sidebarHidden = !sidebar || window.getComputedStyle(sidebar).display === 'none';
    const buttons = document.querySelectorAll('#servicesModuleNav .services-module-btn');
    if (!buttons.length) return;

    const visibleButtons = [];
    buttons.forEach((button) => {
        const moduleKey = button.dataset.module || '';
        const moduleMeta = getServiceModuleMeta(moduleKey);
        const enabled = moduleMeta ? !!moduleMeta.enabled : (moduleKey === 'rentals');
        button.style.display = enabled ? '' : 'none';
        button.disabled = !enabled;
        if (enabled) {
            visibleButtons.push(button);
        }
    });

    const currentButtonVisible = visibleButtons.some(button => (button.dataset.module || '') === currentServiceModule);
    if (!currentButtonVisible && visibleButtons.length > 0) {
        currentServiceModule = visibleButtons[0].dataset.module || 'rentals';
    }

    const activeButton = visibleButtons.find(button => (button.dataset.module || '') === currentServiceModule) || visibleButtons[0] || null;
    if (sidebarHidden) {
        syncStudentServicesPanels();
    } else if (activeButton) {
        switchServiceModule(activeButton.dataset.module, activeButton);
    }
}

function syncStudentServicesPanels() {
    const printingPane = document.getElementById('services-module-printing');
    if (printingPane) {
        printingPane.classList.remove('active');
        printingPane.style.display = 'none';
    }
}

function switchServiceModule(moduleKey, btn = null) {
    currentServiceModule = moduleKey;

    document.querySelectorAll('#servicesModuleNav .services-module-btn').forEach((button) => {
        button.classList.toggle('active', button === btn || (button.dataset.module || '') === moduleKey);
    });

    document.querySelectorAll('#services .services-module-pane').forEach((pane) => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`services-module-${moduleKey}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    if (moduleKey === 'printing') {
        loadStudentPrintJobs().catch((error) => console.error(error));
    } else if (moduleKey === 'rentals') {
        const rentalsTab = document.getElementById('services-my-rentals-tab');
        if (rentalsTab && rentalsTab.classList.contains('active')) {
            loadMyRentalsTab();
        }
    }

    syncStudentServicesPanels();
}

function resolveStudentDocumentUrl(path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/')) return raw;
    return `../${raw.replace(/^\/+/, '')}`;
}

function escapeStudentHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderPrintingProviderOptions() {
    const select = document.getElementById('printingProviderSelect');
    const heroSelect = document.getElementById('uploadPrintProvider');
    const summary = document.getElementById('printingProvidersSummary');
    const text = document.getElementById('printingAvailabilityText');
    if (!summary || !text) return;

    const providers = Array.isArray(studentServicesTracker.printingProviders)
        ? studentServicesTracker.printingProviders
        : [];

    if (select) {
        select.innerHTML = '<option value="">Select organization</option>';
    }
    if (heroSelect) {
        heroSelect.innerHTML = '<option value="">Select printing provider</option>';
    }
    summary.innerHTML = '';

    if (!providers.length) {
        text.textContent = 'No organizations are currently authorized to offer printing services.';
        return;
    }

    text.textContent = `${providers.length} authorized printing provider${providers.length > 1 ? 's' : ''} available.`;

    providers.forEach((provider) => {
        [select, heroSelect].forEach((target) => {
            if (!target) return;
            const option = document.createElement('option');
            option.value = provider.org_id;
            option.textContent = `${provider.org_name}${provider.org_code ? ` (${provider.org_code})` : ''}`;
            target.appendChild(option);
        });

        const badge = document.createElement('span');
        badge.className = 'printing-provider-chip';
        badge.textContent = provider.org_code || provider.org_name;
        summary.appendChild(badge);
    });

    if (heroSelect && providers.length === 1) {
        heroSelect.value = String(providers[0].org_id);
    }
}

function getPrintingJobStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ready_to_claim') return 'Ready to Claim';
    if (normalized === 'processing') return 'Processing';
    if (normalized === 'queued') return 'Queued';
    if (normalized === 'claimed') return 'Claimed';
    if (normalized === 'cancelled') return 'Cancelled';
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown';
}

function getNormalizedLockerActivityStatus(status, rental = null) {
    const normalized = String(status || '').toLowerCase();
    const periodType = String(rental?.locker_period_type || '').toLowerCase();
    if (normalized === 'locker_released' && periodType === 'pending') {
        return 'locker_rejected';
    }
    return normalized;
}

function getLockerActivityStatusLabel(status, rental = null) {
    const normalized = getNormalizedLockerActivityStatus(status, rental);
    if (normalized === 'locker_pending') return 'Pending Approval';
    if (normalized === 'locker_active') return 'Active';
    if (normalized === 'locker_overdue') return 'Overdue';
    if (normalized === 'locker_rejected') return 'Rejected';
    if (normalized === 'locker_released') return 'Released';
    return normalized ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';
}

function getLockerActivityStatusClass(status, rental = null) {
    const normalized = getNormalizedLockerActivityStatus(status, rental);
    if (normalized === 'locker_pending') return 'status-reserved';
    if (normalized === 'locker_active') return 'status-active';
    if (normalized === 'locker_overdue') return 'status-no-show';
    if (normalized === 'locker_rejected') return 'status-unknown';
    if (normalized === 'locker_released') return 'status-returned';
    return 'status-unknown';
}

function getStudentLockerNoticeEntries(locker) {
    if (!locker) return [];

    const entries = [];
    const normalizedStatus = getNormalizedLockerActivityStatus(locker.status, locker);
    const upcomingMessage = String(locker.upcoming_notice_message || '').trim();
    const upcomingSentAt = String(locker.upcoming_notice_sent_at || '').trim();
    const overdueMessage = String(locker.overdue_notice_message || '').trim();
    const overdueSentAt = String(locker.overdue_notice_sent_at || '').trim();

    if (upcomingMessage || upcomingSentAt) {
        entries.push({
            type: 'upcoming',
            message: upcomingMessage || 'Your locker rental is due within 7 days. Please coordinate with SSC before the due date if you need assistance.',
            sentAt: upcomingSentAt,
            urgent: false
        });
    }

    if (overdueMessage || overdueSentAt || normalizedStatus === 'locker_overdue') {
        entries.push({
            type: 'overdue',
            message: overdueMessage || 'This locker rental has exceeded the due date. Proceed to the SSC office immediately to settle the rental and avoid pull-out action.',
            sentAt: overdueSentAt,
            urgent: normalizedStatus === 'locker_overdue'
        });
    }

    entries.sort((a, b) => {
        const aTime = a.sentAt ? new Date(a.sentAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.sentAt ? new Date(b.sentAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });

    return entries;
}

function getStudentLockerNoticeTitle(entry) {
    const preset = entry.type === 'upcoming'
        ? 'Your locker rental is due within 7 days. Please coordinate with SSC before the due date if you need assistance.'
        : 'This locker rental has exceeded the due date. Proceed to the SSC office immediately to settle the rental and avoid pull-out action.';
    return String(entry.message || '').trim() !== preset.trim()
        ? 'Notice!'
        : (entry.type === 'upcoming' ? 'Ending Soon Notice' : 'Pull-out Notice');
}

function renderStudentLockerBoard() {
    const section = document.getElementById('studentLockerSection');
    const board = document.getElementById('studentLockerBoard');
    const badge = document.getElementById('studentLockerCurrentBadge');
    const currentCard = document.getElementById('studentLockerCurrentCard');
    if (!section || !board || !currentCard) return;

    if (!studentLockerState.enabled) {
        section.style.display = 'none';
        renderStudentLockerProfile();
        return;
    }

    section.style.display = 'block';
    const lockers = Array.isArray(studentLockerState.lockers) ? studentLockerState.lockers : [];
    const currentLocker = studentLockerState.current_locker || null;

    if (badge) {
        if (currentLocker?.locker_code) {
            badge.style.display = 'inline-flex';
            badge.textContent = `Current Locker: ${currentLocker.locker_code}`;
        } else {
            badge.style.display = 'none';
            badge.textContent = '';
        }
    }

    const groups = lockers.reduce((acc, locker) => {
        const columnKey = locker.column_key || 'A';
        if (!acc[columnKey]) acc[columnKey] = [];
        acc[columnKey].push(locker);
        return acc;
    }, {});

    board.innerHTML = ['A', 'B', 'C', 'D', 'E'].map((columnKey) => {
        const columnLockers = (groups[columnKey] || []).sort((a, b) => String(a.locker_code).localeCompare(String(b.locker_code)));
        return `
            <div class="student-locker-column">
                <div class="student-locker-column-header">Locker ${columnKey}</div>
                <div class="student-locker-column-grid">
                    ${columnLockers.map((locker) => {
                        const isCurrentStudentLocker = !!currentLocker?.locker_code
                            && String(locker.locker_code || '').trim().toUpperCase() === String(currentLocker.locker_code || '').trim().toUpperCase();
                        const rawState = String(locker.state || 'available').toLowerCase();
                        const state = isCurrentStudentLocker ? 'your-locker' : rawState;
                        const stateLabel = state === 'your-locker'
                            ? 'Your Locker'
                            : (state === 'pending'
                                ? 'Pending'
                                : (state === 'occupied'
                                    ? 'Occupied'
                                    : (state === 'overdue' ? 'Overdue' : 'Available')));
                        const canRequest = !!locker.request_allowed;
                        return `
                            <button
                                type="button"
                                class="student-locker-tile state-${state}"
                                onclick="${canRequest ? `openStudentLockerRequestModal(${Number(locker.item_id)}, '${String(locker.locker_code || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')` : 'void(0)'}"
                                ${canRequest ? '' : 'disabled'}>
                                <span class="student-locker-code">${escapeStudentHtml(locker.locker_code || '')}</span>
                                <span class="student-locker-state">${stateLabel}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    if (currentLocker) {
        const normalizedStatus = getNormalizedLockerActivityStatus(currentLocker.status, currentLocker);
        const noticeEntries = getStudentLockerNoticeEntries(currentLocker);
        const currentAlert = noticeEntries.find((entry) => entry.type === 'overdue') || noticeEntries[noticeEntries.length - 1] || null;
        currentCard.innerHTML = `
            <div class="student-locker-current-top">
                <div class="student-locker-current-code">${escapeStudentHtml(currentLocker.locker_code || '-')}</div>
                <span class="status-badge ${getLockerActivityStatusClass(currentLocker.status)}">${escapeStudentHtml(getLockerActivityStatusLabel(currentLocker.status))}</span>
            </div>
            ${normalizedStatus === 'locker_pending' ? `
                <div class="student-locker-current-meta">
                    <span><strong>For Approval</strong></span>
                </div>
            ` : `
                <div class="student-locker-current-meta">
                    <span><i class="fa-solid fa-calendar-check"></i> Start: ${escapeStudentHtml(formatDate(currentLocker.rent_time))}</span>
                    <span><i class="fa-solid fa-calendar-xmark"></i> Due: ${escapeStudentHtml(formatDate(currentLocker.expected_return_time))}</span>
                    <span><i class="fa-solid fa-money-bill-wave"></i> ${Number(currentLocker.total_cost || 0).toFixed(2)}</span>
                </div>
            `}
            ${currentAlert ? `
                <div class="student-locker-notice-banner${currentAlert.urgent ? ' urgent' : ''}">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <div>
                        <strong>${escapeStudentHtml(getStudentLockerNoticeTitle(currentAlert))}</strong>
                        <p>${escapeStudentHtml(currentAlert.message)}</p>
                    </div>
                </div>
            ` : ''}
        `;
    } else {
        currentCard.innerHTML = `
            <div class="student-locker-empty">
                <i class="fa-solid fa-door-closed"></i>
                <p>You do not have an active locker request yet.</p>
            </div>
        `;
    }

    renderStudentLockerProfile();
}

function openStudentLockerModal() {
    const modal = document.getElementById('studentLockerModal');
    if (!modal || !studentLockerState.enabled) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeStudentLockerModal() {
    const modal = document.getElementById('studentLockerModal');
    if (!modal) return;
    closeStudentLockerConfirmModal();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function openStudentLockerRequestModal(itemId, lockerCode) {
    const modal = document.getElementById('studentLockerConfirmModal');
    const codeEl = document.getElementById('studentLockerConfirmCode');
    const confirmBtn = document.getElementById('studentLockerConfirmBtn');
    if (!modal) return;

    pendingStudentLockerSelection = {
        itemId: Number(itemId),
        lockerCode: String(lockerCode || '').trim() || '-'
    };

    if (codeEl) {
        codeEl.textContent = pendingStudentLockerSelection.lockerCode;
    }
    if (confirmBtn) {
        confirmBtn.disabled = false;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeStudentLockerConfirmModal() {
    const modal = document.getElementById('studentLockerConfirmModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    pendingStudentLockerSelection = null;

    const lockerModal = document.getElementById('studentLockerModal');
    if (!lockerModal || !lockerModal.classList.contains('open')) {
        document.body.classList.remove('modal-open');
    }
}

async function confirmStudentLockerRequest() {
    if (!pendingStudentLockerSelection?.itemId) {
        closeStudentLockerConfirmModal();
        return;
    }

    const confirmBtn = document.getElementById('studentLockerConfirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    await requestStudentLocker(pendingStudentLockerSelection.itemId);
}

function renderStudentLockerProfile() {
    const section = document.getElementById('profileLockerSection');
    const content = document.getElementById('profileLockerContent');
    if (!section || !content) return;

    const currentLocker = studentLockerState.current_locker || null;
    if (!studentLockerState.enabled || !currentLocker) {
        section.style.display = 'none';
        content.innerHTML = '';
        return;
    }

    section.style.display = 'block';
    const normalizedStatus = getNormalizedLockerActivityStatus(currentLocker.status, currentLocker);
    const noticeEntries = getStudentLockerNoticeEntries(currentLocker);
    const latestNotice = noticeEntries.find((entry) => entry.type === 'overdue') || noticeEntries[noticeEntries.length - 1] || null;
    content.innerHTML = `
        <div class="profile-locker-card">
            <div class="profile-locker-main">
                <div class="profile-locker-code">${escapeStudentHtml(currentLocker.locker_code || '-')}</div>
                ${normalizedStatus === 'locker_pending' ? `
                    <div class="profile-locker-details">
                        <span><strong>Status:</strong> For Approval</span>
                    </div>
                ` : `
                    <div class="profile-locker-details">
                        <span><strong>Status:</strong> ${escapeStudentHtml(getLockerActivityStatusLabel(currentLocker.status))}</span>
                        <span><strong>Start:</strong> ${escapeStudentHtml(formatDate(currentLocker.rent_time))}</span>
                        <span><strong>Due:</strong> ${escapeStudentHtml(formatDate(currentLocker.expected_return_time))}</span>
                        <span><strong>Price:</strong> ${Number(currentLocker.total_cost || 0).toFixed(2)}</span>
                    </div>
                `}
            </div>
            ${latestNotice ? `
                <div class="profile-locker-notice${latestNotice.urgent ? ' urgent' : ''}">
                    <i class="fa-solid fa-bell"></i>
                    <div>
                        <strong>${escapeStudentHtml(getStudentLockerNoticeTitle(latestNotice))}</strong>
                        <p>${escapeStudentHtml(latestNotice.message)}</p>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

async function loadStudentLockers(force = false) {
    try {
        const response = await fetch('../api/lockers/student/list.php', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load locker services.');
        }
        studentLockerState = {
            enabled: !!data.enabled,
            org_name: data.org_name || '',
            org_code: data.org_code || '',
            lockers: Array.isArray(data.lockers) ? data.lockers : [],
            current_locker: data.current_locker || null
        };
        renderStudentLockerBoard();
        return studentLockerState;
    } catch (error) {
        if (force) {
            console.error('[loadStudentLockers]', error);
        }
        studentLockerState = { enabled: false, org_name: '', org_code: '', lockers: [], current_locker: null };
        renderStudentLockerBoard();
        throw error;
    }
}

async function requestStudentLocker(itemId) {
    try {
        const response = await fetch('../api/lockers/student/request.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ item_id: itemId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not submit the locker request.');
        }
        studentLockerState = {
            enabled: !!data.enabled,
            org_name: data.org_name || '',
            org_code: data.org_code || '',
            lockers: Array.isArray(data.lockers) ? data.lockers : [],
            current_locker: data.current_locker || null
        };
        renderStudentLockerBoard();
        await Promise.all([
            loadCurrentRentals(),
            loadRentalHistory()
        ]);
        buildFilterOptions();
        updateMyRentalsEmptyState();
        closeStudentLockerConfirmModal();
        closeStudentLockerModal();
        showToast('Locker request submitted. Proceed to the SSC office to process the rental.');
    } catch (error) {
        const confirmBtn = document.getElementById('studentLockerConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
        alert(error.message || 'Could not submit the locker request.');
    }
}

function renderStudentPrintingJobs() {
    const heroLiveContainer = document.getElementById('printingHeroLive');
    const lists = [
        document.getElementById('studentPrintingJobsList'),
        document.getElementById('studentPrintingHeroJobs')
    ].filter(Boolean);
    if (!lists.length) return;

    const activePrintJobs = studentPrintingJobs.filter((job) => {
        const status = String(job.status || '').toLowerCase();
        return status !== 'claimed';
    });

    if (!activePrintJobs.length) {
        if (heroLiveContainer) {
            heroLiveContainer.style.display = 'none';
        }
        const emptyMarkup = `
            <div class="printing-empty-state">
                <i class="fa-solid fa-print"></i>
                <h3>No Active Print Jobs</h3>
                <p>Your open print requests will appear here until they are completed and claimed.</p>
              </div>
          `;
        lists.forEach((list) => {
            list.innerHTML = emptyMarkup;
        });
        return;
    }

    if (heroLiveContainer) {
        heroLiveContainer.style.display = '';
    }

    const markup = activePrintJobs.map((job) => {
        const status = String(job.status || '').toLowerCase();
        const queueText = status === 'queued' && Number(job.queue_position || 0) > 0
            ? `Queue #${job.queue_position}`
            : (status === 'processing' ? 'In progress' : (status === 'ready_to_claim' ? 'Ready now' : 'Completed'));
        const submittedAt = formatDateTime(job.submitted_at);
        const jobUrl = resolveStudentDocumentUrl(job.file_url);
        return `
            <div class="printing-job-card">
                <div class="printing-job-header">
                    <div>
                        <h4>${escapeStudentHtml(job.file_name || 'Untitled PDF')}</h4>
                        <p>${escapeStudentHtml(job.org_name || 'Unknown Organization')}${job.org_code ? ` (${escapeStudentHtml(job.org_code)})` : ''}</p>
                    </div>
                    <span class="printing-job-status status-${status}">${getPrintingJobStatusLabel(status)}</span>
                </div>
                <div class="printing-job-meta">
                    <span><i class="fa-solid fa-list-ol"></i> ${queueText}</span>
                    <span><i class="fa-solid fa-calendar-day"></i> ${submittedAt}</span>
                    ${job.notes ? `<span><i class="fa-solid fa-note-sticky"></i> ${escapeStudentHtml(job.notes)}</span>` : ''}
                </div>
                <div class="printing-job-actions">
                    ${jobUrl ? `<a class="printing-action-btn printing-action-btn-secondary" href="${jobUrl}" target="_blank" rel="noopener"><i class="fa-solid fa-eye"></i> View PDF</a>` : ''}
                    ${jobUrl ? `<a class="printing-action-btn printing-action-btn-primary" href="${jobUrl}" download><i class="fa-solid fa-download"></i> Download</a>` : ''}
                </div>
            </div>
        `;
    }).join('');
    lists.forEach((list) => {
        list.innerHTML = markup;
    });
}

async function loadStudentPrintJobs(force = false) {
    try {
        const response = await fetch('../api/printing/student/list.php?status=all', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load print jobs.');
        }
        studentPrintingJobs = (Array.isArray(data.items) ? data.items : []).sort((a, b) => {
            const aDate = new Date(a.submitted_at || a.updated_at || 0).getTime();
            const bDate = new Date(b.submitted_at || b.updated_at || 0).getTime();
            return bDate - aDate;
        });
        renderStudentPrintingJobs();
        buildFilterOptions();
        renderRentalHistory();
        updateMyRentalsEmptyState();
        return studentPrintingJobs;
    } catch (error) {
        if (force) {
            console.error('[loadStudentPrintJobs]', error);
        }
        studentPrintingJobs = [];
        renderStudentPrintingJobs();
        buildFilterOptions();
        renderRentalHistory();
        updateMyRentalsEmptyState();
        throw error;
    }
}

async function submitStudentPrintJob() {
    const providerSelect = document.getElementById('printingProviderSelect');
    const fileInput = document.getElementById('printingFileInput');
    const notesInput = document.getElementById('printingNotes');
    const submitBtn = document.getElementById('btnPrintingSubmit');

    const orgId = String(providerSelect?.value || '').trim();
    const file = fileInput?.files?.[0] || null;
    const notes = String(notesInput?.value || '').trim();

    if (!orgId) {
        alert('Select a printing provider first.');
        return;
    }
    if (!file) {
        alert('Select a PDF file first.');
        return;
    }

    const payload = new FormData();
    payload.append('org_id', orgId);
    payload.append('notes', notes);
    payload.append('file', file);

    if (submitBtn) submitBtn.disabled = true;
    try {
        const response = await fetch('../api/printing/student/submit.php', {
            method: 'POST',
            credentials: 'same-origin',
            body: payload
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not submit print job.');
        }

        if (fileInput) fileInput.value = '';
        if (notesInput) notesInput.value = '';
        const nameLabel = document.getElementById('printingSelectedFileName');
        if (nameLabel) nameLabel.textContent = 'No file selected.';

        await loadStudentPrintJobs(true);
    } catch (error) {
        alert(error.message || 'Could not submit print job.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function groupCatalogByCategory(items) {
    return items.reduce((acc, item) => {
        const key = String(item.category_name || 'Uncategorized').trim() || 'Uncategorized';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
}

function formatStudentRate(item) {
    const min = Number(item.hourly_rate_min || 0);
    const max = Number(item.hourly_rate_max || 0);
    if (min === max) {
        return `₱${min.toFixed(2)}/hr`;
    }
    return `₱${min.toFixed(2)} - ₱${max.toFixed(2)}/hr`;
}

function isStudentServiceAvailable(item) {
    return Number(item?.available_count || 0) > 0;
}

function renderServices(filter = "") {
    const grid = document.getElementById('servicesGrid');
    const hero = document.getElementById('printingHero');
    const filterLower = String(filter || '').toLowerCase();
    const printingModule = getServiceModuleMeta('printing');
    const printingEnabled = printingModule ? !!printingModule.enabled : false;
    const printingKeywords = ["printing", "photo", "1x1"];
    const showHero = printingEnabled && (filterLower === "" || printingKeywords.some(keyword => filterLower.includes(keyword)));
    if (!grid) return;
    if (hero) {
        hero.style.display = showHero ? "block" : "none";
    }

    if (!studentServiceCatalogLoaded) {
        grid.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 40px;">Loading services...</div>`;
        return;
    }

    const filteredItems = studentServiceCatalog.filter((item) => {
        const isPrintingItem = String(item.display_name || '').toLowerCase() === 'printing'
            || String(item.category_name || '').toLowerCase().includes('print');
        if (isPrintingItem) {
            return false;
        }
        const searchBlob = [
            item.display_name,
            item.category_name,
            ...(Array.isArray(item.orgs) ? item.orgs.map(org => `${org.org_name} ${org.org_code}`) : [])
        ].join(' ').toLowerCase();
        return !filterLower || searchBlob.includes(filterLower);
    });

    const grouped = groupCatalogByCategory(filteredItems);
    const categories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    if (!categories.length) {
        grid.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 40px;">No services found matching "${filter}".</div>`;
        return;
    }

    grid.innerHTML = '';
    categories.forEach((categoryName) => {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <div class="category-icon"><i class="fa-solid ${getServiceCategoryIcon(categoryName)}"></i></div>
            <div class="category-title">${categoryName}</div>
        `;
        section.appendChild(header);

        const cardGrid = document.createElement('div');
        cardGrid.className = 'category-grid';

        grouped[categoryName]
            .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')))
            .forEach((service) => {
                const card = document.createElement('div');
                card.className = 'service-card gallery-card';
                const orgSummary = Array.isArray(service.orgs) ? service.orgs.map(org => org.org_code).join(', ') : '';
                const isAvailable = isStudentServiceAvailable(service);
                const availabilityText = isAvailable
                    ? `${service.available_count} available - ${formatStudentRate(service)}`
                    : `Unavailable - ${Number(service.total_count || 0)} in inventory`;
                if (!isAvailable) {
                    card.classList.add('service-card-unavailable');
                    card.style.opacity = '0.72';
                }
                card.innerHTML = `
                    <div class="gallery-img-wrapper">
                        <img src="${resolveStudentCatalogImage(service.image_path)}" alt="${service.display_name}" loading="lazy">
                    </div>
                    <div class="gallery-content">
                        <div class="service-name">${service.display_name}</div>
                        <div class="service-org" style="font-size:0.8rem; color:var(--muted); margin-top:4px;">${orgSummary}</div>
                        <div class="service-org" style="font-size:0.8rem; color:var(--muted);">${availabilityText}</div>
                    </div>
                `;
                card.onclick = () => openServiceModal(service.display_name, null, service);
                card.style.cursor = "pointer";
                card.setAttribute('role', 'button');
                card.setAttribute('aria-label', `Select organization for ${service.display_name}`);
                card.setAttribute('tabindex', '0');
                card.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openServiceModal(service.display_name, null, service);
                    }
                };
                cardGrid.appendChild(card);
            });

        section.appendChild(cardGrid);
        grid.appendChild(section);
    });
}

function filterServices() {
    const searchInput = document.getElementById('serviceSearch');
    renderServices(searchInput ? searchInput.value : '');
}

// --- UPLOAD ZONE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const studentServicesOverview = document.getElementById('studentServicesOverview');
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const uploadContent = uploadZone?.querySelector('.upload-content');
    const fileSelectedState = document.getElementById('fileSelectedState');
    const printingHeroPreviewArea = document.getElementById('printingHeroPreviewArea');
    const filenameText = document.getElementById('filenameText');
    const fileSelectionSummary = document.getElementById('fileSelectionSummary');
    const printingFilesList = document.getElementById('printingFilesList');
    const btnUploadSubmit = document.getElementById('btnUploadSubmit');
    const btnAddAnotherFile = document.getElementById('btnAddAnotherFile');
    let selectedPrintFiles = [];
    let printPreviewRenderToken = 0;

    if (!uploadZone) return;

    // Click to browse
    uploadZone.addEventListener('click', (e) => {
        const interactiveTarget = e.target.closest('button, select, option, textarea, input, label');
        const clickedSelectedState = fileSelectedState && fileSelectedState.contains(e.target);
        if (interactiveTarget || clickedSelectedState) {
            return;
        }
        fileInput.click();
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
        handleFiles(this.files, selectedPrintFiles.length > 0);
        fileInput.value = '';
    });

    function handleFiles(files, append = false) {
        const fileList = Array.from(files || []);
        if (!fileList.length) {
            if (!append) {
                resetUploadUI();
            }
            return;
        }

        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg'];
        const validExtensions = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
        const invalidFile = fileList.find((file) => {
            const fileExtension = String(file.name || '').split('.').pop().toLowerCase();
            return !(validTypes.includes(file.type) || validExtensions.includes(fileExtension));
        });

        if (invalidFile) {
            alert('Invalid file format. Please upload PDF, DOCX, PNG, or JPG.');
            resetUploadUI();
            return;
        }

        const newEntries = fileList.map((file) => ({ file, note: '' }));
        selectedPrintFiles = append ? [...selectedPrintFiles, ...newEntries] : newEntries;
        showFileSelected(selectedPrintFiles);
    }

    function renderSelectedPrintFiles(files) {
        if (!printingFilesList) return;
        printingFilesList.innerHTML = files.map((entry, index) => {
            const file = entry.file;
            const objectUrl = URL.createObjectURL(file);
            const isImage = String(file.type || '').startsWith('image/');
            const isPdf = String(file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || '');
            const preview = isImage
                ? `<img class="printing-file-preview-image" src="${objectUrl}" alt="${escapeHtml(file.name || `File ${index + 1}`)}">`
                : isPdf
                    ? `<canvas class="printing-file-preview-canvas" data-print-preview-index="${index}" aria-label="${escapeHtml(file.name || `File ${index + 1}`)} preview"></canvas>`
                    : `<div class="printing-file-preview-fallback">
                        <i class="fa-solid ${isPdf ? 'fa-file-pdf' : 'fa-file-lines'}"></i>
                        <span>${isPdf ? 'PDF' : 'Document'}</span>
                    </div>`;

            return `
                <div class="printing-file-card">
                    <div class="printing-file-preview">
                        ${preview}
                    </div>
                    <div class="printing-file-row-header">
                        <span class="printing-file-name" title="${escapeHtml(file.name || `File ${index + 1}`)}">${escapeHtml(file.name || `File ${index + 1}`)}</span>
                        <button type="button" class="printing-file-remove" data-remove-print-index="${index}" aria-label="Remove file">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <span class="printing-file-meta">${formatFileSize(file.size || 0)}</span>
                    <textarea
                        class="printing-file-note"
                        data-print-note-index="${index}"
                        rows="2"
                        placeholder="Add notes for this file here">${escapeHtml(entry.note || '')}</textarea>
                </div>
            `;
        }).join('');
    }

    async function renderPdfFilePreviews(files) {
        if (typeof pdfjsLib === 'undefined' || !printingFilesList) return;
        const currentToken = ++printPreviewRenderToken;
        const pdfEntries = files
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => String(entry.file?.type || '').includes('pdf') || /\.pdf$/i.test(entry.file?.name || ''));

        for (const { entry, index } of pdfEntries) {
            const canvas = printingFilesList.querySelector(`[data-print-preview-index="${index}"]`);
            if (!canvas) continue;
            try {
                const buffer = await entry.file.arrayBuffer();
                if (currentToken !== printPreviewRenderToken) return;
                const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
                const page = await pdf.getPage(1);
                if (currentToken !== printPreviewRenderToken) return;
                const unscaledViewport = page.getViewport({ scale: 1 });
                const scale = Math.min(150 / unscaledViewport.width, 180 / unscaledViewport.height);
                const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: context, viewport }).promise;
            } catch (_error) {
                canvas.replaceWith(Object.assign(document.createElement('div'), {
                    className: 'printing-file-preview-fallback',
                    innerHTML: '<i class="fa-solid fa-file-pdf"></i><span>PDF</span>'
                }));
            }
        }
    }

    function syncStudentServicesLayout(hasSelectedFiles) {
        if (!studentServicesOverview) return;
        studentServicesOverview.classList.toggle('is-stacked', Boolean(hasSelectedFiles));
    }

    function showFileSelected(files) {
        syncStudentServicesLayout(files.length > 0);
        uploadContent.style.display = 'none';
        fileSelectedState.style.display = 'flex';
        if (printingHeroPreviewArea) printingHeroPreviewArea.style.display = 'flex';
        filenameText.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
        if (fileSelectionSummary) {
            fileSelectionSummary.textContent = files.length === 1
                ? 'Preview the file and add notes below before submitting'
                : 'Preview each file and add notes below before submitting';
        }
        renderSelectedPrintFiles(files);
        renderPdfFilePreviews(files);
        btnUploadSubmit.disabled = false;
    }

    function resetUploadUI() {
        syncStudentServicesLayout(false);
        uploadContent.style.display = 'block';
        fileSelectedState.style.display = 'none';
        if (printingHeroPreviewArea) printingHeroPreviewArea.style.display = 'none';
        if (printingFilesList) printingFilesList.innerHTML = '';
        if (fileSelectionSummary) fileSelectionSummary.textContent = 'Add notes for each file before submitting';
        selectedPrintFiles = [];
        fileInput.value = ''; // Reset input
        btnUploadSubmit.disabled = true;
    }

    function formatFileSize(size) {
        const bytes = Number(size || 0);
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    btnUploadSubmit.addEventListener('click', async (e) => {
        e.stopPropagation(); // Stop bubbling to uploadZone click
        if (selectedPrintFiles.length) {
            const provider = document.getElementById('uploadPrintProvider');
            const orgId = String(provider?.value || '').trim();
            if (!orgId) {
                alert('Select a printing provider first.');
                return;
            }

            const payload = new FormData();
            payload.append('org_id', orgId);
            selectedPrintFiles.forEach((entry) => {
                payload.append('files[]', entry.file);
                payload.append('notes[]', String(entry.note || '').trim());
            });

            btnUploadSubmit.disabled = true;
            try {
                const response = await fetch('../api/printing/student/submit.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: payload
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || 'Could not submit print job.');
                }
                resetUploadUI();
                await loadStudentPrintJobs(true);
            } catch (error) {
                alert(error.message || 'Could not submit print job.');
                btnUploadSubmit.disabled = false;
            }
        }
    });

    if (btnAddAnotherFile) {
        btnAddAnotherFile.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    if (printingFilesList) {
        printingFilesList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('[data-remove-print-index]');
            if (!removeButton) return;
            const index = Number(removeButton.getAttribute('data-remove-print-index'));
            if (Number.isNaN(index)) return;
            selectedPrintFiles.splice(index, 1);
            if (!selectedPrintFiles.length) {
                resetUploadUI();
                return;
            }
            showFileSelected(selectedPrintFiles);
        });

        printingFilesList.addEventListener('input', (e) => {
            const noteInput = e.target.closest('[data-print-note-index]');
            if (!noteInput) return;
            const index = Number(noteInput.getAttribute('data-print-note-index'));
            if (Number.isNaN(index) || !selectedPrintFiles[index]) return;
            selectedPrintFiles[index].note = noteInput.value;
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const printingFileInput = document.getElementById('printingFileInput');
    const printingSelectedFileName = document.getElementById('printingSelectedFileName');
    const printingSubmitButton = document.getElementById('btnPrintingSubmit');

    if (printingFileInput && printingSelectedFileName) {
        printingFileInput.addEventListener('change', () => {
            const file = printingFileInput.files && printingFileInput.files[0];
            printingSelectedFileName.textContent = file ? file.name : 'No file selected.';
        });
    }

    if (printingSubmitButton) {
        printingSubmitButton.addEventListener('click', submitStudentPrintJob);
    }
});

// --- DATA MAPPING (Service -> Organizations) ---
const serviceOrgMapping = {
    "Shoe Rag": ["AISERS"],
    "Business Calculator": ["AISERS"],
    "Scientific Calculator": ["SSC", "AERO-ATSO"],
    "Arnis": ["AISERS"],
    "Printing": ["SSC", "CYC", "AMTSO", "AETSO"],
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

// --- GLOBAL STATE ---
let currentSelectedService = null;
let currentSelectedOrg = null;
let currentParentGroup = null; // Track if we came from a group (e.g. Calculator)
let currentSelectedHourlyRate = null;
let currentSelectedInventoryItemName = null;
let currentQuoteRequestId = 0;
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
        const childData = getStudentScopedServices().find(s => s.name === childName) || servicesData.find(s => s.name === childName);

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
        closeStudentLockerModal();
    }
});

function handleBackToItemSelect() {
    if (currentParentGroup) {
        openItemSelectModal(currentParentGroup);
    }
}

function openServiceModal(serviceName, parentGroup = null, catalogItem = null) {
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
    currentSelectedCatalogItem = catalogItem;
    currentParentGroup = parentGroup; // Store for back navigation
    continueBtn.disabled = true;

    // Set Content
    titleEl.innerText = "Select an Organization";
    subtitleEl.innerText = `Choose who will provide: ${serviceName}`;
    listContainer.innerHTML = '';

    // Populate Orgs from the live catalog when available
    const orgOptions = catalogItem && Array.isArray(catalogItem.orgs)
        ? catalogItem.orgs.map((org) => ({
            label: org.org_name,
            value: org.org_code || org.org_name,
            meta: Number(org.available_count || 0) > 0
                ? `${org.available_count} available`
                : `Unavailable • ${Number(org.total_count || 0)} in inventory`,
        }))
        : (serviceOrgMapping[serviceName] || []).map((orgName) => ({
            label: orgName,
            value: orgName,
            meta: '',
        }));

    // Logo Mapping
    const orgLogos = {
        "AISERS": "../assets/photos/studentDashboard/Organization/AISERS.png",
        "AMTSO": "../assets/photos/studentDashboard/Organization/AMT.png",
        "AERO-ATSO": "../assets/photos/studentDashboard/Organization/AEROATSO.png",
        "ELITECH": "../assets/photos/studentDashboard/Organization/ELITECH.png",
        "SSC": "../assets/photos/studentDashboard/Organization/SSC.png",
        "Supreme Student Council": "../assets/photos/studentDashboard/Organization/SSC.png"
    };

    if (orgOptions.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:var(--muted); padding:20px;">No organizations found for this service.</div>`;
    } else {
        orgOptions.forEach((orgOption) => {
            const card = document.createElement('div');
            card.className = 'org-option-card';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.onclick = () => selectOrgOption(orgOption.value, card);
            card.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectOrgOption(orgOption.value, card);
                }
            };

            // Check if we have a logo, otherwise initials
            const logoPath = orgLogos[orgOption.value] || orgLogos[orgOption.label];
            const initials = orgOption.label.substring(0, 2).toUpperCase();

            const avatarContent = logoPath
                ? `<img src="${logoPath}" alt="${orgOption.label} logo">`
                : initials;

            card.innerHTML = `
                <div class="org-info">
                    <div class="org-avatar">${avatarContent}</div>
                    <div>
                        <div class="org-name-text">${orgOption.label}</div>
                        ${orgOption.meta ? `<small style="color:var(--muted);">${orgOption.meta}</small>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-circle-check check-icon"></i>
            `;
            listContainer.appendChild(card);

            if (orgOptions.length === 1) selectOrgOption(orgOption.value, card);
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
    currentSelectedHourlyRate = null;
    currentSelectedInventoryItemName = null;
    const allCards = document.querySelectorAll('.org-option-card');
    allCards.forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    document.getElementById('btnStep1Continue').disabled = false;
}

function handleServiceContinue() {
    if (!currentSelectedService || !currentSelectedOrg) return;
    if (currentSelectedCatalogItem && !isStudentServiceAvailable(currentSelectedCatalogItem)) {
        showError('This item is currently unavailable for reservation.');
        return;
    }
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
    currentSelectedCatalogItem = null;
    currentParentGroup = null;
    currentSelectedHourlyRate = null;
    currentSelectedInventoryItemName = null;
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

    document.getElementById('totalAmountDisplay').innerText = "Loading live rate...";

    loadRentalQuote(0)
        .then((quote) => {
            if (quote && !document.getElementById('duration').value) {
                document.getElementById('totalAmountDisplay').innerText = `₱0.00`;
            }
        })
        .catch((err) => {
            showError(err.message || 'Could not load rental price.');
        });

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

async function loadRentalQuote(hours = 0) {
    if (!currentSelectedService || !currentSelectedOrg) {
        return null;
    }

    const requestId = ++currentQuoteRequestId;
    const params = new URLSearchParams({
        organization: currentSelectedOrg,
        item_name: currentSelectedService,
        hours: String(hours || 0)
    });
    const response = await fetch(`../api/student/rentals/quote.php?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not load rental price.');
    }

    if (requestId !== currentQuoteRequestId) {
        return null;
    }

    currentSelectedHourlyRate = Number(data.hourly_rate || 0);
    currentSelectedInventoryItemName = data.item_name || currentSelectedService;
    return data;
}

async function calculateRental() {
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
        priceDisplay.innerText = currentSelectedHourlyRate === null ? "Loading live rate..." : "₱0.00";
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

    // 4. Calculate Price from the live inventory_items.hourly_rate
    let calculatedAmount = 0;
    try {
        const quote = await loadRentalQuote(totalHours);
        const liveHourlyRate = quote ? Number(quote.hourly_rate || 0) : Number(currentSelectedHourlyRate || 0);
        calculatedAmount = liveHourlyRate * totalHours;
    } catch (err) {
        showError(err.message || 'Could not load rental price.');
        confirmBtn.disabled = true;
        return;
    }

    // 5. Valid State: Update UI
    rentalData.date = dateVal;
    rentalData.startTime = startVal;
    rentalData.hours = totalHours;
    rentalData.duration = durationVal;
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

async function confirmRental() {
    const confirmBtn = document.getElementById('btnStep2Confirm');
    const errorMsg = document.getElementById('rentalErrorMessage');

    if (!currentSelectedService || !currentSelectedOrg || !rentalData.hours) {
        showError('Complete the rental details first.');
        return;
    }

    if (confirmBtn) confirmBtn.disabled = true;
    if (errorMsg) {
        errorMsg.innerText = "";
        errorMsg.classList.remove('visible');
    }

    try {
        const scheduledStart = `${rentalData.date} ${rentalData.startTime}:00`;
        const resp = await fetch('../api/student/rentals/create.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                organization: currentSelectedOrg,
                item_name: currentSelectedService,
                hours: rentalData.hours,
                scheduled_start: scheduledStart
            })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'Could not create rental.');
        }

        await loadStudentServiceCatalog(true);
        renderServices((document.getElementById('serviceSearch') || {}).value || '');
        await loadCurrentRentals();
        showToast(`Reservation Confirmed: ${currentSelectedService} on ${rentalData.date} at ${rentalData.startTime}`);
        closeServiceModal();
    } catch (err) {
        showError(err.message || 'Could not create rental.');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
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
        const lockerConfirmModal = document.getElementById('studentLockerConfirmModal');
        if (lockerConfirmModal && lockerConfirmModal.classList.contains('open')) {
            closeStudentLockerConfirmModal();
            return;
        }
        const lockerModal = document.getElementById('studentLockerModal');
        if (lockerModal && lockerModal.classList.contains('open')) {
            closeStudentLockerModal();
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

// === CURRENT RENTALS FEATURE ===
let currentRentalsData = [];
let rentalTimerInterval = null;

function isStudentRentalNoShow(rental) {
    if (String(rental?.status || '').toLowerCase() !== 'reserved') return false;
    const raw = String(rental.expected_return_time || '').trim();
    const due = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime();
    return !Number.isNaN(due) && due < Date.now();
}

async function loadCurrentRentals() {
    try {
        const response = await fetch('../api/student/rentals/my-rentals.php?status=open', {
            method: 'GET',
            credentials: 'same-origin'
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load current rentals.');
        }

        currentRentalsData = (Array.isArray(data.items) ? data.items : []).sort((a, b) => {
            const aDate = new Date(a.rent_time || a.created_at || 0).getTime();
            const bDate = new Date(b.rent_time || b.created_at || 0).getTime();
            return bDate - aDate;
        });
        renderCurrentRentals();
    } catch (err) {
        console.error('[loadCurrentRentals]', err);
        currentRentalsData = [];
        renderCurrentRentals();
    }
}

function renderCurrentRentals() {
    const section = document.getElementById('currentRentalsSection');
    const container = document.getElementById('currentRentalsContainer');

    if (!section || !container) return;

    // Clear timer if exists
    if (rentalTimerInterval) {
        clearInterval(rentalTimerInterval);
        rentalTimerInterval = null;
    }

    if (currentRentalsData.length === 0) {
        section.style.display = 'none';
        // Update empty state
        if (typeof updateMyRentalsEmptyState === 'function') {
            updateMyRentalsEmptyState();
        }
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    currentRentalsData.forEach(rental => {
        const card = createRentalCard(rental);
        container.appendChild(card);
    });

    // Start timer for active rentals
    const hasActiveRentals = currentRentalsData.some(r => r.status === 'active');
    if (hasActiveRentals) {
        updateRentalTimers();
        rentalTimerInterval = setInterval(updateRentalTimers, 1000);
    }

    // Update empty state
    if (typeof updateMyRentalsEmptyState === 'function') {
        updateMyRentalsEmptyState();
    }
}

function createRentalCard(rental) {
    if (String(rental.service_kind || '').toLowerCase() === 'locker') {
        const card = document.createElement('div');
        card.className = 'rental-card locker-rental-card';
        const lockerCode = String(rental.items_label || rental.barcodes || 'Locker').replace(/\s*\(\d+x\)/g, '').trim();
        const statusClass = getLockerActivityStatusClass(rental.status, rental);
        const statusText = getLockerActivityStatusLabel(rental.status, rental);
        card.innerHTML = `
            <div class="rental-card-header">
                <div class="rental-card-status ${statusClass}">${statusText}</div>
                <div class="rental-card-org">${rental.org_name || 'Supreme Student Council'}</div>
            </div>
            <div class="rental-card-items">
                <h4><i class="fa-solid fa-door-closed"></i> Locker Assignment</h4>
                <div class="rental-items-list">${escapeStudentHtml(lockerCode)}</div>
            </div>
            <div class="rental-card-details">
                <div class="rental-detail-row">
                    <i class="fa-solid fa-calendar-check"></i>
                    <span class="rental-detail-label">Start:</span>
                    <span class="rental-detail-value">${formatDateTime(rental.rent_time)}</span>
                </div>
                <div class="rental-detail-row">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <span class="rental-detail-label">Due:</span>
                    <span class="rental-detail-value">${formatDateTime(rental.expected_return_time)}</span>
                </div>
                ${rental.locker_notice_message ? `
                    <div class="rental-detail-row locker-rental-notice">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span class="rental-detail-value">${escapeStudentHtml(rental.locker_notice_message)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="rental-card-footer">
                <div class="rental-cost">${parseFloat(rental.total_cost || 0).toFixed(2)}</div>
                <div class="rental-payment-status ${rental.payment_status}">${rental.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</div>
            </div>
        `;
        return card;
    }

    const card = document.createElement('div');
    card.className = 'rental-card';
    card.setAttribute('data-rental-id', rental.rental_id);

    const isNoShow = isStudentRentalNoShow(rental);
    const statusClass = isNoShow
        ? 'status-no-show'
        : (rental.status === 'active' ? 'status-active' : 'status-reserved');
    const statusText = isNoShow
        ? 'No Show'
        : (rental.status === 'active' ? 'Active' : 'Reserved');

    const rentTimeFormatted = formatDateTime(rental.rent_time);
    const expectedReturnFormatted = formatDateTime(rental.expected_return_time);

    let timerHtml = '';
    if (rental.status === 'active') {
        timerHtml = `
            <div class="rental-timer" data-rental-id="${rental.rental_id}">
                <i class="fa-solid fa-clock"></i>
                <div class="rental-timer-text">
                    <div class="rental-timer-label">Time Remaining</div>
                    <div class="rental-timer-value">--:--:--</div>
                </div>
            </div>
        `;
    } else if (rental.status === 'reserved') {
        timerHtml = `
            <div class="rental-detail-row">
                <i class="fa-solid fa-calendar-check"></i>
                <span class="rental-detail-label">${isNoShow ? 'Missed:' : 'Scheduled:'}</span>
                <span class="rental-detail-value">${rentTimeFormatted}</span>
            </div>
        `;
    }

    const itemsLabel = String(rental.items_label || 'No items').replace(/\s*\(\d+x\)/g, '').trim();

    card.innerHTML = `
        <div class="rental-card-header">
            <div class="rental-card-status ${statusClass}">${statusText}</div>
            <div class="rental-card-org">${rental.org_name || 'Unknown Org'}</div>
        </div>

        <div class="rental-card-items">
            <h4><i class="fa-solid fa-box"></i> Rented Items</h4>
            <div class="rental-items-list">${itemsLabel || 'No items'}</div>
        </div>

        ${timerHtml}

        <div class="rental-card-details">
            ${rental.status === 'active' ? `
            <div class="rental-detail-row">
                <i class="fa-solid fa-clock"></i>
                <span class="rental-detail-label">Started:</span>
                <span class="rental-detail-value">${rentTimeFormatted}</span>
            </div>
            ` : ''}
            <div class="rental-detail-row">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <span class="rental-detail-label">${isNoShow ? 'Was Due:' : 'Due:'}</span>
                <span class="rental-detail-value">${expectedReturnFormatted}</span>
            </div>
        </div>

        <div class="rental-card-footer">
            <div class="rental-cost">₱${parseFloat(rental.total_cost).toFixed(2)}</div>
            <div class="rental-payment-status ${rental.payment_status}">${rental.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</div>
        </div>
    `;

    return card;
}

function updateRentalTimers() {
    const now = new Date();

    currentRentalsData.forEach(rental => {
        if (rental.status !== 'active') return;

        const timer = document.querySelector(`.rental-timer[data-rental-id="${rental.rental_id}"] .rental-timer-value`);
        if (!timer) return;

        const expectedReturn = new Date(rental.expected_return_time);
        const diff = expectedReturn - now;

        if (diff <= 0) {
            timer.textContent = 'OVERDUE';
            timer.style.color = '#dc2626';
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        timer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    });
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';

    const date = new Date(dateTimeStr);
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

    const datePart = date.toLocaleDateString('en-US', dateOptions);
    const timePart = date.toLocaleTimeString('en-US', timeOptions);

    return `${datePart} at ${timePart}`;
}

// ========================================
// RENTAL HISTORY
// ========================================

let rentalHistoryData = [];

function updateMyRentalsEmptyState() {
    const currentSection = document.getElementById('currentRentalsSection');
    const historySection = document.getElementById('rentalHistorySection');
    const emptyMessage = document.getElementById('noRentalsMessage');

    if (!emptyMessage) return;

    const hasCurrentRentals = currentRentalsData.length > 0;
    const hasHistory = rentalHistoryData.length > 0 || studentPrintingJobs.length > 0;

    if (!hasCurrentRentals && !hasHistory) {
        emptyMessage.style.display = 'block';
        if (currentSection) currentSection.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
    }
}

async function loadRentalHistory() {
    try {
        const response = await fetch('../api/student/rentals/my-rentals.php?status=', {
            method: 'GET',
            credentials: 'same-origin'
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load rental history.');
        }

        const allRentals = Array.isArray(data.items) ? data.items : [];

        // Filter for completed/history rentals.
        // Also include no-show rows that may already be stored as cancelled.
        rentalHistoryData = allRentals.filter(rental => {
            const status = String(rental.status).toLowerCase();
            if (String(rental.service_kind || '').toLowerCase() === 'locker') {
                return ['locker_pending', 'locker_active', 'locker_overdue', 'locker_released', 'locker_rejected'].includes(status);
            }
            if (status === 'returned' || status === 'completed' || status === 'cancelled') return true;

            // Check if it's a no-show (reserved but past expected return time)
            if (status === 'reserved' && isStudentRentalNoShow(rental)) return true;

            return false;
        }).sort((a, b) => {
            const aDate = new Date(a.rent_time || a.actual_return_time || a.expected_return_time || 0).getTime();
            const bDate = new Date(b.rent_time || b.actual_return_time || b.expected_return_time || 0).getTime();
            return bDate - aDate;
        });

        renderRentalHistory();
    } catch (err) {
        console.error('[loadRentalHistory]', err);
        rentalHistoryData = [];
        renderRentalHistory();
    }
}

function renderRentalHistory() {
    const section = document.getElementById('rentalHistorySection');
    const tableBody = document.getElementById('rentalHistoryTable');

    if (!section || !tableBody) return;

    const printHistoryData = studentPrintingJobs.map(createPrintActivityEntry);
    const activityRows = [...rentalHistoryData, ...printHistoryData]
        .sort((a, b) => {
            const aDate = new Date(a._activityDate || a.submitted_at || a.rent_time || 0).getTime();
            const bDate = new Date(b._activityDate || b.submitted_at || b.rent_time || 0).getTime();
            return bDate - aDate;
        });

    if (activityRows.length === 0) {
        section.style.display = 'none';
        // Update empty state
        if (typeof updateMyRentalsEmptyState === 'function') {
            updateMyRentalsEmptyState();
        }
        return;
    }

    section.style.display = 'block';
    tableBody.innerHTML = '';

    activityRows.forEach(rental => {
        const row = createRentalHistoryRow(rental);
        tableBody.appendChild(row);
    });

    // Update empty state
    if (typeof updateMyRentalsEmptyState === 'function') {
        updateMyRentalsEmptyState();
    }
}

function createPrintActivityEntry(job) {
    return {
        ...job,
        _activityType: 'printing',
        _activityDate: job.submitted_at || job.updated_at || ''
    };
}

function createRentalHistoryRow(rental) {
    const row = document.createElement('tr');

    if (rental && rental._activityType === 'printing') {
        const submittedDate = formatDate(rental.submitted_at || rental.updated_at);
        const fileName = String(rental.file_name || 'Untitled PDF').trim();
        const orgName = rental.org_name || 'Unknown';
        const queueLabel = Number(rental.queue_position || 0) > 0
            ? `Queue #${rental.queue_position}`
            : 'Completed';
        const details = String(rental.notes || '').trim() || 'Print request submitted';
        const status = String(rental.status || 'queued').toLowerCase();
        const statusClass = getStatusClass(status);
        const statusText = getStatusText(status);

        row.innerHTML = `
            <td>${submittedDate}</td>
            <td>Printing</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeStudentHtml(fileName)}">${escapeStudentHtml(fileName)}</td>
            <td>${escapeStudentHtml(orgName)}</td>
            <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeStudentHtml(details)}">${escapeStudentHtml(details)}</td>
            <td>${escapeStudentHtml(queueLabel)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;

        return row;
    }

    if (String(rental.service_kind || '').toLowerCase() === 'locker') {
        const activityDate = formatDate(rental.rent_time || rental.updated_at);
        const lockerCode = String(rental.items_label || rental.barcodes || 'Locker').replace(/\s*\(\d+x\)/g, '').trim();
        const details = rental.locker_notice_message
            ? rental.locker_notice_message
            : (rental.locker_period_type ? rental.locker_period_type.replace(/_/g, ' ') : 'Locker assignment');
        const statusClass = getLockerActivityStatusClass(rental.status, rental);
        const statusText = getLockerActivityStatusLabel(rental.status, rental);
        row.innerHTML = `
            <td>${activityDate}</td>
            <td>Locker</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeStudentHtml(lockerCode)}">${escapeStudentHtml(lockerCode)}</td>
            <td>${escapeStudentHtml(rental.org_name || 'Supreme Student Council')}</td>
            <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeStudentHtml(details)}">${escapeStudentHtml(details)}</td>
            <td>${Number(rental.total_cost || 0).toFixed(2)}</td>
            <td><span class="status-badge ${statusClass}">${escapeStudentHtml(statusText)}</span></td>
        `;
        return row;
    }

    // Format dates
    const rentDate = formatDate(rental.rent_time);
    const items = String(rental.items_label || 'No items').replace(/\s*\(\d+x\)/g, '').trim();
    const orgName = rental.org_name || 'Unknown';

    // Calculate duration
    const duration = calculateDuration(rental.rent_time, rental.actual_return_time || rental.expected_return_time);

    // Format cost
    const cost = `₱${parseFloat(rental.total_cost || 0).toFixed(2)}`;

    // Status badge - check if no-show
    let status = String(rental.status || 'unknown').toLowerCase();
    if (status === 'cancelled' && String(rental.payment_status || '').toLowerCase() === 'unpaid') {
        status = 'no-show';
    } else if (isStudentRentalNoShow(rental)) {
        status = 'no-show';
    }
    const statusClass = getStatusClass(status, rental.payment_status);
    const statusText = getStatusText(status);

    row.innerHTML = `
        <td>${rentDate}</td>
        <td>Rental</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${items}">${items}</td>
        <td>${orgName}</td>
        <td>${duration}</td>
        <td>${cost}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    `;

    return row;
}

function formatDate(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    const date = new Date(dateTimeStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 'N/A';

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    if (diffMs < 0) return 'N/A';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function getStatusClass(status, paymentStatus) {
    if (status === 'returned') return 'status-returned';
    if (status === 'no-show') return 'status-no-show';
    if (status === 'locker_overdue') return 'status-no-show';
    if (status === 'cancelled') return 'status-unknown';
    if (status === 'completed') return 'status-completed';
    if (status === 'queued') return 'status-reserved';
    if (status === 'processing') return 'status-active';
    if (status === 'ready_to_claim') return 'status-completed';
    if (status === 'claimed') return 'status-returned';
    return 'status-unknown';
}

function getStatusText(status) {
    if (status === 'returned') return 'Returned';
    if (status === 'no-show') return 'No Show';
    if (status === 'locker_overdue') return 'Locker Overdue';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'completed') return 'Completed';
    if (status === 'queued') return 'Queued';
    if (status === 'processing') return 'Processing';
    if (status === 'ready_to_claim') return 'Ready to Claim';
    if (status === 'claimed') return 'Claimed';
    return 'Unknown';
}

// ========================================
// RENTAL FILTERS
// ========================================

let rentalFilters = {
    startDate: null,
    endDate: null,
    items: [],
    statuses: [],
    search: ''
};

let allRentalsData = []; // Combined current + history for filtering

function loadMyRentalsTab() {
    // Load current rentals, rental history, and printing activity
    Promise.all([
        loadCurrentRentals(),
        loadRentalHistory(),
        loadStudentPrintJobs().catch(() => []),
        loadStudentLockers().catch(() => null)
    ]).then(() => {
        updateMyRentalsEmptyState();
        buildFilterOptions();
        updateFilterVisibility();
        applyAllFilters();
    });
}

function buildFilterOptions() {
    // Combine all activity labels
    allRentalsData = [...currentRentalsData, ...rentalHistoryData, ...studentPrintingJobs];

    // Extract unique item names
    const itemsSet = new Set();
    allRentalsData.forEach(rental => {
        if (Object.prototype.hasOwnProperty.call(rental, 'file_name')) {
            const fileName = String(rental.file_name || '').trim();
            if (fileName) itemsSet.add(fileName);
            return;
        }

        const items = (rental.items_label || '').split(', ');
        items.forEach(item => {
            const itemName = item.replace(/\s*\(\d+x\)/, '').trim();
            if (itemName) itemsSet.add(itemName);
        });
    });

    // Populate item filter dropdown
    const itemFilterList = document.getElementById('itemFilterList');
    if (itemFilterList) {
        itemFilterList.innerHTML = '';

        if (itemsSet.size === 0) {
            // Show message when no items available
            const emptyMsg = document.createElement('div');
            emptyMsg.style.padding = '12px';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = 'var(--muted)';
            emptyMsg.style.fontSize = '0.85rem';
            emptyMsg.textContent = 'No items available';
            itemFilterList.appendChild(emptyMsg);
        } else {
            Array.from(itemsSet).sort().forEach(item => {
                const label = document.createElement('label');
                label.className = 'filter-option';
                label.innerHTML = `
                    <input type="checkbox" value="${item}" onchange="applyItemFilter()">
                    <span>${item}</span>
                `;
                itemFilterList.appendChild(label);
            });
        }
    }
}

function updateFilterVisibility() {
    const filtersSection = document.getElementById('rentalFiltersSection');
    if (filtersSection) {
        // Always show filters in My Rentals tab
        filtersSection.style.display = 'block';
    }
}

// DATE FILTER MODAL & CALENDAR
let calendarCurrentDate = new Date();
let calendarSelectedStart = null;
let calendarSelectedEnd = null;

function openDateFilterModal() {
    const modal = document.getElementById('dateFilterModal');
    if (modal) {
        modal.classList.add('open');
        // Initialize calendar with current month
        calendarCurrentDate = new Date();
        renderCalendar();
        document.body.style.overflow = 'hidden';
    }
}

function closeDateFilterModal() {
    const modal = document.getElementById('dateFilterModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
}

function navigateCalendarMonth(offset) {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + offset);
    renderCalendar();
}

function renderCalendar() {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();

    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthYear = document.getElementById('filterCalendarMonthYear');
    if (monthYear) {
        monthYear.textContent = `${monthNames[month]} ${year}`;
    }

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate calendar days
    const calendarDays = document.getElementById('filterCalendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDays.appendChild(emptyCell);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        // Check if today
        if (dateObj.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }

        // Check if selected start or end
        if (calendarSelectedStart && dateObj.getTime() === calendarSelectedStart.getTime()) {
            dayCell.classList.add('selected');
        }
        if (calendarSelectedEnd && dateObj.getTime() === calendarSelectedEnd.getTime()) {
            dayCell.classList.add('selected');
        }

        // Check if in range
        if (calendarSelectedStart && calendarSelectedEnd) {
            if (dateObj >= calendarSelectedStart && dateObj <= calendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }
        }

        // Click handler
        dayCell.addEventListener('click', () => selectCalendarDate(dateObj));

        calendarDays.appendChild(dayCell);
    }

    // Update selected range display
    updateSelectedRangeDisplay();
}

function selectCalendarDate(date) {
    if (!calendarSelectedStart || (calendarSelectedStart && calendarSelectedEnd)) {
        // First selection or reset
        calendarSelectedStart = date;
        calendarSelectedEnd = null;
    } else {
        // Second selection
        if (date < calendarSelectedStart) {
            calendarSelectedEnd = calendarSelectedStart;
            calendarSelectedStart = date;
        } else {
            calendarSelectedEnd = date;
        }
    }

    renderCalendar();
}

function updateSelectedRangeDisplay() {
    const startDisplay = document.getElementById('selectedStartDate');
    const endDisplay = document.getElementById('selectedEndDate');

    if (calendarSelectedStart) {
        startDisplay.textContent = calendarSelectedStart.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        startDisplay.textContent = 'Not selected';
    }

    if (calendarSelectedEnd) {
        endDisplay.textContent = calendarSelectedEnd.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        endDisplay.textContent = 'Not selected';
    }
}

function applyDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    calendarCurrentDate = new Date(today);

    let startDate, endDate;

    switch (preset) {
        case 'today':
            startDate = new Date(today);
            endDate = null;
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = new Date(today);
            break;
        case 'month':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 1);
            endDate = new Date(today);
            break;
        case 'all':
            startDate = null;
            endDate = null;
            break;
    }

    calendarSelectedStart = startDate;
    calendarSelectedEnd = endDate;
    updateSelectedRangeDisplay();
    renderCalendar();
}

function applyDateFilter() {
    const label = document.getElementById('dateFilterLabel');

    // Convert selected dates to ISO format for filtering
    rentalFilters.startDate = calendarSelectedStart ? calendarSelectedStart.toISOString().split('T')[0] : null;
    rentalFilters.endDate = calendarSelectedEnd ? calendarSelectedEnd.toISOString().split('T')[0] : null;

    // Update label
    if (rentalFilters.startDate && !rentalFilters.endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = today.toISOString().split('T')[0];
        label.textContent = rentalFilters.startDate === todayKey
            ? 'Today'
            : new Date(rentalFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (rentalFilters.startDate || rentalFilters.endDate) {
        const start = rentalFilters.startDate ? new Date(rentalFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
        const end = rentalFilters.endDate ? new Date(rentalFilters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
        label.textContent = `${start} - ${end}`;
    } else {
        label.textContent = 'All Dates';
    }

    closeDateFilterModal();
    applyAllFilters();
}

// ITEM FILTER DROPDOWN
function toggleItemFilterDropdown() {
    const dropdown = document.getElementById('itemFilterDropdown');
    const statusDropdown = document.getElementById('statusFilterDropdown');

    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';

        // Close other dropdown
        if (statusDropdown) statusDropdown.style.display = 'none';
    }
}

function applyItemFilter() {
    const checkboxes = document.querySelectorAll('#itemFilterList input[type="checkbox"]:checked');
    rentalFilters.items = Array.from(checkboxes).map(cb => cb.value);

    const label = document.getElementById('itemFilterLabel');
    if (label) {
        label.textContent = rentalFilters.items.length > 0
            ? `${rentalFilters.items.length} Item${rentalFilters.items.length > 1 ? 's' : ''}`
            : 'All Items';
    }

    applyAllFilters();
}

function clearItemFilter() {
    const checkboxes = document.querySelectorAll('#itemFilterList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    rentalFilters.items = [];

    const label = document.getElementById('itemFilterLabel');
    if (label) label.textContent = 'All Items';

    applyAllFilters();
}

// STATUS FILTER DROPDOWN
function toggleStatusFilterDropdown() {
    const dropdown = document.getElementById('statusFilterDropdown');
    const itemDropdown = document.getElementById('itemFilterDropdown');

    if (dropdown) {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';

        // Close other dropdown
        if (itemDropdown) itemDropdown.style.display = 'none';
    }
}

function applyStatusFilter() {
    const checkboxes = document.querySelectorAll('#statusFilterDropdown input[type="checkbox"]:checked');
    rentalFilters.statuses = Array.from(checkboxes).map(cb => cb.value);

    const label = document.getElementById('statusFilterLabel');
    if (label) {
        label.textContent = rentalFilters.statuses.length > 0
            ? `${rentalFilters.statuses.length} Status`
            : 'All Status';
    }

    applyAllFilters();
}

function clearStatusFilter() {
    const checkboxes = document.querySelectorAll('#statusFilterDropdown input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    rentalFilters.statuses = [];

    const label = document.getElementById('statusFilterLabel');
    if (label) label.textContent = 'All Status';

    applyAllFilters();
}

// APPLY ALL FILTERS
function applyAllFilters() {
    // Filter current rentals
    let filteredCurrent = [...currentRentalsData];
    let filteredHistory = [...rentalHistoryData];
    let filteredPrintJobs = [...studentPrintingJobs];

    // Apply filters
    filteredCurrent = filterRentals(filteredCurrent);
    filteredHistory = filterRentals(filteredHistory);
    filteredPrintJobs = filterRentals(filteredPrintJobs);

    // Temporarily replace data
    const originalCurrent = [...currentRentalsData];
    const originalHistory = [...rentalHistoryData];
    const originalPrintJobs = [...studentPrintingJobs];

    currentRentalsData = filteredCurrent;
    rentalHistoryData = filteredHistory;
    studentPrintingJobs = filteredPrintJobs;

    // Re-render
    renderCurrentRentals();
    renderRentalHistory();

    // Restore original data
    currentRentalsData = originalCurrent;
    rentalHistoryData = originalHistory;
    studentPrintingJobs = originalPrintJobs;
}

function applyRentalSearch() {
    const input = document.getElementById('rentalSearchInput');
    rentalFilters.search = String(input?.value || '').trim().toLowerCase();
    applyAllFilters();
}

function filterRentals(rentals) {
    return rentals.filter(rental => {
        const isPrintActivity = Object.prototype.hasOwnProperty.call(rental, 'file_name');
        const isLockerActivity = !isPrintActivity && String(rental.service_kind || '').toLowerCase() === 'locker';
        const activityDateValue = isPrintActivity ? (rental.submitted_at || rental.updated_at) : rental.rent_time;

        // Date filter
        if (rentalFilters.startDate || rentalFilters.endDate) {
            const rentalDate = activityDateValue ? new Date(activityDateValue) : null;
            if (!rentalDate || Number.isNaN(rentalDate.getTime())) return false;
            const start = rentalFilters.startDate ? new Date(rentalFilters.startDate) : null;
            const end = rentalFilters.endDate ? new Date(rentalFilters.endDate) : null;

            if (start && rentalDate < start) return false;
            if (end) {
                end.setHours(23, 59, 59, 999); // End of day
                if (rentalDate > end) return false;
            }
        }

        // Item filter
        if (rentalFilters.items.length > 0) {
            const rentalItems = isPrintActivity
                ? [String(rental.file_name || '').trim()].filter(Boolean)
                : (rental.items_label || '').split(', ').map(item =>
                    item.replace(/\s*\(\d+x\)/, '').trim()
                );
            const hasMatch = rentalFilters.items.some(filterItem => rentalItems.includes(filterItem));
            if (!hasMatch) return false;
        }

        // Status filter
        if (rentalFilters.statuses.length > 0) {
            let status = String(rental.status).toLowerCase();

            if (isLockerActivity) {
                status = getNormalizedLockerActivityStatus(status, rental);
                if (status === 'locker_pending') status = 'reserved';
                else if (status === 'locker_active') status = 'active';
                else if (status === 'locker_overdue') status = 'locker_overdue';
                else if (status === 'locker_rejected') status = 'cancelled';
                else if (status === 'locker_released') status = 'returned';
            } else if (!isPrintActivity && status === 'cancelled' && String(rental.payment_status || '').toLowerCase() === 'unpaid') {
                status = 'no-show';
            } else if (!isPrintActivity && isStudentRentalNoShow(rental)) {
                status = 'no-show';
            }

            if (!rentalFilters.statuses.includes(status)) return false;
        }

        // Search filter
        if (rentalFilters.search) {
            let status = String(rental.status || '').toLowerCase();
            let statusText = '';
            if (isLockerActivity) {
                status = getNormalizedLockerActivityStatus(status, rental);
                statusText = getLockerActivityStatusLabel(status, rental);
                if (status === 'locker_pending') status = 'reserved';
                else if (status === 'locker_active') status = 'active';
                else if (status === 'locker_rejected') status = 'cancelled';
                else if (status === 'locker_released') status = 'returned';
            } else if (!isPrintActivity && status === 'cancelled' && String(rental.payment_status || '').toLowerCase() === 'unpaid') {
                status = 'no-show';
            } else if (!isPrintActivity && isStudentRentalNoShow(rental)) {
                status = 'no-show';
            }

            const rentDate = activityDateValue ? formatDate(activityDateValue) : '';
            const items = isPrintActivity
                ? String(rental.file_name || '').trim()
                : String(rental.items_label || '').replace(/\s*\(\d+x\)/g, '').trim();
            const organization = String(rental.org_name || '');
            const organizationCode = String(rental.org_code || '');
            if (!statusText) {
                statusText = isPrintActivity ? getStatusText(status) : getStatusText(status);
            }
            const activityType = isPrintActivity ? 'printing' : (isLockerActivity ? 'locker' : 'rental');
            const details = isPrintActivity ? String(rental.notes || '') : (isLockerActivity ? String(rental.locker_notice_message || rental.locker_period_type || '') : '');
            const searchBlob = [rentDate, items, organization, organizationCode, statusText, status, activityType, details]
                .join(' ')
                .toLowerCase();

            if (!searchBlob.includes(rentalFilters.search)) return false;
        }

        return true;
    });
}

// RESET ALL FILTERS
function resetAllFilters() {
    // Reset filter object
    rentalFilters = {
        startDate: null,
        endDate: null,
        items: [],
        statuses: [],
        search: ''
    };

    // Reset UI
    document.getElementById('dateFilterLabel').textContent = 'All Dates';
    document.getElementById('itemFilterLabel').textContent = 'All Items';
    document.getElementById('statusFilterLabel').textContent = 'All Status';
    const rentalSearchInput = document.getElementById('rentalSearchInput');
    if (rentalSearchInput) rentalSearchInput.value = '';

    // Clear date inputs
    const startInput = document.getElementById('filterStartDate');
    const endInput = document.getElementById('filterEndDate');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    // Clear checkboxes
    document.querySelectorAll('#itemFilterList input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#statusFilterDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);

    // Re-render with no filters
    renderCurrentRentals();
    renderRentalHistory();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const itemBtn = document.getElementById('itemFilterBtn');
    const itemDropdown = document.getElementById('itemFilterDropdown');
    const statusBtn = document.getElementById('statusFilterBtn');
    const statusDropdown = document.getElementById('statusFilterDropdown');

    if (itemDropdown && !itemBtn?.contains(e.target) && !itemDropdown.contains(e.target)) {
        itemDropdown.style.display = 'none';
    }

    if (statusDropdown && !statusBtn?.contains(e.target) && !statusDropdown.contains(e.target)) {
        statusDropdown.style.display = 'none';
    }
});
