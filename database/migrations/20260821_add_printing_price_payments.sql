ALTER TABLE `print_jobs`
  ADD COLUMN IF NOT EXISTS `total_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `claimed_at`,
  ADD COLUMN IF NOT EXISTS `payment_status` VARCHAR(16) NULL DEFAULT NULL AFTER `total_cost`,
  ADD COLUMN IF NOT EXISTS `paid_at` DATETIME NULL DEFAULT NULL AFTER `payment_status`,
  ADD COLUMN IF NOT EXISTS `paid_by_user_id` INT NULL DEFAULT NULL AFTER `paid_at`;

UPDATE `print_jobs`
SET `paid_at` = CASE
    WHEN `status` = 'claimed' THEN COALESCE(`paid_at`, `claimed_at`)
    ELSE `paid_at`
  END,
  `payment_status` = CASE
    WHEN `status` = 'claimed' THEN 'paid'
    WHEN `status` = 'cancelled' THEN 'waived'
    ELSE 'unpaid'
  END
WHERE `payment_status` IS NULL OR `payment_status` = '';

ALTER TABLE `print_jobs`
  MODIFY COLUMN `payment_status` VARCHAR(16) NOT NULL DEFAULT 'unpaid',
  ADD KEY IF NOT EXISTS `idx_print_jobs_user_org_payment` (`user_id`, `org_id`, `status`, `payment_status`),
  ADD KEY IF NOT EXISTS `idx_print_jobs_paid_by` (`paid_by_user_id`);

SET @printing_paid_by_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'print_jobs'
    AND CONSTRAINT_NAME = 'fk_print_jobs_paid_by'
);
SET @printing_paid_by_fk_sql = IF(
  @printing_paid_by_fk_exists = 0,
  'ALTER TABLE `print_jobs` ADD CONSTRAINT `fk_print_jobs_paid_by` FOREIGN KEY (`paid_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE printing_paid_by_fk_stmt FROM @printing_paid_by_fk_sql;
EXECUTE printing_paid_by_fk_stmt;
DEALLOCATE PREPARE printing_paid_by_fk_stmt;
