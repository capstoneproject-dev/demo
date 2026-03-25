/* =====================
   AUTH + UI STATE (LocalStorage simulation of SQL flow)
   ===================== */
const AUTH_DB_KEY = 'naapAuthDB_v1';
const AUTH_SESSION_KEY = 'naapAuthSession';
const LEGACY_STUDENT_PROFILE_KEY = 'naapStudentProfile';
const ACCOUNTS_APPROVED_KEY = 'AccountsSystem_studentAccounts';
const PENDING_REQUESTS_KEY = 'AccountsSystem_pendingRequests';

const COURSE_INSTITUTE_MAP = {
  BSAIT: 'Institute of Computer Studies',
  BSAIS: 'Institute of Computer Studies',
  BSAET: 'Institute of Engineering Technology',
  BSAT: 'Institute of Engineering Technology',
  BSAMT: 'Institute of Engineering Technology',
  BSAEE: 'Institute of Engineering Technology',
  'BAT-AET': 'Institute of Engineering Technology',
  AVCOMM: 'Institute of Liberal Arts and Sciences',
  AVLOG: 'Institute of Liberal Arts and Sciences',
  AVSSM: 'Institute of Liberal Arts and Sciences',
  AVTOUR: 'Institute of Liberal Arts and Sciences'
};

function normalizeCourse(code) {
  return String(code || '').trim().toUpperCase();
}

function normalizeOrgName(name) {
  const raw = String(name || '').trim();
  const upper = raw.toUpperCase();
  const aliases = {
    SSC: 'Supreme Student Council',
    'SUPREME STUDENT COUNCIL': 'Supreme Student Council',
    AERONAUTICA: 'AERONAUTICA',
    "SCHOLAR'S GUILD": "SCHOLAR'S GUILD",
    'SCHOLARS GUILD': "SCHOLAR'S GUILD",
    AMT: 'AMTSO',
    AET: 'AETSO'
  };
  return aliases[upper] || raw;
}

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(rows, keyName) {
  if (!Array.isArray(rows) || rows.length === 0) return 1;
  return rows.reduce((maxId, row) => Math.max(maxId, Number(row[keyName]) || 0), 0) + 1;
}

function splitName(fullName) {
  const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { first_name: '', last_name: '' };
  const parts = clean.split(' ');
  if (parts.length === 1) return { first_name: parts[0], last_name: '-' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1]
  };
}

function seedAuthDb() {
  const organizations = [
    { org_id: 1, org_name: 'AISERS', org_code: 'AISERS', status: 'active' },
    { org_id: 2, org_name: 'ELITECH', org_code: 'ELITECH', status: 'active' },
    { org_id: 3, org_name: 'CYC', org_code: 'CYC', status: 'active' },
    { org_id: 4, org_name: 'Supreme Student Council', org_code: 'SSC', status: 'active' },
    { org_id: 5, org_name: 'ILASSO', org_code: 'ILASSO', status: 'active' },
    { org_id: 6, org_name: 'AERO-ATSO', org_code: 'AERO-ATSO', status: 'active' },
    { org_id: 7, org_name: 'AETSO', org_code: 'AETSO', status: 'active' },
    { org_id: 8, org_name: 'AMTSO', org_code: 'AMTSO', status: 'active' },
    { org_id: 9, org_name: 'RCYC', org_code: 'RCYC', status: 'active' },
    { org_id: 10, org_name: "SCHOLAR'S GUILD", org_code: 'PSG', status: 'active' },
    { org_id: 11, org_name: 'AERONAUTICA', org_code: 'AERONAUTICA', status: 'active' }
  ];

  const orgRoles = [];
  let roleId = 1;
  organizations.forEach((org) => {
    orgRoles.push({ role_id: roleId++, org_id: org.org_id, role_name: 'officer', can_access_org_dashboard: 1, is_active: 1 });
    orgRoles.push({ role_id: roleId++, org_id: org.org_id, role_name: 'auditor', can_access_org_dashboard: 1, is_active: 1 });
    orgRoles.push({ role_id: roleId++, org_id: org.org_id, role_name: 'member', can_access_org_dashboard: 0, is_active: 1 });
  });

  const academicPrograms = [
    'BSAIT', 'BSAIS', 'BSAET', 'BSAT', 'BSAMT', 'BSAeE', 'BAT-AET', 'AvComm', 'Avlog', 'AvSSm', 'AvTour'
  ].map((code, idx) => ({
    program_id: idx + 1,
    program_code: code,
    institute_name: COURSE_INSTITUTE_MAP[normalizeCourse(code)] || 'Institute of Computer Studies',
    is_active: 1
  }));

  const orgByCode = Object.fromEntries(organizations.map((org) => [org.org_code.toUpperCase(), org.org_id]));

  const programOrgMappings = [
    ['BSAIT', 'ELITECH'],
    ['BSAIS', 'AISERS'],
    ['BSAET', 'AETSO'],
    ['BSAT', 'AERO-ATSO'],
    ['BSAMT', 'AMTSO'],
    ['BSAEE', 'AETSO'],
    ['BAT-AET', 'AETSO'],
    ['AVCOMM', 'ILASSO'],
    ['AVLOG', 'ILASSO'],
    ['AVSSM', 'ILASSO'],
    ['AVTOUR', 'ILASSO']
  ].map(([programCode, orgCode], idx) => {
    const program = academicPrograms.find((p) => normalizeCourse(p.program_code) === programCode);
    return {
      mapping_id: idx + 1,
      program_id: program ? program.program_id : null,
      org_id: orgByCode[orgCode],
      is_active: 1
    };
  }).filter((m) => m.program_id && m.org_id);

  const users = [
    {
      user_id: 1,
      student_number: '2023-10001',
      employee_number: null,
      email: 'aisers.officer1@school.edu',
      password_hash: '12345678',
      first_name: 'Aira',
      last_name: 'Santos',
      account_type: 'student',
      has_unpaid_debt: 0,
      is_active: 1,
      created_at: nowIso(),
      updated_at: nowIso()
    },
    {
      user_id: 2,
      student_number: null,
      employee_number: 'OSA-0001',
      email: 'osa.staff@school.edu',
      password_hash: '12345678',
      first_name: 'Olivia',
      last_name: 'Garcia',
      account_type: 'osa_staff',
      has_unpaid_debt: 0,
      is_active: 1,
      created_at: nowIso(),
      updated_at: nowIso()
    }
  ];

  const studentProfiles = [
    { user_id: 1, program_id: 2, section: 'IS-1A', created_at: nowIso(), updated_at: nowIso() }
  ];

  const officerRoleAisers = orgRoles.find((r) => r.org_id === 1 && r.role_name === 'officer');
  const auditorRoles = orgRoles.filter((r) => r.role_name === 'auditor');

  const organizationMembers = [
    {
      membership_id: 1,
      user_id: 1,
      org_id: 1,
      role_id: officerRoleAisers ? officerRoleAisers.role_id : 1,
      position_title: 'President',
      joined_at: '2025-08-01',
      is_active: 1
    }
  ];

  if (users[1] && auditorRoles.length) {
    auditorRoles.forEach((role, idx) => {
      organizationMembers.push({
        membership_id: organizationMembers.length + 1 + idx,
        user_id: users[1].user_id,
        org_id: role.org_id,
        role_id: role.role_id,
        position_title: null,
        joined_at: '2025-08-01',
        is_active: 1
      });
    });
  }

  return {
    users,
    organizations,
    org_roles: orgRoles,
    organization_members: organizationMembers,
    academic_programs: academicPrograms,
    student_profiles: studentProfiles,
    program_org_mappings: programOrgMappings
  };
}

