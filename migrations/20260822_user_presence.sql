-- Database-backed, per-session online presence.
-- Stale sessions are intentionally retained for diagnostics and ignored by
-- readers after the configured online window (currently 75 seconds).

CREATE TABLE IF NOT EXISTS `user_presence` (
  `session_hash` char(64) NOT NULL,
  `user_id` int(11) NOT NULL,
  `login_context` varchar(20) NOT NULL DEFAULT 'student',
  `logged_in_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`session_hash`),
  KEY `idx_user_presence_recent` (`last_seen_at`, `user_id`),
  KEY `idx_user_presence_user` (`user_id`),
  CONSTRAINT `fk_user_presence_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `user_presence`
  ADD COLUMN IF NOT EXISTS `login_context` varchar(20) NOT NULL DEFAULT 'student' AFTER `user_id`;
