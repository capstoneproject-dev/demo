<?php
/**
 * Shared DB query helpers.
 * Requires config/db.php (via auth.php or directly).
 */

require_once __DIR__ . '/../config/db.php';

// ---------------------------------------------------------------------------
// User look-up
// ---------------------------------------------------------------------------

/**
 * Find a user by email, student number, or employee number.
 * Joins student profile + program so the caller gets course/section in one query.
 */
function findUserByIdentifier(string $identifier): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT u.*,
                sp.section,
                ap.program_code,
                ap.program_id
         FROM   users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
         LEFT JOIN academic_programs ap ON ap.program_id = sp.program_id
         WHERE  (u.email = :id_email OR u.student_number = :id_sn OR u.employee_number = :id_en)
           AND  u.is_active = 1
         LIMIT 1"
    );
    $id = trim($identifier);
    $stmt->execute([':id_email' => $id, ':id_sn' => $id, ':id_en' => $id]);
    return $stmt->fetch() ?: null;
}

function getUserById(int $userId): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT u.*,
                sp.section,
                ap.program_code,
                ap.program_id
         FROM   users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
         LEFT JOIN academic_programs ap ON ap.program_id = sp.program_id
         WHERE  u.user_id = :id AND u.is_active = 1
         LIMIT 1"
    );
    $stmt->execute([':id' => $userId]);
    return $stmt->fetch() ?: null;
}

// ---------------------------------------------------------------------------
// Officer memberships
// ---------------------------------------------------------------------------

/**
 * Returns all org memberships for a user that allow dashboard access.
 */
function getOfficerMemberships(int $userId): array
{
    $stmt = getPdo()->prepare(
        "SELECT om.membership_id,
                om.org_id,
                o.org_name,
                r.role_name,
                r.role_id
         FROM   organization_members om
         JOIN   organizations o  ON o.org_id   = om.org_id
         JOIN   org_roles     r  ON r.role_id   = om.role_id
         WHERE  om.user_id              = :uid
           AND  om.is_active            = 1
           AND  r.can_access_org_dashboard = 1
           AND  r.is_active             = 1
           AND  o.status               != 'suspended'"
    );
    $stmt->execute([':uid' => $userId]);
    return $stmt->fetchAll();
}

// ---------------------------------------------------------------------------
// Session payload builder
// ---------------------------------------------------------------------------

/**
 * Build the session payload that mirrors the shape the existing JS expects
 * under the 'naapAuthSession' localStorage key.
 *
 * @param array      $user        Row from findUserByIdentifier / getUserById.
 * @param array      $memberships Rows from getOfficerMemberships.
 * @param string     $loginRole   'student' | 'org' | 'osa'
 * @param int|null   $activeOrgId The org the user chose to act as officer for.
 */
function buildSessionPayload(
    array $user,
    array $memberships,
    string $loginRole,
    ?int $activeOrgId = null
): array {
    // Find the active-org membership row
    $activeOrg = null;
    if ($activeOrgId) {
        foreach ($memberships as $m) {
            if ((int)$m['org_id'] === $activeOrgId) {
                $activeOrg = $m;
                break;
            }
        }
    }

    return [
        'user_id'             => (int)$user['user_id'],
        'account_type'        => $user['account_type'],
        'display_name'        => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
        'email'               => $user['email'],
        'student_number'      => $user['student_number'] ?? null,
        'employee_number'     => $user['employee_number'] ?? null,
        'authenticated_at'    => date('c'),
        'login_role'          => $loginRole,
        'active_org_id'       => $activeOrg ? (int)$activeOrg['org_id'] : null,
        'active_org_name'     => $activeOrg
                                    ? $activeOrg['org_name']
                                    : ($loginRole === 'osa' ? 'Office of Student Affairs' : null),
        'active_role_name'    => $activeOrg
                                    ? $activeOrg['role_name']
                                    : ($loginRole === 'osa' ? 'osa_staff' : null),
        'officer_memberships' => array_values($memberships),
        // Extra fields used by buildCurrentStudentProfile() in studentDashboard.js
        'program_code'        => $user['program_code'] ?? null,
        'section'             => $user['section'] ?? null,
    ];
}

