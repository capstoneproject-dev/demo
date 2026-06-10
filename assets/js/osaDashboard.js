const AUTH_SESSION_KEY = 'naapAuthSession';

function readAuthSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

const DEFAULT_OSA_AVATAR = 'https://picsum.photos/seed/osaadmin/150/150';
let osaProfileEditMode = false;
let osaProfileSnapshot = null;

function updateOsaProfileView(session = readAuthSession()) {
    const fullName = session.display_name || 'OSA Staff';
    const roleLabel = session.active_role_name || 'osa_staff';
    const employeeNumber = session.employee_number || 'N/A';
    const email = session.email || '';
    const phone = session.phone || 'N/A';
    const joined = session.authenticated_at ? new Date(session.authenticated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
    const profilePhoto = session.profile_photo || DEFAULT_OSA_AVATAR;

    const headerName = document.querySelector('.user-info span');
    const headerRole = document.querySelector('.user-info small');
    const headerAvatar = document.getElementById('osaHeaderAvatar');
    if (headerName) headerName.innerText = fullName;
    if (headerRole) headerRole.innerText = String(roleLabel).replace('_', ' ').toUpperCase();
    if (headerAvatar) headerAvatar.src = profilePhoto;

    const profileName = document.querySelector('.profile-name');
    const profileRole = document.querySelector('.profile-role');
    const profileAvatar = document.getElementById('osaProfileAvatar');
    if (profileName) profileName.innerText = fullName;
    if (profileRole) profileRole.innerText = String(roleLabel).replace('_', ' ').toUpperCase();
    if (profileAvatar) profileAvatar.src = profilePhoto;

    const fullNameInput = document.getElementById('osaProfileFullNameInput');
    const employeeNumberInput = document.getElementById('osaProfileEmployeeNumberInput');
    const emailInput = document.getElementById('osaProfileEmailInput');
    const departmentInput = document.getElementById('osaProfileDepartmentInput');
    const phoneInput = document.getElementById('osaProfilePhoneInput');
    const dateJoinedInput = document.getElementById('osaProfileDateJoinedInput');
    if (fullNameInput) fullNameInput.value = fullName;
    if (employeeNumberInput) employeeNumberInput.value = employeeNumber;
    if (emailInput) emailInput.value = email;
    if (departmentInput) departmentInput.value = 'Office of Student Affairs';
    if (phoneInput) phoneInput.value = phone;
    if (dateJoinedInput) dateJoinedInput.value = joined;
}

function setOsaProfileEditMode(isEditing) {
    osaProfileEditMode = isEditing;
    const editBtn = document.getElementById('osaProfileEditBtn');
    const cancelBtn = document.getElementById('osaProfileCancelBtn');
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

function snapshotOsaProfileValues() {
    osaProfileSnapshot = {
        full_name: (document.getElementById('osaProfileFullNameInput') || {}).value || '',
        email: (document.getElementById('osaProfileEmailInput') || {}).value || '',
        phone: (document.getElementById('osaProfilePhoneInput') || {}).value || '',
    };
}

function restoreOsaProfileSnapshot() {
    if (!osaProfileSnapshot) return;
    const nameInput = document.getElementById('osaProfileFullNameInput');
    const emailInput = document.getElementById('osaProfileEmailInput');
    const phoneInput = document.getElementById('osaProfilePhoneInput');
    if (nameInput) nameInput.value = osaProfileSnapshot.full_name;
    if (emailInput) emailInput.value = osaProfileSnapshot.email;
    if (phoneInput) phoneInput.value = osaProfileSnapshot.phone;
}

async function saveOsaProfileDetails() {
    const fullName = (document.getElementById('osaProfileFullNameInput') || {}).value?.trim() || '';
    const email = (document.getElementById('osaProfileEmailInput') || {}).value?.trim() || '';
    const phone = (document.getElementById('osaProfilePhoneInput') || {}).value?.trim() || '';

    if (!fullName || !email) {
        showToast('Full name and email are required.', 'error');
        return;
    }

    const editBtn = document.getElementById('osaProfileEditBtn');
    if (editBtn) editBtn.disabled = true;

    try {
        const resp = await fetch('../api/osa/profile/update.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, phone }),
        });
        const data = await resp.json();
        if (!data.ok) {
            showToast(data.error || 'Could not update profile.', 'error');
            return;
        }

        if (data.session) {
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
            updateOsaProfileView(data.session);
        }
        osaProfileSnapshot = null;
        setOsaProfileEditMode(false);
        showToast('Profile updated successfully.', 'success');
    } catch (error) {
        console.error('[saveOsaProfileDetails] error:', error);
        showToast('Could not connect to the server.', 'error');
    } finally {
        if (editBtn) editBtn.disabled = false;
    }
}

function setupOsaProfileEditor() {
    const editBtn = document.getElementById('osaProfileEditBtn');
    const cancelBtn = document.getElementById('osaProfileCancelBtn');

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!osaProfileEditMode) {
                snapshotOsaProfileValues();
                setOsaProfileEditMode(true);
                const firstEditableInput = document.querySelector('#profile [data-editable="true"]');
                if (firstEditableInput) firstEditableInput.focus();
                return;
            }
            await saveOsaProfileDetails();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            restoreOsaProfileSnapshot();
            setOsaProfileEditMode(false);
        });
    }

    setOsaProfileEditMode(false);
}

function setupOsaPasswordForm() {
    const passwordForm = document.getElementById('osaPasswordForm');
    if (!passwordForm) return;

    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const currentPassword = (document.getElementById('osaCurrentPasswordInput') || {}).value || '';
        const newPassword = (document.getElementById('osaNewPasswordInput') || {}).value || '';
        const confirmPassword = (document.getElementById('osaConfirmPasswordInput') || {}).value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('All password fields are required.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        const submitBtn = document.getElementById('osaPasswordSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const resp = await fetch('../api/osa/profile/update-password.php', {
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
            console.error('[setupOsaPasswordForm] error:', error);
            showToast('Could not connect to the server.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

function setupOsaProfilePhotoUploader() {
    const photoBtn = document.getElementById('osaProfilePhotoBtn');
    const photoInput = document.getElementById('osaProfilePhotoInput');
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
            const resp = await fetch('../api/osa/profile/upload-photo.php', {
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
                updateOsaProfileView(data.session);
            } else if (data.photo_url) {
                const session = readAuthSession();
                session.profile_photo = data.photo_url;
                localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
                updateOsaProfileView(session);
            }

            showToast('Profile photo updated successfully.', 'success');
        } catch (error) {
            console.error('[setupOsaProfilePhotoUploader] error:', error);
            showToast('Could not connect to the server.', 'error');
        } finally {
            photoInput.value = '';
            photoBtn.disabled = false;
        }
    });
}


function initOsaAuthContext() {
    const session = readAuthSession();
    const isOsaSession = session && (session.login_role === 'osa' || session.account_type === 'osa_staff') && session.user_id;
    if (!isOsaSession) {
        window.location.href = '../pages/login.html';
        return;
    }

    updateOsaProfileView(session);
}

const DOCUMENTS_API_BASE = '../api/documents';
const OSA_ACTIVITY_FEED_API = '../api/osa/activity-feed.php';
const OSA_ACADEMIC_TERM_API = '../api/osa/settings/academic-term.php';

function fmtDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
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
        const params = new URLSearchParams({ status: 'all' });
        const response = await fetch(`${DOCUMENTS_API_BASE}/list.php?${params.toString()}`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data.ok) return;
        docsData = (data.items || []).map(item => ({
            id: item.submission_id,
            submission_id: item.submission_id,
            title: item.title,
            type: item.document_type,
            org: item.org_name || '',
            status: item.status || 'pending',
            date: fmtDateShort(item.submitted_at),
            submittedAt: item.submitted_at || null,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            gradingPeriod: item.grading_period || null,
            fileUrl: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`
        }));
        docsData.forEach(doc => {
            if (typeof PDFViewer !== 'undefined' && doc.fileUrl) {
                PDFViewer.registerRemote(doc.viewerId, doc.title, doc.fileUrl, { submissionId: doc.submission_id });
            }
        });
        renderDocs(currentDocFilter);
        renderRecentDocs();
        renderMonitoringComplianceForCurrentOrg();
        loadOsaActivityFeed();
    } catch (error) {
        console.error('loadDocsFromApi failed', error);
    }
}

async function loadRepoFromApi() {
    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/repository.php`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data.ok) return;
        repositoryData = (data.items || []).map(item => ({
            id: item.repo_id,
            submission_id: item.submission_id,
            name: item.title,
            category: item.document_type,
            org: item.org_name || '',
            date: fmtDateShort(item.approved_at),
            approvedAt: item.approved_at || null,
            semester: item.semester || null,
            academicYear: item.academic_year || null,
            gradingPeriod: item.grading_period || null,
            file_url: resolvePdfUrl(item.file_url),
            viewerId: `submission_${item.submission_id}`
        }));
        repositoryData.forEach(item => {
            if (typeof PDFViewer !== 'undefined' && item.file_url) {
                PDFViewer.registerRemote(item.viewerId, item.name, item.file_url, { submissionId: item.submission_id });
            }
        });
        updateRepoCategoryDropdown();
        renderRepoTable();
        renderMonitoringComplianceForCurrentOrg();
        loadOsaActivityFeed();
    } catch (error) {
        console.error('loadRepoFromApi failed', error);
    }
}

async function submitReviewDecision(submissionId, decision, notes = '') {
    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/review.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                submission_id: submissionId,
                decision,
                notes
            })
        });
        const data = await response.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to review document.');
        }
        await Promise.all([loadDocsFromApi(), loadRepoFromApi()]);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Failed to review document.');
    }
}

function reviewDocument(submissionId, decision) {
    if (String(decision).toLowerCase() === 'approved') {
        openApproveCommentModal(submissionId);
        return;
    }
    submitReviewDecision(submissionId, decision, '');
}

// --- INTEGRATED THEME LOGIC ---

// Helper function to switch the theme
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

// Logout handler
function handleLogout(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
        showToast('Logging out...', 'info');
        localStorage.removeItem(AUTH_SESSION_KEY);
        setTimeout(() => {
            window.location.href = '../pages/login.html'; // Change to your login page
        }, 1000);
    }
}

// Initialize Theme on Load
document.addEventListener('DOMContentLoaded', () => {
    initOsaAuthContext();

    setupOsaProfileEditor();
    setupOsaPasswordForm();
    setupOsaProfilePhotoUploader();
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

    // Initialize Sidebar Theme Button Click Event
    const sidebarThemeBtn = document.getElementById('themeBtn');
    if (sidebarThemeBtn) {
        sidebarThemeBtn.onclick = switchThemeLogic;
    }
});

