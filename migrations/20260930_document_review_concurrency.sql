-- Apply once during deployment, before serving document requests.
-- Moves the former request-time document schema updates out of PHP transactions.
-- Alters existing tables only; no new tables are created.

ALTER TABLE document_submissions
    ADD COLUMN IF NOT EXISTS grading_period ENUM('prelim','midterm','finals') DEFAULT NULL AFTER academic_year,
    ADD COLUMN IF NOT EXISTS custom_document_type VARCHAR(100) DEFAULT NULL AFTER document_type,
    ADD COLUMN IF NOT EXISTS forwarded_at DATETIME DEFAULT NULL AFTER reviewed_at,
    ADD COLUMN IF NOT EXISTS forwarded_by_user_id INT DEFAULT NULL AFTER forwarded_at,
    ADD COLUMN IF NOT EXISTS cancelled_at DATETIME DEFAULT NULL AFTER forwarded_by_user_id,
    ADD COLUMN IF NOT EXISTS cancelled_by_user_id INT DEFAULT NULL AFTER cancelled_at;

ALTER TABLE documents_approved
    ADD COLUMN IF NOT EXISTS grading_period ENUM('prelim','midterm','finals') DEFAULT NULL AFTER academic_year,
    ADD COLUMN IF NOT EXISTS custom_document_type VARCHAR(100) DEFAULT NULL AFTER document_type;

ALTER TABLE document_decisions
    ADD COLUMN IF NOT EXISTS review_stage ENUM('ADVISER','SSC','OSA') NOT NULL DEFAULT 'OSA' AFTER submission_id,
    MODIFY COLUMN review_stage ENUM('ADVISER','SSC','OSA') NOT NULL DEFAULT 'OSA';

-- A pre-stage decision was uniquely keyed by submission alone. Preserve its
-- SSC stage before replacing that key with one decision per submission/stage.
-- The current recipient alone is insufficient: an SSC approval can already
-- have been forwarded to OSA. Use its audit action or the reviewer's SSC
-- membership. Repeat this repair even if an earlier run removed the old key.
SET @legacy_decision_key := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'document_decisions'
      AND index_name = 'uq_document_decisions_submission'
);
-- Temporarily remove the immutable-update trigger for this historical repair.
DROP TRIGGER IF EXISTS trg_document_decisions_immutable_update;
UPDATE document_decisions dd
JOIN document_submissions ds ON ds.submission_id = dd.submission_id
JOIN users reviewer ON reviewer.user_id = dd.reviewed_by_user_id
SET dd.review_stage = 'SSC'
WHERE dd.review_stage = 'OSA'
  AND (
      EXISTS (
          SELECT 1 FROM audit_logs al
          WHERE al.target_type = 'document_submission'
            AND al.target_id = CAST(dd.submission_id AS CHAR)
            AND al.actor_user_id = dd.reviewed_by_user_id
            AND al.action = CONCAT('document_ssc_', dd.decision)
            AND al.created_at BETWEEN dd.decided_at AND dd.decided_at + INTERVAL 1 MINUTE
      )
      OR (
          reviewer.account_type <> 'osa_staff'
          AND (
              UPPER(TRIM(ds.recipient)) = 'SSC'
              OR EXISTS (
                  SELECT 1 FROM organization_members om
                  JOIN organizations o ON o.org_id = om.org_id
                  WHERE om.user_id = dd.reviewed_by_user_id
                    AND (UPPER(TRIM(COALESCE(o.org_code, ''))) = 'SSC'
                         OR UPPER(TRIM(o.org_name)) = 'SUPREME STUDENT COUNCIL')
              )
          )
      )
  );

SET @new_decision_key := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'document_decisions'
      AND index_name = 'uq_document_decisions_submission_stage'
);
SET @add_decision_key := IF(@new_decision_key = 0,
    'ALTER TABLE document_decisions ADD UNIQUE KEY uq_document_decisions_submission_stage (submission_id, review_stage)',
    'SELECT 1');
PREPARE document_review_stmt FROM @add_decision_key;
EXECUTE document_review_stmt;
DEALLOCATE PREPARE document_review_stmt;

SET @drop_legacy_key := IF(@legacy_decision_key > 0,
    'ALTER TABLE document_decisions DROP INDEX uq_document_decisions_submission',
    'SELECT 1');
PREPARE document_review_stmt FROM @drop_legacy_key;
EXECUTE document_review_stmt;
DEALLOCATE PREPARE document_review_stmt;

DROP TRIGGER IF EXISTS trg_document_decisions_immutable_update;
DELIMITER $$
CREATE TRIGGER trg_document_decisions_immutable_update
BEFORE UPDATE ON document_decisions
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document decisions are append-only';
END$$
DELIMITER ;

SET @workflow_queue_key := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'document_submissions'
      AND index_name = 'idx_document_workflow_queue'
);
SET @add_workflow_queue_key := IF(@workflow_queue_key = 0,
    'ALTER TABLE document_submissions ADD KEY idx_document_workflow_queue (recipient, status, submitted_at)',
    'SELECT 1');
PREPARE document_review_stmt FROM @add_workflow_queue_key;
EXECUTE document_review_stmt;
DEALLOCATE PREPARE document_review_stmt;

SET @outdated_status_check := (
    SELECT COUNT(*) FROM information_schema.check_constraints
    WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_doc_status'
      AND (UPPER(check_clause) NOT LIKE '%ADVISER_PENDING%'
           OR UPPER(check_clause) NOT LIKE '%CANCELLED%')
);
SET @drop_outdated_status_check := IF(@outdated_status_check > 0,
    'ALTER TABLE document_submissions DROP CONSTRAINT chk_doc_status', 'SELECT 1');
PREPARE document_review_stmt FROM @drop_outdated_status_check;
EXECUTE document_review_stmt;
DEALLOCATE PREPARE document_review_stmt;

SET @status_check_exists := (
    SELECT COUNT(*) FROM information_schema.check_constraints
    WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_doc_status'
);
SET @add_status_check := IF(@status_check_exists = 0,
    "ALTER TABLE document_submissions ADD CONSTRAINT chk_doc_status CHECK (status IN ('adviser_pending','adviser_approved','pending','sent_to_osa','ssc_approved','approved','rejected','cancelled'))",
    'SELECT 1');
PREPARE document_review_stmt FROM @add_status_check;
EXECUTE document_review_stmt;
DEALLOCATE PREPARE document_review_stmt;

UPDATE document_submissions
SET grading_period = CASE
    WHEN MONTH(submitted_at) IN (6, 7, 12, 1) THEN 'prelim'
    WHEN MONTH(submitted_at) IN (8, 9, 2, 3) THEN 'midterm'
    ELSE 'finals'
END
WHERE grading_period IS NULL;

UPDATE documents_approved
SET grading_period = CASE
    WHEN MONTH(approved_at) IN (6, 7, 12, 1) THEN 'prelim'
    WHEN MONTH(approved_at) IN (8, 9, 2, 3) THEN 'midterm'
    ELSE 'finals'
END
WHERE grading_period IS NULL;
