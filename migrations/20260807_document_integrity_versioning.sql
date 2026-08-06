-- Document decision integrity and revision history
-- Safe to run more than once on MariaDB 10.4+/MySQL 8.

CREATE TABLE IF NOT EXISTS `document_versions` (
  `version_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `submission_id` int(11) NOT NULL,
  `root_submission_id` int(11) NOT NULL,
  `parent_submission_id` int(11) DEFAULT NULL,
  `version_number` int(11) NOT NULL,
  `file_sha256` char(64) DEFAULT NULL,
  `created_by_user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`version_id`),
  UNIQUE KEY `uq_document_versions_submission` (`submission_id`),
  UNIQUE KEY `uq_document_versions_root_number` (`root_submission_id`,`version_number`),
  UNIQUE KEY `uq_document_versions_parent` (`parent_submission_id`),
  KEY `idx_document_versions_root` (`root_submission_id`),
  CONSTRAINT `fk_document_versions_submission` FOREIGN KEY (`submission_id`) REFERENCES `document_submissions` (`submission_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_document_versions_root` FOREIGN KEY (`root_submission_id`) REFERENCES `document_submissions` (`submission_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_document_versions_parent` FOREIGN KEY (`parent_submission_id`) REFERENCES `document_submissions` (`submission_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `document_decisions` (
  `decision_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `submission_id` int(11) NOT NULL,
  `decision` enum('approved','rejected') NOT NULL,
  `reviewer_notes` text DEFAULT NULL,
  `reviewed_by_user_id` int(11) NOT NULL,
  `reviewer_name` varchar(201) DEFAULT NULL,
  `reviewer_email` varchar(190) DEFAULT NULL,
  `file_sha256` char(64) DEFAULT NULL,
  `decided_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`decision_id`),
  UNIQUE KEY `uq_document_decisions_submission` (`submission_id`),
  KEY `idx_document_decisions_decided_at` (`decided_at`),
  CONSTRAINT `fk_document_decisions_submission` FOREIGN KEY (`submission_id`) REFERENCES `document_submissions` (`submission_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drop the previous protection set before idempotent backfill/normalization.
-- It is recreated at the end of this same migration.
DROP TRIGGER IF EXISTS `trg_doc_sub_to_repo`;
DROP TRIGGER IF EXISTS `trg_document_submissions_immutable`;
DROP TRIGGER IF EXISTS `trg_documents_approved_immutable_update`;
DROP TRIGGER IF EXISTS `trg_documents_approved_immutable_delete`;
DROP TRIGGER IF EXISTS `trg_document_decisions_immutable_update`;
DROP TRIGGER IF EXISTS `trg_document_decisions_immutable_delete`;

UPDATE `document_submissions`
SET `grading_period` = CASE
  WHEN MONTH(`submitted_at`) IN (6, 7, 12, 1) THEN 'prelim'
  WHEN MONTH(`submitted_at`) IN (8, 9, 2, 3) THEN 'midterm'
  ELSE 'finals'
END
WHERE `grading_period` IS NULL;

UPDATE `documents_approved`
SET `grading_period` = CASE
  WHEN MONTH(`approved_at`) IN (6, 7, 12, 1) THEN 'prelim'
  WHEN MONTH(`approved_at`) IN (8, 9, 2, 3) THEN 'midterm'
  ELSE 'finals'
END
WHERE `grading_period` IS NULL;

-- Existing submissions become version 1 of their own history. A legacy file hash
-- stays NULL because SQL cannot safely read application files; new versions use
-- a real SHA-256 calculated by PHP.
INSERT IGNORE INTO `document_versions`
  (`submission_id`, `root_submission_id`, `parent_submission_id`, `version_number`, `file_sha256`, `created_by_user_id`, `created_at`)
SELECT
  ds.`submission_id`, ds.`submission_id`, NULL, 1, NULL,
  ds.`submitted_by_user_id`, COALESCE(ds.`created_at`, ds.`submitted_at`, NOW())
FROM `document_submissions` ds;

-- Preserve finalized decisions that existed before this migration.
INSERT IGNORE INTO `document_decisions`
  (`submission_id`, `decision`, `reviewer_notes`, `reviewed_by_user_id`, `reviewer_name`, `reviewer_email`, `file_sha256`, `decided_at`)
SELECT
  ds.`submission_id`, ds.`status`, ds.`reviewer_notes`,
  COALESCE(ds.`reviewed_by_user_id`, ds.`submitted_by_user_id`),
  NULLIF(TRIM(CONCAT(COALESCE(u.`first_name`, ''), ' ', COALESCE(u.`last_name`, ''))), ''),
  u.`email`, dv.`file_sha256`, COALESCE(ds.`reviewed_at`, ds.`updated_at`, ds.`submitted_at`, NOW())
FROM `document_submissions` ds
LEFT JOIN `users` u ON u.`user_id` = COALESCE(ds.`reviewed_by_user_id`, ds.`submitted_by_user_id`)
LEFT JOIN `document_versions` dv ON dv.`submission_id` = ds.`submission_id`
WHERE ds.`status` IN ('approved', 'rejected');

-- The application now inserts approved snapshots in the same transaction as
-- the decision. Remove the old upsert trigger which made snapshots mutable.
DELIMITER $$
CREATE TRIGGER `trg_document_submissions_immutable`
BEFORE UPDATE ON `document_submissions`
FOR EACH ROW
BEGIN
  IF OLD.`status` IN ('approved', 'rejected') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Finalized document submissions are immutable; submit a revision instead';
  END IF;
END$$

CREATE TRIGGER `trg_documents_approved_immutable_update`
BEFORE UPDATE ON `documents_approved`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approved document snapshots are immutable';
END$$

CREATE TRIGGER `trg_documents_approved_immutable_delete`
BEFORE DELETE ON `documents_approved`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approved document snapshots cannot be deleted';
END$$

CREATE TRIGGER `trg_document_decisions_immutable_update`
BEFORE UPDATE ON `document_decisions`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document decisions are append-only';
END$$

CREATE TRIGGER `trg_document_decisions_immutable_delete`
BEFORE DELETE ON `document_decisions`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document decisions are append-only';
END$$
DELIMITER ;
