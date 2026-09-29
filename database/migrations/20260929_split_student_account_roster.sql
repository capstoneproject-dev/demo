-- Before these pages were separated, Account Management displayed the roster's
-- year-section for every student, even when users.year_section was nonblank.
-- Copy that displayed value once; future account and roster edits stay separate.
-- Run after the application has initialized its existing system_settings table.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS year_section VARCHAR(50) NULL AFTER institute_id;

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