// --- DATA SIMULATION ---
const organizations = [
    { id: 1, name: "Supreme Student Council", displayName: "SSC", fullName: "Supreme Student Council", orgCode: "SSC", category: "Student Council", president: "TBD", members: "N/A", status: "Active" },
    { id: 2, name: "AISERS", fullName: "Alliance in Information System Empowered Responsive Students", orgCode: "AISERS", category: "ICS", president: "TBD", members: "N/A", status: "Active" },
    { id: 3, name: "ELITECH", fullName: "Elite Technologist Society", orgCode: "ELITECH", category: "ICS", president: "TBD", members: "N/A", status: "Active" },
    { id: 4, name: "ILASSO", fullName: "Institute of Liberal Arts and Sciences Student Organization", orgCode: "ILASSO", category: "ILAS", president: "TBD", members: "N/A", status: "Active" },
    { id: 5, name: "AERO-ATSO", fullName: "Aeronautical Engineering Organization", orgCode: "AERO-ATSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 6, name: "AETSO", fullName: "Aviation Electronics Technology Student Organization", orgCode: "AETSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 7, name: "AMTSO", fullName: "Aircraft Maintenance Technology Student Organization", orgCode: "AMTSO", category: "INET", president: "TBD", members: "N/A", status: "Active" },
    { id: 8, name: "RCYC", fullName: "Red Cross Youth Council", orgCode: "RCYC", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 9, name: "CYC", fullName: "College Youth Club", orgCode: "CYC", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 10, name: "SCHOLAR'S GUILD", fullName: "Scholar's Guild", orgCode: "SCHOLARS", aliases: ["SCHOLAR'S GUILD"], category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" },
    { id: 11, name: "AERONAUTICA", fullName: "Aeronautica", orgCode: "AERONAUTICA", category: "INTEREST CLUB", president: "TBD", members: "N/A", status: "Active" }
];

function normalizeMonitoringOrgName(name) {
    const normalized = String(name || '').trim().toUpperCase();
    const aliases = {
        'SSC': 'SUPREME STUDENT COUNCIL',
        'SUPREME STUDENT COUNCIL': 'SUPREME STUDENT COUNCIL',
        'AISERS': 'AISERS',
        'ELITECH': 'ELITECH',
        'ILASSO': 'ILASSO',
        'AERO-ATSO': 'AERO-ATSO',
        'AETSO': 'AETSO',
        'AMTSO': 'AMTSO',
        'RCYC': 'RCYC',
        'CYC': 'CYC',
        "SCHOLAR'S GUILD": "SCHOLAR'S GUILD",
        'SCHOLARS GUILD': "SCHOLAR'S GUILD",
        'AERONAUTICA': 'AERONAUTICA'
    };
    return aliases[normalized] || normalized;
}

function parseActivityDate(value) {
    if (!value) return null;
    const parsed = new Date(String(value).replace(/\./g, ''));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatActivityDate(value) {
    const parsed = parseActivityDate(value);
    if (!parsed) return String(value || 'Recent');
    return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function escapeDashboardHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getActivityStatusClass(status) {
    return String(status || 'info')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'info';
}

function formatDashboardActivityDate(value) {
    if (!value) return 'Recent';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatOptionalDashboardActivityDate(value, fallback = 'N/A') {
    if (!value) return fallback;
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value || fallback);
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getDashboardActivityTime(value) {
    if (!value) return 0;
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatActivityDetailLines(details) {
    const lines = String(details || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return '<p style="color:var(--muted);">No additional details were recorded for this activity.</p>';
    }

    return lines.map((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            return `<div class="activity-detail-line activity-detail-line-full">${escapeDashboardHtml(line)}</div>`;
        }

        const label = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return `
            <div class="activity-detail-line">
                <span>${escapeDashboardHtml(label)}</span>
                <strong>${escapeDashboardHtml(value || 'N/A')}</strong>
            </div>
        `;
    }).join('');
}

function parseActivityDetailMap(details) {
    return String(details || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex === -1) return acc;
            const label = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            if (label) acc[label] = value;
            return acc;
        }, {});
}

function resolveActivityAssetPath(path) {
    const rawPath = String(path || '').trim();
    if (!rawPath) return '';
    if (/^(https?:)?\/\//i.test(rawPath) || rawPath.startsWith('/') || rawPath.startsWith('data:')) {
        return rawPath;
    }
    return `../${rawPath.replace(/^\/+/, '')}`;
}

function parseActivityMediaGallery(rawMediaValue) {
    const rawMedia = String(rawMediaValue || '').trim();
    if (!rawMedia) return [];

    try {
        const parsed = JSON.parse(rawMedia);
        if (Array.isArray(parsed)) {
            return parsed.map(resolveActivityAssetPath).filter(Boolean);
        }
    } catch (_error) {
        // Some older rows store a single file path or data URL.
    }

    return [resolveActivityAssetPath(rawMedia)].filter(Boolean);
}

function formatActivityAudienceLabel(audience) {
    const labels = {
        all_students: 'All Students',
        org_members: 'Org Members Only',
        officers: 'Officers'
    };
    return labels[audience] || audience || 'All Students';
}

function formatActivityMoney(value) {
    const amount = Number(value);
    if (Number.isNaN(amount)) return value || 'N/A';
    return `PHP ${amount.toFixed(2)}`;
}

function renderActivityHero(mediaValue, emptyIcon = 'fa-regular fa-image', label = 'Activity media') {
    const photos = parseActivityMediaGallery(mediaValue);
    if (!photos.length) {
        return `
            <div class="activity-object-hero activity-object-hero-empty">
                <i class="${emptyIcon}"></i>
            </div>
        `;
    }

    return `
        <div class="activity-object-hero">
            <img src="${escapeDashboardHtml(photos[0])}" alt="${escapeDashboardHtml(label)}">
            ${photos.length > 1 ? `<span class="activity-object-photo-count">${photos.length} photos</span>` : ''}
        </div>
    `;
}

function renderActivityInfoGrid(items) {
    return `
        <div class="activity-object-grid">
            ${items.map((item) => `
                <div class="activity-object-info">
                    <i class="${escapeDashboardHtml(item.icon || 'fa-regular fa-circle')}"></i>
                    <div>
                        <span>${escapeDashboardHtml(item.label)}</span>
                        <strong>${escapeDashboardHtml(item.value || 'N/A')}</strong>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderActivityTextSection(title, content) {
    return `
        <div class="activity-detail-section">
            <h4>${escapeDashboardHtml(title)}</h4>
            <p>${escapeDashboardHtml(content || 'No details provided.')}</p>
        </div>
    `;
}

function renderActivityFileButton(fileUrl, label = 'Open File') {
    const url = resolveActivityAssetPath(fileUrl);
    if (!url) return '';

    return `
        <a class="btn btn-outline activity-object-file-btn" href="${escapeDashboardHtml(url)}" target="_blank" rel="noopener">
            <i class="fa-regular fa-file-lines"></i>
            ${escapeDashboardHtml(label)}
        </a>
    `;
}

function renderActivityDetailFallback(activity) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Activity')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Info')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: activity.organization || 'N/A' },
        { icon: 'fa-solid fa-hashtag', label: 'Record', value: activity.sourceId ? `${activity.sourceType || 'Source'} #${activity.sourceId}` : (activity.sourceType || 'Grouped activity') },
        { icon: 'fa-regular fa-calendar', label: 'Date Recorded', value: formatDashboardActivityDate(activity.date) },
    ])}
        ${renderActivityTextSection('Summary', activity.details || 'No summary available.')}
        <div class="activity-detail-section">
            <h4>Full Details</h4>
            <div class="activity-detail-lines">
                ${formatActivityDetailLines(activity.fullDetails)}
            </div>
        </div>
    `;
}

function renderAnnouncementActivityDetail(activity, payload, detailMap) {
    return `
        ${renderActivityHero(payload.media, 'fa-regular fa-image', `${payload.title || activity.title} announcement photo`)}
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Announcement')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || (payload.is_published ? 'Posted' : 'Draft'))}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-users', label: 'Audience', value: formatActivityAudienceLabel(payload.audience_type || detailMap.Audience) },
        { icon: 'fa-regular fa-calendar', label: 'Published', value: formatDashboardActivityDate(payload.published_at || activity.date) },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
        { icon: 'fa-solid fa-hashtag', label: 'Announcement ID', value: activity.sourceId ? `#${activity.sourceId}` : 'N/A' },
    ])}
        ${renderActivityTextSection('About this Announcement', payload.content || detailMap.Content || activity.details)}
    `;
}

function renderEventActivityDetail(activity, payload, detailMap) {
    return `
        ${renderActivityHero(payload.media, 'fa-regular fa-calendar', `${payload.event_name || activity.title} event photo`)}
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Event')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Info')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-calendar', label: 'Schedule', value: formatDashboardActivityDate(payload.event_datetime || detailMap['Event Schedule']) },
        { icon: 'fa-solid fa-location-dot', label: 'Venue', value: payload.location || detailMap.Location || 'Venue TBA' },
        { icon: 'fa-solid fa-bullhorn', label: 'Published', value: payload.is_published === 0 ? 'No' : (detailMap.Published || 'Yes') },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
    ])}
        ${renderActivityTextSection('Event Description', payload.description || detailMap.Description || activity.details)}
    `;
}

function renderAttendanceActivityDetail(activity, payload, detailMap) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Event Attendance')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Registered')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-user-check', label: 'Student', value: payload.student_name || detailMap.Student },
        { icon: 'fa-regular fa-id-card', label: 'Student No.', value: payload.student_number || detailMap['Student No'] },
        { icon: 'fa-solid fa-people-group', label: 'Section', value: payload.section || detailMap.Section },
        { icon: 'fa-regular fa-calendar-check', label: 'Event', value: payload.event_name || detailMap.Event },
    ])}
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-clock', label: 'Time In', value: formatOptionalDashboardActivityDate(payload.time_in, detailMap['Time In'] || 'Not checked in') },
        { icon: 'fa-solid fa-clock-rotate-left', label: 'Time Out', value: formatOptionalDashboardActivityDate(payload.time_out, detailMap['Time Out'] || 'Not checked out') },
        { icon: 'fa-solid fa-location-dot', label: 'Venue', value: payload.location || 'Venue TBA' },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
    ])}
    `;
}

function renderRentalInventoryActivityDetail(activity, detailMap) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Rental Inventory')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Updated')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: activity.organization },
        { icon: 'fa-solid fa-boxes-stacked', label: 'Status', value: detailMap.Status || activity.status },
        { icon: 'fa-regular fa-calendar', label: 'Recorded', value: detailMap['Recorded At'] || formatDashboardActivityDate(activity.date) },
    ])}
        ${renderActivityTextSection('Listed or Updated Items', detailMap.Items || activity.details)}
    `;
}

function renderRentalActivityDetail(activity, payload, detailMap) {
    return `
        ${renderActivityHero(payload.media, 'fa-solid fa-box-open', `${payload.items_label || activity.title} rental item`)}
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Rental')}</span>
            <span class="status-badge status-${getActivityStatusClass(payload.status || activity.status)}">${escapeDashboardHtml(payload.status || activity.status || 'Active')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-user', label: 'Student', value: payload.student_name || detailMap.Student },
        { icon: 'fa-regular fa-id-card', label: 'Student No.', value: payload.student_number || detailMap['Student No'] },
        { icon: 'fa-solid fa-box-open', label: 'Items', value: payload.items_label || detailMap.Items },
        { icon: 'fa-solid fa-peso-sign', label: 'Total Cost', value: formatActivityMoney(payload.total_cost || detailMap['Total Cost']) },
    ])}
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-clock', label: 'Rented At', value: formatOptionalDashboardActivityDate(payload.rent_time, detailMap['Rented At'] || 'N/A') },
        { icon: 'fa-regular fa-calendar-xmark', label: 'Expected Return', value: formatOptionalDashboardActivityDate(payload.expected_return_time, detailMap['Expected Return'] || 'N/A') },
        { icon: 'fa-solid fa-rotate-left', label: 'Returned At', value: formatOptionalDashboardActivityDate(payload.actual_return_time, detailMap['Returned At'] || 'Not returned') },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
    ])}
    `;
}

function renderDocumentActivityDetail(activity, payload, detailMap, isRepository = false) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Document')}</span>
            <span class="status-badge status-${getActivityStatusClass(payload.status || activity.status)}">${escapeDashboardHtml(payload.status || activity.status || (isRepository ? 'Approved' : 'Pending'))}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-file-lines', label: 'Document Type', value: payload.document_type || detailMap['Document Type'] },
        { icon: 'fa-solid fa-user-pen', label: isRepository ? 'Repository ID' : 'Submitted By', value: isRepository ? `#${payload.repo_id || activity.sourceId}` : (payload.submitted_by || detailMap['Submitted By']) },
        { icon: 'fa-regular fa-calendar', label: isRepository ? 'Approved At' : 'Submitted At', value: formatOptionalDashboardActivityDate(payload.approved_at || payload.submitted_at, detailMap[isRepository ? 'Approved At' : 'Submitted At'] || 'N/A') },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
    ])}
        ${renderActivityTextSection('Document Description', payload.description || detailMap.Description || activity.details)}
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-graduation-cap', label: 'Semester', value: payload.semester || detailMap.Semester || 'N/A' },
        { icon: 'fa-regular fa-calendar-days', label: 'Academic Year', value: payload.academic_year || detailMap['Academic Year'] || 'N/A' },
        { icon: 'fa-regular fa-comment-dots', label: 'Reviewer Notes', value: payload.reviewer_notes || detailMap['Reviewer Notes'] || 'None' },
    ])}
        ${renderActivityFileButton(payload.file_url, 'Open Document')}
    `;
}

function renderOrganizationActivityDetail(activity, payload, detailMap) {
    const gallery = parseActivityMediaGallery(payload.banner_gallery_json);
    const media = payload.banner_url || gallery[0] || payload.logo_url;

    return `
        ${renderActivityHero(media, 'fa-solid fa-sitemap', `${payload.org_code || activity.organization} profile media`)}
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Organization')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Updated')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.org_code || detailMap.Code || activity.organization },
        { icon: 'fa-solid fa-quote-left', label: 'Motto', value: payload.public_motto || detailMap.Motto || 'N/A' },
        { icon: 'fa-regular fa-envelope', label: 'Email', value: payload.contact_email || detailMap['Contact Email'] || 'N/A' },
        { icon: 'fa-regular fa-calendar', label: 'Updated', value: formatOptionalDashboardActivityDate(payload.updated_at, detailMap['Updated At'] || 'N/A') },
    ])}
        ${renderActivityTextSection('About the Organization', payload.public_about || detailMap.About || activity.details)}
        ${renderActivityTextSection('Contact Details', [
        payload.contact_office ? `Office: ${payload.contact_office}` : '',
        payload.contact_hours ? `Hours: ${payload.contact_hours}` : '',
        payload.contact_phone ? `Phone: ${payload.contact_phone}` : '',
        payload.contact_facebook ? `Facebook: ${payload.contact_facebook}` : '',
        payload.contact_instagram ? `Instagram: ${payload.contact_instagram}` : '',
        payload.contact_tiktok ? `TikTok: ${payload.contact_tiktok}` : '',
    ].filter(Boolean).join('\n') || payload.contact_summary || 'No contact details recorded.')}
    `;
}

function renderServiceAccessActivityDetail(activity, payload, detailMap) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Service Access')}</span>
            <span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status || 'Active')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.org_code || detailMap.Organization || activity.organization },
        { icon: 'fa-solid fa-hand-holding-heart', label: 'Services', value: Number(payload.can_offer_services) === 1 ? 'Enabled' : 'Disabled' },
        { icon: 'fa-solid fa-print', label: 'Printing', value: Number(payload.can_offer_printing) === 1 ? 'Enabled' : 'Disabled' },
        { icon: 'fa-regular fa-calendar', label: 'Updated', value: formatOptionalDashboardActivityDate(payload.updated_at, detailMap['Updated At'] || 'N/A') },
    ])}
        ${renderActivityTextSection('Authorization Summary', activity.details || 'OSA service authorization changed.')}
    `;
}

