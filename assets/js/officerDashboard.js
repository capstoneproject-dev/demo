const AUTH_SESSION_KEY = 'naapAuthSession';
const OFFICER_ACADEMIC_TERM_API = '../api/settings/academic-term.php';
let officerOrgSyncPromise = Promise.resolve();
const DEFAULT_OFFICER_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' rx='75' fill='%23eef2f7'/%3E%3Ccircle cx='75' cy='58' r='27' fill='%23002147' opacity='0.9'/%3E%3Cpath d='M31 130c5.8-25.9 22.8-41 44-41s38.2 15.1 44 41' fill='%23002147' opacity='0.9'/%3E%3C/svg%3E";
const OFFICER_ANNOUNCEMENT_PREVIEW_KEY_PREFIX = 'osaAnnouncementPreview_';
let officerAnnouncementPreviewPayloadCache = undefined;

function isOfficerAnnouncementPreviewMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === '1'
        && params.get('view') === 'announcements'
        && params.get('target') === 'announcement'
        && (params.get('preview_key') || '').startsWith(OFFICER_ANNOUNCEMENT_PREVIEW_KEY_PREFIX);
}

function getOfficerAnnouncementPreviewPayload() {
    if (officerAnnouncementPreviewPayloadCache !== undefined) {
        return officerAnnouncementPreviewPayloadCache;
    }

    if (!isOfficerAnnouncementPreviewMode()) return null;

    const params = new URLSearchParams(window.location.search);
    const previewKey = params.get('preview_key') || '';
    if (!previewKey.startsWith(OFFICER_ANNOUNCEMENT_PREVIEW_KEY_PREFIX)) {
        officerAnnouncementPreviewPayloadCache = null;
        return null;
    }

    try {
        const payload = JSON.parse(localStorage.getItem(previewKey) || 'null');
        localStorage.removeItem(previewKey);
        officerAnnouncementPreviewPayloadCache = payload;
        return payload;
    } catch (_error) {
        officerAnnouncementPreviewPayloadCache = null;
        return null;
    }
}

function readAuthSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function isOrganizationAdviserDocumentReviewer() {
    const session = readAuthSession();
    return session.account_type === 'organization_adviser'
        && session.can_manage_org_dashboard !== true;
}

function canManageOrganizationDashboard() {
    const session = readAuthSession();
    if (session.can_manage_org_dashboard === true || Number(session.can_manage_org_dashboard) === 1) {
        return true;
    }
    if (session.can_manage_org_dashboard === false || Number(session.can_manage_org_dashboard) === 0) {
        return false;
    }
    const activeOrgId = Number(session.active_org_id || 0);
    const activeMembership = Array.isArray(session.officer_memberships)
        ? session.officer_memberships.find((membership) => Number(membership.org_id || 0) === activeOrgId)
        : null;
    return Number(activeMembership?.can_manage_org_dashboard || 0) === 1;
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

let officerProfileEditMode = false;
let officerProfileSnapshot = null;

function getOfficerOrganizationShortName(session = {}) {
    const storedCode = String(session.active_org_code || '').trim();
    if (storedCode) return storedCode.toUpperCase();

    const organizationName = String(session.active_org_name || '').trim();
    const comparableName = organizationName
        .replace(/\s+organization$/i, '')
        .trim()
        .toUpperCase();
    if (typeof ORG_DATA !== 'undefined') {
        const matchedOrganization = Object.entries(ORG_DATA).find(([, organization]) => {
            const fullName = String(organization?.fullName || '')
                .replace(/\s+organization$/i, '')
                .trim()
                .toUpperCase();
            return fullName === comparableName;
        });
        if (matchedOrganization) return String(matchedOrganization[0]).toUpperCase();
    }

    return organizationName || 'Organization';
}

function updateOfficerProfileView(session = readAuthSession()) {
    const fullName = session.display_name || 'Organization Officer';
    const roleLabel = session.active_position_title || session.active_role_name || 'officer';
    const orgLabel = session.active_org_name || 'Organization';
    const headerOrgLabel = getOfficerOrganizationShortName(session);
    window.OrganizationFavicon?.apply({
        code: session.active_org_code || '',
        name: orgLabel
    });
    const studentNumber = session.student_number || session.employee_number || 'N/A';
    const email = session.email || '';
    const phone = session.phone || 'N/A';
    const courseYear = [session.program_code, session.section].filter(Boolean).join(' - ') || 'N/A';
    const profilePhoto = session.profile_photo || DEFAULT_OFFICER_AVATAR;

    const headerName = document.querySelector('.user-info span');
    const headerRole = document.querySelector('.user-info small');
    const headerAvatar = document.getElementById('officerHeaderAvatar');
    const profileAvatar = document.getElementById('officerProfileAvatar');
    if (headerName) headerName.innerText = fullName;
    if (headerRole) headerRole.innerText = `${roleLabel} - ${headerOrgLabel}`;
    if (headerAvatar) headerAvatar.src = profilePhoto;
    if (profileAvatar) profileAvatar.src = profilePhoto;

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
    if (profilePhoneInput) profilePhoneInput.value = phone;
    if (profileCourseYearInput) profileCourseYearInput.value = courseYear;

    const studentPreviewLink = document.getElementById('officerStudentPreviewLink');
    if (studentPreviewLink) {
        const params = new URLSearchParams({
            view: 'organizations',
            org: orgLabel,
            preview: '1'
        });
        studentPreviewLink.href = `studentDashboard.html?${params.toString()}`;
    }

    document.title = `${orgLabel} Officer Dashboard`;
}

function setOfficerProfileEditMode(isEditing) {
    officerProfileEditMode = isEditing;
    const editBtn = document.getElementById('officerProfileEditBtn');
    const cancelBtn = document.getElementById('officerProfileCancelBtn');
    const editableInputs = document.querySelectorAll('#profile [data-editable="true"]');

    editableInputs.forEach((input) => {
        input.readOnly = !isEditing;
    });

    if (editBtn) {
        editBtn.innerHTML = isEditing
            ? '<i class="fa-solid fa-floppy-disk"></i> Save Details'
            : '<i class="fa-solid fa-pen-to-square"></i> Edit Details';
    }
    if (cancelBtn) cancelBtn.hidden = !isEditing;
}

function snapshotOfficerProfileValues() {
    officerProfileSnapshot = {
        full_name: (document.getElementById('officerProfileFullNameInput') || {}).value || '',
        email: (document.getElementById('officerProfileEmailInput') || {}).value || '',
        phone: (document.getElementById('officerProfilePhoneInput') || {}).value || '',
    };
}

function restoreOfficerProfileSnapshot() {
    if (!officerProfileSnapshot) return;
    const nameInput = document.getElementById('officerProfileFullNameInput');
    const emailInput = document.getElementById('officerProfileEmailInput');
    const phoneInput = document.getElementById('officerProfilePhoneInput');
    if (nameInput) nameInput.value = officerProfileSnapshot.full_name;
    if (emailInput) emailInput.value = officerProfileSnapshot.email;
    if (phoneInput) phoneInput.value = officerProfileSnapshot.phone;
}

async function saveOfficerProfileDetails() {
    const fullName = (document.getElementById('officerProfileFullNameInput') || {}).value?.trim() || '';
    const email = (document.getElementById('officerProfileEmailInput') || {}).value?.trim() || '';
    const phone = (document.getElementById('officerProfilePhoneInput') || {}).value?.trim() || '';

    if (!fullName || !email) {
        showToast('Full name and email are required.', 'error');
        return;
    }

    const editBtn = document.getElementById('officerProfileEditBtn');
    if (editBtn) editBtn.disabled = true;

    try {
        const resp = await fetch('../api/officer/profile/update.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                email,
                phone,
            }),
        });
        const data = await resp.json();
        if (!data.ok) {
            showToast(data.error || 'Could not update profile.', 'error');
            return;
        }

        if (data.session) {
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
            updateOfficerProfileView(data.session);
        }
        officerProfileSnapshot = null;
        setOfficerProfileEditMode(false);
        showToast('Profile updated successfully.', 'success');
    } catch (error) {
        console.error('[saveOfficerProfileDetails] error:', error);
        showToast('Could not connect to the server.', 'error');
    } finally {
        if (editBtn) editBtn.disabled = false;
    }
}

function setupOfficerProfileEditor() {
    const editBtn = document.getElementById('officerProfileEditBtn');
    const cancelBtn = document.getElementById('officerProfileCancelBtn');

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!officerProfileEditMode) {
                snapshotOfficerProfileValues();
                setOfficerProfileEditMode(true);
                const firstEditableInput = document.querySelector('#profile [data-editable="true"]');
                if (firstEditableInput) firstEditableInput.focus();
                return;
            }
            await saveOfficerProfileDetails();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            restoreOfficerProfileSnapshot();
            setOfficerProfileEditMode(false);
        });
    }

    setOfficerProfileEditMode(false);
}

function setupOfficerPasswordForm() {
    const passwordForm = document.getElementById('officerPasswordForm');
    if (!passwordForm) return;

    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const currentPassword = (document.getElementById('officerCurrentPasswordInput') || {}).value || '';
        const newPassword = (document.getElementById('officerNewPasswordInput') || {}).value || '';
        const confirmPassword = (document.getElementById('officerConfirmPasswordInput') || {}).value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('All password fields are required.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        const submitBtn = document.getElementById('officerPasswordSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const resp = await fetch('../api/officer/profile/update-password.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword,
                }),
            });
            const data = await resp.json();

            if (!data.ok) {
                showToast(data.error || 'Could not update password.', 'error');
                return;
            }

            passwordForm.reset();
            showToast(data.message || 'Password updated successfully.', 'success');
        } catch (error) {
            console.error('[setupOfficerPasswordForm] error:', error);
            showToast('Could not connect to the server.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

function setupOfficerProfilePhotoUploader() {
    const photoBtn = document.getElementById('officerProfilePhotoBtn');
    const photoInput = document.getElementById('officerProfilePhotoInput');
    if (!photoBtn || !photoInput) return;

    photoBtn.addEventListener('click', () => {
        photoInput.click();
    });

    photoInput.addEventListener('change', async () => {
        const file = photoInput.files && photoInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile_photo', file);
        photoBtn.disabled = true;

        try {
            const resp = await fetch('../api/officer/profile/upload-photo.php', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData,
            });
            const data = await resp.json();
            if (!data.ok) {
                showToast(data.error || 'Could not update profile photo.', 'error');
                return;
            }

            if (data.session) {
                localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
                updateOfficerProfileView(data.session);
            } else if (data.photo_url) {
                const session = readAuthSession();
                session.profile_photo = data.photo_url;
                localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
                updateOfficerProfileView(session);
            }

            showToast('Profile photo updated successfully.', 'success');
        } catch (error) {
            console.error('[setupOfficerProfilePhotoUploader] error:', error);
            showToast('Could not connect to the server.', 'error');
        } finally {
            photoInput.value = '';
            photoBtn.disabled = false;
        }
    });
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
            updateOfficerProfileView(data.session);
            if (Array.isArray(docsData)) renderDocs(currentDocFilter);
            document.querySelectorAll('#tracker iframe').forEach((trackerFrame) => {
                if (trackerFrame && trackerFrame.src) {
                    trackerFrame.src = trackerFrame.src;
                }
            });
        })
        .catch(() => { /* keep dashboard usable even if sync fails */ });
}

function initOfficerAuthContext() {
    if (isOfficerAnnouncementPreviewMode()) {
        const payload = getOfficerAnnouncementPreviewPayload();
        const orgLabel = payload?.org || 'Organization';
        window.OrganizationFavicon?.apply({ name: orgLabel });
        const headerName = document.querySelector('.user-info span');
        const headerRole = document.querySelector('.user-info small');
        const profileLink = document.querySelector('.user-profile');
        const pageTitle = document.getElementById('page-title');
        const currentDate = document.getElementById('current-date');
        if (headerName) headerName.textContent = orgLabel;
        if (headerRole) headerRole.textContent = 'OSA Preview';
        if (pageTitle) pageTitle.textContent = 'Announcement Preview';
        if (currentDate) currentDate.textContent = 'View-only organization announcement';
        if (profileLink) profileLink.style.pointerEvents = 'none';
        document.title = `${orgLabel} Announcement Preview`;
        return;
    }

    const session = readAuthSession();
    const isOfficerSession = session && session.login_role === 'org' && session.user_id;
    if (!isOfficerSession) {
        window.location.href = '../pages/login.html';
        return;
    }

    updateOfficerProfileView(session);

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

function applyOfficerEmbeddedNavCenter(frame) {
    if (!frame) return;

    try {
        const frameDocument = frame.contentDocument;
        if (!frameDocument) return;
        frameDocument.getElementById('officer-dashboard-embed-clearance')?.remove();
        let style = frameDocument.getElementById('officer-dashboard-embed-nav-center');

        if (!style) {
            style = frameDocument.createElement('style');
            style.id = 'officer-dashboard-embed-nav-center';
            frameDocument.head.appendChild(style);
        }

        style.textContent = `
            @media (min-width: 992px) {
                .custom-navbar .nav-pills-custom {
                    position: absolute !important;
                    left: 50% !important;
                    margin: 0 !important;
                    transform: translateX(-50%) !important;
                }
            }
        `;
    } catch (_error) {
        // Embedded subsystem pages are same-origin; keep the dashboard usable if a frame is unavailable.
    }
}

function syncOfficerEmbeddedNavCenter() {
    document.querySelectorAll('#events iframe, #tracker-rentals-view iframe').forEach(frame => {
        applyOfficerEmbeddedNavCenter(frame);
    });
}

function setupOfficerEmbeddedNavCenter() {
    document.querySelectorAll('#events iframe, #tracker-rentals-view iframe').forEach(frame => {
        frame.addEventListener('load', () => applyOfficerEmbeddedNavCenter(frame));
        if (frame.contentDocument?.readyState === 'complete') {
            applyOfficerEmbeddedNavCenter(frame);
        }
    });

    window.addEventListener('resize', syncOfficerEmbeddedNavCenter);
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

function resolveOfficerAnnouncementOrgIcon(item) {
    const savedLogo = String(item?.org_logo_url || '').trim();
    if (savedLogo) {
        return /^(https?:)?\/\//i.test(savedLogo) || savedLogo.startsWith('/')
            ? savedLogo
            : `../${savedLogo.replace(/^\/+/, '')}`;
    }

    const iconByCode = {
        SSC: '../assets/photos/studentDashboard/Organization/SSC.png',
        AISERS: '../assets/photos/studentDashboard/Organization/AISERS.png',
        ELITECH: '../assets/photos/studentDashboard/Organization/ELITECH.png',
        ILASSO: '../assets/photos/studentDashboard/Organization/ILASSO.png',
        'AERO-ATSO': '../assets/photos/studentDashboard/Organization/AEROATSO.png',
        AETSO: '../assets/photos/studentDashboard/Organization/AET.png',
        AMTSO: '../assets/photos/studentDashboard/Organization/AMT.png',
        RCYC: '../assets/photos/studentDashboard/Organization/RCYC.png',
        CYC: '../assets/photos/studentDashboard/Organization/CYC.png',
        SCHOLARS: '../assets/photos/studentDashboard/Organization/PSG.png',
        AERONAUTICA: '../assets/photos/studentDashboard/Organization/AERONAUTICA.png'
    };
    const orgCode = String(item?.org_code || '').trim().toUpperCase();
    return iconByCode[orgCode] || '';
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

function isActiveOfficerSscOrganization() {
    const session = readAuthSession();
    const activeName = normalizeOfficerOrgName(session.active_org_name || '');
    const activeCode = String(session.active_org_code || '').trim().toUpperCase();
    return activeCode === 'SSC' || activeName === 'SUPREME STUDENT COUNCIL' || activeName === 'SSC';
}

function isOfficerDocumentVisibleToActiveOrg(item) {
    if (officerOrgMatch(item?.orgId || item?.org)) return true;
    return isActiveOfficerSscOrganization()
        && String(item?.recipient || '').trim().toUpperCase() === 'SSC';
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
    return docsData.filter(item => isOfficerDocumentVisibleToActiveOrg(item));
}

function getOfficerScopedAnnouncements() {
    return announcementsData.filter(item => officerOrgMatch(item.org));
}

function setActiveRentalsCount(count) {
    const countEl = document.getElementById('active-rentals-count');
    if (countEl) {
        countEl.innerText = String(Number(count) || 0);
        return;
    }

    const activeRentalsCard = Array.from(document.querySelectorAll('.stat-card .stat-info p'))
        .find(p => (p.textContent || '').trim() === 'Active Rentals');
    const fallbackCountEl = activeRentalsCard ? activeRentalsCard.parentElement.querySelector('h3') : null;
    if (fallbackCountEl) fallbackCountEl.innerText = String(Number(count) || 0);
}

let officerDashboardRefreshTimer = null;
const OFFICER_DASHBOARD_REFRESH_FAST_MS = 5000;
const OFFICER_DASHBOARD_REFRESH_SLOW_MS = 30000;
let officerDashboardRequest = null;
let officerDashboardMockPreviewActive = false;

function setDashboardText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatDashboardCurrency(value) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}

function formatDashboardRelativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const ranges = [
        ['year', 31536000], ['month', 2592000], ['week', 604800],
        ['day', 86400], ['hour', 3600], ['minute', 60],
    ];
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, size] of ranges) {
        if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
    }
    return 'just now';
}

let officerActionCenterRequest = null;
let officerActionCenterItems = new Map();
let officerActionCenterPreviousFocus = null;

function getOfficerActionCenterIcon(category) {
    const icons = {
        rental: 'fa-boxes-stacked',
        printing: 'fa-print',
        locker: 'fa-door-closed',
        document: 'fa-file-circle-exclamation',
        event: 'fa-calendar-day',
    };
    return icons[String(category || '').toLowerCase()] || 'fa-circle-info';
}

function renderOfficerActionCenterSection(title, items, emptyMessage, totalCount = null) {
    const safeItems = Array.isArray(items) ? items : [];
    const visibleTotal = totalCount === null ? safeItems.length : Math.max(safeItems.length, Number(totalCount) || 0);
    const countLabel = visibleTotal > safeItems.length ? `${safeItems.length} of ${visibleTotal}` : String(visibleTotal);
    return `
        <section class="notif-section" aria-label="${escapeHtml(title)}">
            <div class="notif-section-heading">
                <h3>${escapeHtml(title)}</h3>
                <span class="notif-section-count">${countLabel}</span>
            </div>
            ${safeItems.length ? safeItems.map((item) => `
                <button type="button" class="notif-item" data-notification-key="${escapeHtml(item.key || '')}"
                    data-severity="${escapeHtml(item.severity || 'info')}">
                    <span class="notif-item-icon">
                        <i class="fa-solid ${getOfficerActionCenterIcon(item.category)}"></i>
                    </span>
                    <span class="notif-item-copy">
                        <strong>${escapeHtml(item.title || 'Operational update')}</strong>
                        <p>${escapeHtml(item.summary || '')}</p>
                        <small>${escapeHtml(formatDashboardRelativeTime(item.occurred_at))} · ${escapeHtml(formatDashboardStatus(item.status))}</small>
                    </span>
                    <i class="fa-solid fa-chevron-right notif-item-arrow" aria-hidden="true"></i>
                </button>
            `).join('') : `<div class="notif-empty-section">${escapeHtml(emptyMessage)}</div>`}
        </section>
    `;
}

function renderOfficerActionCenter(data) {
    const attentionItems = (Array.isArray(data.attention_items) ? data.attention_items : [])
        .filter((item) => item?.requires_attention !== false && item?.is_resolved !== true);
    const recentItems = Array.isArray(data.recent_items) ? data.recent_items : [];
    const allItems = [...attentionItems, ...recentItems];
    officerActionCenterItems = new Map(allItems.map((item) => [String(item.key || ''), item]));

    const count = attentionItems.length;
    const countEl = document.getElementById('notif-count');
    if (countEl) {
        countEl.textContent = count > 99 ? '99+' : String(count);
        countEl.hidden = count === 0;
        countEl.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'} need attention`);
    }
    const body = document.getElementById('notif-drawer-body');
    if (body) {
        body.innerHTML = [
            renderOfficerActionCenterSection('Needs attention', attentionItems, 'Nothing requires action right now.', count),
            renderOfficerActionCenterSection('Recent activity', recentItems, 'No operational changes in the last seven days.'),
        ].join('');
    }

    const generatedAt = data.generated_at ? new Date(data.generated_at) : new Date();
    const updatedEl = document.getElementById('notif-last-updated');
    if (updatedEl) {
        updatedEl.textContent = Number.isNaN(generatedAt.getTime())
            ? 'Updated just now'
            : `Updated ${generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
}

async function loadOfficerActionCenter(showFeedback = false) {
    if (isOfficerAnnouncementPreviewMode()) return;
    if (officerActionCenterRequest) return officerActionCenterRequest;

    officerActionCenterRequest = (async () => {
        const body = document.getElementById('notif-drawer-body');
        if (showFeedback && body) {
            body.innerHTML = `
                <div class="notif-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Refreshing alerts...</span>
                </div>`;
        }
        try {
            const response = await fetch('../api/officer/notifications/list.php?limit=30', {
                credentials: 'same-origin',
                cache: 'no-store',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Could not load alerts.');
            }
            renderOfficerActionCenter(data);
        } catch (error) {
            console.error('[loadOfficerActionCenter]', error);
            if (body) {
                body.innerHTML = `
                    <div class="notif-state">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <strong>Alerts unavailable</strong>
                        <span>${escapeHtml(error.message || 'Please try again.')}</span>
                        <button type="button" onclick="loadOfficerActionCenter(true)">Try again</button>
                    </div>`;
            }
            if (showFeedback) showToast(error.message || 'Could not refresh alerts.', 'error');
        } finally {
            officerActionCenterRequest = null;
        }
    })();
    return officerActionCenterRequest;
}

function focusOfficerActionCenterItem(target) {
    if (!target) return false;
    target.classList.add('action-center-target');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('action-center-target'), 2600);
    return true;
}

function sendOfficerModuleMessage(frame, payload) {
    if (!frame) return false;
    const send = () => frame.contentWindow?.postMessage(payload, window.location.origin);
    try {
        if (frame.contentDocument?.readyState === 'complete') {
            send();
        } else {
            frame.addEventListener('load', send, { once: true });
            send();
        }
        return true;
    } catch (_error) {
        return false;
    }
}

async function openOfficerActionCenterTarget(item) {
    const target = item?.target || {};
    const entityId = Number(target.entity_id || 0);
    closeNotifs();

    if (!target.view) return;
    if (navigate(target.view) === false) return;

    if (target.action === 'open_printing') {
        switchTrackerSubView('printing');
        try {
            await loadOfficerPrintingQueue();
            if (['claimed', 'cancelled'].includes(String(item.status || '').toLowerCase())) {
                showAllOfficerPrintingHistoryDates();
                showOfficerPrintingHistoryView();
            } else {
                showOfficerPrintingQueueView();
            }
            const row = document.querySelector(`[data-print-job-id="${entityId}"]`);
            if (!focusOfficerActionCenterItem(row)) throw new Error('This printing request is no longer available.');
        } catch (error) {
            showToast(error.message || 'Could not open the printing request.', 'error');
            loadOfficerActionCenter();
        }
        return;
    }

    if (target.action === 'open_locker') {
        switchTrackerSubView('lockers');
        try {
            await loadOfficerLockerBoard(true);
            const locker = officerLockerBoard.find((entry) =>
                Number(entry.current_request?.rental_id || 0) === entityId
                || String(entry.locker_code || '') === String(target.item_label || '')
            );
            if (!locker) throw new Error('This locker request is no longer available.');
            const tile = Array.from(document.querySelectorAll('.locker-tile')).find((entry) =>
                entry.textContent.includes(String(locker.locker_code || ''))
            );
            focusOfficerActionCenterItem(tile);
            openLockerDetail(locker.locker_code);
        } catch (error) {
            showToast(error.message || 'Could not open the locker request.', 'error');
            loadOfficerActionCenter();
        }
        return;
    }

    if (target.action === 'open_document') {
        await loadDocsFromApi();
        const documentItem = docsData.find((entry) => Number(entry.submission_id) === entityId);
        if (!documentItem) {
            showToast('This document is no longer available.', 'error');
            loadOfficerActionCenter();
            return;
        }
        const card = document.querySelector(`[data-submission-id="${entityId}"]`);
        focusOfficerActionCenterItem(card);
        openPdfViewer(documentItem.viewerId);
        return;
    }

    if (target.action === 'open_event') {
        const frame = document.querySelector('#events iframe');
        if (!sendOfficerModuleMessage(frame, {
            type: 'OPEN_EVENT_DETAILS',
            eventId: entityId,
            eventName: target.entity_name || '',
        })) {
            showToast('The Events tab could not be reached.', 'error');
        }
        return;
    }

    if (target.action === 'open_rental') {
        if (!switchTrackerSubView('rentals')) {
            showToast('Rentals are disabled for this organization.', 'error');
            return;
        }
        const frame = document.querySelector('#tracker-rentals-view iframe');
        if (['returned', 'cancelled'].includes(String(item.status || '').toLowerCase()) && frame) {
            frame.src = `../pages/igp/rental-history.php?action_center_rental_id=${entityId}`;
            return;
        }
        if (!sendOfficerModuleMessage(frame, {
            type: 'OPEN_RENTAL_RECORD',
            rentalId: entityId,
        })) {
            showToast('The Rentals tab could not be reached.', 'error');
        }
    }
}

function formatDashboardStatus(status) {
    return String(status || 'active')
        .replace(/^locker_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function renderOfficerDashboard(data) {
    const revenue = data.revenue || {};
    setDashboardText('dashboard-revenue-value', formatDashboardCurrency(revenue.current));
    setDashboardText('dashboard-revenue-period', `Revenue (${revenue.period || 'Current month'})`);
    const revenueChange = document.getElementById('dashboard-revenue-change');
    if (revenueChange) {
        const change = revenue.change_percent;
        if (change === null || change === undefined) {
            revenueChange.textContent = 'N/A';
            revenueChange.style.color = 'var(--muted)';
        } else {
            const numericChange = Number(change) || 0;
            const icon = numericChange > 0 ? 'fa-arrow-up' : numericChange < 0 ? 'fa-arrow-down' : 'fa-minus';
            revenueChange.innerHTML = `<i class="fa-solid ${icon}"></i> ${Math.abs(numericChange).toFixed(1)}%`;
            revenueChange.style.color = numericChange > 0 ? '#059669' : numericChange < 0 ? '#dc2626' : 'var(--muted)';
        }
    }

    const participation = data.participation || {};
    const participationValue = document.getElementById('dashboard-participation-value');
    if (participationValue) {
        const growth = participation.growth_percent;
        participationValue.textContent = growth === null || growth === undefined
            ? 'N/A'
            : `${Number(growth) > 0 ? '+' : ''}${Number(growth).toFixed(1)}%`;
        participationValue.style.color = Number(growth) > 0
            ? '#059669'
            : Number(growth) < 0 ? '#dc2626' : 'var(--muted)';
    }
    if (participation.latest_event) {
        const eventDate = new Date(participation.latest_event_date);
        const shortDate = Number.isNaN(eventDate.getTime())
            ? ''
            : eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setDashboardText('dashboard-participation-event', `${participation.latest_event}${shortDate ? ` (${shortDate})` : ''}`);
    } else {
        setDashboardText('dashboard-participation-event', 'Waiting for two completed events');
    }

    const documents = data.documents || {};
    setDashboardText('dashboard-document-period', `(${documents.period || 'Current month'})`);
    setDashboardText('dashboard-doc-pending', documents.pending || 0);
    setDashboardText('dashboard-doc-accepted', documents.approved || 0);
    setDashboardText('dashboard-doc-rejected', documents.rejected || 0);

    const services = data.active_services || {};
    const serviceItems = Array.isArray(services.items) ? services.items : [];
    setActiveRentalsCount(services.count || 0);
    const table = document.getElementById('dashboard-rentals-table');
    if (table) {
        table.innerHTML = serviceItems.length ? serviceItems.map(item => `
            <tr>
                <td>${escapeHtml(
                    String(item.service_type || '').toLowerCase() === 'printing'
                        ? 'Printing Service'
                        : (item.item || item.service_type || '-')
                )}</td>
                <td>${escapeHtml(item.borrower || '-')}</td>
                <td>${escapeHtml(fmtDateShort(item.date) || '-')}</td>
                <td><span class="status-badge ${getRentalDashboardStatusClass(item.status)}">${escapeHtml(formatDashboardStatus(item.status))}</span></td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center; color: var(--muted);">No active rentals or services right now.</td></tr>';
    }

    const updates = Array.isArray(data.latest_updates) ? data.latest_updates : [];
    const updatesContainer = document.getElementById('dashboard-latest-updates');
    if (updatesContainer) {
        updatesContainer.innerHTML = updates.length ? updates.map(update => `
            <div class="dash-announcement">
                <h5>${escapeHtml(update.title || 'Untitled')}<small style="font-weight:400; font-size:0.7rem; color:var(--muted);">${escapeHtml(formatDashboardRelativeTime(update.published_at))}</small></h5>
                <p>${escapeHtml(update.content || '')}</p>
            </div>
        `).join('') : '<div style="color:var(--muted);">No published updates yet.</div>';
    }

    const events = Array.isArray(data.upcoming_events) ? data.upcoming_events : [];
    const eventsContainer = document.getElementById('dashboard-upcoming-events');
    if (eventsContainer) {
        eventsContainer.innerHTML = events.length ? events.map(event => {
            const date = new Date(event.event_datetime);
            const validDate = !Number.isNaN(date.getTime());
            return `
                <div class="event-item">
                    <div class="event-date-box">
                        <span class="event-day">${validDate ? date.getDate() : '--'}</span>
                        <span class="event-month">${validDate ? date.toLocaleDateString('en-US', { month: 'short' }) : 'TBA'}</span>
                    </div>
                    <div class="event-details">
                        <h4>${escapeHtml(event.name || 'Untitled Event')}</h4>
                        <p><i class="fa-regular fa-clock"></i> ${validDate ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBA'} • ${escapeHtml(event.location || 'Location TBA')}</p>
                    </div>
                </div>`;
        }).join('') : '<div style="color:var(--muted);">No upcoming published events.</div>';
    }

}

