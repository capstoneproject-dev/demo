ALTER TABLE `student_email_notification_preferences`
  ADD COLUMN IF NOT EXISTS `printing_enabled` tinyint(1) NOT NULL DEFAULT 1
  AFTER `attendance_enabled`;

ALTER TABLE `print_jobs`
  ADD COLUMN IF NOT EXISTS `provider_accepted_at` datetime DEFAULT NULL
  AFTER `provider_auto_assigned`;

ALTER TABLE `notification_email_dispatch_state`
  ADD COLUMN IF NOT EXISTS `printing_activated_at` datetime DEFAULT NULL
  AFTER `activated_at`;

UPDATE `notification_email_dispatch_state`
SET `printing_activated_at` = CURRENT_TIMESTAMP
WHERE `state_id` = 1
  AND `printing_activated_at` IS NULL;
