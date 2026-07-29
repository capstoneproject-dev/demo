ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL AFTER published_at,
    ADD COLUMN IF NOT EXISTS archived_by_user_id INT NULL AFTER archived_at;

CREATE INDEX IF NOT EXISTS idx_announcements_org_archive_sort
    ON announcements (org_id, archived_at, published_at, announcement_id);

SET @announcement_archiver_fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'announcements'
      AND CONSTRAINT_NAME = 'fk_announce_archiver'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @announcement_archiver_fk_sql = IF(
    @announcement_archiver_fk_exists = 0,
    'ALTER TABLE announcements ADD CONSTRAINT fk_announce_archiver FOREIGN KEY (archived_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE announcement_archiver_fk_stmt FROM @announcement_archiver_fk_sql;
EXECUTE announcement_archiver_fk_stmt;
DEALLOCATE PREPARE announcement_archiver_fk_stmt;