function getAuthDb() {
  const stored = safeParse(localStorage.getItem(AUTH_DB_KEY), null);
  if (stored && Array.isArray(stored.users) && Array.isArray(stored.organizations)) {
    return stored;
  }
  const seeded = seedAuthDb();
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveAuthDb(db) {
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(db));
}

function findProgramByCode(db, courseCode) {
  const normalized = normalizeCourse(courseCode);
  return db.academic_programs.find((program) => normalizeCourse(program.program_code) === normalized) || null;
}

function findOrCreateProgram(db, courseCode) {
  const existing = findProgramByCode(db, courseCode);
  if (existing) return existing;

  const normalized = normalizeCourse(courseCode);
  const created = {
    program_id: nextId(db.academic_programs, 'program_id'),
    program_code: normalized,
    institute_name: COURSE_INSTITUTE_MAP[normalized] || 'Institute of Computer Studies',
    is_active: 1,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.academic_programs.push(created);
  return created;
}

function findOrCreateOrganization(db, orgName) {
  const normalized = normalizeOrgName(orgName);
  const existing = db.organizations.find((org) => normalizeOrgName(org.org_name) === normalized);
  if (existing) return existing;

  const compactCode = normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || `ORG${Date.now()}`;
  const candidateCodes = new Set(db.organizations.map((org) => String(org.org_code || '').toUpperCase()));
  let finalCode = compactCode;
  let seq = 2;
  while (candidateCodes.has(finalCode.toUpperCase())) {
    finalCode = `${compactCode}-${seq++}`.slice(0, 20);
  }

  const created = {
    org_id: nextId(db.organizations, 'org_id'),
    org_name: normalized,
    org_code: finalCode,
    status: 'active',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.organizations.push(created);

  ['officer', 'auditor', 'member'].forEach((roleName) => {
    db.org_roles.push({
      role_id: nextId(db.org_roles, 'role_id'),
      org_id: created.org_id,
      role_name: roleName,
      can_access_org_dashboard: roleName === 'member' ? 0 : 1,
      is_active: 1,
      created_at: nowIso(),
      updated_at: nowIso()
    });
  });

  return created;
}

function findRole(db, orgId, roleName) {
  return db.org_roles.find((role) => role.org_id === orgId && String(role.role_name).toLowerCase() === String(roleName).toLowerCase() && Number(role.is_active) === 1) || null;
}

function addMembershipIfMissing(db, userId, orgId, roleId) {
  const exists = db.organization_members.find((membership) => membership.user_id === userId && membership.org_id === orgId);
  if (exists) {
    exists.role_id = roleId;
    if (!Object.prototype.hasOwnProperty.call(exists, 'position_title')) {
      exists.position_title = null;
    }
    exists.is_active = 1;
    return exists;
  }

  const created = {
    membership_id: nextId(db.organization_members, 'membership_id'),
    user_id: userId,
    org_id: orgId,
    role_id: roleId,
    position_title: null,
    joined_at: new Date().toISOString().slice(0, 10),
    is_active: 1,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.organization_members.push(created);
  return created;
}

function getMappedOrgForProgram(db, programId) {
  const mapping = db.program_org_mappings.find((m) => m.program_id === programId && Number(m.is_active) === 1);
  if (!mapping) return null;
  return db.organizations.find((org) => org.org_id === mapping.org_id) || null;
}

function getStudentProfileByUserId(db, userId) {
  return db.student_profiles.find((profile) => profile.user_id === userId) || null;
}

function getProgramById(db, programId) {
  return db.academic_programs.find((program) => program.program_id === programId) || null;
}

function getOfficerMemberships(db, userId) {
  return db.organization_members
    .filter((membership) => membership.user_id === userId && Number(membership.is_active) === 1)
    .map((membership) => {
      const role = db.org_roles.find((r) => r.role_id === membership.role_id && Number(r.is_active) === 1);
      const org = db.organizations.find((o) => o.org_id === membership.org_id && String(o.status).toLowerCase() !== 'suspended');
      if (!role || !org || Number(role.can_access_org_dashboard) !== 1) return null;
      return {
        membership_id: membership.membership_id,
        org_id: org.org_id,
        org_name: org.org_name,
        role_name: role.role_name,
        position_title: membership.position_title || role.role_name,
        role_id: role.role_id
      };
    })
    .filter(Boolean);
}

function upsertStudentProfile(db, userId, programId, section) {
  const current = db.student_profiles.find((profile) => profile.user_id === userId);
  if (current) {
    current.program_id = programId;
    current.section = section;
    current.updated_at = nowIso();
    return current;
  }

  const created = {
    user_id: userId,
    program_id: programId,
    section,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.student_profiles.push(created);
  return created;
}

function setSession(sessionData) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
}

function createBaseSession(db, user) {
  return {
    user_id: user.user_id,
    account_type: user.account_type,
    display_name: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    student_number: user.student_number || null,
    employee_number: user.employee_number || null,
    authenticated_at: nowIso(),
    officer_memberships: getOfficerMemberships(db, user.user_id)
  };
}

function setLegacyStudentProfile(db, user, fallbackOrgName) {
  const studentProfile = getStudentProfileByUserId(db, user.user_id);
  const program = studentProfile ? getProgramById(db, studentProfile.program_id) : null;
  const orgName = fallbackOrgName || (program ? (getMappedOrgForProgram(db, program.program_id) || {}).org_name : null) || 'Supreme Student Council';

  localStorage.setItem(LEGACY_STUDENT_PROFILE_KEY, JSON.stringify({
    studentNumber: user.student_number || '',
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    course: program ? program.program_code : '',
    section: studentProfile ? studentProfile.section || '' : '',
    email: user.email,
    organization: orgName
  }));
}

function redirectToStudent(db, user, preferredOrgName) {
  const session = {
    ...createBaseSession(db, user),
    login_role: 'student',
    active_org_name: preferredOrgName || null,
    active_org_id: preferredOrgName
      ? (db.organizations.find((org) => normalizeOrgName(org.org_name) === normalizeOrgName(preferredOrgName)) || {}).org_id || null
      : null
  };
  setSession(session);
  setLegacyStudentProfile(db, user, preferredOrgName || null);
  window.location.href = 'studentDashboard.html';
}

function redirectToOfficer(db, user, selectedOrgId) {
  const session = createBaseSession(db, user);
  const selectedMembership = session.officer_memberships.find((membership) => membership.org_id === Number(selectedOrgId));
  if (!selectedMembership) {
    alert('Please select a valid officer organization.');
    return;
  }

  setSession({
    ...session,
    login_role: 'org',
    active_org_id: selectedMembership.org_id,
    active_org_name: selectedMembership.org_name,
    active_role_name: selectedMembership.role_name
  });

  window.location.href = 'officerDashboard.html';
}

function redirectToOsa(db, user) {
  const session = {
    ...createBaseSession(db, user),
    login_role: 'osa',
    active_org_id: null,
    active_org_name: 'Office of Student Affairs',
    active_role_name: 'osa_staff'
  };
  setSession(session);
  window.location.href = 'osaDashboard.html';
}

function createUser(db, payload) {
  const userId = nextId(db.users, 'user_id');
  const user = {
    user_id: userId,
    student_number: payload.student_number || null,
    employee_number: payload.employee_number || null,
    email: payload.email,
    password_hash: payload.password,
    first_name: payload.first_name,
    last_name: payload.last_name,
    account_type: payload.account_type,
    has_unpaid_debt: 0,
    is_active: 1,
    last_login_at: null,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  db.users.push(user);
  return user;
}

function findUserByIdentifier(db, identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  if (!id) return null;
  return db.users.find((user) =>
    String(user.email || '').toLowerCase() === id ||
    String(user.student_number || '').toLowerCase() === id ||
    String(user.employee_number || '').toLowerCase() === id
  ) || null;
}

function isDuplicateIdentity(db, email, studentNumber, employeeNumber) {
  const emailLower = String(email || '').trim().toLowerCase();
  const studentLower = String(studentNumber || '').trim().toLowerCase();
  const employeeLower = String(employeeNumber || '').trim().toLowerCase();

  return db.users.some((user) => {
    const emailMatch = emailLower && String(user.email || '').toLowerCase() === emailLower;
    const studentMatch = studentLower && String(user.student_number || '').toLowerCase() === studentLower;
    const employeeMatch = employeeLower && String(user.employee_number || '').toLowerCase() === employeeLower;
    return emailMatch || studentMatch || employeeMatch;
  });
}

function parseCourseSection(sectionText) {
  const value = String(sectionText || '').trim();
  if (!value) return { course: '', section: '' };
  const parts = value.split(/\s+/);
  if (parts.length === 1) return { course: normalizeCourse(parts[0]), section: '' };
  return {
    course: normalizeCourse(parts[0]),
    section: parts.slice(1).join(' ')
  };
}

function getPendingRequests() {
  return safeParse(localStorage.getItem(PENDING_REQUESTS_KEY), []);
}

function savePendingRequests(requests) {
  localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(requests));
}

function getApprovedAccounts() {
  return safeParse(localStorage.getItem(ACCOUNTS_APPROVED_KEY), []);
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * submitPendingRegistration – async, calls PHP REST endpoint.
 * Returns { ok: boolean, message: string }
 */
async function submitPendingRegistration(payload) {
  try {
    const res  = await fetch('../api/accounts/requests/submit.php', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({
        studentId:    payload.studentId    || '',
        name:         payload.name         || '',
        email:        payload.email        || '',
        phone:        payload.phone        || '',
        password:     payload.password     || '',
        course:       payload.course       || '',
        yearSection:  payload.yearSection  || '',
        section:      payload.section      || '',
        requestedRole: payload.requestedRole || 'student',
        requestedOrg:  payload.requestedOrg  || '',
        requestedPosition: payload.requestedPosition || ''
      })
    });
    const json = await res.json();
    if (json.ok) return { ok: true };
    return { ok: false, message: json.error || 'Registration failed.' };
  } catch (err) {
    return { ok: false, message: 'Network error: ' + err.message };
  }
}

function trySyncAuthorizedStudentFromAccounts(db, identifier, password) {
  const normalizedIdentifier = String(identifier || '').trim().toLowerCase();
  const approvedStudents = safeParse(localStorage.getItem(ACCOUNTS_APPROVED_KEY), []);
  if (!Array.isArray(approvedStudents) || !normalizedIdentifier) return null;

  const approved = approvedStudents.find((item) => {
    const matchId = String(item.studentId || '').trim().toLowerCase() === normalizedIdentifier;
    const matchEmail = String(item.email || '').trim().toLowerCase() === normalizedIdentifier;
    return (matchId || matchEmail) && String(item.password || '') === String(password || '');
  });

  if (!approved) return null;

  let user = db.users.find((u) =>
    String(u.student_number || '').toLowerCase() === String(approved.studentId || '').toLowerCase() ||
    String(u.email || '').toLowerCase() === String(approved.email || '').toLowerCase()
  );

  const parsedName = splitName(approved.studentName || approved.name || approved.studentId || 'Student User');
  if (!user) {
    user = createUser(db, {
      student_number: approved.studentId || null,
      employee_number: null,
      email: approved.email || `${String(approved.studentId || 'student').toLowerCase()}@student.local`,
      password: approved.password,
      first_name: parsedName.first_name,
      last_name: parsedName.last_name,
      account_type: 'student'
    });
  } else {
    user.first_name = parsedName.first_name || user.first_name;
    user.last_name = parsedName.last_name || user.last_name;
    user.password_hash = approved.password || user.password_hash;
    user.student_number = approved.studentId || user.student_number;
    user.email = approved.email || user.email;
    user.account_type = 'student';
    user.updated_at = nowIso();
  }

  const courseCode = approved.programCode || approved.course || '';
  const parsedSection = parseCourseSection(approved.section || `${courseCode} ${approved.yearSection || ''}`.trim());
  if (parsedSection.course) {
    const program = findOrCreateProgram(db, parsedSection.course);
    upsertStudentProfile(db, user.user_id, program.program_id, parsedSection.section || '');
    const mappedOrg = getMappedOrgForProgram(db, program.program_id);
    if (mappedOrg) {
      const memberRole = findRole(db, mappedOrg.org_id, 'member');
      if (memberRole) addMembershipIfMissing(db, user.user_id, mappedOrg.org_id, memberRole.role_id);
    }
  }

  if (String(approved.requestedRole || '').toLowerCase() === 'org_officer' && approved.requestedOrg) {
    const selectedOrg = findOrCreateOrganization(db, approved.requestedOrg);
    const officerRole = findRole(db, selectedOrg.org_id, 'officer');
    if (officerRole) {
      const membership = addMembershipIfMissing(db, user.user_id, selectedOrg.org_id, officerRole.role_id);
      membership.position_title = approved.requestedPosition || membership.position_title || null;
      membership.updated_at = nowIso();
    }
  }

  return user;
}

/* =====================
   MAIN SLIDER LOGIC (LEFT <-> RIGHT)
   ===================== */
const container = document.getElementById('container');
const signUpBtn = document.getElementById('signUp');
const signInBtn = document.getElementById('signIn');
const overlayLeft = document.querySelector('.overlay-left');
const overlayRight = document.querySelector('.overlay-right');

if (overlayRight && overlayLeft) {
  overlayRight.classList.add('active');
  overlayLeft.classList.remove('active');
}

function toggleSlide() {
  if (!container || !overlayLeft || !overlayRight) return;
  container.classList.toggle('right-panel-active');
  if (container.classList.contains('right-panel-active')) {
    overlayRight.classList.remove('active');
    overlayLeft.classList.add('active');
  } else {
    overlayLeft.classList.remove('active');
    overlayRight.classList.add('active');
  }
}

if (signUpBtn) signUpBtn.addEventListener('click', toggleSlide);
if (signInBtn) signInBtn.addEventListener('click', toggleSlide);

/* =====================
   LEFT PANEL INTERNAL TOGGLE (LOGIN <-> FORGOT)
   ===================== */
const signInContainer = document.getElementById('signInContainer');
function toggleForgot() {
  if (signInContainer) signInContainer.classList.toggle('forgot-mode');
}

/* =====================
   REGISTER TABS LOGIC
   ===================== */
function switchTab(type) {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((btn) => btn.classList.remove('active'));

  const activeFormId = type === 'student' ? 'form-student' : type === 'osa' ? 'form-osa' : 'form-org';

  const clicked = Array.from(tabs).find((btn) => {
    const txt = String(btn.textContent || '').trim().toLowerCase();
    return (type === 'org' && txt.includes('organization')) || txt === type;
  });
  if (clicked) clicked.classList.add('active');

  document.querySelectorAll('.reg-fields').forEach((form) => form.classList.remove('active'));
  const activeForm = document.getElementById(activeFormId);
  if (activeForm) activeForm.classList.add('active');
}

/* =====================
   ORGANIZATION MODAL LOGIC
   ===================== */
const orgModal = document.getElementById('orgModal');
const orgInput = document.getElementById('org-input');
const orgPositionInput = document.getElementById('org-position-input');
const orgStudentNumberInput = document.getElementById('org-student-number-input');
const orgRegistrationDetails = document.getElementById('org-registration-details');
const orgLookupMessage = document.getElementById('org-student-lookup-message');
const orgLockedFieldIds = [
  'org-name-input',
  'org-course-input',
  'org-section-input',
  'org-email-input',
  'org-phone-input'
];
let verifiedOrgStudentNumber = '';
let activeOrgLookupToken = 0;

function openOrgModal() {
  if (orgModal) orgModal.classList.add('open');
}

function closeOrgModal() {
  if (orgModal) orgModal.classList.remove('open');
}

function selectOrg(orgName) {
  if (orgInput) orgInput.value = normalizeOrgName(orgName);
  closeOrgModal();
}

if (orgModal) {
  orgModal.addEventListener('click', (e) => {
    if (e.target === orgModal) closeOrgModal();
  });
}

const positionModal = document.getElementById('positionModal');

function openPositionModal() {
  if (positionModal) positionModal.classList.add('open');
}

function closePositionModal() {
  if (positionModal) positionModal.classList.remove('open');
}

function selectPosition(positionTitle) {
  if (orgPositionInput) orgPositionInput.value = String(positionTitle || '').trim();
  closePositionModal();
}

if (positionModal) {
  positionModal.addEventListener('click', (e) => {
    if (e.target === positionModal) closePositionModal();
  });
}

/* =====================
   COURSE MODAL LOGIC
   ===================== */
const courseModal = document.getElementById('courseModal');
let activeCourseInputId = null;

function openCourseModal(inputId) {
  activeCourseInputId = inputId;
  if (courseModal) courseModal.classList.add('open');
}

function closeCourseModal() {
  if (courseModal) courseModal.classList.remove('open');
  activeCourseInputId = null;
}

function selectCourse(courseName) {
  if (activeCourseInputId) {
    const input = document.getElementById(activeCourseInputId);
    if (input) input.value = courseName;
  }
  closeCourseModal();
}

if (courseModal) {
  courseModal.addEventListener('click', (e) => {
    if (e.target === courseModal) closeCourseModal();
  });
}

function normalizePhoneInput(value) {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  let localDigits = digitsOnly;
  if (localDigits.startsWith('63')) localDigits = localDigits.slice(2);
  if (localDigits.startsWith('0')) localDigits = localDigits.slice(1);
  localDigits = localDigits.slice(0, 10);
  return `+63 ${localDigits}`;
}

function isValidPhoneInput(value) {
  return /^\+63\s\d{10}$/.test(String(value || '').trim());
}

function setupPhoneInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const applyNormalized = () => {
    input.value = normalizePhoneInput(input.value);
  };

  applyNormalized();
  input.addEventListener('input', applyNormalized);
  input.addEventListener('focus', () => {
    if (!input.value || input.value === '+63' || input.value === '+63 ') input.value = '+63 ';
  });
}

function setOrgLookupMessage(message, state = '') {
  if (!orgLookupMessage) return;
  orgLookupMessage.textContent = message;
  orgLookupMessage.classList.remove('success', 'error');
  if (state) orgLookupMessage.classList.add(state);
}

function clearOrgRegistrationFields() {
  const orgNameInput = document.getElementById('org-name-input');
  const orgCourseInput = document.getElementById('org-course-input');
  const orgSectionInput = document.getElementById('org-section-input');
  const orgEmailInput = document.getElementById('org-email-input');
  const orgPhoneInput = document.getElementById('org-phone-input');
  const orgPasswordInput = document.getElementById('org-password-input');
  const orgConfirmPasswordInput = document.getElementById('org-confirm-password-input');

  if (orgNameInput) orgNameInput.value = '';
  if (orgCourseInput) orgCourseInput.value = '';
  if (orgSectionInput) orgSectionInput.value = '';
  if (orgEmailInput) orgEmailInput.value = '';
  if (orgPhoneInput) orgPhoneInput.value = '';
  if (orgInput) orgInput.value = '';
  if (orgPositionInput) orgPositionInput.value = '';
  if (orgPasswordInput) orgPasswordInput.value = '';
  if (orgConfirmPasswordInput) orgConfirmPasswordInput.value = '';
}

function setOrgRegistrationVisibility(isVisible) {
  if (!orgRegistrationDetails) return;
  orgRegistrationDetails.hidden = !isVisible;
}

function resetOrgRegistrationState(message = 'Enter a registered student number to continue organization account registration.', state = '') {
  verifiedOrgStudentNumber = '';
  clearOrgRegistrationFields();
  setOrgRegistrationVisibility(false);
  setOrgLookupMessage(message, state);
}

function applyVerifiedOrgStudent(student) {
  const fullNameInput = document.getElementById('org-name-input');
  const courseInput = document.getElementById('org-course-input');
  const sectionInput = document.getElementById('org-section-input');
  const emailInput = document.getElementById('org-email-input');
  const phoneInput = document.getElementById('org-phone-input');

  if (fullNameInput) fullNameInput.value = student.full_name || '';
  if (courseInput) courseInput.value = student.course || '';
  if (sectionInput) sectionInput.value = student.section || '';
  if (emailInput) emailInput.value = student.email || '';
  if (phoneInput) phoneInput.value = student.phone ? normalizePhoneInput(student.phone) : '';

  orgLockedFieldIds.forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.readOnly = true;
  });

  verifiedOrgStudentNumber = String(student.student_number || '').trim();
  setOrgRegistrationVisibility(true);
  setOrgLookupMessage('Student record found. Only organization and password fields can be changed.', 'success');
}