function renderPrintingActivityDetail(activity, payload, detailMap) {
    return `
        <div class="activity-detail-summary">
            <span class="status-badge status-submitted">${escapeDashboardHtml(activity.type || 'Printing Request')}</span>
            <span class="status-badge status-${getActivityStatusClass(payload.status || activity.status)}">${escapeDashboardHtml(payload.status || activity.status || 'Queued')}</span>
        </div>
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-file-lines', label: 'File', value: payload.file_name || detailMap.File },
        { icon: 'fa-solid fa-user', label: 'Student', value: payload.student_name || detailMap.Student },
        { icon: 'fa-regular fa-id-card', label: 'Student No.', value: payload.student_number || 'N/A' },
        { icon: 'fa-solid fa-list-ol', label: 'Queue #', value: payload.queue_order || detailMap['Queue #'] },
    ])}
        ${renderActivityInfoGrid([
        { icon: 'fa-regular fa-calendar', label: 'Submitted', value: formatOptionalDashboardActivityDate(payload.submitted_at, detailMap['Submitted At'] || 'N/A') },
        { icon: 'fa-solid fa-print', label: 'Processing Started', value: formatOptionalDashboardActivityDate(payload.processing_started_at, 'Not started') },
        { icon: 'fa-solid fa-circle-check', label: 'Ready', value: formatOptionalDashboardActivityDate(payload.ready_at, 'Not ready') },
        { icon: 'fa-solid fa-sitemap', label: 'Organization', value: payload.organization || activity.organization },
    ])}
        ${renderActivityTextSection('Notes', payload.notes || 'No notes provided.')}
    `;
}

function renderTypedActivityDetail(activity) {
    const payload = activity.payload || {};
    const detailMap = parseActivityDetailMap(activity.fullDetails);

    switch (activity.sourceType) {
        case 'announcement':
            return renderAnnouncementActivityDetail(activity, payload, detailMap);
        case 'event':
            return renderEventActivityDetail(activity, payload, detailMap);
        case 'event_attendance':
            return renderAttendanceActivityDetail(activity, payload, detailMap);
        case 'rental_inventory':
            return renderRentalInventoryActivityDetail(activity, detailMap);
        case 'rental':
            return renderRentalActivityDetail(activity, payload, detailMap);
        case 'document_submission':
            return renderDocumentActivityDetail(activity, payload, detailMap, false);
        case 'repository_update':
            return renderDocumentActivityDetail(activity, payload, detailMap, true);
        case 'organization_info':
            return renderOrganizationActivityDetail(activity, payload, detailMap);
        case 'service_access':
            return renderServiceAccessActivityDetail(activity, payload, detailMap);
        case 'printing_request':
            return renderPrintingActivityDetail(activity, payload, detailMap);
        default:
            return renderActivityDetailFallback(activity);
    }
}

function buildOfficerAnnouncementPreviewUrl(activity) {
    if (activity?.sourceType !== 'announcement') return '';

    const previewKey = `osaAnnouncementPreview_${Date.now()}_${activity.sourceId || 'activity'}`;
    const payload = activity.payload || {};
    const announcement = {
        id: activity.sourceId || payload.announcement_id || null,
        announcement_id: activity.sourceId || payload.announcement_id || null,
        title: payload.title || activity.title || 'Untitled Announcement',
        content: payload.content || '',
        audience_type: payload.audience_type || 'all_students',
        announcement_photo: payload.media || '',
        date: payload.published_at || payload.created_at || activity.date || '',
        org: payload.organization || activity.organization || 'Organization',
        org_id: payload.org_id || null,
        is_published: payload.is_published ?? 1,
        event_datetime: payload.event_datetime || '',
        event_location: payload.event_location || '',
    };

    try {
        localStorage.setItem(previewKey, JSON.stringify(announcement));
    } catch (error) {
        console.warn('Could not store announcement preview payload.', error);
    }

    const params = new URLSearchParams({
        preview: '1',
        viewer: 'osa',
        view: 'announcements',
        target: 'announcement',
        preview_key: previewKey,
        cb: String(Date.now())
    });
    if (activity.sourceId) params.set('announcement_id', String(activity.sourceId));

    return `../pages/officerDashboard.html?${params.toString()}`;
}

function buildStudentEventPreviewUrl(activity) {
    if (!['event', 'event_attendance'].includes(activity?.sourceType)) return '';

    const payload = activity.payload || {};
    const eventTitle = payload.event_name || payload.title || activity.title || '';
    const previewKey = `osaEventPreview_${Date.now()}_${activity.sourceId || 'activity'}`;
    const eventPreview = {
        id: activity.sourceType === 'event' ? (activity.sourceId || payload.event_id || null) : null,
        event_id: activity.sourceType === 'event' ? (activity.sourceId || payload.event_id || null) : null,
        title: eventTitle || 'Untitled Event',
        event_name: eventTitle || 'Untitled Event',
        description: payload.description || activity.details || '',
        location: payload.location || 'TBA',
        event_datetime: payload.event_datetime || activity.date || '',
        media: payload.media || '',
        event_photo: payload.media || '',
        organization: payload.organization || activity.organization || '',
        org: payload.organization || activity.organization || '',
        participants: payload.attendance_count || 0
    };

    try {
        localStorage.setItem(previewKey, JSON.stringify(eventPreview));
    } catch (error) {
        console.warn('Could not store event preview payload.', error);
    }

    const params = new URLSearchParams({
        view: 'organizations',
        preview: '1',
        viewer: 'osa',
        target: 'event',
        preview_key: previewKey,
        cb: String(Date.now())
    });

    if (eventPreview.organization) params.set('org', eventPreview.organization);
    if (eventPreview.event_id) params.set('event_id', String(eventPreview.event_id));
    if (eventPreview.title) params.set('event_title', eventPreview.title);

    return `../pages/studentDashboard.html?${params.toString()}`;
}

function buildStudentActivityPreviewUrl(activity) {
    const officerAnnouncementUrl = buildOfficerAnnouncementPreviewUrl(activity);
    if (officerAnnouncementUrl) return officerAnnouncementUrl;

    const studentEventUrl = buildStudentEventPreviewUrl(activity);
    if (studentEventUrl) return studentEventUrl;

    const org = activity?.payload?.organization || activity?.payload?.org_code || activity?.organization || '';
    const params = new URLSearchParams({
        view: 'organizations',
        preview: '1',
        viewer: 'osa',
        cb: String(Date.now())
    });

    if (org) {
        params.set('org', org);
    }

    if (activity.sourceType === 'organization_info') {
        params.set('target', 'organization');
        params.set('section', 'about');
        return `../pages/studentDashboard.html?${params.toString()}`;
    }

    return '';
}

function openActivityView(activityIndex) {
    const activity = getFilteredActivityFeed()[activityIndex];
    if (!activity) {
        showToast('Activity details are no longer available.', 'error');
        return;
    }

    const previewUrl = buildStudentActivityPreviewUrl(activity);
    if (previewUrl) {
        window.open(previewUrl, '_blank', 'noopener');
        return;
    }

    openActivityDetailModal(activityIndex);
}

function buildMonitoringActivities(org) {
    const orgName = normalizeMonitoringOrgName(org?.name);
    return osaActivityFeed
        .filter((activity) => normalizeMonitoringOrgName(activity.organization) === orgName)
        .map((activity) => ({
            title: activity.title || activity.details || 'Activity',
            type: activity.type || 'Activity',
            dateRaw: activity.date,
            dateLabel: formatDashboardActivityDate(activity.date),
            status: activity.status || 'Info'
        }))
        .sort((a, b) => getDashboardActivityTime(b.dateRaw) - getDashboardActivityTime(a.dateRaw));
}

function getMonitoringFilteredActivities() {
    const org = organizations.find(o => o.id === currentOrgId);
    const items = org ? buildMonitoringActivities(org) : [];

    if (!monitoringActivityDateFilter.from || !monitoringActivityDateFilter.to) {
        return items;
    }

    const fromTime = new Date(monitoringActivityDateFilter.from);
    const toTime = new Date(monitoringActivityDateFilter.to);
    fromTime.setHours(0, 0, 0, 0);
    toTime.setHours(23, 59, 59, 999);

    return items.filter((activity) => {
        const activityDate = new Date(activity.dateRaw);
        if (Number.isNaN(activityDate.getTime())) return false;
        return activityDate >= fromTime && activityDate <= toTime;
    });
}

function syncMonitoringActivityRangeInputs() {
    const startInput = document.getElementById('monitoring-activity-range-start');
    const endInput = document.getElementById('monitoring-activity-range-end');
    if (startInput) startInput.value = monitoringActivityRangeStart;
    if (endInput) endInput.value = monitoringActivityRangeEnd;
}

function updateMonitoringActivityRangeSummary(total, visibleCount) {
    const summary = document.getElementById('monitoring-activity-range-summary');
    if (!summary) return;

    if (!total) {
        summary.innerText = 'Showing 0 of 0';
        return;
    }

    const start = Math.min(monitoringActivityRangeStart, total);
    const end = Math.min(monitoringActivityRangeEnd, total);
    summary.innerText = `Showing ${start}-${end} of ${total} (${visibleCount} shown)`;
}

function renderMonitoringActivitiesTable() {
    const eventTable = document.getElementById('monitoring-events-table');
    if (!eventTable) return;

    const org = organizations.find(o => o.id === currentOrgId);
    const activityItems = getMonitoringFilteredActivities();
    if (activityItems.length && monitoringActivityRangeStart > activityItems.length) {
        const windowSize = Math.max(1, monitoringActivityRangeEnd - monitoringActivityRangeStart + 1);
        monitoringActivityRangeStart = Math.max(1, activityItems.length - windowSize + 1);
        monitoringActivityRangeEnd = Math.min(activityItems.length, monitoringActivityRangeStart + windowSize - 1);
    }

    syncMonitoringActivityRangeInputs();

    const startIndex = Math.max(0, monitoringActivityRangeStart - 1);
    const endIndex = Math.max(startIndex + 1, monitoringActivityRangeEnd);
    const visibleItems = activityItems.slice(startIndex, endIndex);

    eventTable.innerHTML = visibleItems.length ? visibleItems.map((activity) => `
        <tr>
            <td>${escapeDashboardHtml(activity.title)}</td>
            <td>${escapeDashboardHtml(activity.type)}</td>
            <td>${escapeDashboardHtml(activity.dateLabel)}</td>
            <td><span class="status-badge status-${getActivityStatusClass(activity.status)}">${escapeDashboardHtml(activity.status)}</span></td>
        </tr>
    `).join('') : `
        <tr>
            <td colspan="4" style="text-align:center; color:var(--muted); padding:24px;">
                No recent activity has been recorded for ${escapeDashboardHtml(org?.name || 'this organization')}.
            </td>
        </tr>
    `;

    updateMonitoringActivityRangeSummary(activityItems.length, visibleItems.length);
}

function applyMonitoringActivityRange() {
    const startInput = document.getElementById('monitoring-activity-range-start');
    const endInput = document.getElementById('monitoring-activity-range-end');
    const total = getMonitoringFilteredActivities().length;
    const requestedStart = Math.max(1, parseInt(startInput?.value || '1', 10) || 1);
    const requestedEnd = Math.max(requestedStart, parseInt(endInput?.value || '10', 10) || 10);

    monitoringActivityRangeStart = total ? Math.min(requestedStart, total) : requestedStart;
    monitoringActivityRangeEnd = total ? Math.min(Math.max(monitoringActivityRangeStart, requestedEnd), total) : requestedEnd;
    syncMonitoringActivityRangeInputs();
    renderMonitoringActivitiesTable();
}