// Temporary dashboard-only preview data. This never calls an API or writes to the database.
// Remove this function and #dashboard-mock-data-btn when the mock preview is no longer needed.
function showOfficerDashboardMockData() {
    const now = new Date();
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pick = (items) => items[randomInt(0, items.length - 1)];
    const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
    const dateAfterDays = (days, hour = 9) => {
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        date.setHours(hour, 0, 0, 0);
        return date.toISOString();
    };
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentRevenue = randomInt(8200, 28500);
    const previousRevenue = randomInt(7000, 26000);
    const revenueChange = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    const previousParticipants = randomInt(80, 220);
    const latestParticipants = randomInt(75, 260);
    const participationChange = ((latestParticipants - previousParticipants) / previousParticipants) * 100;
    const borrowers = ['Maria Santos', 'John Dela Cruz', 'Angela Reyes', 'Mark Villanueva', 'Paolo Garcia', 'Trisha Mendoza'];
    const services = [
        { service_type: 'rental', item: 'Canon EOS 1500D Camera', status: 'active' },
        { service_type: 'rental', item: 'Wireless Microphone Set', status: 'active' },
        { service_type: 'rental', item: 'Projector with HDMI Cable', status: 'reserved' },
        { service_type: 'locker', item: `Locker ${pick(['A', 'B', 'C'])}-${randomInt(1, 30)}`, status: 'locker_active' },
        { service_type: 'printing', item: pick(['Event Program.pdf', 'Organization Report.pdf', 'Activity Proposal.pdf']), status: pick(['queued', 'ready']) },
    ];
    const selectedServices = shuffle(services).slice(0, randomInt(3, 5)).map((service, index) => ({
        ...service,
        borrower: pick(borrowers),
        date: dateAfterDays(randomInt(index, index + 8), randomInt(8, 17)),
    }));
    const updates = shuffle([
        ['General Assembly', 'Mandatory attendance for all members at Room 301. Please bring your IDs.'],
        ['Office Closure', 'Office will be closed due to the university holiday. Operations resume Monday.'],
        ['Volunteer Call', 'Sign up now to join the organization outreach program this weekend.'],
        ['Membership Update', 'Membership verification is now open for all active members.'],
    ]).slice(0, 2).map(([title, content], index) => ({
        id: `mock-update-${index}`,
        title,
        content,
        published_at: dateAfterDays(-randomInt(index, index + 3), randomInt(8, 17)),
    }));
    const eventOptions = shuffle([
        ['Tech Innovation Summit', 'Auditorium A'],
        ['Inter-Org Sports Fest', 'University Oval'],
        ['Leadership Workshop', 'AVR 2'],
        ['Community Outreach', 'Student Center'],
    ]).slice(0, 2);
    officerDashboardMockPreviewActive = true;
    renderOfficerDashboard({
        revenue: { current: currentRevenue, previous: previousRevenue, change_percent: revenueChange, period: monthLabel },
        participation: {
            growth_percent: participationChange,
            latest_event: pick(['General Assembly', 'Leadership Forum', 'Organization Orientation']),
            latest_event_date: dateAfterDays(-randomInt(7, 28)),
            latest_count: latestParticipants,
            previous_count: previousParticipants,
        },
        active_services: {
            count: selectedServices.length,
            items: selectedServices,
        },
        documents: { period: monthLabel, pending: randomInt(0, 8), approved: randomInt(6, 28), rejected: randomInt(0, 4) },
        latest_updates: updates,
        upcoming_events: eventOptions.map(([name, location], index) => ({
            id: `mock-event-${index}`,
            name,
            location,
            event_datetime: dateAfterDays(randomInt(3 + index * 3, 9 + index * 5), randomInt(8, 17)),
        })),
    });
    const button = document.getElementById('dashboard-mock-data-btn');
    if (button) button.innerHTML = '<i class="fa-solid fa-flask"></i> Mock Preview Active';
    showToast('Mock preview shown. Refresh to restore live database data.', 'info');
}