async function lookupOrganizationStudent(force = false) {
  const studentNumber = orgStudentNumberInput ? String(orgStudentNumberInput.value || '').trim() : '';
  if (!studentNumber) {
    resetOrgRegistrationState();
    return false;
  }

  if (!force && verifiedOrgStudentNumber && verifiedOrgStudentNumber === studentNumber) {
    return true;
  }

  const lookupToken = ++activeOrgLookupToken;
  verifiedOrgStudentNumber = '';
  clearOrgRegistrationFields();
  setOrgRegistrationVisibility(false);
  setOrgLookupMessage('Checking student number...', '');

  try {
    const response = await fetch('../api/auth/lookup-student.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_number: studentNumber })
    });
    const data = await response.json();

    if (lookupToken !== activeOrgLookupToken) return false;

    if (!data.ok || !data.student) {
      resetOrgRegistrationState(data.error || 'Student number is not registered as an active student account.', 'error');
      return false;
    }

    applyVerifiedOrgStudent(data.student);
    return true;
  } catch (error) {
    if (lookupToken !== activeOrgLookupToken) return false;
    resetOrgRegistrationState('Could not verify the student number right now.', 'error');
    return false;
  }
}

function setupOrganizationRegistrationLookup() {
  if (!orgStudentNumberInput) return;

  orgStudentNumberInput.addEventListener('input', () => {
    const currentValue = String(orgStudentNumberInput.value || '').trim();
    if (verifiedOrgStudentNumber && currentValue !== verifiedOrgStudentNumber) {
      resetOrgRegistrationState();
      return;
    }
    if (!currentValue) resetOrgRegistrationState();
  });

  orgStudentNumberInput.addEventListener('blur', () => {
    lookupOrganizationStudent();
  });

  orgStudentNumberInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    lookupOrganizationStudent(true);
  });
}