function moveMonitoringActivityRange(direction) {
    const windowSize = Math.max(1, monitoringActivityRangeEnd - monitoringActivityRangeStart + 1);
    const total = getMonitoringFilteredActivities().length;
    if (!total) return;

    if (direction < 0) {
        monitoringActivityRangeStart = Math.max(1, monitoringActivityRangeStart - windowSize);
    } else {
        monitoringActivityRangeStart = Math.min(Math.max(1, total - windowSize + 1), monitoringActivityRangeStart + windowSize);
    }

    monitoringActivityRangeEnd = Math.min(total, monitoringActivityRangeStart + windowSize - 1);
    syncMonitoringActivityRangeInputs();
    renderMonitoringActivitiesTable();
}

let requests = [
    { id: 101, type: "Event Proposal", org: "AISERS", sender: "Pres. Alano", title: "AIS-AHAN: Constituency Check", date: "Oct 24, 2023", status: "Pending" },
    { id: 102, type: "Posting", org: "Supreme Student Council", sender: "VPI Flores", title: "Love Surge", date: "Oct 24, 2023", status: "Pending" },
    { id: 103, type: "Document", org: "AERO-ATSO", sender: "Tres. Beltrano", title: "Semestral Financial Report", date: "Oct 23, 2023", status: "Pending" },
    { id: 104, type: "Event Proposal", org: "SCHOLAR'S GUILD", sender: "PO Martinez", title: "Mental Health Week", date: "Oct 22, 2023", status: "Pending" }
];

let docsData = [];
let osaActivityFeed = [];
let activityRangeStart = 1;
let activityRangeEnd = 10;
let activityDateFilter = { from: null, to: null };
let monitoringActivityRangeStart = 1;
let monitoringActivityRangeEnd = 10;
let monitoringActivityDateFilter = { from: null, to: null };

const transactions = [
    { org: "Supreme Student Council", sender: "Juan Dela Cruz", doc: "Budget Proposal Q4", date: "Oct 25, 2023", status: "Pending" },
    { org: "AISERS", sender: "Maria Clara", doc: "Seminar Speaker Fee", date: "Oct 25, 2023", status: "Approved" },
    { org: "ELITECH", sender: "Jose Rizal", doc: "Hackathon Venue Receipt", date: "Oct 24, 2023", status: "Approved" },
    { org: "ILASSO", sender: "Andres Bonifacio", doc: "Outreach Permit", date: "Oct 24, 2023", status: "Rejected" },
    { org: "RCYC", sender: "Gabriela Silang", doc: "Monthly Dues Report", date: "Oct 23, 2023", status: "Pending" },
    { org: "AETSO", sender: "Emilio Aguinaldo", doc: "Flight Simulation Log", date: "Oct 23, 2023", status: "Approved" }
];

function mapSubmissionStatusToRequestStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    return 'Pending';
}

function mapDocumentTypeToRequestType(documentType) {
    const normalized = String(documentType || '').trim().toLowerCase();
    if (normalized.includes('posting') || normalized.includes('poster') || normalized.includes('pubmat')) {
        return 'Posting';
    }
    if (normalized.includes('proposal')) {
        return 'Event Proposal';
    }
    return 'Document';
}

function buildRequestSenderLabel(item) {
    const fullName = [item.submitted_by_first_name, item.submitted_by_last_name]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ');
    return fullName || 'Unknown Sender';
}

async function loadRequestsFromApi() {
    try {
        const response = await fetch(`${DOCUMENTS_API_BASE}/requests-overview.php`, {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (!data.ok) return;

        requests = (data.items || []).map((item) => {
            const viewerId = `submission_${item.submission_id}`;
            const fileUrl = resolvePdfUrl(item.file_url);
            if (typeof PDFViewer !== 'undefined' && fileUrl) {
                PDFViewer.registerRemote(viewerId, item.title, fileUrl, { submissionId: item.submission_id });
            }

            return {
                id: item.submission_id,
                submissionId: item.submission_id,
                repoId: item.repo_id || null,
                type: mapDocumentTypeToRequestType(item.document_type),
                documentType: item.document_type || 'Document',
                org: item.org_name || '',
                sender: buildRequestSenderLabel(item),
                title: item.title || 'Untitled Document',
                date: fmtDateShort(item.submitted_at),
                submittedAt: item.submitted_at || null,
                reviewedAt: item.reviewed_at || null,
                approvedAt: item.approved_at || null,
                status: mapSubmissionStatusToRequestStatus(item.status),
                rawStatus: item.status || 'pending',
                annotationCount: Number(item.annotation_count || 0),
                latestAnnotationAt: item.latest_annotation_at || null,
                reviewerNotes: item.reviewer_notes || '',
                fileUrl,
                viewerId,
            };
        });

        loadOsaActivityFeed();
        renderRequests();
    } catch (error) {
        console.error('loadRequestsFromApi failed', error);
    }
}

// --- UPDATED DASHBOARD PREVIEW RENDER ---
async function loadOsaActivityFeed() {
    try {
        const response = await fetch(`${OSA_ACTIVITY_FEED_API}?limit=100`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load organization activity.');
        }
        osaActivityFeed = Array.isArray(data.items) ? data.items : [];
        renderDashboardPreview();
        return osaActivityFeed;
    } catch (error) {
        console.error('[loadOsaActivityFeed]', error);
        osaActivityFeed = [];
        renderDashboardPreview();
        return osaActivityFeed;
    }
}

function syncActivityRangeInputs() {
    const startInput = document.getElementById('activity-range-start');
    const endInput = document.getElementById('activity-range-end');
    if (startInput) startInput.value = activityRangeStart;
    if (endInput) endInput.value = activityRangeEnd;
}

function updateActivityRangeSummary(total, visibleCount) {
    const summary = document.getElementById('activity-range-summary');
    if (!summary) return;

    if (!total) {
        summary.innerText = 'Showing 0 of 0';
        return;
    }

    const start = Math.min(activityRangeStart, total);
    const end = Math.min(activityRangeEnd, total);
    summary.innerText = `Showing ${start}-${end} of ${total} (${visibleCount} shown)`;
}

function getFilteredActivityFeed() {
    const sortedItems = [...osaActivityFeed].sort((a, b) => (
        getDashboardActivityTime(b.date) - getDashboardActivityTime(a.date)
    ));

    if (!activityDateFilter.from || !activityDateFilter.to) {
        return sortedItems;
    }

    const fromTime = new Date(activityDateFilter.from);
    const toTime = new Date(activityDateFilter.to);
    fromTime.setHours(0, 0, 0, 0);
    toTime.setHours(23, 59, 59, 999);

    return sortedItems.filter((item) => {
        const activityDate = new Date(item.date);
        if (Number.isNaN(activityDate.getTime())) return false;
        return activityDate >= fromTime && activityDate <= toTime;
    });
}

function applyActivityRange() {
    const startInput = document.getElementById('activity-range-start');
    const endInput = document.getElementById('activity-range-end');
    const total = getFilteredActivityFeed().length;
    const requestedStart = Math.max(1, parseInt(startInput?.value || '1', 10) || 1);
    const requestedEnd = Math.max(requestedStart, parseInt(endInput?.value || '10', 10) || 10);

    activityRangeStart = total ? Math.min(requestedStart, total) : requestedStart;
    activityRangeEnd = total ? Math.min(Math.max(activityRangeStart, requestedEnd), total) : requestedEnd;
    syncActivityRangeInputs();
    renderDashboardPreview();
}

function moveActivityRange(direction) {
    const windowSize = Math.max(1, activityRangeEnd - activityRangeStart + 1);
    const total = getFilteredActivityFeed().length;
    if (!total) return;

    if (direction < 0) {
        activityRangeStart = Math.max(1, activityRangeStart - windowSize);
    } else {
        activityRangeStart = Math.min(Math.max(1, total - windowSize + 1), activityRangeStart + windowSize);
    }

    activityRangeEnd = Math.min(total, activityRangeStart + windowSize - 1);
    syncActivityRangeInputs();
    renderDashboardPreview();
}

function renderDashboardPreview() {
    const tbody = document.getElementById('dashboard-requests-preview');
    if (!tbody) return;

    const activityItems = getFilteredActivityFeed();
    if (activityItems.length && activityRangeStart > activityItems.length) {
        const windowSize = Math.max(1, activityRangeEnd - activityRangeStart + 1);
        activityRangeStart = Math.max(1, activityItems.length - windowSize + 1);
        activityRangeEnd = Math.min(activityItems.length, activityRangeStart + windowSize - 1);
    }

    syncActivityRangeInputs();

    const startIndex = Math.max(0, activityRangeStart - 1);
    const endIndex = Math.max(startIndex + 1, activityRangeEnd);
    const previewItems = activityItems.slice(startIndex, endIndex);
    if (!previewItems.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:var(--muted); padding:24px;">
                    No organization activity matches the selected filters.
                </td>
            </tr>
        `;
        updateActivityRangeSummary(activityItems.length, 0);
        return;
    }

    tbody.innerHTML = previewItems.map((item, index) => `
        <tr>
            <td style="font-weight:600;">${escapeDashboardHtml(item.organization)}</td>
            <td>
                <span class="status-badge status-submitted">${escapeDashboardHtml(item.type)}</span>
                <div style="font-weight:600; margin-top:6px;">${escapeDashboardHtml(item.title)}</div>
            </td>
            <td>${escapeDashboardHtml(item.details)}</td>
            <td>${escapeDashboardHtml(formatDashboardActivityDate(item.date))}</td>
            <td><span class="status-badge status-${getActivityStatusClass(item.status)}">${escapeDashboardHtml(item.status)}</span></td>
            <td class="text-right">
                <button class="btn btn-sm btn-outline icon-only-btn" type="button" onclick="openActivityView(${startIndex + index})" title="View activity">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
    updateActivityRangeSummary(activityItems.length, previewItems.length);
}

function openActivityDetailModal(activityIndex) {
    const activity = getFilteredActivityFeed()[activityIndex];
    if (!activity) {
        showToast('Activity details are no longer available.', 'error');
        return;
    }

    const modal = document.getElementById('activity-detail-modal');
    const title = document.getElementById('activity-detail-title');
    const subtitle = document.getElementById('activity-detail-subtitle');
    const body = document.getElementById('activity-detail-body');
    if (!modal || !title || !subtitle || !body) return;

    title.innerText = activity.title || 'Activity Details';
    subtitle.innerText = `${activity.organization || 'Organization'} - ${activity.type || 'Activity'} - ${formatDashboardActivityDate(activity.date)}`;
    body.innerHTML = renderTypedActivityDetail(activity);

    modal.classList.add('active');
}

function closeActivityDetailModal() {
    const modal = document.getElementById('activity-detail-modal');
    if (modal) modal.classList.remove('active');
}

// --- PDF UPLOAD HANDLER (uses PDFViewer module) ---
async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Use the PDFViewer module to handle upload
        const result = await PDFViewer.handleUpload(file);

        // Add to transactions list for display
        transactions.unshift({
            id: result.docId,
            org: 'Current User',
            sender: 'Me',
            doc: result.name,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Pending'
        });

        // Re-render transactions table
        renderTransactions();
        showToast('PDF uploaded successfully!', 'success');

        // Open the PDF viewer
        PDFViewer.open(result.docId);
    } catch (error) {
        showToast(error.message || 'Failed to upload PDF', 'error');
    }

    // Reset input
    event.target.value = '';
}
let currentOrgId = null;
let osaSectionPollingTimer = null;
let requestsPollingInFlight = false;
let monitoringPollingInFlight = false;

function getActiveOsaSectionId() {
    return document.querySelector('.section-view.active')?.id || 'dashboard';
}

async function pollRequestsPage() {
    if (requestsPollingInFlight || document.hidden || getActiveOsaSectionId() !== 'requests') return;
    requestsPollingInFlight = true;
    try {
        await loadRequestsFromApi();
    } finally {
        requestsPollingInFlight = false;
    }
}

async function pollMonitoringPage() {
    if (monitoringPollingInFlight || document.hidden || getActiveOsaSectionId() !== 'monitoring' || !currentOrgId) return;
    monitoringPollingInFlight = true;
    const org = organizations.find(o => Number(o.id) === Number(currentOrgId));
    try {
        await Promise.all([
            loadDocsFromApi(),
            loadRepoFromApi(),
            loadOsaActivityFeed(),
            loadServiceAuthorizations(true),
        ]);

        if (getActiveOsaSectionId() !== 'monitoring' || !org || Number(currentOrgId) !== Number(org.id)) return;

        renderMonitoringCompliance(org);
        renderMonitoringServiceAuthorizations(currentOrgId);
        const latestActivity = buildMonitoringActivities(org)[0];
        const recency = document.getElementById('monitoring-recency');
        if (recency) {
            recency.innerText = `Last recorded activity: ${latestActivity?.dateLabel || 'No recent records'}`;
        }
        renderMonitoringActivitiesTable();
    } finally {
        monitoringPollingInFlight = false;
    }
}

function runActiveOsaSectionPoll() {
    const activeSection = getActiveOsaSectionId();
    if (activeSection === 'requests') {
        pollRequestsPage();
    } else if (activeSection === 'monitoring') {
        pollMonitoringPage();
    }
}

function startOsaSectionPolling() {
    if (!osaSectionPollingTimer) {
        osaSectionPollingTimer = window.setInterval(runActiveOsaSectionPoll, 3000);
    }
    runActiveOsaSectionPoll();
}

// --- NAVIGATION ---
function navigate(viewId, element) {
    // Update Sidebar Active State
    if (element) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        element.classList.add('active');
    } else {
        // Handling manual navigation (like back button)
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('onclick').includes(viewId)) link.classList.add('active');
            else link.classList.remove('active');
        });
    }

    // Show View
    document.querySelectorAll('.section-view').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');

    // Update Title
    const titleMap = {
        'dashboard': 'OSA Dashboard',
        'organizations': 'Student Organizations',
        'monitoring': 'Organization Monitoring Panel',
        'requests': 'Requests & Approvals',
        'documents': 'Document Repository',
        'account': 'Account Management',
        'profile': 'My Profile' // <-- Add this line
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'OSA Portal';
    startOsaSectionPolling();
}

