/**
 * orgData.js — Per-Organization Data Configuration
 *
 * This is the single source of truth for all organization-specific content
 * loaded by the student and officer dashboards.
 *
 * HOW TO ADD REAL DATA:
 *   1. Find your org's key in ORG_DATA (e.g., "AISERS", "ELITECH").
 *   2. Add real entries to the events[], services[], and announcements[] arrays.
 *   3. No changes needed in any dashboard JS file — they read from here automatically.
 *
 * SHARED DATA:
 *   - SHARED_SERVICES: tools/equipment that belong to multiple orgs (use `org` field with
 *     comma-separated org codes, or "General" / "Combined" for all-org items).
 *   - SHARED_ANNOUNCEMENTS: system-wide notices shown to every student (use `org: "ALL"`).
 *
 * PATH NOTE:
 *   Image paths here are relative to the HTML page that loads this script (i.e., pages/).
 *   Use "../assets/photos/..." for assets inside this project.
 */

// =============================================================================
// PER-ORGANIZATION DATA
// =============================================================================
const ORG_DATA = {

    // -------------------------------------------------------------------------
    "AISERS": {
        fullName: "Alliance in Information System Empowered Responsive Students Organization",
        motto: "Excellent in Innovation, Service with Passion",
        events: [
            {
                title: "Tech Talk: AI Future",
                date: "Feb. 07, 2026",
                time: "10:00 AM - 12:00 PM",
                venue: "Main Auditorium",
                participants: 200,
                description: "A deep dive into Generative AI and its impact on student life.",
                img: "https://picsum.photos/seed/ai_talk/600/400",
                gallery: ["https://picsum.photos/seed/ai_talk/600/400"]
            }
        ],
        services: [
            { name: "Shoe Rag",            icon: "fa-shoe-prints",     color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/shoerag.png" },
            { name: "Business Calculator", icon: "fa-calculator",      color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/businesscalculator.png" },
            { name: "Arnis",               icon: "fa-hand-fist",       color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/arnis.png" }
        ],
        announcements: [
            { title: "Job Fair", date: "2 days ago", content: "Prepare your resumes for the upcoming fair." }
        ]
    },

    // -------------------------------------------------------------------------
    "ELITECH": {
        fullName: "Elite Technologist Society",
        motto: "Engineering Excellence, Powering Tomorrow",
        events: [
            {
                title: "Robotics Hardware Expo",
                date: "Feb. 20, 2026",
                time: "09:00 AM - 04:00 PM",
                venue: "Engineering Lobby",
                participants: 120,
                description: "Showcasing the latest student projects in automation and robotics.",
                img: "https://picsum.photos/seed/robotics/600/400",
                gallery: ["https://picsum.photos/seed/robotics/600/400"]
            }
        ],
        services: [
            { name: "Network Crimping Tool", icon: "fa-pliers", color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/crimpingtool.png" },
            { name: "Mini Fan",              icon: "fa-fan",    color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/minifan.png" },
            { name: "Network Cable Tester",  icon: "fa-bolt",   color: "#6366f1", backgroundImage: "../assets/photos/studentDashboard/Services/tester.png" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "ILASSO": {
        fullName: "Institute of Liberal Arts and Sciences Student Organization",
        motto: "Arts, Sciences, and Service for All",
        events: [
            {
                title: "Creative Writing Workshop",
                date: "Jan. 28, 2026",
                time: "01:00 PM - 04:00 PM",
                venue: "Library Conference Room",
                participants: 45,
                description: "Unleash your inner writer with our workshop on poetry and short stories.",
                img: "https://picsum.photos/seed/writing/600/400",
                gallery: ["https://picsum.photos/seed/writing/600/400"]
            }
        ],
        services: [],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "AERO-ATSO": {
        fullName: "Aeronautical Engineering - Air Transportation Student Organization",
        motto: "Safety First, Excellence Always",
        events: [
            {
                title: "Aviation Safety Seminar",
                date: "Mar. 05, 2026",
                time: "01:00 PM - 03:00 PM",
                venue: "AV Room 1",
                participants: 80,
                description: "Critical safety protocols for aspiring pilots and mechanics.",
                img: "https://picsum.photos/seed/aviation/600/400",
                gallery: ["https://picsum.photos/seed/aviation/600/400"]
            }
        ],
        services: [
            { name: "Scientific Calculator", icon: "fa-square-root-variable", color: "#ef4444", backgroundImage: "../assets/photos/studentDashboard/Services/scical.png" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "AETSO": {
        fullName: "Aeronautical Engineering Technology Student Organization",
        motto: "Precision in Every Component",
        events: [],
        services: [
            { name: "Printing", icon: "fa-print", color: "#ef4444" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "AMTSO": {
        fullName: "Aircraft Maintenance Technology Student Organization",
        motto: "Maintain, Sustain, Excel",
        events: [
            {
                title: "Engine Maintenance Training",
                date: "Feb. 07, 2026",
                time: "01:00 PM - 05:00 PM",
                venue: "Hangar 2",
                participants: 30,
                description: "Hands-on training for aircraft engine basic maintenance checks.",
                img: "https://picsum.photos/seed/engine/600/400",
                gallery: ["https://picsum.photos/seed/engine/600/400"]
            }
        ],
        services: [
            { name: "Printing", icon: "fa-print", color: "#ef4444" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "Supreme Student Council": {
        fullName: "Supreme Student Council",
        motto: "Students United for Excellence",
        events: [
            {
                title: "University Week Opening",
                date: "Jan. 15, 2026",
                time: "08:00 AM - 05:00 PM",
                venue: "Grandstand",
                participants: 500,
                description: "The grand opening of our annual University Week featuring a parade and torch lighting ceremony.",
                img: "https://picsum.photos/seed/uniweek/600/400",
                gallery: ["https://picsum.photos/seed/uniweek/600/400"]
            }
        ],
        services: [
            { name: "Scientific Calculator",  icon: "fa-square-root-variable", color: "#ef4444", backgroundImage: "../assets/photos/studentDashboard/Services/scical.png" },
            { name: "Printing",               icon: "fa-print",                color: "#ef4444" },
            { name: "1x1 Photo Processing",   icon: "fa-camera",               color: "#ef4444" },
            { name: "Lockers",                icon: "fa-box-archive",          color: "#ef4444", backgroundImage: "../assets/photos/studentDashboard/Services/locker.png" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "RCYC": {
        fullName: "Red Cross Youth Circle",
        motto: "Humanity in Action",
        events: [
            {
                title: "Community Clean-up Drive",
                date: "Mar. 15, 2026",
                time: "06:00 AM - 10:00 AM",
                venue: "City Plaza",
                participants: 150,
                description: "Giving back to the community by maintaining cleanliness in public spaces.",
                img: "https://picsum.photos/seed/cleanup/600/400",
                gallery: ["https://picsum.photos/seed/cleanup/600/400"]
            }
        ],
        services: [],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "CYC": {
        fullName: "Campus Youth Circle",
        motto: "Serving the Community, Shaping the Future",
        events: [
            {
                title: "Leadership Bootcamp",
                date: "Feb. 10, 2026",
                time: "08:00 AM - 05:00 PM",
                venue: "Retreat House",
                participants: 50,
                description: "Forming the next generation of student leaders.",
                img: "https://picsum.photos/seed/leadership/600/400",
                gallery: ["https://picsum.photos/seed/leadership/600/400"]
            }
        ],
        services: [
            { name: "Printing", icon: "fa-print", color: "#ef4444" }
        ],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "Scholar's Guild": {
        fullName: "Scholar's Guild",
        motto: "Academic Excellence for All",
        events: [],
        services: [],
        announcements: []
    },

    // -------------------------------------------------------------------------
    "Aeronautica": {
        fullName: "Aeronautica",
        motto: "Reach for the Sky",
        events: [],
        services: [],
        announcements: []
    }
};


// =============================================================================
// SHARED DATA  (available to multiple orgs — filtered by `org` field in each item)
// =============================================================================

/**
 * Services/equipment that are shared across multiple organizations.
 * `org` field values:
 *   "General"  — shown to every student regardless of org
 *   "Combined" — shown in combined-view / all-orgs contexts
 *   "ORG1, ORG2" — comma-separated list of specific orgs that carry this item
 */
const SHARED_SERVICES = [
    { name: "Calculator",     org: "Combined", icon: "fa-calculator",      color: "#f59e0b", backgroundImage: "../assets/photos/studentDashboard/Services/businessscical.png" },
    { name: "Rulers",         org: "Combined", icon: "fa-ruler",           color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/rulerbackground.png" },
    { name: "T-Square",       org: "General",  icon: "fa-ruler-combined",  color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/tsquare.png" },
    { name: "Triangle Ruler", org: "General",  icon: "fa-shapes",          color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/triangle.png" },
    { name: "Protractor",     org: "General",  icon: "fa-rotate",          color: "#64748b", backgroundImage: "../assets/photos/studentDashboard/Services/protractor.png" }
];

/**
 * System-wide announcements shown to all students.
 * `org: "ALL"` means every student sees this regardless of their organization.
 */
const SHARED_ANNOUNCEMENTS = [
    { title: "Enrollment for 2nd Sem", date: "Today",     content: "Please settle your balance before the 25th.", org: "ALL" },
    { title: "Office Hours",           date: "Yesterday", content: "Org offices will be closed on holidays.",     org: "ALL" }
];
