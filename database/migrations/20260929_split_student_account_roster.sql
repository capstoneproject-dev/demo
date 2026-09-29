-- Student accounts keep their own year-section. Preserve the values formerly
-- displayed through the student_numbers join before separating the two pages.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS year_section VARCHAR(50) NULL AFTER institute_id;

UPDATE users u
JOIN student_numbers sn ON sn.student_number = u.student_number
SET u.year_section = sn.year_section
WHERE u.account_type = 'student'
  AND (u.year_section IS NULL OR u.year_section = '')
  AND sn.year_section IS NOT NULL
  AND sn.year_section <> '';