async function loadOfficerDashboard(showFeedback = false) {
    officerDashboardMockPreviewActive = false;
    const mockButton = document.getElementById('dashboard-mock-data-btn');
    if (mockButton) mockButton.innerHTML = '<i class="fa-solid fa-flask"></i> Mock Data';
    if (officerDashboardRequest) return officerDashboardRequest;
    officerDashboardRequest = (async () => {
        try {
            const response = await fetch('../api/officer/dashboard.php', {
                credentials: 'same-origin',
                cache: 'no-store',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard data.');
            renderOfficerDashboard(data);
            if (showFeedback) showToast('Dashboard refreshed.', 'success');
        } catch (error) {
            console.error('[loadOfficerDashboard] error:', error);
            if (showFeedback) showToast(error.message || 'Could not refresh dashboard.', 'error');
        } finally {
            officerDashboardRequest = null;
        }
    })();
    return officerDashboardRequest;
}

function isOfficerMainDashboardActive() {
    return document.getElementById('dashboard')?.classList.contains('active') === true;
}

function getOfficerDashboardRefreshDelay() {
    return document.hidden
        ? OFFICER_DASHBOARD_REFRESH_SLOW_MS
        : OFFICER_DASHBOARD_REFRESH_FAST_MS;
}

function stopOfficerDashboardRealtime() {
    if (!officerDashboardRefreshTimer) return;
    window.clearTimeout(officerDashboardRefreshTimer);
    officerDashboardRefreshTimer = null;
}

function scheduleOfficerDashboardRealtime() {
    stopOfficerDashboardRealtime();
    if (!isOfficerMainDashboardActive() || isOfficerAnnouncementPreviewMode()) return;

    officerDashboardRefreshTimer = window.setTimeout(async () => {
        officerDashboardRefreshTimer = null;
        if (!officerDashboardMockPreviewActive) {
            await Promise.allSettled([
                loadOfficerDashboard(false),
                loadOfficerActionCenter(false)
            ]);
        }
        scheduleOfficerDashboardRealtime();
    }, getOfficerDashboardRefreshDelay());
}

function startOfficerDashboardRealtime({ refreshNow = false } = {}) {
    stopOfficerDashboardRealtime();
    if (!isOfficerMainDashboardActive() || isOfficerAnnouncementPreviewMode()) return;

    if (refreshNow && !officerDashboardMockPreviewActive) {
        Promise.allSettled([
            loadOfficerDashboard(false),
            loadOfficerActionCenter(false)
        ]).finally(scheduleOfficerDashboardRealtime);
        return;
    }
    scheduleOfficerDashboardRealtime();
}

// --- LOGOUT HANDLER ---
async function handleLogout(e) {
    e.preventDefault();
    const preparation = window.NAAPOffline
        ? await window.NAAPOffline.prepareLogout()
        : { proceed: await appConfirm('Are you sure you want to log out?', { title: 'Log out', confirmText: 'Log out' }) };
    if (preparation.proceed) {
        try {
            const response = await fetch('../api/auth/logout.php', { method: 'POST', credentials: 'same-origin' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Logout failed.');
            if (window.NAAPOffline) await window.NAAPOffline.completeLogout(preparation);
            localStorage.removeItem(AUTH_SESSION_KEY);
            window.location.href = '../pages/login.html';
        } catch (error) {
            await appAlert(error.message || 'Could not log out. Please try again.', { type: 'error' });
        }
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
    setupOfficerEmbeddedNavCenter();
    setupOfficerProfileEditor();
    setupOfficerPasswordForm();
    setupOfficerProfilePhotoUploader();
    const cachedServiceAccess = readOfficerServiceAccessCache();
    if (cachedServiceAccess) {
        setOfficerTrackerPrintingAccess(cachedServiceAccess.printing_enabled);
        setOfficerTrackerRentalsAccess(cachedServiceAccess.rentals_enabled, false);
        officerServiceAccessLoaded = true;
    } else {
        setOfficerTrackerRentalsAccess(false, false);
        setOfficerTrackerPrintingAccess(false);
    }
    loadOfficerServiceAccess();

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
        if (navigate('tracker')) {
            switchTrackerSubView('financial-summary');
        }
    }

    if (isOfficerAnnouncementPreviewMode()) {
        setTimeout(openOfficerAnnouncementPreviewFromUrl, 0);
    }
});

// --- NAVIGATION LOGIC ---
function navigate(viewId, element) {
    if (viewId === 'tracker' && !isOfficerServicesTrackerEnabled()) {
        if (officerServiceAccessLoaded) {
            showToast('Services Tracker is disabled for this organization.', 'error');
        }
        return false;
    }
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

    // Refresh analytics charts when navigating to analytics view
    if (viewId === 'analytics' && typeof refreshAnalyticsCharts === 'function') {
        setTimeout(() => {
            refreshAnalyticsCharts();
        }, 100);
    }

    // Fullscreen layout for full-page service views.
    if ((viewId === 'events' || viewId === 'tracker') && mainContent) {
        mainContent.classList.add('tracker-fullscreen');
        window.requestAnimationFrame(syncOfficerEmbeddedNavCenter);
    }

    // 4. Resize charts if Analytics tab is opened
    if (viewId === 'analytics') {
        window.dispatchEvent(new Event('resize'));
    }

    if (viewId !== 'tracker') {
        stopOfficerPrintingAutoRefresh();
    } else {
        loadOfficerServiceAccess(true);
        if (currentTrackerSubView === 'printing' && officerPrintingEnabled) {
            startOfficerPrintingAutoRefresh();
        }
    }

    if (viewId === 'documents') {
        startOfficerDocumentsAutoRefresh({ refreshNow: true });
    } else {
        stopOfficerDocumentsAutoRefresh();
    }

    if (viewId === 'dashboard') {
        startOfficerDashboardRealtime({ refreshNow: !document.hidden });
    } else {
        stopOfficerDashboardRealtime();
    }
    return true;
}

let currentTrackerSubView = 'rentals';
let officerPrintingQueue = [];
let officerPendingPrintRequests = [];
let officerPrintingHistoryFilters = { startDate: null, endDate: null, search: '' };
let currentPrintingPanelView = 'queue';
let officerPrintingQueueIsLoading = true;
let officerPrintingQueueHasLoaded = false;
let officerPrintClaimJobId = 0;
let officerPrintPaymentJobId = 0;
let officerPrintClaimScanTimer = null;
let officerPrintPaymentScanTimer = null;
let officerPrintingCalendarCurrentDate = new Date();
let officerPrintingCalendarSelectedStart = null;
let officerPrintingCalendarSelectedEnd = null;
let officerPrintingEnabled = false;
let officerRentalsEnabled = false;
let officerLockerEnabled = false;
let officerServiceAccessPromise = null;
let officerServiceAccessLoaded = false;
const OFFICER_SERVICE_ACCESS_CACHE_PREFIX = 'naapOfficerServiceAccess:v1:';
let officerFinancialSummaryData = [];
let officerFinancialSummaryFilters = { startDate: null, endDate: null };
let officerFinancialCalendarCurrentDate = new Date();
let officerFinancialCalendarSelectedStart = null;
let officerFinancialCalendarSelectedEnd = null;
let analyticsDateFilters = { startDate: null, endDate: null };
let analyticsCalendarCurrentDate = new Date();
let analyticsCalendarSelectedStart = null;
let analyticsCalendarSelectedEnd = null;
let analyticsExportRequestedFormat = null;
let analyticsExportFilters = { startDate: null, endDate: null };
let analyticsExportCalendarCurrentDate = new Date();
let analyticsExportCalendarSelectedStart = null;
let analyticsExportCalendarSelectedEnd = null;
let analyticsExportInProgress = false;

function setAnalyticsExportLoadingMessage(message) {
    const messageElement = document.getElementById('analyticsExportLoadingMessage');
    if (messageElement) {
        messageElement.textContent = message;
    }
}

function showAnalyticsExportLoading(format) {
    const overlay = document.getElementById('analyticsExportLoadingOverlay');
    const title = document.getElementById('analyticsExportLoadingTitle');
    if (title) {
        title.textContent = `Generating ${String(format || 'report').toUpperCase()} export`;
    }
    setAnalyticsExportLoadingMessage('Preparing analytics data and descriptive insights...');
    if (overlay) {
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function hideAnalyticsExportLoading() {
    const overlay = document.getElementById('analyticsExportLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function waitForAnalyticsExportUiPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
}

async function runAnalyticsExportWithLoading(format, exporter) {
    if (analyticsExportInProgress) {
        showToast('An analytics export is already being generated.', 'info');
        return false;
    }

    analyticsExportInProgress = true;
    showAnalyticsExportLoading(format);
    await waitForAnalyticsExportUiPaint();

    try {
        await exporter();
        setAnalyticsExportLoadingMessage('Download started successfully.');
        showToast(`${format.toUpperCase()} analytics report generated.`, 'success');
        return true;
    } catch (error) {
        console.error(`[analytics ${format} export]`, error);
        showToast(`Unable to generate the ${format.toUpperCase()} analytics report. Please try again.`, 'error');
        return false;
    } finally {
        window.setTimeout(() => {
            hideAnalyticsExportLoading();
            analyticsExportInProgress = false;
        }, 350);
    }
}
const OFFICER_FINANCIAL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
let officerLockerBoard = [];
let selectedLockerTile = null;
let lockerAssignableStudents = [];
let selectedLockerAssignStudent = null;
let lockerTransactionBusy = false;
let lockerTransactionStartedAt = 0;
let officerLockerAutoRefreshTimer = null;
let officerLockerAutoRefreshInFlight = false;
const OFFICER_LOCKER_POLL_FAST_MS = 5000;
const OFFICER_LOCKER_POLL_SLOW_MS = 30000;

function beginLockerTransaction(title, message) {
    if (lockerTransactionBusy) return false;
    lockerTransactionBusy = true;
    lockerTransactionStartedAt = performance.now();
    const overlay = document.getElementById('lockerTransactionLoading');
    const titleNode = document.getElementById('lockerTransactionLoadingTitle');
    const messageNode = document.getElementById('lockerTransactionLoadingMessage');
    if (titleNode) titleNode.textContent = title || 'Processing locker transaction';
    if (messageNode) messageNode.textContent = message || 'Please wait while your changes are safely processed.';
    overlay?.classList.add('is-active');
    overlay?.setAttribute('aria-hidden', 'false');
    return true;
}

async function finishLockerTransaction() {
    const elapsed = performance.now() - lockerTransactionStartedAt;
    if (elapsed < 350) {
        await new Promise(resolve => window.setTimeout(resolve, 350 - elapsed));
    }
    const overlay = document.getElementById('lockerTransactionLoading');
    overlay?.classList.remove('is-active');
    overlay?.setAttribute('aria-hidden', 'true');
    lockerTransactionBusy = false;
}

let officerPrintingAutoRefreshTimer = null;
let officerPrintingAutoRefreshInFlight = false;
let officerPrintingAutoRefreshLastQueueRefresh = 0;
const OFFICER_PRINTING_POLL_FAST_MS = 3000;
const OFFICER_PRINTING_POLL_SLOW_MS = 30000;
const OFFICER_PRINTING_QUEUE_REFRESH_FAST_MS = 15000;
const OFFICER_PRINTING_QUEUE_REFRESH_SLOW_MS = 60000;

function isOfficerPrintingQueueBeingEdited() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    const wrap = document.getElementById('officerPrintingQueueTableWrap');
    if (!wrap || !wrap.contains(active)) return false;
    const tag = String(active.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea';
}

function stopOfficerPrintingAutoRefresh() {
    if (officerPrintingAutoRefreshTimer) {
        clearTimeout(officerPrintingAutoRefreshTimer);
        officerPrintingAutoRefreshTimer = null;
    }
}

function isOfficerPrintingAutoRefreshActive() {
    const trackerSection = document.getElementById('tracker');
    return officerPrintingEnabled
        && currentTrackerSubView === 'printing'
        && (!trackerSection || trackerSection.classList.contains('active'));
}

function getOfficerPrintingPollDelay() {
    return document.hidden
        ? OFFICER_PRINTING_POLL_SLOW_MS
        : OFFICER_PRINTING_POLL_FAST_MS;
}

function getOfficerPrintingQueueRefreshDelay() {
    return document.hidden
        ? OFFICER_PRINTING_QUEUE_REFRESH_SLOW_MS
        : OFFICER_PRINTING_QUEUE_REFRESH_FAST_MS;
}

function scheduleOfficerPrintingAutoRefresh(delay = getOfficerPrintingPollDelay()) {
    stopOfficerPrintingAutoRefresh();
    if (!isOfficerPrintingAutoRefreshActive()) return;

    officerPrintingAutoRefreshTimer = window.setTimeout(() => {
        officerPrintingAutoRefreshTimer = null;
        pollOfficerPrintingQueue().catch(() => {
            // Keep background polling silent; the manual Refresh button reports errors.
        });
    }, delay);
}

async function pollOfficerPrintingQueue() {
    if (!isOfficerPrintingAutoRefreshActive()) return;
    if (officerPrintingAutoRefreshInFlight) {
        scheduleOfficerPrintingAutoRefresh();
        return;
    }

    officerPrintingAutoRefreshInFlight = true;
    try {
        await loadOfficerPendingPrintRequests(false);

        const now = Date.now();
        const dueForQueueRefresh = now - Number(officerPrintingAutoRefreshLastQueueRefresh || 0)
            >= getOfficerPrintingQueueRefreshDelay();
        if (dueForQueueRefresh && !isOfficerPrintingQueueBeingEdited()) {
            officerPrintingAutoRefreshLastQueueRefresh = now;
            await loadOfficerPrintingQueue(false);
        }
    } finally {
        officerPrintingAutoRefreshInFlight = false;
        scheduleOfficerPrintingAutoRefresh();
    }
}

function startOfficerPrintingAutoRefresh({ refreshNow = false } = {}) {
    stopOfficerPrintingAutoRefresh();
    if (!isOfficerPrintingAutoRefreshActive()) return;

    if (refreshNow && !officerPrintingAutoRefreshInFlight) {
        pollOfficerPrintingQueue().catch(() => {});
        return;
    }
    scheduleOfficerPrintingAutoRefresh();
}

function isOfficerLockerEnabled() {
    const session = readAuthSession();
    const activeOrgName = normalizeOfficerOrgName(session.active_org_name || '');
    const activeOrgCode = normalizeOfficerOrgName(session.active_org_code || '');
    return activeOrgName === 'SUPREME STUDENT COUNCIL' || activeOrgCode === 'SSC';
}

function syncOfficerFinancialServiceFilterOptions() {
    const select = document.getElementById('financialSummaryServiceFilter');
    if (!select) return;

    const previousValue = select.value || '';
    const options = [
        { value: '', label: 'All Services' },
    ];
    if (officerRentalsEnabled) {
        options.push({ value: 'rental', label: 'Rentals' });
    }
    if (officerLockerEnabled) {
        options.push({ value: 'locker', label: 'Lockers' });
    }
    if (officerPrintingEnabled) {
        options.push({ value: 'printing', label: 'Printing' });
    }

    select.innerHTML = options
        .map((option) => `<option value="${option.value}">${option.label}</option>`)
        .join('');
    const availableValues = new Set(options.map((option) => option.value));
    select.value = availableValues.has(previousValue) ? previousValue : '';

    if (select.value !== previousValue && officerFinancialSummaryData.length) {
        renderOfficerFinancialSummary();
    }
}

function getOfficerTrackerFallbackView() {
    if (officerRentalsEnabled) return 'rentals';
    if (officerPrintingEnabled) return 'printing';
    if (officerLockerEnabled) return 'lockers';
    return 'financial-summary';
}

function isOfficerServicesTrackerEnabled() {
    return officerRentalsEnabled || officerPrintingEnabled;
}

function getOfficerServiceAccessCacheKey() {
    const session = readAuthSession();
    const orgId = Number(session.active_org_id || 0);
    const orgIdentity = orgId > 0
        ? String(orgId)
        : String(session.active_org_code || session.active_org_name || '').trim().toUpperCase();
    return orgIdentity ? `${OFFICER_SERVICE_ACCESS_CACHE_PREFIX}${orgIdentity}` : '';
}

function readOfficerServiceAccessCache() {
    const key = getOfficerServiceAccessCacheKey();
    if (!key) return null;
    try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        if (!cached
            || typeof cached.rentals_enabled !== 'boolean'
            || typeof cached.printing_enabled !== 'boolean') {
            return null;
        }
        return cached;
    } catch (_error) {
        return null;
    }
}

function writeOfficerServiceAccessCache(rentalsEnabled, printingEnabled) {
    const key = getOfficerServiceAccessCacheKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify({
            rentals_enabled: !!rentalsEnabled,
            printing_enabled: !!printingEnabled,
            confirmed_at: new Date().toISOString(),
        }));
    } catch (_error) {
        // Storage may be unavailable in restrictive browsing modes. The
        // current in-memory access state still remains authoritative.
    }
}

function syncOfficerServicesTrackerAccess() {
    const enabled = isOfficerServicesTrackerEnabled();
    const navItem = document.getElementById('servicesTrackerNavItem');
    const navLink = navItem?.querySelector('.nav-link');
    if (navItem) {
        navItem.hidden = !enabled;
        navItem.style.display = enabled ? '' : 'none';
    }
    if (navLink) {
        navLink.setAttribute('aria-disabled', String(!enabled));
        navLink.tabIndex = enabled ? 0 : -1;
    }

    const trackerView = document.getElementById('tracker');
    if (!enabled && trackerView?.classList.contains('active')) {
        navigate('dashboard');
        if (officerServiceAccessLoaded) {
            showToast('Services Tracker was disabled because Rentals and Printing are both unavailable.', 'error');
        }
    }
}

function setOfficerTrackerRentalsAccess(rentalsEnabled, activateFallback = true) {
    officerRentalsEnabled = !!rentalsEnabled;
    const rentalsBtn = document.getElementById('trackerRentalsBtn');
    const rentalsView = document.getElementById('tracker-rentals-view');
    const rentalsFrame = rentalsView?.querySelector('iframe');

    if (rentalsBtn) {
        rentalsBtn.hidden = !officerRentalsEnabled;
        rentalsBtn.style.display = officerRentalsEnabled ? '' : 'none';
        rentalsBtn.disabled = !officerRentalsEnabled;
        rentalsBtn.setAttribute('aria-disabled', String(!officerRentalsEnabled));
    }
    if (rentalsView) {
        rentalsView.style.display = officerRentalsEnabled ? '' : 'none';
    }
    if (rentalsFrame) {
        if (officerRentalsEnabled && !rentalsFrame.getAttribute('src')) {
            rentalsFrame.setAttribute('src', rentalsFrame.dataset.src || '../pages/igp/index.php');
        } else if (!officerRentalsEnabled && rentalsFrame.getAttribute('src')) {
            rentalsFrame.removeAttribute('src');
        }
    }

    syncOfficerFinancialServiceFilterOptions();
    syncOfficerServicesTrackerAccess();
    if (activateFallback && !officerRentalsEnabled && currentTrackerSubView === 'rentals') {
        switchTrackerSubView(getOfficerTrackerFallbackView());
    }
}

async function loadOfficerServiceAccess(force = false) {
    if (officerServiceAccessPromise && !force) return officerServiceAccessPromise;

    officerServiceAccessPromise = fetch('../api/services/officer/status.php', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
    })
        .then((response) => response.json().catch(() => ({})).then((data) => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Could not load organization service access.');
            }
            setOfficerTrackerPrintingAccess(!!data.printing_enabled);
            setOfficerTrackerRentalsAccess(!!data.rentals_enabled);
            writeOfficerServiceAccessCache(!!data.rentals_enabled, !!data.printing_enabled);
            officerServiceAccessLoaded = true;
            syncOfficerServicesTrackerAccess();
            if (typeof refreshAnalyticsCharts === 'function') refreshAnalyticsCharts();
            return data;
        })
        .catch((error) => {
            console.error('[loadOfficerServiceAccess]', error);
            // A failed request means access is unknown, not disabled. Preserve
            // the last server-confirmed state so going offline cannot hide the
            // tracker or imitate an OSA service-disable action.
            if (!officerServiceAccessLoaded) {
                const cached = readOfficerServiceAccessCache();
                if (cached) {
                    setOfficerTrackerPrintingAccess(cached.printing_enabled);
                    setOfficerTrackerRentalsAccess(cached.rentals_enabled, false);
                    officerServiceAccessLoaded = true;
                    syncOfficerServicesTrackerAccess();
                }
            }
            return null;
        })
        .finally(() => {
            officerServiceAccessPromise = null;
        });

    return officerServiceAccessPromise;
}

function setOfficerTrackerPrintingAccess(printingEnabled) {
    officerPrintingEnabled = !!printingEnabled;
    officerLockerEnabled = isOfficerLockerEnabled();
    syncOfficerFinancialServiceFilterOptions();
    syncOfficerServicesTrackerAccess();

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
        stopOfficerPrintingAutoRefresh();
        currentTrackerSubView = getOfficerTrackerFallbackView();
        switchTrackerSubView(currentTrackerSubView);
    }
    if (!officerLockerEnabled && currentTrackerSubView === 'lockers') {
        currentTrackerSubView = getOfficerTrackerFallbackView();
        switchTrackerSubView(currentTrackerSubView);
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
    const wasPrinting = currentTrackerSubView === 'printing';
    const wasLockers = currentTrackerSubView === 'lockers';
    if (viewId === 'rentals' && !officerRentalsEnabled) {
        return false;
    }
    if (viewId === 'printing' && !officerPrintingEnabled) {
        return false;
    }
    if (viewId === 'lockers' && !officerLockerEnabled) {
        return false;
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

    if (wasPrinting && viewId !== 'printing') {
        stopOfficerPrintingAutoRefresh();
    }
    if (wasLockers && viewId !== 'lockers') {
        stopOfficerLockerAutoRefresh();
    }
    if (viewId === 'printing') {
        showOfficerPrintingQueueView();
        startOfficerPrintingAutoRefresh();
        loadOfficerPrintingQueue().catch((error) => console.error(error));
    } else if (viewId === 'financial-summary') {
        loadOfficerFinancialSummary().catch((error) => console.error(error));
    } else if (viewId === 'lockers') {
        startOfficerLockerAutoRefresh({ refreshNow: true });
    }
    return true;
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

function getOfficerFinancialPaymentStatus(item) {
    const serviceType = String(item?.service_type || '').toLowerCase();
    const transactionStatus = String(item?.status || '').toLowerCase();
    if (serviceType === 'printing' && transactionStatus === 'cancelled') return 'waived';

    const paymentStatus = String(item?.payment_status || '').toLowerCase();
    return ['paid', 'waived'].includes(paymentStatus) ? paymentStatus : 'unpaid';
}

function getOfficerFinancialPaymentLabel(item) {
    const paymentStatus = getOfficerFinancialPaymentStatus(item);
    if (paymentStatus === 'paid') return 'Paid';
    if (paymentStatus === 'waived') return 'Waived';
    return 'Unpaid';
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
        return String(item?.item_label || '').trim() || 'Print Job';
    }
    return String(item?.item_label || '').trim() || '-';
}

function getOfficerFinancialItemFilterLabels(item) {
    const serviceType = String(item?.service_type || '').toLowerCase();
    if (serviceType === 'printing') return [];
    if (serviceType === 'locker') return ['Locker'];

    const rawLabel = String(item?.item_label || '').trim();
    if (!rawLabel) return [];

    const uniqueLabels = new Map();
    rawLabel.split(',').forEach((entry) => {
        const label = entry.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
        if (label && !uniqueLabels.has(label.toLowerCase())) {
            uniqueLabels.set(label.toLowerCase(), label);
        }
    });
    return Array.from(uniqueLabels.values());
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

    const uniqueLabels = new Map();
    (items || [])
        .filter((item) => !filters.service || String(item.service_type || '').toLowerCase() === filters.service)
        .filter((item) => !filters.payment || getOfficerFinancialPaymentStatus(item) === filters.payment)
        .filter((item) => matchesOfficerFinancialDateFilter(item, filters.startDate, filters.endDate))
        .flatMap((item) => getOfficerFinancialItemFilterLabels(item))
        .forEach((label) => {
            const key = label.toLowerCase();
            if (!uniqueLabels.has(key)) uniqueLabels.set(key, label);
        });
    const labels = Array.from(uniqueLabels.values()).sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">All Items</option>' + labels
        .map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`)
        .join('');
    select.value = labels.includes(current) ? current : '';
}

function getFilteredOfficerFinancialSummaryItems() {
    const filters = getOfficerFinancialSummaryFilters();
    return officerFinancialSummaryData.filter((item) => {
        const serviceType = String(item.service_type || '').toLowerCase();
        const paymentStatus = getOfficerFinancialPaymentStatus(item);
        const itemLabels = getOfficerFinancialItemFilterLabels(item);
        if (filters.service && serviceType !== filters.service) return false;
        if (filters.item && !itemLabels.some((label) => label.toLowerCase() === filters.item.toLowerCase())) return false;
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
    const dateBreakdownBody = document.getElementById('financialSummaryDateBreakdownTable');

    let totalRevenue = 0;
    let totalUnpaid = 0;
    let paidTransactions = 0;
    let unpaidTransactions = 0;
    const dateValues = [];
    const dailyMap = new Map();

    rows.forEach((item) => {
        const totalCost = Number(item.total_cost || 0);
        const paymentStatus = getOfficerFinancialPaymentStatus(item);
        const dateValue = getOfficerFinancialDateValue(item);
        const parsedDate = dateValue ? new Date(dateValue) : null;

        if (paymentStatus === 'paid') {
            totalRevenue += totalCost;
            paidTransactions += 1;
        } else if (paymentStatus === 'unpaid') {
            totalUnpaid += totalCost;
            unpaidTransactions += 1;
        }

        if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
            dateValues.push(parsedDate);
            const dateKey = formatLocalDateKey(parsedDate);
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, {
                    revenue: 0,
                    unpaid: 0,
                    transactions: 0,
                    paid: 0,
                    unpaidCount: 0,
                });
            }
            const dayBucket = dailyMap.get(dateKey);
            dayBucket.transactions += 1;
            if (paymentStatus === 'paid') {
                dayBucket.revenue += totalCost;
                dayBucket.paid += 1;
            } else if (paymentStatus === 'unpaid') {
                dayBucket.unpaid += totalCost;
                dayBucket.unpaidCount += 1;
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
                    <td><span class="financial-payment-badge ${escapeHtml(getOfficerFinancialPaymentStatus(item))}">${escapeHtml(getOfficerFinancialPaymentLabel(item))}</span></td>
                </tr>
            `).join('');
        }
    }

    if (dateBreakdownBody) {
        const dailyRows = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        if (!dailyRows.length) {
            dateBreakdownBody.innerHTML = '<tr><td colspan="6" class="financial-empty-state">No date breakdown available for the selected filters.</td></tr>';
        } else {
            dateBreakdownBody.innerHTML = dailyRows.map(([dateKey, day]) => `
                <tr>
                    <td>${escapeHtml(formatOfficerFinancialDate(`${dateKey}T00:00:00`))}</td>
                    <td>${escapeHtml(formatOfficerPeso(day.revenue))}</td>
                    <td>${escapeHtml(formatOfficerPeso(day.unpaid))}</td>
                    <td>${day.transactions}</td>
                    <td>${day.paid}</td>
                    <td>${day.unpaidCount}</td>
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

function exportOfficerFinancialSummaryXlsx() {
    if (!window.XLSX) {
        showToast('The XLSX export library could not be loaded.', 'error');
        return;
    }

    const rows = getFilteredOfficerFinancialSummaryItems();
    const session = readAuthSession();
    const organization = session.active_org_name || session.active_org_code || 'Organization';
    const dateRange = document.getElementById('financialSummaryDateRange')?.textContent?.trim() || '-';
    const serviceLabel = document.getElementById('financialSummaryServiceFilter')?.selectedOptions?.[0]?.textContent || 'All Services';
    const itemLabel = document.getElementById('financialSummaryItemFilter')?.selectedOptions?.[0]?.textContent || 'All Items';
    const paymentLabel = document.getElementById('financialSummaryPaymentFilter')?.selectedOptions?.[0]?.textContent || 'All';

    let totalRevenue = 0;
    let totalUnpaid = 0;
    let paidTransactions = 0;
    let unpaidTransactions = 0;
    const dailyMap = new Map();

    rows.forEach((item) => {
        const totalCost = Number(item.total_cost || 0);
        const paymentStatus = getOfficerFinancialPaymentStatus(item);
        const isPaid = paymentStatus === 'paid';
        if (isPaid) {
            totalRevenue += totalCost;
            paidTransactions += 1;
        } else if (paymentStatus === 'unpaid') {
            totalUnpaid += totalCost;
            unpaidTransactions += 1;
        }

        const parsedDate = new Date(getOfficerFinancialDateValue(item));
        if (Number.isNaN(parsedDate.getTime())) return;
        const dateKey = formatLocalDateKey(parsedDate);
        if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
                revenue: 0,
                unpaid: 0,
                transactions: 0,
                paid: 0,
                unpaidCount: 0,
            });
        }
        const day = dailyMap.get(dateKey);
        day.transactions += 1;
        if (isPaid) {
            day.revenue += totalCost;
            day.paid += 1;
        } else if (paymentStatus === 'unpaid') {
            day.unpaid += totalCost;
            day.unpaidCount += 1;
        }
    });

    const summaryRows = [
        ['Financial Summary'],
        ['Organization', organization],
        ['Exported At', new Date().toLocaleString('en-PH')],
        [],
        ['Selected Filters'],
        ['Service', serviceLabel],
        ['Item / Job', itemLabel],
        ['Payment', paymentLabel],
        ['Date Range', dateRange],
        [],
        ['Metric', 'Value'],
        ['Total Revenue', totalRevenue],
        ['Total Unpaid', totalUnpaid],
        ['Total Transactions', rows.length],
        ['Paid Transactions', paidTransactions],
        ['Unpaid Transactions', unpaidTransactions],
        ['Average Paid Value', paidTransactions ? totalRevenue / paidTransactions : 0],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 24 }, { wch: 34 }];
    ['B12', 'B13', 'B17'].forEach((cell) => {
        if (summarySheet[cell]) summarySheet[cell].z = '"P"#,##0.00';
    });

    const sortedRows = [...rows].sort((a, b) => {
        const aTime = new Date(getOfficerFinancialDateValue(a) || 0).getTime();
        const bTime = new Date(getOfficerFinancialDateValue(b) || 0).getTime();
        return bTime - aTime;
    });
    const transactionRows = [
        ['Date', 'Service', 'Item / Job', 'Customer', 'Customer ID', 'Processed By', 'Base Cost', 'Overtime', 'Total Cost', 'Status', 'Payment'],
        ...sortedRows.map((item) => [
            formatOfficerFinancialDate(getOfficerFinancialDateValue(item)),
            getOfficerFinancialServiceLabel(item.service_type),
            getOfficerFinancialItemDisplayLabel(item),
            item.customer_name || '-',
            item.customer_identifier || '-',
            item.processed_by || '-',
            Number(item.base_cost || 0),
            Number(item.overtime_cost || 0),
            Number(item.total_cost || 0),
            getOfficerFinancialStatusLabel(item.status),
            getOfficerFinancialPaymentLabel(item),
        ]),
    ];
    const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionRows);
    transactionsSheet['!cols'] = [
        { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 18 },
        { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
    ];
    for (let rowIndex = 2; rowIndex <= transactionRows.length; rowIndex += 1) {
        ['G', 'H', 'I'].forEach((column) => {
            const cell = transactionsSheet[`${column}${rowIndex}`];
            if (cell) cell.z = '"P"#,##0.00';
        });
    }

    const breakdownRows = [
        ['Date', 'Total Revenue', 'Total Unpaid', 'Transactions', 'Paid', 'Unpaid'],
        ...Array.from(dailyMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dateKey, day]) => [
                formatOfficerFinancialDate(`${dateKey}T00:00:00`),
                day.revenue,
                day.unpaid,
                day.transactions,
                day.paid,
                day.unpaidCount,
            ]),
    ];
    const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownRows);
    breakdownSheet['!cols'] = [
        { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    ];
    for (let rowIndex = 2; rowIndex <= breakdownRows.length; rowIndex += 1) {
        ['B', 'C'].forEach((column) => {
            const cell = breakdownSheet[`${column}${rowIndex}`];
            if (cell) cell.z = '"P"#,##0.00';
        });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
    XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Date Breakdown');

    const safeOrganization = String(organization)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'organization';
    const fileDate = formatLocalDateKey(new Date());
    XLSX.writeFile(workbook, `${safeOrganization}-financial-summary-${fileDate}.xlsx`);
    showToast(`Exported ${rows.length} filtered transaction${rows.length === 1 ? '' : 's'}.`, 'success');
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
    const todayValue = formatLocalDateKey(today);

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

    if (queueContent) queueContent.style.display = officerPrintingQueueIsLoading ? 'none' : 'block';
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
    if (historyContent) historyContent.style.display = officerPrintingQueueIsLoading ? 'none' : 'block';
    if (subtitle) subtitle.textContent = 'Review completed and cancelled print requests using the same date filters as the history page.';
    if (btnHistory) btnHistory.style.display = 'none';
    if (btnBack) btnBack.style.display = 'inline-flex';
    renderOfficerPrintingHistory(true);
}

function setOfficerPrintingQueueLoading(isLoading, options = {}) {
    officerPrintingQueueIsLoading = Boolean(isLoading);
    const loadingState = document.getElementById('officerPrintingQueueLoading');
    const loadingTitle = document.getElementById('officerPrintingLoadingTitle');
    const loadingMessage = document.getElementById('officerPrintingLoadingMessage');
    const queueContent = document.getElementById('officerPrintingQueueContent');
    const historyContent = document.getElementById('officerPrintingHistoryContent');
    const disabledMessage = document.getElementById('officerPrintingDisabledMessage');

    if (loadingState) {
        loadingState.classList.toggle('is-active', officerPrintingQueueIsLoading);
        loadingState.setAttribute('aria-hidden', officerPrintingQueueIsLoading ? 'false' : 'true');
    }
    if (officerPrintingQueueIsLoading) {
        if (loadingTitle) loadingTitle.textContent = options.title || 'Loading printing queue';
        if (loadingMessage) loadingMessage.textContent = options.message || 'Checking for pending requests and active print jobs...';
    }
    if (officerPrintingQueueIsLoading) {
        if (queueContent) queueContent.style.display = 'none';
        if (historyContent) historyContent.style.display = 'none';
        if (disabledMessage) disabledMessage.style.display = 'none';
    }
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
    const pendingPanel = document.getElementById('officerPendingPrintRequestsPanel');
    const pendingWrap = document.getElementById('officerPendingPrintRequestsTableWrap');
    if (!tableBody || !disabledMessage || !tableWrap) return;

    disabledMessage.style.display = printingEnabled ? 'none' : 'block';
    tableWrap.style.display = printingEnabled ? 'block' : 'none';
    if (pendingPanel) pendingPanel.style.display = printingEnabled ? 'block' : 'none';
    if (pendingWrap) pendingWrap.style.display = printingEnabled ? 'block' : 'none';

    renderOfficerPendingPrintRequests(printingEnabled);

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
            statusActions.push(`<button class="btn btn-primary btn-sm" type="button" onclick="openOfficerPrintClaimModal(${job.print_job_id})">Claimed</button>`);
        }
        if (String(job.status || '').toLowerCase() !== 'claimed' && String(job.status || '').toLowerCase() !== 'cancelled') {
            statusActions.push(`<button class="btn btn-outline btn-sm" type="button" onclick="updateOfficerPrintJobStatus(${job.print_job_id}, 'cancelled')">Cancel</button>`);
        }

        return `
            <tr data-print-job-id="${Number(job.print_job_id)}">
                <td>${queueLabel}</td>
                <td>
                    <strong>${escapeHtml(job.file_name || 'Untitled File')}</strong>
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
                        ${jobUrl ? `<button class="btn btn-outline btn-sm" type="button" onclick="openOfficerPrintingFilePreview(${Number(job.print_job_id)})">View</button>` : ''}
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(getOfficerPrintingDownloadUrl(jobUrl))}">Download</a>` : ''}
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

function renderOfficerPendingPrintRequests(printingEnabled = true) {
    const tableBody = document.getElementById('officerPendingPrintRequestsTable');
    const wrap = document.getElementById('officerPendingPrintRequestsTableWrap');
    const panel = document.getElementById('officerPendingPrintRequestsPanel');
    if (!tableBody || !wrap || !panel) {
        return;
    }

    if (!printingEnabled || !officerPendingPrintRequests.length) {
        panel.style.display = 'none';
        wrap.style.display = 'none';
        tableBody.innerHTML = '';
        return;
    }

    panel.style.display = 'block';
    wrap.style.display = 'block';

    tableBody.innerHTML = officerPendingPrintRequests.map((job) => {
        const jobUrl = resolvePdfUrl(job.file_url);
        const submittedAt = job.submitted_at ? new Date(job.submitted_at) : null;
        const timeLabel = submittedAt && !Number.isNaN(submittedAt.getTime())
            ? submittedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : '';

        return `
            <tr data-print-job-id="${Number(job.print_job_id)}">
                <td>
                    <strong>${escapeHtml(job.file_name || 'Untitled File')}</strong>
                    ${job.notes ? `<div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.notes)}</div>` : ''}
                </td>
                <td>
                    <strong>${escapeHtml(job.student_name || 'Unknown Student')}</strong>
                    <div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.student_number || '-')} ${job.section ? `• ${escapeHtml(job.section)}` : ''}</div>
                </td>
                <td>
                    ${fmtDateShort(job.submitted_at)}
                    ${timeLabel ? `<div style="color:var(--muted); font-size:0.8rem;">${timeLabel}</div>` : ''}
                </td>
                <td>
                    <div class="printing-job-action-stack">
                        ${jobUrl ? `<button class="btn btn-outline btn-sm" type="button" onclick="openOfficerPrintingFilePreview(${Number(job.print_job_id)})">View</button>` : ''}
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(getOfficerPrintingDownloadUrl(jobUrl))}">Download</a>` : ''}
                        <button class="btn btn-primary btn-sm" type="button" onclick="acceptOfficerPendingPrintRequest(${Number(job.print_job_id)})">Accept</button>
                        <button class="btn btn-outline btn-sm" type="button" onclick="dismissOfficerPendingPrintRequest(${Number(job.print_job_id)})">No</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
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
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--muted);">Printing is not enabled for this organization.</td></tr>`;
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
                status,
                job.payment_status || '',
                Number(job.total_cost || 0).toFixed(2)
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
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--muted);">No print history found for the selected filters.</td></tr>`;
        return;
    }

    tableBody.innerHTML = historyItems.map((job) => {
        const jobUrl = resolvePdfUrl(job.file_url);
        const completedAt = job.claimed_at || job.updated_at || '';
        const paymentStatus = String(job.status || '').toLowerCase() === 'cancelled'
            ? 'waived'
            : (String(job.payment_status || 'unpaid').toLowerCase() === 'paid' ? 'paid' : 'unpaid');
        const paymentLabel = paymentStatus === 'paid' ? 'Paid' : (paymentStatus === 'waived' ? 'Waived' : 'Unpaid');
        const canMarkPaid = String(job.status || '').toLowerCase() === 'claimed'
            && paymentStatus === 'unpaid'
            && Number(job.total_cost || 0) > 0;
        return `
            <tr data-print-job-id="${Number(job.print_job_id)}">
                <td>${Number(job.queue_order || job.queue_position || 0) || '-'}</td>
                <td>
                    <strong>${escapeHtml(job.file_name || 'Untitled File')}</strong>
                    ${job.notes ? `<div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.notes)}</div>` : ''}
                </td>
                <td>
                    <strong>${escapeHtml(job.student_name || 'Unknown Student')}</strong>
                    <div style="color:var(--muted); font-size:0.8rem; margin-top:4px;">${escapeHtml(job.student_number || '-')} ${job.section ? `â€¢ ${escapeHtml(job.section)}` : ''}</div>
                </td>
                <td>${fmtDateShort(job.submitted_at)}<div style="color:var(--muted); font-size:0.8rem;">${new Date(job.submitted_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div></td>
                <td>${completedAt ? `${fmtDateShort(completedAt)}<div style="color:var(--muted); font-size:0.8rem;">${new Date(completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>` : '-'}</td>
                <td><span class="status-badge ${getOfficerPrintStatusClass(job.status)}">${getOfficerPrintStatusLabel(job.status)}</span></td>
                <td>${escapeHtml(formatOfficerPrintingPrice(job.total_cost || 0))}</td>
                <td><span class="financial-payment-badge ${paymentStatus}">${paymentLabel}</span></td>
                <td>
                    <div class="printing-job-action-stack">
                        ${jobUrl ? `<button class="btn btn-outline btn-sm" type="button" onclick="openOfficerPrintingFilePreview(${Number(job.print_job_id)})">View</button>` : ''}
                        ${jobUrl ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(getOfficerPrintingDownloadUrl(jobUrl))}">Download</a>` : ''}
                        ${canMarkPaid ? `<button class="btn btn-primary btn-sm" type="button" onclick="openOfficerPrintMarkPaidModal(${Number(job.print_job_id)})">Mark as Paid</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getOfficerPrintingDownloadUrl(fileUrl) {
    if (!fileUrl) return '';
    return `${fileUrl}${String(fileUrl).includes('?') ? '&' : '?'}download=1`;
}

function getOfficerPrintingFileExtension(job) {
    const explicitExtension = String(job?.file_extension || '').toLowerCase().replace(/^\./, '');
    if (explicitExtension) return explicitExtension === 'jpeg' ? 'jpg' : explicitExtension;

    const fileName = String(job?.file_name || '');
    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    return extension === 'jpeg' ? 'jpg' : extension;
}

function findOfficerPrintingJob(printJobId) {
    const normalizedId = Number(printJobId);
    return [...officerPrintingQueue, ...officerPendingPrintRequests]
        .find((job) => Number(job.print_job_id) === normalizedId) || null;
}

function createOfficerPrintingPreviewLoader() {
    const loader = document.createElement('div');
    loader.className = 'printing-file-preview-loader';
    loader.innerHTML = `
        <span class="printing-file-preview-spinner" aria-hidden="true"></span>
        <strong>Loading file preview</strong>
        <span>Please wait while the file is prepared.</span>
    `;
    return loader;
}

function showOfficerPrintingPreviewError(body, message) {
    body.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'printing-file-preview-message';
    error.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';
    const title = document.createElement('strong');
    title.textContent = 'Preview unavailable';
    const description = document.createElement('span');
    description.textContent = message;
    error.append(title, description);
    body.appendChild(error);
}

function openOfficerPrintingFilePreview(printJobId) {
    const job = findOfficerPrintingJob(printJobId);
    const modal = document.getElementById('officerPrintingFilePreviewModal');
    const body = document.getElementById('officerPrintingFilePreviewBody');
    const name = document.getElementById('officerPrintingFilePreviewName');
    const download = document.getElementById('officerPrintingFilePreviewDownload');
    const fileUrl = resolvePdfUrl(job?.file_url);

    if (!job || !modal || !body || !name || !download || !fileUrl) {
        showToast('The printing file is not available.', 'error');
        return;
    }

    const extension = getOfficerPrintingFileExtension(job);
    name.textContent = job.file_name || 'Untitled File';
    download.href = getOfficerPrintingDownloadUrl(fileUrl);
    download.setAttribute('download', job.file_name || 'printing-file');
    body.innerHTML = '';

    if (extension === 'pdf') {
        const loader = createOfficerPrintingPreviewLoader();
        const frame = document.createElement('iframe');
        frame.className = 'printing-file-preview-frame';
        frame.title = `Preview of ${job.file_name || 'printing file'}`;
        frame.src = fileUrl;
        frame.addEventListener('load', () => loader.remove(), { once: true });
        body.append(loader, frame);
    } else if (['png', 'jpg'].includes(extension)) {
        const loader = createOfficerPrintingPreviewLoader();
        const image = document.createElement('img');
        image.className = 'printing-file-preview-image';
        image.alt = `Preview of ${job.file_name || 'printing file'}`;
        image.addEventListener('load', () => loader.remove(), { once: true });
        image.addEventListener('error', () => {
            showOfficerPrintingPreviewError(body, 'The image could not be displayed. You can still download the original file.');
        }, { once: true });
        image.src = fileUrl;
        body.append(loader, image);
    } else if (extension === 'docx') {
        const message = document.createElement('div');
        message.className = 'printing-file-preview-message printing-file-preview-docx';
        message.innerHTML = `
            <i class="fa-solid fa-file-word" aria-hidden="true"></i>
            <strong>Word document</strong>
            <span>DOCX files cannot be displayed securely inside this browser. Download the file below and open it in Microsoft Word or another compatible app.</span>
        `;
        body.appendChild(message);
    } else {
        showOfficerPrintingPreviewError(body, 'This file type is not supported by the preview window. You can still download the original file.');
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeOfficerPrintingFilePreviewModal() {
    const modal = document.getElementById('officerPrintingFilePreviewModal');
    const body = document.getElementById('officerPrintingFilePreviewBody');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (body) body.innerHTML = '';
    document.body.style.overflow = '';
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
    const printingClaimModal = document.getElementById('officerPrintClaimModal');
    if (printingClaimModal && e.target === printingClaimModal) {
        closeOfficerPrintClaimModal();
    }
    const printingMarkPaidModal = document.getElementById('officerPrintMarkPaidModal');
    if (printingMarkPaidModal && e.target === printingMarkPaidModal) {
        closeOfficerPrintMarkPaidModal();
    }
    const printingFilePreviewModal = document.getElementById('officerPrintingFilePreviewModal');
    if (printingFilePreviewModal && e.target === printingFilePreviewModal) {
        closeOfficerPrintingFilePreviewModal();
    }
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
    const lockerPaymentScanModal = document.getElementById('lockerPaymentScanModal');
    if (lockerPaymentScanModal && e.target === lockerPaymentScanModal) {
        closeLockerPaymentScanModal();
    }
    const addLockerModal = document.getElementById('addLockerModal');
    if (addLockerModal && e.target === addLockerModal) {
        closeAddLockerModal();
    }
    const announcementDetailModal = document.getElementById('announcementDetailModal');
    if (announcementDetailModal && e.target === announcementDetailModal) {
        closeAnnouncementDetailModal();
    }
    const announcementPhotoModal = document.getElementById('announcementPhotoModal');
    if (announcementPhotoModal && e.target === announcementPhotoModal) {
        closeAnnouncementPhotoCarousel();
    }
    const announcementComposerModal = document.getElementById('announcementComposerModal');
    if (announcementComposerModal && e.target === announcementComposerModal) {
        closeAnnouncementComposer();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const printingClaimModal = document.getElementById('officerPrintClaimModal');
        if (printingClaimModal && printingClaimModal.classList.contains('show')) {
            closeOfficerPrintClaimModal();
            return;
        }
        const printingMarkPaidModal = document.getElementById('officerPrintMarkPaidModal');
        if (printingMarkPaidModal && printingMarkPaidModal.classList.contains('show')) {
            closeOfficerPrintMarkPaidModal();
            return;
        }
        const printingFilePreviewModal = document.getElementById('officerPrintingFilePreviewModal');
        if (printingFilePreviewModal && printingFilePreviewModal.classList.contains('show')) {
            closeOfficerPrintingFilePreviewModal();
            return;
        }
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
        const lockerPaymentScanModal = document.getElementById('lockerPaymentScanModal');
        if (lockerPaymentScanModal && lockerPaymentScanModal.classList.contains('show')) {
            closeLockerPaymentScanModal();
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
        const announcementDetailModal = document.getElementById('announcementDetailModal');
        if (announcementDetailModal && announcementDetailModal.classList.contains('show')) {
            closeAnnouncementDetailModal();
        }
        const announcementPhotoModal = document.getElementById('announcementPhotoModal');
        if (announcementPhotoModal && announcementPhotoModal.classList.contains('show')) {
            closeAnnouncementPhotoCarousel();
            return;
        }
        const announcementComposerModal = document.getElementById('announcementComposerModal');
        if (announcementComposerModal && announcementComposerModal.classList.contains('show')) {
            closeAnnouncementComposer();
        }
    }
});

async function loadOfficerPrintingQueue(force = false) {
    const showLoadingState = force || !officerPrintingQueueHasLoaded;
    if (showLoadingState && !officerPrintingQueueIsLoading) {
        setOfficerPrintingQueueLoading(true);
    }
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

        if (data.printing_enabled) {
            try {
                await loadOfficerPendingPrintRequests(force);
            } catch (_error) {
                officerPendingPrintRequests = [];
            }
        } else {
            officerPendingPrintRequests = [];
        }

        officerPrintingQueueHasLoaded = true;
        if (showLoadingState) setOfficerPrintingQueueLoading(false);
        renderOfficerPrintingQueue(!!data.printing_enabled);
        return officerPrintingQueue;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerPrintingQueue]', error);
        }
        officerPrintingQueue = [];
        officerPendingPrintRequests = [];
        setOfficerTrackerPrintingAccess(false);
        if (showLoadingState) setOfficerPrintingQueueLoading(false);
        renderOfficerPrintingQueue(false);
        throw error;
    }
}

async function loadOfficerPendingPrintRequests(force = false) {
    try {
        const response = await fetch('../api/printing/officer/pending.php', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load pending print requests.');
        }
        officerPendingPrintRequests = Array.isArray(data.items) ? data.items : [];
        renderOfficerPendingPrintRequests(!!data.printing_enabled);
        return officerPendingPrintRequests;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerPendingPrintRequests]', error);
        }
        officerPendingPrintRequests = [];
        renderOfficerPendingPrintRequests(false);
        throw error;
    }
}

function dismissOfficerPendingPrintRequest(printJobId) {
    const numericId = Number(printJobId);
    officerPendingPrintRequests = officerPendingPrintRequests.filter((job) => Number(job.print_job_id) !== numericId);
    renderOfficerPendingPrintRequests(true);
}

async function acceptOfficerPendingPrintRequest(printJobId) {
    const numericId = Number(printJobId);
    setOfficerPrintingQueueLoading(true, {
        title: 'Accepting print request',
        message: 'Assigning this request to your organization and notifying the student...'
    });
    try {
        const response = await fetch('../api/printing/officer/accept.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ print_job_id: numericId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not accept the print request.');
        }

        await loadOfficerPrintingQueue(true);
        loadOfficerActionCenter(false);
    } catch (error) {
        setOfficerPrintingQueueLoading(false);
        showOfficerPrintingQueueView();
        alert(error.message || 'Could not accept the print request.');
        await loadOfficerPendingPrintRequests(true).catch(() => {});
    }
}

function getSelectedOfficerPrintClaimPaymentStatus() {
    return document.querySelector('input[name="officerPrintClaimPayment"]:checked')?.value || 'unpaid';
}

function formatOfficerPrintingPrice(value) {
    return `₱${Number(value || 0).toFixed(2)}`;
}

function openOfficerPrintClaimModal(printJobId) {
    const job = findOfficerPrintingJob(printJobId);
    const modal = document.getElementById('officerPrintClaimModal');
    if (!job || !modal || String(job.status || '').toLowerCase() !== 'ready_to_claim') {
        alert('This print job is no longer ready to be claimed. Refresh the queue and try again.');
        return;
    }

    officerPrintClaimJobId = Number(printJobId);
    const summary = document.getElementById('officerPrintClaimSummary');
    const price = document.getElementById('officerPrintClaimPrice');
    const barcode = document.getElementById('officerPrintClaimOfficerBarcode');
    const unpaid = document.querySelector('input[name="officerPrintClaimPayment"][value="unpaid"]');
    const error = document.getElementById('officerPrintClaimError');
    if (summary) summary.textContent = `${job.file_name || 'Print job'} for ${job.student_name || 'the student'}`;
    if (price) price.value = '';
    if (barcode) barcode.value = '';
    if (unpaid) unpaid.checked = true;
    if (error) {
        error.textContent = '';
        error.style.display = 'none';
    }
    syncOfficerPrintClaimModal();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => price?.focus(), 50);
}

function closeOfficerPrintClaimModal() {
    const modal = document.getElementById('officerPrintClaimModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (officerPrintClaimScanTimer) {
        window.clearTimeout(officerPrintClaimScanTimer);
        officerPrintClaimScanTimer = null;
    }
    officerPrintClaimJobId = 0;
    document.body.style.overflow = '';
}

function syncOfficerPrintClaimModal() {
    const price = Number(document.getElementById('officerPrintClaimPrice')?.value || 0);
    const paymentStatus = getSelectedOfficerPrintClaimPaymentStatus();
    const barcodeGroup = document.getElementById('officerPrintClaimBarcodeGroup');
    const barcode = String(document.getElementById('officerPrintClaimOfficerBarcode')?.value || '').trim();
    const submit = document.getElementById('officerPrintClaimSubmit');
    if (barcodeGroup) barcodeGroup.style.display = paymentStatus === 'paid' ? 'block' : 'none';
    if (submit) submit.disabled = submit.dataset.busy === '1' || !officerPrintClaimJobId || price <= 0 || (paymentStatus === 'paid' && !barcode);
}

function processOfficerPrintClaimBarcode() {
    const barcode = String(document.getElementById('officerPrintClaimOfficerBarcode')?.value || '').trim();
    if (!officerPrintClaimJobId || getSelectedOfficerPrintClaimPaymentStatus() !== 'paid' || !barcode) return;
    playOfficerPrintingBarcodeBeep();
    syncOfficerPrintClaimModal();
    const price = Number(document.getElementById('officerPrintClaimPrice')?.value || 0);
    if (price > 0) submitOfficerPrintClaim();
}

function handleOfficerPrintClaimBarcodeInput() {
    syncOfficerPrintClaimModal();
    const error = document.getElementById('officerPrintClaimError');
    if (error) error.style.display = 'none';
    if (officerPrintClaimScanTimer) {
        window.clearTimeout(officerPrintClaimScanTimer);
    }
    const barcode = String(document.getElementById('officerPrintClaimOfficerBarcode')?.value || '').trim();
    if (!barcode || getSelectedOfficerPrintClaimPaymentStatus() !== 'paid') {
        officerPrintClaimScanTimer = null;
        return;
    }
    officerPrintClaimScanTimer = window.setTimeout(() => {
        officerPrintClaimScanTimer = null;
        processOfficerPrintClaimBarcode();
    }, 180);
}

function handleOfficerPrintClaimBarcodeKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (officerPrintClaimScanTimer) {
        window.clearTimeout(officerPrintClaimScanTimer);
        officerPrintClaimScanTimer = null;
    }
    processOfficerPrintClaimBarcode();
}

async function submitOfficerPrintClaim() {
    const printJobId = officerPrintClaimJobId;
    const price = Number(document.getElementById('officerPrintClaimPrice')?.value || 0);
    const paymentStatus = getSelectedOfficerPrintClaimPaymentStatus();
    const officerIdentifier = String(document.getElementById('officerPrintClaimOfficerBarcode')?.value || '').trim();
    const submit = document.getElementById('officerPrintClaimSubmit');
    const error = document.getElementById('officerPrintClaimError');
    if (!printJobId || price <= 0 || (paymentStatus === 'paid' && !officerIdentifier) || submit?.dataset.busy === '1') return;

    if (submit) {
        submit.dataset.busy = '1';
        submit.disabled = true;
        submit.textContent = 'Saving...';
    }
    if (error) error.style.display = 'none';
    const result = await updateOfficerPrintJobStatus(printJobId, 'claimed', {
        total_cost: price.toFixed(2),
        payment_status: paymentStatus,
        officer_identifier: paymentStatus === 'paid' ? officerIdentifier : ''
    }, true);
    if (submit) {
        delete submit.dataset.busy;
        submit.textContent = 'Claim Print Job';
    }
    if (result.ok) {
        closeOfficerPrintClaimModal();
        showToast(paymentStatus === 'paid' ? 'Print job claimed and marked paid.' : 'Print job claimed with an unpaid balance.', 'success');
    } else if (error) {
        error.textContent = result.error || 'Could not claim the print job.';
        error.style.display = 'block';
        if (/officer|barcode/i.test(String(result.error || ''))) {
            const barcodeInput = document.getElementById('officerPrintClaimOfficerBarcode');
            if (barcodeInput) {
                barcodeInput.value = '';
                window.setTimeout(() => barcodeInput.focus(), 0);
            }
        }
        syncOfficerPrintClaimModal();
    }
}

function openOfficerPrintMarkPaidModal(printJobId) {
    const job = findOfficerPrintingJob(printJobId);
    const modal = document.getElementById('officerPrintMarkPaidModal');
    if (!job || !modal) return;
    officerPrintPaymentJobId = Number(printJobId);
    const summary = document.getElementById('officerPrintMarkPaidSummary');
    const barcode = document.getElementById('officerPrintPaymentOfficerBarcode');
    const error = document.getElementById('officerPrintMarkPaidError');
    if (summary) summary.textContent = `${job.student_name || 'The student'} will pay ${formatOfficerPrintingPrice(job.total_cost || 0)} for ${job.file_name || 'this print job'}.`;
    if (barcode) barcode.value = '';
    if (error) {
        error.textContent = '';
        error.style.display = 'none';
    }
    syncOfficerPrintMarkPaidModal();
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => barcode?.focus(), 50);
}

function closeOfficerPrintMarkPaidModal() {
    const modal = document.getElementById('officerPrintMarkPaidModal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
    if (officerPrintPaymentScanTimer) {
        window.clearTimeout(officerPrintPaymentScanTimer);
        officerPrintPaymentScanTimer = null;
    }
    officerPrintPaymentJobId = 0;
    document.body.style.overflow = '';
}

function syncOfficerPrintMarkPaidModal() {
    const barcode = String(document.getElementById('officerPrintPaymentOfficerBarcode')?.value || '').trim();
    const submit = document.getElementById('officerPrintMarkPaidSubmit');
    if (submit) submit.disabled = submit.dataset.busy === '1' || !officerPrintPaymentJobId || !barcode;
}

function playOfficerPrintingBarcodeBeep() {
    const beep = document.getElementById('officerPrintingBarcodeBeep');
    if (!beep) return;
    beep.currentTime = 0;
    const playback = beep.play();
    if (playback && typeof playback.catch === 'function') {
        playback.catch(() => { /* The browser may block audio before user interaction. */ });
    }
}

function processOfficerPrintPaymentBarcode() {
    const input = document.getElementById('officerPrintPaymentOfficerBarcode');
    const barcode = String(input?.value || '').trim();
    if (!officerPrintPaymentJobId || !barcode) return;
    playOfficerPrintingBarcodeBeep();
    submitOfficerPrintMarkPaid();
}

function handleOfficerPrintPaymentBarcodeInput() {
    syncOfficerPrintMarkPaidModal();
    const error = document.getElementById('officerPrintMarkPaidError');
    if (error) error.style.display = 'none';
    if (officerPrintPaymentScanTimer) {
        window.clearTimeout(officerPrintPaymentScanTimer);
    }
    const barcode = String(document.getElementById('officerPrintPaymentOfficerBarcode')?.value || '').trim();
    if (!barcode) {
        officerPrintPaymentScanTimer = null;
        return;
    }
    officerPrintPaymentScanTimer = window.setTimeout(() => {
        officerPrintPaymentScanTimer = null;
        processOfficerPrintPaymentBarcode();
    }, 180);
}

function handleOfficerPrintPaymentBarcodeKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (officerPrintPaymentScanTimer) {
        window.clearTimeout(officerPrintPaymentScanTimer);
        officerPrintPaymentScanTimer = null;
    }
    processOfficerPrintPaymentBarcode();
}

async function submitOfficerPrintMarkPaid() {
    const printJobId = officerPrintPaymentJobId;
    const barcode = String(document.getElementById('officerPrintPaymentOfficerBarcode')?.value || '').trim();
    const submit = document.getElementById('officerPrintMarkPaidSubmit');
    const error = document.getElementById('officerPrintMarkPaidError');
    if (!printJobId || !barcode || submit?.dataset.busy === '1') return;
    if (submit) {
        submit.dataset.busy = '1';
        submit.disabled = true;
        submit.textContent = 'Saving...';
    }
    if (error) error.style.display = 'none';
    try {
        const response = await fetch('../api/printing/officer/mark-paid.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ print_job_id: printJobId, officer_identifier: barcode })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not mark the printing payment as paid.');
        closeOfficerPrintMarkPaidModal();
        await loadOfficerPrintingQueue(true);
        await loadOfficerFinancialSummary(true).catch(() => {});
        showOfficerPrintingHistoryView();
        showToast('Printing payment marked as paid.', 'success');
    } catch (paymentError) {
        if (error) {
            error.textContent = paymentError.message || 'Could not mark the printing payment as paid.';
            error.style.display = 'block';
        }
        const barcodeInput = document.getElementById('officerPrintPaymentOfficerBarcode');
        if (barcodeInput) {
            barcodeInput.value = '';
            window.setTimeout(() => barcodeInput.focus(), 0);
        }
        syncOfficerPrintMarkPaidModal();
    } finally {
        if (submit) {
            delete submit.dataset.busy;
            submit.textContent = 'Mark as Paid';
            syncOfficerPrintMarkPaidModal();
        }
    }
}

async function updateOfficerPrintJobStatus(printJobId, status, paymentData = {}, suppressAlert = false) {
    const loadingCopy = {
        processing: {
            title: 'Starting print job',
            message: 'Updating the request to processing and notifying the student...'
        },
        ready_to_claim: {
            title: 'Marking document ready',
            message: 'Updating the request to ready to claim and notifying the student...'
        },
        claimed: {
            title: 'Completing print job',
            message: 'Marking the printed document as claimed...'
        },
        cancelled: {
            title: 'Cancelling print request',
            message: 'Cancelling the request and notifying the student...'
        }
    };
    setOfficerPrintingQueueLoading(true, loadingCopy[String(status || '').toLowerCase()] || {
        title: 'Updating print job',
        message: 'Saving the new printing status...'
    });
    try {
        const response = await fetch('../api/printing/officer/update-status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                print_job_id: printJobId,
                status,
                ...paymentData,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not update print job status.');
        }
        await loadOfficerPrintingQueue(true);
        loadOfficerActionCenter(false);
        if (String(status || '').toLowerCase() === 'claimed') {
            loadOfficerFinancialSummary(true).catch(() => {});
        }
        return { ok: true, item: data.item || null };
    } catch (error) {
        setOfficerPrintingQueueLoading(false);
        showOfficerPrintingQueueView();
        if (!suppressAlert) alert(error.message || 'Could not update print job status.');
        return { ok: false, error: error.message || 'Could not update print job status.' };
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
    setOfficerPrintingQueueLoading(true, {
        title: 'Updating queue priority',
        message: 'Moving the print request to its new queue position...'
    });
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
        setOfficerPrintingQueueLoading(false);
        showOfficerPrintingQueueView();
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
                            class="locker-tile state-${getLockerStateClass(locker.state)}${locker.pendingSync ? ' naap-optimistic-record' : ''}"
                            ${locker.pendingSync ? `data-offline-status="${locker.offlineStatus === 'attention' ? 'attention' : 'queued'}" title="${locker.offlineStatus === 'attention' ? 'Needs attention before syncing' : 'Queued offline'}"` : ''}
                            onclick="openLockerDetail('${escapeHtml(String(locker.locker_code || ''))}')">
                            <span class="locker-tile-door-line"></span>
                            <span class="locker-tile-door-line locker-tile-door-line-bottom"></span>
                            <span class="locker-tile-code">${escapeHtml(locker.locker_code || '')}</span>
                            <span class="locker-tile-state">${escapeHtml(getLockerStateLabel(locker.state))}</span>
                            ${locker.pendingSync ? `<span class="naap-optimistic-badge" data-offline-status="${locker.offlineStatus === 'attention' ? 'attention' : 'queued'}">${locker.offlineStatus === 'attention' ? 'Needs attention' : 'Pending sync'}</span>` : ''}
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
        await applyQueuedLockerOperations();
        renderOfficerLockerBoard();
        return officerLockerBoard;
    } catch (error) {
        if (force) {
            console.error('[loadOfficerLockerBoard]', error);
        }
        if (!officerLockerBoard.length) renderOfficerLockerBoard();
        throw error;
    }
}

function isOfficerLockerAutoRefreshActive() {
    return officerLockerEnabled
        && currentTrackerSubView === 'lockers'
        && document.getElementById('tracker')?.classList.contains('active') === true;
}

function stopOfficerLockerAutoRefresh() {
    if (officerLockerAutoRefreshTimer) {
        window.clearTimeout(officerLockerAutoRefreshTimer);
        officerLockerAutoRefreshTimer = null;
    }
}

function scheduleOfficerLockerAutoRefresh() {
    stopOfficerLockerAutoRefresh();
    if (!isOfficerLockerAutoRefreshActive()) return;
    const delay = document.hidden ? OFFICER_LOCKER_POLL_SLOW_MS : OFFICER_LOCKER_POLL_FAST_MS;
    officerLockerAutoRefreshTimer = window.setTimeout(() => {
        officerLockerAutoRefreshTimer = null;
        pollOfficerLockerBoard().catch(() => {});
    }, delay);
}

async function pollOfficerLockerBoard() {
    if (!isOfficerLockerAutoRefreshActive()) return;
    if (document.getElementById('lockerDetailModal')?.classList.contains('show')) {
        scheduleOfficerLockerAutoRefresh();
        return;
    }
    if (officerLockerAutoRefreshInFlight) return scheduleOfficerLockerAutoRefresh();
    officerLockerAutoRefreshInFlight = true;
    try {
        await loadOfficerLockerBoard(false);
    } finally {
        officerLockerAutoRefreshInFlight = false;
        scheduleOfficerLockerAutoRefresh();
    }
}

function startOfficerLockerAutoRefresh({ refreshNow = false } = {}) {
    stopOfficerLockerAutoRefresh();
    if (!isOfficerLockerAutoRefreshActive()) return;
    if (refreshNow) {
        pollOfficerLockerBoard().catch(() => {});
        return;
    }
    scheduleOfficerLockerAutoRefresh();
}

async function applyQueuedLockerOperations() {
    if (!window.NAAPOffline?.listQueuedOperations) return;
    const types = ['locker.approve', 'locker.reject', 'locker.release', 'locker.manual_assign',
        'locker.pricing', 'locker.notice', 'locker.clear_notice', 'rental.mark_paid'];
    const queued = await window.NAAPOffline.listQueuedOperations(types);
    queued.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach(operation => {
        const payload = operation.payload || {};
        let locker = officerLockerBoard.find(item => Number(item.item_id || 0) === Number(payload.item_id || 0));
        if (!locker && Number(payload.rental_id || 0) > 0) {
            locker = officerLockerBoard.find(item => Number(item.current_request?.rental_id || 0) === Number(payload.rental_id));
        }
        if (!locker) return;
        locker.pendingSync = true;
        locker.offlineStatus = operation.status;
        locker.offlineOperationId = operation.operationId;
        if (operation.type === 'locker.pricing') {
            locker.locker_monthly_rate = payload.locker_monthly_rate;
            locker.locker_semester_rate = payload.locker_semester_rate;
            locker.locker_school_year_rate = payload.locker_school_year_rate;
        } else if (operation.type === 'locker.reject' || operation.type === 'locker.release') {
            locker.state = 'available';
            locker.current_request = null;
        } else if (operation.type === 'locker.approve') {
            locker.state = 'occupied';
            locker.current_request = {
                ...(locker.current_request || {}),
                locker_period_type: payload.period_type,
                locker_period_quantity: Number(payload.period_quantity || 1),
                rent_time: payload.start_date,
                expected_return_time: payload.end_date,
                total_cost: payload.price,
                pending_sync: true
            };
        } else if (operation.type === 'locker.manual_assign') {
            locker.state = 'occupied';
            locker.current_request = {
                rental_id: 0,
                student_name: payload.student_name || 'Selected student',
                student_number: payload.student_number || '',
                section: payload.section || '',
                locker_period_type: payload.period_type,
                locker_period_quantity: Number(payload.period_quantity || 1),
                rent_time: payload.start_date,
                expected_return_time: payload.end_date,
                total_cost: payload.price,
                payment_status: 'unpaid',
                pending_sync: true
            };
        } else if (operation.type === 'locker.notice' && locker.current_request) {
            const prefix = payload.notice_type === 'upcoming' ? 'upcoming' : 'overdue';
            locker.current_request[`${prefix}_notice_sent_at`] = operation.createdAt;
            locker.current_request[`${prefix}_notice_message`] = payload.message || '';
        } else if (operation.type === 'locker.clear_notice' && locker.current_request) {
            ['upcoming', 'overdue'].forEach(prefix => {
                locker.current_request[`${prefix}_notice_sent_at`] = null;
                locker.current_request[`${prefix}_notice_message`] = null;
            });
        } else if (operation.type === 'rental.mark_paid' && locker.current_request) {
            locker.current_request.payment_status = 'paid';
        }
    });
}

function lockerPeriodQuantityFromDates(periodType, startValue, endValue) {
    if (periodType === 'school_year') return 1;
    const start = new Date(`${String(startValue || '').slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(endValue || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1;
    const calendarMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
    return periodType === 'semester' ? Math.max(1, Math.round(calendarMonths / 5)) : calendarMonths;
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
    const storedPeriodType = String(currentRequest?.locker_period_type || '');
    const periodType = ['monthly', 'semester', 'school_year'].includes(storedPeriodType)
        ? storedPeriodType
        : (storedPeriodType === 'custom' ? 'monthly' : '');
    const startDateValue = currentRequest?.rent_time ? String(currentRequest.rent_time).slice(0, 10) : '';
    const endDateValue = currentRequest?.expected_return_time ? String(currentRequest.expected_return_time).slice(0, 10) : '';
    const periodQuantity = Number(currentRequest?.locker_period_quantity || 0)
        || lockerPeriodQuantityFromDates(periodType, startDateValue, endDateValue);
    setValue('lockerDetailPeriodType', periodType);
    setValue('lockerDetailPeriodQuantity', Math.max(1, periodQuantity));
    setValue('lockerDetailStartDate', startDateValue);
    setValue('lockerDetailEndDate', endDateValue);
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
    const rentalTransactionComplete = hasLockerRental
        && !locker.pendingSync
        && ['occupied', 'overdue'].includes(String(locker.state || '').toLowerCase());
    const isPaidLockerRental = hasLockerRental && String(currentRequest?.payment_status || 'unpaid').toLowerCase() === 'paid';
    if (approveBtn) approveBtn.style.display = locker.state === 'pending' ? 'inline-flex' : 'none';
    if (manualAssignBtn) manualAssignBtn.style.display = locker.state === 'available' ? 'inline-flex' : 'none';
    if (confirmRentalBtn) confirmRentalBtn.style.display = 'none';
    if (rejectBtn) rejectBtn.style.display = locker.state === 'pending' ? 'inline-flex' : 'none';
    if (clearNoticeBtn) clearNoticeBtn.style.display = hasActiveNotice ? 'inline-flex' : 'none';
    if (markPaidBtn) {
        markPaidBtn.style.display = rentalTransactionComplete ? 'inline-flex' : 'none';
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
    if (!beginLockerTransaction('Assigning locker', 'Saving the student assignment and rental details...')) return;

    const lockerCode = String(selectedLockerTile.locker_code || '');
    try {
        const response = await fetch('../api/lockers/officer/manual-assign.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                item_id: selectedLockerTile.item_id,
                student_user_id: selectedLockerAssignStudent.user_id,
                locker_code: lockerCode,
                student_name: selectedLockerAssignStudent.studentName || '',
                student_number: selectedLockerAssignStudent.studentId || '',
                section: selectedLockerAssignStudent.section || '',
                period_type: document.getElementById('lockerDetailPeriodType')?.value || '',
                period_quantity: document.getElementById('lockerDetailPeriodQuantity')?.value || 1,
                start_date: document.getElementById('lockerDetailStartDate')?.value || '',
                end_date: document.getElementById('lockerDetailEndDate')?.value || '',
                price: document.getElementById('lockerDetailPrice')?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not assign the locker.');
        }
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerAssignStudentModal();
        openLockerDetail(lockerCode);
        loadOfficerActionCenter(false);
    } catch (error) {
        alert(error.message || 'Could not assign the locker.');
    } finally {
        await finishLockerTransaction();
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
    if (!beginLockerTransaction('Adding locker', 'Creating the locker and applying its starting rates...')) return;
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
    } finally {
        await finishLockerTransaction();
    }
}

function syncLockerAssignmentPreview(changedField = '') {
    if (!selectedLockerTile) return;

    const periodType = document.getElementById('lockerDetailPeriodType')?.value || '';
    const startInput = document.getElementById('lockerDetailStartDate');
    const endInput = document.getElementById('lockerDetailEndDate');
    const priceInput = document.getElementById('lockerDetailPrice');
    const quantityField = document.getElementById('lockerDetailQuantityField');
    const quantityLabel = document.getElementById('lockerDetailQuantityLabel');
    const quantityInput = document.getElementById('lockerDetailPeriodQuantity');
    const periodHelp = document.getElementById('lockerPeriodHelp');
    if (!startInput || !endInput || !priceInput || !quantityInput) return;

    if (!periodType) {
        if (quantityField) quantityField.style.display = 'none';
        endInput.value = '';
        priceInput.value = '';
        return;
    }

    const usesQuantity = periodType === 'monthly' || periodType === 'semester';
    if (quantityField) quantityField.style.display = usesQuantity ? '' : 'none';
    if (quantityLabel) quantityLabel.textContent = periodType === 'semester' ? 'Number of Semesters' : 'Number of Months';
    quantityInput.max = periodType === 'semester' ? '8' : '24';
    let quantity = periodType === 'school_year' ? 1 : Math.trunc(Number(quantityInput.value || 1));
    const maximum = periodType === 'semester' ? 8 : 24;
    quantity = Math.min(maximum, Math.max(1, Number.isFinite(quantity) ? quantity : 1));
    quantityInput.value = String(quantity);
    const allowsCustomEndDate = periodType === 'semester' || periodType === 'school_year';
    endInput.readOnly = !allowsCustomEndDate;
    if (periodHelp) {
        periodHelp.textContent = allowsCustomEndDate
            ? 'A suggested end date is provided. You may adjust it if the academic schedule differs.'
            : 'Calculated automatically from the selected number of months.';
    }

    let startValue = String(startInput.value || '').trim();
    if (!startValue) {
        const today = new Date();
        const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        startInput.value = todayValue;
        startValue = todayValue;
    }

    const startDate = new Date(`${startValue}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) return;
    const periodMonths = { monthly: 1, semester: 5, school_year: 10 };
    const rateByPeriod = {
        monthly: Number(document.getElementById('lockerMonthlyRate')?.value || selectedLockerTile.locker_monthly_rate || 0),
        semester: Number(document.getElementById('lockerSemesterRate')?.value || selectedLockerTile.locker_semester_rate || 0),
        school_year: Number(document.getElementById('lockerSchoolYearRate')?.value || selectedLockerTile.locker_school_year_rate || 0)
    };
    const formatLocalDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const shouldResetEndDate = !allowsCustomEndDate
        || ['period', 'start', 'quantity'].includes(changedField)
        || !endInput.value;
    if (shouldResetEndDate) {
        const endDate = new Date(startDate.getTime());
        endDate.setMonth(endDate.getMonth() + periodMonths[periodType] * quantity);
        endInput.value = formatLocalDate(endDate);
    }
    const chosenEndDate = new Date(`${String(endInput.value || '').trim()}T00:00:00`);
    const invalidEndDate = Number.isNaN(chosenEndDate.getTime()) || chosenEndDate <= startDate;
    endInput.setCustomValidity(invalidEndDate ? 'End date must be after the start date.' : '');
    priceInput.setCustomValidity(invalidEndDate ? 'Choose a valid end date.' : '');
    if (invalidEndDate) {
        priceInput.value = '';
        return;
    }
    priceInput.value = (rateByPeriod[periodType] * quantity).toFixed(2);
}

async function saveLockerPricing() {
    if (!selectedLockerTile) return;
    if (!beginLockerTransaction('Saving shared rates', 'Updating the monthly, semester, and school-year rates...')) return;
    try {
        const response = await fetch('../api/lockers/officer/pricing.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                item_id: selectedLockerTile.item_id,
                locker_code: selectedLockerTile.locker_code || '',
                locker_monthly_rate: document.getElementById('lockerMonthlyRate')?.value || 0,
                locker_semester_rate: document.getElementById('lockerSemesterRate')?.value || 0,
                locker_school_year_rate: document.getElementById('lockerSchoolYearRate')?.value || 0
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not save locker rates.');
        }
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : officerLockerBoard;
        renderOfficerLockerBoard();
        openLockerDetail(selectedLockerTile.locker_code);
    } catch (error) {
        alert(error.message || 'Could not save locker rates.');
    } finally {
        await finishLockerTransaction();
    }
}

async function approveLockerAssignment() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    if (!beginLockerTransaction('Approving locker request', 'Confirming the assignment, rental period, and student notification...')) return;
    try {
        const response = await fetch('../api/lockers/officer/approve.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id,
                period_type: document.getElementById('lockerDetailPeriodType')?.value || '',
                period_quantity: document.getElementById('lockerDetailPeriodQuantity')?.value || 1,
                start_date: document.getElementById('lockerDetailStartDate')?.value || '',
                end_date: document.getElementById('lockerDetailEndDate')?.value || '',
                price: document.getElementById('lockerDetailPrice')?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not approve locker assignment.');
        }
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerDetailModal();
        loadOfficerActionCenter(false);
    } catch (error) {
        alert(error.message || 'Could not approve locker assignment.');
    } finally {
        await finishLockerTransaction();
    }
}

async function releaseLockerAssignment() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    if (!beginLockerTransaction('Releasing locker', 'Completing the rental and preparing the student notification...')) return;
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
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerReleaseConfirmModal();
        closeLockerDetailModal();
        loadOfficerActionCenter(false);
    } catch (error) {
        alert(error.message || 'Could not release locker assignment.');
    } finally {
        await finishLockerTransaction();
    }
}

async function clearLockerNotice() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const lockerCode = String(selectedLockerTile.locker_code || '');
    if (!beginLockerTransaction('Clearing locker notice', 'Removing the current notice from the locker record...')) return;
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
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        openLockerDetail(lockerCode);
    } catch (error) {
        alert(error.message || 'Could not clear the notice.');
    } finally {
        await finishLockerTransaction();
    }
}

function openLockerPaymentScanModal() {
    const request = selectedLockerTile?.current_request;
    if (!request?.rental_id || String(request.payment_status || 'unpaid').toLowerCase() === 'paid') return;
    const modal = document.getElementById('lockerPaymentScanModal');
    const input = document.getElementById('lockerPaymentOfficerBarcode');
    const title = document.getElementById('lockerPaymentScanTitle');
    const meta = document.getElementById('lockerPaymentScanMeta');
    if (title) title.textContent = `Locker ${selectedLockerTile.locker_code || '-'}`;
    if (meta) meta.textContent = `${request.student_name || 'Unnamed Student'} · ${request.student_number || '-'} · ₱${Number(request.total_cost || 0).toFixed(2)}`;
    if (input) input.value = '';
    modal?.classList.add('show');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => input?.focus(), 80);
}

function closeLockerPaymentScanModal() {
    const modal = document.getElementById('lockerPaymentScanModal');
    modal?.classList.remove('show');
    const input = document.getElementById('lockerPaymentOfficerBarcode');
    if (input) input.value = '';
    const lockerModal = document.getElementById('lockerDetailModal');
    if (!lockerModal?.classList.contains('show')) document.body.style.overflow = '';
}

async function markLockerAssignmentPaid() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const lockerCode = String(selectedLockerTile.locker_code || '');
    const officerIdentifier = String(document.getElementById('lockerPaymentOfficerBarcode')?.value || '').trim();
    if (!officerIdentifier) {
        showToast('Scan a valid officer barcode before marking the payment as paid.', 'error');
        document.getElementById('lockerPaymentOfficerBarcode')?.focus();
        return;
    }
    if (!beginLockerTransaction('Recording locker payment', 'Validating the officer barcode and saving the payment...')) return;
    try {
        const response = await fetch('../api/igp/rentals/mark-paid.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id,
                officer_identifier: officerIdentifier
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not mark the locker rental as paid.');
        }
        closeLockerPaymentScanModal();
        await loadOfficerLockerBoard(true);
        openLockerDetail(lockerCode);
        showToast('Locker rental marked as paid.', 'success');
    } catch (error) {
        showToast(error.message || 'Could not mark the locker rental as paid.', 'error');
    } finally {
        await finishLockerTransaction();
    }
}

async function rejectLockerRequest() {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    if (!beginLockerTransaction('Rejecting locker request', 'Updating the request and preparing the student notification...')) return;
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
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        closeLockerDetailModal();
    } catch (error) {
        alert(error.message || 'Could not reject locker request.');
    } finally {
        await finishLockerTransaction();
    }
}

async function sendLockerNotice(noticeType) {
    if (!selectedLockerTile?.current_request?.rental_id) return;
    const normalizedType = String(noticeType || '').toLowerCase() === 'upcoming' ? 'upcoming' : 'overdue';
    const messageFieldId = 'lockerNoticeComposerMessage';
    if (!beginLockerTransaction(
        normalizedType === 'upcoming' ? 'Sending ending-soon notice' : 'Sending pull-out notice',
        'Saving the notice and preparing its email delivery...'
    )) return;
    try {
        const response = await fetch('../api/lockers/officer/notice.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                rental_id: selectedLockerTile.current_request.rental_id,
                locker_code: selectedLockerTile.locker_code || '',
                notice_type: normalizedType,
                message: document.getElementById(messageFieldId)?.value || ''
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || `Could not send the ${normalizedType === 'upcoming' ? 'upcoming' : 'pull-out'} notice.`);
        }
        if (data.queued) await applyQueuedLockerOperations();
        else officerLockerBoard = Array.isArray(data.lockers) ? data.lockers : [];
        renderOfficerLockerBoard();
        openLockerDetail(selectedLockerTile.locker_code);
    } catch (error) {
        alert(error.message || `Could not send the ${normalizedType === 'upcoming' ? 'upcoming' : 'pull-out'} notice.`);
    } finally {
        await finishLockerTransaction();
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

function getRentalDashboardStatusClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'reserved') return 'status-pending';
    if (normalized === 'overdue') return 'status-overdue';
    if (normalized === 'returned') return 'status-returned';
    return 'status-borrowed';
}

function getRentalDashboardStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'reserved') return 'Reserved';
    if (normalized === 'overdue') return 'Overdue';
    if (normalized === 'returned') return 'Returned';
    return 'Active';
}

function renderRentals() {
    const dashTable = document.getElementById('dashboard-rentals-table');
    if (!dashTable) return;

    const scopedRentals = getOfficerScopedRentals();
    if (scopedRentals.length === 0) {
        dashTable.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center; color: var(--muted);">No active rentals or services right now.</td>
        </tr>`;
        setActiveRentalsCount(0);
        return;
    }

    dashTable.innerHTML = scopedRentals.map(item => {
        const badgeClass = getRentalDashboardStatusClass(item.status);
        return `
        <tr>
            <td>${escapeHtml(item.item || '-')}</td>
            <td>${escapeHtml(item.renter || '-')}</td>
            <td>${escapeHtml(item.due || '-')}</td>
            <td><span class="status-badge ${badgeClass}">${escapeHtml(getRentalDashboardStatusLabel(item.status))}</span></td>
        </tr>`;
    }).join('');

    setActiveRentalsCount(scopedRentals.length);

    if (typeof refreshAnalyticsCharts === 'function') {
        refreshAnalyticsCharts();
    }
}

async function loadRentalsFromApi() {
    const dashTable = document.getElementById('dashboard-rentals-table');
    if (dashTable) {
        dashTable.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center; color: var(--muted);">Loading active rentals...</td>
        </tr>`;
    }
    setActiveRentalsCount(0);

    if (!window.igpApi || typeof window.igpApi.getRentals !== 'function') {
        if (dashTable) {
            dashTable.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--muted);">IGP rental service is unavailable.</td>
            </tr>`;
        }
        return;
    }

    try {
        const res = await window.igpApi.getRentals({});
        const items = res.items || [];

        const analyticsRentals = items.map(item => ({
            rental_id: Number(item.rental_id || 0),
            item: String(item.items_label || '-').replace(/\s*\[[^\]]+\]\s*$/, '').trim() || '-',
            itemsLabel: String(item.items_label || '').trim(),
            renter: item.renter_name || '-',
            renterIdentifier: item.renter_student_number || '',
            borrowedAt: item.rent_time || null,
            due: fmtDateShort(item.expected_return_time),
            dueAt: item.expected_return_time || null,
            status: item.status || 'active',
            org: item.org_id
        }));
        if (typeof officerAnalyticsState !== 'undefined') {
            officerAnalyticsState.liveRentals = analyticsRentals;
        }
        rentalsData = analyticsRentals.filter((item) => String(item.status).toLowerCase() === 'active');

        if (typeof initializeOfficerAnalyticsYearOptions === 'function') {
            initializeOfficerAnalyticsYearOptions();
        }
        renderRentals();
    } catch (e) {
        console.error('loadRentalsFromApi failed', e);
        rentalsData = [];
        if (typeof officerAnalyticsState !== 'undefined') {
            officerAnalyticsState.liveRentals = [];
        }
        setActiveRentalsCount(0);
        if (dashTable) {
            dashTable.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--muted);">Could not load active rentals from the database.</td>
            </tr>`;
        }
    }
}

function loadMockActiveRentals() {
    const orgId = Number(readAuthSession().active_org_id || 0) || getActiveOfficerOrgName();
    rentalsData = [
        {
            item: 'Canon EOS 1500D Camera',
            renter: 'Maria Santos',
            due: fmtDateShort(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()),
            dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            org: orgId
        },
        {
            item: 'Wireless Microphone Set',
            renter: 'John Dela Cruz',
            due: fmtDateShort(new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()),
            dueAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            org: orgId
        },
        {
            item: 'Projector with HDMI Cable',
            renter: 'Angela Reyes',
            due: fmtDateShort(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            org: orgId
        },
        {
            item: 'Event Sound System Package',
            renter: 'Mark Villanueva',
            due: fmtDateShort(new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString()),
            dueAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            org: orgId
        }
    ];
    renderRentals();
}

// --- MODAL FUNCTIONS ---

function normalizeDocumentTypeCategory(value) {
    const raw = String(value || '').trim();
    const aliases = {
        'proposal': 'Event Proposal',
        'event proposal': 'Event Proposal',
    };
    return aliases[raw.toLowerCase()] || raw || 'Others';
}

function getDocumentTypeDisplay(category, customType = '') {
    const normalizedCategory = normalizeDocumentTypeCategory(category);
    return normalizedCategory === 'Others' && String(customType || '').trim()
        ? `Others: ${String(customType).trim()}`
        : normalizedCategory;
}

function formatDocumentWorkflowStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    const labels = {
        adviser_pending: 'Adviser Pending',
        adviser_approved: 'Adviser Approved',
        pending: 'Pending',
        ssc_approved: 'SSC Approved',
        sent_to_osa: 'Sent to OSA',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
    };
    return labels[normalized] || normalized.replace(/_/g, ' ');
}

function toggleCustomDocumentTypeField() {
    const typeSelect = document.getElementById('doc-type');
    const field = document.getElementById('doc-custom-type-field');
    const input = document.getElementById('doc-custom-type');
    if (!typeSelect || !field || !input) return;
    const isOthers = typeSelect.value === 'Others';
    field.hidden = !isOthers;
    input.required = isOthers;
    if (!isOthers) input.value = '';
}

function syncDocumentRecipientOptions() {
    const recipientInput = document.getElementById('doc-recipient');
    const routeText = document.querySelector('#doc-review-route span');
    const isSscOfficer = isActiveOfficerSscOrganization();
    const recipient = 'ADVISER';
    if (recipientInput) recipientInput.value = recipient;
    if (routeText) {
        routeText.textContent = isSscOfficer
            ? 'Organization Adviser → Office of Student Affairs (OSA)'
            : 'Organization Adviser → Supreme Student Council (SSC) → Office of Student Affairs (OSA)';
    }
}

function openSubmitModal() {
    const form = document.getElementById('doc-form');
    if (form) form.reset();
    const revisionInput = document.getElementById('doc-revision-of');
    if (revisionInput) revisionInput.value = '';
    const heading = document.getElementById('submit-doc-modal-title');
    if (heading) heading.textContent = 'Submit Document';
    const submitLabel = document.getElementById('doc-submit-button-label');
    if (submitLabel) submitLabel.textContent = 'Submit';
    syncDocumentRecipientOptions();
    toggleCustomDocumentTypeField();
    updateFileUploadLabel(document.getElementById('doc-file-input'));
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.add('show');
}

function openDocumentRevisionModal(submissionId) {
    const doc = docsData.find(item => Number(item.submission_id || item.id) === Number(submissionId));
    if (!doc) {
        alert('The document could not be found. Refresh and try again.');
        return;
    }
    if (doc.hasNewerVersion) {
        alert('A newer revision already exists for this document.');
        return;
    }

    const form = document.getElementById('doc-form');
    if (form) form.reset();
    document.getElementById('doc-revision-of').value = String(submissionId);
    syncDocumentRecipientOptions();
    document.getElementById('doc-type').value = doc.typeCategory || 'Activity Report';
    document.getElementById('doc-custom-type').value = doc.customDocumentType || '';
    toggleCustomDocumentTypeField();
    document.getElementById('doc-title').value = doc.title || '';
    document.getElementById('doc-description').value = doc.description || '';
    document.getElementById('submit-doc-modal-title').textContent = `Submit Revision (Version ${Number(doc.versionNumber || 1) + 1})`;
    document.getElementById('doc-submit-button-label').textContent = 'Submit Revision';
    updateFileUploadLabel(document.getElementById('doc-file-input'));
    document.getElementById('submit-doc-modal').classList.add('show');
}

function closeSubmitModal() {
    const modal = document.getElementById('submit-doc-modal');
    modal.classList.remove('show');
    // Reset file upload label on close
    const label = document.getElementById('file-upload-label');
    if (label) label.textContent = ' Click to upload PDF';
    const fileInput = document.getElementById('doc-file-input');
    if (fileInput) fileInput.value = '';
    toggleCustomDocumentTypeField();
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

let pendingOfficerDocumentReview = null;

function openOfficerDocumentReviewModal(submissionId, decision) {
    const normalizedDecision = String(decision || '').toLowerCase();
    if (!['approved', 'rejected'].includes(normalizedDecision)) return;

    const modalId = normalizedDecision === 'approved'
        ? 'officer-document-approve-modal'
        : 'officer-document-reject-modal';
    const textareaId = normalizedDecision === 'approved'
        ? 'officer-document-approve-notes'
        : 'officer-document-reject-notes';
    const modal = document.getElementById(modalId);
    const textarea = document.getElementById(textareaId);
    if (!modal || !textarea) return;

    pendingOfficerDocumentReview = {
        submissionId: Number(submissionId) || 0,
        decision: normalizedDecision,
    };
    const rejectCopy = document.getElementById('officer-document-reject-copy');
    if (rejectCopy) {
        rejectCopy.textContent = isOrganizationAdviserDocumentReviewer()
            ? 'A rejection comment is required so the officer can prepare a corrected revision.'
            : 'You can add an optional reviewer note before rejecting.';
    }
    if (normalizedDecision === 'rejected') {
        textarea.placeholder = isOrganizationAdviserDocumentReviewer()
            ? 'Required rejection explanation...'
            : 'Optional comments...';
    }
    if (!pendingOfficerDocumentReview.submissionId) return;
    textarea.value = '';
    modal.classList.add('show');
    textarea.focus();
}

function closeOfficerDocumentReviewModal() {
    ['officer-document-approve-modal', 'officer-document-reject-modal'].forEach((id) => {
        document.getElementById(id)?.classList.remove('show');
    });
    ['officer-document-approve-notes', 'officer-document-reject-notes'].forEach((id) => {
        const textarea = document.getElementById(id);
        if (textarea) textarea.value = '';
    });
    pendingOfficerDocumentReview = null;
}

async function confirmOfficerDocumentReview() {
    if (!pendingOfficerDocumentReview) return;
    const { submissionId, decision } = pendingOfficerDocumentReview;
    const textareaId = decision === 'approved'
        ? 'officer-document-approve-notes'
        : 'officer-document-reject-notes';
    const buttonId = decision === 'approved'
        ? 'officer-document-approve-confirm'
        : 'officer-document-reject-confirm';
    const notes = (document.getElementById(textareaId)?.value || '').trim();
    if (decision === 'rejected' && isOrganizationAdviserDocumentReviewer() && !notes) {
        showToast('A rejection comment is required.', 'error');
        document.getElementById(textareaId)?.focus();
        return;
    }
    const confirmButton = document.getElementById(buttonId);
    if (confirmButton) confirmButton.disabled = true;

    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/review.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                submission_id: submissionId,
                decision,
                notes,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not review this document.');
        }

        closeOfficerDocumentReviewModal();
        await Promise.all([loadDocsFromApi(), loadRepoFromApi()]);
        loadOfficerActionCenter(false);
        showToast(`Document ${decision === 'approved' ? 'approved' : 'rejected'} successfully.`, decision === 'approved' ? 'success' : 'info');
    } catch (error) {
        showToast(error.message || 'Could not review this document.', 'error');
    } finally {
        if (confirmButton) confirmButton.disabled = false;
    }
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
    const approveModal = document.getElementById('officer-document-approve-modal');
    const rejectModal = document.getElementById('officer-document-reject-modal');
    if (event.target === approveModal || event.target === rejectModal) {
        closeOfficerDocumentReviewModal();
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

let officerActiveAcademicTerm = {
    academic_year: getOfficerDefaultAcademicYear(),
    semester: getOfficerDefaultSemester(),
    grading_period: getOfficerDefaultGradingPeriod()
};

function getOfficerDefaultAcademicYear(date = new Date()) {
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

function getOfficerDefaultSemester(date = new Date()) {
    return date.getMonth() >= 5 && date.getMonth() <= 10 ? '1st' : '2nd';
}

function getOfficerDefaultGradingPeriod(date = new Date()) {
    const month = date.getMonth();
    if ([5, 6, 11, 0].includes(month)) return 'prelim';
    if ([7, 8, 1, 2].includes(month)) return 'midterm';
    return 'finals';
}

function normalizeOfficerAcademicTerm(term = {}) {
    return {
        academic_year: String(term.academic_year || term.academicYear || officerActiveAcademicTerm.academic_year).trim(),
        semester: String(term.semester || officerActiveAcademicTerm.semester).trim(),
        grading_period: String(term.grading_period || term.gradingPeriod || officerActiveAcademicTerm.grading_period).trim().toLowerCase()
    };
}

function buildOfficerAcademicYearOptions(selectedYear = '') {
    const currentStartYear = Number(getOfficerDefaultAcademicYear().slice(0, 4));
    const options = Array.from({ length: 3 }, (_item, index) => {
        const startYear = currentStartYear + index;
        return `${startYear}-${startYear + 1}`;
    });
    if (selectedYear && !options.includes(selectedYear)) options.push(selectedYear);
    return options.sort();
}

function populateOfficerAcademicYearSelect(select, selectedYear) {
    if (!select) return;
    const options = buildOfficerAcademicYearOptions(selectedYear || officerActiveAcademicTerm.academic_year);
    select.innerHTML = options.map((academicYear) => (
        `<option value="${academicYear}">${academicYear}</option>`
    )).join('');
    if (selectedYear) select.value = selectedYear;
}

function syncOfficerDocsTermControlsToActive() {
    const yearSelect = document.getElementById('docs-filter-year');
    const semesterSelect = document.getElementById('docs-filter-sem');
    const periodSelect = document.getElementById('docs-filter-period');
    populateOfficerAcademicYearSelect(yearSelect, officerActiveAcademicTerm.academic_year);
    if (semesterSelect) semesterSelect.value = officerActiveAcademicTerm.semester;
    if (periodSelect) periodSelect.value = officerActiveAcademicTerm.grading_period;
}

function syncOfficerRepoTermControlsToActive() {
    const yearSelect = document.getElementById('repo-filter-year');
    const semesterSelect = document.getElementById('repo-filter-sem');
    const periodSelect = document.getElementById('repo-filter-period');
    populateOfficerAcademicYearSelect(yearSelect, officerActiveAcademicTerm.academic_year);
    if (semesterSelect) semesterSelect.value = officerActiveAcademicTerm.semester;
    if (periodSelect) periodSelect.value = officerActiveAcademicTerm.grading_period;
}

async function loadOfficerActiveAcademicTerm() {
    try {
        const response = await fetch(OFFICER_ACADEMIC_TERM_API, { credentials: 'same-origin' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load active academic term.');
        }
        officerActiveAcademicTerm = normalizeOfficerAcademicTerm(data.term || {});
    } catch (error) {
        console.error('[loadOfficerActiveAcademicTerm]', error);
    } finally {
        syncOfficerDocsTermControlsToActive();
        syncOfficerRepoTermControlsToActive();
        renderDocs(currentDocFilter);
        renderRepoTable();
    }
}

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
    const termSemester = document.getElementById('docs-filter-sem')?.value || officerActiveAcademicTerm.semester;
    const termYear = document.getElementById('docs-filter-year')?.value || officerActiveAcademicTerm.academic_year;
    const termPeriod = document.getElementById('docs-filter-period')?.value || officerActiveAcademicTerm.grading_period;

    // 1. Filter by Status (Existing Logic)
    const uniqueDocuments = new Map();
    getOfficerScopedDocs().forEach(doc => {
        const databaseId = Number(doc.submission_id || doc.id || 0);
        const key = databaseId > 0
            ? `submission:${databaseId}`
            : `offline:${doc.offlineOperationId || `${doc.title}|${doc.submittedAt}`}`;
        const existing = uniqueDocuments.get(key);
        if (!existing || doc.pendingSync) uniqueDocuments.set(key, doc);
    });
    let filteredData = [...uniqueDocuments.values()].filter(doc => {
        if (filter === 'All') return true;
        if (doc.pendingSync) return filter === 'Pending';
        if (filter === 'Pending') return doc.status.includes('Sent')
            || doc.status.includes('Pending')
            || doc.status === 'Adviser Approved'
            || doc.status === 'SSC Approved';
        return doc.status.includes(filter);
    });

    // 2. Filter by Date Range (Updated)
    filteredData = filteredData.filter(doc => (
        String(doc.semester || '').toLowerCase() === String(termSemester).toLowerCase()
        && String(doc.academicYear || '').trim() === String(termYear).trim()
        && String(doc.gradingPeriod || '').toLowerCase() === String(termPeriod).toLowerCase()
    ));

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
        let adviserHtml = '';
        let sscHtml = '';
        let osaHtml = '';
        let actionButtons = '';
        let statusBadge = '';

        const sender = doc.submittedByName || `User #${doc.submittedByUserId ?? 'N/A'}`;
        const adviserReviewerName = doc.adviserReviewerName ? escapeHtml(doc.adviserReviewerName) : '-';
        const sscReviewerName = doc.sscReviewerName ? escapeHtml(doc.sscReviewerName) : '-';
        const osaReviewerName = doc.osaReviewerName ? escapeHtml(doc.osaReviewerName) : '-';
        const recipient = String(doc.recipient || 'OSA').trim().toUpperCase();
        const wasSentToSsc = recipient === 'SSC';
        const isOwnedByActiveOrg = officerOrgMatch(doc.orgId || doc.org);
        const isAdviserReviewer = isOrganizationAdviserDocumentReviewer();
        const canManageDashboard = canManageOrganizationDashboard();
        const canReviewForAdviser = isAdviserReviewer
            && isOwnedByActiveOrg
            && doc.rawStatus === 'adviser_pending';
        const canReviewForSsc = isActiveOfficerSscOrganization()
            && canManageDashboard
            && wasSentToSsc
            && !isOwnedByActiveOrg
            && doc.status === 'Pending';
        const emptyReview = '<span style="color:var(--muted)">-</span>';
        const reviewDate = (value) => value
            ? `<span class="sub-status waiting">${escapeHtml(fmtDateShort(value))}</span>`
            : '';
        const approvedReview = (name, reviewedAt = null) => `<span>${name}</span><span class="sub-status approved"><i class="fa-solid fa-check"></i> Approved</span>${reviewDate(reviewedAt)}`;
        const rejectedReview = (name, reviewedAt = null) => `<span>${name}</span><span class="sub-status rejected"><i class="fa-solid fa-xmark"></i> Rejected</span>${reviewDate(reviewedAt)}`;
        adviserHtml = doc.adviserDecision === 'approved'
            ? approvedReview(adviserReviewerName, doc.adviserReviewedAt)
            : doc.adviserDecision === 'rejected'
                ? rejectedReview(adviserReviewerName, doc.adviserReviewedAt)
                : doc.rawStatus === 'adviser_pending'
                    ? `<span style="color:var(--muted)">-</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`
                    : emptyReview;
        sscHtml = doc.sscDecision === 'approved'
            ? approvedReview(sscReviewerName, doc.sscReviewedAt)
            : doc.sscDecision === 'rejected'
                ? rejectedReview(sscReviewerName, doc.sscReviewedAt)
                : emptyReview;
        osaHtml = doc.osaDecision === 'approved'
            ? approvedReview(osaReviewerName, doc.osaReviewedAt)
            : doc.osaDecision === 'rejected'
                ? rejectedReview(osaReviewerName, doc.osaReviewedAt)
                : emptyReview;
        const stageNoteButtons = [];
        if (doc.adviserReviewerNotes) {
            stageNoteButtons.push(`<button class="btn btn-outline btn-sm document-workflow-action" data-readonly-allow onclick="event.stopPropagation(); openReviewerNoteModal('${encodeURIComponent(doc.adviserReviewerNotes).replace(/'/g, '%27')}')" title="View Adviser Comment" aria-label="View Adviser Comment">
                <i class="fa-regular fa-message"></i><span class="doc-action-label">Adviser Comment</span>
            </button>`);
        }
        if (doc.sscReviewerNotes) {
            stageNoteButtons.push(`<button class="btn btn-outline btn-sm document-workflow-action" data-readonly-allow onclick="event.stopPropagation(); openReviewerNoteModal('${encodeURIComponent(doc.sscReviewerNotes).replace(/'/g, '%27')}')" title="View SSC Comment" aria-label="View SSC Comment">
                <i class="fa-regular fa-message"></i><span class="doc-action-label">SSC Comment</span>
            </button>`);
        }
        if (doc.osaReviewerNotes) {
            stageNoteButtons.push(`<button class="btn btn-outline btn-sm document-workflow-action" data-readonly-allow onclick="event.stopPropagation(); openReviewerNoteModal('${encodeURIComponent(doc.osaReviewerNotes).replace(/'/g, '%27')}')" title="View OSA Comment" aria-label="View OSA Comment">
                <i class="fa-regular fa-message"></i><span class="doc-action-label">OSA Comment</span>
            </button>`);
        }
        if (stageNoteButtons.length === 0 && doc.reviewerNotes) {
            stageNoteButtons.push(`<button class="btn btn-outline btn-sm document-workflow-action" data-readonly-allow onclick="event.stopPropagation(); openReviewerNoteModal('${encodeURIComponent(doc.reviewerNotes).replace(/'/g, '%27')}')" title="View Reviewer Comment" aria-label="View Reviewer Comment">
                <i class="fa-regular fa-message"></i><span class="doc-action-label">Comment</span>
            </button>`);
        }
        const reviewNoteButton = stageNoteButtons.join('');
        const revisionButton = canManageDashboard && isOwnedByActiveOrg && doc.status === 'Rejected' && !doc.hasNewerVersion
            ? `<button class="btn btn-outline btn-sm document-workflow-action" onclick="event.stopPropagation(); openDocumentRevisionModal(${Number(doc.submission_id || doc.id || 0)})" title="Submit Revision" aria-label="Submit Revision">
                    <i class="fa-solid fa-code-branch"></i><span class="doc-action-label">Submit Revision</span>
                </button>`
            : '';
        const canCancel = canManageDashboard && isOwnedByActiveOrg
            && ['Adviser Pending', 'Adviser Approved', 'Pending', 'SSC Approved', 'Sent to OSA'].includes(doc.status);
        const cancelButton = canCancel
            ? `<button class="btn btn-sm btn-danger document-workflow-action" onclick="event.stopPropagation(); cancelDocumentSubmission(${Number(doc.submission_id || doc.id || 0)})" title="Cancel Document" aria-label="Cancel Document">
                    <i class="fa-solid fa-ban"></i><span class="doc-action-label">Cancel</span>
                </button>`
            : '';
        const viewButton = `
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId}')" title="View Document">
                <i class="fa-solid fa-eye"></i>
            </button>`;
        const versionBadge = `<span class="status-badge" style="font-size:0.65rem; padding:2px 6px; margin-left:6px;">v${Number(doc.versionNumber || 1)}</span>`;

        if (doc.pendingSync) {
            const queuedAction = doc.offlineAction || 'submit';
            const queuedLabel = queuedAction === 'review'
                ? `${doc.offlineDecision === 'rejected' ? 'Rejection' : 'Approval'} queued`
                : queuedAction === 'cancel'
                    ? 'Cancellation queued'
                    : queuedAction === 'forward_ssc'
                        ? 'Send to SSC queued'
                        : queuedAction === 'forward_osa'
                            ? 'Send to OSA queued'
                            : 'Not sent yet';
            if (queuedAction === 'submit') {
                adviserHtml = '<span class="naap-optimistic-note">Not sent yet</span>';
                sscHtml = emptyReview;
                osaHtml = emptyReview;
            }
            actionButtons = queuedAction === 'submit' || !doc.viewerId ? '' : viewButton;
            if (queuedAction === 'review' && doc.offlineDecision === 'approved' && canManageDashboard && isOwnedByActiveOrg) {
                if (doc.status === 'Adviser Approved') {
                    const forwardLabel = isActiveOfficerSscOrganization() ? 'Send to OSA' : 'Send to SSC';
                    const forwardAction = isActiveOfficerSscOrganization() ? 'submitToOSA' : 'submitToSSC';
                    actionButtons += `<button class="btn btn-primary btn-sm document-workflow-action" onclick="event.stopPropagation(); ${forwardAction}(${Number(doc.submission_id || doc.id || 0)})" title="${forwardLabel}" aria-label="${forwardLabel}">
                        <span class="doc-action-label">${forwardLabel}</span><i class="fa-solid fa-paper-plane"></i>
                    </button>`;
                } else if (doc.status === 'SSC Approved') {
                    actionButtons += `<button class="btn btn-primary btn-sm document-workflow-action" onclick="event.stopPropagation(); submitToOSA(${Number(doc.submission_id || doc.id || 0)})" title="Send to OSA" aria-label="Send to OSA">
                        <span class="doc-action-label">Send to OSA</span><i class="fa-solid fa-paper-plane"></i>
                    </button>`;
                }
            } else if ((queuedAction === 'forward_ssc' || queuedAction === 'forward_osa') && canCancel) {
                actionButtons += cancelButton;
            }
            const queuedState = doc.offlineStatus === 'attention' ? 'attention' : 'queued';
            statusBadge = `<span class="naap-optimistic-badge" data-offline-status="${queuedState}">${queuedState === 'attention' ? 'Needs attention' : queuedLabel}</span>`;
        }
        else if (doc.status === 'Approved') {
            sscHtml = doc.sscDecision === 'approved' ? approvedReview(sscReviewerName, doc.sscReviewedAt) : emptyReview;
            osaHtml = doc.osaDecision === 'approved' ? approvedReview(osaReviewerName, doc.osaReviewedAt) : (wasSentToSsc ? emptyReview : approvedReview(osaReviewerName, doc.osaReviewedAt));
            actionButtons = `${viewButton}${revisionButton}`;
            statusBadge = '<span class="status-badge status-completed" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Approved</span>';
        }
        else if (doc.status === 'Adviser Approved') {
            sscHtml = emptyReview;
            osaHtml = emptyReview;
            if (canManageDashboard && isOwnedByActiveOrg) {
                const forwardLabel = isActiveOfficerSscOrganization() ? 'Send to OSA' : 'Send to SSC';
                const forwardAction = isActiveOfficerSscOrganization() ? 'submitToOSA' : 'submitToSSC';
                actionButtons = `${viewButton}
                    <button class="btn btn-primary btn-sm document-workflow-action" onclick="event.stopPropagation(); ${forwardAction}(${Number(doc.submission_id || doc.id || 0)})" title="${forwardLabel}" aria-label="${forwardLabel}">
                        <span class="doc-action-label">${forwardLabel}</span><i class="fa-solid fa-paper-plane"></i>
                    </button>${cancelButton}`;
            } else {
                actionButtons = viewButton;
            }
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Ready to Forward</span>';
        }
        else if (doc.status === 'Adviser Pending') {
            sscHtml = emptyReview;
            osaHtml = emptyReview;
            actionButtons = canReviewForAdviser
                ? `${viewButton}
                    <button class="btn btn-sm btn-success" data-readonly-allow onclick="event.stopPropagation(); openOfficerDocumentReviewModal(${Number(doc.submission_id || doc.id || 0)}, 'approved')" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-readonly-allow onclick="event.stopPropagation(); openOfficerDocumentReviewModal(${Number(doc.submission_id || doc.id || 0)}, 'rejected')" title="Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>`
                : `${viewButton}${cancelButton}`;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Adviser Review</span>';
        }
        else if (doc.status === 'SSC Approved') {
            // SSC Approved - User must Submit to OSA
            sscHtml = approvedReview(sscReviewerName, doc.sscReviewedAt);
            osaHtml = `<span style="color:var(--muted)">-</span><span class="sub-status waiting">${isOwnedByActiveOrg ? 'Action Required' : 'Awaiting Organization'}</span>`;
            actionButtons = isOwnedByActiveOrg
                ? `${viewButton}
                    <button class="btn btn-primary btn-sm document-workflow-action" onclick="event.stopPropagation(); submitToOSA(${Number(doc.submission_id || doc.id || 0)})" title="Send to OSA" aria-label="Send to OSA">
                        <span class="doc-action-label">Send to OSA</span><i class="fa-solid fa-paper-plane"></i>
                    </button>${cancelButton}`
                : viewButton;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Ready</span>';
        }
        else if (doc.status.includes('Sent to OSA')) {
            // A direct-to-OSA submission has no SSC reviewer.
            sscHtml = doc.sscDecision === 'approved' ? approvedReview(sscReviewerName, doc.sscReviewedAt) : emptyReview;
            osaHtml = `<span style="color:var(--muted)">-</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            actionButtons = `${viewButton}${cancelButton}`;
            statusBadge = '<span class="status-badge status-sent" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Sent to OSA</span>';
        }
        else if (doc.status.includes('Rejected')) {
            sscHtml = doc.sscDecision === 'rejected' ? rejectedReview(sscReviewerName, doc.sscReviewedAt) : (doc.sscDecision === 'approved' ? approvedReview(sscReviewerName, doc.sscReviewedAt) : emptyReview);
            osaHtml = doc.osaDecision === 'rejected' ? rejectedReview(osaReviewerName, doc.osaReviewedAt) : emptyReview;
            actionButtons = `${viewButton}${revisionButton}`;
            statusBadge = '<span class="status-badge status-rejected" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Rejected</span>';
        }
        else if (doc.status === 'Cancelled') {
            sscHtml = doc.sscDecision === 'approved' ? approvedReview(sscReviewerName, doc.sscReviewedAt) : emptyReview;
            osaHtml = emptyReview;
            actionButtons = viewButton;
            statusBadge = '<span class="status-badge status-rejected" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Cancelled</span>';
        }
        else {
            const pendingReview = `<span style="color:var(--muted)">-</span><span class="sub-status pending"><i class="fa-regular fa-clock"></i> Pending</span>`;
            sscHtml = wasSentToSsc ? pendingReview : emptyReview;
            osaHtml = wasSentToSsc ? emptyReview : pendingReview;
            actionButtons = canReviewForSsc
                ? `${viewButton}
                    <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); openOfficerDocumentReviewModal(${Number(doc.submission_id || doc.id || 0)}, 'approved')" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); openOfficerDocumentReviewModal(${Number(doc.submission_id || doc.id || 0)}, 'rejected')" title="Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>`
                : `${viewButton}${cancelButton}`;
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Pending</span>';
        }

        return `
        <div class="list-item ${doc.pendingSync ? 'naap-optimistic-record' : ''}" ${doc.pendingSync ? `data-offline-status="${doc.offlineStatus === 'attention' ? 'attention' : 'queued'}" data-offline-operation-id="${escapeHtml(doc.offlineOperationId || '')}"` : `data-submission-id="${Number(doc.submission_id || doc.id || 0)}" onclick="openPdfViewer('${doc.viewerId}')"`}>
            <div class="col-name document-title-cell">
                <div style="background: var(--panel-2); min-width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                    <i class="fa-solid fa-file-pdf"></i>
                </div>
                <div class="document-title-copy">
                    <div class="document-title-row">
                        <h4>${doc.title}</h4>
                        ${statusBadge}
                        ${versionBadge}
                    </div>
                    ${doc.pendingSync ? `<small class="document-queued-summary">Saved locally · ${doc.offlineAction === 'cancel' ? 'Cancellation' : doc.offlineAction === 'review' ? (doc.offlineDecision === 'rejected' ? 'Rejection' : 'Approval') : doc.offlineAction === 'forward_ssc' ? 'Send to SSC' : doc.offlineAction === 'forward_osa' ? 'Send to OSA' : 'Submission'} waiting to sync</small>` : ''}
                    <p style="font-size:0.8rem; color:var(--muted);">${doc.type} • ${doc.date}</p>
                </div>
            </div>

            <div class="col-sent mobile-hide">${sender}</div>

            <div class="col-adviser mobile-hide">${adviserHtml}</div>

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
    syncOfficerDocsTermControlsToActive();

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
    const rawDate = String(dateString).trim();
    const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)
        ? new Date(rawDate.replace(' ', 'T') + '+08:00')
        : new Date(rawDate);
    if (Number.isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffMs = Math.max(0, now - date);
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseOfficerSqlDateTime(dateString) {
    if (!dateString) return null;
    const rawDate = String(dateString).trim();
    const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)
        ? new Date(rawDate.replace(' ', 'T') + '+08:00')
        : new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatAnnouncementEventDate(dateString) {
    const date = parseOfficerSqlDateTime(dateString);
    if (!date) return 'TBA';
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.toLocaleString('en-US', { day: '2-digit' });
    const year = date.toLocaleString('en-US', { year: 'numeric' });
    return `${month}. ${day}, ${year}`;
}

function formatAnnouncementEventTime(dateString) {
    const date = parseOfficerSqlDateTime(dateString);
    if (!date) return 'TBA';
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getTemporaryAnnouncementParticipants(announcement) {
    const seed = Number(announcement?.id || announcement?.announcement_id || 0);
    return 80 + ((seed * 37) % 171);
}

const announcementFeedState = {
    status: 'active',
    query: '',
    audience: '',
    type: '',
    cursor: '',
    hasMore: false,
    loading: false,
    editingId: null,
    counts: { active: 0, archived: 0 },
    queuedCount: 0
};

function renderAnnouncements() {
    const feed = document.getElementById('announcement-feed');
    if (!feed) return;
    const scopedAnnouncements = getOfficerScopedAnnouncements().filter(announcement => {
        const isArchived = Boolean(announcement.archived_at);
        return announcementFeedState.status === 'archived' ? isArchived : !isArchived;
    });
    if (!scopedAnnouncements.length) {
        const label = announcementFeedState.status === 'archived' ? 'archived announcements' : 'active announcements';
        feed.innerHTML = `
            <div class="announcement-feed-empty">
                <i class="fa-regular fa-folder-open"></i>
                <h3>No ${label} found</h3>
                <p>Try changing the filters${announcementFeedState.status === 'active' ? ' or publish a new announcement' : ''}.</p>
            </div>`;
        return;
    }
    feed.innerHTML = scopedAnnouncements.map((ann) => {
        const hasSyncedEvent = Boolean(ann.event_datetime || ann.event_location);
        const photos = parseAnnouncementPhotoGallery(ann.announcement_photo);
        const audienceLabel = formatAnnouncementAudienceLabel(ann.audience_type, ann.target_programs);
        const updated = parseOfficerSqlDateTime(ann.updated_at);
        const created = parseOfficerSqlDateTime(ann.created_at || ann.published_at);
        const wasUpdated = Boolean(updated && created && updated.getTime() - created.getTime() > 1000);
        const orgName = ann.org || getActiveOfficerOrgName() || 'Organization';
        const orgInitials = orgName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
        const orgIcon = resolveOfficerAnnouncementOrgIcon(ann);
        const id = Number(ann.id || ann.announcement_id || 0);
        const isQueuedOffline = Boolean(ann.pending_sync);
        const offlineStatus = ann.offline_status === 'attention' ? 'attention' : 'queued';
        const canRestoreAnnouncement = navigator.onLine && id > 0 && Boolean(ann.archived_at);
        return `
        <article class="announcement-feed-card ${ann.archived_at ? 'archived' : ''} ${isQueuedOffline ? 'naap-optimistic-record' : ''}" ${isQueuedOffline ? `data-offline-status="${offlineStatus}" data-offline-operation-id="${escapeHtml(ann.offline_operation_id || '')}"` : ''}>
            <header class="announcement-feed-card-header">
                <div class="announcement-org-avatar">
                    ${orgIcon
                        ? `<img src="${escapeHtml(orgIcon)}" alt="${escapeHtml(orgName)} logo"
                            onerror="this.hidden=true; this.nextElementSibling.hidden=false">
                           <span hidden>${escapeHtml(orgInitials || 'ORG')}</span>`
                        : `<span>${escapeHtml(orgInitials || 'ORG')}</span>`}
                </div>
                <div class="announcement-feed-identity">
                    <strong>${escapeHtml(orgName)}</strong>
                    <span>${escapeHtml(formatAnnouncementDate(ann.date))}${wasUpdated ? ' · Edited' : ''}</span>
                </div>
                <div class="announcement-feed-card-actions">
                    ${isQueuedOffline ? `<span class="naap-optimistic-badge" data-offline-status="${offlineStatus}">${offlineStatus === 'attention' ? 'Needs attention' : 'Queued offline'}</span>
                    ${canRestoreAnnouncement ? `<button type="button" class="btn btn-primary btn-sm" onclick="restoreAnnouncement(${id})"><i class="fa-solid fa-rotate-left"></i> Restore</button>` : ''}` : `<button type="button" class="btn btn-outline btn-sm" onclick="viewManagedAnnouncement(${id})"><i class="fa-regular fa-eye"></i> View</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="openAnnouncementComposer(${id})"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
                    ${ann.archived_at
                        ? (canRestoreAnnouncement ? `<button type="button" class="btn btn-primary btn-sm" onclick="restoreAnnouncement(${id})"><i class="fa-solid fa-rotate-left"></i> Restore</button>` : '')
                        : `<button type="button" class="btn btn-outline btn-sm announcement-archive-btn" onclick="archiveAnnouncement(${id})"><i class="fa-solid fa-box-archive"></i> Archive</button>`}`}
                </div>
            </header>
            <div class="announcement-feed-badges">
                <span class="announcement-type-badge"><i class="fa-solid ${hasSyncedEvent ? 'fa-calendar-days' : 'fa-bullhorn'}"></i>${hasSyncedEvent ? 'Event' : 'Announcement'}</span>
                <span class="announcement-audience-badge">
                    <i class="fa-solid fa-users"></i>
                    <span>${escapeHtml(audienceLabel)}</span>
                </span>
                ${ann.archived_at ? '<span class="announcement-archived-badge"><i class="fa-solid fa-box-archive"></i>Archived</span>' : ''}
            </div>
            <h3>${escapeHtml(ann.title || 'Untitled Announcement')}</h3>
            <p class="announcement-feed-content">${escapeHtml(ann.content || '')}</p>
            ${photos.length ? `
                <button type="button" class="announcement-feed-photo" ${isQueuedOffline ? 'disabled' : `onclick="openAnnouncementPhotoCarousel(${id})"`} aria-label="View announcement photos">
                    <img src="${escapeHtml(photos[0])}" alt="${escapeHtml(ann.title || 'Announcement photo')}">
                    ${photos.length > 1 ? `<span><i class="fa-regular fa-images"></i> ${photos.length} photos</span>` : ''}
                </button>` : ''}
            ${hasSyncedEvent ? `
                <div class="announcement-feed-event-details">
                    <span><i class="fa-regular fa-calendar"></i>${escapeHtml(formatAnnouncementEventDate(ann.event_datetime))}</span>
                    <span><i class="fa-regular fa-clock"></i>${escapeHtml(formatAnnouncementEventTime(ann.event_datetime))}</span>
                    <span><i class="fa-solid fa-location-dot"></i>${escapeHtml(ann.event_location || 'TBA')}</span>
                </div>` : ''}
        </article>
    `;
    }).join('');
}

function viewManagedAnnouncement(announcementId) {
    const index = getOfficerScopedAnnouncements().findIndex(item => Number(item.id || item.announcement_id) === Number(announcementId));
    if (index >= 0) openAnnouncementDetailModal(index);
}

const announcementPhotoCarouselState = {
    photos: [],
    index: 0,
    title: ''
};

function openAnnouncementPhotoCarousel(announcementId, startIndex = 0) {
    const announcement = getOfficerScopedAnnouncements()
        .find(item => Number(item.id || item.announcement_id) === Number(announcementId));
    const photos = parseAnnouncementPhotoGallery(announcement?.announcement_photo);
    const modal = document.getElementById('announcementPhotoModal');
    if (!announcement || !photos.length || !modal) return;

    announcementPhotoCarouselState.photos = photos;
    announcementPhotoCarouselState.index = Math.max(0, Math.min(Number(startIndex) || 0, photos.length - 1));
    announcementPhotoCarouselState.title = announcement.title || 'Announcement';
    renderAnnouncementPhotoCarousel();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function renderAnnouncementPhotoCarousel() {
    const image = document.getElementById('announcement-photo-lightbox-img');
    const dots = document.getElementById('announcement-photo-lightbox-dots');
    const count = document.getElementById('announcement-photo-lightbox-count');
    const modal = document.getElementById('announcementPhotoModal');
    const { photos, index, title } = announcementPhotoCarouselState;
    if (!image || !dots || !count || !modal || !photos.length) return;

    image.src = photos[index];
    image.alt = `${title} photo ${index + 1}`;
    count.textContent = `${index + 1} / ${photos.length}`;
    dots.innerHTML = photos.map((_, dotIndex) => `
        <button type="button" class="${dotIndex === index ? 'active' : ''}"
            onclick="setAnnouncementPhotoCarouselIndex(${dotIndex})"
            aria-label="Show photo ${dotIndex + 1}"></button>
    `).join('');
    modal.querySelectorAll('.announcement-photo-lightbox-arrow').forEach(button => {
        button.hidden = photos.length < 2;
    });
    dots.hidden = photos.length < 2;
}

function moveAnnouncementPhotoCarousel(direction) {
    const total = announcementPhotoCarouselState.photos.length;
    if (!total) return;
    announcementPhotoCarouselState.index = (announcementPhotoCarouselState.index + direction + total) % total;
    renderAnnouncementPhotoCarousel();
}

function setAnnouncementPhotoCarouselIndex(index) {
    if (index < 0 || index >= announcementPhotoCarouselState.photos.length) return;
    announcementPhotoCarouselState.index = index;
    renderAnnouncementPhotoCarousel();
}

function closeAnnouncementPhotoCarousel() {
    const modal = document.getElementById('announcementPhotoModal');
    if (modal) modal.classList.remove('show');
    const image = document.getElementById('announcement-photo-lightbox-img');
    if (image) image.removeAttribute('src');
    announcementPhotoCarouselState.photos = [];
    announcementPhotoCarouselState.index = 0;
    announcementPhotoCarouselState.title = '';
    document.body.style.overflow = '';
}

function parseAnnouncementPhotoGallery(rawPhotoValue) {
    const rawPhoto = String(rawPhotoValue || '').trim();
    if (!rawPhoto) return [];

    try {
        const parsed = JSON.parse(rawPhoto);
        if (Array.isArray(parsed)) {
            return parsed.map(resolveAnnouncementPhotoPath).filter(Boolean);
        }
    } catch (_error) {
        // Older rows can store one path instead of a JSON photo list.
    }

    return [resolveAnnouncementPhotoPath(rawPhoto)].filter(Boolean);
}

function resolveAnnouncementPhotoPath(photoPath) {
    const rawPath = String(photoPath || '').trim();
    if (!rawPath) return '';
    return /^(?:(?:https?:)?\/\/|data:|blob:)/i.test(rawPath) || rawPath.startsWith('/')
        ? rawPath
        : `../${rawPath.replace(/^\/+/, '')}`;
}

function formatAnnouncementAudienceLabel(audience, targetPrograms = []) {
    if (audience === 'specific_courses') {
        const courseCodes = (Array.isArray(targetPrograms) ? targetPrograms : [])
            .map(target => String(
                target?.program_code
                || target?.programCode
                || target?.code
                || ''
            ).trim())
            .filter(Boolean);
        const uniqueCourseCodes = [...new Set(courseCodes)];
        return uniqueCourseCodes.length
            ? `Specific Courses: ${uniqueCourseCodes.join(', ')}`
            : 'Specific Courses';
    }

    const labels = {
        all_students: 'All Students',
        org_members: 'Org Members Only',
        officers: 'Officers'
    };
    return labels[audience] || audience || 'All Students';
}

let announcementCourseTargets = [];

function toggleAnnouncementCourseTargets() {
    const audienceSelect = document.getElementById('ann-audience');
    const targets = document.getElementById('ann-course-targets');
    if (!audienceSelect || !targets) return;
    targets.hidden = audienceSelect.value !== 'specific_courses';
    setTimeout(resizeAnnouncementContentBox, 0);
}

function getSelectedAnnouncementProgramIds() {
    return Array.from(document.querySelectorAll('#ann-course-target-list input[type="checkbox"]:checked'))
        .map((input) => Number(input.value || 0))
        .filter((programId) => programId > 0);
}

function updateAnnouncementCourseToggleLabel() {
    const toggleButton = document.getElementById('ann-course-toggle-all');
    if (!toggleButton) return;
    const inputs = Array.from(document.querySelectorAll('#ann-course-target-list input[type="checkbox"]'));
    const allSelected = inputs.length > 0 && inputs.every((input) => input.checked);
    toggleButton.textContent = allSelected ? 'Unselect All' : 'Select All';
}

function toggleAllAnnouncementCourses() {
    const inputs = Array.from(document.querySelectorAll('#ann-course-target-list input[type="checkbox"]'));
    const shouldSelectAll = !inputs.length || !inputs.every((input) => input.checked);
    inputs.forEach((input) => {
        input.checked = shouldSelectAll;
    });
    updateAnnouncementCourseToggleLabel();
}

function renderAnnouncementCourseTargets() {
    const list = document.getElementById('ann-course-target-list');
    if (!list) return;

    if (!announcementCourseTargets.length) {
        list.innerHTML = '<div class="announcement-course-empty">No courses are available.</div>';
        return;
    }

    const grouped = new Map();
    announcementCourseTargets.forEach((program) => {
        const instituteName = program.instituteName || 'Other Programs';
        if (!grouped.has(instituteName)) grouped.set(instituteName, []);
        grouped.get(instituteName).push(program);
    });

    list.innerHTML = Array.from(grouped.entries()).map(([instituteName, programs]) => `
        <div class="announcement-course-group">
            <div class="announcement-course-group-title">${escapeHtml(instituteName)}</div>
            <div class="announcement-course-chip-row">
                ${programs.map((program) => `
                    <label class="announcement-course-option">
                        <input type="checkbox" value="${program.programId}" onchange="updateAnnouncementCourseToggleLabel()">
                        <span>${escapeHtml(program.programCode)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
    updateAnnouncementCourseToggleLabel();
}

async function loadAnnouncementCourseTargets() {
    const list = document.getElementById('ann-course-target-list');
    if (list) {
        list.innerHTML = '<div class="announcement-course-empty">Loading courses...</div>';
    }

    try {
        const response = await fetch('../api/announcements/programs.php', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load courses.');
        }

        announcementCourseTargets = (Array.isArray(data.items) ? data.items : [])
            .map((item) => ({
                programId: Number(item.programId || 0),
                programCode: String(item.programCode || '').trim(),
                instituteId: Number(item.instituteId || 0),
                instituteName: String(item.instituteName || '').trim()
            }))
            .filter((program) => program.programId > 0 && program.programCode)
            .sort((a, b) => (
                a.instituteName.localeCompare(b.instituteName)
                || a.programCode.localeCompare(b.programCode)
            ));
        renderAnnouncementCourseTargets();
    } catch (error) {
        console.error('[loadAnnouncementCourseTargets]', error);
        announcementCourseTargets = [];
        if (list) {
            list.innerHTML = '<div class="announcement-course-empty">Could not load courses.</div>';
        }
    }
}

const announcementDetailCarouselState = {
    photos: [],
    index: 0
};

function renderAnnouncementDetailCarousel() {
    const image = document.getElementById('announcement-detail-hero-img');
    const dots = document.getElementById('announcement-detail-dots');
    const prevButton = document.querySelector('.announcement-detail-prev');
    const nextButton = document.querySelector('.announcement-detail-next');
    const { photos, index } = announcementDetailCarouselState;

    if (!image || !dots || !photos.length) return;

    image.src = photos[index];
    image.alt = `Announcement photo ${index + 1}`;
    dots.innerHTML = photos.map((_, dotIndex) => `
        <button type="button" class="${dotIndex === index ? 'active' : ''}" onclick="setAnnouncementDetailPhoto(${dotIndex})" aria-label="Show photo ${dotIndex + 1}"></button>
    `).join('');

    const hasMultiplePhotos = photos.length > 1;
    if (prevButton) prevButton.hidden = !hasMultiplePhotos;
    if (nextButton) nextButton.hidden = !hasMultiplePhotos;
}

function moveAnnouncementDetailPhoto(direction) {
    const total = announcementDetailCarouselState.photos.length;
    if (!total) return;
    announcementDetailCarouselState.index = (announcementDetailCarouselState.index + direction + total) % total;
    renderAnnouncementDetailCarousel();
}

function setAnnouncementDetailPhoto(index) {
    const total = announcementDetailCarouselState.photos.length;
    if (index < 0 || index >= total) return;
    announcementDetailCarouselState.index = index;
    renderAnnouncementDetailCarousel();
}

function openAnnouncementDetailModal(index) {
    openAnnouncementDetailModalForAnnouncement(getOfficerScopedAnnouncements()[index]);
}

function openAnnouncementDetailModalForAnnouncement(announcement) {
    const modal = document.getElementById('announcementDetailModal');
    const content = document.getElementById('announcement-detail-content');
    const title = document.getElementById('announcement-detail-title');
    if (!announcement || !modal || !content) return;

    const photos = parseAnnouncementPhotoGallery(announcement.announcement_photo);
    announcementDetailCarouselState.photos = photos;
    announcementDetailCarouselState.index = 0;
    if (title) title.textContent = announcement.title || 'Untitled Announcement';
    const participantCount = getTemporaryAnnouncementParticipants(announcement);
    const hasSyncedEvent = Boolean(announcement.event_datetime || announcement.event_location);
    const eventDetailsMarkup = hasSyncedEvent ? `
        <div class="announcement-detail-event">
            <h4>Event Details</h4>
            <div class="announcement-detail-info-grid">
                <div class="announcement-detail-info-item">
                    <i class="fa-regular fa-calendar"></i>
                    <div>
                        <span>Date</span>
                        <strong>${escapeHtml(formatAnnouncementEventDate(announcement.event_datetime))}</strong>
                    </div>
                </div>
                <div class="announcement-detail-info-item">
                    <i class="fa-regular fa-clock"></i>
                    <div>
                        <span>Time</span>
                        <strong>${escapeHtml(formatAnnouncementEventTime(announcement.event_datetime))}</strong>
                    </div>
                </div>
                <div class="announcement-detail-info-item">
                    <i class="fa-solid fa-location-dot"></i>
                    <div>
                        <span>Venue</span>
                        <strong>${escapeHtml(announcement.event_location || 'TBA')}</strong>
                    </div>
                </div>
                <div class="announcement-detail-info-item">
                    <i class="fa-solid fa-users"></i>
                    <div>
                        <span>Participants</span>
                        <strong>${participantCount} Registered</strong>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    const heroMarkup = photos.length
        ? `<div class="announcement-detail-hero">
                <img id="announcement-detail-hero-img" src="${escapeHtml(photos[0])}" alt="Announcement photo 1">
                <button type="button" class="announcement-detail-arrow announcement-detail-prev" onclick="moveAnnouncementDetailPhoto(-1)" aria-label="Previous photo">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button type="button" class="announcement-detail-arrow announcement-detail-next" onclick="moveAnnouncementDetailPhoto(1)" aria-label="Next photo">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                <div class="announcement-detail-dots" id="announcement-detail-dots"></div>
            </div>`
        : `<div class="announcement-detail-hero announcement-detail-hero-empty">
                <i class="fa-regular fa-image"></i>
            </div>`;

    content.innerHTML = `
        ${heroMarkup}
        <div class="announcement-detail-info-grid">
            <div class="announcement-detail-info-item">
                <i class="fa-regular fa-calendar"></i>
                <div>
                    <span>Published</span>
                    <strong>${escapeHtml(formatAnnouncementDate(announcement.date))}</strong>
                </div>
            </div>
            <div class="announcement-detail-info-item">
                <i class="fa-solid fa-bullhorn"></i>
                <div>
                    <span>Status</span>
                    <strong>${announcement.archived_at ? 'Archived' : 'Published'}</strong>
                </div>
            </div>
            <div class="announcement-detail-info-item">
                <i class="fa-solid fa-users"></i>
                <div>
                    <span>Audience</span>
                    <strong>${escapeHtml(formatAnnouncementAudienceLabel(
                        announcement.audience_type,
                        announcement.target_programs
                    ))}</strong>
                </div>
            </div>
            <div class="announcement-detail-info-item">
                <i class="fa-solid fa-sitemap"></i>
                <div>
                    <span>Organization</span>
                    <strong>${escapeHtml(announcement.org || getActiveOfficerOrgName() || 'Organization')}</strong>
                </div>
            </div>
        </div>
        <div class="announcement-detail-about">
            <h4>About this Announcement</h4>
            <p>${escapeHtml(announcement.content || '')}</p>
        </div>
        ${eventDetailsMarkup}
        <div class="announcement-detail-photo-summary">
            ${photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} attached` : 'No photos attached'}
        </div>
    `;
    renderAnnouncementDetailCarousel();
    modal.classList.add('show');
}

function closeAnnouncementDetailModal() {
    const modal = document.getElementById('announcementDetailModal');
    if (modal) modal.classList.remove('show');
    announcementDetailCarouselState.photos = [];
    announcementDetailCarouselState.index = 0;

    if (isOfficerAnnouncementPreviewMode()) {
        window.close();
        setTimeout(() => {
            if (!window.closed) {
                window.location.href = 'osaDashboard.html';
            }
        }, 150);
    }
}

function openAnnouncementComposer(announcementId = null) {
    const modal = document.getElementById('announcementComposerModal');
    const form = document.getElementById('announcement-form');
    if (!modal || !form) return;
    form.reset();
    clearAnnouncementPhotoPreview();
    announcementFeedState.editingId = announcementId ? Number(announcementId) : null;
    const editing = announcementFeedState.editingId
        ? getOfficerScopedAnnouncements().find(item => Number(item.id || item.announcement_id) === announcementFeedState.editingId)
        : null;
    if (announcementFeedState.editingId && !editing) {
        showToast('That announcement is not loaded in the current feed.', 'error');
        return;
    }

    const title = document.getElementById('announcement-composer-title');
    const submit = document.getElementById('announcement-submit-btn');
    const eventOption = document.getElementById('announcement-event-sync-option');
    if (title) title.textContent = editing ? 'Edit Announcement' : 'New Announcement';
    if (submit) submit.innerHTML = editing
        ? '<i class="fa-regular fa-floppy-disk"></i> Save Changes'
        : '<i class="fa-regular fa-paper-plane"></i> Publish';
    if (eventOption) eventOption.hidden = Boolean(editing);
    if (editing) {
        document.getElementById('ann-title').value = editing.title || '';
        document.getElementById('ann-content').value = editing.content || '';
        document.getElementById('ann-audience').value = editing.audience_type || 'all_students';
        setExistingAnnouncementPhotos(editing.announcement_photo);
        const selectedIds = new Set((editing.target_programs || []).map(target => Number(target.program_id)));
        document.querySelectorAll('#ann-course-target-list input[type="checkbox"]').forEach(input => {
            input.checked = selectedIds.has(Number(input.value));
        });
        updateAnnouncementCourseToggleLabel();
    }
    toggleAnnouncementCourseTargets();
    toggleEventSyncFields();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        resizeAnnouncementContentBox();
        document.getElementById('ann-title')?.focus();
    }, 0);
}

function closeAnnouncementComposer() {
    const modal = document.getElementById('announcementComposerModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    announcementFeedState.editingId = null;
    document.getElementById('announcement-form')?.reset();
    clearAnnouncementPhotoPreview();
    toggleAnnouncementCourseTargets();
    toggleEventSyncFields();
}

function openOfficerAnnouncementPreviewFromUrl() {
    const announcement = getOfficerAnnouncementPreviewPayload();
    if (!announcement) {
        showToast('Announcement preview is no longer available. Please open it again from OSA.', 'error');
        return;
    }

    navigate('announcements');

    document.querySelectorAll('.sidebar .nav-link').forEach((link) => {
        const isAnnouncementsLink = link.getAttribute('onclick')?.includes('announcements');
        if (!isAnnouncementsLink) {
            const item = link.closest('.nav-item') || link;
            item.style.display = 'none';
        }
    });

    const formCard = document.getElementById('announcement-form')?.closest('.card');
    if (formCard) formCard.style.display = 'none';

    const feed = document.getElementById('announcement-feed');
    if (feed) {
        feed.innerHTML = `
            <div style="padding: 12px; color: var(--muted);">
                Opened from OSA Organization Activity for view-only inspection.
            </div>
        `;
    }

    setTimeout(() => {
        openAnnouncementDetailModalForAnnouncement(announcement);
    }, 80);
}

function toggleEventSyncFields() {
    const checkbox = document.getElementById('sync-event');
    const container = document.getElementById('event-sync-fields');
    if (!checkbox || !container) return;
    container.style.display = checkbox.checked ? 'grid' : 'none';
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function readFilesAsDataUrls(files) {
    return Promise.all(Array.from(files || []).map(readFileAsDataUrl));
}

const announcementPhotoPreviewState = {
    files: [],
    urls: [],
    retainedPaths: [],
    index: 0
};

function syncAnnouncementPhotoInputFiles() {
    const input = document.getElementById('announcement-photos');
    if (!input) return;

    const transfer = new DataTransfer();
    announcementPhotoPreviewState.files.filter(Boolean).forEach(file => transfer.items.add(file));
    input.files = transfer.files;
}

function clearAnnouncementPhotoPreview() {
    announcementPhotoPreviewState.urls.forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    announcementPhotoPreviewState.files = [];
    announcementPhotoPreviewState.urls = [];
    announcementPhotoPreviewState.retainedPaths = [];
    announcementPhotoPreviewState.index = 0;

    const carousel = document.getElementById('announcement-photo-carousel');
    const image = document.getElementById('announcement-photo-preview-img');
    const counter = document.getElementById('announcement-photo-count');

    if (image) image.removeAttribute('src');
    if (counter) counter.textContent = '0 / 0';
    if (carousel) carousel.hidden = true;
    syncAnnouncementPhotoInputFiles();
}

function renderAnnouncementPhotoPreview() {
    const carousel = document.getElementById('announcement-photo-carousel');
    const image = document.getElementById('announcement-photo-preview-img');
    const counter = document.getElementById('announcement-photo-count');
    const prevButton = document.querySelector('.announcement-photo-prev');
    const nextButton = document.querySelector('.announcement-photo-next');
    const removeButton = document.getElementById('announcement-photo-remove');
    const total = announcementPhotoPreviewState.urls.length;

    if (!carousel || !image || !counter) return;
    if (!total) {
        clearAnnouncementPhotoPreview();
        return;
    }

    const currentIndex = Math.min(announcementPhotoPreviewState.index, total - 1);
    announcementPhotoPreviewState.index = currentIndex;
    image.src = announcementPhotoPreviewState.urls[currentIndex];
    counter.textContent = `${currentIndex + 1} / ${total}`;
    carousel.hidden = false;

    const hasMultiplePhotos = total > 1;
    if (prevButton) prevButton.disabled = !hasMultiplePhotos;
    if (nextButton) nextButton.disabled = !hasMultiplePhotos;
    if (removeButton) removeButton.disabled = total === 0;
}

function moveAnnouncementPhotoPreview(direction) {
    const total = announcementPhotoPreviewState.urls.length;
    if (!total) return;
    announcementPhotoPreviewState.index = (announcementPhotoPreviewState.index + direction + total) % total;
    renderAnnouncementPhotoPreview();
}

function addAnnouncementPhotoFiles(files) {
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return;

    announcementPhotoPreviewState.files.push(...imageFiles);
    announcementPhotoPreviewState.urls.push(...imageFiles.map(file => URL.createObjectURL(file)));
    announcementPhotoPreviewState.retainedPaths.push(...imageFiles.map(() => null));
    announcementPhotoPreviewState.index = announcementPhotoPreviewState.urls.length - imageFiles.length;
    syncAnnouncementPhotoInputFiles();
    renderAnnouncementPhotoPreview();
}

function removeCurrentAnnouncementPhoto() {
    const total = announcementPhotoPreviewState.urls.length;
    if (!total) return;

    const removeIndex = announcementPhotoPreviewState.index;
    if (announcementPhotoPreviewState.urls[removeIndex].startsWith('blob:')) {
        URL.revokeObjectURL(announcementPhotoPreviewState.urls[removeIndex]);
    }
    announcementPhotoPreviewState.urls.splice(removeIndex, 1);
    announcementPhotoPreviewState.files.splice(removeIndex, 1);
    announcementPhotoPreviewState.retainedPaths.splice(removeIndex, 1);
    announcementPhotoPreviewState.index = Math.min(removeIndex, announcementPhotoPreviewState.urls.length - 1);
    syncAnnouncementPhotoInputFiles();
    renderAnnouncementPhotoPreview();
}

function setupAnnouncementPhotoPreviewCarousel() {
    const input = document.getElementById('announcement-photos');
    if (!input) return;

    input.addEventListener('change', () => {
        addAnnouncementPhotoFiles(input.files);
        syncAnnouncementPhotoInputFiles();
    });

    document.getElementById('announcement-photo-add')?.addEventListener('click', () => input.click());
    document.getElementById('announcement-photo-remove')?.addEventListener('click', removeCurrentAnnouncementPhoto);
    document.querySelector('.announcement-photo-prev')?.addEventListener('click', () => moveAnnouncementPhotoPreview(-1));
    document.querySelector('.announcement-photo-next')?.addEventListener('click', () => moveAnnouncementPhotoPreview(1));
}

function setExistingAnnouncementPhotos(rawPhotoValue) {
    clearAnnouncementPhotoPreview();
    const paths = parseAnnouncementPhotoGallery(rawPhotoValue);
    announcementPhotoPreviewState.urls = [...paths];
    announcementPhotoPreviewState.files = paths.map(() => null);
    announcementPhotoPreviewState.retainedPaths = annRawPhotoPaths(rawPhotoValue);
    announcementPhotoPreviewState.index = 0;
    renderAnnouncementPhotoPreview();
}

function annRawPhotoPaths(rawPhotoValue) {
    const raw = String(rawPhotoValue || '').trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch (_error) {
        // Legacy single-photo value.
    }
    return [raw];
}

function getVisibleOuterHeight(element) {
    if (!element || element.hidden || element.offsetParent === null) return 0;
    const style = window.getComputedStyle(element);
    return element.offsetHeight + parseFloat(style.marginTop || 0) + parseFloat(style.marginBottom || 0);
}

function resizeAnnouncementContentBox() {
    const textarea = document.getElementById('ann-content');
    if (!textarea) return;
    const maxHeight = Math.min(320, Math.max(160, window.innerHeight * 0.32));
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function setupAnnouncementContentAutoResize() {
    const textarea = document.getElementById('ann-content');
    if (!textarea) return;
    textarea.addEventListener('input', resizeAnnouncementContentBox);
    window.addEventListener('resize', resizeAnnouncementContentBox);
    resizeAnnouncementContentBox();
}

function mapOfficerAnnouncement(item) {
    return {
        ...item,
        id: item.announcement_id,
        date: item.published_at || item.created_at,
        org: getActiveOfficerOrgName(),
        org_id: item.org_id
    };
}

async function mergeQueuedOfficerAnnouncements() {
    announcementsData = announcementsData.filter(item => !item.pending_sync);
    announcementFeedState.queuedCount = 0;
    if (!window.NAAPOffline?.listQueuedOperations) return;
    const [queuedCreates, queuedStateChanges] = await Promise.all([
        window.NAAPOffline.listQueuedOperations('announcement.create'),
        window.NAAPOffline.listQueuedOperations(['announcement.archive', 'announcement.restore'])
    ]);
    const optimistic = queuedCreates.map(operation => {
        const payload = operation.payload || {};
        return {
            id: 0,
            announcement_id: 0,
            title: payload.title || 'Untitled Announcement',
            content: payload.content || '',
            audience_type: payload.audience_type || 'all_students',
            target_programs: [],
            announcement_photo: JSON.stringify(Array.isArray(payload.announcement_photos) ? payload.announcement_photos : []),
            event_datetime: payload.sync_event ? payload.event_datetime : null,
            event_location: payload.sync_event ? (payload.event_location || 'TBA') : null,
            published_at: operation.createdAt,
            created_at: operation.createdAt,
            date: operation.createdAt,
            org: getActiveOfficerOrgName(),
            org_id: Number(readAuthSession().active_org_id || 0),
            pending_sync: true,
            offline_status: operation.status,
            offline_operation_id: operation.operationId,
            offline_error: operation.lastError || ''
        };
    }).filter(item => {
        const query = announcementFeedState.query.toLowerCase();
        if (query && !`${item.title} ${item.content}`.toLowerCase().includes(query)) return false;
        if (announcementFeedState.audience && item.audience_type !== announcementFeedState.audience) return false;
        if (announcementFeedState.type === 'event' && !item.event_datetime) return false;
        if (announcementFeedState.type === 'announcement' && item.event_datetime) return false;
        return true;
    });
    const stateChanges = new Map(queuedStateChanges.map(operation => [
        Number(operation.payload?.announcement_id || 0),
        operation
    ]));
    announcementsData = announcementsData.map(item => {
        const operation = stateChanges.get(Number(item.id || item.announcement_id || 0));
        if (!operation) return item;
        return {
            ...item,
            archived_at: operation.type === 'announcement.archive' ? operation.createdAt : null,
            pending_sync: true,
            offline_status: operation.status,
            offline_operation_id: operation.operationId,
            offline_error: operation.lastError || ''
        };
    }).filter(item => {
        const operation = stateChanges.get(Number(item.id || item.announcement_id || 0));
        if (!operation) return true;
        return announcementFeedState.status === (operation.type === 'announcement.archive' ? 'archived' : 'active');
    });
    const optimisticStateChanges = queuedStateChanges
        .filter(operation => announcementFeedState.status === (operation.type === 'announcement.archive' ? 'archived' : 'active'))
        .filter(operation => !announcementsData.some(item => Number(item.id || item.announcement_id || 0) === Number(operation.payload?.announcement_id || 0)))
        .map(operation => ({
            ...(operation.payload?.announcement || {}),
            id: Number(operation.payload?.announcement_id || 0),
            announcement_id: Number(operation.payload?.announcement_id || 0),
            title: operation.payload?.title || operation.payload?.announcement?.title || 'Announcement',
            content: operation.payload?.announcement?.content || '',
            archived_at: operation.type === 'announcement.archive' ? operation.createdAt : null,
            date: operation.payload?.announcement?.date || operation.createdAt,
            pending_sync: true,
            offline_status: operation.status,
            offline_operation_id: operation.operationId,
            offline_error: operation.lastError || ''
        }));
    announcementFeedState.queuedCount = queuedCreates.length + queuedStateChanges.length;
    announcementsData = [...optimistic, ...optimisticStateChanges, ...announcementsData];
    const uniqueAnnouncements = new Map();
    announcementsData.forEach(item => {
        const announcementId = Number(item.id || item.announcement_id || 0);
        const key = announcementId > 0
            ? `announcement:${announcementId}`
            : `offline:${item.offline_operation_id || `${item.title || ''}|${item.created_at || item.date || ''}`}`;
        const existing = uniqueAnnouncements.get(key);
        if (!existing || item.pending_sync) uniqueAnnouncements.set(key, item);
    });
    announcementsData = [...uniqueAnnouncements.values()];
}

async function fetchAnnouncementsFromApi({ append = false } = {}) {
    if (announcementFeedState.loading) return;
    announcementFeedState.loading = true;
    const feed = document.getElementById('announcement-feed');
    updateAnnouncementLoadMoreButton();
    const loadMore = document.getElementById('announcement-load-more');
    if (!append && feed) {
        feed.innerHTML = '<div class="announcement-feed-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading announcements...</div>';
    }
    if (loadMore) loadMore.disabled = true;
    try {
        const params = new URLSearchParams({
            status: announcementFeedState.status,
            limit: '10'
        });
        if (announcementFeedState.query) params.set('q', announcementFeedState.query);
        if (announcementFeedState.audience) params.set('audience', announcementFeedState.audience);
        if (announcementFeedState.type) params.set('type', announcementFeedState.type);
        if (append && announcementFeedState.cursor) params.set('cursor', announcementFeedState.cursor);

        const res = await fetch(`../api/announcements/list.php?${params.toString()}`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load announcements');
        const incoming = (data.items || []).map(mapOfficerAnnouncement);
        announcementsData = append ? announcementsData.concat(incoming) : incoming;
        await mergeQueuedOfficerAnnouncements();
        announcementFeedState.cursor = data.next_cursor || '';
        announcementFeedState.hasMore = Boolean(data.has_more);
        announcementFeedState.counts = data.counts || { active: 0, archived: 0 };
        updateAnnouncementFeedControls();
        renderAnnouncements();
    } catch (err) {
        console.error('Failed to load announcements', err);
        if (!append && feed) {
            feed.innerHTML = `<div class="announcement-feed-empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Could not load announcements</h3><p>${escapeHtml(err.message || 'Please try again.')}</p><button class="btn btn-outline btn-sm" onclick="fetchAnnouncementsFromApi()">Retry</button></div>`;
        } else {
            showToast(err.message || 'Could not load more announcements.', 'error');
        }
    } finally {
        announcementFeedState.loading = false;
        updateAnnouncementLoadMoreButton();
    }
}

function updateAnnouncementLoadMoreButton() {
    const wrapper = document.getElementById('announcement-load-more-wrap');
    if (!wrapper) return;

    const shouldRender = Boolean(
        announcementFeedState.hasMore && announcementFeedState.cursor
    );
    if (!shouldRender) {
        wrapper.replaceChildren();
        return;
    }

    let button = document.getElementById('announcement-load-more');
    if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.id = 'announcement-load-more';
        button.className = 'btn btn-outline';
        button.textContent = 'Load More';
        button.addEventListener('click', loadMoreAnnouncements);
        wrapper.appendChild(button);
    }
    button.disabled = announcementFeedState.loading;
}