// --- RENDER FUNCTIONS ---
function renderOrgs() {
    const tbody = document.getElementById('org-list-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('org-search-input')?.value || '').trim().toLowerCase();
    const filteredOrgs = organizations.filter((org) => {
        const searchableValues = [
            org.name,
            org.org_name,
            org.fullName,
            org.full_name,
            org.orgCode,
            org.org_code,
            org.code,
            ...(Array.isArray(org.aliases) ? org.aliases : [])
        ].map((value) => String(value || '').toLowerCase());
        return !searchTerm || searchableValues.some((value) => value.includes(searchTerm));
    });

    if (!filteredOrgs.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" style="text-align:center; color:var(--muted); padding:24px;">
                    No organizations match your search.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredOrgs.map(org => `
        <tr>
            <td><strong>${org.displayName || org.name}</strong></td>
            <td class="text-right">
                <button class="btn btn-sm btn-primary" onclick="openMonitoring(${org.id})">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

function setupOrgSearch() {
    const input = document.getElementById('org-search-input');
    if (!input) return;
    input.addEventListener('input', renderOrgs);
}

function getDefaultAcademicYear(date = new Date()) {
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
}

function getDefaultSemester(date = new Date()) {
    return date.getMonth() >= 5 && date.getMonth() <= 10 ? '1st' : '2nd';
}

function getDefaultGradingPeriod(date = new Date()) {
    const month = date.getMonth();
    if ([5, 6, 11, 0].includes(month)) return 'prelim';
    if ([7, 8, 1, 2].includes(month)) return 'midterm';
    return 'finals';
}

// Academic-term feature boundary: this block syncs the global term from system_settings.
let activeAcademicTerm = {
    academic_year: getDefaultAcademicYear(),
    semester: getDefaultSemester(),
    grading_period: getDefaultGradingPeriod()
};
let activeAcademicTermPromise = null;

function normalizeAcademicTerm(term = {}) {
    return {
        academic_year: String(term.academic_year || term.academicYear || activeAcademicTerm.academic_year || getDefaultAcademicYear()).trim(),
        semester: String(term.semester || activeAcademicTerm.semester || getDefaultSemester()).trim(),
        grading_period: String(term.grading_period || term.gradingPeriod || activeAcademicTerm.grading_period || getDefaultGradingPeriod()).trim().toLowerCase()
    };
}

function isValidAcademicTerm(term) {
    return /^\d{4}-\d{4}$/.test(term.academic_year)
        && ['1st', '2nd'].includes(term.semester)
        && ['prelim', 'midterm', 'finals'].includes(term.grading_period);
}

function formatGradingPeriodLabel(period) {
    const labels = { prelim: 'Prelim', midterm: 'Midterm', finals: 'Finals' };
    return labels[String(period || '').toLowerCase()] || 'Term';
}

function formatAcademicTermLabel(term = activeAcademicTerm) {
    const normalized = normalizeAcademicTerm(term);
    return `${normalized.academic_year} | ${normalized.semester} Semester | ${formatGradingPeriodLabel(normalized.grading_period)}`;
}

function buildAcademicYearOptions(date = new Date(), selectedYear = '') {
    const currentStartYear = Number(getDefaultAcademicYear(date).slice(0, 4));
    const options = Array.from({ length: 3 }, (_item, index) => {
        const startYear = currentStartYear + index;
        return `${startYear}-${startYear + 1}`;
    });

    if (selectedYear && !options.includes(selectedYear)) {
        options.push(selectedYear);
    }

    return options.sort();
}

function populateAcademicYearSelect(select, selectedYear) {
    if (!select) return;
    const options = buildAcademicYearOptions(new Date(), selectedYear || activeAcademicTerm.academic_year);
    select.innerHTML = options.map((academicYear) => (
        `<option value="${academicYear}">${academicYear}</option>`
    )).join('');
    if (selectedYear) select.value = selectedYear;
}

function syncActiveAcademicTermDisplays() {
    const normalized = normalizeAcademicTerm(activeAcademicTerm);
    const dashboardLabel = document.getElementById('dashboard-active-term-label');
    if (dashboardLabel) dashboardLabel.innerText = formatAcademicTermLabel(normalized);

    const profileYear = document.getElementById('profile-academic-year-select');
    const profileSemester = document.getElementById('profile-semester-select');
    const profilePeriod = document.getElementById('profile-period-select');
    populateAcademicYearSelect(profileYear, normalized.academic_year);
    if (profileSemester) profileSemester.value = normalized.semester;
    if (profilePeriod) profilePeriod.value = normalized.grading_period;

    const profileNote = document.getElementById('profile-active-term-note');
    if (profileNote) profileNote.innerText = `Current: ${formatAcademicTermLabel(normalized)}`;
}

function applyActiveTermToViewFilters() {
    complianceTermFilter.semester = activeAcademicTerm.semester;
    complianceTermFilter.academicYear = activeAcademicTerm.academic_year;
    complianceTermFilter.gradingPeriod = activeAcademicTerm.grading_period;
    syncComplianceTermControls();
    syncDocsTermControlsToActive();
    syncRepoTermControlsToActive();
}

function syncAcademicTermFeature({ resetViewFilters = false } = {}) {
    syncActiveAcademicTermDisplays();
    if (resetViewFilters) {
        applyActiveTermToViewFilters();
    } else {
        syncComplianceTermControls();
        syncDocsTermControls();
        syncRepoTermControls();
    }
    renderMonitoringComplianceForCurrentOrg();
    renderRepoTable();
}

async function loadActiveAcademicTerm(force = false) {
    if (activeAcademicTermPromise && !force) return activeAcademicTermPromise;

    activeAcademicTermPromise = fetch(OSA_ACADEMIC_TERM_API, { credentials: 'same-origin' })
        .then((response) => response.json().catch(() => ({})).then((data) => ({ response, data })))
        .then(({ response, data }) => {
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Could not load active academic term.');
            }
            const term = normalizeAcademicTerm(data.term || {});
            if (!isValidAcademicTerm(term)) {
                throw new Error('The active academic term is invalid.');
            }
            activeAcademicTerm = term;
            syncAcademicTermFeature({ resetViewFilters: true });
            return activeAcademicTerm;
        })
        .catch((error) => {
            console.error('[loadActiveAcademicTerm]', error);
            syncAcademicTermFeature();
            return activeAcademicTerm;
        })
        .finally(() => {
            activeAcademicTermPromise = null;
        });

    return activeAcademicTermPromise;
}

async function saveActiveAcademicTerm() {
    const saveBtn = document.getElementById('saveAcademicTermBtn');
    const term = normalizeAcademicTerm({
        academic_year: document.getElementById('profile-academic-year-select')?.value,
        semester: document.getElementById('profile-semester-select')?.value,
        grading_period: document.getElementById('profile-period-select')?.value
    });

    if (!isValidAcademicTerm(term)) {
        showToast('Choose a valid school year, semester, and term.', 'error');
        syncActiveAcademicTermDisplays();
        return;
    }

    try {
        if (saveBtn) saveBtn.disabled = true;
        const response = await fetch(OSA_ACADEMIC_TERM_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(term)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not save academic term.');
        }
        activeAcademicTerm = normalizeAcademicTerm(data.term || term);
        syncAcademicTermFeature({ resetViewFilters: true });
        showToast('Academic term updated.', 'success');
    } catch (error) {
        showToast(error.message || 'Could not save academic term.', 'error');
        syncActiveAcademicTermDisplays();
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

const complianceTermFilter = {
    semester: getDefaultSemester(),
    academicYear: getDefaultAcademicYear(),
    gradingPeriod: getDefaultGradingPeriod()
};

function normalizeComplianceTermValue(value) {
    return String(value || '').trim().toLowerCase();
}

function populateComplianceAcademicYearSelect() {
    const yearSelect = document.getElementById('compliance-academic-year-select');
    populateAcademicYearSelect(yearSelect, complianceTermFilter.academicYear);
}

function syncComplianceTermControls() {
    populateComplianceAcademicYearSelect();
    const semesterSelect = document.getElementById('compliance-semester-select');
    const periodSelect = document.getElementById('compliance-period-select');
    const yearSelect = document.getElementById('compliance-academic-year-select');
    if (semesterSelect) semesterSelect.value = complianceTermFilter.semester;
    if (periodSelect) periodSelect.value = complianceTermFilter.gradingPeriod;
    if (yearSelect) yearSelect.value = complianceTermFilter.academicYear;
}

function setComplianceSemester(semester) {
    if (!['1st', '2nd'].includes(semester)) return;
    complianceTermFilter.semester = semester;
    syncComplianceTermControls();
    renderMonitoringComplianceForCurrentOrg();
}

function setCompliancePeriod(period) {
    if (!['prelim', 'midterm', 'finals'].includes(period)) return;
    complianceTermFilter.gradingPeriod = period;
    syncComplianceTermControls();
    renderMonitoringComplianceForCurrentOrg();
}

function setComplianceAcademicYear(academicYear) {
    const normalized = String(academicYear || '').trim();
    if (!/^\d{4}-\d{4}$/.test(normalized)) {
        showToast('Use academic year format YYYY-YYYY.', 'error');
        syncComplianceTermControls();
        return;
    }
    complianceTermFilter.academicYear = normalized;
    syncComplianceTermControls();
    renderMonitoringComplianceForCurrentOrg();
}

const COMPLIANCE_REQUIREMENTS = [
    {
        label: 'Financial Report',
        aliases: ['financial statement', 'financial report', 'semestral financial report']
    },
    {
        label: 'Activity Report',
        aliases: ['activity report']
    },
    {
        label: 'Audit Status',
        aliases: ['audit report', 'audit status']
    }
];

function getOrgSearchKeys(org) {
    if (!org) return [];
    return [
        org.name,
        org.displayName,
        org.fullName,
        org.orgCode,
        org.org_name,
        org.org_code,
        org.code,
        ...(Array.isArray(org.aliases) ? org.aliases : [])
    ]
        .map((value) => normalizeMonitoringOrgName(value))
        .filter(Boolean);
}

function documentMatchesOrg(item, org) {
    const orgKeys = getOrgSearchKeys(org);
    const itemOrg = normalizeMonitoringOrgName(item?.org || item?.org_name || item?.organization || '');
    return !!itemOrg && orgKeys.includes(itemOrg);
}

function documentMatchesRequirement(item, requirement) {
    const type = String(item?.type || item?.category || item?.document_type || '').trim().toLowerCase();
    const title = String(item?.title || item?.name || '').trim().toLowerCase();
    return requirement.aliases.some((alias) => type.includes(alias) || title.includes(alias));
}

function documentMatchesComplianceTerm(item) {
    const semester = normalizeComplianceTermValue(item?.semester);
    const academicYear = String(item?.academicYear || item?.academic_year || '').trim();
    const gradingPeriod = normalizeComplianceTermValue(item?.gradingPeriod || item?.grading_period);

    return semester === normalizeComplianceTermValue(complianceTermFilter.semester)
        && academicYear === complianceTermFilter.academicYear
        && gradingPeriod === normalizeComplianceTermValue(complianceTermFilter.gradingPeriod);
}

function getComplianceItemTime(item) {
    const rawDate = item?.approvedAt || item?.submittedAt || item?.date || '';
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getComplianceStatusFromSubmission(item) {
    const status = String(item?.status || '').trim().toLowerCase();
    if (status === 'approved') {
        return { label: 'Approved', className: 'status-completed' };
    }
    if (status === 'rejected') {
        return { label: 'For Revision', className: 'status-rejected' };
    }
    return { label: 'Under Review', className: 'status-pending' };
}

function getComplianceState(org, requirement) {
    const approvedMatches = repositoryData
        .filter((item) => documentMatchesOrg(item, org) && documentMatchesRequirement(item, requirement) && documentMatchesComplianceTerm(item))
        .sort((a, b) => getComplianceItemTime(b) - getComplianceItemTime(a));

    if (approvedMatches.length) {
        return { label: 'Approved', className: 'status-completed' };
    }

    const submissionMatches = docsData
        .filter((item) => documentMatchesOrg(item, org) && documentMatchesRequirement(item, requirement) && documentMatchesComplianceTerm(item))
        .sort((a, b) => getComplianceItemTime(b) - getComplianceItemTime(a));

    if (submissionMatches.length) {
        return getComplianceStatusFromSubmission(submissionMatches[0]);
    }

    return { label: 'Not Submitted', className: 'status-pending' };
}

function renderMonitoringCompliance(org) {
    const complianceContainer = document.getElementById('monitoring-compliance-list');
    if (!complianceContainer || !org) return;
    syncComplianceTermControls();

    complianceContainer.innerHTML = COMPLIANCE_REQUIREMENTS.map((requirement) => {
        const state = getComplianceState(org, requirement);
        return `
            <div class="compliance-item">
                <span class="compliance-label">${escapeDashboardHtml(requirement.label)}</span>
                <span class="status-badge ${state.className}">
                    ${escapeDashboardHtml(state.label)}
                </span>
            </div>
        `;
    }).join('');
}

function renderMonitoringComplianceForCurrentOrg() {
    if (!currentOrgId) return;
    const org = organizations.find(o => Number(o.id) === Number(currentOrgId));
    renderMonitoringCompliance(org);
}

let serviceAuthorizationMatrix = { service_catalog: [], organizations: [] };
let serviceAuthorizationPromise = null;
let monitoringOfficersCache = null;

async function loadServiceAuthorizations(force = false) {
    if (serviceAuthorizationPromise && !force) {
        return serviceAuthorizationPromise;
    }

    serviceAuthorizationPromise = fetch('../api/services/osa/list.php', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then((resp) => resp.json().catch(() => ({})).then((data) => ({ resp, data })))
        .then(({ resp, data }) => {
            if (!resp.ok || !data.ok) {
                throw new Error(data.error || 'Could not load service authorizations.');
            }
            serviceAuthorizationMatrix = {
                service_catalog: Array.isArray(data.service_catalog) ? data.service_catalog : [],
                organizations: Array.isArray(data.organizations) ? data.organizations : [],
            };
            return serviceAuthorizationMatrix;
        })
        .catch((error) => {
            console.error('[loadServiceAuthorizations]', error);
            serviceAuthorizationMatrix = { service_catalog: [], organizations: [] };
            return serviceAuthorizationMatrix;
        });

    return serviceAuthorizationPromise;
}

function getServiceAuthorizationOrg(orgId) {
    return (serviceAuthorizationMatrix.organizations || []).find(org => Number(org.org_id) === Number(orgId)) || null;
}

async function loadMonitoringOfficers(org) {
    if (!org) return [];

    if (!monitoringOfficersCache) {
        const response = await fetch('../api/accounts/officers/list.php', {
            method: 'GET',
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not load organization officers.');
        }
        monitoringOfficersCache = Array.isArray(data.items) ? data.items : [];
    }

    const targetName = normalizeMonitoringOrgName(org.name);
    return monitoringOfficersCache.filter((officer) => {
        const officerOrgName = normalizeMonitoringOrgName(officer.orgName || officer.org_name || '');
        const officerOrgCode = normalizeMonitoringOrgName(officer.orgCode || officer.org_code || '');
        const isActive = officer.isActive !== false && officer.is_active !== false && Number(officer.is_active ?? 1) !== 0;
        return isActive && (officerOrgName === targetName || officerOrgCode === targetName);
    });
}

function renderMonitoringOfficers(officers, orgName = 'this organization') {
    const officersContainer = document.getElementById('monitoring-officers-grid');
    if (!officersContainer) return;

    if (!Array.isArray(officers) || officers.length === 0) {
        officersContainer.innerHTML = `
            <div class="officer-card">
                <span class="officer-role">No officers registered</span>
                <div class="officer-name" style="color: var(--muted); font-style: italic;">
                    ${escapeDashboardHtml(orgName)}
                </div>
            </div>
        `;
        return;
    }

    officersContainer.innerHTML = officers.map((officer) => {
        const position = officer.positionTitle || officer.position_title || officer.roleName || officer.role_name || 'Officer';
        const name = officer.studentName || officer.officer_name || officer.officerName || 'Student Name';
        return `
            <div class="officer-card">
                <span class="officer-role">${escapeDashboardHtml(position)}</span>
                <div class="officer-name">${escapeDashboardHtml(name)}</div>
            </div>
        `;
    }).join('');
}

function renderMonitoringServiceAuthorizations(orgId) {
    const container = document.getElementById('monitoring-service-toggles');
    if (!container) return;

    const org = getServiceAuthorizationOrg(orgId);
    const services = Array.isArray(serviceAuthorizationMatrix.service_catalog)
        ? serviceAuthorizationMatrix.service_catalog
        : [];

    if (!org || !services.length) {
        container.innerHTML = `<div style="color: var(--muted); font-size: 0.9rem;">Service authorizations are not available right now.</div>`;
        return;
    }

    container.innerHTML = services.filter((service) => {
        return service.service_key !== 'rentals';
    }).map((service) => {
        const checked = !!(org.services || {})[service.service_key];
        const isMasterServices = service.service_key === 'services';
        const isPrinting = service.service_key === 'printing';
        const isDirectlyManaged = isMasterServices || isPrinting;
        const toggleLabel = isMasterServices
            ? 'Organization Services'
            : service.service_name;
        return `
            <label class="service-toggle-item">
                <div>
                    <strong>${toggleLabel}</strong>
                    <div style="color: var(--muted); font-size: 0.82rem; margin-top: 4px;">
                        ${isDirectlyManaged
                            ? (service.description || '')
                            : 'Available when the organization-wide services switch is enabled.'}
                    </div>
                </div>
                <input type="checkbox"
                       class="service-toggle-checkbox"
                       data-service-key="${service.service_key}"
                       ${checked ? 'checked' : ''}
                       ${isDirectlyManaged ? '' : 'disabled'}
                       >
            </label>
        `;
    }).join('');
}

async function saveMonitoringServiceAuthorizations() {
    if (!currentOrgId) {
        return;
    }

    const inputs = document.querySelectorAll('#monitoring-service-toggles .service-toggle-checkbox');
    const services = {};
    inputs.forEach((input) => {
        services[input.dataset.serviceKey] = !!input.checked;
    });

    try {
        const response = await fetch('../api/services/osa/save.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                org_id: currentOrgId,
                services,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || 'Could not save organization service access.');
        }
        await loadServiceAuthorizations(true);
        renderMonitoringServiceAuthorizations(currentOrgId);
        loadOsaActivityFeed();
        showToast('Organization service access updated.', 'success');
    } catch (error) {
        showToast(error.message || 'Could not save organization service access.', 'error');
    }
}

// --- REQUESTS & APPROVALS STATE ---
let currentReqStatus = 'all';
let pendingRequestAction = null; // Stores {id, action} for modal confirmation
let pendingApproveSubmissionId = null;

// Date picker state
let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();
let selectedFromDate = null;
let selectedToDate = null;

function initReqOrgFilter() {
    const orgSelect = document.getElementById('req-org-filter');
    if (!orgSelect) return;

    // Populate Organizations Dropdown
    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

function switchReqStatus(status, btnElement) {
    currentReqStatus = status;
    const tabs = document.querySelectorAll('.req-tab');
    tabs.forEach(t => t.classList.remove('active'));
    btnElement.classList.add('active');
    renderRequests();
}

function renderRequests() {
    const tbody = document.getElementById('requests-table');
    if (!tbody) return;
    const statusFilter = currentReqStatus;
    const typeFilter = document.getElementById('req-type-filter').value;
    const orgFilter = document.getElementById('req-org-filter').value;

    tbody.innerHTML = '';

    const filtered = requests.filter(req => {
        const matchesType = typeFilter === 'all' || req.type === typeFilter;
        const matchesOrg = orgFilter === 'all' || req.org.includes(orgFilter);
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

        // Date range filtering
        let matchesDate = true;
        if (reqDateFilter.from && reqDateFilter.to) {
            const reqDate = req.submittedAt ? new Date(req.submittedAt) : new Date(req.date);
            matchesDate = reqDate >= reqDateFilter.from && reqDate <= reqDateFilter.to;
        }

        return matchesType && matchesOrg && matchesStatus && matchesDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--muted);">No requests found matching your criteria.</td></tr>`;
        return;
    }

    filtered.forEach(req => {
        let actionButtons = '';

        // New: View Button (Always available)
        // Uses the existing btn-outline class to differentiate from the main actions
        const viewBtn = `
            <button class="btn btn-sm btn-outline" onclick="openPdfViewer('${req.viewerId || ('submission_' + req.id)}')" title="View Document">
                <i class="fa-solid fa-eye"></i>
            </button>
        `;

        if (req.status === 'Pending') {
            // Added wrapper div .req-action-group for styling
            actionButtons = `
                <div class="req-action-group">
                    ${viewBtn}
                    <button class="btn btn-sm btn-success" onclick="handleRequest(${req.id}, 'Approved')" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="handleRequest(${req.id}, 'Rejected')" title="Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        } else {
            // For completed items, show status badge + view button
            actionButtons = `
                <div class="req-action-group">
                    ${viewBtn}
                    <span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span>
                </div>
            `;
        }

        // Split sender name and position for styling (assumes format: "Pos. Name")
        const senderText = String(req.sender || 'Unknown Sender').trim();
        const senderParts = senderText.split(' ');
        const position = senderParts.length > 1 ? senderParts[0] : '';
        const name = senderParts.length > 1 ? senderParts.slice(1).join(' ') : senderText;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="status-badge status-submitted">${req.type}</span></td>
            <td style="font-weight: 600;">${req.org}</td>
            <td>
                <div class="sender-info">
                    <span class="sender-name">${name}</span>
                    <span class="sender-position">${position || req.documentType || 'Document Submitter'}</span>
                </div>
            </td>
            <td>${req.title || req.name}</td>
            <td>${req.date || '---'}</td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Initialize Organization filter for Documents
function initDocOrgFilter() {
    const orgSelect = document.getElementById('filter-by-org');
    if (!orgSelect) return;

    // Clear existing except "All"
    orgSelect.innerHTML = '<option value="all">All Organizations</option>';

    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

// --- PORTED DOCUMENT LOGIC ---
let currentDocFilter = 'All';

function syncDocsTermControls() {
    const yearSelect = document.getElementById('docs-filter-year');
    populateAcademicYearSelect(yearSelect, yearSelect?.value || activeAcademicTerm.academic_year);
}

function syncDocsTermControlsToActive() {
    const yearSelect = document.getElementById('docs-filter-year');
    const semesterSelect = document.getElementById('docs-filter-sem');
    const periodSelect = document.getElementById('docs-filter-period');
    populateAcademicYearSelect(yearSelect, activeAcademicTerm.academic_year);
    if (semesterSelect) semesterSelect.value = activeAcademicTerm.semester;
    if (periodSelect) periodSelect.value = activeAcademicTerm.grading_period;
}

function renderRecentDocs() {
    const list = document.getElementById('recent-docs-list');
    if (!list) return;

    const recentItems = docsData.slice(0, 5);

    list.innerHTML = recentItems.map((doc, index) => {
        let statusText = '';
        let statusClass = '';

        // Mapping statuses to specific requirements: Approved, Rejected, For Revision
        const status = String(doc.status || '').toLowerCase();
        if (status === 'approved') {
            statusText = 'Approved';
            statusClass = 'status-approved';
        } else if (status === 'rejected') {
            statusText = 'Rejected';
            statusClass = 'status-rejected';
        } else {
            statusText = 'Pending Review';
            statusClass = 'status-pending';
        }

        const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];
        const sender = senders[doc.title.length % senders.length];

        return `
            <div class="recent-activity-item">
                <div class="recent-activity-content">
                    <div class="recent-icon">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div class="recent-info">
                        <h5>${doc.title}</h5>
                        <p>Sent by: <strong>${sender}</strong></p>
                        <span class="status-badge ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
                <div class="recent-activity-actions">
                    <button class="btn btn-primary btn-sm icon-only-btn" onclick="openPdfViewer('${doc.viewerId || ('doc_' + index)}')" title="View Document">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
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
    if (!list) return;

    const dateVal = document.getElementById('filter-by-date')?.value || '';
    const monthVal = document.getElementById('filter-by-month')?.value || '';
    const orgVal = document.getElementById('filter-by-org')?.value || 'all';
    const termSemester = document.getElementById('docs-filter-sem')?.value || activeAcademicTerm.semester;
    const termYear = document.getElementById('docs-filter-year')?.value || activeAcademicTerm.academic_year;
    const termPeriod = document.getElementById('docs-filter-period')?.value || activeAcademicTerm.grading_period;

    // DATA SIMULATION POOLS
    const senders = ["Mark De Leon", "Sarah Jimenez", "John Doe", "Ricci Rivero"];

    // Filter Logic
    let filteredData = docsData.filter(doc => {
        const statusText = String(doc.status || '').toLowerCase();

        // 1. Status Filter
        const matchesStatus = (filter === 'All') ||
            (filter === 'Pending' && statusText === 'pending') ||
            (filter === 'Approved' && statusText === 'approved') ||
            (filter === 'Rejected' && statusText === 'rejected');

        // 2. Organization Filter
        const matchesOrg = (orgVal === 'all') || (doc.org === orgVal);

        // 3. Academic term filter
        const matchesTerm = String(doc.semester || '').toLowerCase() === String(termSemester).toLowerCase()
            && String(doc.academicYear || '').trim() === String(termYear).trim()
            && String(doc.gradingPeriod || '').toLowerCase() === String(termPeriod).toLowerCase();

        // 4. Date/Month Filter
        let matchesDate = true;
        let docDateObj;

        docDateObj = doc.submittedAt ? new Date(doc.submittedAt) : new Date(`${doc.date}, 2026`);

        if (docsDateFilter.from && docsDateFilter.to) {
            const fromDate = new Date(docsDateFilter.from);
            const toDate = new Date(docsDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
            matchesDate = docDateObj >= fromDate && docDateObj <= toDate;
        }

        return matchesStatus && matchesOrg && matchesTerm && matchesDate;
    });

    if (filteredData.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--muted); grid-column: 1/-1;">No documents match these filters.</div>`;
        return;
    }

    list.innerHTML = filteredData.map((doc, index) => {
        let statusBadge = '';
        let actionButtons = `
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); openPdfViewer('${doc.viewerId || ('doc_' + index)}')" title="View Document">
                <i class="fa-solid fa-eye"></i>
            </button>`;

        const statusText = String(doc.status || '').toLowerCase();
        if (statusText === 'approved') {
            statusBadge = '<span class="status-badge status-completed" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Approved</span>';
        } else if (statusText === 'rejected') {
            statusBadge = '<span class="status-badge status-rejected" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Rejected</span>';
        } else {
            statusBadge = '<span class="status-badge status-pending" style="font-size:0.65rem; padding:2px 6px; margin-left:8px;">Pending</span>';
            actionButtons += `
                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); reviewDocument(${doc.id}, 'approved')" title="Approve">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); reviewDocument(${doc.id}, 'rejected')" title="Reject">
                    <i class="fa-solid fa-xmark"></i>
                </button>`;
        }

        const sender = senders[doc.title.length % senders.length];

        return `
        <div class="list-item" onclick="openPdfViewer('${doc.viewerId || ('doc_' + index)}')">
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
            <div class="col-ssc mobile-hide">${doc.org || 'N/A'}</div>
            <div class="col-osa mobile-hide">OSA Internal</div>
            <div class="col-status">
                <div class="req-action-group">
                    ${actionButtons}
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterDocs(filter, btnElement) {
    renderDocs(filter, btnElement);
}

function resetDateFilters() {
    const orgInput = document.getElementById('filter-by-org');
    if (orgInput) orgInput.value = 'all';
    syncDocsTermControlsToActive();

    // Reset Docs Date Filter
    docsDateFilter.from = null;
    docsDateFilter.to = null;

    // Reset UI
    const dateBtn = document.querySelector('#docs-status-view .date-range-btn');
    const label = document.getElementById('docs-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    renderDocs(currentDocFilter);
}




function submitToOSA(index) {
    if (confirm('Submit this approved document to OSA for final review?')) {
        if (docsData[index]) {
            docsData[index].status = "Sent to OSA";
            renderDocs(currentDocFilter);
            alert('Document sent to OSA successfully!');
        }
    }
}

function formatShortDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function syncPdfUploadsIntoTransactions() {
    if (!window.PDFViewer || typeof PDFViewer.getUploadsMeta !== 'function') return;

    const uploads = PDFViewer.getUploadsMeta();
    uploads.forEach(upload => {
        const exists = transactions.some(t => t.id === upload.id);
        if (!exists) {
            transactions.unshift({
                id: upload.id,
                org: 'Current User',
                sender: 'Me',
                doc: upload.name,
                date: formatShortDate(upload.uploadDate),
                status: 'Pending'
            });
        }
    });
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
    tbody.innerHTML = transactions.map((t, index) => `
        <tr>
            <td>${t.org}</td>
            <td>${t.sender}</td>
            <td>${t.doc}</td>
            <td>${t.date}</td>
            <td><span class="status-badge status-${t.status.toLowerCase()}">${t.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openPdfViewer('${t.id || 'doc_' + index}')">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

// --- ACTIONS ---

async function openMonitoring(orgId) {
    currentOrgId = orgId;
    const org = organizations.find(o => o.id === orgId);

    if (org) {
        const activityFeedPromise = !osaActivityFeed.length
            ? loadOsaActivityFeed().catch((error) => console.error('[openMonitoring] activity feed load failed:', error))
            : Promise.resolve();

        // 1. Basic Info
        document.getElementById('monitoring-org-name').innerText = org.name;
        document.getElementById('monitoring-org-details').innerText = `${org.category} • ID: ${org.id}`;

        const monitoringActivities = buildMonitoringActivities(org);
        const latestActivity = monitoringActivities[0];
        monitoringActivityRangeStart = 1;
        monitoringActivityRangeEnd = 10;
        syncMonitoringActivityRangeInputs();

        // 2. Activity Recency
        document.getElementById('monitoring-recency').innerText = `Last recorded activity: ${latestActivity?.dateLabel || 'No recent records'}`;

        // 3. Render Compliance Overview
        renderMonitoringCompliance(org);

        // 4. Render Officers & Adviser List
        const officersContainer = document.getElementById('monitoring-officers-grid');
        if (officersContainer) {
            officersContainer.innerHTML = `
                <div class="officer-card">
                    <span class="officer-role">Loading officers</span>
                    <div class="officer-name" style="color: var(--muted); font-style: italic;">Please wait...</div>
                </div>
            `;
        }
        loadMonitoringOfficers(org).then((officers) => {
            if (Number(currentOrgId) === Number(org.id)) {
                renderMonitoringOfficers(officers, org.name);
            }
        }).catch((error) => {
            console.error('[openMonitoring] officers load failed:', error);
            if (officersContainer) {
                officersContainer.innerHTML = `
                    <div class="officer-card">
                        <span class="officer-role">Officers unavailable</span>
                        <div class="officer-name" style="color: var(--muted); font-style: italic;">
                            Could not load officer records
                        </div>
                    </div>
                `;
            }
        });

        // 5. Recent Activities
        renderMonitoringActivitiesTable();
        activityFeedPromise.then(() => {
            if (Number(currentOrgId) !== Number(org.id)) return;
            const refreshedActivities = buildMonitoringActivities(org);
            const refreshedLatest = refreshedActivities[0];
            document.getElementById('monitoring-recency').innerText = `Last recorded activity: ${refreshedLatest?.dateLabel || 'No recent records'}`;
            renderMonitoringActivitiesTable();
        });
    }
    renderMonitoringServiceAuthorizations(orgId);
    loadServiceAuthorizations().then(() => {
        renderMonitoringServiceAuthorizations(orgId);
    }).catch((error) => {
        console.error(error);
        renderMonitoringServiceAuthorizations(orgId);
    });
    navigate('monitoring');
}

function handleRequest(id, action) {
    // Store the pending action and show confirmation modal
    pendingRequestAction = { id, action };
    showRequestActionModal(action);
}

function showRequestActionModal(action) {
    const modal = document.getElementById('request-action-modal');
    const title = document.getElementById('request-action-title');
    const message = document.getElementById('request-action-message');
    const instruction = document.getElementById('request-action-instruction');
    const keyword = document.getElementById('request-action-keyword');
    const input = document.getElementById('request-action-input');
    const confirmBtn = document.getElementById('request-action-confirm-btn');

    // Customize modal based on action
    if (action === 'Approved') {
        title.innerText = 'Approve Request';
        message.innerText = 'Are you sure you want to approve this request? This action cannot be undone.';
        keyword.innerText = '"Approve"';
        confirmBtn.className = 'btn btn-success';
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Approve Request';
    } else if (action === 'Rejected') {
        title.innerText = 'Reject Request';
        message.innerText = 'Are you sure you want to reject this request? This action cannot be undone.';
        keyword.innerText = '"Reject"';
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> Reject Request';
    }

    instruction.innerHTML = `Type <strong id="request-action-keyword">${keyword.innerText}</strong> to confirm:`;
    input.value = '';
    modal.classList.add('active');
    input.focus();
}

function closeRequestActionModal() {
    const modal = document.getElementById('request-action-modal');
    const input = document.getElementById('request-action-input');
    modal.classList.remove('active');
    input.value = '';
    pendingRequestAction = null;
}

function openApproveCommentModal(submissionId) {
    const modal = document.getElementById('approve-comment-modal');
    const textarea = document.getElementById('approve-comment-text');
    if (!modal || !textarea) return;
    pendingApproveSubmissionId = Number(submissionId) || null;
    textarea.value = '';
    modal.classList.add('active');
    textarea.focus();
}

function closeApproveCommentModal() {
    const modal = document.getElementById('approve-comment-modal');
    const textarea = document.getElementById('approve-comment-text');
    if (modal) modal.classList.remove('active');
    if (textarea) textarea.value = '';
    pendingApproveSubmissionId = null;
}

async function confirmApproveWithComment() {
    if (!pendingApproveSubmissionId) return;
    const textarea = document.getElementById('approve-comment-text');
    const notes = (textarea?.value || '').trim();
    const submissionId = pendingApproveSubmissionId;
    closeApproveCommentModal();
    await submitReviewDecision(submissionId, 'approved', notes);
}

function confirmRequestAction() {
    if (!pendingRequestAction) return;

    const input = document.getElementById('request-action-input');
    // Determine expected keyword (Approve/Reject) from the action (Approved/Rejected)
    const expectedKeyword = pendingRequestAction.action === 'Approved' ? 'Approve' : 'Reject';
    const userInput = input.value.trim();

    // Validate input (case-insensitive)
    if (userInput.toLowerCase() !== expectedKeyword.toLowerCase()) {
        showToast(`Please type "${expectedKeyword}" to confirm`, 'error');
        input.focus();
        return;
    }

    // Process the action
    const { id, action } = pendingRequestAction;
    const req = requests.find(r => r.id === id);
    closeRequestActionModal();
    if (!req) return;

    submitReviewDecision(
        req.submissionId || req.id,
        action === 'Approved' ? 'approved' : 'rejected',
        ''
    ).then(() => {
        showToast(`Request "${req.title}" has been ${action}`, action === 'Approved' ? 'success' : 'error');
        loadRequestsFromApi();
    });
}

// --- DATE PICKER CALENDAR FUNCTIONS ---
// Context-Aware Date Picker Logic
let currentDateContext = 'requests'; // 'requests', 'docs', 'repo', 'activity', or 'monitoringActivity'

// Independent Date Filter States
const reqDateFilter = { from: null, to: null };
const docsDateFilter = { from: null, to: null };
const repoDateFilter = { from: null, to: null };

function openDatePicker(context = 'requests') {
    currentDateContext = context;
    const modal = document.getElementById('date-picker-modal');
    modal.classList.add('active');

    // Load existing state for the context
    if (context === 'requests') {
        selectedFromDate = reqDateFilter.from;
        selectedToDate = reqDateFilter.to;
    } else if (context === 'docs') {
        selectedFromDate = docsDateFilter.from;
        selectedToDate = docsDateFilter.to;
    } else if (context === 'repo') {
        selectedFromDate = repoDateFilter.from;
        selectedToDate = repoDateFilter.to;
    } else if (context === 'activity') {
        selectedFromDate = activityDateFilter.from;
        selectedToDate = activityDateFilter.to;
    } else if (context === 'monitoringActivity') {
        selectedFromDate = monitoringActivityDateFilter.from;
        selectedToDate = monitoringActivityDateFilter.to;
    }

    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function closeDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    modal.classList.remove('active');
    // We don't clear selected dates here because they might be pending application or cancellation
    // But to be safe, if cancelled, we should probably reset internal state to saved state?
    // For simplicity, we just close. Next open will re-load from saved state.
}

function renderCalendar(month, year) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calendar-month-label').innerText = `${monthNames[month]} ${year}`;

    const datesContainer = document.getElementById('calendar-dates');
    datesContainer.innerHTML = '';

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date other-month';
        dateDiv.innerText = day;
        datesContainer.appendChild(dateDiv);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);

        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date';
        dateDiv.innerText = day;

        // Mark today
        if (date.getTime() === today.getTime()) {
            dateDiv.classList.add('today');
        }

        // Mark selected dates
        if (selectedFromDate && date.getTime() === selectedFromDate.getTime()) {
            dateDiv.classList.add('selected');
        }
        if (selectedToDate && date.getTime() === selectedToDate.getTime()) {
            dateDiv.classList.add('selected');
        }

        // Mark dates in range
        if (selectedFromDate && selectedToDate &&
            date > selectedFromDate && date < selectedToDate) {
            dateDiv.classList.add('in-range');
        }

        dateDiv.onclick = () => selectDate(date);
        datesContainer.appendChild(dateDiv);
    }

    // Next month days to fill grid
    const totalCells = datesContainer.children.length;
    const remainingCells = 42 - totalCells; // 6 rows x 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'calendar-date other-month';
        dateDiv.innerText = day;
        datesContainer.appendChild(dateDiv);
    }
}

function selectDate(date) {
    if (!selectedFromDate || (selectedFromDate && selectedToDate)) {
        // Start new selection
        selectedFromDate = date;
        selectedToDate = null;
    } else {
        // Complete selection
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
    const fromLabel = document.getElementById('selected-from-date');
    const toLabel = document.getElementById('selected-to-date');

    if (selectedFromDate) {
        fromLabel.innerText = selectedFromDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } else {
        fromLabel.innerText = 'Not selected';
    }

    if (selectedToDate) {
        toLabel.innerText = selectedToDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } else {
        toLabel.innerText = 'Not selected';
    }
}

function changeCalendarMonth(offset) {
    calendarCurrentMonth += offset;

    if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
    } else if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
    }

    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function clearDateRange() {
    selectedFromDate = null;
    selectedToDate = null;
    updateDateRangeDisplay();
    renderCalendar(calendarCurrentMonth, calendarCurrentYear);
}

function applyDateRange() {
    if (selectedFromDate && selectedToDate) {
        const fromStr = selectedFromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const toStr = selectedToDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const labelText = `${fromStr} - ${toStr}`;

        if (currentDateContext === 'requests') {
            reqDateFilter.from = selectedFromDate;
            reqDateFilter.to = selectedToDate;

            const dateBtn = document.querySelector('.requests-filter-bar .date-range-btn');
            const label = document.getElementById('date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderRequests();
        } else if (currentDateContext === 'docs') {
            docsDateFilter.from = selectedFromDate;
            docsDateFilter.to = selectedToDate;

            const dateBtn = document.querySelector('#docs-status-view .date-range-btn');
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
        } else if (currentDateContext === 'activity') {
            activityDateFilter.from = selectedFromDate;
            activityDateFilter.to = selectedToDate;
            activityRangeStart = 1;
            activityRangeEnd = 10;

            const dateBtn = document.querySelector('.dashboard-activity-header-actions .date-range-btn');
            const label = document.getElementById('activity-date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderDashboardPreview();
        } else if (currentDateContext === 'monitoringActivity') {
            monitoringActivityDateFilter.from = selectedFromDate;
            monitoringActivityDateFilter.to = selectedToDate;
            monitoringActivityRangeStart = 1;
            monitoringActivityRangeEnd = 10;

            const dateBtn = document.querySelector('#monitoring .dashboard-activity-header-actions .date-range-btn');
            const label = document.getElementById('monitoring-activity-date-range-label');
            if (label) label.innerText = labelText;
            if (dateBtn) dateBtn.classList.add('active');

            renderMonitoringActivitiesTable();
        }

        closeDatePicker();
        showToast('Date filter applied', 'success');
    } else {
        showToast('Please select both start and end dates', 'error');
    }
}

function clearActivityDateFilter() {
    activityDateFilter.from = null;
    activityDateFilter.to = null;
    activityRangeStart = 1;
    activityRangeEnd = 10;

    if (currentDateContext === 'activity') {
        selectedFromDate = null;
        selectedToDate = null;
    }

    const dateBtn = document.querySelector('.dashboard-activity-header-actions .date-range-btn');
    const label = document.getElementById('activity-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    syncActivityRangeInputs();
    renderDashboardPreview();
    showToast('Activity date filter cleared', 'success');
}

function clearMonitoringActivityDateFilter() {
    monitoringActivityDateFilter.from = null;
    monitoringActivityDateFilter.to = null;
    monitoringActivityRangeStart = 1;
    monitoringActivityRangeEnd = 10;

    if (currentDateContext === 'monitoringActivity') {
        selectedFromDate = null;
        selectedToDate = null;
    }

    const dateBtn = document.querySelector('#monitoring .dashboard-activity-header-actions .date-range-btn');
    const label = document.getElementById('monitoring-activity-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    syncMonitoringActivityRangeInputs();
    renderMonitoringActivitiesTable();
    showToast('Organization activity date filter cleared', 'success');
}

function clearRequestFilters() {
    // Reset all filters
    document.getElementById('req-type-filter').value = 'all';
    document.getElementById('req-org-filter').value = 'all';

    // Clear date range state for requests
    reqDateFilter.from = null;
    reqDateFilter.to = null;

    // Clear global selection if we are in requests context (which we are if clicking this button)
    if (currentDateContext === 'requests') {
        selectedFromDate = null;
        selectedToDate = null;
    }

    const dateBtn = document.querySelector('.requests-filter-bar .date-range-btn');
    const label = document.getElementById('date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    // Re-render
    renderRequests();
    showToast('Filters cleared', 'success');
}

// function filterRequests() {} // Removed as it is replaced by renderRequests internal logic


// --- UTILS ---
function setDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', options);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
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
        <i class="fa-solid fa-xmark" style="cursor:pointer; opacity:0.5;" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    setDate();
    resetDateFilters(); // Reset date filters on load
    syncActiveAcademicTermDisplays();
    loadActiveAcademicTerm();

    // Initialize Dashboard
    renderDashboardPreview();
    loadOsaActivityFeed();

    // Initialize Documents Logic
    initDocOrgFilter(); // Initialize document organization filter
    renderDocs();
    renderRecentDocs();
    loadDocsFromApi();

    // Initialize Requests
    initReqOrgFilter();
    renderRequests();
    loadRequestsFromApi();
    setupOrgSearch();
    syncComplianceTermControls();
    renderOrgs();
    loadServiceAuthorizations()
        .then(() => loadOsaActivityFeed())
        .catch((error) => console.error(error));

    // Initialize Date Picker defaults
    const today = new Date();
    document.getElementById('calendar-month-label').innerText =
        `${today.toLocaleString('default', { month: 'long' })} ${today.getFullYear()}`;
    renderCalendar(today.getMonth(), today.getFullYear());

    // Initialize Transactions
    renderTransactions();
    loadRepoFromApi();

    // Add Enter key listener for confirmation modal
    const actionInput = document.getElementById('request-action-input');
    if (actionInput) {
        actionInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                confirmRequestAction();
            }
        });
    }

    const approveCommentInput = document.getElementById('approve-comment-text');
    if (approveCommentInput) {
        approveCommentInput.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                confirmApproveWithComment();
            }
        });
    }
    startOsaSectionPolling();
});

document.addEventListener('pdfviewer:ready', () => {
    syncPdfUploadsIntoTransactions();
    renderTransactions();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        runActiveOsaSectionPoll();
    }
});

window.addEventListener('click', function (event) {
    const modal = document.getElementById('approve-comment-modal');
    if (modal && event.target === modal) {
        closeApproveCommentModal();
    }
    const activityDetailModal = document.getElementById('activity-detail-modal');
    if (activityDetailModal && event.target === activityDetailModal) {
        closeActivityDetailModal();
    }
});

// --- DOCUMENT REPOSITORY LOGIC ---

// --- UPDATED REPOSITORY LOGIC ---

let repositoryData = [];

let currentRepoCategory = 'All';

// --- UPDATED REPOSITORY LOGIC ---

function syncRepoTermControls() {
    populateAcademicYearSelect(document.getElementById('repo-filter-year'), document.getElementById('repo-filter-year')?.value || activeAcademicTerm.academic_year);
}

function syncRepoTermControlsToActive() {
    const yearSelect = document.getElementById('repo-filter-year');
    const semesterSelect = document.getElementById('repo-filter-sem');
    const periodSelect = document.getElementById('repo-filter-period');
    populateAcademicYearSelect(yearSelect, activeAcademicTerm.academic_year);
    if (semesterSelect) semesterSelect.value = activeAcademicTerm.semester;
    if (periodSelect) periodSelect.value = activeAcademicTerm.grading_period;
}

// 1. Initialize Repository
function initRepository() {
    initRepoOrgFilter();
    syncRepoTermControlsToActive();
    updateRepoCategoryDropdown(); // Calculates counts and updates Dropdown text
    renderRepoTable();
}

// 2. Populate Organization Dropdown
function initRepoOrgFilter() {
    const orgSelect = document.getElementById('repo-filter-org');
    if (!orgSelect) return;

    // Check if we need to repopulate (avoid duplicates if already populated)
    if (orgSelect.options.length > 1) return;

    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.name;
        option.innerText = org.name;
        orgSelect.appendChild(option);
    });
}

