<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/system_settings.php';

header('Content-Type: application/json');
apiGuard();
requirePost();

$session = getPhpSession();
if (($session['account_type'] ?? '') !== 'osa_staff' && ($session['login_role'] ?? '') !== 'osa') {
    jsonError('Only OSA staff can import the annual enrollment roster.', 403);
}

function rosterEnsureAcademicYearColumn(PDO $pdo): void
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'student_numbers'
           AND COLUMN_NAME = 'academic_year'"
    );
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE student_numbers ADD COLUMN academic_year VARCHAR(9) NULL AFTER year_section");
        $pdo->exec("ALTER TABLE student_numbers ADD INDEX idx_student_numbers_academic_year (academic_year)");
    }
}

/** @return array{records: array<int, array<string, mixed>>, errors: array<int, string>} */
function rosterValidateRecords(PDO $pdo, array $records, string $academicYear): array
{
    $programStmt = $pdo->prepare(
        "SELECT ap.program_id, ap.program_code, ap.institute_id, i.institute_name
         FROM academic_programs ap
         JOIN institutes i ON i.institute_id = ap.institute_id
         WHERE UPPER(ap.program_code) = UPPER(:program_code)
         LIMIT 1"
    );
    $instituteStmt = $pdo->prepare(
        "SELECT institute_id, institute_name
         FROM institutes
         WHERE UPPER(institute_name) = UPPER(:institute_name)
         LIMIT 1"
    );

    $normalized = [];
    $errors = [];
    $seen = [];

    foreach (array_values($records) as $index => $row) {
        $rowNumber = $index + 2;
        if (!is_array($row)) {
            $errors[] = "Row {$rowNumber}: invalid row data.";
            continue;
        }

        $studentNumber = trim((string)($row['studentId'] ?? ''));
        $studentName = trim((string)($row['studentName'] ?? ''));
        $programCode = trim((string)($row['programCode'] ?? ''));
        $instituteName = trim((string)($row['institute'] ?? ''));
        $yearSection = trim((string)($row['yearSection'] ?? ''));
        $key = strtoupper($studentNumber);

        $missing = [];
        if ($studentNumber === '') $missing[] = 'studentId';
        if ($studentName === '') $missing[] = 'studentName';
        if ($instituteName === '') $missing[] = 'institute';
        if ($programCode === '') $missing[] = 'programCode';
        if ($yearSection === '') $missing[] = 'yearSection';
        if ($missing) {
            $errors[] = "Row {$rowNumber}: missing " . implode(', ', $missing) . '.';
            continue;
        }
        if (strlen($studentNumber) > 20 || strlen($studentName) > 200 || strlen($yearSection) > 50) {
            $errors[] = "Row {$rowNumber}: one or more values exceed the database length limit.";
            continue;
        }
        if (isset($seen[$key])) {
            $errors[] = "Rows {$seen[$key]} and {$rowNumber}: duplicate student number {$studentNumber}.";
            continue;
        }
        $seen[$key] = $rowNumber;

        $programStmt->execute([':program_code' => $programCode]);
        $program = $programStmt->fetch();
        if (!$program) {
            $errors[] = "Row {$rowNumber}: unknown programCode '{$programCode}'.";
            continue;
        }

        $instituteStmt->execute([':institute_name' => $instituteName]);
        $institute = $instituteStmt->fetch();
        if (!$institute) {
            $errors[] = "Row {$rowNumber}: unknown institute '{$instituteName}'.";
            continue;
        }
        if ((int)$program['institute_id'] !== (int)$institute['institute_id']) {
            $errors[] = "Row {$rowNumber}: {$program['program_code']} does not belong to {$institute['institute_name']}.";
            continue;
        }

        $normalized[] = [
            'student_number' => $studentNumber,
            'student_name' => $studentName,
            'program_id' => (int)$program['program_id'],
            'program_code' => (string)$program['program_code'],
            'institute_id' => (int)$institute['institute_id'],
            'institute_name' => (string)$institute['institute_name'],
            'year_section' => $yearSection,
            'academic_year' => $academicYear,
        ];
    }

    return ['records' => $normalized, 'errors' => $errors];
}