function updateAnnouncementFeedControls() {
    const activeTab = document.getElementById('announcement-tab-active');
    const archivedTab = document.getElementById('announcement-tab-archived');
    activeTab?.classList.toggle('active', announcementFeedState.status === 'active');
    archivedTab?.classList.toggle('active', announcementFeedState.status === 'archived');
    const activeCount = document.getElementById('announcement-active-count');
    const archivedCount = document.getElementById('announcement-archived-count');
    if (activeCount) activeCount.textContent = String((announcementFeedState.counts.active || 0) + (announcementFeedState.queuedCount || 0));
    if (archivedCount) archivedCount.textContent = String(announcementFeedState.counts.archived || 0);
}

function resetAnnouncementFeed() {
    announcementFeedState.cursor = '';
    announcementFeedState.hasMore = false;
    announcementsData = [];
    updateAnnouncementLoadMoreButton();
    fetchAnnouncementsFromApi();
}

function setAnnouncementFeedStatus(status) {
    if (!['active', 'archived'].includes(status) || announcementFeedState.status === status) return;
    announcementFeedState.status = status;
    updateAnnouncementFeedControls();
    resetAnnouncementFeed();
}

function loadMoreAnnouncements() {
    if (announcementFeedState.hasMore && announcementFeedState.cursor) {
        fetchAnnouncementsFromApi({ append: true });
    }
}