/* =====================
   DASHBOARD CHOICE MODAL
   ===================== */
const dashboardChoiceModal = document.getElementById('dashboardChoiceModal');
const goStudentDashboardBtn = document.getElementById('goStudentDashboardBtn');
const goOfficerDashboardBtn = document.getElementById('goOfficerDashboardBtn');
const orgDashboardSelect = document.getElementById('orgDashboardSelect');
let pendingOrgLogin = null;

function openDashboardChoiceModal() {
  if (dashboardChoiceModal) dashboardChoiceModal.classList.add('open');
}

function closeDashboardChoiceModal() {
  if (dashboardChoiceModal) dashboardChoiceModal.classList.remove('open');
  pendingOrgLogin = null;
  if (orgDashboardSelect) orgDashboardSelect.innerHTML = '<option value="">Select Organization Dashboard</option>';
}

if (dashboardChoiceModal) {
  dashboardChoiceModal.addEventListener('click', (e) => {
    if (e.target === dashboardChoiceModal) closeDashboardChoiceModal();
  });
}

if (goStudentDashboardBtn) {
  goStudentDashboardBtn.addEventListener('click', () => {
    if (!pendingOrgLogin) return;
    const { user, memberships, baseSession } = pendingOrgLogin;
    const session = {
      ...baseSession,
      login_role: 'student',
      active_org_id: null,
      active_org_name: null   // studentDashboard.js resolves from program_code via courseOrganizationMap
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    closeDashboardChoiceModal();
    window.location.href = 'studentDashboard.html';
  });
}

if (goOfficerDashboardBtn) {
  goOfficerDashboardBtn.addEventListener('click', async () => {
    if (!pendingOrgLogin) return;
    const selectedOrgId = orgDashboardSelect ? Number(orgDashboardSelect.value || 0) : 0;
    if (!selectedOrgId) {
      alert('Select an organization dashboard first.');
      return;
    }
    const { memberships, baseSession } = pendingOrgLogin;
    const selectedMembership = memberships.find((m) => Number(m.org_id) === selectedOrgId);
    if (!selectedMembership) { alert('Invalid organization selection.'); return; }
    const session = {
      ...baseSession,
      login_role: 'org',
      active_org_id: selectedMembership.org_id,
      active_org_name: selectedMembership.org_name,
      active_role_name: selectedMembership.role_name
    };
    try {
      const resp = await fetch('../api/auth/activate-org.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: selectedMembership.org_id })
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || 'Could not activate organization session.');
        return;
      }

      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      closeDashboardChoiceModal();
      window.location.href = 'officerDashboard.html';
    } catch (err) {
      console.error('[activate-org] error:', err);
      alert('Could not activate organization session on server.');
    }
  });
}