/** @return array{summary: array<string, int|bool>, changes: array<string, array<int, array<string, mixed>>>, existing: array<string, array<string, mixed>>} */
function rosterBuildPreview(PDO $pdo, array $records, string $academicYear): array
{
    $rows = $pdo->query(
        "SELECT sn.student_number, sn.student_name, sn.program_id, sn.institute_id,
                sn.year_section, sn.academic_year, sn.is_active,
                ap.program_code, i.institute_name,
                CASE WHEN u.user_id IS NULL THEN 0 ELSE 1 END AS has_account,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM organization_members active_om
                    WHERE active_om.user_id = u.user_id
                      AND active_om.is_active = 1
                ) THEN 1 ELSE 0 END AS is_officer,
                (
                    SELECT GROUP_CONCAT(
                        DISTINCT CONCAT(officer_org.org_name, ' (', officer_role.role_name, ')')
                        ORDER BY officer_org.org_name SEPARATOR ', '
                    )
                    FROM organization_members officer_om
                    JOIN organizations officer_org ON officer_org.org_id = officer_om.org_id
                    JOIN org_roles officer_role ON officer_role.role_id = officer_om.role_id
                    WHERE officer_om.user_id = u.user_id
                      AND officer_om.is_active = 1
                ) AS officer_roles
         FROM student_numbers sn
         LEFT JOIN academic_programs ap ON ap.program_id = sn.program_id
         LEFT JOIN institutes i ON i.institute_id = sn.institute_id
         LEFT JOIN users u ON u.student_number = sn.student_number AND u.account_type = 'student'"
    )->fetchAll();

    $existing = [];
    foreach ($rows as $row) {
        $existing[strtoupper((string)$row['student_number'])] = $row;
    }

    $changes = [
        'new' => [],
        'updated' => [],
        'reactivated' => [],
        'unchanged' => [],
        'deactivated' => [],
        'officersAffected' => [],
    ];
    $uploaded = [];

    foreach ($records as $record) {
        $key = strtoupper((string)$record['student_number']);
        $uploaded[$key] = true;
        $old = $existing[$key] ?? null;
        $base = [
            'studentId' => $record['student_number'],
            'studentName' => $record['student_name'],
            'programCode' => $record['program_code'],
            'yearSection' => $record['year_section'],
        ];
        if (!$old) {
            $changes['new'][] = $base;
            continue;
        }

        $changedFields = [];
        if ((string)$old['student_name'] !== (string)$record['student_name']) $changedFields[] = 'name';
        if ((int)$old['program_id'] !== (int)$record['program_id']) $changedFields[] = 'program';
        if ((int)$old['institute_id'] !== (int)$record['institute_id']) $changedFields[] = 'institute';
        if ((string)$old['year_section'] !== (string)$record['year_section']) $changedFields[] = 'year/section';
        if ((string)$old['academic_year'] !== $academicYear) $changedFields[] = 'academic year';
        $base['previousProgramCode'] = $old['program_code'] ?? '';
        $base['previousYearSection'] = $old['year_section'] ?? '';
        $base['changedFields'] = $changedFields;

        if (!(bool)$old['is_active']) {
            $changes['reactivated'][] = $base;
        } elseif ($changedFields) {
            $changes['updated'][] = $base;
        } else {
            $changes['unchanged'][] = $base;
        }
    }

    foreach ($existing as $key => $old) {
        if (!isset($uploaded[$key]) && (bool)$old['is_active']) {
            $deactivatedStudent = [
                'studentId' => $old['student_number'],
                'studentName' => $old['student_name'],
                'programCode' => $old['program_code'] ?? '',
                'yearSection' => $old['year_section'] ?? '',
                'hasAccount' => (bool)$old['has_account'],
                'isOfficer' => (bool)$old['is_officer'],
                'officerRoles' => $old['officer_roles'] ?? '',
            ];
            $changes['deactivated'][] = $deactivatedStudent;
            if ($deactivatedStudent['isOfficer']) {
                $changes['officersAffected'][] = $deactivatedStudent;
            }
        }
    }

    $activeCount = count(array_filter($existing, static fn(array $row): bool => (bool)$row['is_active']));
    $deactivateCount = count($changes['deactivated']);
    $deactivationPercent = $activeCount > 0 ? (int)round(($deactivateCount / $activeCount) * 100) : 0;

    return [
        'summary' => [
            'new' => count($changes['new']),
            'updated' => count($changes['updated']),
            'reactivated' => count($changes['reactivated']),
            'unchanged' => count($changes['unchanged']),
            'deactivated' => $deactivateCount,
            'officersAffected' => count($changes['officersAffected']),
            'rejected' => 0,
            'deactivationPercent' => $deactivationPercent,
            'largeDeactivationWarning' => $activeCount > 0 && $deactivationPercent >= 25,
        ],
        'changes' => $changes,
        'existing' => $existing,
    ];
}