function setupAnnouncementFeedFilters() {
    let searchTimer = null;
    document.getElementById('announcement-search')?.addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            announcementFeedState.query = event.target.value.trim();
            resetAnnouncementFeed();
        }, 350);
    });
    document.getElementById('announcement-audience-filter')?.addEventListener('change', (event) => {
        announcementFeedState.audience = event.target.value;
        resetAnnouncementFeed();
    });
    document.getElementById('announcement-type-filter')?.addEventListener('change', (event) => {
        announcementFeedState.type = event.target.value;
        resetAnnouncementFeed();
    });
}

// --- ACTIONS ---

function toggleNotifs(event) {
    event?.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('show')) {
        closeNotifs();
    } else {
        openNotifs();
    }
}

function openNotifs() {
    const dropdown = document.getElementById('notif-dropdown');
    const trigger = document.getElementById('notif-trigger');
    const backdrop = document.getElementById('notif-backdrop');
    if (!dropdown || !trigger) return;

    officerActionCenterPreviousFocus = document.activeElement;
    dropdown.classList.add('show');
    dropdown.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-active');
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add('notif-drawer-open');

    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) exportDropdown.classList.remove('show');
    loadOfficerActionCenter();
    setTimeout(() => dropdown.querySelector('.notif-close-btn')?.focus(), 50);
}

