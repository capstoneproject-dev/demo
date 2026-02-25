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
        ],

        // Officer Dashboard — document submissions to OSA
        documents: [
            { title: "September Financial Statement", type: "Financial Statement", date: "Oct 05", status: "Approved" },
            { title: "Team Building Proposal",        type: "Proposal",           date: "Oct 18", status: "Sent to OSA" }
        ],

        // Officer Dashboard — active rentals summary widget
        rentals: [
            { item: "Scientific Calculator", renter: "Juan Dela Cruz (2021-12345)", due: "Oct 25, 2023", status: "Borrowed" },
            { item: "Business Calculator",   renter: "Maria Santos (2020-54321)",  due: "Oct 30, 2023", status: "Borrowed" }
        ],

        // IGP Rental System — inventory items (seeds localStorage 'inventoryItems' on first load)
        inventory: [
            { id: "AISERS-SH001",   name: "Shoe Covers",         barcode: "AISERS-SH001",   status: "available", pricePerHour: 10 },
            { id: "AISERS-SH002",   name: "Shoe Covers",         barcode: "AISERS-SH002",   status: "available", pricePerHour: 10 },
            { id: "AISERS-AR001",   name: "Arnis",               barcode: "AISERS-AR001",   status: "available", pricePerHour: 10 },
            { id: "AISERS-AR002",   name: "Arnis",               barcode: "AISERS-AR002",   status: "available", pricePerHour: 10 },
            { id: "AISERS-CALC001", name: "Business Calculator", barcode: "AISERS-CALC001", status: "available", pricePerHour: 10 },
            { id: "AISERS-CALC002", name: "Business Calculator", barcode: "AISERS-CALC002", status: "available", pricePerHour: 10 }
        ],

        // IGP Rental System — officer barcodes (seeds localStorage 'barcodeOfficers' on first load)
        officerBarcodes: [
            { officerId: "AISERS-OFF001", officerName: "AISERS President",  position: "President" },
            { officerId: "AISERS-OFF002", officerName: "AISERS Librarian",  position: "Librarian" }
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
        announcements: [],

        documents: [
            { title: "Constitution Amendment", type: "Legal",   date: "Oct 24", status: "SSC Approved" },
            { title: "Office Closure Notice",  type: "Memo",   date: "Oct 26", status: "Pending" }
        ],
        rentals: [
            { item: "Network Crimping Tool", renter: "Anna Lee (2021-11111)",    due: "Oct 26, 2023", status: "Borrowed" },
            { item: "Mini Fan",              renter: "Carlos Tan (2022-22222)",  due: "Oct 27, 2023", status: "Borrowed" }
        ],
        inventory: [
            { id: "ELITECH-CT001", name: "Network Crimping Tool",  barcode: "ELITECH-CT001", status: "available", pricePerHour: 10 },
            { id: "ELITECH-CT002", name: "Network Crimping Tool",  barcode: "ELITECH-CT002", status: "available", pricePerHour: 10 },
            { id: "ELITECH-FN001", name: "Mini Fan",               barcode: "ELITECH-FN001", status: "available", pricePerHour: 10 },
            { id: "ELITECH-FN002", name: "Mini Fan",               barcode: "ELITECH-FN002", status: "available", pricePerHour: 10 },
            { id: "ELITECH-NT001", name: "Network Cable Tester",   barcode: "ELITECH-NT001", status: "available", pricePerHour: 10 },
            { id: "ELITECH-NT002", name: "Network Cable Tester",   barcode: "ELITECH-NT002", status: "available", pricePerHour: 10 }
        ],
        officerBarcodes: [
            { officerId: "ELITECH-OFF001", officerName: "ELITECH President", position: "President" },
            { officerId: "ELITECH-OFF002", officerName: "ELITECH Librarian", position: "Librarian" }
        ]
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
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [],
        officerBarcodes: [
            { officerId: "ILASSO-OFF001", officerName: "ILASSO President", position: "President" }
        ]
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
        announcements: [],
        documents: [
            { title: "Flight Ops Safety Report", type: "Safety Report", date: "Oct 10", status: "Approved" }
        ],
        rentals: [
            { item: "Scientific Calculator", renter: "Pedro Reyes (2022-99999)", due: "Oct 20, 2023", status: "Overdue" }
        ],
        inventory: [
            { id: "AERO-SC001", name: "Scientific Calculator", barcode: "AERO-SC001", status: "available", pricePerHour: 10 },
            { id: "AERO-SC002", name: "Scientific Calculator", barcode: "AERO-SC002", status: "available", pricePerHour: 10 }
        ],
        officerBarcodes: [
            { officerId: "AERO-OFF001", officerName: "AERO-ATSO President", position: "President" }
        ]
    },

    // -------------------------------------------------------------------------
    "AETSO": {
        fullName: "Aeronautical Engineering Technology Student Organization",
        motto: "Precision in Every Component",
        events: [],
        services: [
            { name: "Printing", icon: "fa-print", color: "#ef4444" }
        ],
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [
            { id: "AETSO-PR001", name: "Printer (per page)", barcode: "AETSO-PR001", status: "available", pricePerHour: 5 }
        ],
        officerBarcodes: [
            { officerId: "AETSO-OFF001", officerName: "AETSO President", position: "President" }
        ]
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
        announcements: [],
        documents: [
            { title: "Engine Maintenance Log", type: "Technical Report", date: "Oct 12", status: "Approved" }
        ],
        rentals: [
            { item: "T-Square", renter: "Pedro Reyes (2022-99999)", due: "Oct 20, 2023", status: "Overdue" }
        ],
        inventory: [
            { id: "AMTSO-TS001", name: "T-Square",    barcode: "AMTSO-TS001", status: "available", pricePerHour: 10 },
            { id: "AMTSO-TS002", name: "T-Square",    barcode: "AMTSO-TS002", status: "available", pricePerHour: 10 },
            { id: "AMTSO-PR001", name: "Printing",    barcode: "AMTSO-PR001", status: "available", pricePerHour:  5 }
        ],
        officerBarcodes: [
            { officerId: "AMTSO-OFF001", officerName: "AMTSO President", position: "President" }
        ]
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
        announcements: [],
        documents: [
            { title: "Election Guidelines", type: "Document",            date: "Oct 20", status: "Pending" },
            { title: "Annual Report 2025",  type: "Financial Statement", date: "Oct 01", status: "Approved" }
        ],
        rentals: [
            { item: "Locker Unit 04",      renter: "Maria Santos (2020-54321)", due: "Nov 30, 2023", status: "Rented" },
            { item: "Scientific Calculator", renter: "Bob Cruz (2023-33333)",  due: "Oct 25, 2023", status: "Borrowed" }
        ],
        inventory: [
            { id: "SSC-LK001", name: "Locker Unit 01",        barcode: "SSC-LK001", status: "available", pricePerHour: 0 },
            { id: "SSC-LK002", name: "Locker Unit 02",        barcode: "SSC-LK002", status: "available", pricePerHour: 0 },
            { id: "SSC-LK003", name: "Locker Unit 03",        barcode: "SSC-LK003", status: "available", pricePerHour: 0 },
            { id: "SSC-LK004", name: "Locker Unit 04",        barcode: "SSC-LK004", status: "available", pricePerHour: 0 },
            { id: "SSC-PR001", name: "Printing (per page)",   barcode: "SSC-PR001", status: "available", pricePerHour:  5 },
            { id: "SSC-SC001", name: "Scientific Calculator", barcode: "SSC-SC001", status: "available", pricePerHour: 10 }
        ],
        officerBarcodes: [
            { officerId: "SSC-OFF001", officerName: "SSC President",  position: "President" },
            { officerId: "SSC-OFF002", officerName: "SSC Librarian",  position: "Librarian" }
        ]
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
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [],
        officerBarcodes: [
            { officerId: "RCYC-OFF001", officerName: "RCYC President", position: "President" }
        ]
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
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [
            { id: "CYC-PR001", name: "Printing (per page)", barcode: "CYC-PR001", status: "available", pricePerHour: 5 }
        ],
        officerBarcodes: [
            { officerId: "CYC-OFF001", officerName: "CYC President", position: "President" }
        ]
    },

    // -------------------------------------------------------------------------
    "Scholar's Guild": {
        fullName: "Scholar's Guild",
        motto: "Academic Excellence for All",
        events: [],
        services: [],
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [],
        officerBarcodes: [
            { officerId: "PSG-OFF001", officerName: "PSG President", position: "President" }
        ]
    },

    // -------------------------------------------------------------------------
    "Aeronautica": {
        fullName: "Aeronautica",
        motto: "Reach for the Sky",
        events: [],
        services: [],
        announcements: [],
        documents: [],
        rentals:   [],
        inventory: [],
        officerBarcodes: [
            { officerId: "AERO-ORG-OFF001", officerName: "Aeronautica President", position: "President" }
        ]
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
// =============================================================================
// LOOKUP HELPER
// =============================================================================

/**
 * Case-insensitive org data lookup.
 * Use this in dashboard scripts instead of ORG_DATA[key] directly,
 * because the officer auth session normalises org names to UPPERCASE.
 *
 * @param {string} orgKeyRaw  — org name from session (e.g. "AISERS", "SUPREME STUDENT COUNCIL")
 * @returns {object|null}     — the org entry from ORG_DATA, or null if not found
 */
function getOrgData(orgKeyRaw) {
    if (!orgKeyRaw) return null;
    // Direct match first (handles exact keys like "AISERS", "Scholar's Guild")
    if (ORG_DATA[orgKeyRaw]) return ORG_DATA[orgKeyRaw];
    // Case-insensitive fallback (handles uppercase from officer session)
    const upper = String(orgKeyRaw).toUpperCase().trim();
    const found = Object.keys(ORG_DATA).find(k => k.toUpperCase().trim() === upper);
    return found ? ORG_DATA[found] : null;
}


const SHARED_ANNOUNCEMENTS = [
    { title: "Enrollment for 2nd Sem", date: "Today",     content: "Please settle your balance before the 25th.", org: "ALL" },
    { title: "Office Hours",           date: "Yesterday", content: "Org offices will be closed on holidays.",     org: "ALL" }
];
