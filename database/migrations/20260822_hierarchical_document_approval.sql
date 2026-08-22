-- Hierarchical SSC -> OSA document workflow (MariaDB/MySQL).
-- Existing direct-to-OSA and finalized SSC records are intentionally preserved.

ALTER TABLE `document_submissions`
  ADD COLUMN IF NOT EXISTS `forwarded_at` datetime DEFAULT NULL AFTER `reviewed_at`,
  ADD COLUMN IF NOT EXISTS `forwarded_by_user_id` int(11) DEFAULT NULL AFTER `forwarded_at`,
  ADD COLUMN IF NOT EXISTS `cancelled_at` datetime DEFAULT NULL AFTER `forwarded_by_user_id`,
  ADD COLUMN IF NOT EXISTS `cancelled_by_user_id` int(11) DEFAULT NULL AFTER `cancelled_at`;

ALTER TABLE `document_decisions`
  ADD COLUMN IF NOT EXISTS `review_stage` enum('SSC','OSA') NOT NULL DEFAULT 'OSA' AFTER `submission_id`;

DROP TRIGGER IF EXISTS `trg_document_decisions_immutable_update`;
UPDATE `document_decisions` dd
JOIN `document_submissions` ds ON ds.`submission_id` = dd.`submission_id`
SET dd.`review_stage` = 'SSC'
WHERE dd.`review_stage` = 'OSA' AND UPPER(TRIM(ds.`recipient`)) = 'SSC';

CREATE UNIQUE INDEX IF NOT EXISTS `uq_document_decisions_submission_stage`
  ON `document_decisions` (`submission_id`, `review_stage`);
DROP INDEX IF EXISTS `uq_document_decisions_submission` ON `document_decisions`;
CREATE INDEX IF NOT EXISTS `idx_document_workflow_queue`
  ON `document_submissions` (`recipient`, `status`, `submitted_at`);
CREATE INDEX IF NOT EXISTS `idx_document_forwarded_by`
  ON `document_submissions` (`forwarded_by_user_id`);
CREATE INDEX IF NOT EXISTS `idx_document_cancelled_by`
  ON `document_submissions` (`cancelled_by_user_id`);

SET @old_status_check := (
  SELECT COUNT(*) FROM information_schema.check_constraints
  WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_doc_status'
    AND UPPER(check_clause) NOT LIKE '%CANCELLED%'
);
SET @drop_status_check_sql := IF(@old_status_check > 0,
  'ALTER TABLE `document_submissions` DROP CONSTRAINT `chk_doc_status`',
  'SELECT 1');
PREPARE hierarchy_stmt FROM @drop_status_check_sql;
EXECUTE hierarchy_stmt;
DEALLOCATE PREPARE hierarchy_stmt;

SET @status_check_exists := (
  SELECT COUNT(*) FROM information_schema.check_constraints
  WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_doc_status'
);
SET @add_status_check_sql := IF(@status_check_exists = 0,
  'ALTER TABLE `document_submissions` ADD CONSTRAINT `chk_doc_status` CHECK (`status` IN (''pending'',''sent_to_osa'',''ssc_approved'',''approved'',''rejected'',''cancelled''))',
  'SELECT 1');
PREPARE hierarchy_stmt FROM @add_status_check_sql;
EXECUTE hierarchy_stmt;
DEALLOCATE PREPARE hierarchy_stmt;

SET @fk_forwarded_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE() AND table_name = 'document_submissions'
    AND constraint_name = 'fk_document_forwarded_by'
);
SET @fk_forwarded_sql := IF(@fk_forwarded_exists = 0,
  'ALTER TABLE `document_submissions` ADD CONSTRAINT `fk_document_forwarded_by` FOREIGN KEY (`forwarded_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE hierarchy_stmt FROM @fk_forwarded_sql;
EXECUTE hierarchy_stmt;
DEALLOCATE PREPARE hierarchy_stmt;

SET @fk_cancelled_exists := (
  SELECT COUNT(*) FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE() AND table_name = 'document_submissions'
    AND constraint_name = 'fk_document_cancelled_by'
);
SET @fk_cancelled_sql := IF(@fk_cancelled_exists = 0,
  'ALTER TABLE `document_submissions` ADD CONSTRAINT `fk_document_cancelled_by` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE hierarchy_stmt FROM @fk_cancelled_sql;
EXECUTE hierarchy_stmt;
DEALLOCATE PREPARE hierarchy_stmt;

DROP TRIGGER IF EXISTS `trg_document_submissions_immutable`;
DROP TRIGGER IF EXISTS `trg_document_decisions_immutable_update`;
DELIMITER $$
CREATE TRIGGER `trg_document_submissions_immutable`
BEFORE UPDATE ON `document_submissions`
FOR EACH ROW
BEGIN
  IF OLD.`status` IN ('approved', 'rejected', 'cancelled') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Finalized document submissions are immutable; submit a new version instead';
  END IF;
END$$
CREATE TRIGGER `trg_document_decisions_immutable_update`
BEFORE UPDATE ON `document_decisions`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document decisions are append-only';
END$$
DELIMITER ;