function closeNotifs() {
    const dropdown = document.getElementById('notif-dropdown');
    const trigger = document.getElementById('notif-trigger');
    const backdrop = document.getElementById('notif-backdrop');
    if (!dropdown || !trigger) return;

    const wasOpen = dropdown.classList.contains('show');
    dropdown.classList.remove('show');
    dropdown.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-active');
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('notif-drawer-open');
    if (wasOpen && officerActionCenterPreviousFocus instanceof HTMLElement) {
        officerActionCenterPreviousFocus.focus();
    }
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
    const customDocumentType = (document.getElementById('doc-custom-type')?.value || '').trim();
    const title = (document.getElementById('doc-title')?.value || '').trim();
    const description = (document.getElementById('doc-description')?.value || '').trim();
    const revisionOfSubmissionId = Number(document.getElementById('doc-revision-of')?.value || 0);

    if (!title) {
        alert('Title is required.');
        return;
    }
    if (type === 'Others' && !customDocumentType) {
        alert('Please enter a custom document type.');
        document.getElementById('doc-custom-type')?.focus();
        return;
    }
    if (!file) {
        alert('Please attach a PDF file.');
        return;
    }

    if (!navigator.onLine && window.NAAPOffline?.queueDocumentSubmission) {
        try {
            await window.NAAPOffline.queueDocumentSubmission(file, {
                title,
                document_type: type,
                custom_document_type: type === 'Others' ? customDocumentType : null,
                recipient,
                description,
                revision_of_submission_id: revisionOfSubmissionId || null
            });
            await mergeQueuedOfficerDocuments();
            renderDocs(currentDocFilter);
            renderRecentDocs();
            e.target.reset();
            closeSubmitModal();
            alert('Document saved securely on this device and waiting to sync.');
        } catch (error) {
            alert(error.message || 'Could not save the document for offline synchronization.');
        }
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
        if (!uploadData.ok || !uploadData.upload_token) {
            throw new Error(uploadData.error || 'Failed to upload file.');
        }

        const res = await fetch('../api/documents/submit.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                title,
                document_type: type,
                custom_document_type: type === 'Others' ? customDocumentType : null,
                recipient,
                description,
                upload_token: uploadData.upload_token,
                revision_of_submission_id: revisionOfSubmissionId || null
            })
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to submit document.');
        }
        await loadDocsFromApi();
        e.target.reset();
        closeSubmitModal();
        alert(revisionOfSubmissionId
            ? `Document revision successfully sent to ${recipient}.`
            : `Document successfully sent to ${recipient}.`);
    } catch (error) {
        console.error(error);
        if ((!navigator.onLine || error instanceof TypeError) && window.NAAPOffline?.queueDocumentSubmission) {
            try {
                await window.NAAPOffline.queueDocumentSubmission(file, {
                    title,
                    document_type: type,
                    custom_document_type: type === 'Others' ? customDocumentType : null,
                    recipient,
                    description,
                    revision_of_submission_id: revisionOfSubmissionId || null
                });
                await mergeQueuedOfficerDocuments();
                renderDocs(currentDocFilter);
                renderRecentDocs();
                e.target.reset();
                closeSubmitModal();
                alert('The connection was lost. Your document is saved securely on this device and waiting to sync.');
                return;
            } catch (queueError) {
                alert(queueError.message || 'Could not save the document for offline synchronization.');
                return;
            }
        }
        alert(error.message || 'Failed to submit document.');
    }
}

