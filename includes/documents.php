<?php
/**
 * Document submission & repository domain services.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/system_settings.php';
require_once __DIR__ . '/private_pdf_storage.php';
require_once __DIR__ . '/audit.php';

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

function docShouldHideAdviserFeedback(array $session, int $documentOrgId): bool
{
    $isOsa = ($session['login_role'] ?? '') === 'osa'
        || ($session['account_type'] ?? '') === 'osa_staff';
    if ($isOsa) return true;

    return ($session['login_role'] ?? '') === 'org'
        && (int)($session['active_org_id'] ?? 0) !== $documentOrgId;
}

function docRedactExternalAdviserFeedback(array $row, array $session): array
{
    if (!docShouldHideAdviserFeedback($session, (int)($row['org_id'] ?? 0))) {
        return $row;
    }

    $row['adviser_reviewer_notes'] = null;
    if (
        isset($row['reviewed_by_user_id'], $row['adviser_reviewed_by_user_id'])
        && (int)$row['reviewed_by_user_id'] === (int)$row['adviser_reviewed_by_user_id']
    ) {
        $row['reviewer_notes'] = null;
    }
    return $row;
}

function docRedactExternalAdviserFeedbackList(array $rows, array $session): array
{
    return array_map(
        static fn(array $row): array => docRedactExternalAdviserFeedback($row, $session),
        $rows
    );
}

function docIsSscOrganization(PDO $pdo, int $orgId): bool
{
    static $cache = [];
    if ($orgId <= 0) return false;
    if (array_key_exists($orgId, $cache)) return $cache[$orgId];

    $stmt = $pdo->prepare(
        "SELECT 1
         FROM organizations
         WHERE org_id = :org_id
           AND (
                UPPER(TRIM(COALESCE(org_code, ''))) = 'SSC'
                OR UPPER(TRIM(org_name)) = 'SUPREME STUDENT COUNCIL'
           )
         LIMIT 1"
    );
    $stmt->execute([':org_id' => $orgId]);
    $cache[$orgId] = (bool)$stmt->fetchColumn();
    return $cache[$orgId];
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

function docValidateGradingPeriod(?string $period): ?string
{
    $period = $period ? trim($period) : null;
    if (!$period) return null;
    $period = strtolower($period);
    if (!in_array($period, ['prelim', 'midterm', 'finals'], true)) {
        throw new DocumentValidationException('grading_period must be prelim, midterm, or finals.');
    }
    return $period;
}

function docEnsureTermColumns(PDO $pdo): void
{
    static $ensured = false;
    if ($ensured) return;

    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS grading_period ENUM('prelim','midterm','finals') DEFAULT NULL AFTER academic_year");
    $pdo->exec("ALTER TABLE documents_approved ADD COLUMN IF NOT EXISTS grading_period ENUM('prelim','midterm','finals') DEFAULT NULL AFTER academic_year");
    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS custom_document_type VARCHAR(100) DEFAULT NULL AFTER document_type");
    $pdo->exec("ALTER TABLE documents_approved ADD COLUMN IF NOT EXISTS custom_document_type VARCHAR(100) DEFAULT NULL AFTER document_type");
    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS forwarded_at DATETIME DEFAULT NULL AFTER reviewed_at");
    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS forwarded_by_user_id INT DEFAULT NULL AFTER forwarded_at");
    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS cancelled_at DATETIME DEFAULT NULL AFTER forwarded_by_user_id");
    $pdo->exec("ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS cancelled_by_user_id INT DEFAULT NULL AFTER cancelled_at");
    $pdo->exec("ALTER TABLE document_decisions ADD COLUMN IF NOT EXISTS review_stage ENUM('ADVISER','SSC','OSA') NOT NULL DEFAULT 'OSA' AFTER submission_id");

    $reviewStageTypeStmt = $pdo->query(
        "SELECT COLUMN_TYPE FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'document_decisions'
           AND column_name = 'review_stage' LIMIT 1"
    );
    $reviewStageType = (string)$reviewStageTypeStmt->fetchColumn();
    if (stripos($reviewStageType, 'ADVISER') === false) {
        $pdo->exec("ALTER TABLE document_decisions MODIFY COLUMN review_stage ENUM('ADVISER','SSC','OSA') NOT NULL DEFAULT 'OSA'");
    }

    $schema = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();
    $indexStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = :schema AND table_name = :table_name AND index_name = :index_name"
    );
    $indexExists = static function (string $table, string $index) use ($indexStmt, $schema): bool {
        $indexStmt->execute([':schema' => $schema, ':table_name' => $table, ':index_name' => $index]);
        return (int)$indexStmt->fetchColumn() > 0;
    };
    $hasLegacyDecisionIndex = $indexExists('document_decisions', 'uq_document_decisions_submission');
    if ($hasLegacyDecisionIndex) {
        // The legacy table allowed only one decision. Its recipient identifies
        // whether that immutable historical decision belonged to SSC or OSA.
        $pdo->exec("DROP TRIGGER IF EXISTS trg_document_decisions_immutable_update");
        $pdo->exec(
            "UPDATE document_decisions dd
             JOIN document_submissions ds ON ds.submission_id = dd.submission_id
             SET dd.review_stage = 'SSC'
             WHERE dd.review_stage = 'OSA' AND UPPER(TRIM(ds.recipient)) = 'SSC'"
        );
        $pdo->exec(
            "CREATE TRIGGER trg_document_decisions_immutable_update
             BEFORE UPDATE ON document_decisions
             FOR EACH ROW
             SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document decisions are append-only'"
        );
    }
    if (!$indexExists('document_decisions', 'uq_document_decisions_submission_stage')) {
        $pdo->exec("ALTER TABLE document_decisions ADD UNIQUE KEY uq_document_decisions_submission_stage (submission_id, review_stage)");
    }
    if ($hasLegacyDecisionIndex) {
        $pdo->exec("ALTER TABLE document_decisions DROP INDEX uq_document_decisions_submission");
    }
    if (!$indexExists('document_submissions', 'idx_document_workflow_queue')) {
        $pdo->exec("ALTER TABLE document_submissions ADD KEY idx_document_workflow_queue (recipient, status, submitted_at)");
    }
    $checkStmt = $pdo->prepare(
        "SELECT check_clause FROM information_schema.check_constraints
         WHERE constraint_schema = :schema AND constraint_name = 'chk_doc_status'
         LIMIT 1"
    );
    $checkStmt->execute([':schema' => $schema]);
    $statusCheck = $checkStmt->fetchColumn();
    if (is_string($statusCheck)
        && (stripos($statusCheck, 'cancelled') === false || stripos($statusCheck, 'adviser_pending') === false)) {
        $pdo->exec("ALTER TABLE document_submissions DROP CONSTRAINT chk_doc_status");
        $pdo->exec(
            "ALTER TABLE document_submissions ADD CONSTRAINT chk_doc_status
             CHECK (status IN ('adviser_pending','adviser_approved','pending','sent_to_osa','ssc_approved','approved','rejected','cancelled'))"
        );
    }
    $pdo->exec("
        UPDATE document_submissions
        SET grading_period = CASE
            WHEN MONTH(submitted_at) IN (6, 7, 12, 1) THEN 'prelim'
            WHEN MONTH(submitted_at) IN (8, 9, 2, 3) THEN 'midterm'
            ELSE 'finals'
        END
        WHERE grading_period IS NULL
    ");
    $pdo->exec("
        UPDATE documents_approved
        SET grading_period = CASE
            WHEN MONTH(approved_at) IN (6, 7, 12, 1) THEN 'prelim'
            WHEN MONTH(approved_at) IN (8, 9, 2, 3) THEN 'midterm'
            ELSE 'finals'
        END
        WHERE grading_period IS NULL
    ");
    $ensured = true;
}

function docValidateType(string $type): string
{
    $type = trim($type);
    if ($type === '') {
        throw new DocumentValidationException('document_type is required.');
    }
    return $type;
}

function docHashStoredPdf(string $storageKey): string
{
    $path = privatePdfResolveStoredFile($storageKey, ['documents']);
    if (!$path || !is_file($path)) {
        throw new DocumentValidationException('The uploaded PDF could not be found in private storage.');
    }
    $hash = hash_file('sha256', $path);
    if (!is_string($hash) || strlen($hash) !== 64) {
        throw new RuntimeException('Could not calculate the document file fingerprint.');
    }
    return $hash;
}

function docCreateSubmission(PDO $pdo, int $orgId, int $userId, array $data): array
{
    docEnsureTermColumns($pdo);

    $title        = trim((string)($data['title'] ?? ''));
    $documentType = docValidateType((string)($data['document_type'] ?? ''));
    $customDocumentType = null;
    if (strcasecmp($documentType, 'Others') === 0) {
        $documentType = 'Others';
        $customDocumentType = trim((string)($data['custom_document_type'] ?? ''));
        if ($customDocumentType === '') {
            throw new DocumentValidationException('custom_document_type is required when document_type is Others.');
        }
        $customTypeLength = function_exists('mb_strlen') ? mb_strlen($customDocumentType) : strlen($customDocumentType);
        if ($customTypeLength > 100) {
            throw new DocumentValidationException('custom_document_type must be 100 characters or fewer.');
        }
    }
    // Every new submission starts with its own organization's adviser. Routing
    // to SSC/OSA is a later officer-only action after the adviser decision.
    $recipient = 'ADVISER';
    $description  = trim((string)($data['description'] ?? '')) ?: null;
    $fileUrl      = trim((string)($data['storage_key'] ?? ''));
    // Academic-term feature boundary: submissions use the active global term from system_settings.
    $activeTerm = settingsGetActiveAcademicTerm($pdo);
    $semester     = docValidateSemester($activeTerm['semester'] ?? null);
    $academicYear = docValidateAcademicYear($activeTerm['academic_year'] ?? null);
    $gradingPeriod = docValidateGradingPeriod($activeTerm['grading_period'] ?? null);

    if ($title === '')  throw new DocumentValidationException('title is required.');
    if ($fileUrl === '') throw new DocumentValidationException('A verified document upload is required.');
    try {
        $fileUrl = privatePdfNormalizeKey($fileUrl);
    } catch (RuntimeException $e) {
        throw new DocumentValidationException('A verified document upload is required.');
    }
    if ($orgId <= 0 || $userId <= 0) throw new DocumentValidationException('Invalid org/user context.');

    $fileHash = docHashStoredPdf($fileUrl);
    $revisionOf = max(0, (int)($data['revision_of_submission_id'] ?? 0));
    $ownsTransaction = !$pdo->inTransaction();

    try {
        if ($ownsTransaction) $pdo->beginTransaction();

        $rootSubmissionId = null;
        $versionNumber = 1;
        if ($revisionOf > 0) {
            $parentStmt = $pdo->prepare(
                "SELECT ds.submission_id, ds.org_id, ds.status, ds.recipient,
                        ds.document_type, ds.custom_document_type,
                        dv.root_submission_id, dv.version_number,
                        EXISTS(
                            SELECT 1 FROM document_versions child
                            WHERE child.parent_submission_id = ds.submission_id
                        ) AS has_newer_version
                 FROM document_submissions ds
                 JOIN document_versions dv ON dv.submission_id = ds.submission_id
                 WHERE ds.submission_id = :id
                 FOR UPDATE"
            );
            $parentStmt->execute([':id' => $revisionOf]);
            $parent = $parentStmt->fetch();
            if (!$parent || (int)$parent['org_id'] !== $orgId) {
                throw new DocumentAuthorizationException('The document being revised is not available to this organization.');
            }
            if (!in_array(strtolower((string)$parent['status']), ['approved', 'rejected'], true)) {
                throw new DocumentValidationException('Only a finalized document can be revised.');
            }
            if ((int)$parent['has_newer_version'] === 1) {
                throw new DocumentValidationException('A newer revision already exists for this document.');
            }
            $rootSubmissionId = (int)$parent['root_submission_id'];
            $versionNumber = (int)$parent['version_number'] + 1;
            $documentType = (string)$parent['document_type'];
            $customDocumentType = $parent['custom_document_type'] !== null
                ? (string)$parent['custom_document_type']
                : null;
        }

        $stmt = $pdo->prepare(
            "INSERT INTO document_submissions
             (org_id, submitted_by_user_id, title, document_type, custom_document_type, file_url, recipient, description, status, semester, academic_year, grading_period)
             VALUES (:org, :uid, :title, :type, :custom_type, :file, :recipient, :description, 'adviser_pending', :semester, :ay, :period)"
        );
        $stmt->execute([
            ':org'         => $orgId,
            ':uid'         => $userId,
            ':title'       => $title,
            ':type'        => $documentType,
            ':custom_type' => $customDocumentType,
            ':file'        => $fileUrl,
            ':recipient'   => $recipient,
            ':description' => $description,
            ':semester'    => $semester,
            ':ay'          => $academicYear,
            ':period'      => $gradingPeriod,
        ]);

        $id = (int)$pdo->lastInsertId();
        if ($rootSubmissionId === null) $rootSubmissionId = $id;
        $versionStmt = $pdo->prepare(
            "INSERT INTO document_versions
             (submission_id, root_submission_id, parent_submission_id, version_number, file_sha256, created_by_user_id)
             VALUES (:submission, :root, :parent, :version, :hash, :user)"
        );
        $versionStmt->execute([
            ':submission' => $id,
            ':root' => $rootSubmissionId,
            ':parent' => $revisionOf > 0 ? $revisionOf : null,
            ':version' => $versionNumber,
            ':hash' => $fileHash,
            ':user' => $userId,
        ]);

        $submission = docFetchSubmission($pdo, $id);
        if ($ownsTransaction) $pdo->commit();
        return $submission;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function docFetchSubmission(PDO $pdo, int $id): array
{
    docEnsureTermColumns($pdo);

    $stmt = $pdo->prepare(
        "SELECT ds.*, o.org_name,
                adviser_decision.decision AS adviser_decision,
                adviser_decision.reviewed_by_user_id AS adviser_reviewed_by_user_id,
                adviser_decision.reviewer_name AS adviser_reviewer_name,
                adviser_decision.reviewer_notes AS adviser_reviewer_notes,
                adviser_decision.decided_at AS adviser_reviewed_at,
                ssc_decision.decision AS ssc_decision,
                ssc_decision.reviewed_by_user_id AS ssc_reviewed_by_user_id,
                ssc_decision.reviewer_name AS ssc_reviewer_name,
                ssc_decision.reviewer_notes AS ssc_reviewer_notes,
                ssc_decision.decided_at AS ssc_reviewed_at,
                osa_decision.decision AS osa_decision,
                osa_decision.reviewed_by_user_id AS osa_reviewed_by_user_id,
                osa_decision.reviewer_name AS osa_reviewer_name,
                osa_decision.reviewer_notes AS osa_reviewer_notes,
                osa_decision.decided_at AS osa_reviewed_at,
                dv.root_submission_id, dv.parent_submission_id, dv.version_number, dv.file_sha256,
                EXISTS(SELECT 1 FROM document_versions child WHERE child.parent_submission_id = ds.submission_id) AS has_newer_version
         FROM document_submissions ds
         JOIN organizations o ON o.org_id = ds.org_id
         JOIN document_versions dv ON dv.submission_id = ds.submission_id
         LEFT JOIN document_decisions adviser_decision
           ON adviser_decision.submission_id = ds.submission_id AND adviser_decision.review_stage = 'ADVISER'
         LEFT JOIN document_decisions ssc_decision
           ON ssc_decision.submission_id = ds.submission_id AND ssc_decision.review_stage = 'SSC'
         LEFT JOIN document_decisions osa_decision
           ON osa_decision.submission_id = ds.submission_id AND osa_decision.review_stage = 'OSA'
         WHERE ds.submission_id = :id"
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('Submission not found.');
    $row['submission_id'] = (int)$row['submission_id'];
    $row['org_id']        = (int)$row['org_id'];
    $row['submitted_by_user_id'] = (int)$row['submitted_by_user_id'];
    $row['reviewed_by_user_id']  = $row['reviewed_by_user_id'] !== null ? (int)$row['reviewed_by_user_id'] : null;
    $row['adviser_reviewed_by_user_id'] = $row['adviser_reviewed_by_user_id'] !== null ? (int)$row['adviser_reviewed_by_user_id'] : null;
    $row['ssc_reviewed_by_user_id'] = $row['ssc_reviewed_by_user_id'] !== null ? (int)$row['ssc_reviewed_by_user_id'] : null;
    $row['osa_reviewed_by_user_id'] = $row['osa_reviewed_by_user_id'] !== null ? (int)$row['osa_reviewed_by_user_id'] : null;
    $row['forwarded_by_user_id'] = $row['forwarded_by_user_id'] !== null ? (int)$row['forwarded_by_user_id'] : null;
    $row['cancelled_by_user_id'] = $row['cancelled_by_user_id'] !== null ? (int)$row['cancelled_by_user_id'] : null;
    $row['root_submission_id'] = (int)$row['root_submission_id'];
    $row['parent_submission_id'] = $row['parent_submission_id'] !== null ? (int)$row['parent_submission_id'] : null;
    $row['version_number'] = (int)$row['version_number'];
    $row['has_newer_version'] = (bool)$row['has_newer_version'];
    return $row;
}

function docListSubmissions(PDO $pdo, array $filters = [], ?int $orgScope = null): array
{
    docEnsureTermColumns($pdo);

    $where  = [];
    $params = [];

    if ($orgScope !== null) {
        $where[] = docIsSscOrganization($pdo, $orgScope) && empty($filters['strict_org_scope'])
            ? "(ds.org_id = :org OR (
                    ds.status <> 'cancelled'
                    AND (
                        UPPER(TRIM(ds.recipient)) = 'SSC'
                        OR EXISTS (SELECT 1 FROM document_decisions visible_ssc
                                   WHERE visible_ssc.submission_id = ds.submission_id
                                     AND visible_ssc.review_stage = 'SSC')
                    )
                ))"
            : 'ds.org_id = :org';
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
    if (!empty($filters['osa_visible'])) {
        $where[] = "ds.status <> 'cancelled' AND (UPPER(TRIM(ds.recipient)) = 'OSA' OR ds.status = 'approved')";
    }

    if (!empty($filters['semester']) && $filters['semester'] !== 'all') {
        $where[] = 'ds.semester = :sem';
        $params[':sem'] = docValidateSemester($filters['semester']);
    }
    if (!empty($filters['academic_year'])) {
        $where[] = 'ds.academic_year = :ay';
        $params[':ay'] = docValidateAcademicYear($filters['academic_year']);
    }
    if (!empty($filters['grading_period']) && $filters['grading_period'] !== 'all') {
        $where[] = 'ds.grading_period = :period';
        $params[':period'] = docValidateGradingPeriod($filters['grading_period']);
    }

    if (!empty($filters['q'])) {
        $where[] = '(ds.title LIKE :q OR ds.document_type LIKE :q OR ds.custom_document_type LIKE :q)';
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
                   u.last_name AS submitted_by_last_name,
                   reviewer.first_name AS reviewer_first_name,
                   reviewer.last_name AS reviewer_last_name,
                   adviser_decision.decision AS adviser_decision,
                   adviser_decision.reviewed_by_user_id AS adviser_reviewed_by_user_id,
                   adviser_decision.reviewer_name AS adviser_reviewer_name,
                   adviser_decision.reviewer_notes AS adviser_reviewer_notes,
                   adviser_decision.decided_at AS adviser_reviewed_at,
                   ssc_decision.decision AS ssc_decision,
                   ssc_decision.reviewed_by_user_id AS ssc_reviewed_by_user_id,
                   ssc_decision.reviewer_name AS ssc_reviewer_name,
                   ssc_decision.reviewer_notes AS ssc_reviewer_notes,
                   ssc_decision.decided_at AS ssc_reviewed_at,
                   osa_decision.decision AS osa_decision,
                   osa_decision.reviewed_by_user_id AS osa_reviewed_by_user_id,
                   osa_decision.reviewer_name AS osa_reviewer_name,
                   osa_decision.reviewer_notes AS osa_reviewer_notes,
                   osa_decision.decided_at AS osa_reviewed_at,
                   dv.root_submission_id, dv.parent_submission_id, dv.version_number, dv.file_sha256,
                   EXISTS(SELECT 1 FROM document_versions child WHERE child.parent_submission_id = ds.submission_id) AS has_newer_version
            FROM document_submissions ds
            JOIN organizations o ON o.org_id = ds.org_id
            LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
            LEFT JOIN users reviewer ON reviewer.user_id = ds.reviewed_by_user_id
            JOIN document_versions dv ON dv.submission_id = ds.submission_id
            LEFT JOIN document_decisions adviser_decision
              ON adviser_decision.submission_id = ds.submission_id AND adviser_decision.review_stage = 'ADVISER'
            LEFT JOIN document_decisions ssc_decision
              ON ssc_decision.submission_id = ds.submission_id AND ssc_decision.review_stage = 'SSC'
            LEFT JOIN document_decisions osa_decision
              ON osa_decision.submission_id = ds.submission_id AND osa_decision.review_stage = 'OSA'
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
        $r['adviser_reviewed_by_user_id'] = $r['adviser_reviewed_by_user_id'] !== null ? (int)$r['adviser_reviewed_by_user_id'] : null;
        $r['ssc_reviewed_by_user_id'] = $r['ssc_reviewed_by_user_id'] !== null ? (int)$r['ssc_reviewed_by_user_id'] : null;
        $r['osa_reviewed_by_user_id'] = $r['osa_reviewed_by_user_id'] !== null ? (int)$r['osa_reviewed_by_user_id'] : null;
        $r['forwarded_by_user_id'] = $r['forwarded_by_user_id'] !== null ? (int)$r['forwarded_by_user_id'] : null;
        $r['cancelled_by_user_id'] = $r['cancelled_by_user_id'] !== null ? (int)$r['cancelled_by_user_id'] : null;
        $r['root_submission_id'] = (int)$r['root_submission_id'];
        $r['parent_submission_id'] = $r['parent_submission_id'] !== null ? (int)$r['parent_submission_id'] : null;
        $r['version_number'] = (int)$r['version_number'];
        $r['has_newer_version'] = (bool)$r['has_newer_version'];
        $r = privatePdfDecorateDocumentRow($r);
    }
    return $rows;
}

function docReviewSubmission(
    PDO $pdo,
    int $submissionId,
    int $reviewerId,
    string $decision,
    ?string $notes = null,
    ?string $requiredRecipient = null,
    ?int $disallowedReviewerOrgId = null,
    ?string $reviewStage = null,
    ?int $requiredSubmissionOrgId = null
): array
{
    docEnsureTermColumns($pdo);

    $decision = strtolower(trim($decision));
    if (!in_array($decision, ['approved', 'rejected'], true)) {
        throw new DocumentValidationException('decision must be approved or rejected');
    }
    $notes = $notes !== null ? trim($notes) : null;

    $ownsTransaction = !$pdo->inTransaction();
    try {
        if ($ownsTransaction) $pdo->beginTransaction();

        $lock = $pdo->prepare(
            "SELECT ds.*, dv.file_sha256
             FROM document_submissions ds
             JOIN document_versions dv ON dv.submission_id = ds.submission_id
             WHERE ds.submission_id = :id
             FOR UPDATE"
        );
        $lock->execute([':id' => $submissionId]);
        $before = $lock->fetch();
        if (!$before) throw new DocumentValidationException('Submission not found.');
        $stage = strtoupper(trim((string)($reviewStage ?: $requiredRecipient ?: $before['recipient'])));
        if (!in_array($stage, ['ADVISER', 'SSC', 'OSA'], true)) {
            throw new DocumentValidationException('Invalid document review stage.');
        }
        if ($requiredSubmissionOrgId !== null && (int)$before['org_id'] !== $requiredSubmissionOrgId) {
            throw new DocumentAuthorizationException('This document belongs to a different organization.');
        }
        if ($requiredRecipient !== null
            && strtoupper(trim((string)($before['recipient'] ?? ''))) !== strtoupper(trim($requiredRecipient))) {
            throw new DocumentAuthorizationException('This document is assigned to a different reviewing office.');
        }
        if ($disallowedReviewerOrgId !== null && (int)$before['org_id'] === $disallowedReviewerOrgId) {
            throw new DocumentAuthorizationException('An organization cannot review its own document.');
        }
        $currentStatus = strtolower((string)$before['status']);
        $allowedStatuses = match ($stage) {
            'ADVISER' => ['adviser_pending'],
            'SSC' => ['pending'],
            default => ['pending', 'sent_to_osa'],
        };
        if (!in_array($currentStatus, $allowedStatuses, true)) {
            throw new DocumentValidationException('This submission is not awaiting ' . $stage . ' review.');
        }

        $reviewerStmt = $pdo->prepare(
            "SELECT user_id, first_name, last_name, email, employee_number
             FROM users WHERE user_id = :id LIMIT 1"
        );
        $reviewerStmt->execute([':id' => $reviewerId]);
        $reviewer = $reviewerStmt->fetch();
        if (!$reviewer) throw new DocumentValidationException('Reviewer account not found.');

        if ($stage === 'ADVISER' && $decision === 'rejected' && ($notes === null || $notes === '')) {
            throw new DocumentValidationException('A rejection comment is required.');
        }
        $nextStatus = match (true) {
            $stage === 'ADVISER' && $decision === 'approved' => 'adviser_approved',
            $stage === 'SSC' && $decision === 'approved' => 'ssc_approved',
            default => $decision,
        };
        $statusPlaceholders = implode(',', array_fill(0, count($allowedStatuses), '?'));
        $stmt = $pdo->prepare(
            "UPDATE document_submissions
             SET status = ?,
                 reviewer_notes = ?,
                 reviewed_by_user_id = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = ? AND status IN ({$statusPlaceholders})"
        );
        $stmt->execute(array_merge([$nextStatus, $notes, $reviewerId, $submissionId], $allowedStatuses));
        if ($stmt->rowCount() !== 1) {
            throw new DocumentValidationException('This submission was already reviewed. Refresh and try again.');
        }

        $reviewerName = trim((string)$reviewer['first_name'] . ' ' . (string)$reviewer['last_name']) ?: null;
        $decisionStmt = $pdo->prepare(
            "INSERT INTO document_decisions
             (submission_id, review_stage, decision, reviewer_notes, reviewed_by_user_id, reviewer_name, reviewer_email, file_sha256, decided_at)
             VALUES (:submission, :stage, :decision, :notes, :reviewer, :name, :email, :hash, CURRENT_TIMESTAMP)"
        );
        $decisionStmt->execute([
            ':submission' => $submissionId,
            ':stage' => $stage,
            ':decision' => $decision,
            ':notes' => $notes,
            ':reviewer' => $reviewerId,
            ':name' => $reviewerName,
            ':email' => $reviewer['email'] ?? null,
            ':hash' => $before['file_sha256'] ?? null,
        ]);

        $submission = docFetchSubmission($pdo, $submissionId);
        if ($stage === 'OSA' && $decision === 'approved') docSyncApprovedRepository($pdo, $submission);

        $auditNewValues = [
            'status' => $nextStatus,
            'review_stage' => $stage,
            'version_number' => $submission['version_number'],
        ];
        if ($stage !== 'ADVISER') {
            $auditNewValues['reviewer_notes'] = $notes;
        }
        appendAuditLog(
            'document_' . strtolower($stage) . '_' . $decision,
            'document_submission',
            (string)$submissionId,
            $reviewer,
            null,
            ['status' => $currentStatus, 'review_stage' => $stage, 'version_number' => $submission['version_number']],
            $auditNewValues,
            'success',
            $pdo
        );

        if ($ownsTransaction) $pdo->commit();
        return $submission;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function docForwardSubmissionToSsc(PDO $pdo, int $submissionId, int $orgId, int $userId): array
{
    docEnsureTermColumns($pdo);
    $ownsTransaction = !$pdo->inTransaction();
    try {
        if ($ownsTransaction) $pdo->beginTransaction();
        $lock = $pdo->prepare(
            "SELECT ds.submission_id, ds.org_id, ds.status, ds.recipient, dv.version_number
             FROM document_submissions ds
             JOIN document_versions dv ON dv.submission_id = ds.submission_id
             WHERE ds.submission_id = :id FOR UPDATE"
        );
        $lock->execute([':id' => $submissionId]);
        $before = $lock->fetch();
        if (!$before) throw new DocumentValidationException('Submission not found.');
        if ((int)$before['org_id'] !== $orgId) {
            throw new DocumentAuthorizationException('Only the submitting organization can forward this document.');
        }
        if (docIsSscOrganization($pdo, $orgId)) {
            throw new DocumentValidationException('SSC documents are forwarded directly to OSA after adviser approval.');
        }
        if (strtolower((string)$before['status']) !== 'adviser_approved') {
            throw new DocumentValidationException('Only an adviser-approved document can be sent to SSC.');
        }
        $approvedStmt = $pdo->prepare(
            "SELECT 1 FROM document_decisions
             WHERE submission_id = :id AND review_stage = 'ADVISER' AND decision = 'approved' LIMIT 1"
        );
        $approvedStmt->execute([':id' => $submissionId]);
        if (!$approvedStmt->fetchColumn()) {
            throw new DocumentValidationException('The adviser approval record could not be verified.');
        }
        $update = $pdo->prepare(
            "UPDATE document_submissions
             SET recipient = 'SSC', status = 'pending', forwarded_at = CURRENT_TIMESTAMP,
                 forwarded_by_user_id = :user_id, updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = :id AND org_id = :org_id AND status = 'adviser_approved'"
        );
        $update->execute([':user_id' => $userId, ':id' => $submissionId, ':org_id' => $orgId]);
        if ($update->rowCount() !== 1) {
            throw new DocumentValidationException('This document changed before it could be forwarded. Refresh and try again.');
        }
        $actorStmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :id LIMIT 1");
        $actorStmt->execute([':id' => $userId]);
        $actor = $actorStmt->fetch() ?: ['user_id' => $userId];
        $submission = docFetchSubmission($pdo, $submissionId);
        appendAuditLog(
            'document_forwarded_to_ssc', 'document_submission', (string)$submissionId,
            $actor, null,
            ['status' => 'adviser_approved', 'recipient' => 'ADVISER', 'version_number' => (int)$before['version_number']],
            ['status' => 'pending', 'recipient' => 'SSC', 'version_number' => (int)$before['version_number']],
            'success', $pdo
        );
        if ($ownsTransaction) $pdo->commit();
        return $submission;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function docForwardSubmissionToOsa(PDO $pdo, int $submissionId, int $orgId, int $userId): array
{
    docEnsureTermColumns($pdo);
    $ownsTransaction = !$pdo->inTransaction();
    try {
        if ($ownsTransaction) $pdo->beginTransaction();

        $lock = $pdo->prepare(
            "SELECT ds.submission_id, ds.org_id, ds.status, ds.recipient, ds.submitted_by_user_id,
                    dv.version_number
             FROM document_submissions ds
             JOIN document_versions dv ON dv.submission_id = ds.submission_id
             WHERE ds.submission_id = :id
             FOR UPDATE"
        );
        $lock->execute([':id' => $submissionId]);
        $before = $lock->fetch();
        if (!$before) throw new DocumentValidationException('Submission not found.');
        if ((int)$before['org_id'] !== $orgId) {
            throw new DocumentAuthorizationException('Only the submitting organization can forward this document.');
        }
        $isSsc = docIsSscOrganization($pdo, $orgId);
        $requiredStatus = $isSsc ? 'adviser_approved' : 'ssc_approved';
        $requiredStage = $isSsc ? 'ADVISER' : 'SSC';
        if (strtolower((string)$before['status']) !== $requiredStatus) {
            throw new DocumentValidationException(
                $isSsc
                    ? 'Only an adviser-approved SSC document can be sent to OSA.'
                    : 'Only an SSC-approved document can be sent to OSA.'
            );
        }
        $approvedStmt = $pdo->prepare(
            "SELECT 1 FROM document_decisions
             WHERE submission_id = :id AND review_stage = :stage AND decision = 'approved'
             LIMIT 1"
        );
        $approvedStmt->execute([':id' => $submissionId, ':stage' => $requiredStage]);
        if (!$approvedStmt->fetchColumn()) {
            throw new DocumentValidationException(
                $isSsc
                    ? 'The adviser approval record could not be verified.'
                    : 'The SSC approval record could not be verified.'
            );
        }

        $update = $pdo->prepare(
            "UPDATE document_submissions
             SET recipient = 'OSA', status = 'sent_to_osa', forwarded_at = CURRENT_TIMESTAMP,
                 forwarded_by_user_id = :user_id, updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = :id AND org_id = :org_id AND status = :required_status"
        );
        $update->execute([
            ':user_id' => $userId,
            ':id' => $submissionId,
            ':org_id' => $orgId,
            ':required_status' => $requiredStatus,
        ]);
        if ($update->rowCount() !== 1) {
            throw new DocumentValidationException('This document changed before it could be forwarded. Refresh and try again.');
        }

        $actorStmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :id LIMIT 1");
        $actorStmt->execute([':id' => $userId]);
        $actor = $actorStmt->fetch() ?: ['user_id' => $userId];
        $submission = docFetchSubmission($pdo, $submissionId);
        appendAuditLog(
            'document_forwarded_to_osa', 'document_submission', (string)$submissionId,
            $actor, null,
            ['status' => $requiredStatus, 'recipient' => $isSsc ? 'ADVISER' : 'SSC', 'version_number' => (int)$before['version_number']],
            ['status' => 'sent_to_osa', 'recipient' => 'OSA', 'version_number' => (int)$before['version_number']],
            'success', $pdo
        );
        if ($ownsTransaction) $pdo->commit();
        return $submission;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function docCancelSubmission(PDO $pdo, int $submissionId, int $orgId, int $userId): array
{
    docEnsureTermColumns($pdo);
    $ownsTransaction = !$pdo->inTransaction();
    try {
        if ($ownsTransaction) $pdo->beginTransaction();
        $lock = $pdo->prepare(
            "SELECT ds.submission_id, ds.org_id, ds.status, ds.recipient, dv.version_number
             FROM document_submissions ds
             JOIN document_versions dv ON dv.submission_id = ds.submission_id
             WHERE ds.submission_id = :id
             FOR UPDATE"
        );
        $lock->execute([':id' => $submissionId]);
        $before = $lock->fetch();
        if (!$before) throw new DocumentValidationException('Submission not found.');
        if ((int)$before['org_id'] !== $orgId) {
            throw new DocumentAuthorizationException('Only the submitting organization can cancel this document.');
        }
        $currentStatus = strtolower((string)$before['status']);
        if (!in_array($currentStatus, ['adviser_pending', 'adviser_approved', 'pending', 'ssc_approved', 'sent_to_osa'], true)) {
            throw new DocumentValidationException('Only a document awaiting a final decision can be cancelled.');
        }

        $update = $pdo->prepare(
            "UPDATE document_submissions
             SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
                 cancelled_by_user_id = :user_id, updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = :id AND org_id = :org_id AND status = :status"
        );
        $update->execute([
            ':user_id' => $userId,
            ':id' => $submissionId,
            ':org_id' => $orgId,
            ':status' => $currentStatus,
        ]);
        if ($update->rowCount() !== 1) {
            throw new DocumentValidationException('This document received a decision before it could be cancelled. Refresh and try again.');
        }

        $actorStmt = $pdo->prepare("SELECT * FROM users WHERE user_id = :id LIMIT 1");
        $actorStmt->execute([':id' => $userId]);
        $actor = $actorStmt->fetch() ?: ['user_id' => $userId];
        $submission = docFetchSubmission($pdo, $submissionId);
        appendAuditLog(
            'document_cancelled', 'document_submission', (string)$submissionId,
            $actor, null,
            ['status' => $currentStatus, 'recipient' => $before['recipient'], 'version_number' => (int)$before['version_number']],
            ['status' => 'cancelled', 'recipient' => $before['recipient'], 'version_number' => (int)$before['version_number']],
            'success', $pdo
        );
        if ($ownsTransaction) $pdo->commit();
        return $submission;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function docSyncApprovedRepository(PDO $pdo, array $submission): void
{
    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO documents_approved
         (submission_id, org_id, approved_by_user_id, title, document_type, custom_document_type, file_url, description, semester, academic_year, grading_period, approved_at)
         VALUES (:sid, :org, :approver, :title, :type, :custom_type, :file, :description, :semester, :ay, :period, NOW())"
    );
    $stmt->execute([
        ':sid' => (int)$submission['submission_id'],
        ':org' => (int)$submission['org_id'],
        ':approver' => (int)($submission['reviewed_by_user_id'] ?? $submission['submitted_by_user_id']),
        ':title' => (string)$submission['title'],
        ':type' => (string)$submission['document_type'],
        ':custom_type' => $submission['custom_document_type'] ?? null,
        ':file' => (string)$submission['file_url'],
        ':description' => $submission['description'] ?? null,
        ':semester' => $submission['semester'] ?? null,
        ':ay' => $submission['academic_year'] ?? null,
        ':period' => $submission['grading_period'] ?? null,
    ]);
}

function docBackfillApprovedRepository(PDO $pdo, ?int $orgScope = null): void
{
    $where = ["ds.status = 'approved'", 'da.repo_id IS NULL'];
    $params = [];

    if ($orgScope !== null) {
        $where[] = 'ds.org_id = :org_scope';
        $params[':org_scope'] = $orgScope;
    }

    $sql = "
        INSERT INTO documents_approved
            (submission_id, org_id, approved_by_user_id, title, document_type, custom_document_type, file_url, description, semester, academic_year, grading_period, approved_at)
        SELECT
            ds.submission_id,
            ds.org_id,
            COALESCE(ds.reviewed_by_user_id, ds.submitted_by_user_id),
            ds.title,
            ds.document_type,
            ds.custom_document_type,
            ds.file_url,
            ds.description,
            ds.semester,
            ds.academic_year,
            ds.grading_period,
            COALESCE(ds.reviewed_at, ds.updated_at, ds.submitted_at, NOW())
        FROM document_submissions ds
        LEFT JOIN documents_approved da ON da.submission_id = ds.submission_id
        WHERE " . implode(' AND ', $where) . "
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function docListRepository(PDO $pdo, array $filters = [], ?int $orgScope = null): array
{
    docEnsureTermColumns($pdo);
    $isSscScope = $orgScope !== null && docIsSscOrganization($pdo, $orgScope);
    docBackfillApprovedRepository($pdo, $isSscScope ? null : $orgScope);

    $where  = [];
    $params = [];
    if ($orgScope !== null) {
        $where[] = $isSscScope
            ? "(da.org_id = :org OR UPPER(TRIM(ds.recipient)) = 'SSC')"
            : 'da.org_id = :org';
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
        $params[':ay'] = docValidateAcademicYear($filters['academic_year']);
    }
    if (!empty($filters['grading_period']) && $filters['grading_period'] !== 'all') {
        $where[] = 'da.grading_period = :period';
        $params[':period'] = docValidateGradingPeriod($filters['grading_period']);
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
        $where[] = '(da.title LIKE :q OR da.document_type LIKE :q OR da.custom_document_type LIKE :q)';
        $params[':q'] = '%' . trim($filters['q']) . '%';
    }

    $sql = "SELECT da.*, o.org_name, ds.recipient,
                   dv.root_submission_id, dv.parent_submission_id, dv.version_number, dv.file_sha256
            FROM documents_approved da
            JOIN organizations o ON o.org_id = da.org_id
            JOIN document_submissions ds ON ds.submission_id = da.submission_id
            JOIN document_versions dv ON dv.submission_id = da.submission_id
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
        $r['root_submission_id'] = (int)$r['root_submission_id'];
        $r['parent_submission_id'] = $r['parent_submission_id'] !== null ? (int)$r['parent_submission_id'] : null;
        $r['version_number'] = (int)$r['version_number'];
        $r = privatePdfDecorateDocumentRow($r);
    }
    return $rows;
}

function docListOsaRequestOverview(PDO $pdo, array $filters = []): array
{
    docEnsureTermColumns($pdo);

    $where = [];
    $params = [];
    $where[] = "ds.status <> 'cancelled'";

    if (!empty($filters['status']) && $filters['status'] !== 'all') {
        $where[] = 'ds.status = :status';
        $params[':status'] = $filters['status'];
    }

    if (!empty($filters['recipient'])) {
        $where[] = 'UPPER(TRIM(ds.recipient)) = :recipient';
        $params[':recipient'] = strtoupper(trim((string)$filters['recipient']));
    }

    if (!empty($filters['semester']) && $filters['semester'] !== 'all') {
        $where[] = 'ds.semester = :sem';
        $params[':sem'] = docValidateSemester($filters['semester']);
    }
    if (!empty($filters['academic_year'])) {
        $where[] = 'ds.academic_year = :ay';
        $params[':ay'] = docValidateAcademicYear($filters['academic_year']);
    }
    if (!empty($filters['grading_period']) && $filters['grading_period'] !== 'all') {
        $where[] = 'ds.grading_period = :period';
        $params[':period'] = docValidateGradingPeriod($filters['grading_period']);
    }

    if (!empty($filters['q'])) {
        $where[] = '(ds.title LIKE :q OR ds.document_type LIKE :q OR ds.custom_document_type LIKE :q OR o.org_name LIKE :q)';
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
                   ds.custom_document_type,
                   ds.file_url,
                   ds.recipient,
                   ds.status,
                   ds.reviewer_notes,
                   ds.semester,
                   ds.academic_year,
                   ds.grading_period,
                   ds.submitted_at,
                   ds.reviewed_at,
                   ds.created_at,
                   ds.updated_at,
                   ds.forwarded_at,
                   ds.forwarded_by_user_id,
                   ds.cancelled_at,
                   ds.cancelled_by_user_id,
                   o.org_name,
                   u.first_name AS submitted_by_first_name,
                   u.last_name AS submitted_by_last_name,
                   adviser_decision.decision AS adviser_decision,
                   adviser_decision.reviewed_by_user_id AS adviser_reviewed_by_user_id,
                   adviser_decision.reviewer_name AS adviser_reviewer_name,
                   adviser_decision.reviewer_notes AS adviser_reviewer_notes,
                   adviser_decision.decided_at AS adviser_reviewed_at,
                   ssc_decision.decision AS ssc_decision,
                   ssc_decision.reviewed_by_user_id AS ssc_reviewed_by_user_id,
                   ssc_decision.reviewer_name AS ssc_reviewer_name,
                   ssc_decision.reviewer_notes AS ssc_reviewer_notes,
                   ssc_decision.decided_at AS ssc_reviewed_at,
                   osa_decision.decision AS osa_decision,
                   osa_decision.reviewed_by_user_id AS osa_reviewed_by_user_id,
                   osa_decision.reviewer_name AS osa_reviewer_name,
                   osa_decision.reviewer_notes AS osa_reviewer_notes,
                   osa_decision.decided_at AS osa_reviewed_at,
                   da.repo_id,
                   da.approved_at,
                   dv.root_submission_id,
                   dv.parent_submission_id,
                   dv.version_number,
                   dv.file_sha256,
                   EXISTS(SELECT 1 FROM document_versions child WHERE child.parent_submission_id = ds.submission_id) AS has_newer_version,
                   COALESCE(ann.annotation_count, 0) AS annotation_count,
                   ann.latest_annotation_at
            FROM document_submissions ds
            JOIN organizations o ON o.org_id = ds.org_id
            LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
            LEFT JOIN document_decisions adviser_decision
              ON adviser_decision.submission_id = ds.submission_id AND adviser_decision.review_stage = 'ADVISER'
            LEFT JOIN document_decisions ssc_decision
              ON ssc_decision.submission_id = ds.submission_id AND ssc_decision.review_stage = 'SSC'
            LEFT JOIN document_decisions osa_decision
              ON osa_decision.submission_id = ds.submission_id AND osa_decision.review_stage = 'OSA'
            LEFT JOIN documents_approved da ON da.submission_id = ds.submission_id
            JOIN document_versions dv ON dv.submission_id = ds.submission_id
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
        $row['adviser_reviewed_by_user_id'] = $row['adviser_reviewed_by_user_id'] !== null ? (int)$row['adviser_reviewed_by_user_id'] : null;
        $row['ssc_reviewed_by_user_id'] = $row['ssc_reviewed_by_user_id'] !== null ? (int)$row['ssc_reviewed_by_user_id'] : null;
        $row['osa_reviewed_by_user_id'] = $row['osa_reviewed_by_user_id'] !== null ? (int)$row['osa_reviewed_by_user_id'] : null;
        $row['forwarded_by_user_id'] = $row['forwarded_by_user_id'] !== null ? (int)$row['forwarded_by_user_id'] : null;
        $row['cancelled_by_user_id'] = $row['cancelled_by_user_id'] !== null ? (int)$row['cancelled_by_user_id'] : null;
        $row['repo_id'] = $row['repo_id'] !== null ? (int)$row['repo_id'] : null;
        $row['root_submission_id'] = (int)$row['root_submission_id'];
        $row['parent_submission_id'] = $row['parent_submission_id'] !== null ? (int)$row['parent_submission_id'] : null;
        $row['version_number'] = (int)$row['version_number'];
        $row['has_newer_version'] = (bool)$row['has_newer_version'];
        $row['annotation_count'] = (int)$row['annotation_count'];
        $row = privatePdfDecorateDocumentRow($row);
    }

    return $rows;
}

function docResolveSubmissionAccess(PDO $pdo, int $submissionId, array $session): ?array
{
    $stmt = $pdo->prepare(
        "SELECT ds.submission_id, ds.org_id, ds.recipient, ds.status
         FROM document_submissions ds
         WHERE ds.submission_id = :id
         LIMIT 1"
    );
    $stmt->execute([':id' => $submissionId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $isOsa = (($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff');
    if ($isOsa) {
        return strtolower((string)$row['status']) !== 'cancelled'
            && (strtoupper(trim((string)$row['recipient'])) === 'OSA'
                || strtolower((string)$row['status']) === 'approved')
            ? $row
            : null;
    }

    if (($session['login_role'] ?? '') !== 'org') return null;
    $activeOrgId = (int)($session['active_org_id'] ?? 0);
    if ($activeOrgId <= 0) return null;
    if ($activeOrgId === (int)$row['org_id']) return $row;
    $isAdviserReviewer = strtolower(trim((string)($session['account_type'] ?? ''))) === 'organization_adviser'
        && !empty($session['can_review_org_documents'])
        && empty($session['can_manage_org_dashboard']);
    if ($isAdviserReviewer) return null;
    if (!docIsSscOrganization($pdo, $activeOrgId)) return null;
    if (strtolower((string)$row['status']) === 'cancelled') return null;

    $sscAccessStmt = $pdo->prepare(
        "SELECT 1 FROM document_decisions
         WHERE submission_id = :id AND review_stage = 'SSC'
         LIMIT 1"
    );
    $sscAccessStmt->execute([':id' => $submissionId]);
    if (strtoupper(trim((string)($row['recipient'] ?? ''))) !== 'SSC' && !$sscAccessStmt->fetchColumn()) return null;

    return $row;
}

function docListAnnotations(PDO $pdo, int $submissionId, array $session): array
{
    $access = docResolveSubmissionAccess($pdo, $submissionId, $session);
    if (!$access) {
        throw new DocumentAuthorizationException('No access to this submission.');
    }

    $hideAdviserFeedback = docShouldHideAdviserFeedback($session, (int)$access['org_id']);
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
           " . ($hideAdviserFeedback ? "AND COALESCE(u.account_type, '') <> 'organization_adviser'" : '') . "
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