/**
 * Build the legacy naapStudentProfile shape that studentDashboard.js reads.
 */
function buildLegacyProfile(array $user, ?string $orgName): array
{
    return [
        'studentNumber' => $user['student_number'] ?? '',
        'fullName'      => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
        'course'        => $user['program_code'] ?? '',
        'section'       => $user['section'] ?? '',
        'email'         => $user['email'] ?? '',
        'organization'  => $orgName ?? '',
    ];
}

// ---------------------------------------------------------------------------
// User creation helpers
// ---------------------------------------------------------------------------

function emailExists(string $email): bool
{
    $stmt = getPdo()->prepare("SELECT 1 FROM users WHERE email = :e LIMIT 1");
    $stmt->execute([':e' => $email]);
    return (bool)$stmt->fetch();
}

function studentNumberExists(string $sn): bool
{
    $stmt = getPdo()->prepare("SELECT 1 FROM users WHERE student_number = :s LIMIT 1");
    $stmt->execute([':s' => $sn]);
    return (bool)$stmt->fetch();
}

function employeeNumberExists(string $en): bool
{
    $stmt = getPdo()->prepare("SELECT 1 FROM users WHERE employee_number = :e LIMIT 1");
    $stmt->execute([':e' => $en]);
    return (bool)$stmt->fetch();
}

/**
 * Create an OSA staff account directly (no approval needed).
 * Returns the new user_id.
 */
function createOsaUser(array $data): int
{
    $stmt = getPdo()->prepare(
        "INSERT INTO users
            (employee_number, email, password_hash, first_name, last_name, account_type)
         VALUES
            (:en, :email, :hash, :fn, :ln, 'osa_staff')"
    );
    $stmt->execute([
        ':en'    => $data['employee_number'],
        ':email' => $data['email'],
        ':hash'  => password_hash($data['password'], PASSWORD_BCRYPT),
        ':fn'    => $data['first_name'],
        ':ln'    => $data['last_name'],
    ]);
    return (int)getPdo()->lastInsertId();
}

// ---------------------------------------------------------------------------
// Reference data look-ups
// ---------------------------------------------------------------------------

function getProgramByCode(string $code): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT * FROM academic_programs WHERE UPPER(program_code) = UPPER(:c) AND is_active = 1 LIMIT 1"
    );
    $stmt->execute([':c' => $code]);
    return $stmt->fetch() ?: null;
}

function getOrgByName(string $name): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT * FROM organizations WHERE UPPER(REPLACE(org_name,\"'\",'')) = UPPER(REPLACE(:n,\"'\",'')) LIMIT 1"
    );
    $stmt->execute([':n' => $name]);
    return $stmt->fetch() ?: null;
}

function getMemberRoleByOrg(int $orgId): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT * FROM org_roles WHERE org_id = :o AND role_name = 'member' AND is_active = 1 LIMIT 1"
    );
    $stmt->execute([':o' => $orgId]);
    return $stmt->fetch() ?: null;
}

function getOfficerRoleByOrg(int $orgId): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT * FROM org_roles WHERE org_id = :o AND role_name = 'officer' AND is_active = 1 LIMIT 1"
    );
    $stmt->execute([':o' => $orgId]);
    return $stmt->fetch() ?: null;
}

/**
 * Return the org mapped to a program (via program_org_mappings).
 */
function getMappedOrgByProgram(int $programId): ?array
{
    $stmt = getPdo()->prepare(
        "SELECT o.*
         FROM   program_org_mappings pom
         JOIN   organizations o ON o.org_id = pom.org_id
         WHERE  pom.program_id = :pid AND pom.is_active = 1
         LIMIT 1"
    );
    $stmt->execute([':pid' => $programId]);
    return $stmt->fetch() ?: null;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function touchLastLogin(int $userId): void
{
    getPdo()->prepare("UPDATE users SET last_login_at = NOW() WHERE user_id = :id")
            ->execute([':id' => $userId]);
}