/* =====================
   REGISTRATION HANDLERS
   ===================== */
function hasPrivacyConsent(inputId) {
  const checkbox = document.getElementById(inputId);
  if (!checkbox || checkbox.checked) return true;
  alert('Please acknowledge the Data Privacy Act notice before registering.');
  checkbox.focus();
  return false;
}

async function registerStudent() {
  const studentNumber = (document.getElementById('student-number-input') || {}).value?.trim() || '';
  const fullName = (document.getElementById('student-name-input') || {}).value?.trim() || '';
  const course = (document.getElementById('student-course-input') || {}).value?.trim() || '';
  const section = (document.getElementById('student-section-input') || {}).value?.trim() || '';
  const email = (document.getElementById('student-email-input') || {}).value?.trim() || '';
  const phone = normalizePhoneInput((document.getElementById('student-phone-input') || {}).value?.trim() || '');
  const password = (document.getElementById('student-password-input') || {}).value || '';
  const confirmPassword = (document.getElementById('student-confirm-password-input') || {}).value || '';

  if (!studentNumber || !fullName || !course || !section || !email || !phone || !password || !confirmPassword) {
    alert('Please complete all Student registration fields.');
    return;
  }
  if (!isValidPhoneInput(phone)) {
    alert('Phone number must be +63 followed by a space and 10 digits.');
    return;
  }
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }
  if (!hasPrivacyConsent('student-privacy-consent')) return;

  const submitted = await submitPendingRegistration({
    studentId: studentNumber,
    name: fullName,
    email,
    phone,
    password,
    course: normalizeCourse(course),
    yearSection: section,
    section: `${normalizeCourse(course)} ${section}`.trim(),
    requestedRole: 'student',
    requestedOrg: ''
  });

  if (!submitted.ok) {
    alert(submitted.message);
    return;
  }

  alert('Registration submitted. Please wait for account approval in Accounts page.');
  toggleSlide();
}

