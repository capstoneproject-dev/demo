<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/documents.php';

header('Content-Type: application/json');
apiGuard();

try {
    docRequireOsaContext();
    $pdo = getPdo();
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 30)));

    $attentionCount = (int)$pdo->query(
        "SELECT COUNT(*)
         FROM document_submissions
         WHERE status = 'pending'"
    )->fetchColumn();

    $attentionStmt = $pdo->query(
        "SELECT ds.submission_id,
                ds.title,
                ds.document_type,
                ds.status,
                ds.submitted_at,
                COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS submitted_by
         FROM document_submissions ds
         JOIN organizations o ON o.org_id = ds.org_id
         LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
         WHERE ds.status = 'pending'
         ORDER BY ds.submitted_at ASC, ds.submission_id ASC
         LIMIT {$limit}"
    );

    $recentStmt = $pdo->query(
        "SELECT ds.submission_id,
                ds.title,
                ds.document_type,
                ds.status,
                ds.reviewed_at,
                COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
         FROM document_submissions ds
         JOIN organizations o ON o.org_id = ds.org_id
         WHERE ds.status IN ('approved', 'rejected')
           AND ds.reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY ds.reviewed_at DESC, ds.submission_id DESC
         LIMIT {$limit}"
    );

    $target = static fn(int $submissionId): array => [
        'view' => 'requests',
        'action' => 'open_submission',
        'entity_id' => $submissionId,
    ];

    $attentionItems = array_map(static function (array $row) use ($target): array {
        $id = (int)$row['submission_id'];
        $organization = (string)$row['organization'];
        $sender = trim((string)$row['submitted_by']) ?: 'an organization officer';
        $documentType = trim((string)$row['document_type']) ?: 'document';
        return [
            'key' => "document:{$id}:pending",
            'category' => 'document',
            'severity' => 'warning',
            'title' => trim((string)$row['title']) ?: 'Untitled document',
            'summary' => "{$organization} submitted a {$documentType} through {$sender} for OSA review.",
            'occurred_at' => $row['submitted_at'],
            'status' => 'pending',
            'organization' => $organization,
            'target' => $target($id),
        ];
    }, $attentionStmt->fetchAll(PDO::FETCH_ASSOC));

    $recentItems = array_map(static function (array $row) use ($target): array {
        $id = (int)$row['submission_id'];
        $status = strtolower((string)$row['status']);
        $organization = (string)$row['organization'];
        $title = trim((string)$row['title']) ?: 'Untitled document';
        return [
            'key' => "document:{$id}:{$status}",
            'category' => 'document',
            'severity' => $status === 'approved' ? 'success' : 'info',
            'title' => $status === 'approved' ? 'Document approved' : 'Document returned for revision',
            'summary' => "{$organization}: {$title}",
            'occurred_at' => $row['reviewed_at'],
            'status' => $status,
            'organization' => $organization,
            'target' => $target($id),
        ];
    }, $recentStmt->fetchAll(PDO::FETCH_ASSOC));

    jsonOk([
        'attention_count' => $attentionCount,
        'attention_items' => $attentionItems,
        'recent_items' => $recentItems,
        'generated_at' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format(DATE_ATOM),
    ]);
} catch (DocumentAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/osa/notifications/list] ' . $e->getMessage());
    jsonError('A database error occurred while loading alerts.', 500);
} catch (Throwable $e) {
    error_log('[api/osa/notifications/list] ' . $e->getMessage());
    jsonError('Could not load OSA alerts.', 500);
}
