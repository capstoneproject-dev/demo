-- Organization Adviser document review stage.
-- Existing submissions keep their current status and recipient.

ALTER TABLE org_roles
    ADD COLUMN IF NOT EXISTS can_review_org_documents TINYINT(1) NOT NULL DEFAULT 0
    AFTER can_manage_org_dashboard;

UPDATE org_roles
SET can_review_org_documents = CASE
    WHEN role_name = 'organization_adviser' THEN 1
    ELSE 0
END;

ALTER TABLE document_decisions
    MODIFY COLUMN review_stage ENUM('ADVISER','SSC','OSA') NOT NULL DEFAULT 'OSA';

SET @old_adviser_status_check := (
    SELECT COUNT(*) FROM information_schema.check_constraints
    WHERE constraint_schema = DATABASE()
      AND constraint_name = 'chk_doc_status'
      AND UPPER(check_clause) NOT LIKE '%ADVISER_PENDING%'
);
SET @drop_adviser_status_check_sql := IF(@old_adviser_status_check > 0,
    'ALTER TABLE document_submissions DROP CONSTRAINT chk_doc_status',
    'SELECT 1');
PREPARE adviser_review_stmt FROM @drop_adviser_status_check_sql;
EXECUTE adviser_review_stmt;
DEALLOCATE PREPARE adviser_review_stmt;

SET @adviser_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.check_constraints
    WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_doc_status'
);
SET @add_adviser_status_check_sql := IF(@adviser_status_check_exists = 0,
    'ALTER TABLE document_submissions ADD CONSTRAINT chk_doc_status CHECK (status IN (''adviser_pending'',''adviser_approved'',''pending'',''sent_to_osa'',''ssc_approved'',''approved'',''rejected'',''cancelled''))',
    'SELECT 1');
PREPARE adviser_review_stmt FROM @add_adviser_status_check_sql;
EXECUTE adviser_review_stmt;
DEALLOCATE PREPARE adviser_review_stmt;