async function registerOrgOfficer() {
  const studentNumber = (document.getElementById('org-student-number-input') || {}).value?.trim() || '';
  const fullName = (document.getElementById('org-name-input') || {}).value?.trim() || '';
  const course = (document.getElementById('org-course-input') || {}).value?.trim() || '';
  const section = (document.getElementById('org-section-input') || {}).value?.trim() || '';
  const orgName = normalizeOrgName((document.getElementById('org-input') || {}).value?.trim() || '');
  const positionTitle = (document.getElementById('org-position-input') || {}).value?.trim() || '';
  const email = (document.getElementById('org-email-input') || {}).value?.trim() || '';
  const phone = normalizePhoneInput((document.getElementById('org-phone-input') || {}).value?.trim() || '');
  const password = (document.getElementById('org-password-input') || {}).value || '';
  const confirmPassword = (document.getElementById('org-confirm-password-input') || {}).value || '';

  const verified = await lookupOrganizationStudent(true);
  if (!verified || verifiedOrgStudentNumber !== studentNumber) {
    alert('Enter a student number that is already registered as a student account first.');
    return;
  }

  if (!studentNumber || !fullName || !course || !section || !orgName || !positionTitle || !email || !password || !confirmPassword) {
    alert('Please complete all Organization registration fields.');
    return;
  }
  if (phone && !isValidPhoneInput(phone)) {
    alert('Phone number must be +63 followed by a space and 10 digits.');
    return;
  }
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }
  if (!hasPrivacyConsent('org-privacy-consent')) return;

  const submitted = await submitPendingRegistration({
    studentId: studentNumber,
    name: fullName,
    email,
    phone,
    password,
    course: normalizeCourse(course),
    yearSection: section,
    section: `${normalizeCourse(course)} ${section}`.trim(),
    requestedRole: 'org_officer',
    requestedOrg: orgName,
    requestedPosition: positionTitle
  });

  if (!submitted.ok) {
    alert(submitted.message);
    return;
  }

  alert('Officer registration submitted. Approve it first in Accounts page.');
  toggleSlide();
}