try {
    $pdo = getPdo();
    rosterEnsureAcademicYearColumn($pdo);

    $body = getRequestBody();
    $action = strtolower(trim((string)($body['action'] ?? 'preview')));
    $records = $body['records'] ?? [];
    if (!is_array($records) || count($records) === 0) {
        jsonError('The roster must contain at least one student.', 422);
    }
    if (!in_array($action, ['preview', 'apply'], true)) {
        jsonError('action must be preview or apply.', 422);
    }

    $term = settingsGetActiveAcademicTerm($pdo);
    $academicYear = $term['academic_year'];
    $validation = rosterValidateRecords($pdo, $records, $academicYear);
    if ($validation['errors']) {
        jsonError("Roster validation failed:\n" . implode("\n", array_slice($validation['errors'], 0, 20)), 422);
    }

    $preview = rosterBuildPreview($pdo, $validation['records'], $academicYear);
    if ($action === 'preview') {
        jsonOk([
            'academicYear' => $academicYear,
            'summary' => $preview['summary'],
            'changes' => $preview['changes'],
        ]);
    }

    if (($body['confirmedAcademicYear'] ?? '') !== $academicYear) {
        jsonError('The active academic year changed after preview. Please preview the roster again.', 409);
    }

    $pdo->beginTransaction();
    try {
        $upsert = $pdo->prepare(
            "INSERT INTO student_numbers
                (student_number, student_name, program_id, institute_id, year_section,
                 academic_year, is_active, added_by_user_id)
             VALUES
                (:student_number, :student_name, :program_id, :institute_id, :year_section,
                 :academic_year, 1, :actor_id)
             ON DUPLICATE KEY UPDATE
                student_name = VALUES(student_name),
                program_id = VALUES(program_id),
                institute_id = VALUES(institute_id),
                year_section = VALUES(year_section),
                academic_year = VALUES(academic_year),
                is_active = 1"
        );
        $syncUser = $pdo->prepare(
            "UPDATE users
             SET program_id = :program_id,
                 institute_id = :institute_id,
                 is_active = 1
             WHERE student_number = :student_number
               AND account_type = 'student'"
        );

        foreach ($validation['records'] as $record) {
            $upsert->execute([
                ':student_number' => $record['student_number'],
                ':student_name' => $record['student_name'],
                ':program_id' => $record['program_id'],
                ':institute_id' => $record['institute_id'],
                ':year_section' => $record['year_section'],
                ':academic_year' => $academicYear,
                ':actor_id' => $session['user_id'] ?? null,
            ]);
            $syncUser->execute([
                ':program_id' => $record['program_id'],
                ':institute_id' => $record['institute_id'],
                ':student_number' => $record['student_number'],
            ]);
        }

        $toDeactivate = $preview['changes']['deactivated'];
        if ($toDeactivate) {
            $deactivateRoster = $pdo->prepare(
                "UPDATE student_numbers SET is_active = 0 WHERE student_number = :student_number"
            );
            $deactivateUser = $pdo->prepare(
                "UPDATE users
                 SET is_active = 0
                 WHERE student_number = :student_number
                   AND account_type = 'student'"
            );
            foreach ($toDeactivate as $student) {
                $params = [':student_number' => $student['studentId']];
                $deactivateRoster->execute($params);
                $deactivateUser->execute($params);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    jsonOk([
        'academicYear' => $academicYear,
        'summary' => $preview['summary'],
        'msg' => "Annual enrollment roster for {$academicYear} applied successfully.",
    ]);
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 422);
} catch (PDOException $e) {
    error_log('[annual-roster-import] ' . $e->getMessage());
    jsonError('The annual roster could not be applied. No enrollment changes were saved.', 500);
} catch (Throwable $e) {
    error_log('[annual-roster-import] ' . $e->getMessage());
    jsonError($e->getMessage(), 400);
}
