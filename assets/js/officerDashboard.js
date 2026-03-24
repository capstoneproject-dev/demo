const AUTH_SESSION_KEY = 'naapAuthSession';
let officerOrgSyncPromise = Promise.resolve();

function readAuthSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function formatLocalDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '';
    }
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

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
        <button type="button" style="border:none; background:transparent; color:inherit; opacity:0.6; cursor:pointer;" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

/**
 * Non-blocking PHP session check.
 * Runs asynchronously after localStorage guard — redirects if server session expired.
 */
function validatePhpSession() {
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

function syncActiveOrgToPhpSession() {
    const session = readAuthSession();
    const orgId = Number(session.active_org_id || 0);
    if (!orgId) return Promise.resolve();

    return fetch('../api/auth/activate-org.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ org_id: orgId })
    })
        .then((r) => r.json())
        .then((data) => {
            if (!data || !data.ok || !data.session) return;
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
            document.querySelectorAll('#tracker iframe').forEach((trackerFrame) => {
                if (trackerFrame && trackerFrame.src) {
                    trackerFrame.src = trackerFrame.src;
                }
            });
        })
        .catch(() => { /* keep dashboard usable even if sync fails */ });
}

function initOfficerAuthContext() {
    const session = readAuthSession();
    const isOfficerSession = session && session.login_role === 'org' && session.user_id;
    if (!isOfficerSession) {
        window.location.href = '../pages/login.html';
        return;
    }

    const fullName = session.display_name || 'Organization Officer';
    const roleLabel = session.active_role_name || 'officer';
    const orgLabel = session.active_org_name || 'Organization';
    const studentNumber = session.student_number || session.employee_number || 'N/A';
    const email = session.email || '';
    const courseYear = [session.program_code, session.section].filter(Boolean).join(' - ') || 'N/A';

    const headerName = document.querySelector('.user-info span');
    const headerRole = document.querySelector('.user-info small');
    if (headerName) headerName.innerText = fullName;
    if (headerRole) headerRole.innerText = `${roleLabel} - ${orgLabel}`;

    const profileName = document.querySelector('.profile-name');
    const profileRole = document.querySelector('.profile-role');
    if (profileName) profileName.innerText = fullName;
    if (profileRole) profileRole.innerText = `${roleLabel} - ${orgLabel}`;

    const profileNameInput = document.getElementById('officerProfileFullNameInput');
    const profileStudentNumberInput = document.getElementById('officerProfileStudentNumberInput');
    const profileEmailInput = document.getElementById('officerProfileEmailInput');
    const profileOrganizationInput = document.getElementById('officerProfileOrganizationInput');
    const profilePhoneInput = document.getElementById('officerProfilePhoneInput');
    const profileCourseYearInput = document.getElementById('officerProfileCourseYearInput');
    if (profileNameInput) profileNameInput.value = fullName;
    if (profileStudentNumberInput) profileStudentNumberInput.value = studentNumber;
    if (profileEmailInput) profileEmailInput.value = email;
    if (profileOrganizationInput) profileOrganizationInput.value = orgLabel;
    if (profilePhoneInput) profilePhoneInput.value = profilePhoneInput.value && profilePhoneInput.value !== '+63 912 345 6789'
        ? profilePhoneInput.value
        : 'N/A';
    if (profileCourseYearInput) profileCourseYearInput.value = courseYear;

    document.title = `${orgLabel} Officer Dashboard`;

    // Validate PHP session in the background (catches server-side expiry)
    validatePhpSession();
    officerOrgSyncPromise = syncActiveOrgToPhpSession();

    // Seed org-specific data into localStorage so the IGP Rental and QR-Attendance
    // iframes pick up the correct inventory and officer barcodes on first load.
    seedOrgSubsystemData();

    // Pre-populate the runtime data arrays (rentals, docs, announcements) from orgData.js.
    // Officers can then add/remove entries at runtime and those changes stay in memory.
    initOrgDataFromOrgData();
}

function normalizeOfficerOrgName(name) {
    const normalized = String(name || '').trim().toUpperCase();
    const aliases = {
        "SSC": "SUPREME STUDENT COUNCIL",
        "SUPREME STUDENT COUNCIL": "SUPREME STUDENT COUNCIL",
        "AET": "AETSO",
        "AMT": "AMTSO",
        "SCHOLARS GUILD": "SCHOLAR'S GUILD"
    };
    return aliases[normalized] || normalized;
}

function getActiveOfficerOrgName() {
    const session = readAuthSession();
    return normalizeOfficerOrgName(session.active_org_name || '');
}

function officerOrgMatch(orgValue) {
    const session = readAuthSession();
    const activeName = normalizeOfficerOrgName(session.active_org_name || '');
    const activeId = Number(session.active_org_id || 0);

    // If nothing to compare against, allow all.
    if (!activeName && !activeId) return true;

    // If orgValue is numeric (id), match against activeId.
    const numVal = Number(orgValue);
    if (!Number.isNaN(numVal) && numVal > 0 && activeId > 0) {
        return numVal === activeId;
    }

    // Fallback to name-based match.
    return normalizeOfficerOrgName(orgValue) === activeName;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- DATA  (read from orgData.js — ORG_DATA is the source of truth) ---
// All three arrays now populated via API instead of static mocks.
let announcementsData = [];
let docsData          = [];
let rentalsData       = [];
let repositoryData    = [];

/**
 * Seed all runtime data arrays from orgData.js for the active officer org.
 * Called once from initOfficerAuthContext after the org name is known.
 */
function initOrgDataFromOrgData() {
    const data = (typeof getOrgData === 'function') && getOrgData(getActiveOfficerOrgName());
    if (!data) return;
    const orgKey = getActiveOfficerOrgName();
    announcementsData = (data.announcements || []).map(a => ({ ...a, org: orgKey }));
    docsData          = (data.documents    || []).map(d => ({ ...d, org: orgKey }));
    rentalsData       = (data.rentals      || []).map(r => ({ ...r, org: orgKey }));
}

/**
 * Seed the IGP Rental System and QR-Attendance iframes with this org's
 * inventory and officer barcodes. Only writes to localStorage if the key
 * is currently empty, so live edits made inside the subsystems are preserved.
 */
function seedOrgSubsystemData() {
    const orgData = (typeof getOrgData === 'function') && getOrgData(getActiveOfficerOrgName());
    if (!orgData) return;

    const existing = (key) => {
        try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) && v.length > 0; }
        catch (_) { return false; }
    };

    if (!existing('inventoryItems') && orgData.inventory && orgData.inventory.length > 0) {
        localStorage.setItem('inventoryItems', JSON.stringify(orgData.inventory));
    }
    if (!existing('barcodeOfficers') && orgData.officerBarcodes && orgData.officerBarcodes.length > 0) {
        localStorage.setItem('barcodeOfficers', JSON.stringify(orgData.officerBarcodes));
    }
    // Let subsystems know which org is active (read-only hint for future use)
    localStorage.setItem('currentOfficerOrg', getActiveOfficerOrgName());
}

function getOfficerScopedRentals() {
    return rentalsData.filter(item => officerOrgMatch(item.org));
}

function getOfficerScopedDocs() {
    return docsData.filter(item => officerOrgMatch(item.org));
}

function getOfficerScopedAnnouncements() {
    return announcementsData.filter(item => officerOrgMatch(item.org));
}

// --- LOGOUT HANDLER ---
async function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        try { await fetch('../api/auth/logout.php', { credentials: 'same-origin' }); } catch (_) {}
        localStorage.removeItem(AUTH_SESSION_KEY);
        window.location.href = '../pages/login.html';
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
    initOfficerAuthContext();
    setOfficerTrackerPrintingAccess(false);

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

    if (window.location.hash === '#tracker-financial-summary') {
        navigate('tracker');
        switchTrackerSubView('financial-summary');
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
    const mainContent = document.querySelector('.main-content');

    // Ensure header is visible
    if (mainHeaderTitle) mainHeaderTitle.style.display = 'block';
    if (mainContent) mainContent.classList.remove('tracker-fullscreen');

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
            'announcements': 'Manage Announcements',
            'events': 'Events Management',
            'profile': 'My Profile'
        };
        if (titleEl) titleEl.innerText = titleMap[viewId] || 'Org Manager';

        // Restore Date
        setDate();
    }

    // Fullscreen layout for full-page service views.
    if ((viewId === 'events' || viewId === 'tracker') && mainContent) {
        mainContent.classList.add('tracker-fullscreen');
    }

    // 4. Resize charts if Analytics tab is opened
    if (viewId === 'analytics') {
        window.dispatchEvent(new Event('resize'));
    }
}

let currentTrackerSubView = 'rentals';
let officerPrintingQueue = [];
let officerPrintingHistoryFilters = { startDate: null, endDate: null, search: '' };
let currentPrintingPanelView = 'queue';
let officerPrintingCalendarCurrentDate = new Date();
let officerPrintingCalendarSelectedStart = null;
let officerPrintingCalendarSelectedEnd = null;
let officerPrintingEnabled = false;
let officerLockerEnabled = false;
let officerFinancialSummaryData = [];
let officerFinancialSummaryFilters = { startDate: null, endDate: null };
let officerFinancialCalendarCurrentDate = new Date();
let officerFinancialCalendarSelectedStart = null;
let officerFinancialCalendarSelectedEnd = null;
let analyticsExportRequestedFormat = null;
let analyticsExportFilters = { startDate: null, endDate: null };
let analyticsExportCalendarCurrentDate = new Date();
let analyticsExportCalendarSelectedStart = null;
let analyticsExportCalendarSelectedEnd = null;
const OFFICER_FINANCIAL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
let officerLockerBoard = [];
let selectedLockerTile = null;
let lockerAssignableStudents = [];
let selectedLockerAssignStudent = null;

function isOfficerLockerEnabled() {
    const session = readAuthSession();
    const activeOrgName = normalizeOfficerOrgName(session.active_org_name || '');
    const activeOrgCode = normalizeOfficerOrgName(session.active_org_code || '');
    return activeOrgName === 'SUPREME STUDENT COUNCIL' || activeOrgCode === 'SSC';
}

function setOfficerTrackerPrintingAccess(printingEnabled) {
    officerPrintingEnabled = !!printingEnabled;
    officerLockerEnabled = isOfficerLockerEnabled();

    const trackerLayout = document.getElementById('trackerLayout');
    const printingBtn = document.getElementById('trackerPrintingBtn');
    const lockerBtn = document.getElementById('trackerLockerBtn');
    const printingView = document.getElementById('tracker-printing-view');
    const lockerView = document.getElementById('tracker-lockers-view');

    if (trackerLayout) {
        trackerLayout.classList.remove('rentals-only');
    }
    if (printingBtn) {
        printingBtn.hidden = !officerPrintingEnabled;
        printingBtn.style.display = officerPrintingEnabled ? '' : 'none';
    }
    if (lockerBtn) {
        lockerBtn.hidden = !officerLockerEnabled;
        lockerBtn.style.display = officerLockerEnabled ? '' : 'none';
    }
    if (printingView) {
        printingView.style.display = officerPrintingEnabled ? '' : 'none';
    }
    if (lockerView) {
        lockerView.style.display = officerLockerEnabled ? '' : 'none';
    }

    if (!officerPrintingEnabled && currentTrackerSubView === 'printing') {
        currentTrackerSubView = 'rentals';
    }
    if (!officerLockerEnabled && currentTrackerSubView === 'lockers') {
        currentTrackerSubView = 'rentals';
    }
}

function initTrackerSidebarBehavior() {
    const trackerSidebar = document.getElementById('trackerSidebar');
    if (!trackerSidebar || trackerSidebar.dataset.hoverCollapseBound === 'true') {
        return;
    }

    trackerSidebar.dataset.hoverCollapseBound = 'true';
    trackerSidebar.addEventListener('mouseleave', () => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && trackerSidebar.contains(activeElement)) {
            activeElement.blur();
        }
    });
}

function switchTrackerSubView(viewId, button = null) {
    if (viewId === 'printing' && !officerPrintingEnabled) {
        return;
    }
    if (viewId === 'lockers' && !officerLockerEnabled) {
        return;
    }
    currentTrackerSubView = viewId;
    document.querySelectorAll('#tracker .sub-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn === button || btn.getAttribute('onclick')?.includes(`'${viewId}'`));
    });
    document.querySelectorAll('#tracker .tracker-sub-view').forEach((view) => {
        view.classList.remove('active');
    });
    const target = document.getElementById(`tracker-${viewId}-view`);
    if (target) {
        target.classList.add('active');
    }
    if (viewId === 'printing') {
        showOfficerPrintingQueueView();
        loadOfficerPrintingQueue().catch((error) => console.error(error));
    } else if (viewId === 'financial-summary') {
        loadOfficerFinancialSummary().catch((error) => console.error(error));
    } else if (viewId === 'lockers') {
        loadOfficerLockerBoard().catch((error) => console.error(error));
    }
}

function formatOfficerPeso(value) {
    return `P${Number(value || 0).toFixed(2)}`;
}

function getOfficerFinancialServiceLabel(serviceType) {
    const normalized = String(serviceType || '').toLowerCase();
    if (normalized === 'locker') return 'Locker';
    if (normalized === 'printing') return 'Printing';
    return 'Rental';
}

function getOfficerFinancialStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ready_to_claim') return 'Ready to Claim';
    if (normalized === 'locker_active') return 'Locker Active';
    if (normalized === 'locker_pending') return 'Locker Pending';
    if (normalized === 'locker_released') return 'Locker Released';
    if (normalized === 'locker_overdue') return 'Locker Overdue';
    return normalized
        ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        : 'Unknown';
}

function formatOfficerFinancialDate(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}

function getOfficerFinancialDateValue(item) {
    return item?.transaction_date || item?.transaction_datetime || item?.submitted_at || '';
}

function getOfficerFinancialItemDisplayLabel(item) {
    if (String(item?.service_type || '').toLowerCase() === 'printing') {
        return String(item?.customer_name || '').trim() || String(item?.item_label || '').trim() || '-';
    }
    return String(item?.item_label || '').trim() || '-';
}

function getOfficerFinancialSummaryFilters() {
    return {
        service: document.getElementById('financialSummaryServiceFilter')?.value || '',
        item: document.getElementById('financialSummaryItemFilter')?.value || '',
        startDate: officerFinancialSummaryFilters.startDate || '',
        endDate: officerFinancialSummaryFilters.endDate || '',
        payment: document.getElementById('financialSummaryPaymentFilter')?.value || '',
    };
}

function matchesOfficerFinancialDateFilter(item, startDate, endDate) {
    const dateValue = getOfficerFinancialDateValue(item);
    const parsedDate = dateValue ? new Date(dateValue) : null;
    if ((startDate || endDate) && !(parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()))) {
        return false;
    }
    if (startDate && !endDate) {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${startDate}T23:59:59`);
        return parsedDate >= start && parsedDate <= end;
    }
    if (!startDate && endDate) {
        const start = new Date(`${endDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        return parsedDate >= start && parsedDate <= end;
    }
    if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (parsedDate < start) return false;
    }
    if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (parsedDate > end) return false;
    }
    return true;
}