async function registerOsa() {
  const employeeNumber = (document.getElementById('osa-employee-number-input') || {}).value?.trim() || '';
  const fullName = (document.getElementById('osa-name-input') || {}).value?.trim() || '';
  const email = (document.getElementById('osa-email-input') || {}).value?.trim() || '';
  const phone = normalizePhoneInput((document.getElementById('osa-phone-input') || {}).value?.trim() || '');
  const password = (document.getElementById('osa-password-input') || {}).value || '';
  const confirmPassword = (document.getElementById('osa-confirm-password-input') || {}).value || '';

  if (!employeeNumber || !fullName || !email || !phone || !password || !confirmPassword) {
    alert('Please complete all OSA registration fields.');
    return;
  }
  if (!isValidPhoneInput(phone)) {
    alert('Phone number must be +63 followed by a space and 10 digits.');
    return;
  }
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }
  if (!hasPrivacyConsent('osa-privacy-consent')) return;

  const parsedName = splitName(fullName);
  const btn = document.getElementById('osaRegisterBtn');
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch('../api/auth/register-osa.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_number: employeeNumber,
        first_name: parsedName.first_name,
        last_name: parsedName.last_name,
        email,
        phone,
        password,
        confirm_password: confirmPassword
      })
    });
    const data = await resp.json();
    if (!data.ok) { alert(data.error || 'Registration failed.'); return; }

    const { user, memberships } = data;
    const session = {
      user_id: user.user_id,
      account_type: 'osa_staff',
      display_name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      student_number: null,
      employee_number: user.employee_number,
      authenticated_at: new Date().toISOString(),
      officer_memberships: memberships || [],
      login_role: 'osa',
      active_org_id: null,
      active_org_name: 'Office of Student Affairs',
      active_role_name: 'osa_staff'
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    window.location.href = 'osaDashboard.html';
  } catch (err) {
    console.error('[registerOsa] error:', err);
    alert('Could not connect to the server. Please try again.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =====================
   LOGIN HANDLER
   ===================== */
async function handleLogin() {
  const identifier = (document.getElementById('loginIdentifier') || {}).value?.trim() || '';
  const password = (document.getElementById('loginPassword') || {}).value || '';

  if (!identifier || !password) {
    alert('Please enter your email / ID and password.');
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.disabled = true;

  try {
    const resp = await fetch('../api/auth/login.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await resp.json();

    if (!data.ok) {
      alert(data.error || 'Login failed. Please check your credentials.');
      return;
    }

    const { user, memberships } = data;

    // Base session shape (same structure the dashboards expect)
    const baseSession = {
      user_id: user.user_id,
      account_type: user.account_type,
      display_name: `${user.first_name} ${user.last_name}`.trim(),
      email: user.email,
      student_number: user.student_number || null,
      employee_number: user.employee_number || null,
      authenticated_at: new Date().toISOString(),
      officer_memberships: memberships || [],
      // Extra fields used by studentDashboard.js buildCurrentStudentProfile
      program_id: user.program_id || null,
      program_code: user.program_code || null,
      section: user.section || null,
      mapped_org_id: user.mapped_org_id || null,
      mapped_org_name: user.mapped_org_name || null
    };

    if (data.legacyProfile) {
      localStorage.setItem(LEGACY_STUDENT_PROFILE_KEY, JSON.stringify(data.legacyProfile));
    }

    // OSA staff — go straight to OSA dashboard
    if (user.account_type === 'osa_staff') {
      const session = {
        ...baseSession,
        login_role: 'osa',
        active_org_id: null,
        active_org_name: 'Office of Student Affairs',
        active_role_name: 'osa_staff'
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      window.location.href = 'osaDashboard.html';
      return;
    }

    // Student with no officer memberships — student dashboard only
    if (!memberships || memberships.length === 0) {
      const session = {
        ...baseSession,
        login_role: 'student',
        active_org_id: null,
        active_org_name: null
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      window.location.href = 'studentDashboard.html';
      return;
    }

    // Has officer memberships — show the dashboard choice modal
    pendingOrgLogin = { user, memberships, baseSession };

    if (orgDashboardSelect) {
      orgDashboardSelect.innerHTML = '<option value="">Select Organization Dashboard</option>';
      memberships.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = m.org_id;
        opt.textContent = `${m.org_name} (${m.role_name})`;
        if (idx === 0) opt.selected = true;
        orgDashboardSelect.appendChild(opt);
      });
    }

    openDashboardChoiceModal();

  } catch (err) {
    console.error('[handleLogin] error:', err);
    alert('Could not connect to the server. Make sure XAMPP is running.');
  } finally {
    if (loginBtn) loginBtn.disabled = false;
  }
}

/* =====================
   INIT BINDINGS
   ===================== */
document.addEventListener('DOMContentLoaded', () => {
  getAuthDb();
  setupPhoneInput('student-phone-input');
  setupPhoneInput('org-phone-input');
  setupPhoneInput('osa-phone-input');
  setupOrganizationRegistrationLookup();
  resetOrgRegistrationState();

  const studentRegisterBtn = document.getElementById('studentRegisterBtn');
  const orgRegisterBtn = document.getElementById('orgRegisterBtn');
  const osaRegisterBtn = document.getElementById('osaRegisterBtn');
  const loginBtn = document.getElementById('loginBtn');

  const studentForm = document.getElementById('form-student');
  const orgForm = document.getElementById('form-org');
  const osaForm = document.getElementById('form-osa');
  const loginForm = document.getElementById('loginForm');

  if (studentRegisterBtn) studentRegisterBtn.addEventListener('click', registerStudent);
  if (orgRegisterBtn) orgRegisterBtn.addEventListener('click', registerOrgOfficer);
  if (osaRegisterBtn) osaRegisterBtn.addEventListener('click', registerOsa);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

  const enterSubmit = (form, action) => {
    if (!form) return;
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        action();
      }
    });
  };

  enterSubmit(studentForm, registerStudent);
  enterSubmit(orgForm, registerOrgOfficer);
  enterSubmit(osaForm, registerOsa);
  enterSubmit(loginForm, handleLogin);
});
