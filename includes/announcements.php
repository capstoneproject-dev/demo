<?php
/**
 * Announcement domain services.
 * Org-scoped helpers for api/announcements endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/upload_security.php';

class AnnouncementValidationException extends RuntimeException {}
class AnnouncementAuthorizationException extends RuntimeException {}

function annEnsureManagementColumns(PDO $pdo): void
{
    $columns = [
        'archived_at' => "ALTER TABLE announcements ADD COLUMN archived_at DATETIME NULL AFTER published_at",
        'archived_by_user_id' => "ALTER TABLE announcements ADD COLUMN archived_by_user_id INT NULL AFTER archived_at",
    ];
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'announcements'
           AND COLUMN_NAME = :column_name"
    );
    foreach ($columns as $column => $alterSql) {
        $stmt->execute([':column_name' => $column]);
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec($alterSql);
        }
    }
    $indexStmt = $pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'announcements'
           AND INDEX_NAME = 'idx_announcements_org_archive_sort'"
    );
    if ((int)$indexStmt->fetchColumn() === 0) {
        $pdo->exec(
            "ALTER TABLE announcements
             ADD INDEX idx_announcements_org_archive_sort (org_id, archived_at, published_at, announcement_id)"
        );
    }
    $constraintStmt = $pdo->query(
        "SELECT COUNT(*)
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = 'announcements'
           AND CONSTRAINT_NAME = 'fk_announce_archiver'
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    );
    if ((int)$constraintStmt->fetchColumn() === 0) {
        $pdo->exec(
            "ALTER TABLE announcements
             ADD CONSTRAINT fk_announce_archiver
             FOREIGN KEY (archived_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL"
        );
    }
}

function annEnsureProgramTargetsTable(PDO $pdo): void
{
    annEnsureManagementColumns($pdo);
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS announcement_program_targets (
            target_id INT NOT NULL AUTO_INCREMENT,
            announcement_id INT NOT NULL,
            program_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (target_id),
            UNIQUE KEY uq_announcement_program_target (announcement_id, program_id),
            KEY idx_announcement_program_targets_program (program_id),
            CONSTRAINT fk_announcement_program_targets_announcement
                FOREIGN KEY (announcement_id) REFERENCES announcements(announcement_id) ON DELETE CASCADE,
            CONSTRAINT fk_announcement_program_targets_program
                FOREIGN KEY (program_id) REFERENCES academic_programs(program_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function annNormalizeProgramIds(array $values): array
{
    $ids = [];
    foreach ($values as $value) {
        $id = (int)$value;
        if ($id > 0) {
            $ids[$id] = $id;
        }
    }
    return array_values($ids);
}

function annAttachProgramTargets(PDO $pdo, array &$rows): void
{
    if (!$rows) return;
    annEnsureProgramTargetsTable($pdo);

    $ids = array_values(array_filter(array_map(
        static fn($row) => (int)($row['announcement_id'] ?? 0),
        $rows
    )));
    if (!$ids) return;

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT apt.announcement_id,
                apt.program_id,
                ap.program_code
         FROM announcement_program_targets apt
         JOIN academic_programs ap ON ap.program_id = apt.program_id
         WHERE apt.announcement_id IN ({$placeholders})
         ORDER BY ap.program_code ASC"
    );
    $stmt->execute($ids);

    $targetsByAnnouncement = [];
    foreach ($stmt->fetchAll() as $target) {
        $announcementId = (int)$target['announcement_id'];
        $targetsByAnnouncement[$announcementId][] = [
            'program_id' => (int)$target['program_id'],
            'program_code' => (string)$target['program_code'],
        ];
    }

    foreach ($rows as &$row) {
        $row['target_programs'] = $targetsByAnnouncement[(int)$row['announcement_id']] ?? [];
    }
}

function annSaveAnnouncementPhotoFromData(string $photoValue): string
{
    $raw = trim($photoValue);
    if ($raw === '') {
        return '';
    }

    if (!str_starts_with($raw, 'data:')) {
        if (!preg_match('#^uploads/announcements/[A-Za-z0-9._-]+$#', $raw)) {
            throw new AnnouncementValidationException('Invalid announcement photo path.');
        }
        return $raw;
    }

    $allowed = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    try {
        return uploadStoreImageDataUrl(
            $raw,
            'announcements',
            'announcement',
            $allowed,
            5 * 1024 * 1024,
            8000
        );
    } catch (UploadValidationException $e) {
        throw new AnnouncementValidationException($e->getMessage(), 0, $e);
    }
}

function annSaveAnnouncementPhotoValue(array $data): string
{
    $photos = $data['announcement_photos'] ?? $data['photos'] ?? null;
    if (is_array($photos)) {
        $paths = [];
        foreach ($photos as $photo) {
            $path = annSaveAnnouncementPhotoFromData((string)$photo);
            if ($path !== '') {
                $paths[] = $path;
            }
        }
        if ($paths) {
            return json_encode($paths, JSON_UNESCAPED_SLASHES);
        }
    }

    $photoDataUrl = trim((string)($data['announcement_photo'] ?? ''));
    return $photoDataUrl !== '' ? annSaveAnnouncementPhotoFromData($photoDataUrl) : '';
}

function annRequireOfficerOrgContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new AnnouncementAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? null) !== 'org') {
        throw new AnnouncementAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new AnnouncementAuthorizationException('No active organization selected.');
    }

    return [
        'session' => $session,
        'org_id'  => $orgId,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function annListAnnouncements(PDO $pdo, int $orgId, array $filters = []): array
{
    annEnsureProgramTargetsTable($pdo);

    $where   = ['a.org_id = :org'];
    $params  = [':org' => $orgId];

    if (isset($filters['published'])) {
        $where[] = 'a.is_published = :published';
        $params[':published'] = (int)$filters['published'] ? 1 : 0;
    }

    if (!empty($filters['q'])) {
        $q = '%' . trim((string)$filters['q']) . '%';
        $where[] = '(a.title LIKE :q_title OR a.content LIKE :q_content)';
        $params[':q_title'] = $q;
        $params[':q_content'] = $q;
    }

    $sql = "
        SELECT a.announcement_id,
               a.org_id,
               a.created_by_user_id,
               a.title,
               a.content,
               a.announcement_photo,
               a.audience_type,
               a.is_published,
               a.published_at,
               a.archived_at,
               a.archived_by_user_id,
               a.created_at,
               a.updated_at,
               (
                   SELECT e.event_datetime
                   FROM events e
                   WHERE e.org_id = a.org_id
                     AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                   ORDER BY e.event_id DESC
                   LIMIT 1
               ) AS event_datetime,
               (
                   SELECT e.location
                   FROM events e
                   WHERE e.org_id = a.org_id
                     AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                   ORDER BY e.event_id DESC
                   LIMIT 1
               ) AS event_location
        FROM announcements a
        WHERE " . implode(' AND ', $where) . "
        ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.announcement_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['announcement_id']   = (int)$row['announcement_id'];
        $row['org_id']            = (int)$row['org_id'];
        $row['created_by_user_id']= (int)$row['created_by_user_id'];
        $row['is_published']      = (int)$row['is_published'];
        $row['archived_by_user_id'] = $row['archived_by_user_id'] !== null ? (int)$row['archived_by_user_id'] : null;
    }
    annAttachProgramTargets($pdo, $rows);

    return $rows;
}

function annListPublishedAnnouncementsForStudents(PDO $pdo, array $filters = []): array
{
    annEnsureProgramTargetsTable($pdo);

    $where = [
        'a.is_published = 1',
        'a.archived_at IS NULL',
        "COALESCE(o.status, 'active') = 'active'",
    ];
    $params = [];

    $studentProgramId = (int)($filters['student_program_id'] ?? 0);
    if ($studentProgramId > 0) {
        $where[] = "(
            a.audience_type = 'all_students'
            OR (
                a.audience_type = 'specific_courses'
                AND EXISTS (
                    SELECT 1
                    FROM announcement_program_targets apt
                    WHERE apt.announcement_id = a.announcement_id
                      AND apt.program_id = :student_program_id
                )
            )
        )";
        $params[':student_program_id'] = $studentProgramId;
    } else {
        $where[] = "a.audience_type = 'all_students'";
    }

    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = '(a.title LIKE :q_title OR a.content LIKE :q_content OR o.org_name LIKE :q_org_name OR o.org_code LIKE :q_org_code)';
        $qLike = '%' . $q . '%';
        $params[':q_title'] = $qLike;
        $params[':q_content'] = $qLike;
        $params[':q_org_name'] = $qLike;
        $params[':q_org_code'] = $qLike;
    }

    $limit = isset($filters['limit']) ? (int)$filters['limit'] : 10;
    $limit = max(1, min(50, $limit));

    $sql = "
        SELECT a.announcement_id,
               a.org_id,
               a.created_by_user_id,
               a.title,
               a.content,
               a.announcement_photo,
               a.audience_type,
               a.is_published,
               a.published_at,
               a.archived_at,
               a.archived_by_user_id,
               a.created_at,
               a.updated_at,
               o.org_name,
               o.org_code,
               (
                   SELECT e.event_datetime
                   FROM events e
                   WHERE e.org_id = a.org_id
                     AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                   ORDER BY e.event_id DESC
                   LIMIT 1
               ) AS event_datetime,
               (
                   SELECT e.location
                   FROM events e
                   WHERE e.org_id = a.org_id
                     AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                   ORDER BY e.event_id DESC
                   LIMIT 1
               ) AS event_location
        FROM announcements a
        JOIN organizations o ON o.org_id = a.org_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.announcement_id DESC
        LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['announcement_id'] = (int)$row['announcement_id'];
        $row['org_id'] = (int)$row['org_id'];
        $row['created_by_user_id'] = (int)$row['created_by_user_id'];
        $row['is_published'] = (int)$row['is_published'];
        $row['archived_by_user_id'] = $row['archived_by_user_id'] !== null ? (int)$row['archived_by_user_id'] : null;
    }
    annAttachProgramTargets($pdo, $rows);

    return $rows;
}

function annCreateAnnouncement(PDO $pdo, int $orgId, int $userId, array $data): array
{
    annEnsureProgramTargetsTable($pdo);
    $title   = trim((string)($data['title'] ?? ''));
    $content = trim((string)($data['content'] ?? ''));
    $audience= trim((string)($data['audience_type'] ?? 'all_students'));
    $targetProgramIds = annNormalizeProgramIds((array)($data['target_program_ids'] ?? []));
    $publish = isset($data['publish']) ? (int)!empty($data['publish']) : 1;

    if ($title === '') {
        throw new AnnouncementValidationException('title is required.');
    }
    if ($content === '') {
        throw new AnnouncementValidationException('content is required.');
    }
    if ($userId <= 0) {
        throw new AnnouncementValidationException('Invalid creator user.');
    }

    $allowedAudiences = ['all_students', 'specific_courses'];
    if (!in_array($audience, $allowedAudiences, true)) {
        $audience = 'all_students';
    }
    if ($audience === 'specific_courses' && !$targetProgramIds) {
        throw new AnnouncementValidationException('Select at least one course for this announcement.');
    }
    if ($audience !== 'specific_courses') {
        $targetProgramIds = [];
    }
    $validProgramIds = [];
    if ($targetProgramIds) {
        $validStmt = $pdo->prepare(
            "SELECT program_id
             FROM academic_programs
             WHERE is_active = 1
               AND program_id IN (" . implode(',', array_fill(0, count($targetProgramIds), '?')) . ")"
        );
        $validStmt->execute($targetProgramIds);
        $validProgramIds = array_map('intval', $validStmt->fetchAll(PDO::FETCH_COLUMN));
        if (!$validProgramIds) {
            throw new AnnouncementValidationException('Selected courses are not available.');
        }
    }

    $announcementPhoto = annSaveAnnouncementPhotoValue($data);
    $publishedAt = $publish
        ? (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d H:i:s')
        : null;

    $insert = $pdo->prepare(
        "INSERT INTO announcements (org_id, created_by_user_id, title, content, announcement_photo, audience_type, is_published, published_at)
         VALUES (:org, :uid, :title, :content, :announcement_photo, :audience, :published, :published_at)"
    );
    $insert->execute([
        ':org'          => $orgId,
        ':uid'          => $userId,
        ':title'        => $title,
        ':content'      => $content,
        ':announcement_photo' => $announcementPhoto !== '' ? $announcementPhoto : null,
        ':audience'     => $audience,
        ':published'    => $publish ? 1 : 0,
        ':published_at' => $publishedAt,
    ]);

    $id = (int)$pdo->lastInsertId();
    if ($validProgramIds) {
        annEnsureProgramTargetsTable($pdo);
        $targetInsert = $pdo->prepare(
            "INSERT IGNORE INTO announcement_program_targets (announcement_id, program_id)
             VALUES (:announcement_id, :program_id)"
        );
        foreach ($validProgramIds as $programId) {
            $targetInsert->execute([
                ':announcement_id' => $id,
                ':program_id' => $programId,
            ]);
        }
    }

    $fetch = $pdo->prepare(
        "SELECT announcement_id,
                org_id,
                created_by_user_id,
                title,
                content,
                announcement_photo,
                audience_type,
                is_published,
                published_at,
                archived_at,
                archived_by_user_id,
                created_at,
                updated_at,
                (
                    SELECT e.event_datetime
                    FROM events e
                    WHERE e.org_id = announcements.org_id
                      AND e.event_name COLLATE utf8mb4_unicode_ci = announcements.title COLLATE utf8mb4_unicode_ci
                    ORDER BY e.event_id DESC
                    LIMIT 1
                ) AS event_datetime,
                (
                    SELECT e.location
                    FROM events e
                    WHERE e.org_id = announcements.org_id
                      AND e.event_name COLLATE utf8mb4_unicode_ci = announcements.title COLLATE utf8mb4_unicode_ci
                    ORDER BY e.event_id DESC
                    LIMIT 1
                ) AS event_location
         FROM announcements
         WHERE announcement_id = :id
         LIMIT 1"
    );
    $fetch->execute([':id' => $id]);
    $row = $fetch->fetch();
    if (!$row) {
        throw new RuntimeException('Failed to load inserted announcement.');
    }

    $row['announcement_id']    = (int)$row['announcement_id'];
    $row['org_id']             = (int)$row['org_id'];
    $row['created_by_user_id'] = (int)$row['created_by_user_id'];
    $row['is_published']       = (int)$row['is_published'];
    $row['archived_by_user_id'] = $row['archived_by_user_id'] !== null ? (int)$row['archived_by_user_id'] : null;
    $rows = [$row];
    annAttachProgramTargets($pdo, $rows);
    $row = $rows[0];

    return $row;
}

function annDecodePhotoPaths(?string $value): array
{
    $raw = trim((string)$value);
    if ($raw === '') return [];
    $decoded = json_decode($raw, true);
    $values = is_array($decoded) ? $decoded : [$raw];
    return array_values(array_unique(array_filter(array_map(
        static fn($path) => trim((string)$path),
        $values
    ))));
}

function annNormalizeRow(array &$row): void
{
    $row['announcement_id'] = (int)$row['announcement_id'];
    $row['org_id'] = (int)$row['org_id'];
    $row['created_by_user_id'] = (int)$row['created_by_user_id'];
    $row['is_published'] = (int)$row['is_published'];
    $row['archived_by_user_id'] = $row['archived_by_user_id'] !== null
        ? (int)$row['archived_by_user_id']
        : null;
}

function annFetchAnnouncementForOrg(PDO $pdo, int $orgId, int $announcementId): array
{
    annEnsureProgramTargetsTable($pdo);
    $stmt = $pdo->prepare(
        "SELECT a.announcement_id,
                a.org_id,
                a.created_by_user_id,
                a.title,
                a.content,
                a.announcement_photo,
                a.audience_type,
                a.is_published,
                a.published_at,
                a.archived_at,
                a.archived_by_user_id,
                a.created_at,
                a.updated_at,
                (
                    SELECT e.event_datetime
                    FROM events e
                    WHERE e.org_id = a.org_id
                      AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                    ORDER BY e.event_id DESC
                    LIMIT 1
                ) AS event_datetime,
                (
                    SELECT e.location
                    FROM events e
                    WHERE e.org_id = a.org_id
                      AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                    ORDER BY e.event_id DESC
                    LIMIT 1
                ) AS event_location
         FROM announcements a
         WHERE a.announcement_id = :announcement_id
           AND a.org_id = :org_id
         LIMIT 1"
    );
    $stmt->execute([
        ':announcement_id' => $announcementId,
        ':org_id' => $orgId,
    ]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new AnnouncementAuthorizationException('Announcement not found for this organization.');
    }
    annNormalizeRow($row);
    $rows = [$row];
    annAttachProgramTargets($pdo, $rows);
    return $rows[0];
}

function annEncodeCursor(string $sortAt, int $announcementId): string
{
    return rtrim(strtr(base64_encode(json_encode([
        'sort_at' => $sortAt,
        'id' => $announcementId,
    ], JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
}

function annDecodeCursor(string $cursor): ?array
{
    if ($cursor === '') return null;
    $padding = strlen($cursor) % 4;
    if ($padding) $cursor .= str_repeat('=', 4 - $padding);
    $decoded = json_decode((string)base64_decode(strtr($cursor, '-_', '+/'), true), true);
    if (!is_array($decoded) || empty($decoded['sort_at']) || (int)($decoded['id'] ?? 0) <= 0) {
        throw new AnnouncementValidationException('Invalid announcement cursor.');
    }
    return [
        'sort_at' => (string)$decoded['sort_at'],
        'id' => (int)$decoded['id'],
    ];
}

function annListAnnouncementsPage(PDO $pdo, int $orgId, array $filters = []): array
{
    annEnsureProgramTargetsTable($pdo);
    $where = ['a.org_id = :org'];
    $params = [':org' => $orgId];
    $status = strtolower(trim((string)($filters['status'] ?? 'active')));

    if ($status === 'archived') {
        $where[] = 'a.archived_at IS NOT NULL';
    } elseif ($status === 'unpublished') {
        $where[] = 'a.archived_at IS NULL';
        $where[] = 'a.is_published = 0';
    } else {
        $status = 'active';
        $where[] = 'a.archived_at IS NULL';
        $where[] = 'a.is_published = 1';
    }
    if (isset($filters['published'])) {
        $where[] = 'a.is_published = :published';
        $params[':published'] = (int)$filters['published'] ? 1 : 0;
    }
    $q = trim((string)($filters['q'] ?? ''));
    if ($q !== '') {
        $where[] = '(a.title LIKE :q_title OR a.content LIKE :q_content)';
        $params[':q_title'] = '%' . $q . '%';
        $params[':q_content'] = '%' . $q . '%';
    }
    $audience = trim((string)($filters['audience'] ?? ''));
    if (in_array($audience, ['all_students', 'specific_courses'], true)) {
        $where[] = 'a.audience_type = :audience';
        $params[':audience'] = $audience;
    }
    $type = strtolower(trim((string)($filters['type'] ?? '')));
    $eventExists = "EXISTS (
        SELECT 1 FROM events e
        WHERE e.org_id = a.org_id
          AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
    )";
    if ($type === 'event') $where[] = $eventExists;
    if ($type === 'announcement') $where[] = "NOT {$eventExists}";

    $cursor = annDecodeCursor(trim((string)($filters['cursor'] ?? '')));
    if ($cursor) {
        $where[] = "(COALESCE(a.published_at, a.created_at) < :cursor_at
            OR (COALESCE(a.published_at, a.created_at) = :cursor_at_equal
                AND a.announcement_id < :cursor_id))";
        $params[':cursor_at'] = $cursor['sort_at'];
        $params[':cursor_at_equal'] = $cursor['sort_at'];
        $params[':cursor_id'] = $cursor['id'];
    }

    $limit = max(1, min(50, (int)($filters['limit'] ?? 10)));
    $fetchLimit = $limit + 1;
    $sql = "SELECT a.announcement_id,
                   a.org_id,
                   a.created_by_user_id,
                   a.title,
                   a.content,
                   a.announcement_photo,
                   a.audience_type,
                   a.is_published,
                   a.published_at,
                   a.archived_at,
                   a.archived_by_user_id,
                   a.created_at,
                   a.updated_at,
                   COALESCE(a.published_at, a.created_at) AS sort_at,
                   (
                       SELECT e.event_datetime FROM events e
                       WHERE e.org_id = a.org_id
                         AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                       ORDER BY e.event_id DESC LIMIT 1
                   ) AS event_datetime,
                   (
                       SELECT e.location FROM events e
                       WHERE e.org_id = a.org_id
                         AND e.event_name COLLATE utf8mb4_unicode_ci = a.title COLLATE utf8mb4_unicode_ci
                       ORDER BY e.event_id DESC LIMIT 1
                   ) AS event_location
            FROM announcements a
            WHERE " . implode(' AND ', $where) . "
            ORDER BY sort_at DESC, a.announcement_id DESC
            LIMIT {$fetchLimit}";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);
    foreach ($rows as &$row) annNormalizeRow($row);
    unset($row);
    annAttachProgramTargets($pdo, $rows);

    $nextCursor = null;
    if ($hasMore && $rows) {
        $last = $rows[count($rows) - 1];
        $nextCursor = annEncodeCursor((string)$last['sort_at'], (int)$last['announcement_id']);
    }
    $countStmt = $pdo->prepare(
        "SELECT
            SUM(CASE WHEN archived_at IS NULL AND is_published = 1 THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived_count
         FROM announcements
         WHERE org_id = :org"
    );
    $countStmt->execute([':org' => $orgId]);
    $counts = $countStmt->fetch() ?: [];

    return [
        'items' => $rows,
        'next_cursor' => $nextCursor,
        'has_more' => $hasMore,
        'counts' => [
            'active' => (int)($counts['active_count'] ?? 0),
            'archived' => (int)($counts['archived_count'] ?? 0),
        ],
    ];
}

function annValidateTargetPrograms(PDO $pdo, string $audience, array $values): array
{
    $ids = annNormalizeProgramIds($values);
    if ($audience !== 'specific_courses') return [];
    if (!$ids) {
        throw new AnnouncementValidationException('Select at least one course for this announcement.');
    }
    $stmt = $pdo->prepare(
        "SELECT program_id FROM academic_programs
         WHERE is_active = 1
           AND program_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")"
    );
    $stmt->execute($ids);
    $valid = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    sort($valid);
    sort($ids);
    if ($valid !== $ids) {
        throw new AnnouncementValidationException('One or more selected courses are not available.');
    }
    return $valid;
}

function annDeleteLocalPhoto(string $path): void
{
    if (!preg_match('#^uploads/announcements/[A-Za-z0-9._-]+$#', $path)) return;
    $root = realpath(dirname(__DIR__) . '/uploads/announcements');
    $file = realpath(dirname(__DIR__) . '/' . $path);
    if ($root && $file && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) {
        @unlink($file);
    }
}

function annUpdateAnnouncement(PDO $pdo, int $orgId, int $announcementId, array $data): array
{
    $current = annFetchAnnouncementForOrg($pdo, $orgId, $announcementId);
    $title = trim((string)($data['title'] ?? ''));
    $content = trim((string)($data['content'] ?? ''));
    $audience = trim((string)($data['audience_type'] ?? 'all_students'));
    if ($title === '' || $content === '') {
        throw new AnnouncementValidationException('Headline and content are required.');
    }
    if (!in_array($audience, ['all_students', 'specific_courses'], true)) {
        throw new AnnouncementValidationException('Invalid target audience.');
    }
    $programIds = annValidateTargetPrograms($pdo, $audience, (array)($data['target_program_ids'] ?? []));
    $existingPaths = annDecodePhotoPaths($current['announcement_photo'] ?? '');
    $retained = array_values(array_unique(array_map('strval', (array)($data['retained_photo_paths'] ?? []))));
    foreach ($retained as $path) {
        if (!in_array($path, $existingPaths, true)) {
            throw new AnnouncementAuthorizationException('An attached photo does not belong to this announcement.');
        }
    }
    $newPaths = [];
    try {
        foreach ((array)($data['announcement_photos'] ?? []) as $photo) {
            $path = annSaveAnnouncementPhotoFromData((string)$photo);
            if ($path !== '') $newPaths[] = $path;
        }
        $allPaths = array_values(array_merge($retained, $newPaths));
        $photoValue = $allPaths ? json_encode($allPaths, JSON_UNESCAPED_SLASHES) : null;

        $pdo->beginTransaction();
        $update = $pdo->prepare(
            "UPDATE announcements
             SET title = :title,
                 content = :content,
                 audience_type = :audience,
                 announcement_photo = :photo
             WHERE announcement_id = :announcement_id
               AND org_id = :org_id"
        );
        $update->execute([
            ':title' => $title,
            ':content' => $content,
            ':audience' => $audience,
            ':photo' => $photoValue,
            ':announcement_id' => $announcementId,
            ':org_id' => $orgId,
        ]);
        $pdo->prepare("DELETE FROM announcement_program_targets WHERE announcement_id = :id")
            ->execute([':id' => $announcementId]);
        if ($programIds) {
            $insert = $pdo->prepare(
                "INSERT INTO announcement_program_targets (announcement_id, program_id)
                 VALUES (:announcement_id, :program_id)"
            );
            foreach ($programIds as $programId) {
                $insert->execute([
                    ':announcement_id' => $announcementId,
                    ':program_id' => $programId,
                ]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($newPaths as $path) annDeleteLocalPhoto($path);
        throw $e;
    }
    foreach (array_diff($existingPaths, $retained) as $path) annDeleteLocalPhoto($path);
    return annFetchAnnouncementForOrg($pdo, $orgId, $announcementId);
}

function annSetArchivedState(PDO $pdo, int $orgId, int $userId, int $announcementId, bool $archived): array
{
    annFetchAnnouncementForOrg($pdo, $orgId, $announcementId);
    $sql = $archived
        ? "UPDATE announcements
           SET is_published = 0,
               archived_at = CURRENT_TIMESTAMP,
               archived_by_user_id = :user_id
           WHERE announcement_id = :announcement_id AND org_id = :org_id"
        : "UPDATE announcements
           SET is_published = 1,
               archived_at = NULL,
               archived_by_user_id = NULL
           WHERE announcement_id = :announcement_id AND org_id = :org_id";
    $stmt = $pdo->prepare($sql);
    $params = [
        ':announcement_id' => $announcementId,
        ':org_id' => $orgId,
    ];
    if ($archived) $params[':user_id'] = $userId;
    $stmt->execute($params);
    return annFetchAnnouncementForOrg($pdo, $orgId, $announcementId);
}