function populateOfficerFinancialItemFilter(items) {
    const select = document.getElementById('financialSummaryItemFilter');
    if (!select) return;

    const current = select.value || '';
    const filters = getOfficerFinancialSummaryFilters();

    const labels = Array.from(new Set(
        (items || [])
            .filter((item) => !filters.service || String(item.service_type || '').toLowerCase() === filters.service)
            .filter((item) => !filters.payment || String(item.payment_status || '').toLowerCase() === filters.payment)
            .filter((item) => matchesOfficerFinancialDateFilter(item, filters.startDate, filters.endDate))
            .map((item) => getOfficerFinancialItemDisplayLabel(item))
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">All Items</option>' + labels
        .map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`)
        .join('');
    select.value = labels.includes(current) ? current : '';
}

function getFilteredOfficerFinancialSummaryItems() {
    const filters = getOfficerFinancialSummaryFilters();
    return officerFinancialSummaryData.filter((item) => {
        const serviceType = String(item.service_type || '').toLowerCase();
        const paymentStatus = String(item.payment_status || '').toLowerCase();
        const itemLabel = getOfficerFinancialItemDisplayLabel(item);
        if (filters.service && serviceType !== filters.service) return false;
        if (filters.item && itemLabel !== filters.item) return false;
        if (filters.payment && paymentStatus !== filters.payment) return false;
        if (!matchesOfficerFinancialDateFilter(item, filters.startDate, filters.endDate)) {
            return false;
        }
        return true;
    });
}

function getOfficerFinancialSummaryRows() {
    return Array.isArray(officerFinancialSummaryData) ? officerFinancialSummaryData.slice() : [];
}

function setOfficerFinancialSummaryText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderOfficerFinancialSummary() {
    populateOfficerFinancialItemFilter(officerFinancialSummaryData);

    const rows = getFilteredOfficerFinancialSummaryItems();
    const filters = getOfficerFinancialSummaryFilters();
    const transactionsBody = document.getElementById('financialSummaryTransactionsTable');
    const monthlyBody = document.getElementById('financialSummaryMonthlyTable');

    let totalRevenue = 0;
    let totalUnpaid = 0;
    let paidTransactions = 0;
    let unpaidTransactions = 0;
    const dateValues = [];
    const monthlyMap = new Map();

    rows.forEach((item) => {
        const totalCost = Number(item.total_cost || 0);
        const paymentStatus = String(item.payment_status || '').toLowerCase();
        const dateValue = getOfficerFinancialDateValue(item);
        const parsedDate = dateValue ? new Date(dateValue) : null;

        if (paymentStatus === 'paid') {
            totalRevenue += totalCost;
            paidTransactions += 1;
        } else {
            totalUnpaid += totalCost;
            unpaidTransactions += 1;
        }

        if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
            dateValues.push(parsedDate);
            const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyMap.has(monthKey)) {
                monthlyMap.set(monthKey, {
                    revenue: 0,
                    unpaid: 0,
                    transactions: 0,
                    paid: 0,
                    unpaidCount: 0,
                });
            }
            const monthBucket = monthlyMap.get(monthKey);
            monthBucket.transactions += 1;
            if (paymentStatus === 'paid') {
                monthBucket.revenue += totalCost;
                monthBucket.paid += 1;
            } else {
                monthBucket.unpaid += totalCost;
                monthBucket.unpaidCount += 1;
            }
        }
    });

    setOfficerFinancialSummaryText('financialSummaryTotalRevenue', formatOfficerPeso(totalRevenue));
    setOfficerFinancialSummaryText('financialSummaryTotalUnpaid', formatOfficerPeso(totalUnpaid));
    setOfficerFinancialSummaryText('financialSummaryTotalTransactions', String(rows.length));
    setOfficerFinancialSummaryText('financialSummaryPaidTransactions', String(paidTransactions));
    setOfficerFinancialSummaryText('financialSummaryUnpaidTransactions', String(unpaidTransactions));
    setOfficerFinancialSummaryText('financialSummaryAverageValue', formatOfficerPeso(paidTransactions ? totalRevenue / paidTransactions : 0));

    if (filters.startDate && !filters.endDate) {
        setOfficerFinancialSummaryText(
            'financialSummaryDateRange',
            formatOfficerFinancialDate(`${filters.startDate}T00:00:00`)
        );
    } else if (!filters.startDate && filters.endDate) {
        setOfficerFinancialSummaryText(
            'financialSummaryDateRange',
            formatOfficerFinancialDate(`${filters.endDate}T00:00:00`)
        );
    } else if (filters.startDate && filters.endDate) {
        setOfficerFinancialSummaryText(
            'financialSummaryDateRange',
            `${formatOfficerFinancialDate(`${filters.startDate}T00:00:00`)} - ${formatOfficerFinancialDate(`${filters.endDate}T00:00:00`)}`
        );
    } else if (dateValues.length) {
        dateValues.sort((a, b) => a - b);
        setOfficerFinancialSummaryText(
            'financialSummaryDateRange',
            `${formatOfficerFinancialDate(dateValues[0])} - ${formatOfficerFinancialDate(dateValues[dateValues.length - 1])}`
        );
    } else {
        setOfficerFinancialSummaryText('financialSummaryDateRange', '-');
    }

    if (transactionsBody) {
        if (!rows.length) {
            transactionsBody.innerHTML = '<tr><td colspan="10" class="financial-empty-state">No transactions matched the current filters.</td></tr>';
        } else {
            const sortedRows = [...rows].sort((a, b) => {
                const aTime = new Date(getOfficerFinancialDateValue(a) || 0).getTime();
                const bTime = new Date(getOfficerFinancialDateValue(b) || 0).getTime();
                return bTime - aTime;
            });
            transactionsBody.innerHTML = sortedRows.map((item) => `
                <tr>
                    <td>${escapeHtml(formatOfficerFinancialDate(getOfficerFinancialDateValue(item)))}</td>
                    <td><span class="financial-service-badge ${escapeHtml(String(item.service_type || '').toLowerCase())}">${escapeHtml(getOfficerFinancialServiceLabel(item.service_type))}</span></td>
                    <td>${escapeHtml(getOfficerFinancialItemDisplayLabel(item))}</td>
                    <td>${escapeHtml(item.customer_name || '-')}<br><small style="color:var(--muted);">${escapeHtml(item.customer_identifier || '-')}</small></td>
                    <td>${escapeHtml(item.processed_by || '-')}</td>
                    <td>${escapeHtml(formatOfficerPeso(item.base_cost || 0))}</td>
                    <td>${escapeHtml(formatOfficerPeso(item.overtime_cost || 0))}</td>
                    <td>${escapeHtml(formatOfficerPeso(item.total_cost || 0))}</td>
                    <td>${escapeHtml(getOfficerFinancialStatusLabel(item.status))}</td>
                    <td><span class="financial-payment-badge ${escapeHtml(String(item.payment_status || '').toLowerCase())}">${escapeHtml(String(item.payment_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid')}</span></td>
                </tr>
            `).join('');
        }
    }

    if (monthlyBody) {
        const monthlyRows = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        if (!monthlyRows.length) {
            monthlyBody.innerHTML = '<tr><td colspan="6" class="financial-empty-state">No monthly data available for the selected filters.</td></tr>';
        } else {
            monthlyBody.innerHTML = monthlyRows.map(([monthKey, month]) => `
                <tr>
                    <td>${escapeHtml(monthKey)}</td>
                    <td>${escapeHtml(formatOfficerPeso(month.revenue))}</td>
                    <td>${escapeHtml(formatOfficerPeso(month.unpaid))}</td>
                    <td>${month.transactions}</td>
                    <td>${month.paid}</td>
                    <td>${month.unpaidCount}</td>
                </tr>
            `).join('');
        }
    }

    if (typeof initializeOfficerAnalyticsYearOptions === 'function') {
        initializeOfficerAnalyticsYearOptions();
    }
    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts();
    }
}

function clearOfficerFinancialSummaryFilters() {
    const serviceFilter = document.getElementById('financialSummaryServiceFilter');
    const itemFilter = document.getElementById('financialSummaryItemFilter');
    const paymentFilter = document.getElementById('financialSummaryPaymentFilter');
    if (serviceFilter) serviceFilter.value = '';
    if (itemFilter) itemFilter.value = '';
    if (paymentFilter) paymentFilter.value = '';
    officerFinancialSummaryFilters = { startDate: null, endDate: null };
    officerFinancialCalendarSelectedStart = null;
    officerFinancialCalendarSelectedEnd = null;
    initializeOfficerFinancialSummaryDefaultDate();
    renderOfficerFinancialSummary();
}

function initializeOfficerFinancialSummaryDefaultDate() {
    if (officerFinancialSummaryFilters.startDate || officerFinancialSummaryFilters.endDate) {
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayValue = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
    ].join('-');

    officerFinancialSummaryFilters.startDate = todayValue;
    officerFinancialSummaryFilters.endDate = null;
    officerFinancialCalendarCurrentDate = new Date(today);
    officerFinancialCalendarSelectedStart = new Date(today);
    officerFinancialCalendarSelectedEnd = null;

    const label = document.getElementById('financialSummaryDateFilterLabel');
    if (label) {
        label.textContent = 'Today';
    }
}

function openOfficerFinancialDateFilterModal() {
    const modal = document.getElementById('officerFinancialDateFilterModal');
    if (!modal) return;
    modal.classList.add('show');
    officerFinancialCalendarCurrentDate = officerFinancialCalendarSelectedStart
        ? new Date(officerFinancialCalendarSelectedStart)
        : new Date();
    renderOfficerFinancialDateCalendar();
    document.body.style.overflow = 'hidden';
}

function closeOfficerFinancialDateFilterModal() {
    const modal = document.getElementById('officerFinancialDateFilterModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function navigateOfficerFinancialCalendarMonth(offset) {
    officerFinancialCalendarCurrentDate.setMonth(officerFinancialCalendarCurrentDate.getMonth() + offset);
    renderOfficerFinancialDateCalendar();
}

function selectEntireOfficerFinancialMonth(year = officerFinancialCalendarCurrentDate.getFullYear(), month = officerFinancialCalendarCurrentDate.getMonth()) {
    officerFinancialCalendarSelectedStart = new Date(year, month, 1);
    officerFinancialCalendarSelectedStart.setHours(0, 0, 0, 0);
    officerFinancialCalendarSelectedEnd = new Date(year, month + 1, 0);
    officerFinancialCalendarSelectedEnd.setHours(0, 0, 0, 0);
}

function syncOfficerFinancialCalendarSelectors() {
    const monthSelect = document.getElementById('officerFinancialFilterCalendarMonthSelect');
    const yearSelect = document.getElementById('officerFinancialFilterCalendarYearSelect');
    const selectedYear = officerFinancialCalendarCurrentDate.getFullYear();
    const currentYear = new Date().getFullYear();

    if (monthSelect && monthSelect.options.length === 0) {
        monthSelect.innerHTML = OFFICER_FINANCIAL_MONTH_NAMES.map((monthName, index) => `
            <option value="${index}">${monthName}</option>
        `).join('');
    }

    if (yearSelect) {
        const startYear = 2000;
        const endYear = Math.max(currentYear + 10, selectedYear + 1);
        yearSelect.innerHTML = '';
        for (let year = endYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.appendChild(option);
        }
        yearSelect.value = String(selectedYear);
    }

    if (monthSelect) {
        monthSelect.value = String(officerFinancialCalendarCurrentDate.getMonth());
    }
}

function setOfficerFinancialCalendarMonth(month) {
    const parsedMonth = Number(month);
    if (Number.isNaN(parsedMonth)) return;
    officerFinancialCalendarCurrentDate.setMonth(parsedMonth);
    selectEntireOfficerFinancialMonth(officerFinancialCalendarCurrentDate.getFullYear(), parsedMonth);
    renderOfficerFinancialDateCalendar();
}

function setOfficerFinancialCalendarYear(year) {
    const parsedYear = Number(year);
    if (Number.isNaN(parsedYear)) return;
    officerFinancialCalendarCurrentDate.setFullYear(parsedYear);
    if (officerFinancialCalendarSelectedStart && officerFinancialCalendarSelectedEnd) {
        selectEntireOfficerFinancialMonth(parsedYear, officerFinancialCalendarCurrentDate.getMonth());
    }
    renderOfficerFinancialDateCalendar();
}

function renderOfficerFinancialDateCalendar() {
    const year = officerFinancialCalendarCurrentDate.getFullYear();
    const month = officerFinancialCalendarCurrentDate.getMonth();
    syncOfficerFinancialCalendarSelectors();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = document.getElementById('officerFinancialFilterCalendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDays.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        dateObj.setHours(0, 0, 0, 0);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        if (dateObj.getTime() === today.getTime()) dayCell.classList.add('today');
        if (officerFinancialCalendarSelectedStart && dateObj.getTime() === officerFinancialCalendarSelectedStart.getTime()) dayCell.classList.add('selected');
        if (officerFinancialCalendarSelectedEnd && dateObj.getTime() === officerFinancialCalendarSelectedEnd.getTime()) dayCell.classList.add('selected');
        if (officerFinancialCalendarSelectedStart && officerFinancialCalendarSelectedEnd) {
            if (dateObj >= officerFinancialCalendarSelectedStart && dateObj <= officerFinancialCalendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }
        }

        dayCell.addEventListener('click', () => selectOfficerFinancialCalendarDate(dateObj));
        calendarDays.appendChild(dayCell);
    }

    updateOfficerFinancialSelectedRangeDisplay();
}

function selectOfficerFinancialCalendarDate(date) {
    if (!officerFinancialCalendarSelectedStart || (officerFinancialCalendarSelectedStart && officerFinancialCalendarSelectedEnd)) {
        officerFinancialCalendarSelectedStart = date;
        officerFinancialCalendarSelectedEnd = null;
    } else if (date < officerFinancialCalendarSelectedStart) {
        officerFinancialCalendarSelectedEnd = officerFinancialCalendarSelectedStart;
        officerFinancialCalendarSelectedStart = date;
    } else {
        officerFinancialCalendarSelectedEnd = date;
    }

    renderOfficerFinancialDateCalendar();
}

function updateOfficerFinancialSelectedRangeDisplay() {
    const startDisplay = document.getElementById('officerFinancialSelectedStartDate');
    const endDisplay = document.getElementById('officerFinancialSelectedEndDate');

    if (startDisplay) {
        startDisplay.textContent = officerFinancialCalendarSelectedStart
            ? officerFinancialCalendarSelectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }

    if (endDisplay) {
        endDisplay.textContent = officerFinancialCalendarSelectedEnd
            ? officerFinancialCalendarSelectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }
}

function applyOfficerFinancialDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    officerFinancialCalendarCurrentDate = new Date(today);

    let startDate;
    let endDate;

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
        default:
            startDate = null;
            endDate = null;
            break;
    }

    officerFinancialCalendarSelectedStart = startDate;
    officerFinancialCalendarSelectedEnd = endDate;
    updateOfficerFinancialSelectedRangeDisplay();
    renderOfficerFinancialDateCalendar();
}

function applyOfficerFinancialDateFilter() {
    officerFinancialSummaryFilters.startDate = officerFinancialCalendarSelectedStart
        ? formatLocalDateKey(officerFinancialCalendarSelectedStart)
        : null;
    officerFinancialSummaryFilters.endDate = officerFinancialCalendarSelectedEnd
        ? formatLocalDateKey(officerFinancialCalendarSelectedEnd)
        : null;

    const label = document.getElementById('financialSummaryDateFilterLabel');
    if (label) {
        if (officerFinancialSummaryFilters.startDate && !officerFinancialSummaryFilters.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayKey = formatLocalDateKey(today);
            label.textContent = officerFinancialSummaryFilters.startDate === todayKey
                ? 'Today'
                : new Date(officerFinancialSummaryFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (officerFinancialSummaryFilters.startDate || officerFinancialSummaryFilters.endDate) {
            const start = officerFinancialSummaryFilters.startDate
                ? new Date(officerFinancialSummaryFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            const end = officerFinancialSummaryFilters.endDate
                ? new Date(officerFinancialSummaryFilters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            label.textContent = `${start} - ${end}`;
        } else {
            label.textContent = 'All Dates';
        }
    }

    closeOfficerFinancialDateFilterModal();
    renderOfficerFinancialSummary();
}

function openAnalyticsExportDateFilterModal(format) {
    analyticsExportRequestedFormat = format;

    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.remove('show');

    const modal = document.getElementById('analyticsExportDateFilterModal');
    if (!modal) return;
    modal.classList.add('show');

    if (analyticsExportFilters.startDate) {
        analyticsExportCalendarSelectedStart = new Date(`${analyticsExportFilters.startDate}T00:00:00`);
    } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        analyticsExportCalendarSelectedStart = new Date(today);
    }
    if (analyticsExportFilters.endDate) {
        analyticsExportCalendarSelectedEnd = new Date(`${analyticsExportFilters.endDate}T00:00:00`);
    } else {
        analyticsExportCalendarSelectedEnd = null;
    }

    analyticsExportCalendarCurrentDate = analyticsExportCalendarSelectedStart
        ? new Date(analyticsExportCalendarSelectedStart)
        : new Date();

    renderAnalyticsExportDateCalendar();
    document.body.style.overflow = 'hidden';
}

function closeAnalyticsExportDateFilterModal() {
    const modal = document.getElementById('analyticsExportDateFilterModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function navigateAnalyticsExportCalendarMonth(offset) {
    analyticsExportCalendarCurrentDate.setMonth(analyticsExportCalendarCurrentDate.getMonth() + offset);
    renderAnalyticsExportDateCalendar();
}

function syncAnalyticsExportCalendarSelectors() {
    const monthSelect = document.getElementById('analyticsExportCalendarMonthSelect');
    const yearSelect = document.getElementById('analyticsExportCalendarYearSelect');
    const selectedYear = analyticsExportCalendarCurrentDate.getFullYear();
    const currentYear = new Date().getFullYear();

    if (monthSelect && monthSelect.options.length === 0) {
        monthSelect.innerHTML = OFFICER_FINANCIAL_MONTH_NAMES.map((monthName, index) => `
            <option value="${index}">${monthName}</option>
        `).join('');
    }

    if (yearSelect) {
        const startYear = 2000;
        const endYear = Math.max(currentYear + 10, selectedYear + 1);
        yearSelect.innerHTML = '';
        for (let year = endYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.appendChild(option);
        }
        yearSelect.value = String(selectedYear);
    }

    if (monthSelect) {
        monthSelect.value = String(analyticsExportCalendarCurrentDate.getMonth());
    }
}

function selectEntireAnalyticsExportMonth(year = analyticsExportCalendarCurrentDate.getFullYear(), month = analyticsExportCalendarCurrentDate.getMonth()) {
    analyticsExportCalendarSelectedStart = new Date(year, month, 1);
    analyticsExportCalendarSelectedStart.setHours(0, 0, 0, 0);
    analyticsExportCalendarSelectedEnd = new Date(year, month + 1, 0);
    analyticsExportCalendarSelectedEnd.setHours(0, 0, 0, 0);
}

function setAnalyticsExportCalendarMonth(month) {
    const parsedMonth = Number(month);
    if (Number.isNaN(parsedMonth)) return;
    analyticsExportCalendarCurrentDate.setMonth(parsedMonth);
    selectEntireAnalyticsExportMonth(analyticsExportCalendarCurrentDate.getFullYear(), parsedMonth);
    renderAnalyticsExportDateCalendar();
}

function setAnalyticsExportCalendarYear(year) {
    const parsedYear = Number(year);
    if (Number.isNaN(parsedYear)) return;
    analyticsExportCalendarCurrentDate.setFullYear(parsedYear);
    selectEntireAnalyticsExportMonth(parsedYear, analyticsExportCalendarCurrentDate.getMonth());
    renderAnalyticsExportDateCalendar();
}

function renderAnalyticsExportDateCalendar() {
    const year = analyticsExportCalendarCurrentDate.getFullYear();
    const month = analyticsExportCalendarCurrentDate.getMonth();
    syncAnalyticsExportCalendarSelectors();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = document.getElementById('analyticsExportCalendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDays.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        dateObj.setHours(0, 0, 0, 0);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        if (dateObj.getTime() === today.getTime()) dayCell.classList.add('today');
        if (analyticsExportCalendarSelectedStart && dateObj.getTime() === analyticsExportCalendarSelectedStart.getTime()) dayCell.classList.add('selected');
        if (analyticsExportCalendarSelectedEnd && dateObj.getTime() === analyticsExportCalendarSelectedEnd.getTime()) dayCell.classList.add('selected');
        if (analyticsExportCalendarSelectedStart && analyticsExportCalendarSelectedEnd) {
            if (dateObj >= analyticsExportCalendarSelectedStart && dateObj <= analyticsExportCalendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }
        }

        dayCell.addEventListener('click', () => selectAnalyticsExportCalendarDate(dateObj));
        calendarDays.appendChild(dayCell);
    }

    updateAnalyticsExportSelectedRangeDisplay();
}

function selectAnalyticsExportCalendarDate(date) {
    if (!analyticsExportCalendarSelectedStart || (analyticsExportCalendarSelectedStart && analyticsExportCalendarSelectedEnd)) {
        analyticsExportCalendarSelectedStart = date;
        analyticsExportCalendarSelectedEnd = null;
    } else if (date < analyticsExportCalendarSelectedStart) {
        analyticsExportCalendarSelectedEnd = analyticsExportCalendarSelectedStart;
        analyticsExportCalendarSelectedStart = date;
    } else {
        analyticsExportCalendarSelectedEnd = date;
    }

    renderAnalyticsExportDateCalendar();
}

function updateAnalyticsExportSelectedRangeDisplay() {
    const startDisplay = document.getElementById('analyticsExportSelectedStartDate');
    const endDisplay = document.getElementById('analyticsExportSelectedEndDate');

    if (startDisplay) {
        startDisplay.textContent = analyticsExportCalendarSelectedStart
            ? analyticsExportCalendarSelectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }

    if (endDisplay) {
        endDisplay.textContent = analyticsExportCalendarSelectedEnd
            ? analyticsExportCalendarSelectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }
}

function applyAnalyticsExportDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    analyticsExportCalendarCurrentDate = new Date(today);

    let startDate;
    let endDate;

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
        default:
            startDate = null;
            endDate = null;
            break;
    }

    analyticsExportCalendarSelectedStart = startDate;
    analyticsExportCalendarSelectedEnd = endDate;
    updateAnalyticsExportSelectedRangeDisplay();
    renderAnalyticsExportDateCalendar();
}

function applyAnalyticsExportDateFilter() {
    analyticsExportFilters.startDate = analyticsExportCalendarSelectedStart
        ? formatLocalDateKey(analyticsExportCalendarSelectedStart)
        : null;
    analyticsExportFilters.endDate = analyticsExportCalendarSelectedEnd
        ? formatLocalDateKey(analyticsExportCalendarSelectedEnd)
        : null;

    closeAnalyticsExportDateFilterModal();

    if (analyticsExportRequestedFormat === 'csv') {
        exportCSV({ exportRange: { ...analyticsExportFilters } });
        return;
    }
    if (analyticsExportRequestedFormat === 'pdf') {
        exportPDF({ exportRange: { ...analyticsExportFilters } });
    }
}

async function loadOfficerFinancialSummary(force = false) {
    try {
        const data = await window.igpApi.getFinancialSummary({});
        officerFinancialSummaryData = Array.isArray(data.items) ? data.items : [];
        renderOfficerFinancialSummary();
        return officerFinancialSummaryData;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerFinancialSummary]', error);
        }
        officerFinancialSummaryData = [];
        renderOfficerFinancialSummary();
        throw error;
    }
}

function showOfficerPrintingQueueView() {
    currentPrintingPanelView = 'queue';
    const queueContent = document.getElementById('officerPrintingQueueContent');
    const historyContent = document.getElementById('officerPrintingHistoryContent');
    const subtitle = document.getElementById('printingQueueSubtitle');
    const btnHistory = document.getElementById('btnShowPrintingHistory');
    const btnBack = document.getElementById('btnBackToPrintingQueue');

    if (queueContent) queueContent.style.display = 'block';
    if (historyContent) historyContent.style.display = 'none';
    if (subtitle) subtitle.textContent = 'View PDFs, update print status, and rearrange queued jobs by priority.';
    if (btnHistory) btnHistory.style.display = 'inline-flex';
    if (btnBack) btnBack.style.display = 'none';
}

function showOfficerPrintingHistoryView() {
    currentPrintingPanelView = 'history';
    const queueContent = document.getElementById('officerPrintingQueueContent');
    const historyContent = document.getElementById('officerPrintingHistoryContent');
    const subtitle = document.getElementById('printingQueueSubtitle');
    const btnHistory = document.getElementById('btnShowPrintingHistory');
    const btnBack = document.getElementById('btnBackToPrintingQueue');

    if (queueContent) queueContent.style.display = 'none';
    if (historyContent) historyContent.style.display = 'block';
    if (subtitle) subtitle.textContent = 'Review completed and cancelled print requests using the same date filters as the history page.';
    if (btnHistory) btnHistory.style.display = 'none';
    if (btnBack) btnBack.style.display = 'inline-flex';
    renderOfficerPrintingHistory(true);
}

function getOfficerPrintStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ready_to_claim') return 'Ready to Claim';
    if (normalized === 'processing') return 'Processing';
    if (normalized === 'queued') return 'Queued';
    if (normalized === 'claimed') return 'Claimed';
    if (normalized === 'cancelled') return 'Cancelled';
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unknown';
}

function getOfficerPrintStatusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ready_to_claim') return 'status-approved';
    if (normalized === 'processing') return 'status-pending';
    if (normalized === 'queued') return 'status-borrowed';
    if (normalized === 'claimed') return 'status-completed';
    if (normalized === 'cancelled') return 'status-overdue';
    return 'status-pending';
}

function renderOfficerPrintingQueue(printingEnabled = true) {
    setOfficerTrackerPrintingAccess(printingEnabled);

    const tableBody = document.getElementById('officerPrintingQueueTable');
    const historyBody = document.getElementById('officerPrintingHistoryTable');
    const disabledMessage = document.getElementById('officerPrintingDisabledMessage');
    const tableWrap = document.getElementById('officerPrintingQueueTableWrap');
    if (!tableBody || !disabledMessage || !tableWrap) return;

    disabledMessage.style.display = printingEnabled ? 'none' : 'block';
    tableWrap.style.display = printingEnabled ? 'block' : 'none';

    if (!printingEnabled) {
        showOfficerPrintingQueueView();
        renderOfficerPrintingHistory(false);
        return;
    }

    const activeJobs = officerPrintingQueue.filter((job) => {
        const status = String(job.status || '').toLowerCase();
        return status === 'queued' || status === 'processing' || status === 'ready_to_claim';
    });

    if (!activeJobs.length) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--muted);">No print jobs found for this organization.</td></tr>`;
    } else {
        tableBody.innerHTML = activeJobs.map((job) => {
        const jobUrl = resolvePdfUrl(job.file_url);
        const queueLabel = String(job.status || '').toLowerCase() === 'queued'
            ? `#${Number(job.queue_position || job.queue_order || 0) || '-'}`
            : '-';
        const isQueued = String(job.status || '').toLowerCase() === 'queued';
        const priorityControls = isQueued
            ? `
                <div class="printing-priority-controls">
                    <button class="btn btn-outline btn-sm" type="button" onclick="moveOfficerPrintJob(${job.print_job_id}, -1)">
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>
                    <button class="btn btn-outline btn-sm" type="button" onclick="moveOfficerPrintJob(${job.print_job_id}, 1)">
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    <div class="printing-priority-input">
                        <input type="number" min="1" value="${Number(job.queue_position || job.queue_order || 1)}" id="printingQueuePosition_${job.print_job_id}">
                        <button class="btn btn-outline btn-sm" type="button" onclick="setOfficerPrintJobPosition(${job.print_job_id})">Move</button>
                    </div>
                </div>
            `
            : `<span style="color:var(--muted);">Locked</span>`;

        const statusActions = [];
        if (isQueued) {
            statusActions.push(`<button class="btn btn-primary btn-sm" type="button" onclick="updateOfficerPrintJobStatus(${job.print_job_id}, 'processing')">Start</button>`);
        }
        if (String(job.status || '').toLowerCase() === 'processing') {
            statusActions.push(`<button class="btn btn-primary btn-sm" type="button" onclick="updateOfficerPrintJobStatus(${job.print_job_id}, 'ready_to_claim')">Ready</button>`);
        }
        if (String(job.status || '').toLowerCase() === 'ready_to_claim') {
            statusActions.push(`<button class="btn btn-primary btn-sm" type="button" onclick="updateOfficerPrintJobStatus(${job.print_job_id}, 'claimed')">Claimed</button>`);
        }
        if (String(job.status || '').toLowerCase() !== 'claimed' && String(job.status || '').toLowerCase() !== 'cancelled') {
            statusActions.push(`<button class="btn btn-outline btn-sm" type="button" onclick="updateOfficerPrintJobStatus(${job.print_job_id}, 'cancelled')">Cancel</button>`);
        }

        return `
            <tr>
                <td>${queueLabel}</td>
                <td>
                    <strong>${escapeHtml(job.file_name || 'Untitled PDF')}</strong>
                    ${job.notes ? `<div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.notes)}</div>` : ''}
                </td>
                <td>
                    <strong>${escapeHtml(job.student_name || 'Unknown Student')}</strong>
                    <div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.student_number || '-')} ${job.section ? `• ${escapeHtml(job.section)}` : ''}</div>
                </td>
                <td>${fmtDateShort(job.submitted_at)}<div style="color:var(--muted); font-size:0.8rem;">${new Date(job.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div></td>
                <td><span class="status-badge ${getOfficerPrintStatusClass(job.status)}">${getOfficerPrintStatusLabel(job.status)}</span></td>
                <td>${priorityControls}</td>
                <td>
                    <div class="printing-job-action-stack">
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${jobUrl}" target="_blank" rel="noopener">View</a>` : ''}
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${jobUrl}" download>Download</a>` : ''}
                        ${statusActions.join('')}
                    </div>
                </td>
            </tr>
        `;
        }).join('');
    }

    renderOfficerPrintingHistory(true);

    if (currentPrintingPanelView === 'history') {
        showOfficerPrintingHistoryView();
    } else {
        showOfficerPrintingQueueView();
    }
}

function filterOfficerPrintingHistory() {
    officerPrintingHistoryFilters.search = String(document.getElementById('printingHistorySearchInput')?.value || '').trim().toLowerCase();
    renderOfficerPrintingHistory(true);
}

function showAllOfficerPrintingHistoryDates() {
    officerPrintingHistoryFilters = { startDate: null, endDate: null, search: '' };
    officerPrintingCalendarSelectedStart = null;
    officerPrintingCalendarSelectedEnd = null;
    const label = document.getElementById('printingHistoryDateFilterLabel');
    if (label) label.textContent = 'All Dates';
    const searchInput = document.getElementById('printingHistorySearchInput');
    if (searchInput) searchInput.value = '';
    renderOfficerPrintingHistory(true);
}

function initializeOfficerPrintingHistoryDefaultDate() {
    if (officerPrintingHistoryFilters.startDate || officerPrintingHistoryFilters.endDate) {
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatLocalDateKey(today);

    officerPrintingHistoryFilters.startDate = todayKey;
    officerPrintingHistoryFilters.endDate = null;
    officerPrintingCalendarSelectedStart = new Date(today);
    officerPrintingCalendarSelectedEnd = null;

    const label = document.getElementById('printingHistoryDateFilterLabel');
    if (label) {
        label.textContent = 'Today';
    }
}

function renderOfficerPrintingHistory(printingEnabled = true) {
    const tableBody = document.getElementById('officerPrintingHistoryTable');
    if (!tableBody) return;

    if (!printingEnabled) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--muted);">Printing is not enabled for this organization.</td></tr>`;
        return;
    }

    let historyItems = officerPrintingQueue.filter((job) => {
        const status = String(job.status || '').toLowerCase();
        return status === 'claimed' || status === 'cancelled';
    });

    if (officerPrintingHistoryFilters.startDate || officerPrintingHistoryFilters.endDate) {
        historyItems = historyItems.filter((job) => {
            const submittedDate = job.submitted_at ? new Date(job.submitted_at) : null;
            if (!submittedDate || Number.isNaN(submittedDate.getTime())) return false;
            const start = officerPrintingHistoryFilters.startDate ? new Date(officerPrintingHistoryFilters.startDate) : null;
            const end = officerPrintingHistoryFilters.endDate ? new Date(officerPrintingHistoryFilters.endDate) : null;
            if (start && submittedDate < start) return false;
            if (end) {
                end.setHours(23, 59, 59, 999);
                if (submittedDate > end) return false;
            }
            return true;
        });
    }

    if (officerPrintingHistoryFilters.search) {
        historyItems = historyItems.filter((job) => {
            const status = getOfficerPrintStatusLabel(job.status);
            const searchBlob = [
                job.file_name || '',
                job.student_name || '',
                job.student_number || '',
                job.section || '',
                job.notes || '',
                status
            ].join(' ').toLowerCase();
            return searchBlob.includes(officerPrintingHistoryFilters.search);
        });
    }

    historyItems.sort((a, b) => {
        const aDate = new Date(a.claimed_at || a.updated_at || a.submitted_at || 0).getTime();
        const bDate = new Date(b.claimed_at || b.updated_at || b.submitted_at || 0).getTime();
        return bDate - aDate;
    });

    if (!historyItems.length) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--muted);">No print history found for the selected filters.</td></tr>`;
        return;
    }

    tableBody.innerHTML = historyItems.map((job) => {
        const jobUrl = resolvePdfUrl(job.file_url);
        const completedAt = job.claimed_at || job.updated_at || '';
        return `
            <tr>
                <td>${Number(job.queue_order || job.queue_position || 0) || '-'}</td>
                <td>
                    <strong>${escapeHtml(job.file_name || 'Untitled PDF')}</strong>
                    ${job.notes ? `<div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.notes)}</div>` : ''}
                </td>
                <td>
                    <strong>${escapeHtml(job.student_name || 'Unknown Student')}</strong>
                    <div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.student_number || '-')} ${job.section ? `â€¢ ${escapeHtml(job.section)}` : ''}</div>
                </td>
                <td>${fmtDateShort(job.submitted_at)}<div style="color:var(--muted); font-size:0.8rem;">${new Date(job.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div></td>
                <td>${completedAt ? `${fmtDateShort(completedAt)}<div style="color:var(--muted); font-size:0.8rem;">${new Date(completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>` : '-'}</td>
                <td><span class="status-badge ${getOfficerPrintStatusClass(job.status)}">${getOfficerPrintStatusLabel(job.status)}</span></td>
                <td>
                    <div class="printing-job-action-stack">
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${jobUrl}" target="_blank" rel="noopener">View</a>` : ''}
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${jobUrl}" download>Download</a>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openOfficerPrintingDateFilterModal() {
    const modal = document.getElementById('officerPrintingDateFilterModal');
    if (!modal) return;
    modal.classList.add('show');
    officerPrintingCalendarCurrentDate = new Date();
    renderOfficerPrintingDateCalendar();
    document.body.style.overflow = 'hidden';
}

function closeOfficerPrintingDateFilterModal() {
    const modal = document.getElementById('officerPrintingDateFilterModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function navigateOfficerPrintingCalendarMonth(offset) {
    officerPrintingCalendarCurrentDate.setMonth(officerPrintingCalendarCurrentDate.getMonth() + offset);
    renderOfficerPrintingDateCalendar();
}

function selectEntireOfficerPrintingMonth(year = officerPrintingCalendarCurrentDate.getFullYear(), month = officerPrintingCalendarCurrentDate.getMonth()) {
    officerPrintingCalendarSelectedStart = new Date(year, month, 1);
    officerPrintingCalendarSelectedStart.setHours(0, 0, 0, 0);
    officerPrintingCalendarSelectedEnd = new Date(year, month + 1, 0);
    officerPrintingCalendarSelectedEnd.setHours(0, 0, 0, 0);
}

function syncOfficerPrintingCalendarSelectors() {
    const monthSelect = document.getElementById('officerPrintingFilterCalendarMonthSelect');
    const yearSelect = document.getElementById('officerPrintingFilterCalendarYearSelect');
    const selectedYear = officerPrintingCalendarCurrentDate.getFullYear();
    const currentYear = new Date().getFullYear();

    if (monthSelect && monthSelect.options.length === 0) {
        monthSelect.innerHTML = OFFICER_FINANCIAL_MONTH_NAMES.map((monthName, index) => `
            <option value="${index}">${monthName}</option>
        `).join('');
    }

    if (yearSelect) {
        const startYear = 2000;
        const endYear = Math.max(currentYear + 10, selectedYear + 1);
        yearSelect.innerHTML = '';
        for (let year = endYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.appendChild(option);
        }
        yearSelect.value = String(selectedYear);
    }

    if (monthSelect) {
        monthSelect.value = String(officerPrintingCalendarCurrentDate.getMonth());
    }
}

function setOfficerPrintingCalendarMonth(month) {
    const parsedMonth = Number(month);
    if (Number.isNaN(parsedMonth)) return;
    officerPrintingCalendarCurrentDate.setMonth(parsedMonth);
    selectEntireOfficerPrintingMonth(officerPrintingCalendarCurrentDate.getFullYear(), parsedMonth);
    renderOfficerPrintingDateCalendar();
}

function setOfficerPrintingCalendarYear(year) {
    const parsedYear = Number(year);
    if (Number.isNaN(parsedYear)) return;
    officerPrintingCalendarCurrentDate.setFullYear(parsedYear);
    if (officerPrintingCalendarSelectedStart && officerPrintingCalendarSelectedEnd) {
        selectEntireOfficerPrintingMonth(parsedYear, officerPrintingCalendarCurrentDate.getMonth());
    }
    renderOfficerPrintingDateCalendar();
}

function renderOfficerPrintingDateCalendar() {
    const year = officerPrintingCalendarCurrentDate.getFullYear();
    const month = officerPrintingCalendarCurrentDate.getMonth();
    syncOfficerPrintingCalendarSelectors();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = document.getElementById('officerPrintingFilterCalendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDays.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        dateObj.setHours(0, 0, 0, 0);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        if (dateObj.getTime() === today.getTime()) dayCell.classList.add('today');
        if (officerPrintingCalendarSelectedStart && dateObj.getTime() === officerPrintingCalendarSelectedStart.getTime()) dayCell.classList.add('selected');
        if (officerPrintingCalendarSelectedEnd && dateObj.getTime() === officerPrintingCalendarSelectedEnd.getTime()) dayCell.classList.add('selected');
        if (officerPrintingCalendarSelectedStart && officerPrintingCalendarSelectedEnd) {
            if (dateObj >= officerPrintingCalendarSelectedStart && dateObj <= officerPrintingCalendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }
        }

        dayCell.addEventListener('click', () => selectOfficerPrintingCalendarDate(dateObj));
        calendarDays.appendChild(dayCell);
    }

    updateOfficerPrintingSelectedRangeDisplay();
}

function selectOfficerPrintingCalendarDate(date) {
    if (!officerPrintingCalendarSelectedStart || (officerPrintingCalendarSelectedStart && officerPrintingCalendarSelectedEnd)) {
        officerPrintingCalendarSelectedStart = date;
        officerPrintingCalendarSelectedEnd = null;
    } else if (date < officerPrintingCalendarSelectedStart) {
        officerPrintingCalendarSelectedEnd = officerPrintingCalendarSelectedStart;
        officerPrintingCalendarSelectedStart = date;
    } else {
        officerPrintingCalendarSelectedEnd = date;
    }

    renderOfficerPrintingDateCalendar();
}

function updateOfficerPrintingSelectedRangeDisplay() {
    const startDisplay = document.getElementById('officerPrintingSelectedStartDate');
    const endDisplay = document.getElementById('officerPrintingSelectedEndDate');

    if (startDisplay) {
        startDisplay.textContent = officerPrintingCalendarSelectedStart
            ? officerPrintingCalendarSelectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }

    if (endDisplay) {
        endDisplay.textContent = officerPrintingCalendarSelectedEnd
            ? officerPrintingCalendarSelectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }
}

function applyOfficerPrintingDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    officerPrintingCalendarCurrentDate = new Date(today);

    let startDate;
    let endDate;

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
        default:
            startDate = null;
            endDate = null;
            break;
    }

    officerPrintingCalendarSelectedStart = startDate;
    officerPrintingCalendarSelectedEnd = endDate;
    updateOfficerPrintingSelectedRangeDisplay();
    renderOfficerPrintingDateCalendar();
}

function applyOfficerPrintingDateFilter() {
    officerPrintingHistoryFilters.startDate = officerPrintingCalendarSelectedStart
        ? formatLocalDateKey(officerPrintingCalendarSelectedStart)
        : null;
    officerPrintingHistoryFilters.endDate = officerPrintingCalendarSelectedEnd
        ? formatLocalDateKey(officerPrintingCalendarSelectedEnd)
        : null;

    const label = document.getElementById('printingHistoryDateFilterLabel');
    if (label) {
        if (officerPrintingHistoryFilters.startDate && !officerPrintingHistoryFilters.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayKey = formatLocalDateKey(today);
            label.textContent = officerPrintingHistoryFilters.startDate === todayKey
                ? 'Today'
                : new Date(officerPrintingHistoryFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (officerPrintingHistoryFilters.startDate || officerPrintingHistoryFilters.endDate) {
            const start = officerPrintingHistoryFilters.startDate
                ? new Date(officerPrintingHistoryFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            const end = officerPrintingHistoryFilters.endDate
                ? new Date(officerPrintingHistoryFilters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            label.textContent = `${start} - ${end}`;
        } else {
            label.textContent = 'All Dates';
        }
    }

    closeOfficerPrintingDateFilterModal();
    renderOfficerPrintingHistory(true);
}

document.addEventListener('click', (e) => {
    const printingDateModal = document.getElementById('officerPrintingDateFilterModal');
    if (printingDateModal && e.target === printingDateModal) {
        closeOfficerPrintingDateFilterModal();
    }
    const financialDateModal = document.getElementById('officerFinancialDateFilterModal');
    if (financialDateModal && e.target === financialDateModal) {
        closeOfficerFinancialDateFilterModal();
    }
    const analyticsExportDateModal = document.getElementById('analyticsExportDateFilterModal');
    if (analyticsExportDateModal && e.target === analyticsExportDateModal) {
        closeAnalyticsExportDateFilterModal();
    }
    const lockerModal = document.getElementById('lockerDetailModal');
    if (lockerModal && e.target === lockerModal) {
        closeLockerDetailModal();
    }
    const lockerAssignModal = document.getElementById('lockerAssignStudentModal');
    if (lockerAssignModal && e.target === lockerAssignModal) {
        closeLockerAssignStudentModal();
    }
    const lockerReleaseConfirmModal = document.getElementById('lockerReleaseConfirmModal');
    if (lockerReleaseConfirmModal && e.target === lockerReleaseConfirmModal) {
        closeLockerReleaseConfirmModal();
    }
    const addLockerModal = document.getElementById('addLockerModal');
    if (addLockerModal && e.target === addLockerModal) {
        closeAddLockerModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const printingDateModal = document.getElementById('officerPrintingDateFilterModal');
        if (printingDateModal && printingDateModal.classList.contains('show')) {
            closeOfficerPrintingDateFilterModal();
        }
        const lockerAssignModal = document.getElementById('lockerAssignStudentModal');
        if (lockerAssignModal && lockerAssignModal.classList.contains('show')) {
            closeLockerAssignStudentModal();
            return;
        }
        const lockerReleaseConfirmModal = document.getElementById('lockerReleaseConfirmModal');
        if (lockerReleaseConfirmModal && lockerReleaseConfirmModal.classList.contains('show')) {
            closeLockerReleaseConfirmModal();
            return;
        }
        const lockerModal = document.getElementById('lockerDetailModal');
        if (lockerModal && lockerModal.classList.contains('show')) {
            closeLockerDetailModal();
        }
        const addLockerModal = document.getElementById('addLockerModal');
        if (addLockerModal && addLockerModal.classList.contains('show')) {
            closeAddLockerModal();
        }
    }
});

async function loadOfficerPrintingQueue(force = false) {
    try {
        const response = await fetch('../api/printing/officer/list.php?status=all', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load the printing queue.');
        }
        officerPrintingQueue = Array.isArray(data.items) ? data.items : [];
        renderOfficerPrintingQueue(!!data.printing_enabled);
        return officerPrintingQueue;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerPrintingQueue]', error);
        }
        officerPrintingQueue = [];
        setOfficerTrackerPrintingAccess(false);
        renderOfficerPrintingQueue(false);
        throw error;
    }
}

async function updateOfficerPrintJobStatus(printJobId, status) {
    try {
        const response = await fetch('../api/printing/officer/update-status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                print_job_id: printJobId,
                status,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not update print job status.');
        }
        await loadOfficerPrintingQueue(true);
    } catch (error) {
        alert(error.message || 'Could not update print job status.');
    }
}

function moveOfficerPrintJob(printJobId, delta) {
    const job = officerPrintingQueue.find((item) => Number(item.print_job_id) === Number(printJobId));
    if (!job) return;
    const currentPosition = Number(job.queue_position || job.queue_order || 1);
    const newPosition = Math.max(1, currentPosition + Number(delta || 0));
    reorderOfficerPrintJob(printJobId, newPosition);
}

function setOfficerPrintJobPosition(printJobId) {
    const input = document.getElementById(`printingQueuePosition_${printJobId}`);
    const newPosition = Number(input?.value || 0);
    if (!newPosition) {
        return;
    }
    reorderOfficerPrintJob(printJobId, newPosition);
}

async function reorderOfficerPrintJob(printJobId, newQueueOrder) {
    try {
        const response = await fetch('../api/printing/officer/reorder.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                print_job_id: printJobId,
                new_queue_order: newQueueOrder,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not reorder print jobs.');
        }
        await loadOfficerPrintingQueue(true);
    } catch (error) {
        alert(error.message || 'Could not reorder print jobs.');
    }
}

function getLockerStateLabel(state) {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'pending') return 'Pending';
    if (normalized === 'occupied') return 'Occupied';
    if (normalized === 'overdue') return 'Overdue';
    return 'Available';
}

function getLockerStateClass(state) {
    const normalized = String(state || '').toLowerCase();
    if (normalized === 'pending') return 'pending';
    if (normalized === 'occupied') return 'occupied';
    if (normalized === 'overdue') return 'overdue';
    return 'available';
}

function formatLockerDateOnly(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isLockerDueWithinSevenDays(currentRequest) {
    if (!currentRequest || String(currentRequest.status || '') !== 'locker_active') {
        return false;
    }
    const expectedReturn = new Date(currentRequest.expected_return_time || '');
    if (Number.isNaN(expectedReturn.getTime())) {
        return false;
    }
    const now = new Date();
    const diffMs = expectedReturn.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
}

function getLockerNoticePreset(type) {
    return type === 'upcoming'
        ? 'Your locker rental is due within 7 days. Please coordinate with SSC before the due date if you need assistance.'
        : 'Your locker rental is already past due and may be pulled out by SSC if it remains unresolved.';
}

function getAvailableLockerNoticeTypes(currentRequest = selectedLockerTile?.current_request || null) {
    return currentRequest ? ['upcoming', 'overdue'] : [];
}

function syncLockerNoticeComposer(preferredType = '') {
    const currentRequest = selectedLockerTile?.current_request || null;
    const typeSelect = document.getElementById('lockerNoticeTypeSelect');
    const messageEl = document.getElementById('lockerNoticeComposerMessage');
    const composer = document.getElementById('lockerNoticeComposer');
    const sendBtn = document.getElementById('lockerSendNoticeBtn');
    if (!typeSelect || !messageEl || !composer || !sendBtn) return;

    const allowedTypes = getAvailableLockerNoticeTypes(currentRequest);
    const options = Array.from(typeSelect.options);
    options.forEach((option) => {
        if (!option.value) return;
        option.hidden = !allowedTypes.includes(option.value);
    });

    const nextType = preferredType === ''
        ? ''
        : (allowedTypes.includes(preferredType)
            ? preferredType
            : (allowedTypes.includes(typeSelect.value) ? typeSelect.value : ''));
    typeSelect.value = nextType;

    const isAvailable = !!currentRequest;
    composer.style.display = isAvailable ? '' : 'none';
    sendBtn.disabled = !isAvailable;

    if (!isAvailable) {
        messageEl.value = '';
        messageEl.placeholder = 'No manual notices are available for this locker right now.';
        return;
    }

    typeSelect.value = '';
    applyLockerNoticeTemplate('keep');
}

function applyLockerNoticeTemplate(mode = 'preset') {
    const typeSelect = document.getElementById('lockerNoticeTypeSelect');
    const messageEl = document.getElementById('lockerNoticeComposerMessage');
    if (!typeSelect || !messageEl) return;

    const noticeType = typeSelect.value;
    if (!noticeType) {
        messageEl.value = '';
        messageEl.placeholder = '';
        return;
    }

    const preset = getLockerNoticePreset(noticeType);
    if (mode === 'preset') {
        messageEl.value = preset;
    } else if (mode === 'custom') {
        messageEl.value = '';
    }
    messageEl.placeholder = preset;
}

function handleLockerNoticeComposerInput() {
    const typeSelect = document.getElementById('lockerNoticeTypeSelect');
    const messageEl = document.getElementById('lockerNoticeComposerMessage');
    if (!typeSelect || !messageEl) return;

    const currentValue = String(messageEl.value || '').trim();
    if (!currentValue) {
        return;
    }

    const selectedType = typeSelect.value;
    if (!selectedType) {
        return;
    }

    const preset = getLockerNoticePreset(selectedType);
    if (currentValue !== preset.trim()) {
        typeSelect.value = '';
    }
}

function updateLockerOverviewCounts(lockers) {
    const counts = { available: 0, pending: 0, occupied: 0, overdue: 0 };
    lockers.forEach((locker) => {
        const state = String(locker.state || 'available').toLowerCase();
        if (counts[state] !== undefined) counts[state] += 1;
    });
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    set('lockerAvailableCount', counts.available);
    set('lockerPendingCount', counts.pending);
    set('lockerOccupiedCount', counts.occupied);
    set('lockerOverdueCount', counts.overdue);
}

function renderOfficerLockerBoard() {
    const disabledMessage = document.getElementById('officerLockerDisabledMessage');
    const content = document.getElementById('officerLockerContent');
    const board = document.getElementById('officerLockerBoard');
    if (!board || !disabledMessage || !content) return;

    disabledMessage.style.display = officerLockerEnabled ? 'none' : 'block';
    content.style.display = officerLockerEnabled ? '' : 'none';

    if (!officerLockerEnabled) {
        board.innerHTML = '';
        return;
    }

    if (!officerLockerBoard.length) {
        board.innerHTML = `
            <div class="empty-state" style="padding:32px; text-align:center;">
                <i class="fa-solid fa-door-closed" style="font-size:40px; color:var(--muted); margin-bottom:10px;"></i>
                <h3 style="margin-bottom:8px;">No lockers found</h3>
                <p style="color:var(--muted);">Locker inventory will appear here after SSC locker setup finishes.</p>
            </div>
        `;
        updateLockerOverviewCounts([]);
        return;
    }

    updateLockerOverviewCounts(officerLockerBoard);
    const groups = officerLockerBoard.reduce((acc, locker) => {
        const key = locker.column_key || 'A';
        if (!acc[key]) acc[key] = [];
        acc[key].push(locker);
        return acc;
    }, {});

    const orderedColumns = Object.keys(groups).sort((a, b) => String(a).localeCompare(String(b)));
    board.innerHTML = orderedColumns.map((columnKey) => {
        const lockers = (groups[columnKey] || []).sort((a, b) => String(a.locker_code).localeCompare(String(b.locker_code)));
        return `
            <div class="locker-column">
                <div class="locker-column-header">Locker ${columnKey}</div>
                <div class="locker-column-grid">
                    ${lockers.map((locker) => `
                        <button
                            type="button"
                            class="locker-tile state-${getLockerStateClass(locker.state)}"
                            onclick="openLockerDetail('${escapeHtml(String(locker.locker_code || ''))}')">
                            <span class="locker-tile-door-line"></span>
                            <span class="locker-tile-door-line locker-tile-door-line-bottom"></span>
                            <span class="locker-tile-code">${escapeHtml(locker.locker_code || '')}</span>
                            <span class="locker-tile-state">${escapeHtml(getLockerStateLabel(locker.state))}</span>
                            <span class="locker-tile-handle"></span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function loadOfficerLockerBoard(force = false) {
    try {
        officerLockerEnabled = isOfficerLockerEnabled();
        if (!officerLockerEnabled) {
            officerLockerBoard = [];
            renderOfficerLockerBoard();
            return [];
        }

        const response = await fetch('../api/lockers/officer/list.php', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load locker services.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        return officerLockerBoard;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerLockerBoard]', error);
        }
        officerLockerBoard = [];
        renderOfficerLockerBoard();
        throw error;
    }
}

function openLockerDetail(lockerCode) {
    const locker = officerLockerBoard.find((item) => String(item.locker_code) === String(lockerCode));
    if (!locker) return;
    selectedLockerTile = locker;
    selectedLockerAssignStudent = null;

    const modal = document.getElementById('lockerDetailModal');
    const currentRequest = locker.current_request || null;
    const stateClass = getLockerStateClass(locker.state);
    const stateLabel = getLockerStateLabel(locker.state);

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value ?? '';
    };

    setText('lockerDetailTitle', `Locker ${locker.locker_code}`);
    setText('lockerDetailSubtitle', currentRequest ? 'Review the current locker request or assignment details.' : 'This locker is currently available for assignment.');
    const badge = document.getElementById('lockerDetailStateBadge');
    if (badge) {
        badge.className = `locker-state-pill ${stateClass}`;
        badge.textContent = stateLabel;
    }

    setText('lockerDetailStudentName', currentRequest ? (currentRequest.student_name || 'Unnamed Student') : 'No student assigned');
    setText('lockerDetailStudentMeta', currentRequest
        ? `${currentRequest.student_number || '-'}${currentRequest.section ? ` • ${currentRequest.section}` : ''}`
        : 'Select a pending or occupied locker to manage its assignment.');

    setValue('lockerDetailCode', locker.locker_code || '');
    setValue('lockerMonthlyRate', Number(locker.locker_monthly_rate || 0).toFixed(2));
    setValue('lockerSemesterRate', Number(locker.locker_semester_rate || 0).toFixed(2));
    setValue('lockerSchoolYearRate', Number(locker.locker_school_year_rate || 0).toFixed(2));
    setValue('lockerDetailPeriodType', currentRequest?.locker_period_type || '');
    setValue('lockerDetailStartDate', currentRequest?.rent_time ? String(currentRequest.rent_time).slice(0, 10) : '');
    setValue('lockerDetailEndDate', currentRequest?.expected_return_time ? String(currentRequest.expected_return_time).slice(0, 10) : '');
    setValue('lockerDetailPrice', currentRequest ? Number(currentRequest.total_cost || 0).toFixed(2) : '');
    setValue('lockerNoticeComposerMessage', '');

    const approveBtn = document.getElementById('lockerApproveBtn');
    const manualAssignBtn = document.getElementById('lockerManualAssignBtn');
    const confirmRentalBtn = document.getElementById('lockerConfirmRentalBtn');
    const rejectBtn = document.getElementById('lockerRejectBtn');
    const clearNoticeBtn = document.getElementById('lockerClearNoticeBtn');
    const markPaidBtn = document.getElementById('lockerMarkPaidBtn');
    const releaseBtn = document.getElementById('lockerReleaseBtn');
    const hasActiveNotice = !!(currentRequest?.upcoming_notice_sent_at || currentRequest?.overdue_notice_sent_at || currentRequest?.upcoming_notice_message || currentRequest?.overdue_notice_message);
    const hasLockerRental = !!currentRequest?.rental_id;
    const isPaidLockerRental = hasLockerRental && String(currentRequest?.payment_status || 'unpaid').toLowerCase() === 'paid';
    if (approveBtn) approveBtn.style.display = locker.state === 'pending' ? 'inline-flex' : 'none';
    if (manualAssignBtn) manualAssignBtn.style.display = locker.state === 'available' ? 'inline-flex' : 'none';
    if (confirmRentalBtn) confirmRentalBtn.style.display = 'none';
    if (rejectBtn) rejectBtn.style.display = locker.state === 'pending' ? 'inline-flex' : 'none';
    if (clearNoticeBtn) clearNoticeBtn.style.display = hasActiveNotice ? 'inline-flex' : 'none';
    if (markPaidBtn) {
        markPaidBtn.style.display = hasLockerRental ? 'inline-flex' : 'none';
        markPaidBtn.classList.toggle('btn-success', isPaidLockerRental);
        markPaidBtn.classList.toggle('btn-outline', !isPaidLockerRental);
        markPaidBtn.disabled = isPaidLockerRental;
        markPaidBtn.innerHTML = isPaidLockerRental
            ? '<i class="fa-solid fa-circle-check"></i> Paid'
            : '<i class="fa-solid fa-money-bill-wave"></i> Mark as Paid';
    }
    if (releaseBtn) releaseBtn.style.display = (locker.state === 'occupied' || locker.state === 'overdue') ? 'inline-flex' : 'none';

    const upcomingNoticePreview = document.getElementById('lockerUpcomingNoticePreview');
    if (upcomingNoticePreview) {
        if (currentRequest?.upcoming_notice_sent_at) {
            upcomingNoticePreview.style.display = '';
            setText('lockerUpcomingNoticePreviewText', currentRequest.upcoming_notice_message || 'An ending soon notice has already been sent for this locker.');
            setText('lockerUpcomingNoticePreviewMeta', `Sent on ${formatLockerDateOnly(currentRequest.upcoming_notice_sent_at)}`);
        } else {
            upcomingNoticePreview.style.display = 'none';
            setText('lockerUpcomingNoticePreviewText', '');
            setText('lockerUpcomingNoticePreviewMeta', '');
        }
    }

    const noticePreview = document.getElementById('lockerNoticePreview');
    if (noticePreview) {
        if (currentRequest?.overdue_notice_sent_at) {
            noticePreview.style.display = '';
            setText('lockerNoticePreviewText', currentRequest.overdue_notice_message || 'A pull-out notice has already been sent for this locker.');
            setText('lockerNoticePreviewMeta', `Sent on ${formatLockerDateOnly(currentRequest.overdue_notice_sent_at)}`);
        } else {
            noticePreview.style.display = 'none';
            setText('lockerNoticePreviewText', '');
            setText('lockerNoticePreviewMeta', '');
        }
    }

    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    syncLockerNoticeComposer();
    syncLockerAssignmentPreview();
    syncLockerManualAssignUI();
}

function closeLockerDetailModal() {
    const modal = document.getElementById('lockerDetailModal');
    const assignModal = document.getElementById('lockerAssignStudentModal');
    const releaseConfirmModal = document.getElementById('lockerReleaseConfirmModal');
    if (assignModal) {
        assignModal.classList.remove('show');
    }
    if (releaseConfirmModal) {
        releaseConfirmModal.classList.remove('show');
    }
    if (modal) modal.classList.remove('show');
    selectedLockerTile = null;
    selectedLockerAssignStudent = null;
    if ((!assignModal || !assignModal.classList.contains('show')) && (!releaseConfirmModal || !releaseConfirmModal.classList.contains('show'))) {
        document.body.style.overflow = '';
    }
}

function syncLockerManualAssignUI() {
    const studentNameEl = document.getElementById('lockerDetailStudentName');
    const studentMetaEl = document.getElementById('lockerDetailStudentMeta');
    const confirmRentalBtn = document.getElementById('lockerConfirmRentalBtn');
    const canManualAssign = !!selectedLockerTile && String(selectedLockerTile.state || '').toLowerCase() === 'available';

    if (studentNameEl && studentMetaEl && canManualAssign && selectedLockerAssignStudent) {
        studentNameEl.textContent = selectedLockerAssignStudent.studentName || 'Unnamed Student';
        studentMetaEl.textContent = `${selectedLockerAssignStudent.studentId || '-'}${selectedLockerAssignStudent.section ? ` • ${selectedLockerAssignStudent.section}` : ''}${selectedLockerAssignStudent.programCode ? ` • ${selectedLockerAssignStudent.programCode}` : ''}`;
    } else if (studentNameEl && studentMetaEl && canManualAssign) {
        studentNameEl.textContent = 'No student assigned';
        studentMetaEl.textContent = 'Choose a student from the database to prepare this locker rental.';
    }

    if (confirmRentalBtn) {
        confirmRentalBtn.style.display = canManualAssign && selectedLockerAssignStudent ? 'inline-flex' : 'none';
    }
}

async function loadLockerAssignableStudents(force = false) {
    if (!force && lockerAssignableStudents.length) {
        return lockerAssignableStudents;
    }
    const response = await fetch('../api/igp/students/list.php', {
        method: 'GET',
        credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Could not load the student database.');
    }
    const dedupedStudents = new Map();
    if (Array.isArray(data.items)) {
        data.items
            .filter((item) => item && item.isActive !== false)
            .map((item) => ({
                user_id: Number(item.user_id || 0),
                studentId: String(item.studentId || '').trim(),
                studentName: String(item.studentName || '').trim(),
                section: String(item.section || '').trim(),
                programCode: String(item.programCode || '').trim(),
                isOrgProgram: item.isOrgProgram === true,
            }))
            .filter((item) => item.user_id > 0)
            .forEach((item) => {
                const key = `${item.user_id}|${item.studentId}`;
                if (!dedupedStudents.has(key)) {
                    dedupedStudents.set(key, item);
                    return;
                }

                const existing = dedupedStudents.get(key);
                dedupedStudents.set(key, {
                    ...existing,
                    section: existing.section || item.section,
                    programCode: existing.programCode || item.programCode,
                    isOrgProgram: existing.isOrgProgram || item.isOrgProgram,
                });
            });
    }
    lockerAssignableStudents = Array.from(dedupedStudents.values());
    lockerAssignableStudents.sort((a, b) => {
        if (a.isOrgProgram !== b.isOrgProgram) return a.isOrgProgram ? -1 : 1;
        return a.studentName.localeCompare(b.studentName) || a.studentId.localeCompare(b.studentId);
    });
    return lockerAssignableStudents;
}

function updateLockerAssignSelectedPreview() {
    const selectedBox = document.getElementById('lockerAssignSelectedStudent');
    const confirmBtn = document.getElementById('lockerConfirmAssignBtn');
    if (confirmBtn) confirmBtn.disabled = !selectedLockerAssignStudent;
    if (!selectedBox) return;

    if (!selectedLockerAssignStudent) {
        selectedBox.style.display = 'none';
        selectedBox.innerHTML = '';
        return;
    }

    selectedBox.style.display = '';
    selectedBox.innerHTML = `
        <strong>${escapeHtml(selectedLockerAssignStudent.studentName || 'Unnamed Student')}</strong>
        <span>${escapeHtml(selectedLockerAssignStudent.studentId || '-')} | ${escapeHtml(selectedLockerAssignStudent.programCode || 'No Program')}${selectedLockerAssignStudent.section ? ` | ${escapeHtml(selectedLockerAssignStudent.section)}` : ''}</span>
    `;
}

function renderLockerAssignStudentResults() {
    const results = document.getElementById('lockerAssignStudentResults');
    const searchInput = document.getElementById('lockerAssignStudentSearch');
    if (!results) return;

    const term = String(searchInput?.value || '').trim().toLowerCase();
    const items = lockerAssignableStudents.filter((student) => {
        if (!term) return true;
        return [
            student.studentId,
            student.studentName,
            student.section,
            student.programCode,
        ].join(' ').toLowerCase().includes(term);
    });

    if (!items.length) {
        results.innerHTML = '<div class="locker-assign-empty">No students matched your search.</div>';
        updateLockerAssignSelectedPreview();
        return;
    }

    results.innerHTML = items.map((student) => `
        <button
            type="button"
            class="locker-assign-student-card${selectedLockerAssignStudent?.user_id === student.user_id ? ' selected' : ''}"
            onclick="selectLockerAssignStudent(${student.user_id})">
            <div class="locker-assign-student-main">
                <strong>${escapeHtml(student.studentName || 'Unnamed Student')}</strong>
                <div class="locker-assign-student-meta">
                    <span>${escapeHtml(student.studentId || '-')}</span>
                    <span>${escapeHtml(student.programCode || 'No Program')}</span>
                    <span>${escapeHtml(student.section || 'No Section')}</span>
                    ${student.isOrgProgram ? '<span class="locker-assign-chip org-program">Org Program</span>' : '<span class="locker-assign-chip">Student</span>'}
                </div>
            </div>
            <span class="locker-assign-chip">${selectedLockerAssignStudent?.user_id === student.user_id ? 'Selected' : 'Choose'}</span>
        </button>
    `).join('');
    updateLockerAssignSelectedPreview();
}

function selectLockerAssignStudent(userId) {
    selectedLockerAssignStudent = lockerAssignableStudents.find((student) => Number(student.user_id) === Number(userId)) || null;
    renderLockerAssignStudentResults();
}

function applySelectedLockerAssignStudent() {
    if (!selectedLockerAssignStudent) return;
    closeLockerAssignStudentModal();
    syncLockerManualAssignUI();
}

async function openLockerAssignStudentModal() {
    if (!selectedLockerTile || String(selectedLockerTile.state || '').toLowerCase() !== 'available') {
        return;
    }

    const modal = document.getElementById('lockerAssignStudentModal');
    const searchInput = document.getElementById('lockerAssignStudentSearch');
    if (!modal) return;

    if (searchInput) searchInput.value = '';
    updateLockerAssignSelectedPreview();
    const results = document.getElementById('lockerAssignStudentResults');
    if (results) {
        results.innerHTML = '<div class="locker-assign-empty">Loading students...</div>';
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    try {
        await loadLockerAssignableStudents();
        renderLockerAssignStudentResults();
        if (searchInput) searchInput.focus();
    } catch (error) {
        if (results) {
            results.innerHTML = `<div class="locker-assign-empty">${escapeHtml(error.message || 'Could not load students.')}</div>`;
        }
    }
}

function closeLockerAssignStudentModal() {
    const modal = document.getElementById('lockerAssignStudentModal');
    if (modal) modal.classList.remove('show');
    updateLockerAssignSelectedPreview();
    const lockerModal = document.getElementById('lockerDetailModal');
    if (!lockerModal || !lockerModal.classList.contains('show')) {
        document.body.style.overflow = '';
    }
}

function openLockerReleaseConfirmModal() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const modal = document.getElementById('lockerReleaseConfirmModal');
    const title = document.getElementById('lockerReleaseConfirmTitle');
    const meta = document.getElementById('lockerReleaseConfirmMeta');
    if (!modal) return;

    if (title) {
        title.textContent = `Release Locker ${selectedLockerTile.locker_code || '-'}`;
    }
    if (meta) {
        const request = selectedLockerTile.current_request || {};
        meta.textContent = `${request.student_name || 'Unnamed Student'} | ${request.student_number || '-'}${request.section ? ` | ${request.section}` : ''}`;
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeLockerReleaseConfirmModal() {
    const modal = document.getElementById('lockerReleaseConfirmModal');
    if (modal) modal.classList.remove('show');
    const lockerModal = document.getElementById('lockerDetailModal');
    if (!lockerModal || !lockerModal.classList.contains('show')) {
        document.body.style.overflow = '';
    }
}

async function submitManualLockerAssignment() {
    if (!selectedLockerTile?.item_id || !selectedLockerAssignStudent?.user_id) return;

    const lockerCode = String(selectedLockerTile.locker_code || '');
    try {
        const response = await fetch('../api/lockers/officer/manual-assign.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                item_id: selectedLockerTile.item_id,
                student_user_id: selectedLockerAssignStudent.user_id,
                period_type: document.getElementById('lockerDetailPeriodType')?.value || '',
                start_date: document.getElementById('lockerDetailStartDate')?.value || '',
                end_date: document.getElementById('lockerDetailEndDate')?.value || '',
                price: document.getElementById('lockerDetailPrice')?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not assign the locker.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerAssignStudentModal();
        openLockerDetail(lockerCode);
    } catch (error) {
        alert(error.message || 'Could not assign the locker.');
    }
}

function openAddLockerModal() {
    const modal = document.getElementById('addLockerModal');
    if (!modal) return;
    const codeInput = document.getElementById('newLockerCode');
    const monthlyInput = document.getElementById('newLockerMonthlyRate');
    const semesterInput = document.getElementById('newLockerSemesterRate');
    const schoolYearInput = document.getElementById('newLockerSchoolYearRate');
    if (codeInput) codeInput.value = '';
    if (monthlyInput) monthlyInput.value = '0';
    if (semesterInput) semesterInput.value = '0';
    if (schoolYearInput) schoolYearInput.value = '0';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAddLockerModal() {
    const modal = document.getElementById('addLockerModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

async function submitAddLocker() {
    try {
        const response = await fetch('../api/lockers/officer/add.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                locker_code: document.getElementById('newLockerCode')?.value || '',
                locker_monthly_rate: document.getElementById('newLockerMonthlyRate')?.value || 0,
                locker_semester_rate: document.getElementById('newLockerSemesterRate')?.value || 0,
                locker_school_year_rate: document.getElementById('newLockerSchoolYearRate')?.value || 0
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not add the locker.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeAddLockerModal();
    } catch (error) {
        alert(error.message || 'Could not add the locker.');
    }
}

function syncLockerAssignmentPreview() {
    if (!selectedLockerTile) return;

    const periodType = document.getElementById('lockerDetailPeriodType')?.value || '';
    const startInput = document.getElementById('lockerDetailStartDate');
    const endInput = document.getElementById('lockerDetailEndDate');
    const priceInput = document.getElementById('lockerDetailPrice');
    if (!startInput || !endInput || !priceInput) return;

    if (!periodType) {
        priceInput.value = '';
        return;
    }

    let startValue = String(startInput.value || '').trim();
    if (!startValue) {
        const today = new Date();
        const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        startInput.value = todayValue;
        startValue = todayValue;
    }

    if (!startValue) {
        if (periodType !== 'custom') {
            endInput.value = '';
        }
        if (periodType === 'monthly') {
            priceInput.value = Number(selectedLockerTile.locker_monthly_rate || 0).toFixed(2);
        } else if (periodType === 'semester') {
            priceInput.value = Number(selectedLockerTile.locker_semester_rate || 0).toFixed(2);
        } else if (periodType === 'school_year') {
            priceInput.value = Number(selectedLockerTile.locker_school_year_rate || 0).toFixed(2);
        } else {
            priceInput.value = '';
        }
        return;
    }

    if (periodType !== 'custom') {
        const startDate = new Date(`${startValue}T00:00:00`);
        if (Number.isNaN(startDate.getTime())) return;
        if (periodType === 'monthly') {
            startDate.setMonth(startDate.getMonth() + 1);
        } else if (periodType === 'semester') {
            startDate.setMonth(startDate.getMonth() + 5);
        } else if (periodType === 'school_year') {
            startDate.setMonth(startDate.getMonth() + 10);
        }
        endInput.value = startDate.toISOString().slice(0, 10);
    }

    if (periodType === 'monthly') {
        priceInput.value = Number(selectedLockerTile.locker_monthly_rate || 0).toFixed(2);
    } else if (periodType === 'semester') {
        priceInput.value = Number(selectedLockerTile.locker_semester_rate || 0).toFixed(2);
    } else if (periodType === 'school_year') {
        priceInput.value = Number(selectedLockerTile.locker_school_year_rate || 0).toFixed(2);
    }
}

async function saveLockerPricing() {
    if (!selectedLockerTile) return;
    try {
        const response = await fetch('../api/lockers/officer/pricing.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                item_id: selectedLockerTile.item_id,
                locker_monthly_rate: document.getElementById('lockerMonthlyRate')?.value || 0,
                locker_semester_rate: document.getElementById('lockerSemesterRate')?.value || 0,
                locker_school_year_rate: document.getElementById('lockerSchoolYearRate')?.value || 0
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not save locker rates.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : officerLockerBoard;
        renderOfficerLockerBoard();
        openLockerDetail(selectedLockerTile.locker_code);
    } catch (error) {
        alert(error.message || 'Could not save locker rates.');
    }
}

async function approveLockerAssignment() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    try {
        const response = await fetch('../api/lockers/officer/approve.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id,
                period_type: document.getElementById('lockerDetailPeriodType')?.value || '',
                start_date: document.getElementById('lockerDetailStartDate')?.value || '',
                end_date: document.getElementById('lockerDetailEndDate')?.value || '',
                price: document.getElementById('lockerDetailPrice')?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not approve locker assignment.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerDetailModal();
    } catch (error) {
        alert(error.message || 'Could not approve locker assignment.');
    }
}

async function releaseLockerAssignment() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    try {
        const response = await fetch('../api/lockers/officer/release.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not release locker assignment.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerReleaseConfirmModal();
        closeLockerDetailModal();
    } catch (error) {
        alert(error.message || 'Could not release locker assignment.');
    }
}

async function clearLockerNotice() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const lockerCode = String(selectedLockerTile.locker_code || '');
    try {
        const response = await fetch('../api/lockers/officer/clear-notice.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not clear the notice.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        openLockerDetail(lockerCode);
    } catch (error) {
        alert(error.message || 'Could not clear the notice.');
    }
}

async function markLockerAssignmentPaid() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const lockerCode = String(selectedLockerTile.locker_code || '');
    try {
        const response = await fetch('../api/igp/rentals/mark-paid.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not mark the locker rental as paid.');
        }
        await loadOfficerLockerBoard(true);
        openLockerDetail(lockerCode);
        showToast('Locker rental marked as paid.', 'success');
    } catch (error) {
        showToast(error.message || 'Could not mark the locker rental as paid.', 'error');
    }
}

async function rejectLockerRequest() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    try {
        const response = await fetch('../api/lockers/officer/reject.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not reject locker request.');
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerDetailModal();
    } catch (error) {
        alert(error.message || 'Could not reject locker request.');
    }
}

async function sendLockerNotice(noticeType) {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const normalizedType = String(noticeType || '').toLowerCase() === 'upcoming' ? 'upcoming' : 'overdue';
    const messageFieldId = 'lockerNoticeComposerMessage';
    try {
        const response = await fetch('../api/lockers/officer/notice.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id,
                notice_type: normalizedType,
                message: document.getElementById(messageFieldId)?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || `Could not send the ${normalizedType === 'upcoming' ? 'upcoming' : 'pull-out'} notice.`);
        }
        officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        openLockerDetail(selectedLockerTile.locker_code);
    } catch (error) {
        alert(error.message || `Could not send the ${normalizedType === 'upcoming' ? 'upcoming' : 'pull-out'} notice.`);
    }
}

async function sendLockerPulloutNotice() {
    return sendLockerNotice('overdue');
}

async function sendSelectedLockerNotice() {
    const typeSelect = document.getElementById('lockerNoticeTypeSelect');
    const messageEl = document.getElementById('lockerNoticeComposerMessage');
    if (!typeSelect || !messageEl) {
        return;
    }

    const customMessage = String(messageEl.value || '').trim();
    if (!customMessage) {
        alert('Enter a notice message first.');
        return;
    }

    const resolvedType = typeSelect.value
        || (String(selectedLockerTile?.current_request?.status || '') === 'locker_overdue' ? 'overdue' : 'upcoming');
    return sendLockerNotice(resolvedType);
}

// --- RENDER FUNCTIONS ---

function renderRentals() {
    // Dashboard preview (top 3)
    const dashTable = document.getElementById('dashboard-rentals-table');
    dashTable.innerHTML = getOfficerScopedRentals().slice(0, 3).map(item => {
        let badgeClass = item.status === 'Reserved'
            ? 'status-pending'
            : (item.status === 'Rented' ? 'status-borrowed' : (item.status === 'Overdue' ? 'status-overdue' : 'status-borrowed'));
        return `
        <tr>
            <td>${item.item}</td>
            <td>${item.renter.split(' ')[0]}</td>
            <td>${item.due}</td>
            <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
        </tr>`;
    }).join('');

    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts();
    }
}

async function loadRentalsFromApi() {
    if (!window.igpApi || typeof window.igpApi.getRentals !== 'function') return;

    try {
        const res = await window.igpApi.getRentals({ status: 'open' });
        const items = res.items || [];

        rentalsData = items.map(item => ({
            item: String(item.items_label || '-').replace(/\s*\[[^\]]+\]\s*$/, '').trim() || '-',
            renter: item.renter_name || '-',
            due: fmtDateShort(item.expected_return_time),
            dueAt: item.expected_return_time || null,
            status: String(item.status || '').toLowerCase() === 'reserved'
                ? 'Reserved'
                : (String(item.status || '').toLowerCase() === 'overdue' ? 'Overdue' : 'Rented'),
            org: item.org_id
        }));

        const activeRentalsCard = Array.from(document.querySelectorAll('.stat-card .stat-info p'))
            .find(p => (p.textContent || '').trim() === 'Active Rentals');
        const countEl = activeRentalsCard ? activeRentalsCard.parentElement.querySelector('h3') : null;
        if (countEl) countEl.innerText = String(items.length);

        if (typeof initializeOfficerAnalyticsYearOptions === 'function') {
            initializeOfficerAnalyticsYearOptions();
        }
        renderRentals();
    } catch (e) {
        console.error('loadRentalsFromApi failed', e);
    }
}

// --- MODAL FUNCTIONS ---

function openSubmitModal() {
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.add('show');
}

function closeSubmitModal() {
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.remove('show');
    // Reset file upload label on close
    const label = document.getElementById('file-upload-label');
    if (label) label.textContent = ' Click to upload PDF';
    const fileInput = document.getElementById('doc-file-input');
    if (fileInput) fileInput.value = '';
    // Optional: Reset form on close if desired
    // document.getElementById('doc-form').reset();
}

function openReviewerNoteModal(encodedNote) {
    const modal = document.getElementById('review-comment-modal');
    const body = document.getElementById('review-comment-body');
    if (!modal || !body) return;

    let noteText = '';
    try {
        noteText = decodeURIComponent(encodedNote || '');
    } catch (_error) {
        noteText = String(encodedNote || '');
    }

    body.innerHTML = escapeHtml(noteText).replace(/\n/g, '<br>');
    modal.classList.add('show');
}

function closeReviewerNoteModal() {
    const modal = document.getElementById('review-comment-modal');
    if (modal) modal.classList.remove('show');
}

function updateFileUploadLabel(input) {
    const label = document.getElementById('file-upload-label');
    if (!label) return;
    if (input.files && input.files.length > 0) {
        label.textContent = ' ' + input.files[0].name;
        label.style.color = 'var(--primary)';
    } else {
        label.textContent = ' Click to upload PDF';
        label.style.color = '';
    }
}

// Close modal when clicking outside content
window.addEventListener('click', function (event) {
    const modal = document.getElementById('submit-doc-modal');
    if (event.target === modal) {
        closeSubmitModal();
    }
    const reviewCommentModal = document.getElementById('review-comment-modal');
    if (event.target === reviewCommentModal) {
        closeReviewerNoteModal();
    }
});

// --- REPOSITORY & SUBMIT LOGIC ---

// New Context-Aware Filter State
let currentDocFilter = 'All';

// Separate Filter States
let docsDateFilter = { from: null, to: null };
let repoDateFilter = { from: null, to: null };

let currentDateContext = 'docs'; // 'docs' or 'repo'
let selectedFromDate = null;
let selectedToDate = null;
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();

// --- DATE PICKER LOGIC ---

function openDatePicker(context = 'docs') {
    currentDateContext = context;
    const modal = document.getElementById('date-picker-modal');
    modal.classList.add('active');

    // Load existing state for the context
    if (context === 'docs') {
        selectedFromDate = docsDateFilter.from;
        selectedToDate = docsDateFilter.to;
    } else if (context === 'repo') {
        selectedFromDate = repoDateFilter.from;
        selectedToDate = repoDateFilter.to;
    }

    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function closeDatePicker() {
    document.getElementById('date-picker-modal').classList.remove('active');
}

function renderCalendar(month, year) {
    const grid = document.getElementById('calendar-grid'); // Now targets .calendar-dates
    grid.innerHTML = '';

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendar-month-year').innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        grid.appendChild(div);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const div = document.createElement('div');
        div.className = 'calendar-date';
        div.innerText = i;
        div.onclick = () => selectDate(date);

        // Styling selection
        if (selectedFromDate && date.getTime() === selectedFromDate.getTime()) div.classList.add('selected');
        if (selectedToDate && date.getTime() === selectedToDate.getTime()) div.classList.add('selected');
        if (selectedFromDate && selectedToDate && date > selectedFromDate && date < selectedToDate) div.classList.add('in-range');

        grid.appendChild(div);
    }
}

function changeCalendarMonth(step) {
    calendarCurrentMonth += step;
    if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    } else if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    }
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function selectDate(date) {
    if (!selectedFromDate || (selectedFromDate && selectedToDate)) {
        selectedFromDate = date;
        selectedToDate = null;
    } else {
        if (date < selectedFromDate) {
            selectedToDate = selectedFromDate;
            selectedFromDate = date;
        } else {
            selectedToDate = date;
        }
    }
    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function updateDateRangeDisplay() {
    const fromDisplay = document.getElementById('date-from-display');
    const toDisplay = document.getElementById('date-to-display');

    if (selectedFromDate) fromDisplay.innerText = selectedFromDate.toLocaleDateString();
    else fromDisplay.innerText = 'Select Date';

    if (selectedToDate) toDisplay.innerText = selectedToDate.toLocaleDateString();
    else toDisplay.innerText = 'Select Date';
}

function clearDateRange() {
    selectedFromDate = null;
    selectedToDate = null;
    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function applyDateRange() {
    if (!selectedFromDate || !selectedToDate) {
        alert('Please select a valid date range.');
        return;
    }

    const fromStr = selectedFromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const toStr = selectedToDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const labelText = `${fromStr} - ${toStr}`;

    if (currentDateContext === 'docs') {
        docsDateFilter.from = selectedFromDate;
        docsDateFilter.to = selectedToDate;

        const dateBtn = document.querySelector('#documents .date-range-btn');
        const label = document.getElementById('docs-date-range-label');
        if (label) label.innerText = labelText;
        if (dateBtn) dateBtn.classList.add('active');

        renderDocs(currentDocFilter);

    } else if (currentDateContext === 'repo') {
        repoDateFilter.from = selectedFromDate;
        repoDateFilter.to = selectedToDate;

        const dateBtn = document.querySelector('#docs-repository-view .date-range-btn');
        const label = document.getElementById('repo-date-range-label');
        if (label) label.innerText = labelText;
        if (dateBtn) dateBtn.classList.add('active');

        renderRepoTable();
    }

    closeDatePicker();
    // Assuming showToast is similar to alert for now, or use alert if showToast not defined
    // alert('Date filter applied'); 
}


function renderRecentDocs() {
    const list = document.getElementById('recent-docs-list');
    if (!list) return;

    // Take only the first 3 items for the sidebar
    const recentItems = getOfficerScopedDocs().slice(0, 3);

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
    const sscOfficers = ["Pres. Cruz", "VP Santos", "Sec. Reyes"];
    const osaAdmins = ["Dir. Fury", "Mrs. Potts", "Admin Stark"];

    // 1. Filter by Status (Existing Logic)
    let filteredData = getOfficerScopedDocs().filter(doc => {
        if (filter === 'All') return true;
        if (filter === 'Pending') return doc.status.includes('Sent') || doc.status.includes('Pending') || doc.status === 'SSC Approved';
        return doc.status.includes(filter);
    });

    // 2. Filter by Date Range (Updated)
    const { from, to } = docsDateFilter;

    if (from && to) {
        filteredData = filteredData.filter(doc => {
            const docDate = doc.submittedAt ? new Date(doc.submittedAt) : new Date(`${doc.date}, 2026`);

            // Normalize times for accurate comparison
            const checkDate = new Date(docDate.setHours(0, 0, 0, 0));
            const fromDate = new Date(from);
            const toDate = new Date(to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);

            return checkDate >= fromDate && checkDate <= toDate;
        });
    }

    if (filteredData.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted); grid-column: 1/-1;">No documents match these filters.</div>`;
        if (typeof refreshAnalyticsCharts === 'function') {
            refreshAnalyticsCharts();
        }
        return;
    }

    list.innerHTML = filteredData.map((doc, index) => {
        // --- WORKFLOW LOGIC ---
        let sscHtml = '';
        let osaHtml = '';
        let actionButtons = '';
        let statusBadge = '';

        const sender = doc.submittedByName || `User #${doc.submittedByUserId ?? 'N/A'}`;
        const sscOfficer = sscOfficers[doc.title.length % sscOfficers.length];
        const osaAdmin = osaAdmins[doc.title.length % osaAdmins.length];
        const reviewNoteButton = (doc.status === 'Approved' && doc.reviewerNotes)
            ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openReviewerNoteModal('${encodeURIComponent(doc.reviewerNotes)}')">
                    <i class="fa-regular fa-message"></i> Comment
                </button>`
            : '';

        if (doc.status === 'Approved') {
            // Both Approved
            sscHtml = `<span>${sscOfficer}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            osaHtml = `<span>${osaAdmin}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>`;
            actionButtons = `
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId}')">
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
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId}')">
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
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>`;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Pending</span>';
        }

        return `
        <div class="list-item" onclick="openPdfViewer('${doc.viewerId}')">
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
                    ${reviewNoteButton}
                </div>
            </div>
        </div>`;
    }).join('');

    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts();
    }
}

// Helper: Clear filters
// Helper: Clear filters
function resetDateFilters() {
    // Reset State
    docsDateFilter.from = null;
    docsDateFilter.to = null;

    // Reset UI
    const dateBtn = document.querySelector('#documents .date-range-btn');
    const label = document.getElementById('docs-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

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

function formatAnnouncementDate(dateString) {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderAnnouncements() {
    const feed = document.getElementById('announcement-feed');
    if (!feed) return;
    if (!announcementsData.length) {
        feed.innerHTML = `<div style="padding: 12px; color: var(--muted);">No announcements yet.</div>`;
        return;
    }
    feed.innerHTML = getOfficerScopedAnnouncements().map(ann => `
        <div class="announcement-card">
            <div class="announcement-meta">
                <strong>${ann.title}</strong>
                <span>${formatAnnouncementDate(ann.date)}</span>
            </div>
            <p style="font-size: 0.9rem;">${ann.content}</p>
        </div>
    `).join('');
}

function toggleEventSyncFields() {
    const checkbox = document.getElementById('sync-event');
    const container = document.getElementById('event-sync-fields');
    if (!checkbox || !container) return;
    container.style.display = checkbox.checked ? 'block' : 'none';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function fetchAnnouncementsFromApi() {
    try {
        const res = await fetch('../api/announcements/list.php', { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Failed to load announcements');
        announcementsData = (data.items || []).map(item => ({
            id: item.announcement_id,
            title: item.title,
            content: item.content,
            audience_type: item.audience_type,
            date: item.published_at || item.created_at,
            org: getActiveOfficerOrgName(),
            org_id: item.org_id
        }));
        renderAnnouncements();
    } catch (err) {
        console.error('Failed to load announcements', err);
    }
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

async function handleDocSubmit(e) {
    e.preventDefault();

    const fileInput = document.getElementById('doc-file-input');
    const file = fileInput?.files?.[0] || null;
    const recipient = document.getElementById('doc-recipient').value;
    const type = document.getElementById('doc-type').value;
    const title = (e.currentTarget.querySelector('input[type="text"]')?.value || '').trim();
    const description = (e.currentTarget.querySelector('textarea')?.value || '').trim();
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const month = new Date().getMonth();
    const semester = (month >= 7 && month <= 11) ? '1st' : '2nd';

    if (!title) {
        alert('Title is required.');
        return;
    }
    if (!file) {
        alert('Please attach a PDF file.');
        return;
    }

    try {
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        const uploadRes = await fetch('../api/documents/upload.php', {
            method: 'POST',
            credentials: 'same-origin',
            body: uploadForm
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.ok || !uploadData.file_url) {
            throw new Error(uploadData.error || 'Failed to upload file.');
        }

        const res = await fetch('../api/documents/submit.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                title,
                document_type: type,
                recipient,
                description,
                semester,
                academic_year: academicYear,
                file_url: uploadData.file_url
            })
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to submit document.');
        }
        await loadDocsFromApi();
        e.target.reset();
        closeSubmitModal();
        alert(`Document successfully sent to ${recipient}.`);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Failed to submit document.');
    }
}

function formatTimeRange(start, end) {
    if (!start || !end) return '';
    return `${start} - ${end}`;
}

async function postAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;
    const audience = document.getElementById('ann-audience') ? document.getElementById('ann-audience').value : 'all_students';
    const syncEvent = document.getElementById('sync-event').checked; // Get checkbox state
    const eventDate = document.getElementById('event-date')?.value || '';
    const eventTimeStart = (document.getElementById('event-time-start')?.value || '').trim();
    const eventTimeEnd   = (document.getElementById('event-time-end')?.value || '').trim();
    const eventTimeRange = formatTimeRange(eventTimeStart, eventTimeEnd);
    const eventLocation = document.getElementById('event-location')?.value || '';
    const eventPhotoFile = document.getElementById('event-photo')?.files?.[0];
    let eventPhotoDataUrl = '';

    if (syncEvent) {
        if (!eventDate || !eventTimeStart || !eventTimeEnd) {
            alert('Please select Event Date, Start Time, and End Time.');
            return;
        }
        if (eventPhotoFile) {
            try {
                eventPhotoDataUrl = await readFileAsDataUrl(eventPhotoFile);
            } catch (err) {
                console.error('Failed to read event photo', err);
                alert('Could not read the event photo. Please try another image.');
                return;
            }
        }
    }

    try {
        const res = await fetch('../api/announcements/create.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                title,
                content,
                audience_type: audience,
                publish: true
            })
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to post announcement');
        }

        const item = data.item || {};
        announcementsData.unshift({
            id: item.announcement_id || null,
            title: item.title || title,
            content: item.content || content,
            audience_type: item.audience_type || audience,
            date: item.published_at || item.created_at || new Date().toISOString(),
            org: getActiveOfficerOrgName(),
            org_id: item.org_id || (readAuthSession().active_org_id || 0)
        });
        renderAnnouncements();

        // 2. CROSS-POSTING LOGIC
        if (syncEvent) {
            const eventsFrame = document.querySelector('#events iframe');
            const payload = {
                type: 'CREATE_EVENT',
                eventName: title,
                description: content,
                date: eventDate || new Date().toISOString().split('T')[0],
                time: eventTimeRange || eventTimeStart,
                location: eventLocation || 'TBA',
                photo: eventPhotoDataUrl
            };

            const sendToEventsFrame = () => {
                try {
                    eventsFrame.contentWindow.postMessage(payload, '*');
                    alert(`Announcement Posted & Event "${title}" created in Attendance System!`);
                } catch (_err) {
                    alert("Announcement posted, but could not sync to Events tab (Frame not loaded).");
                }
            };

            if (eventsFrame) {
                // Ensure iframe is loaded before posting
                if (eventsFrame.contentWindow && eventsFrame.contentDocument?.readyState === 'complete') {
                    sendToEventsFrame();
                } else {
                    eventsFrame.addEventListener('load', sendToEventsFrame, { once: true });
                    // If src is empty, set it to events page to trigger load
                    if (!eventsFrame.src) {
                        eventsFrame.src = "../pages/qr-attendance/events.php";
                    }
                }
            } else {
                alert("Announcement posted, but Events frame is missing.");
            }
        } else {
            alert("Announcement Posted!");
        }

    } catch (error) {
        console.error(error);
        alert(error.message || 'Failed to post announcement. Please try again.');
    }

    e.target.reset();
}

function returnItem(index) {
    const scopedRentals = getOfficerScopedRentals();
    const item = scopedRentals[index];
    if (!item) return;
    if (confirm(`Mark ${item.item} as returned by ${item.renter}?`)) {
        const absoluteIndex = rentalsData.findIndex(r => r.item === item.item && r.renter === item.renter && r.due === item.due);
        if (absoluteIndex > -1) rentalsData.splice(absoluteIndex, 1);
        renderRentals(); // Re-render both tables
    }
}

function viewAllRentals() {
    // 1. Switch to the Services Tracker tab
    navigate('tracker');
    switchTrackerSubView('rentals');

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
        eventsFrame.src = "../pages/qr-attendance/events.php";
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
    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts(value, type);
    }
    window.dispatchEvent(new Event('resize'));
    return;

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
    getOfficerScopedRentals().forEach(item => {
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

    const rentalBody = getOfficerScopedRentals().map(item => [item.item, item.renter, item.due, item.status]);

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

function formatAnalyticsExportDateLabel(exportRange, fallbackLabel) {
    if (!exportRange || (!exportRange.startDate && !exportRange.endDate)) {
        return fallbackLabel;
    }

    if (exportRange.startDate && !exportRange.endDate) {
        const todayKey = formatLocalDateKey(new Date());
        if (exportRange.startDate === todayKey) return 'Today';
        return new Date(`${exportRange.startDate}T00:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    const start = exportRange.startDate
        ? new Date(`${exportRange.startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '...';
    const end = exportRange.endDate
        ? new Date(`${exportRange.endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '...';
    return `${start} - ${end}`;
}

function getReportMetadata(options = {}) {
    const filterYear = document.getElementById('filter-year');
    const analyticsDate = document.getElementById('analytics-date');
    const filterMonth = document.getElementById('filter-month');
    const exportRange = options.exportRange || null;

    const year = filterYear ? filterYear.value : 'Unknown Year';
    const dayInput = analyticsDate ? analyticsDate.value : '';
    const monthInput = filterMonth ? filterMonth.value : '';

    let dateLabel = `Academic Year ${year}`;
    if (dayInput) {
        dateLabel = new Date(`${dayInput}T00:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    } else if (monthInput) {
        const dateObj = new Date(`${monthInput}-01`);
        dateLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    return {
        year,
        dayInput,
        monthInput,
        dateLabel: formatAnalyticsExportDateLabel(exportRange, dateLabel),
        exportRange,
        organization: typeof getActiveOfficerOrgName === 'function' ? getActiveOfficerOrgName() : 'Organization'
    };
}

function getAnalyticsExportFileStem(meta) {
    const rangeScope = meta.exportRange && (meta.exportRange.startDate || meta.exportRange.endDate)
        ? `${meta.exportRange.startDate || 'start'}_${meta.exportRange.endDate || 'end'}`
        : null;
    const scope = rangeScope || meta.dayInput || meta.monthInput || meta.year || 'summary';
    const safeOrg = String(meta.organization || 'Organization').replace(/[^a-z0-9]+/gi, '_');
    const safeScope = String(scope).replace(/[^a-z0-9]+/gi, '_');
    return `${safeOrg}_Analytics_${safeScope}`;
}

function escapeCsvValue(value) {
    const stringValue = String(value ?? '');
    if (/[",\r\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function buildAnalyticsCsvRows(meta, report) {
    const rows = [
        ['ORGANIZATION ANALYTICS REPORT'],
        ['Organization', meta.organization],
        ['Generated On', new Date().toLocaleString()],
        ['Academic Year', meta.year],
        ['Period Covered', meta.dateLabel],
        [],
        ['SUMMARY'],
        ['Metric', 'Value', 'Notes'],
        ['Total Revenue', formatOfficerPeso(report.totals.revenue), String(report.summaries.revenueTrend).replace(/<[^>]+>/g, '')],
        ['Average Attendance', report.totals.participationAverage, report.summaries.participation],
        ['Total Event Participants', report.totals.participationTotal, `${report.events.length} event(s)`],
        ['Active Rentals', report.counts.rentals.active, 'Inventory utilization'],
        ['Pending Rentals', report.counts.rentals.pending, 'Inventory utilization'],
        ['Overdue Rentals', report.counts.rentals.overdue, 'Inventory utilization'],
        ['Approved Documents', report.counts.docs.approved, 'Document workflow'],
        ['Pending Documents', report.counts.docs.pending, 'Document workflow'],
        ['Rejected Documents', report.counts.docs.rejected, 'Document workflow'],
        [],
        ['REVENUE SERIES'],
        ['Period', 'Revenue'],
    ];

    if (report.charts.revenue.labels.length && !(report.charts.revenue.labels.length === 1 && report.charts.revenue.labels[0] === 'No revenue data')) {
        report.charts.revenue.labels.forEach((label, index) => {
            rows.push([label, formatOfficerPeso(report.charts.revenue.values[index] || 0)]);
        });
    } else {
        rows.push(['No revenue data', formatOfficerPeso(0)]);
    }

    rows.push([]);
    rows.push(['EVENT PARTICIPATION']);
    rows.push(['Event', 'Date', 'Participants', 'Venue']);
    if (report.events.length) {
        report.events.forEach((event) => {
            rows.push([
                event.title || 'Event',
                event.date || '-',
                Number(event.participants || 0),
                event.venue || '-'
            ]);
        });
    } else {
        rows.push(['No event records', '', '', '']);
    }

    rows.push([]);
    rows.push(['FINANCIAL TRANSACTIONS']);
    rows.push(['Date', 'Service', 'Item', 'Customer', 'Total', 'Payment']);
    if (report.financial.length) {
        report.financial.forEach((item) => {
            rows.push([
                formatOfficerFinancialDate(getOfficerFinancialDateValue(item)),
                getOfficerFinancialServiceLabel(item.service_type),
                getOfficerFinancialItemDisplayLabel(item),
                item.customer_name || '-',
                formatOfficerPeso(item.total_cost || 0),
                String(item.payment_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid',
            ]);
        });
    } else {
        rows.push(['No financial transactions', '', '', '', '', '']);
    }

    rows.push([]);
    rows.push(['RENTAL RECORDS']);
    rows.push(['Item', 'Borrower', 'Due Date', 'Status']);
    if (report.rentals.length) {
        report.rentals.forEach((item) => {
            rows.push([item.item || '-', item.renter || '-', item.due || '-', item.status || '-']);
        });
    } else {
        rows.push(['No rental records', '', '', '']);
    }

    rows.push([]);
    rows.push(['DOCUMENT WORKFLOW']);
    rows.push(['Title', 'Type', 'Submitted', 'Status']);
    if (report.docs.length) {
        report.docs.forEach((item) => {
            rows.push([item.title || '-', item.type || '-', item.date || '-', item.status || '-']);
        });
    } else {
        rows.push(['No document records', '', '', '']);
    }

    return rows;
}

function exportCSV(options = {}) {
    const meta = getReportMetadata(options);
    const report = typeof getOfficerAnalyticsReportData === 'function'
        ? getOfficerAnalyticsReportData({ exportRange: meta.exportRange })
        : null;
    if (!report) {
        alert('Analytics data is not ready yet.');
        return;
    }

    const csvRows = buildAnalyticsCsvRows(meta, report);
    const csvContent = csvRows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getAnalyticsExportFileStem(meta)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportPDF(options = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF export library is unavailable.');
        return;
    }

    const meta = getReportMetadata(options);
    const report = typeof getOfficerAnalyticsReportData === 'function'
        ? getOfficerAnalyticsReportData({ exportRange: meta.exportRange })
        : null;
    if (!report) {
        alert('Analytics data is not ready yet.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(0, 33, 71);
    doc.text('Organization Analytics Report', 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(`Organization: ${meta.organization}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
    doc.text(`Period: ${meta.dateLabel} | A.Y. ${meta.year}`, 14, 38);

    doc.autoTable({
        startY: 46,
        head: [['Metric', 'Value', 'Notes']],
        body: [
            ['Total Revenue', formatOfficerPeso(report.totals.revenue), String(report.summaries.revenueTrend).replace(/<[^>]+>/g, '')],
            ['Average Attendance', String(report.totals.participationAverage), report.summaries.participation],
            ['Total Participants', String(report.totals.participationTotal), `${report.events.length} event(s)`],
            ['Active Rentals', String(report.counts.rentals.active), 'Inventory utilization'],
            ['Pending Rentals', String(report.counts.rentals.pending), 'Inventory utilization'],
            ['Overdue Rentals', String(report.counts.rentals.overdue), 'Inventory utilization'],
            ['Approved Docs', String(report.counts.docs.approved), 'Document workflow'],
            ['Pending Docs', String(report.counts.docs.pending), 'Document workflow'],
            ['Rejected Docs', String(report.counts.docs.rejected), 'Document workflow'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 33, 71] },
        styles: { fontSize: 9, cellPadding: 3 },
    });

    let currentY = (doc.lastAutoTable?.finalY || 46) + 10;
    doc.setFontSize(12);
    doc.setTextColor(0, 33, 71);
    doc.text('Revenue Series', 14, currentY);
    doc.autoTable({
        startY: currentY + 4,
        head: [['Period', 'Revenue']],
        body: (report.charts.revenue.labels.length && !(report.charts.revenue.labels.length === 1 && report.charts.revenue.labels[0] === 'No revenue data'))
            ? report.charts.revenue.labels.map((label, index) => [label, formatOfficerPeso(report.charts.revenue.values[index] || 0)])
            : [['No revenue data', formatOfficerPeso(0)]],
        theme: 'striped',
        headStyles: { fillColor: [0, 33, 71] },
        styles: { fontSize: 9 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    doc.text('Event Participation', 14, currentY);
    doc.autoTable({
        startY: currentY + 4,
        head: [['Event', 'Date', 'Participants', 'Venue']],
        body: report.events.length
            ? report.events.map((event) => [
                event.title || 'Event',
                event.date || '-',
                String(Number(event.participants || 0)),
                event.venue || '-',
            ])
            : [['No event records', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 9 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    doc.text('Financial Transactions', 14, currentY);
    doc.autoTable({
        startY: currentY + 4,
        head: [['Date', 'Service', 'Item', 'Customer', 'Total', 'Payment']],
        body: report.financial.length
            ? report.financial.map((item) => [
                formatOfficerFinancialDate(getOfficerFinancialDateValue(item)),
                getOfficerFinancialServiceLabel(item.service_type),
                getOfficerFinancialItemDisplayLabel(item),
                item.customer_name || '-',
                formatOfficerPeso(item.total_cost || 0),
                String(item.payment_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid',
            ])
            : [['No financial transactions', '', '', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    doc.text('Rental Records', 14, currentY);
    doc.autoTable({
        startY: currentY + 4,
        head: [['Item', 'Borrower', 'Due Date', 'Status']],
        body: report.rentals.length
            ? report.rentals.map((item) => [item.item || '-', item.renter || '-', item.due || '-', item.status || '-'])
            : [['No rental records', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    doc.text('Document Workflow', 14, currentY);
    doc.autoTable({
        startY: currentY + 4,
        head: [['Title', 'Type', 'Submitted', 'Status']],
        body: report.docs.length
            ? report.docs.map((item) => [item.title || '-', item.type || '-', item.date || '-', item.status || '-'])
            : [['No document records', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [107, 114, 128] },
        styles: { fontSize: 8 },
    });

    doc.save(`${getAnalyticsExportFileStem(meta)}.pdf`);
}

// --- WORKFLOW ACTION: Submit to OSA ---
function submitToOSA(index) {
    if (confirm('Submit this approved document to OSA for final review?')) {
        // Update the document status
        const scopedDocs = getOfficerScopedDocs();
        if (scopedDocs[index]) {
            const absoluteIndex = docsData.findIndex(doc => doc.title === scopedDocs[index].title && doc.date === scopedDocs[index].date);
            if (absoluteIndex > -1) docsData[absoluteIndex].status = "Sent to OSA";
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
    initTrackerSidebarBehavior();
    initializeOfficerFinancialSummaryDefaultDate();
    initializeOfficerPrintingHistoryDefaultDate();
    renderRentals();
    renderDocs();
    renderRecentDocs();
    renderAnnouncements();
    fetchAnnouncementsFromApi();
    loadRentalsFromApi();
    loadDocsFromApi();
    loadRepoFromApi();
    officerOrgSyncPromise
        .catch(() => {})
        .finally(() => {
            loadOfficerPrintingQueue().catch(() => {});
        });
    loadOfficerFinancialSummary().catch(() => {});
    // Initialize repository counts
    if (typeof updateFolderCounts === 'function') {
        updateFolderCounts();
    }
});


// --- DOCUMENT REPOSITORY LOGIC ---

const DOCUMENTS_API_BASE = '../api/documents';

function fmtDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function resolvePdfUrl(fileUrl) {
    if (!fileUrl) return '';
    let raw = String(fileUrl).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('./')) raw = raw.slice(2);
    if (raw.startsWith('../')) raw = raw.slice(3);
    if (!raw.includes('/')) raw = `uploads/documents/${raw}`;
    if (raw.startsWith('documents/')) raw = `uploads/${raw}`;
    if (!raw.startsWith('uploads/')) raw = `uploads/documents/${raw.replace(/^uploads?\/?/i, '')}`;
    return `../${raw}`;
}

async function loadDocsFromApi() {
    try {
        const res = await fetch(`${DOCUMENTS_API_BASE}/list.php`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) return;
        docsData = (data.items || []).map(item => ({
            title: item.title,
            type: item.document_type,
            date: fmtDateShort(item.submitted_at),
            submittedAt: item.submitted_at || null,
            status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
            org: item.org_name || '',
            id: item.submission_id,
            submission_id: item.submission_id,
            fileUrl: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`,
            submittedByUserId: item.submitted_by_user_id,
            submittedByName: [item.submitted_by_first_name, item.submitted_by_last_name]
                .filter(Boolean)
                .join(' ')
                .trim(),
            reviewerNotes: item.reviewer_notes || '',
        }));
        docsData.forEach(doc => {
            if (typeof PDFViewer !== 'undefined' && doc.fileUrl) {
                PDFViewer.registerRemote(doc.viewerId, doc.title, doc.fileUrl, { submissionId: doc.submission_id });
            }
        });
        if (typeof initializeOfficerAnalyticsYearOptions === 'function') {
            initializeOfficerAnalyticsYearOptions();
        }
        renderDocs(currentDocFilter);
        renderRecentDocs();
    } catch (e) {
        console.error('loadDocsFromApi failed', e);
    }
}

async function loadRepoFromApi() {
    try {
        const params = new URLSearchParams();
        const res = await fetch(`${DOCUMENTS_API_BASE}/repository.php?${params.toString()}`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) return;
        repositoryData = (data.items || []).map(item => ({
            id: item.repo_id,
            submission_id: item.submission_id,
            name: item.title,
            category: item.document_type,
            org: item.org_name,
            date: fmtDateShort(item.approved_at),
            approvedAt: item.approved_at || null,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            file_url: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`,
        }));
        repositoryData.forEach(item => {
            if (typeof PDFViewer !== 'undefined' && item.file_url) {
                PDFViewer.registerRemote(item.viewerId, item.name, item.file_url, { submissionId: item.submission_id });
            }
        });
        renderRepoTable();
        updateRepoCategoryDropdown();
    } catch (e) {
        console.error('loadRepoFromApi failed', e);
    }
}

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
        loadRepoFromApi();
    } else {
        statusView.style.display = ''; // Let CSS class (docs-layout grid) take over
        repoView.style.display = 'none';
    }
}

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
        const matchesActiveOrg = officerOrgMatch(item.org);
        if (!matchesActiveOrg) return false;

        // 1. File Type
        const matchesType = filterType === 'All' || item.category === filterType;

        // 2. Search Text
        const matchesSearch = item.name.toLowerCase().includes(searchInput) ||
            item.category.toLowerCase().includes(searchInput);

        // 3. Date Logic (Updated)
        const itemDate = item.approvedAt ? new Date(item.approvedAt) : new Date(item.date);
        let matchesDate = true;

        if (repoDateFilter.from && repoDateFilter.to) {
            const checkDate = new Date(itemDate.setHours(0, 0, 0, 0));
            const fromDate = new Date(repoDateFilter.from);
            const toDate = new Date(repoDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);

            matchesDate = checkDate >= fromDate && checkDate <= toDate;

        } else if (filterSem !== 'all') {
            matchesDate = (item.semester || '').toLowerCase() === filterSem.toLowerCase();
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
                <button class="btn btn-sm btn-outline" onclick="openPdfViewer('${item.viewerId}')">
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
    document.getElementById('repo-search-input').value = '';

    // Reset Date Filter
    repoDateFilter.from = null;
    repoDateFilter.to = null;

    const dateBtn = document.querySelector('#docs-repository-view .date-range-btn');
    const label = document.getElementById('repo-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    renderRepoTable();
    // Assuming showToast exists in your main scripts, otherwise alert
    if (typeof showToast === 'function') showToast('Filters reset', 'info');
}
