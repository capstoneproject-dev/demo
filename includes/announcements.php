<?php
/**
 * Announcement domain services.
 * Org-scoped helpers for api/announcements endpoints.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class AnnouncementValidationException extends RuntimeException {}
class AnnouncementAuthorizationException extends RuntimeException {}

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
               a.audience_type,
               a.is_published,
               a.published_at,
               a.created_at,
               a.updated_at
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

    return $rows;
}

function annCreateAnnouncement(PDO $pdo, int $orgId, int $userId, array $data): array
{
    $title   = trim((string)($data['title'] ?? ''));
    $content = trim((string)($data['content'] ?? ''));
    $audience= trim((string)($data['audience_type'] ?? 'all_students'));
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

    $allowedAudiences = ['all_students', 'org_members', 'officers'];
    if (!in_array($audience, $allowedAudiences, true)) {
        $audience = 'all_students';
    }

    $publishedAt = $publish ? date('Y-m-d H:i:s') : null;

    $insert = $pdo->prepare(
        "INSERT INTO announcements (org_id, created_by_user_id, title, content, audience_type, is_published, published_at)
         VALUES (:org, :uid, :title, :content, :audience, :published, :published_at)"
    );
    $insert->execute([
        ':org'          => $orgId,
        ':uid'          => $userId,
        ':title'        => $title,
        ':content'      => $content,
        ':audience'     => $audience,
        ':published'    => $publish ? 1 : 0,
        ':published_at' => $publishedAt,
    ]);

    $id = (int)$pdo->lastInsertId();

    $fetch = $pdo->prepare(
        "SELECT announcement_id,
                org_id,
                created_by_user_id,
                title,
                content,
                audience_type,
                is_published,
                published_at,
                created_at,
                updated_at
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

    return $row;
}
