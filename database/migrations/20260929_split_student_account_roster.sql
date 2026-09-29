-- Before these pages were separated, Account Management displayed the roster's
-- year-section for every student, even when users.year_section was nonblank.
-- Copy that displayed value once; future account and roster edits stay separate.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS year_section VARCHAR(50) NULL;

-- The application also creates this settings table on first use. Ensure it
-- exists when migrations run before any application request on a fresh setup.
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_by_user_id INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

UPDATE users u
JOIN student_numbers sn ON sn.student_number = u.student_number
LEFT JOIN system_settings ss
    ON ss.setting_key = 'student_account_roster_year_section_backfilled'
SET u.year_section = sn.year_section
WHERE u.account_type = 'student'
  AND ss.setting_key IS NULL
  AND NOT (u.year_section <=> sn.year_section);

INSERT INTO system_settings (setting_key, setting_value)
SELECT 'student_account_roster_year_section_backfilled', '1'
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE setting_key = 'student_account_roster_year_section_backfilled'
);

COMMIT;
