<?php
/**
 * Document submission & repository domain services.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class DocumentValidationException extends RuntimeException {}
class DocumentAuthorizationException extends RuntimeException {}

function docRequireOfficerOrgContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new DocumentAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? null) !== 'org') {
        throw new DocumentAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new DocumentAuthorizationException('No active organization selected.');
    }
    return [
        'session' => $session,
        'org_id'  => $orgId,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function docRequireOsaContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new DocumentAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? '') !== 'osa' && ($session['account_type'] ?? '') !== 'osa_staff') {
        throw new DocumentAuthorizationException('OSA staff context required.');
    }
    return [
        'session' => $session,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function docValidateAcademicYear(?string $ay): ?string
{
    $ay = $ay ? trim($ay) : null;
    if (!$ay) return null;
    if (!preg_match('/^\d{4}-\d{4}$/', $ay)) {
        throw new DocumentValidationException('academic_year must be in YYYY-YYYY format.');
    }
    return $ay;
}

function docValidateSemester(?string $sem): ?string
{
    $sem = $sem ? trim($sem) : null;
    if (!$sem) return null;
    $sem = strtolower($sem);
    if (!in_array($sem, ['1st', '2nd'], true)) {
        throw new DocumentValidationException('semester must be 1st or 2nd.');
    }
    return $sem;
}

function docValidateType(string $type): string
{
    $type = trim($type);
    if ($type === '') {
        throw new DocumentValidationException('document_type is required.');
    }
    return $type;
}

function docCreateSubmission(PDO $pdo, int $orgId, int $userId, array $data): array
{
    $title        = trim((string)($data['title'] ?? ''));
    $documentType = docValidateType((string)($data['document_type'] ?? ''));
    $recipient    = trim((string)($data['recipient'] ?? 'OSA')) ?: 'OSA';
    $description  = trim((string)($data['description'] ?? '')) ?: null;
    $fileUrl      = trim((string)($data['file_url'] ?? ''));
    $semester     = docValidateSemester($data['semester'] ?? null);
    $academicYear = docValidateAcademicYear($data['academic_year'] ?? null);

    if ($title === '')  throw new DocumentValidationException('title is required.');
    if ($fileUrl === '')throw new DocumentValidationException('file_url is required.');
    if ($orgId <= 0 || $userId <= 0) throw new DocumentValidationException('Invalid org/user context.');

    $stmt = $pdo->prepare(
        "INSERT INTO document_submissions
         (org_id, submitted_by_user_id, title, document_type, file_url, recipient, description, status, semester, academic_year)
         VALUES (:org, :uid, :title, :type, :file, :recipient, :description, 'pending', :semester, :ay)"
    );
    $stmt->execute([
        ':org'         => $orgId,
        ':uid'         => $userId,
        ':title'       => $title,
        ':type'        => $documentType,
        ':file'        => $fileUrl,
        ':recipient'   => $recipient,
        ':description' => $description,
        ':semester'    => $semester,
        ':ay'          => $academicYear,
    ]);

    $id = (int)$pdo->lastInsertId();
    return docFetchSubmission($pdo, $id);
}

function docFetchSubmission(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare(
        "SELECT ds.*, o.org_name
         FROM document_submissions ds
         JOIN organizations o ON o.org_id = ds.org_id
         WHERE ds.submission_id = :id"
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('Submission not found.');
    $row['submission_id'] = (int)$row['submission_id'];
    $row['org_id']        = (int)$row['org_id'];
    $row['submitted_by_user_id'] = (int)$row['submitted_by_user_id'];
    $row['reviewed_by_user_id']  = $row['reviewed_by_user_id'] !== null ? (int)$row['reviewed_by_user_id'] : null;
    return $row;
}

function docListSubmissions(PDO $pdo, array $filters = [], ?int $orgScope = null): array
{
    $where  = [];
    $params = [];

    if ($orgScope !== null) {
        $where[] = 'ds.org_id = :org';
        $params[':org'] = $orgScope;
    }

    if (!empty($filters['status']) && $filters['status'] !== 'all') {
        $where[] = 'ds.status = :status';
        $params[':status'] = $filters['status'];
    }

    if (!empty($filters['recipient'])) {
        $where[] = 'ds.recipient = :recipient';
        $params[':recipient'] = $filters['recipient'];
    }

    if (!empty($filters['q'])) {
        $where[] = '(ds.title LIKE :q OR ds.document_type LIKE :q)';
        $params[':q'] = '%' . trim($filters['q']) . '%';
    }

    if (!empty($filters['from'])) {
        $where[] = 'ds.submitted_at >= :from';
        $params[':from'] = $filters['from'];
    }
    if (!empty($filters['to'])) {
        $where[] = 'ds.submitted_at <= :to';
        $params[':to'] = $filters['to'];
    }

    $sql = "SELECT ds.*,
                   o.org_name,
                   u.first_name AS submitted_by_first_name,
                   u.last_name AS submitted_by_last_name
            FROM document_submissions ds
            JOIN organizations o ON o.org_id = ds.org_id
            LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
            " . (count($where) ? 'WHERE ' . implode(' AND ', $where) : '') . "
            ORDER BY ds.submitted_at DESC, ds.submission_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['submission_id'] = (int)$r['submission_id'];
        $r['org_id']        = (int)$r['org_id'];
        $r['submitted_by_user_id'] = (int)$r['submitted_by_user_id'];
        $r['reviewed_by_user_id']  = $r['reviewed_by_user_id'] !== null ? (int)$r['reviewed_by_user_id'] : null;
    }
    return $rows;
}

function docReviewSubmission(PDO $pdo, int $submissionId, int $reviewerId, string $decision, ?string $notes = null): array
{
    $decision = strtolower(trim($decision));
    if (!in_array($decision, ['approved', 'rejected'], true)) {
        throw new DocumentValidationException('decision must be approved or rejected');
    }
    $notes = $notes !== null ? trim($notes) : null;

    $stmt = $pdo->prepare(
        "UPDATE document_submissions
         SET status = :status,
             reviewer_notes = :notes,
             reviewed_by_user_id = :uid,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = :id"
    );
    $stmt->execute([
        ':status' => $decision,
        ':notes'  => $notes,
        ':uid'    => $reviewerId,
        ':id'     => $submissionId,
    ]);

    return docFetchSubmission($pdo, $submissionId);
}

function docListRepository(PDO $pdo, array $filters = [], ?int $orgScope = null): array
{
    $where  = [];
    $params = [];
    if ($orgScope !== null) {
        $where[] = 'da.org_id = :org';
        $params[':org'] = $orgScope;
    }
    if (!empty($filters['document_type']) && $filters['document_type'] !== 'All') {
        $where[] = 'da.document_type = :dtype';
        $params[':dtype'] = $filters['document_type'];
    }
    if (!empty($filters['semester']) && $filters['semester'] !== 'all') {
        $where[] = 'da.semester = :sem';
        $params[':sem'] = $filters['semester'];
    }
    if (!empty($filters['academic_year'])) {
        $where[] = 'da.academic_year = :ay';
        $params[':ay'] = $filters['academic_year'];
    }
    if (!empty($filters['from'])) {
        $where[] = 'da.approved_at >= :from';
        $params[':from'] = $filters['from'];
    }
    if (!empty($filters['to'])) {
        $where[] = 'da.approved_at <= :to';
        $params[':to'] = $filters['to'];
    }
    if (!empty($filters['q'])) {
        $where[] = '(da.title LIKE :q OR da.document_type LIKE :q)';
        $params[':q'] = '%' . trim($filters['q']) . '%';
    }

    $sql = "SELECT da.*, o.org_name
            FROM documents_approved da
            JOIN organizations o ON o.org_id = da.org_id
            " . (count($where) ? 'WHERE ' . implode(' AND ', $where) : '') . "
            ORDER BY da.approved_at DESC, da.repo_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['repo_id'] = (int)$r['repo_id'];
        $r['submission_id'] = (int)$r['submission_id'];
        $r['org_id'] = (int)$r['org_id'];
        $r['approved_by_user_id'] = (int)$r['approved_by_user_id'];
    }
    return $rows;
}

function docListOsaRequestOverview(PDO $pdo, array $filters = []): array
{
    $where = [];
    $params = [];

    if (!empty($filters['status']) && $filters['status'] !== 'all') {
        $where[] = 'ds.status = :status';
        $params[':status'] = $filters['status'];
    }

    if (!empty($filters['q'])) {
        $where[] = '(ds.title LIKE :q OR ds.document_type LIKE :q OR o.org_name LIKE :q)';
        $params[':q'] = '%' . trim((string)$filters['q']) . '%';
    }

    if (!empty($filters['from'])) {
        $where[] = 'ds.submitted_at >= :from';
        $params[':from'] = $filters['from'];
    }

    if (!empty($filters['to'])) {
        $where[] = 'ds.submitted_at <= :to';
        $params[':to'] = $filters['to'];
    }

    $sql = "SELECT ds.submission_id,
                   ds.org_id,
                   ds.submitted_by_user_id,
                   ds.reviewed_by_user_id,
                   ds.title,
                   ds.description,
                   ds.document_type,
                   ds.file_url,
                   ds.recipient,
                   ds.status,
                   ds.reviewer_notes,
                   ds.semester,
                   ds.academic_year,
                   ds.submitted_at,
                   ds.reviewed_at,
                   ds.created_at,
                   ds.updated_at,
                   o.org_name,
                   u.first_name AS submitted_by_first_name,
                   u.last_name AS submitted_by_last_name,
                   da.repo_id,
                   da.approved_at,
                   COALESCE(ann.annotation_count, 0) AS annotation_count,
                   ann.latest_annotation_at
            FROM document_submissions ds
            JOIN organizations o ON o.org_id = ds.org_id
            LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
            LEFT JOIN documents_approved da ON da.submission_id = ds.submission_id
            LEFT JOIN (
                SELECT submission_id,
                       COUNT(*) AS annotation_count,
                       MAX(created_at) AS latest_annotation_at
                FROM document_annotations
                GROUP BY submission_id
            ) ann ON ann.submission_id = ds.submission_id
            " . (count($where) ? 'WHERE ' . implode(' AND ', $where) : '') . "
            ORDER BY ds.submitted_at DESC, ds.submission_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['submission_id'] = (int)$row['submission_id'];
        $row['org_id'] = (int)$row['org_id'];
        $row['submitted_by_user_id'] = (int)$row['submitted_by_user_id'];
        $row['reviewed_by_user_id'] = $row['reviewed_by_user_id'] !== null ? (int)$row['reviewed_by_user_id'] : null;
        $row['repo_id'] = $row['repo_id'] !== null ? (int)$row['repo_id'] : null;
        $row['annotation_count'] = (int)$row['annotation_count'];
    }

    return $rows;
}

function docResolveSubmissionAccess(PDO $pdo, int $submissionId, array $session): ?array
{
    $stmt = $pdo->prepare(
        "SELECT ds.submission_id, ds.org_id
         FROM document_submissions ds
         WHERE ds.submission_id = :id
         LIMIT 1"
    );
    $stmt->execute([':id' => $submissionId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $isOsa = (($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff');
    if ($isOsa) return $row;

    if (($session['login_role'] ?? '') !== 'org') return null;
    $activeOrgId = (int)($session['active_org_id'] ?? 0);
    if ($activeOrgId <= 0 || $activeOrgId !== (int)$row['org_id']) return null;

    return $row;
}

function docListAnnotations(PDO $pdo, int $submissionId, array $session): array
{
    $access = docResolveSubmissionAccess($pdo, $submissionId, $session);
    if (!$access) {
        throw new DocumentAuthorizationException('No access to this submission.');
    }

    $stmt = $pdo->prepare(
        "SELECT a.annotation_id,
                a.submission_id,
                a.page_number,
                a.selected_text,
                a.rects_json,
                a.comment_text,
                a.created_by_user_id,
                a.created_at,
                a.updated_at,
                u.first_name,
                u.last_name
         FROM document_annotations a
         LEFT JOIN users u ON u.user_id = a.created_by_user_id
         WHERE a.submission_id = :sid
         ORDER BY a.created_at ASC, a.annotation_id ASC"
    );
    $stmt->execute([':sid' => $submissionId]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['annotation_id'] = (int)$row['annotation_id'];
        $row['submission_id'] = (int)$row['submission_id'];
        $row['page_number'] = (int)$row['page_number'];
        $row['created_by_user_id'] = (int)$row['created_by_user_id'];
    }

    return $rows;
}

function docCreateAnnotation(PDO $pdo, int $submissionId, int $userId, array $session, array $payload): array
{
    $access = docResolveSubmissionAccess($pdo, $submissionId, $session);
    if (!$access) {
        throw new DocumentAuthorizationException('No access to this submission.');
    }
    if ($userId <= 0) {
        throw new DocumentValidationException('Invalid user context.');
    }

    $page = (int)($payload['page'] ?? 0);
    $text = trim((string)($payload['text'] ?? ''));
    $rects = $payload['rects'] ?? null;
    $comment = trim((string)($payload['comment'] ?? ''));
    if ($page <= 0) {
        throw new DocumentValidationException('page is required.');
    }
    if ($text === '') {
        throw new DocumentValidationException('text is required.');
    }
    if (!is_array($rects) || count($rects) === 0) {
        throw new DocumentValidationException('rects is required.');
    }

    $rectsJson = json_encode($rects);
    if ($rectsJson === false) {
        throw new DocumentValidationException('rects must be JSON encodable.');
    }

    $insert = $pdo->prepare(
        "INSERT INTO document_annotations
         (submission_id, page_number, selected_text, rects_json, comment_text, created_by_user_id)
         VALUES
         (:sid, :page, :text, :rects, :comment, :uid)"
    );
    $insert->execute([
        ':sid' => $submissionId,
        ':page' => $page,
        ':text' => $text,
        ':rects' => $rectsJson,
        ':comment' => ($comment === '' ? null : $comment),
        ':uid' => $userId,
    ]);

    $id = (int)$pdo->lastInsertId();
    $fetch = $pdo->prepare(
        "SELECT a.annotation_id,
                a.submission_id,
                a.page_number,
                a.selected_text,
                a.rects_json,
                a.comment_text,
                a.created_by_user_id,
                a.created_at,
                a.updated_at,
                u.first_name,
                u.last_name
         FROM document_annotations a
         LEFT JOIN users u ON u.user_id = a.created_by_user_id
         WHERE a.annotation_id = :id
         LIMIT 1"
    );
    $fetch->execute([':id' => $id]);
    $row = $fetch->fetch();
    if (!$row) {
        throw new RuntimeException('Failed to load created annotation.');
    }

    $row['annotation_id'] = (int)$row['annotation_id'];
    $row['submission_id'] = (int)$row['submission_id'];
    $row['page_number'] = (int)$row['page_number'];
    $row['created_by_user_id'] = (int)$row['created_by_user_id'];
    return $row;
}

function docDeleteAnnotation(PDO $pdo, int $annotationId, int $userId, array $session): bool
{
    $stmt = $pdo->prepare(
        "SELECT annotation_id, submission_id, created_by_user_id
         FROM document_annotations
         WHERE annotation_id = :id
         LIMIT 1"
    );
    $stmt->execute([':id' => $annotationId]);
    $row = $stmt->fetch();
    if (!$row) {
        return false;
    }

    $access = docResolveSubmissionAccess($pdo, (int)$row['submission_id'], $session);
    if (!$access) {
        throw new DocumentAuthorizationException('No access to this submission.');
    }

    $isOsa = (($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff');
    if (!$isOsa && (int)$row['created_by_user_id'] !== $userId) {
        throw new DocumentAuthorizationException('Only the author can delete this annotation.');
    }

    $del = $pdo->prepare("DELETE FROM document_annotations WHERE annotation_id = :id");
    $del->execute([':id' => $annotationId]);
    return $del->rowCount() > 0;
}