function formatTimeRange(start, end) {
    if (!start || !end) return '';
    return `${start} - ${end}`;
}

async function postAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    const audience = document.getElementById('ann-audience') ? document.getElementById('ann-audience').value : 'all_students';
    const targetProgramIds = audience === 'specific_courses' ? getSelectedAnnouncementProgramIds() : [];
    const editingId = announcementFeedState.editingId;
    const syncEvent = !editingId && document.getElementById('sync-event').checked;
    const eventDate = document.getElementById('event-date')?.value || '';
    const eventTimeStart = (document.getElementById('event-time-start')?.value || '').trim();
    const eventTimeEnd   = (document.getElementById('event-time-end')?.value || '').trim();
    const eventTimeRange = formatTimeRange(eventTimeStart, eventTimeEnd);
    const eventLocation = document.getElementById('event-location')?.value || '';
    const announcementPhotoFiles = announcementPhotoPreviewState.files.filter(Boolean);
    let announcementPhotoDataUrls = [];

    if (!title || !content) {
        alert('Headline and content are required.');
        return;
    }
    if (syncEvent) {
        if (!eventDate || !eventTimeStart || !eventTimeEnd) {
            alert('Please select Event Date, Start Time, and End Time.');
            return;
        }
    }
    if (audience === 'specific_courses' && targetProgramIds.length === 0) {
        alert('Please select at least one course for this announcement.');
        return;
    }

    if (announcementPhotoFiles.length) {
        try {
            announcementPhotoDataUrls = await readFilesAsDataUrls(announcementPhotoFiles);
        } catch (err) {
            console.error('Failed to read announcement photos', err);
            alert('Could not read one of the announcement photos. Please try another image.');
            return;
        }
    }

    try {
        const endpoint = editingId ? '../api/announcements/update.php' : '../api/announcements/create.php';
        const payload = {
            title,
            content,
            audience_type: audience,
            target_program_ids: targetProgramIds,
            announcement_photos: announcementPhotoDataUrls,
            sync_event: syncEvent,
            event_datetime: syncEvent ? `${eventDate} ${eventTimeStart}` : null,
            event_location: syncEvent ? (eventLocation || 'TBA') : null
        };
        if (editingId) {
            payload.announcement_id = editingId;
            payload.retained_photo_paths = announcementPhotoPreviewState.retainedPaths.filter(Boolean);
        } else {
            payload.publish = true;
        }
        const submitButton = document.getElementById('announcement-submit-btn');
        if (submitButton) submitButton.disabled = true;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || `Failed to ${editingId ? 'update' : 'post'} announcement`);

        if (syncEvent) {
            const eventsFrame = document.querySelector('#events iframe');
            const payload = {
                type: 'CREATE_EVENT',
                eventName: title,
                description: content,
                date: eventDate || new Date().toISOString().split('T')[0],
                time: eventTimeRange || eventTimeStart,
                location: eventLocation || 'TBA',
                photo: announcementPhotoDataUrls[0] || '',
                photos: announcementPhotoDataUrls
            };

            const sendToEventsFrame = () => {
                try {
                    eventsFrame.contentWindow.postMessage(payload, '*');
                    showToast(`Announcement published and event "${title}" created.`, 'success');
                } catch (_err) {
                    showToast('Announcement published, but the Events tab could not be reached.', 'error');
                }
            };

            if (eventsFrame) {
                if (eventsFrame.contentWindow && eventsFrame.contentDocument?.readyState === 'complete') {
                    sendToEventsFrame();
                } else {
                    eventsFrame.addEventListener('load', sendToEventsFrame, { once: true });
                    if (!eventsFrame.src) {
                        eventsFrame.src = "../pages/qr-attendance/events.php";
                    }
                }
            } else {
                showToast('Announcement published, but the Events tab is unavailable.', 'error');
            }
        } else if (!data.queued) {
            showToast(editingId ? 'Announcement updated.' : 'Announcement published.', 'success');
        }
        closeAnnouncementComposer();
        if (data.queued) {
            await mergeQueuedOfficerAnnouncements();
            updateAnnouncementFeedControls();
            renderAnnouncements();
            showToast('Announcement saved on this device and queued for sync.', 'info');
        } else {
            resetAnnouncementFeed();
        }
    } catch (error) {
        console.error(error);
        alert(error.message || `Failed to ${editingId ? 'update' : 'post'} announcement. Please try again.`);
    } finally {
        const submitButton = document.getElementById('announcement-submit-btn');
        if (submitButton) submitButton.disabled = false;
    }
}

document.addEventListener('click', (event) => {
    const itemButton = event.target.closest('[data-notification-key]');
    if (!itemButton) return;
    const item = officerActionCenterItems.get(String(itemButton.dataset.notificationKey || ''));
    if (item) openOfficerActionCenterTarget(item);
});

window.addEventListener('naap:offline-queue-changed', async () => {
    await Promise.all([
        mergeQueuedOfficerAnnouncements(),
        mergeQueuedOfficerDocuments(),
        applyQueuedLockerOperations()
    ]).catch(() => {});
    updateAnnouncementFeedControls();
    renderAnnouncements();
    renderDocs(currentDocFilter);
    renderRecentDocs();
    renderOfficerLockerBoard();
});

document.addEventListener('keydown', (event) => {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown?.classList.contains('show')) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeNotifs();
        return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(dropdown.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
});

window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const embeddedFrames = Array.from(document.querySelectorAll('#events iframe, #tracker iframe'));
    if (!embeddedFrames.some((frame) => frame.contentWindow === event.source)) return;

    if (event.data?.type === 'OFFICER_ACTION_CENTER_REFRESH') {
        loadOfficerActionCenter(false);
    } else if (event.data?.type === 'OFFICER_NAVIGATION_TARGET_MISSING') {
        showToast('That item is no longer available. Alerts have been refreshed.', 'info');
        loadOfficerActionCenter(false);
    }
});

async function archiveAnnouncement(announcementId) {
    const item = getOfficerScopedAnnouncements().find(announcement => Number(announcement.id || announcement.announcement_id) === Number(announcementId));
    if (!item || !await appConfirm(
        `Archive "${item.title}"? Students will no longer see it, and officers can restore it later.`,
        { title: 'Archive announcement', confirmText: 'Archive', danger: true }
    )) return;
    await setAnnouncementArchivedState(announcementId, true);
}

async function restoreAnnouncement(announcementId) {
    await setAnnouncementArchivedState(announcementId, false);
}

