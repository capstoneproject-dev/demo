<?php
/**
 * QR Attendance domain services.
 * Org-scoped helpers for api/qr-attendance endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class QrAttendanceValidationException extends RuntimeException {}
class QrAttendanceAuthorizationException extends RuntimeException {}

function qrAttendanceColumnExists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name"
    );
    $stmt->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);
    return ((int)$stmt->fetchColumn() > 0);
}

function qrRequireOfficerOrgContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new QrAttendanceAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? null) !== 'org') {
        throw new QrAttendanceAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new QrAttendanceAuthorizationException('No active organization selected.');
    }

    return [
        'session' => $session,
        'org_id' => $orgId,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function qrSplitFullName(string $fullName): array
{
    $name = trim($fullName);
    if ($name === '') {
        return ['Student', 'User'];
    }
    $parts = preg_split('/\s+/', $name);
    if (!$parts || count($parts) === 1) {
        return [$parts[0] ?? 'Student', '-'];
    }
    $first = array_shift($parts);
    $last = implode(' ', $parts);
    return [$first, $last];
}

function qrGetOrCreateEventTypeId(PDO $pdo, int $orgId, string $eventTypeName = 'QR Attendance'): int
{
    $name = trim($eventTypeName);
    if ($name === '') $name = 'QR Attendance';

    $find = $pdo->prepare(
        "SELECT event_type_id
         FROM event_types
         WHERE org_id = :org AND event_type_name = :name
         LIMIT 1"
    );
    $find->execute([':org' => $orgId, ':name' => $name]);
    $row = $find->fetch();
    if ($row) {
        return (int)$row['event_type_id'];
    }

    $ins = $pdo->prepare(
        "INSERT INTO event_types (org_id, event_type_name, is_active)
         VALUES (:org, :name, 1)"
    );
    $ins->execute([':org' => $orgId, ':name' => $name]);
    return (int)$pdo->lastInsertId();
}

function qrListEvents(PDO $pdo, int $orgId, array $filters = []): array
{
    $where = ["e.org_id = :org"];
    $params = [':org' => $orgId];

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = "(e.event_name LIKE :q_name OR e.description LIKE :q_desc OR e.location LIKE :q_loc)";
        $qLike = '%' . $q . '%';
        $params[':q_name'] = $qLike;
        $params[':q_desc'] = $qLike;
        $params[':q_loc'] = $qLike;
    }

    $sql = "
        SELECT e.event_id,
               e.org_id,
               e.created_by_user_id,
               e.event_name,
               e.description,
               e.location,
               e.event_date,
               e.event_type_id,
               e.is_published,
               e.created_at,
               e.updated_at,
               et.event_type_name,
               COUNT(ar.record_id) AS attendance_count,
               MIN(DATE(ar.time_in)) AS first_record_date,
               MAX(DATE(ar.time_in)) AS last_record_date
        FROM events e
        LEFT JOIN event_types et ON et.event_type_id = e.event_type_id
        LEFT JOIN attendance_records ar ON ar.event_id = e.event_id
        WHERE " . implode(' AND ', $where) . "
        GROUP BY e.event_id
        ORDER BY COALESCE(MAX(ar.time_in), e.event_date) DESC, e.event_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['event_id'] = (int)$row['event_id'];
        $row['org_id'] = (int)$row['org_id'];
        $row['created_by_user_id'] = (int)$row['created_by_user_id'];
        $row['event_type_id'] = (int)$row['event_type_id'];
        $row['is_published'] = (int)$row['is_published'];
        $row['attendance_count'] = (int)$row['attendance_count'];
    }
    return $rows;
}

function qrSaveEvent(PDO $pdo, int $orgId, int $userId, array $data): int
{
    $eventId = isset($data['event_id']) ? (int)$data['event_id'] : 0;
    $eventName = trim((string)($data['event_name'] ?? $data['name'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $location = trim((string)($data['location'] ?? ''));
    $eventDate = trim((string)($data['event_date'] ?? ''));
    $eventTypeId = isset($data['event_type_id']) ? (int)$data['event_type_id'] : 0;
    $eventTypeName = trim((string)($data['event_type_name'] ?? 'QR Attendance'));
    $isPublished = !empty($data['is_published']) ? 1 : 0;

    if ($eventName === '') {
        throw new QrAttendanceValidationException('event_name is required.');
    }
    if ($userId <= 0) {
        throw new QrAttendanceValidationException('Invalid processor user.');
    }

    $tz = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $tz);
    if ($eventDate === '') $eventDate = $now->format('Y-m-d');
    if ($location === '') $location = 'TBA';

    if ($eventTypeId <= 0) {
        $eventTypeId = qrGetOrCreateEventTypeId($pdo, $orgId, $eventTypeName);
    }

    if ($eventId > 0) {
        $chk = $pdo->prepare("SELECT event_id FROM events WHERE event_id = :id AND org_id = :org LIMIT 1");
        $chk->execute([':id' => $eventId, ':org' => $orgId]);
        if (!$chk->fetch()) {
            throw new QrAttendanceValidationException('Event not found for this organization.');
        }

        $upd = $pdo->prepare(
            "UPDATE events
             SET event_name = :name,
                 description = :description,
                 location = :location,
                 event_date = :event_date,
                 event_type_id = :event_type_id,
                 is_published = :is_published
             WHERE event_id = :id AND org_id = :org"
        );
        $upd->execute([
            ':name' => $eventName,
            ':description' => $description !== '' ? $description : null,
            ':location' => $location,
            ':event_date' => $eventDate,
            ':event_type_id' => $eventTypeId,
            ':is_published' => $isPublished,
            ':id' => $eventId,
            ':org' => $orgId,
        ]);
        return $eventId;
    }

    $ins = $pdo->prepare(
        "INSERT INTO events
            (org_id, created_by_user_id, event_name, description, location, event_date, event_type_id, is_published)
         VALUES
            (:org, :uid, :name, :description, :location, :event_date, :event_type_id, :is_published)"
    );
    $ins->execute([
        ':org' => $orgId,
        ':uid' => $userId,
        ':name' => $eventName,
        ':description' => $description !== '' ? $description : null,
        ':location' => $location,
        ':event_date' => $eventDate,
        ':event_type_id' => $eventTypeId,
        ':is_published' => $isPublished,
    ]);
    return (int)$pdo->lastInsertId();
}

function qrDeleteEvent(PDO $pdo, int $orgId, int $eventId): void
{
    if ($eventId <= 0) {
        throw new QrAttendanceValidationException('Invalid event_id.');
    }
    $del = $pdo->prepare("DELETE FROM events WHERE event_id = :id AND org_id = :org");
    $del->execute([':id' => $eventId, ':org' => $orgId]);
    if ($del->rowCount() === 0) {
        throw new QrAttendanceValidationException('Event not found for this organization.');
    }
}

function qrFindEventIdByName(PDO $pdo, int $orgId, string $eventName): ?int
{
    $name = trim($eventName);
    if ($name === '') return null;

    $stmt = $pdo->prepare(
        "SELECT event_id
         FROM events
         WHERE org_id = :org AND event_name = :name
         ORDER BY event_date DESC, event_id DESC
         LIMIT 1"
    );
    $stmt->execute([':org' => $orgId, ':name' => $name]);
    $row = $stmt->fetch();
    return $row ? (int)$row['event_id'] : null;
}

function qrResolveEventId(PDO $pdo, int $orgId, int $userId, array $data): int
{
    $eventId = isset($data['event_id']) ? (int)$data['event_id'] : 0;
    if ($eventId > 0) {
        $chk = $pdo->prepare("SELECT event_id FROM events WHERE event_id = :id AND org_id = :org LIMIT 1");
        $chk->execute([':id' => $eventId, ':org' => $orgId]);
        if (!$chk->fetch()) {
            throw new QrAttendanceValidationException('Event not found for this organization.');
        }
        return $eventId;
    }

    $eventName = trim((string)($data['event_name'] ?? $data['event'] ?? ''));
    if ($eventName === '') {
        throw new QrAttendanceValidationException('event_id or event_name is required.');
    }
    $existing = qrFindEventIdByName($pdo, $orgId, $eventName);
    if ($existing) return $existing;

    return qrSaveEvent($pdo, $orgId, $userId, ['event_name' => $eventName]);
}

function qrListAttendance(PDO $pdo, int $orgId, array $filters = []): array
{
    $where = ["e.org_id = :org"];
    $params = [':org' => $orgId];

    $eventId = isset($filters['event_id']) ? (int)$filters['event_id'] : 0;
    if ($eventId > 0) {
        $where[] = "ar.event_id = :event_id";
        $params[':event_id'] = $eventId;
    }

    $eventName = trim((string)($filters['event_name'] ?? $filters['event'] ?? ''));
    if ($eventName !== '') {
        $where[] = "e.event_name = :event_name";
        $params[':event_name'] = $eventName;
    }

    $section = trim((string)($filters['section'] ?? ''));
    if ($section !== '') {
        $where[] = "ar.section = :section";
        $params[':section'] = $section;
    }

    $dateFrom = trim((string)($filters['date_from'] ?? ''));
    if ($dateFrom !== '') {
        $where[] = "DATE(ar.time_in) >= :date_from";
        $params[':date_from'] = $dateFrom;
    }
    $dateTo = trim((string)($filters['date_to'] ?? ''));
    if ($dateTo !== '') {
        $where[] = "DATE(ar.time_in) <= :date_to";
        $params[':date_to'] = $dateTo;
    }

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = "(ar.student_number LIKE :q_sn OR ar.student_name LIKE :q_name OR ar.section LIKE :q_section OR e.event_name LIKE :q_event)";
        $qLike = '%' . $q . '%';
        $params[':q_sn'] = $qLike;
        $params[':q_name'] = $qLike;
        $params[':q_section'] = $qLike;
        $params[':q_event'] = $qLike;
    }

    $limit = isset($filters['limit']) ? (int)$filters['limit'] : 2000;
    if ($limit <= 0 || $limit > 10000) $limit = 2000;

    $sql = "
        SELECT ar.record_id,
               ar.event_id,
               ar.user_id,
               ar.student_number,
               ar.student_name,
               ar.section,
               ar.time_in,
               ar.time_out,
               ar.created_at,
               ar.updated_at,
               e.event_name,
               DATE(ar.time_in) AS attendance_date
        FROM attendance_records ar
        JOIN events e ON e.event_id = ar.event_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY ar.time_in DESC
        LIMIT " . (int)$limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['record_id'] = (int)$row['record_id'];
        $row['event_id'] = (int)$row['event_id'];
        $row['user_id'] = $row['user_id'] !== null ? (int)$row['user_id'] : null;
    }
    return $rows;
}

function qrFindUserIdByStudentNumber(PDO $pdo, string $studentNumber): ?int
{
    $sn = trim($studentNumber);
    if ($sn === '') return null;
    $stmt = $pdo->prepare(
        "SELECT user_id
         FROM users
         WHERE student_number = :sn
           AND account_type = 'student'
           AND is_active = 1
         LIMIT 1"
    );
    $stmt->execute([':sn' => $sn]);
    $row = $stmt->fetch();
    return $row ? (int)$row['user_id'] : null;
}

function qrCheckIn(PDO $pdo, int $orgId, int $userId, array $data): array
{
    $eventId = qrResolveEventId($pdo, $orgId, $userId, $data);
    $studentNumber = trim((string)($data['student_number'] ?? $data['studentId'] ?? ''));
    $studentName = trim((string)($data['student_name'] ?? $data['studentName'] ?? ''));
    $section = trim((string)($data['section'] ?? ''));
    if ($studentNumber === '') {
        throw new QrAttendanceValidationException('student_number is required.');
    }

    $tz = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $tz);
    $today = $now->format('Y-m-d');

    $check = $pdo->prepare(
        "SELECT record_id, time_in, time_out
         FROM attendance_records
         WHERE event_id = :event_id
           AND student_number = :student_number
           AND DATE(time_in) = :today
         ORDER BY record_id DESC
         LIMIT 1"
    );
    $check->execute([
        ':event_id' => $eventId,
        ':student_number' => $studentNumber,
        ':today' => $today,
    ]);
    $existing = $check->fetch();
    if ($existing) {
        return [
            'record_id' => (int)$existing['record_id'],
            'event_id' => $eventId,
            'already_checked_in' => true,
            'already_checked_out' => !empty($existing['time_out']),
            'time_in' => $existing['time_in'],
            'time_out' => $existing['time_out'],
        ];
    }

    if ($studentName === '') {
        $lookup = $pdo->prepare(
            "SELECT CONCAT(first_name, ' ', last_name) AS full_name
             FROM users
             WHERE student_number = :sn
               AND account_type = 'student'
             LIMIT 1"
        );
        $lookup->execute([':sn' => $studentNumber]);
        $row = $lookup->fetch();
        if ($row && !empty($row['full_name'])) $studentName = trim((string)$row['full_name']);
    }
    if ($studentName === '') $studentName = $studentNumber;

    $studentUserId = qrFindUserIdByStudentNumber($pdo, $studentNumber);

    $ins = $pdo->prepare(
        "INSERT INTO attendance_records
            (event_id, user_id, student_number, student_name, section, time_in)
         VALUES
            (:event_id, :user_id, :student_number, :student_name, :section, :time_in)"
    );
    $ins->execute([
        ':event_id' => $eventId,
        ':user_id' => $studentUserId,
        ':student_number' => $studentNumber,
        ':student_name' => $studentName,
        ':section' => $section !== '' ? $section : null,
        ':time_in' => $now->format('Y-m-d H:i:s'),
    ]);

    return [
        'record_id' => (int)$pdo->lastInsertId(),
        'event_id' => $eventId,
        'already_checked_in' => false,
        'already_checked_out' => false,
        'time_in' => $now->format(DateTimeInterface::ATOM),
        'time_out' => null,
    ];
}

function qrCheckOut(PDO $pdo, int $orgId, int $userId, array $data): array
{
    $recordId = isset($data['record_id']) ? (int)$data['record_id'] : 0;

    $tz = new DateTimeZone('Asia/Manila');
    $now = new DateTimeImmutable('now', $tz);
    $today = $now->format('Y-m-d');

    if ($recordId > 0) {
        $sel = $pdo->prepare(
            "SELECT ar.record_id, ar.event_id, ar.time_in, ar.time_out
             FROM attendance_records ar
             JOIN events e ON e.event_id = ar.event_id
             WHERE ar.record_id = :record_id
               AND e.org_id = :org
             LIMIT 1"
        );
        $sel->execute([':record_id' => $recordId, ':org' => $orgId]);
        $row = $sel->fetch();
    } else {
        $eventId = qrResolveEventId($pdo, $orgId, $userId, $data);
        $studentNumber = trim((string)($data['student_number'] ?? $data['studentId'] ?? ''));
        $date = trim((string)($data['date'] ?? $today));
        if ($studentNumber === '') {
            throw new QrAttendanceValidationException('student_number is required when record_id is missing.');
        }
        $sel = $pdo->prepare(
            "SELECT record_id, event_id, time_in, time_out
             FROM attendance_records
             WHERE event_id = :event_id
               AND student_number = :student_number
               AND DATE(time_in) = :date_ref
             ORDER BY record_id DESC
             LIMIT 1"
        );
        $sel->execute([
            ':event_id' => $eventId,
            ':student_number' => $studentNumber,
            ':date_ref' => $date,
        ]);
        $row = $sel->fetch();
    }

    if (!$row) {
        throw new QrAttendanceValidationException('Attendance record not found.');
    }
    if (!empty($row['time_out'])) {
        return [
            'record_id' => (int)$row['record_id'],
            'event_id' => (int)$row['event_id'],
            'already_checked_out' => true,
            'time_out' => $row['time_out'],
        ];
    }

    $upd = $pdo->prepare(
        "UPDATE attendance_records
         SET time_out = :time_out
         WHERE record_id = :record_id"
    );
    $upd->execute([
        ':time_out' => $now->format('Y-m-d H:i:s'),
        ':record_id' => (int)$row['record_id'],
    ]);

    return [
        'record_id' => (int)$row['record_id'],
        'event_id' => (int)$row['event_id'],
        'already_checked_out' => false,
        'time_out' => $now->format(DateTimeInterface::ATOM),
    ];
}

function qrUpdateAttendanceTime(PDO $pdo, int $orgId, array $data): array
{
    $recordId = isset($data['record_id']) ? (int)$data['record_id'] : 0;
    $field = trim((string)($data['field'] ?? ''));
    $value = trim((string)($data['value'] ?? ''));

    if ($recordId <= 0) {
        throw new QrAttendanceValidationException('record_id is required.');
    }
    if (!in_array($field, ['time_in', 'time_out'], true)) {
        throw new QrAttendanceValidationException('field must be time_in or time_out.');
    }

    $sel = $pdo->prepare(
        "SELECT ar.record_id
         FROM attendance_records ar
         JOIN events e ON e.event_id = ar.event_id
         WHERE ar.record_id = :record_id
           AND e.org_id = :org
         LIMIT 1"
    );
    $sel->execute([':record_id' => $recordId, ':org' => $orgId]);
    if (!$sel->fetch()) {
        throw new QrAttendanceValidationException('Attendance record not found for this organization.');
    }

    if ($value === '') {
        $tz = new DateTimeZone('Asia/Manila');
        $value = (new DateTimeImmutable('now', $tz))->format('Y-m-d H:i:s');
    } else {
        $ts = strtotime($value);
        if ($ts === false) {
            throw new QrAttendanceValidationException('Invalid datetime value.');
        }
        $value = date('Y-m-d H:i:s', $ts);
    }

    $sql = "UPDATE attendance_records SET {$field} = :value WHERE record_id = :record_id";
    $upd = $pdo->prepare($sql);
    $upd->execute([':value' => $value, ':record_id' => $recordId]);

    return [
        'record_id' => $recordId,
        'field' => $field,
        'value' => $value,
    ];
}

function qrListStudents(PDO $pdo, int $orgId, array $filters = []): array
{
    $hasYearSection = qrAttendanceColumnExists($pdo, 'users', 'year_section');
    $sectionExpr = $hasYearSection ? "COALESCE(u.year_section, '')" : "''";

    $where = ["u.account_type = 'student'", "u.is_active = 1"];
    $params = [':org' => $orgId];

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = "(u.student_number LIKE :q_sn OR CONCAT(u.first_name, ' ', u.last_name) LIKE :q_name OR u.email LIKE :q_email)";
        $qLike = '%' . $q . '%';
        $params[':q_sn'] = $qLike;
        $params[':q_name'] = $qLike;
        $params[':q_email'] = $qLike;
    }

    $sql = "
        SELECT DISTINCT u.user_id,
               u.student_number,
               CONCAT(u.first_name, ' ', u.last_name) AS student_name,
               {$sectionExpr} AS section,
               u.email,
               u.created_at,
               u.updated_at
        FROM users u
        LEFT JOIN organization_members om
               ON om.user_id = u.user_id
              AND om.org_id = :org
              AND om.is_active = 1
        WHERE " . implode(' AND ', $where) . "
          AND (
                om.membership_id IS NOT NULL
                OR EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    JOIN events e ON e.event_id = ar.event_id
                    WHERE e.org_id = :org
                      AND ar.student_number = u.student_number
                )
          )
        ORDER BY u.student_number ASC, u.user_id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['user_id'] = (int)$row['user_id'];
    }
    return $rows;
}

function qrGenerateStudentEmail(PDO $pdo, string $studentNumber): string
{
    $baseLocal = preg_replace('/[^a-zA-Z0-9._-]/', '', strtolower($studentNumber));
    if ($baseLocal === '') $baseLocal = 'student';
    $domain = 'qr.local';
    $candidate = $baseLocal . '@' . $domain;
    $suffix = 0;

    while (true) {
        $check = $pdo->prepare("SELECT 1 FROM users WHERE email = :email LIMIT 1");
        $check->execute([':email' => $candidate]);
        if (!$check->fetch()) return $candidate;
        $suffix++;
        $candidate = $baseLocal . $suffix . '@' . $domain;
    }
}

function qrSaveStudent(PDO $pdo, int $orgId, array $data): int
{
    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $studentNumber = trim((string)($data['student_number'] ?? $data['studentId'] ?? ''));
    $studentName = trim((string)($data['student_name'] ?? $data['studentName'] ?? ''));
    $section = trim((string)($data['section'] ?? ''));
    $email = trim((string)($data['email'] ?? ''));
    $password = (string)($data['password'] ?? '12345678');

    if ($studentNumber === '') {
        throw new QrAttendanceValidationException('student_number is required.');
    }
    if ($studentName === '') {
        throw new QrAttendanceValidationException('student_name is required.');
    }
    if (strlen($password) < 8) {
        throw new QrAttendanceValidationException('Password must be at least 8 characters.');
    }

    [$firstName, $lastName] = qrSplitFullName($studentName);
    if ($email === '') {
        $email = qrGenerateStudentEmail($pdo, $studentNumber);
    }

    $hasYearSection = qrAttendanceColumnExists($pdo, 'users', 'year_section');

    if ($userId > 0) {
        $sel = $pdo->prepare(
            "SELECT user_id
             FROM users
             WHERE user_id = :uid
               AND account_type = 'student'
             LIMIT 1"
        );
        $sel->execute([':uid' => $userId]);
        if (!$sel->fetch()) {
            throw new QrAttendanceValidationException('Student user not found.');
        }

        if ($hasYearSection) {
            $upd = $pdo->prepare(
                "UPDATE users
                 SET student_number = :student_number,
                     first_name = :first_name,
                     last_name = :last_name,
                     email = :email,
                     year_section = :section
                 WHERE user_id = :uid"
            );
            $upd->execute([
                ':student_number' => $studentNumber,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':email' => $email,
                ':section' => $section !== '' ? $section : null,
                ':uid' => $userId,
            ]);
        } else {
            $upd = $pdo->prepare(
                "UPDATE users
                 SET student_number = :student_number,
                     first_name = :first_name,
                     last_name = :last_name,
                     email = :email
                 WHERE user_id = :uid"
            );
            $upd->execute([
                ':student_number' => $studentNumber,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':email' => $email,
                ':uid' => $userId,
            ]);
        }
        return $userId;
    }

    $dup = $pdo->prepare("SELECT user_id FROM users WHERE student_number = :sn LIMIT 1");
    $dup->execute([':sn' => $studentNumber]);
    $dupRow = $dup->fetch();
    if ($dupRow) {
        return qrSaveStudent($pdo, $orgId, [
            ...$data,
            'user_id' => (int)$dupRow['user_id'],
            'email' => $email,
            'student_number' => $studentNumber,
            'student_name' => $studentName,
            'section' => $section,
        ]);
    }

    if ($hasYearSection) {
        $ins = $pdo->prepare(
            "INSERT INTO users
                (student_number, first_name, last_name, email, password_hash, account_type, year_section, is_active)
             VALUES
                (:student_number, :first_name, :last_name, :email, :password_hash, 'student', :section, 1)"
        );
        $ins->execute([
            ':student_number' => $studentNumber,
            ':first_name' => $firstName,
            ':last_name' => $lastName,
            ':email' => $email,
            ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
            ':section' => $section !== '' ? $section : null,
        ]);
    } else {
        $ins = $pdo->prepare(
            "INSERT INTO users
                (student_number, first_name, last_name, email, password_hash, account_type, is_active)
             VALUES
                (:student_number, :first_name, :last_name, :email, :password_hash, 'student', 1)"
        );
        $ins->execute([
            ':student_number' => $studentNumber,
            ':first_name' => $firstName,
            ':last_name' => $lastName,
            ':email' => $email,
            ':password_hash' => password_hash($password, PASSWORD_BCRYPT),
        ]);
    }
    return (int)$pdo->lastInsertId();
}

function qrDeleteStudent(PDO $pdo, int $orgId, array $data): void
{
    $userId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
    $studentNumber = trim((string)($data['student_number'] ?? ''));

    if ($userId <= 0 && $studentNumber === '') {
        throw new QrAttendanceValidationException('user_id or student_number is required.');
    }

    if ($userId > 0) {
        $upd = $pdo->prepare(
            "UPDATE users
             SET is_active = 0
             WHERE user_id = :uid
               AND account_type = 'student'"
        );
        $upd->execute([':uid' => $userId]);
    } else {
        $upd = $pdo->prepare(
            "UPDATE users
             SET is_active = 0
             WHERE student_number = :sn
               AND account_type = 'student'"
        );
        $upd->execute([':sn' => $studentNumber]);
    }

    if ($upd->rowCount() === 0) {
        throw new QrAttendanceValidationException('Student user not found.');
    }
}
