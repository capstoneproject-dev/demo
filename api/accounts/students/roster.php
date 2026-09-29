<?php
declare(strict_types=1);

require_once __DIR__ . '/../student-numbers/roster-status.php';

/** @return array{records: array<int, array<string, mixed>>, errors: array<int, string>} */
function accountRosterValidateRecords(PDO $pdo, array $rows): array
{
    $findAccount = $pdo->prepare("SELECT u.user_id, u.student_number, u.first_name, u.last_name,
        u.program_id, u.institute_id, u.year_section, u.email, u.phone, u.is_active
        FROM users u WHERE u.student_number = ? AND u.account_type = 'student'");
    $findProgram = $pdo->prepare('SELECT program_id, institute_id FROM academic_programs WHERE UPPER(program_code) = UPPER(?) LIMIT 1');
    $findInstitute = $pdo->prepare('SELECT institute_id FROM institutes WHERE UPPER(institute_name) = UPPER(?) LIMIT 1');
    $records = [];
    $errors = [];
    $seen = [];

    foreach (array_values($rows) as $index => $row) {
        $line = $index + 2;
        if (!is_array($row)) { $errors[] = "Row $line: invalid row data."; continue; }
        $studentId = trim((string)($row['studentId'] ?? ''));
        $studentName = trim((string)($row['studentName'] ?? ''));
        $programCode = trim((string)($row['programCode'] ?? ''));
        $instituteName = trim((string)($row['institute'] ?? ''));
        $yearSection = trim((string)($row['yearSection'] ?? ''));
        if ($studentId === '' || $studentName === '') {
            $errors[] = "Row $line: studentId and studentName are required.";
            continue;
        }
        if (strlen($studentId) > 20 || strlen($studentName) > 200 || strlen($yearSection) > 50) {
            $errors[] = "Row $line: a value exceeds the database length limit.";
            continue;
        }
        $key = strtoupper($studentId);
        if (isset($seen[$key])) { $errors[] = "Row $line: duplicate studentId $studentId."; continue; }
        $seen[$key] = true;
        $findAccount->execute([$studentId]);
        $old = $findAccount->fetch();
        if (!$old) {
            $errors[] = "Row $line: $studentId has no registered student account. Students must register themselves.";
            continue;
        }
        $oldFullName = trim((string)$old['first_name'] . ' ' . (string)$old['last_name']);
        if ($studentName === $oldFullName) {
            $firstName = (string)$old['first_name'];
            $lastName = (string)$old['last_name'];
        } else {
            $parts = preg_split('/\s+/', $studentName);
            $lastName = count($parts) > 1 ? array_pop($parts) : $studentName;
            $firstName = count($parts) > 0 ? implode(' ', $parts) : $studentName;
        }
        if (strlen($firstName) > 100 || strlen($lastName) > 100) {
            $errors[] = "Row $line: studentName exceeds the account name limit.";
            continue;
        }

        $programId = null;
        $programInstituteId = null;
        if ($programCode !== '') {
            $findProgram->execute([$programCode]);
            $program = $findProgram->fetch();
            if (!$program) { $errors[] = "Row $line: unknown programCode '$programCode'."; continue; }
            $programId = (int)$program['program_id'];
            $programInstituteId = (int)$program['institute_id'];
        }
        $instituteId = null;
        if ($instituteName !== '') {
            $findInstitute->execute([$instituteName]);
            $id = $findInstitute->fetchColumn();
            if (!$id) { $errors[] = "Row $line: unknown institute '$instituteName'."; continue; }
            $instituteId = (int)$id;
        }
        if ($programInstituteId !== null && $instituteId !== null && $programInstituteId !== $instituteId) {
            $errors[] = "Row $line: programCode does not belong to the selected institute.";
            continue;
        }
        if ($instituteId === null) $instituteId = $programInstituteId;

        $email = trim((string)($row['email'] ?? ''));
        if ($email === '') $email = (string)$old['email'];
        if (strlen($email) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = "Row $line: email is invalid.";
            continue;
        }
        $phone = array_key_exists('phone', $row) ? trim((string)$row['phone']) : (string)($old['phone'] ?? '');
        if (strlen($phone) > 30) { $errors[] = "Row $line: phone is too long."; continue; }
        try {
            $active = array_key_exists('isActive', $row)
                ? rosterParseActiveStatus($row['isActive'])
                : (bool)$old['is_active'];
        } catch (InvalidArgumentException $e) {
            $errors[] = "Row $line: " . $e->getMessage();
            continue;
        }
        $records[] = [
            'user_id' => (int)$old['user_id'],
            'student_number' => $studentId,
            'student_name' => $studentName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'program_id' => $programId,
            'program_code' => $programCode,
            'institute_id' => $instituteId,
            'year_section' => $yearSection,
            'email' => $email,
            'phone' => $phone,
            'is_active' => $active,
        ];
    }
    return ['records' => $records, 'errors' => $errors];
}

/** @return array{summary: array<string, int|bool>, changes: array<string, array<int, array<string, mixed>>}} */
function accountRosterBuildPreview(PDO $pdo, array $records): array
{
    $oldRows = $pdo->query("SELECT u.user_id, u.student_number, u.first_name, u.last_name,
        u.program_id, u.institute_id, u.year_section, u.email, u.phone, u.is_active,
        COALESCE(ap.program_code, '') AS program_code
        FROM users u LEFT JOIN academic_programs ap ON ap.program_id = u.program_id
        WHERE u.account_type = 'student'")->fetchAll();
    $existing = [];
    foreach ($oldRows as $old) $existing[(int)$old['user_id']] = $old;
    $changes = ['new' => [], 'updated' => [], 'reactivated' => [], 'unchanged' => [], 'deactivated' => [], 'officersAffected' => []];
    $uploaded = [];
    foreach ($records as $record) {
        $id = $record['user_id'];
        $uploaded[$id] = true;
        $old = $existing[$id];
        $changedFields = [];
        if (trim((string)$old['first_name'] . ' ' . (string)$old['last_name']) !== $record['student_name']) $changedFields[] = 'name';
        if ((int)$old['program_id'] !== (int)$record['program_id']) $changedFields[] = 'program';
        if ((int)$old['institute_id'] !== (int)$record['institute_id']) $changedFields[] = 'institute';
        if ((string)$old['year_section'] !== $record['year_section']) $changedFields[] = 'year/section';
        if ((string)$old['email'] !== $record['email']) $changedFields[] = 'email';
        if ((string)$old['phone'] !== $record['phone']) $changedFields[] = 'phone';
        if ((bool)$old['is_active'] !== $record['is_active']) $changedFields[] = 'status';
        $base = [
            'studentId' => $record['student_number'], 'studentName' => $record['student_name'],
            'programCode' => $record['program_code'], 'yearSection' => $record['year_section'],
            'previousYearSection' => $old['year_section'] ?? '', 'changedFields' => $changedFields,
        ];
        if (!(bool)$old['is_active'] && $record['is_active']) $changes['reactivated'][] = $base;
        elseif ($changedFields) $changes['updated'][] = $base;
        else $changes['unchanged'][] = $base;
    }
    $officerCheck = $pdo->prepare('SELECT COUNT(*) FROM organization_members WHERE user_id = ? AND is_active = 1');
    foreach ($existing as $id => $old) {
        if (isset($uploaded[$id]) || !(bool)$old['is_active']) continue;
        $officerCheck->execute([$id]);
        $isOfficer = (int)$officerCheck->fetchColumn() > 0;
        $item = [
            'studentId' => $old['student_number'],
            'studentName' => trim($old['first_name'] . ' ' . $old['last_name']),
            'programCode' => $old['program_code'], 'yearSection' => $old['year_section'] ?? '',
            'isOfficer' => $isOfficer, 'officerRoles' => '',
        ];
        $changes['deactivated'][] = $item;
        if ($isOfficer) $changes['officersAffected'][] = $item;
    }
    $activeCount = count(array_filter($existing, static fn(array $row): bool => (bool)$row['is_active']));
    $deactivatedCount = count($changes['deactivated']);
    $percent = $activeCount ? (int)round($deactivatedCount / $activeCount * 100) : 0;
    return [
        'summary' => [
            'new' => 0, 'updated' => count($changes['updated']),
            'reactivated' => count($changes['reactivated']), 'unchanged' => count($changes['unchanged']),
            'deactivated' => $deactivatedCount, 'officersAffected' => count($changes['officersAffected']),
            'rejected' => 0, 'deactivationPercent' => $percent,
            'largeDeactivationWarning' => $activeCount > 0 && $percent >= 25,
        ],
        'changes' => $changes,
    ];
}

function accountRosterApply(PDO $pdo, array $records, array $preview): void
{
    $update = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, program_id=?, institute_id=?,
        year_section=?, email=?, phone=?, is_active=? WHERE user_id=? AND account_type='student'");
    foreach ($records as $row) {
        $update->execute([
            $row['first_name'], $row['last_name'], $row['program_id'], $row['institute_id'],
            $row['year_section'] ?: null, $row['email'], $row['phone'] ?: null,
            $row['is_active'] ? 1 : 0, $row['user_id'],
        ]);
    }
    $deactivate = $pdo->prepare("UPDATE users SET is_active=0 WHERE student_number=? AND account_type='student'");
    foreach ($preview['changes']['deactivated'] as $row) $deactivate->execute([$row['studentId']]);
}
