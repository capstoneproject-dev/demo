ALTER TABLE `document_submissions`
  ADD COLUMN IF NOT EXISTS `custom_document_type` VARCHAR(100) NULL AFTER `document_type`;

ALTER TABLE `documents_approved`
  ADD COLUMN IF NOT EXISTS `custom_document_type` VARCHAR(100) NULL AFTER `document_type`;
