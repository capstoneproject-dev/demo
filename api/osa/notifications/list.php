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
         WHERE status IN ('pending', 'sent_to_osa')
           AND UPPER(TRIM(recipient)) = 'OSA'"
    )->fetchColumn();

    $accountAttentionCount = (int)$pdo->query(
        "SELECT COUNT(*) FROM pending_registrations WHERE status = 'pending'"
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
         WHERE ds.status IN ('pending', 'sent_to_osa')
           AND UPPER(TRIM(ds.recipient)) = 'OSA'
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
           AND UPPER(TRIM(ds.recipient)) = 'OSA'
           AND (
                ds.status <> 'rejected'
                OR NOT EXISTS (
                    SELECT 1 FROM document_versions newer
                    WHERE newer.parent_submission_id = ds.submission_id
                )
           )
           AND ds.reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY ds.reviewed_at DESC, ds.submission_id DESC
         LIMIT {$limit}"
    );

    $accountAttentionStmt = $pdo->query(
        "SELECT reg_id, student_number, employee_number, student_name, requested_role,
                requested_org, requested_position, requested_at
         FROM pending_registrations
         WHERE status = 'pending'
         ORDER BY requested_at ASC, reg_id ASC
         LIMIT {$limit}"
    );

    $accountRecentStmt = $pdo->query(
        "SELECT reg_id, student_name, requested_role, requested_org, status, reviewed_at
         FROM pending_registrations
         WHERE status IN ('approved', 'rejected')
           AND reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY reviewed_at DESC, reg_id DESC
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
            'requires_attention' => true,
            'is_resolved' => false,
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
            'requires_attention' => false,
            'is_resolved' => true,
            'organization' => $organization,
            'target' => $target($id),
        ];
    }, $recentStmt->fetchAll(PDO::FETCH_ASSOC));

    $accountTypeLabel = static function (string $role): string {
        return match ($role) {
            'organization_adviser' => 'Organization Adviser',
            'org_officer' => 'Organization Officer',
            default => 'Student',
        };
    };
    $accountTarget = static fn(int $registrationId, string $status): array => [
        'view' => 'account',
        'action' => 'open_account_request',
        'entity_id' => $registrationId,
        'status' => $status,
    ];

    $accountAttentionItems = array_map(static function (array $row) use ($accountTypeLabel, $accountTarget): array {
        $id = (int)$row['reg_id'];
        $accountType = $accountTypeLabel((string)$row['requested_role']);
        $name = trim((string)$row['student_name']) ?: 'Unknown applicant';
        $organization = trim((string)($row['requested_org'] ?? ''));
        $identifier = trim((string)($row['employee_number'] ?: $row['student_number'])) ?: 'No identifier';
        $assignment = $organization !== '' ? " for {$organization}" : '';
        return [
            'key' => "account_request:{$id}:pending",
            'category' => 'account_request',
            'severity' => 'warning',
            'title' => "New {$accountType} account request",
            'summary' => "{$name} ({$identifier}) submitted a request{$assignment}.",
            'occurred_at' => $row['requested_at'],
            'status' => 'pending',
            'requires_attention' => true,
            'is_resolved' => false,
            'organization' => $organization,
            'target' => $accountTarget($id, 'pending'),
        ];
    }, $accountAttentionStmt->fetchAll(PDO::FETCH_ASSOC));

    $accountRecentItems = array_map(static function (array $row) use ($accountTypeLabel, $accountTarget): array {
        $id = (int)$row['reg_id'];
        $status = strtolower((string)$row['status']);
        $accountType = $accountTypeLabel((string)$row['requested_role']);
        $name = trim((string)$row['student_name']) ?: 'Unknown applicant';
        return [
            'key' => "account_request:{$id}:{$status}",
            'category' => 'account_request',
            'severity' => $status === 'approved' ? 'success' : 'info',
            'title' => "Account request {$status}",
            'summary' => "{$name}'s {$accountType} request was {$status}.",
            'occurred_at' => $row['reviewed_at'],
            'status' => $status,
            'requires_attention' => false,
            'is_resolved' => true,
            'organization' => trim((string)($row['requested_org'] ?? '')),
            'target' => $accountTarget($id, $status),
        ];
    }, $accountRecentStmt->fetchAll(PDO::FETCH_ASSOC));

    $attentionItems = array_merge($attentionItems, $accountAttentionItems);
    usort($attentionItems, static fn(array $a, array $b): int =>
        strcmp((string)$b['occurred_at'], (string)$a['occurred_at'])
    );
    $attentionItems = array_slice($attentionItems, 0, $limit);

    $recentItems = array_merge($recentItems, $accountRecentItems);
    usort($recentItems, static fn(array $a, array $b): int =>
        strcmp((string)$b['occurred_at'], (string)$a['occurred_at'])
    );
    $recentItems = array_slice($recentItems, 0, $limit);

    jsonOk([
        'attention_count' => $attentionCount + $accountAttentionCount,
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