// 3. Update File Type Dropdown with Counts
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
    typeSelect.options[0].text = `All Types (${totalCount})`;

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

// 4. Render Repository Table
function renderRepoTable() {
    const tbody = document.getElementById('repository-table-body');
    if (!tbody) return;

    // Get Filter Values
    const searchInput = document.getElementById('repo-search-input')?.value.toLowerCase() || '';
    const filterType = document.getElementById('repo-filter-type')?.value || 'All';
    const filterOrg = document.getElementById('repo-filter-org')?.value || 'all';
    const filterSem = document.getElementById('repo-filter-sem')?.value || activeAcademicTerm.semester;
    const filterYear = document.getElementById('repo-filter-year')?.value || activeAcademicTerm.academic_year;
    const filterPeriod = document.getElementById('repo-filter-period')?.value || activeAcademicTerm.grading_period;

    // Filter Logic
    const filtered = repositoryData.filter(item => {
        // 1. File Type
        const matchesType = filterType === 'All' || item.category === filterType;

        // 2. Organization
        const matchesOrg = filterOrg === 'all' || item.org === filterOrg;

        // 3. Search Text
        const matchesSearch = item.name.toLowerCase().includes(searchInput) ||
            item.org.toLowerCase().includes(searchInput);

        // 4. Term and Date Logic
        const matchesTerm = String(item.semester || '').toLowerCase() === String(filterSem).toLowerCase()
            && String(item.academicYear || '').trim() === String(filterYear).trim()
            && String(item.gradingPeriod || '').toLowerCase() === String(filterPeriod).toLowerCase();

        const itemDate = item.approvedAt ? new Date(item.approvedAt) : new Date(item.date);
        let matchesDate = true;

        if (repoDateFilter.from && repoDateFilter.to) {
            const fromDate = new Date(repoDateFilter.from);
            const toDate = new Date(repoDateFilter.to);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
            matchesDate = itemDate >= fromDate && itemDate <= toDate;
        }

        return matchesType && matchesOrg && matchesSearch && matchesTerm && matchesDate;
    });

    // Update Header Label
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
                <button class="btn btn-sm btn-outline" onclick="openPdfViewer('${item.viewerId || ('repo_' + item.id)}')">
                    <i class="fa-solid fa-download"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 5. Reset Function
function resetRepoFilters() {
    document.getElementById('repo-filter-type').value = 'All';
    document.getElementById('repo-filter-org').value = 'all';
    document.getElementById('repo-search-input').value = '';
    syncRepoTermControlsToActive();

    // Reset Date Filter
    repoDateFilter.from = null;
    repoDateFilter.to = null;

    const dateBtn = document.querySelector('#docs-repository-view .date-range-btn');
    const label = document.getElementById('repo-date-range-label');
    if (label) label.innerText = 'Select Date Range';
    if (dateBtn) dateBtn.classList.remove('active');

    renderRepoTable();
    showToast('Filters reset', 'info');
}

// Hook initRepository into the switch view logic (Same as before, ensuring init is called)
function switchDocsSubView(view, btn) {
    const buttons = document.querySelectorAll('.sub-nav-btn');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const statusView = document.getElementById('docs-status-view');
    const repoView = document.getElementById('docs-repository-view');

    if (view === 'repository') {
        statusView.style.display = 'none';
        repoView.style.display = 'block';
        loadRepoFromApi();
        initRepository();
    } else {
        statusView.style.display = 'grid';
        repoView.style.display = 'none';
    }
}
