CREATE TABLE IF NOT EXISTS `student_email_notification_preferences` (
  `user_id` int(11) NOT NULL,
  `rental_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `locker_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `attendance_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `printing_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_student_email_notification_preferences_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_email_dispatch_state` (
  `state_id` tinyint unsigned NOT NULL,
  `activated_at` datetime NOT NULL DEFAULT current_timestamp(),
  `printing_activated_at` datetime DEFAULT NULL,
  `last_run_at` datetime DEFAULT NULL,
  `last_run_status` varchar(20) DEFAULT NULL,
  `last_error_category` varchar(40) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`state_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `notification_email_dispatch_state`
  (`state_id`, `activated_at`, `printing_activated_at`, `last_run_status`)
VALUES
  (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ready');

CREATE TABLE IF NOT EXISTS `notification_email_deliveries` (
  `delivery_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `notification_id` varchar(191) NOT NULL,
  `source_type` varchar(24) NOT NULL,
  `source_id` int(11) NOT NULL,
  `notification_status` varchar(40) NOT NULL,
  `severity` varchar(20) NOT NULL,
  `recipient_name` varchar(200) DEFAULT NULL,
  `recipient_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `due_at` datetime DEFAULT NULL,
  `delivery_status` varchar(24) NOT NULL DEFAULT 'pending',
  `attempt_count` tinyint unsigned NOT NULL DEFAULT 0,
  `next_attempt_at` datetime DEFAULT NULL,
  `last_attempt_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `last_error_category` varchar(40) DEFAULT NULL,
  `last_error_message` varchar(255) DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`delivery_id`),
  UNIQUE KEY `uq_notification_email_delivery` (`user_id`, `notification_id`),
  KEY `idx_notification_email_delivery_queue` (`delivery_status`, `next_attempt_at`, `attempt_count`),
  KEY `idx_notification_email_delivery_org` (`org_id`, `delivery_status`, `updated_at`),
  CONSTRAINT `fk_notification_email_delivery_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notification_email_delivery_org`
    FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