async function setAnnouncementArchivedState(announcementId, archived) {
    try {
        const announcement = getOfficerScopedAnnouncements().find(item => Number(item.id || item.announcement_id) === Number(announcementId));
        const response = await fetch(`../api/announcements/${archived ? 'archive' : 'restore'}.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                announcement_id: announcementId,
                title: announcement?.title || '',
                announcement: announcement || null
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || `Could not ${archived ? 'archive' : 'restore'} announcement.`);
        }
        showToast(data.queued
            ? `Announcement ${archived ? 'archive' : 'restore'} queued.`
            : `Announcement ${archived ? 'archived' : 'restored'}.`, data.queued ? 'info' : 'success');
        if (data.queued) {
            if (!archived) {
                announcementFeedState.status = 'active';
                announcementsData = announcementsData.filter(item => Number(item.id || item.announcement_id || 0) !== Number(announcementId));
                await fetchAnnouncementsFromApi();
            } else {
                await mergeQueuedOfficerAnnouncements();
                updateAnnouncementFeedControls();
                renderAnnouncements();
            }
        } else {
            resetAnnouncementFeed();
        }
    } catch (error) {
        console.error('[setAnnouncementArchivedState]', error);
        showToast(error.message || 'Could not update announcement.', 'error');
    }
}

async function returnItem(index) {
    const scopedRentals = getOfficerScopedRentals();
    const item = scopedRentals[index];
    if (!item) return;
    if (await appConfirm(`Mark ${item.item} as returned by ${item.renter}?`, {
        title: 'Confirm item return',
        confirmText: 'Mark returned'
    })) {
        const absoluteIndex = rentalsData.findIndex(r => r.item === item.item && r.renter === item.renter && r.due === item.due);
        if (absoluteIndex > -1) rentalsData.splice(absoluteIndex, 1);
        renderRentals(); // Re-render both tables
    }
}

function viewAllRentals() {
    if (!officerRentalsEnabled) {
        showToast('Rentals are disabled for this organization.', 'error');
        return;
    }
    // 1. Switch to the Services Tracker tab
    if (!navigate('tracker')) return;
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

function openAnalyticsDateFilterModal() {
    const modal = document.getElementById('analyticsDateFilterModal');
    if (!modal) return;
    modal.classList.add('show');
    analyticsCalendarCurrentDate = analyticsCalendarSelectedStart
        ? new Date(analyticsCalendarSelectedStart)
        : new Date();
    renderAnalyticsDateCalendar();
    document.body.style.overflow = 'hidden';
}

function closeAnalyticsDateFilterModal() {
    const modal = document.getElementById('analyticsDateFilterModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function navigateAnalyticsCalendarMonth(offset) {
    analyticsCalendarCurrentDate.setMonth(analyticsCalendarCurrentDate.getMonth() + offset);
    renderAnalyticsDateCalendar();
}

function selectEntireAnalyticsMonth(year = analyticsCalendarCurrentDate.getFullYear(), month = analyticsCalendarCurrentDate.getMonth()) {
    analyticsCalendarSelectedStart = new Date(year, month, 1);
    analyticsCalendarSelectedStart.setHours(0, 0, 0, 0);
    analyticsCalendarSelectedEnd = new Date(year, month + 1, 0);
    analyticsCalendarSelectedEnd.setHours(0, 0, 0, 0);
}

function syncAnalyticsCalendarSelectors() {
    const monthSelect = document.getElementById('analyticsFilterCalendarMonthSelect');
    const yearSelect = document.getElementById('analyticsFilterCalendarYearSelect');
    const selectedYear = analyticsCalendarCurrentDate.getFullYear();
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
        monthSelect.value = String(analyticsCalendarCurrentDate.getMonth());
    }
}

function setAnalyticsCalendarMonth(monthValue) {
    const parsedMonth = Number(monthValue);
    if (Number.isNaN(parsedMonth)) return;
    analyticsCalendarCurrentDate.setMonth(parsedMonth);
    selectEntireAnalyticsMonth(analyticsCalendarCurrentDate.getFullYear(), parsedMonth);
    renderAnalyticsDateCalendar();
}

function setAnalyticsCalendarYear(yearValue) {
    const parsedYear = Number(yearValue);
    if (Number.isNaN(parsedYear)) return;
    analyticsCalendarCurrentDate.setFullYear(parsedYear);
    if (analyticsCalendarSelectedStart && analyticsCalendarSelectedEnd) {
        selectEntireAnalyticsMonth(parsedYear, analyticsCalendarCurrentDate.getMonth());
    }
    renderAnalyticsDateCalendar();
}

function renderAnalyticsDateCalendar() {
    const year = analyticsCalendarCurrentDate.getFullYear();
    const month = analyticsCalendarCurrentDate.getMonth();
    syncAnalyticsCalendarSelectors();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const calendarDays = document.getElementById('analyticsFilterCalendarDays');
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
        if (analyticsCalendarSelectedStart && dateObj.getTime() === analyticsCalendarSelectedStart.getTime()) dayCell.classList.add('selected');
        if (analyticsCalendarSelectedEnd && dateObj.getTime() === analyticsCalendarSelectedEnd.getTime()) dayCell.classList.add('selected');
        if (analyticsCalendarSelectedStart && analyticsCalendarSelectedEnd) {
            if (dateObj >= analyticsCalendarSelectedStart && dateObj <= analyticsCalendarSelectedEnd) {
                dayCell.classList.add('in-range');
            }
        }

        dayCell.addEventListener('click', () => selectAnalyticsCalendarDate(dateObj));
        calendarDays.appendChild(dayCell);
    }

    updateAnalyticsSelectedRangeDisplay();
}

function selectAnalyticsCalendarDate(date) {
    if (!analyticsCalendarSelectedStart || (analyticsCalendarSelectedStart && analyticsCalendarSelectedEnd)) {
        analyticsCalendarSelectedStart = date;
        analyticsCalendarSelectedEnd = null;
    } else if (date < analyticsCalendarSelectedStart) {
        analyticsCalendarSelectedEnd = analyticsCalendarSelectedStart;
        analyticsCalendarSelectedStart = date;
    } else {
        analyticsCalendarSelectedEnd = date;
    }

    renderAnalyticsDateCalendar();
}

function updateAnalyticsSelectedRangeDisplay() {
    const startDisplay = document.getElementById('analyticsSelectedStartDate');
    const endDisplay = document.getElementById('analyticsSelectedEndDate');

    if (startDisplay) {
        startDisplay.textContent = analyticsCalendarSelectedStart
            ? analyticsCalendarSelectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }

    if (endDisplay) {
        endDisplay.textContent = analyticsCalendarSelectedEnd
            ? analyticsCalendarSelectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Not selected';
    }
}

function applyAnalyticsDatePreset(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    analyticsCalendarCurrentDate = new Date(today);

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

    analyticsCalendarSelectedStart = startDate;
    analyticsCalendarSelectedEnd = endDate;
    updateAnalyticsSelectedRangeDisplay();
    renderAnalyticsDateCalendar();
}

function applyAnalyticsDateFilter() {
    analyticsDateFilters.startDate = analyticsCalendarSelectedStart
        ? formatLocalDateKey(analyticsCalendarSelectedStart)
        : null;
    analyticsDateFilters.endDate = analyticsCalendarSelectedEnd
        ? formatLocalDateKey(analyticsCalendarSelectedEnd)
        : null;

    const label = document.getElementById('analyticsDateFilterLabel');
    if (label) {
        if (analyticsDateFilters.startDate && !analyticsDateFilters.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayKey = formatLocalDateKey(today);
            label.textContent = analyticsDateFilters.startDate === todayKey
                ? 'Today'
                : new Date(`${analyticsDateFilters.startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (analyticsDateFilters.startDate || analyticsDateFilters.endDate) {
            const start = analyticsDateFilters.startDate
                ? new Date(`${analyticsDateFilters.startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            const end = analyticsDateFilters.endDate
                ? new Date(`${analyticsDateFilters.endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '...';
            label.textContent = `${start} - ${end}`;
        } else {
            label.textContent = 'All Dates';
        }
    }

    closeAnalyticsDateFilterModal();
    syncCharts(null, 'range');
}

function resetAnalyticsFilters() {
    analyticsDateFilters = { startDate: null, endDate: null };
    analyticsCalendarSelectedStart = null;
    analyticsCalendarSelectedEnd = null;
    analyticsCalendarCurrentDate = new Date();
    const label = document.getElementById('analyticsDateFilterLabel');
    if (label) label.textContent = 'All Dates';
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
    const exportRange = options.exportRange || null;
    const analyticsRange = exportRange || (typeof analyticsDateFilters !== 'undefined' ? analyticsDateFilters : { startDate: null, endDate: null });

    const year = filterYear ? filterYear.value : 'Unknown Year';
    const startDate = analyticsRange.startDate || '';
    const endDate = analyticsRange.endDate || '';

    let dateLabel = `Academic Year ${year}`;
    if (startDate && !endDate) {
        const todayKey = formatLocalDateKey(new Date());
        dateLabel = startDate === todayKey
            ? 'Today'
            : new Date(`${startDate}T00:00:00`).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
    } else if (startDate || endDate) {
        const start = startDate
            ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
            : '...';
        const end = endDate
            ? new Date(`${endDate}T00:00:00`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
            : '...';
        dateLabel = `${start} - ${end}`;
    }

    return {
        year,
        startDate,
        endDate,
        dateLabel: formatAnalyticsExportDateLabel(exportRange, dateLabel),
        exportRange,
        organization: typeof getActiveOfficerOrgName === 'function' ? getActiveOfficerOrgName() : 'Organization'
    };
}

function getAnalyticsExportFileStem(meta) {
    const rangeScope = meta.exportRange && (meta.exportRange.startDate || meta.exportRange.endDate)
        ? `${meta.exportRange.startDate || 'start'}_${meta.exportRange.endDate || 'end'}`
        : null;
    const analyticsScope = meta.startDate || meta.endDate
        ? `${meta.startDate || 'start'}_${meta.endDate || 'end'}`
        : null;
    const scope = rangeScope || analyticsScope || meta.year || 'summary';
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

function normalizeAnalyticsPdfText(value) {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/₱/g, 'PHP ')
        .replace(/[‐‑‒–—]/g, '-')
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g, ' ')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
        .replace(/(?:[A-Za-z0-9+.,%:-]\s+){5,}[A-Za-z0-9+.,%:-]/g, (match) => match.replace(/\s+/g, ''))
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();
}

function addAnalyticsPdfSectionDescription(doc, title, description, startY) {
    const normalizedTitle = normalizeAnalyticsPdfText(title);
    const bodyLines = doc.splitTextToSize(
        normalizeAnalyticsPdfText(description || 'No descriptive analysis available.'),
        180
    );
    const requiredHeight = 10 + (bodyLines.length * 4);
    if (startY + requiredHeight > 278) {
        doc.addPage();
        startY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 33, 71);
    doc.setFont('helvetica', 'bold');
    doc.text(normalizedTitle, 14, startY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    if (typeof doc.setCharSpace === 'function') {
        doc.setCharSpace(0);
    }
    bodyLines.forEach((line, index) => {
        doc.text(String(line), 14, startY + 6 + (index * 4));
    });
    let nextY = startY + 10 + (bodyLines.length * 4);
    if (nextY > 240) {
        doc.addPage();
        nextY = 20;
    }
    return nextY;
}

function buildAnalyticsCsvRows(meta, report, insights = null) {
    const servicesApplicable = report?.availability?.servicesApplicable !== false;
    const serviceNote = servicesApplicable ? 'Inventory utilization' : 'Not applicable — Rentals and Printing are disabled';
    const rows = [
        ['ORGANIZATION ANALYTICS REPORT'],
        ['Organization', meta.organization],
        ['Generated On', new Date().toLocaleString()],
        ['Academic Year', meta.year],
        ['Period Covered', meta.dateLabel],
        [],
        ['SUMMARY'],
        ['Metric', 'Value', 'Notes'],
        ['Total Revenue', servicesApplicable ? formatOfficerPeso(report.totals.revenue) : 'Not applicable', servicesApplicable ? String(report.summaries.revenueTrend).replace(/<[^>]+>/g, '') : serviceNote],
        ['Average Attendance', report.totals.participationAverage, report.summaries.participation],
        ['Total Event Participants', report.totals.participationTotal, `${report.events.length} event(s)`],
        ['Active Rentals', servicesApplicable ? report.counts.rentals.active : 'Not applicable', serviceNote],
        ['Pending Rentals', servicesApplicable ? report.counts.rentals.pending : 'Not applicable', serviceNote],
        ['Overdue Rentals', servicesApplicable ? report.counts.rentals.overdue : 'Not applicable', serviceNote],
        ['Approved Documents', report.counts.docs.approved, 'Document workflow'],
        ['Pending Documents', report.counts.docs.pending, 'Document workflow'],
        ['Rejected Documents', report.counts.docs.rejected, 'Document workflow'],
        [],
        ['AI / DESCRIPTIVE INSIGHTS'],
        ['Provider', insights?.provider || 'rule-based'],
        ['Financial Insight', insights?.chartSummaries?.financial || '-'],
        ['Participation Insight', insights?.chartSummaries?.participation || '-'],
        ['Inventory Insight', insights?.chartSummaries?.inventory || '-'],
        ['Document Insight', insights?.chartSummaries?.documents || '-'],
        ['Export Summary', insights?.exportSummary || '-'],
        [],
        ['REVENUE SERIES'],
        ['Description', insights?.exportSections?.revenueSeries || '-'],
        ['Period', 'Revenue'],
    ];

    if (servicesApplicable && report.charts.revenue.labels.length && !(report.charts.revenue.labels.length === 1 && report.charts.revenue.labels[0] === 'No revenue data')) {
        report.charts.revenue.labels.forEach((label, index) => {
            rows.push([label, formatOfficerPeso(report.charts.revenue.values[index] || 0)]);
        });
    } else {
        rows.push([servicesApplicable ? 'No revenue data' : 'Not applicable', servicesApplicable ? formatOfficerPeso(0) : 'Rentals and Printing are disabled']);
    }

    rows.push([]);
    rows.push(['EVENT PARTICIPATION']);
    rows.push(['Description', insights?.exportSections?.eventParticipation || '-']);
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
    rows.push(['Description', insights?.exportSections?.financialTransactions || '-']);
    rows.push(['Date', 'Service', 'Item', 'Customer', 'Total', 'Payment']);
    if (servicesApplicable && report.financial.length) {
        report.financial.forEach((item) => {
            rows.push([
                formatOfficerFinancialDate(getOfficerFinancialDateValue(item)),
                getOfficerFinancialServiceLabel(item.service_type),
                getOfficerFinancialItemDisplayLabel(item),
                item.customer_name || '-',
                formatOfficerPeso(item.total_cost || 0),
                getOfficerFinancialPaymentLabel(item),
            ]);
        });
    } else {
        rows.push([servicesApplicable ? 'No financial transactions' : 'Not applicable — Rentals and Printing are disabled', '', '', '', '', '']);
    }

    rows.push([]);
    rows.push(['RENTAL RECORDS']);
    rows.push(['Description', insights?.exportSections?.rentalRecords || '-']);
    rows.push(['Item', 'Borrower', 'Due Date', 'Status']);
    if (servicesApplicable && report.rentals.length) {
        report.rentals.forEach((item) => {
            rows.push([item.item || '-', item.renter || '-', item.due || '-', item.status || '-']);
        });
    } else {
        rows.push([servicesApplicable ? 'No rental records' : 'Not applicable — Rentals and Printing are disabled', '', '', '']);
    }

    rows.push([]);
    rows.push(['DOCUMENT WORKFLOW']);
    rows.push(['Description', insights?.exportSections?.documentWorkflow || '-']);
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

async function exportCSV(options = {}) {
    return runAnalyticsExportWithLoading('CSV', async () => {
        const meta = getReportMetadata(options);
        const report = typeof getOfficerAnalyticsReportData === 'function'
            ? getOfficerAnalyticsReportData({ exportRange: meta.exportRange })
            : null;
        if (!report) {
            throw new Error('Analytics data is not ready yet.');
        }

        setAnalyticsExportLoadingMessage('Generating descriptive insights for the CSV report...');
        const insights = typeof getOfficerAnalyticsInsightsData === 'function'
            ? await getOfficerAnalyticsInsightsData({ snapshot: report, render: false })
            : null;
        setAnalyticsExportLoadingMessage('Building the CSV file and starting your download...');
        await waitForAnalyticsExportUiPaint();

        const csvRows = buildAnalyticsCsvRows(meta, report, insights);
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
    });
}

async function exportPDF(options = {}) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF export library is unavailable.');
        return;
    }

    return runAnalyticsExportWithLoading('PDF', async () => {
    const meta = getReportMetadata(options);
    const report = typeof getOfficerAnalyticsReportData === 'function'
        ? getOfficerAnalyticsReportData({ exportRange: meta.exportRange })
        : null;
    if (!report) {
        throw new Error('Analytics data is not ready yet.');
    }

    setAnalyticsExportLoadingMessage('Generating descriptive insights for the PDF report...');
    const insights = typeof getOfficerAnalyticsInsightsData === 'function'
        ? await getOfficerAnalyticsInsightsData({ snapshot: report, render: false })
        : null;
    setAnalyticsExportLoadingMessage('Formatting report sections, tables, and page layout...');
    await waitForAnalyticsExportUiPaint();
    const servicesApplicable = report?.availability?.servicesApplicable !== false;
    const serviceNote = servicesApplicable ? 'Inventory utilization' : 'Not applicable — Rentals and Printing are disabled';

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
            ['Total Revenue', servicesApplicable ? formatOfficerPeso(report.totals.revenue) : 'Not applicable', servicesApplicable ? String(report.summaries.revenueTrend).replace(/<[^>]+>/g, '') : serviceNote],
            ['Average Attendance', String(report.totals.participationAverage), report.summaries.participation],
            ['Total Participants', String(report.totals.participationTotal), `${report.events.length} event(s)`],
            ['Active Rentals', servicesApplicable ? String(report.counts.rentals.active) : 'Not applicable', serviceNote],
            ['Pending Rentals', servicesApplicable ? String(report.counts.rentals.pending) : 'Not applicable', serviceNote],
            ['Overdue Rentals', servicesApplicable ? String(report.counts.rentals.overdue) : 'Not applicable', serviceNote],
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
    doc.setFont('helvetica', 'bold');
    doc.text('Descriptive Insights', 14, currentY);
    const providerLine = `Provider: ${insights?.fallbackUsed ? `${insights?.provider || 'rule-based'} fallback` : (insights?.provider || 'rule-based')}`;
    const insightText = doc.splitTextToSize(
        normalizeAnalyticsPdfText(`${providerLine}\n\n${insights?.exportSummary || 'No descriptive insight available.'}`),
        180
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    if (typeof doc.setCharSpace === 'function') {
        doc.setCharSpace(0);
    }
    insightText.forEach((line, index) => {
        doc.text(String(line), 14, currentY + 6 + (index * 4));
    });

    currentY += 10 + (insightText.length * 4);
    if (currentY > 240) {
        doc.addPage();
        currentY = 20;
    }
    currentY = addAnalyticsPdfSectionDescription(
        doc,
        'Revenue Series',
        insights?.exportSections?.revenueSeries || 'No descriptive analysis available.',
        currentY
    );
    doc.autoTable({
        startY: currentY + 4,
        head: [['Period', 'Revenue']],
        body: (servicesApplicable && report.charts.revenue.labels.length && !(report.charts.revenue.labels.length === 1 && report.charts.revenue.labels[0] === 'No revenue data'))
            ? report.charts.revenue.labels.map((label, index) => [label, formatOfficerPeso(report.charts.revenue.values[index] || 0)])
            : [[servicesApplicable ? 'No revenue data' : 'Not applicable', servicesApplicable ? formatOfficerPeso(0) : 'Rentals and Printing are disabled']],
        theme: 'striped',
        headStyles: { fillColor: [0, 33, 71] },
        styles: { fontSize: 9 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    currentY = addAnalyticsPdfSectionDescription(
        doc,
        'Event Participation',
        insights?.exportSections?.eventParticipation || 'No descriptive analysis available.',
        currentY
    );
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
    currentY = addAnalyticsPdfSectionDescription(
        doc,
        'Financial Transactions',
        insights?.exportSections?.financialTransactions || 'No descriptive analysis available.',
        currentY
    );
    doc.autoTable({
        startY: currentY + 4,
        head: [['Date', 'Service', 'Item', 'Customer', 'Total', 'Payment']],
        body: servicesApplicable && report.financial.length
            ? report.financial.map((item) => [
                formatOfficerFinancialDate(getOfficerFinancialDateValue(item)),
                getOfficerFinancialServiceLabel(item.service_type),
                getOfficerFinancialItemDisplayLabel(item),
                item.customer_name || '-',
                formatOfficerPeso(item.total_cost || 0),
                getOfficerFinancialPaymentLabel(item),
            ])
            : [[servicesApplicable ? 'No financial transactions' : 'Not applicable — Rentals and Printing are disabled', '', '', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    currentY = addAnalyticsPdfSectionDescription(
        doc,
        'Rental Records',
        insights?.exportSections?.rentalRecords || 'No descriptive analysis available.',
        currentY
    );
    doc.autoTable({
        startY: currentY + 4,
        head: [['Item', 'Borrower', 'Due Date', 'Status']],
        body: servicesApplicable && report.rentals.length
            ? report.rentals.map((item) => [item.item || '-', item.renter || '-', item.due || '-', item.status || '-'])
            : [[servicesApplicable ? 'No rental records' : 'Not applicable — Rentals and Printing are disabled', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 },
    });

    currentY = (doc.lastAutoTable?.finalY || currentY) + 10;
    currentY = addAnalyticsPdfSectionDescription(
        doc,
        'Document Workflow',
        insights?.exportSections?.documentWorkflow || 'No descriptive analysis available.',
        currentY
    );
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

    setAnalyticsExportLoadingMessage('Finalizing the PDF and starting your download...');
    await waitForAnalyticsExportUiPaint();
    doc.save(`${getAnalyticsExportFileStem(meta)}.pdf`);
    });
}

// --- WORKFLOW ACTIONS: officer-only forwarding ---
async function submitToSSC(submissionId) {
    if (await appConfirm('Send this adviser-approved document to SSC for review?', {
        title: 'Send document to SSC',
        confirmText: 'Send to SSC'
    })) {
        try {
            const response = await fetch(`${DOCUMENTS_API_BASE}/forward-to-ssc.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ submission_id: Number(submissionId) }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Could not send this document to SSC.');
            }
            await loadDocsFromApi();
            loadOfficerActionCenter(false);
            showToast('Document sent to SSC for review.', 'success');
        } catch (error) {
            showToast(error.message || 'Could not send this document to SSC.', 'error');
        }
    }
}

async function submitToOSA(submissionId) {
    if (await appConfirm('Submit this approved document to OSA for final review?', {
        title: 'Submit document',
        confirmText: 'Submit'
    })) {
        try {
            const response = await fetch(`${DOCUMENTS_API_BASE}/forward-to-osa.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ submission_id: Number(submissionId) }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Could not send this document to OSA.');
            }
            await loadDocsFromApi();
            loadOfficerActionCenter(false);
            showToast('Document sent to OSA for final review.', 'success');
        } catch (error) {
            showToast(error.message || 'Could not send this document to OSA.', 'error');
        }
    }
}

async function cancelDocumentSubmission(submissionId) {
    const confirmed = await appConfirm(
        'Cancel this document permanently? Its workflow history will remain available for audit, but this version cannot be reopened.',
        { title: 'Cancel document', confirmText: 'Cancel Document', danger: true }
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/cancel.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ submission_id: Number(submissionId) }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not cancel this document.');
        }
        await loadDocsFromApi();
        loadOfficerActionCenter(false);
        showToast('Document cancelled. Its history has been retained.', 'info');
    } catch (error) {
        showToast(error.message || 'Could not cancel this document.', 'error');
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
    if (isOfficerAnnouncementPreviewMode()) {
        setupAnnouncementPhotoPreviewCarousel();
        return;
    }

    setupAnnouncementPhotoPreviewCarousel();
    setupAnnouncementContentAutoResize();
    setupAnnouncementFeedFilters();
    loadAnnouncementCourseTargets();
    toggleAnnouncementCourseTargets();
    initTrackerSidebarBehavior();
    initializeOfficerFinancialSummaryDefaultDate();
    initializeOfficerPrintingHistoryDefaultDate();
    syncOfficerDocsTermControlsToActive();
    loadOfficerActiveAcademicTerm();
    renderDocs();
    renderRecentDocs();
    renderAnnouncements();
    fetchAnnouncementsFromApi();
    loadDocsFromApi();
    loadRepoFromApi();
    if (isOfficerDocumentsAutoRefreshActive()) {
        startOfficerDocumentsAutoRefresh();
    }
    officerOrgSyncPromise
        .catch(() => {})
        .finally(() => {
            loadOfficerDashboard(false);
            loadOfficerActionCenter(false);
            loadOfficerFinancialSummary().catch(() => {});
            startOfficerDashboardRealtime();
            loadOfficerPrintingQueue().catch(() => {});
        });
    // Initialize repository counts
    if (typeof updateFolderCounts === 'function') {
        updateFolderCounts();
    }
});

document.addEventListener('visibilitychange', () => {
    startOfficerDashboardRealtime({ refreshNow: !document.hidden });

    if (isOfficerPrintingAutoRefreshActive()) {
        if (!document.hidden) {
            officerPrintingAutoRefreshLastQueueRefresh = 0;
        }
        startOfficerPrintingAutoRefresh({ refreshNow: !document.hidden });
    }

    if (isOfficerDocumentsAutoRefreshActive()) {
        startOfficerDocumentsAutoRefresh({ refreshNow: !document.hidden });
    }
    if (isOfficerLockerAutoRefreshActive()) {
        startOfficerLockerAutoRefresh({ refreshNow: !document.hidden });
    }
});

window.addEventListener('online', () => {
    loadOfficerServiceAccess(true);
    renderAnnouncements();
});

window.addEventListener('offline', renderAnnouncements);


// --- DOCUMENT REPOSITORY LOGIC ---

const DOCUMENTS_API_BASE = '../api/documents';
const OFFICER_DOCUMENTS_POLL_FAST_MS = 5000;
const OFFICER_DOCUMENTS_POLL_SLOW_MS = 30000;
let currentDocsSubView = 'status';
let officerDocumentsAutoRefreshTimer = null;
let officerDocumentsAutoRefreshInFlight = false;
let officerDocumentsListSignature = '';
let officerDocumentsRepositorySignature = '';

function isOfficerDocumentsAutoRefreshActive() {
    return document.getElementById('documents')?.classList.contains('active') === true;
}

function getOfficerDocumentsPollDelay() {
    return document.hidden
        ? OFFICER_DOCUMENTS_POLL_SLOW_MS
        : OFFICER_DOCUMENTS_POLL_FAST_MS;
}

function stopOfficerDocumentsAutoRefresh() {
    if (officerDocumentsAutoRefreshTimer) {
        window.clearTimeout(officerDocumentsAutoRefreshTimer);
        officerDocumentsAutoRefreshTimer = null;
    }
}

function scheduleOfficerDocumentsAutoRefresh(delay = getOfficerDocumentsPollDelay()) {
    stopOfficerDocumentsAutoRefresh();
    if (!isOfficerDocumentsAutoRefreshActive()) return;
    officerDocumentsAutoRefreshTimer = window.setTimeout(() => {
        officerDocumentsAutoRefreshTimer = null;
        pollOfficerDocuments().catch(() => {
            // Background refresh errors stay silent; the existing data remains visible.
        });
    }, delay);
}

async function pollOfficerDocuments() {
    if (!isOfficerDocumentsAutoRefreshActive()) return;
    if (officerDocumentsAutoRefreshInFlight) {
        scheduleOfficerDocumentsAutoRefresh();
        return;
    }

    officerDocumentsAutoRefreshInFlight = true;
    try {
        if (currentDocsSubView === 'repository') {
            await loadRepoFromApi({ silent: true, skipUnchanged: true });
        } else {
            await loadDocsFromApi({ silent: true, skipUnchanged: true });
        }
    } finally {
        officerDocumentsAutoRefreshInFlight = false;
        scheduleOfficerDocumentsAutoRefresh();
    }
}

function startOfficerDocumentsAutoRefresh({ refreshNow = false } = {}) {
    stopOfficerDocumentsAutoRefresh();
    if (!isOfficerDocumentsAutoRefreshActive()) return;
    if (refreshNow && !officerDocumentsAutoRefreshInFlight) {
        pollOfficerDocuments().catch(() => {});
        return;
    }
    scheduleOfficerDocumentsAutoRefresh();
}

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

async function mergeQueuedOfficerDocuments() {
    docsData = docsData
        .filter(item => !(item.pendingSync && (!Number(item.submission_id || item.id || 0) || item.offlineAction === 'submit')))
        .map(item => ({
            ...item,
            pendingSync: false,
            offlineStatus: '',
            offlineOperationId: '',
            offlineError: '',
            offlineAction: '',
            offlineDecision: ''
        }));
    if (!window.NAAPOffline?.listQueuedOperations) return;
    const queued = await window.NAAPOffline.listQueuedOperations('document.submit');
    const session = readAuthSession();
    const optimistic = queued.map(operation => {
        const payload = operation.payload || {};
        const file = operation.files?.[0];
        return {
            title: payload.title || file?.name || 'Queued document',
            typeCategory: normalizeDocumentTypeCategory(payload.document_type),
            customDocumentType: payload.custom_document_type || '',
            type: getDocumentTypeDisplay(payload.document_type, payload.custom_document_type),
            date: fmtDateShort(operation.createdAt),
            submittedAt: operation.createdAt,
            status: 'Queued offline',
            rawStatus: 'queued_offline',
            org: getActiveOfficerOrgName(),
            orgId: Number(session.active_org_id || 0),
            id: 0,
            submission_id: 0,
            semester: officerActiveAcademicTerm.semester,
            academicYear: officerActiveAcademicTerm.academic_year,
            gradingPeriod: officerActiveAcademicTerm.grading_period,
            fileUrl: '',
            viewerId: '',
            submittedByUserId: Number(session.user_id || 0),
            submittedByName: [session.first_name, session.last_name].filter(Boolean).join(' ') || 'You',
            recipient: payload.recipient || 'OSA',
            description: payload.description || '',
            versionNumber: 1,
            hasNewerVersion: false,
            pendingSync: true,
            offlineAction: 'submit',
            offlineStatus: operation.status,
            offlineOperationId: operation.operationId,
            offlineError: operation.lastError || ''
        };
    });
    const queuedChanges = await window.NAAPOffline.listQueuedOperations([
        'document.review', 'document.cancel', 'document.forward_ssc', 'document.forward_osa'
    ]);
    queuedChanges.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach(operation => {
        const submissionId = Number(operation.payload?.submission_id || 0);
        const doc = docsData.find(item => Number(item.submission_id || item.id || 0) === submissionId);
        if (!doc) return;
        doc.pendingSync = true;
        doc.offlineStatus = operation.status;
        doc.offlineOperationId = operation.operationId;
        doc.offlineError = operation.lastError || '';
        doc.offlineAction = operation.type === 'document.cancel'
            ? 'cancel'
            : operation.type === 'document.forward_ssc'
                ? 'forward_ssc'
                : operation.type === 'document.forward_osa'
                    ? 'forward_osa'
                    : 'review';
        doc.offlineDecision = operation.payload?.decision || '';
        if (operation.type === 'document.cancel') {
            doc.status = 'Cancelled';
            doc.rawStatus = 'cancelled';
            doc.cancelledAt = operation.createdAt;
        } else if (operation.type === 'document.forward_ssc') {
            doc.status = 'Pending';
            doc.rawStatus = 'pending';
            doc.recipient = 'SSC';
            doc.forwardedAt = operation.createdAt;
        } else if (operation.type === 'document.forward_osa') {
            doc.status = 'Sent to OSA';
            doc.rawStatus = 'sent_to_osa';
            doc.recipient = 'OSA';
            doc.forwardedAt = operation.createdAt;
        } else if (String(operation.payload?.decision || '').toLowerCase() === 'rejected') {
            doc.status = 'Rejected';
            doc.rawStatus = 'rejected';
        } else {
            doc.status = 'Approval queued';
            doc.rawStatus = 'approval_queued';
        }
        if (operation.type === 'document.review') {
            const decision = String(operation.payload?.decision || '').toLowerCase();
            const notes = String(operation.payload?.notes || '');
            const reviewerName = [readAuthSession().first_name, readAuthSession().last_name].filter(Boolean).join(' ') || 'You';
            if (isOrganizationAdviserDocumentReviewer() && officerOrgMatch(doc.orgId || doc.org)) {
                doc.adviserDecision = decision;
                doc.adviserReviewerName = reviewerName;
                doc.adviserReviewerNotes = notes;
                doc.adviserReviewedAt = operation.createdAt;
                doc.status = decision === 'approved' ? 'Adviser Approved' : 'Rejected';
                doc.rawStatus = decision === 'approved' ? 'adviser_approved' : 'rejected';
            } else {
                doc.sscDecision = decision;
                doc.sscReviewerName = reviewerName;
                doc.sscReviewerNotes = notes;
                doc.sscReviewedAt = operation.createdAt;
                doc.status = decision === 'approved' ? 'SSC Approved' : 'Rejected';
                doc.rawStatus = decision === 'approved' ? 'ssc_approved' : 'rejected';
            }
        }
    });
    const deduped = new Map();
    [...optimistic, ...docsData].forEach(doc => {
        const databaseId = Number(doc.submission_id || doc.id || 0);
        const key = databaseId > 0
            ? `submission:${databaseId}`
            : `offline:${doc.offlineOperationId || `${doc.title}|${doc.submittedAt}`}`;
        const existing = deduped.get(key);
        if (!existing || doc.pendingSync) deduped.set(key, doc);
    });
    docsData = [...deduped.values()];
}

async function loadDocsFromApi({ silent = false, skipUnchanged = false } = {}) {
    try {
        const res = await fetch(`${DOCUMENTS_API_BASE}/list.php`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) return;
        const items = Array.isArray(data.items) ? data.items : [];
        const signature = JSON.stringify(items);
        if (skipUnchanged && signature === officerDocumentsListSignature) return;
        officerDocumentsListSignature = signature;
        docsData = items.map(item => ({
            title: item.title,
            typeCategory: normalizeDocumentTypeCategory(item.document_type),
            customDocumentType: item.custom_document_type || '',
            type: getDocumentTypeDisplay(item.document_type, item.custom_document_type),
            date: fmtDateShort(item.submitted_at),
            submittedAt: item.submitted_at || null,
            status: formatDocumentWorkflowStatus(item.status),
            rawStatus: String(item.status || '').toLowerCase(),
            org: item.org_name || '',
            orgId: Number(item.org_id || 0),
            id: item.submission_id,
            submission_id: item.submission_id,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            gradingPeriod: item.grading_period || null,
            fileUrl: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`,
            submittedByUserId: item.submitted_by_user_id,
            submittedByName: [item.submitted_by_first_name, item.submitted_by_last_name]
                .filter(Boolean)
                .join(' ')
                .trim(),
            reviewerUserId: item.reviewed_by_user_id ? Number(item.reviewed_by_user_id) : null,
            reviewerName: [item.reviewer_first_name, item.reviewer_last_name]
                .filter(Boolean)
                .join(' ')
                .trim(),
            reviewerNotes: item.reviewer_notes || '',
            adviserDecision: item.adviser_decision || null,
            adviserReviewerUserId: item.adviser_reviewed_by_user_id ? Number(item.adviser_reviewed_by_user_id) : null,
            adviserReviewerName: item.adviser_reviewer_name || '',
            adviserReviewerNotes: item.adviser_reviewer_notes || '',
            adviserReviewedAt: item.adviser_reviewed_at || null,
            sscDecision: item.ssc_decision || null,
            sscReviewerUserId: item.ssc_reviewed_by_user_id ? Number(item.ssc_reviewed_by_user_id) : null,
            sscReviewerName: item.ssc_reviewer_name || '',
            sscReviewerNotes: item.ssc_reviewer_notes || '',
            sscReviewedAt: item.ssc_reviewed_at || null,
            osaDecision: item.osa_decision || null,
            osaReviewerUserId: item.osa_reviewed_by_user_id ? Number(item.osa_reviewed_by_user_id) : null,
            osaReviewerName: item.osa_reviewer_name || '',
            osaReviewerNotes: item.osa_reviewer_notes || '',
            osaReviewedAt: item.osa_reviewed_at || null,
            forwardedAt: item.forwarded_at || null,
            forwardedByUserId: item.forwarded_by_user_id ? Number(item.forwarded_by_user_id) : null,
            cancelledAt: item.cancelled_at || null,
            cancelledByUserId: item.cancelled_by_user_id ? Number(item.cancelled_by_user_id) : null,
            recipient: item.recipient || 'OSA',
            description: item.description || '',
            rootSubmissionId: Number(item.root_submission_id || item.submission_id || 0),
            parentSubmissionId: item.parent_submission_id ? Number(item.parent_submission_id) : null,
            versionNumber: Number(item.version_number || 1),
            hasNewerVersion: Boolean(item.has_newer_version),
        }));
        await mergeQueuedOfficerDocuments();
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
        if (!silent) console.error('loadDocsFromApi failed', e);
    }
}

async function loadRepoFromApi({ silent = false, skipUnchanged = false } = {}) {
    try {
        const params = new URLSearchParams();
        const res = await fetch(`${DOCUMENTS_API_BASE}/repository.php?${params.toString()}`, { credentials: 'same-origin' });
        const data = await res.json();
        if (!data.ok) return;
        const items = Array.isArray(data.items) ? data.items : [];
        const signature = JSON.stringify(items);
        if (skipUnchanged && signature === officerDocumentsRepositorySignature) return;
        officerDocumentsRepositorySignature = signature;
        repositoryData = items.map(item => ({
            id: item.repo_id,
            submission_id: item.submission_id,
            name: item.title,
            category: normalizeDocumentTypeCategory(item.document_type),
            customDocumentType: item.custom_document_type || '',
            typeLabel: getDocumentTypeDisplay(item.document_type, item.custom_document_type),
            org: item.org_name,
            orgId: Number(item.org_id || 0),
            date: fmtDateShort(item.approved_at),
            approvedAt: item.approved_at || null,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            gradingPeriod: item.grading_period || null,
            file_url: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`,
            versionNumber: Number(item.version_number || 1),
            recipient: item.recipient || 'OSA',
        }));
        repositoryData.forEach(item => {
            if (typeof PDFViewer !== 'undefined' && item.file_url) {
                PDFViewer.registerRemote(item.viewerId, item.name, item.file_url, { submissionId: item.submission_id });
            }
        });
        renderRepoTable();
        updateRepoCategoryDropdown();
    } catch (e) {
        if (!silent) console.error('loadRepoFromApi failed', e);
    }
}

// 1. Switch View Function (Status Board <-> Repository)
// 1. Switch View Function (Status Board <-> Repository)
function switchDocsSubView(view, btn) {
    currentDocsSubView = view === 'repository' ? 'repository' : 'status';
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
        loadDocsFromApi();
    }
    startOfficerDocumentsAutoRefresh();
}

let currentRepoCategory = 'All';

// 3. Render Repository
// --- UPDATED REPOSITORY LOGIC ---

// 1. Initialize Repository (Call this when view loads)
function initRepository() {
    syncOfficerRepoTermControlsToActive();
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
        "Operational Plan",
        "Others"
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
    const filterSem = document.getElementById('repo-filter-sem')?.value || officerActiveAcademicTerm.semester;
    const filterYear = document.getElementById('repo-filter-year')?.value || officerActiveAcademicTerm.academic_year;
    const filterPeriod = document.getElementById('repo-filter-period')?.value || officerActiveAcademicTerm.grading_period;

    const evaluateRepoItem = (item) => {
        const matchesActiveOrg = isOfficerDocumentVisibleToActiveOrg(item);

        // 1. File Type
        const matchesType = filterType === 'All' || item.category === filterType;

        // 2. Search Text
        const matchesSearch = item.name.toLowerCase().includes(searchInput) ||
            item.category.toLowerCase().includes(searchInput) ||
            String(item.typeLabel || '').toLowerCase().includes(searchInput);

        // 3. Academic Term + Date Logic
        const itemHasTerm = !!(item.semester || item.academicYear || item.gradingPeriod);
        const matchesTerm = !itemHasTerm || (
            String(item.semester || '').toLowerCase() === String(filterSem).toLowerCase()
            && String(item.academicYear || '').trim() === String(filterYear).trim()
            && String(item.gradingPeriod || '').toLowerCase() === String(filterPeriod).toLowerCase()
        );

        const itemDate = item.approvedAt ? new Date(item.approvedAt) : new Date(item.date);
        let matchesDate = true;

        if (repoDateFilter.from && repoDateFilter.to) {
            const checkDate = new Date(itemDate.setHours(0, 0, 0, 0));
            const fromDate = new Date(repoDateFilter.from);
            const toDate = new Date(repoDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);

            matchesDate = checkDate >= fromDate && checkDate <= toDate;

        }

        return {
            item,
            matchesActiveOrg,
            matchesType,
            matchesSearch,
            matchesTerm,
            matchesDate,
            included: matchesActiveOrg && matchesType && matchesSearch && matchesTerm && matchesDate,
            includedIgnoringTerm: matchesActiveOrg && matchesType && matchesSearch && matchesDate,
            term: {
                semester: item.semester || null,
                academicYear: item.academicYear || null,
                gradingPeriod: item.gradingPeriod || null,
            },
        };
    };

    const evaluated = repositoryData.map((item) => evaluateRepoItem(item));
    let filtered = evaluated.filter((entry) => entry.included).map((entry) => entry.item);
    const termFallback = filtered.length === 0
        ? evaluated.filter((entry) => entry.includedIgnoringTerm).map((entry) => entry.item)
        : [];

    if (termFallback.length > 0) {
        filtered = termFallback;
    }

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
                    <span class="status-badge" style="font-size:0.65rem; padding:2px 6px;">v${Number(item.versionNumber || 1)}</span>
                </div>
            </td>
            <td><span class="repo-category-tag">${escapeHtml(item.typeLabel || item.category)}</span></td>
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
    document.getElementById('repo-search-input').value = '';
    syncOfficerRepoTermControlsToActive();

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
