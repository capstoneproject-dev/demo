<?php
/**
 * Announcement domain services.
 * Org-scoped helpers for api/announcements endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class AnnouncementValidationException extends RuntimeException {}
class AnnouncementAuthorizationException extends RuntimeException {}

function annEnsureProgramTargetsTable(PDO $pdo): void
{
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
        return $raw;
    }

    if (!preg_match('#^data:(image/(png|jpeg|jpg|webp|gif));base64,(.+)$#i', $raw, $matches)) {
        throw new AnnouncementValidationException('Invalid announcement photo data.');
    }

    $mime = strtolower($matches[1]);
    $binary = base64_decode($matches[3], true);
    if ($binary === false) {
        throw new AnnouncementValidationException('Invalid announcement photo encoding.');
    }

    $extensionMap = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    $extension = $extensionMap[$mime] ?? 'png';

    $targetDir = dirname(__DIR__) . '/uploads/announcements';
    if (!is_dir($targetDir) && !mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
        throw new RuntimeException('Could not prepare announcement photo directory.');
    }

    $fileName = 'announcement_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
    $targetPath = $targetDir . '/' . $fileName;
    if (file_put_contents($targetPath, $binary) === false) {
        throw new RuntimeException('Could not save announcement photo.');
    }

    return 'uploads/announcements/' . $fileName;
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
        $where[] = '(a.title LIKE :q OR a.content LIKE :q)';
        $params[':q'] = $q;
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
    }
    annAttachProgramTargets($pdo, $rows);

    return $rows;
}

function annListPublishedAnnouncementsForStudents(PDO $pdo, array $filters = []): array
{
    annEnsureProgramTargetsTable($pdo);

    $where = [
        'a.is_published = 1',
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
               a.created_at,
               a.updated_at,
               o.org_name,
               o.org_code
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
    }
    annAttachProgramTargets($pdo, $rows);

    return $rows;
}

function annCreateAnnouncement(PDO $pdo, int $orgId, int $userId, array $data): array
{
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
    $rows = [$row];
    annAttachProgramTargets($pdo, $rows);
    $row = $rows[0];

    return $row;
}
