-- One attendance lifecycle per event and student.
-- Idempotent: consolidates legacy duplicates before adding the unique key.

UPDATE attendance_records
SET student_number = NULL
WHERE student_number IS NOT NULL
  AND TRIM(student_number) = '';

UPDATE attendance_records AS keep_row
JOIN (
    SELECT event_id,
           student_number,
           MIN(record_id) AS keep_id,
           MAX(user_id) AS resolved_user_id,
           MAX(NULLIF(student_name, '')) AS resolved_student_name,
           MAX(NULLIF(section, '')) AS resolved_section,
           MIN(time_in) AS first_time_in,
           MAX(time_out) AS last_time_out
    FROM attendance_records
    WHERE student_number IS NOT NULL
    GROUP BY event_id, student_number
    HAVING COUNT(*) > 1
) AS duplicates ON duplicates.keep_id = keep_row.record_id
SET keep_row.user_id = COALESCE(keep_row.user_id, duplicates.resolved_user_id),
    keep_row.student_name = COALESCE(NULLIF(keep_row.student_name, ''), duplicates.resolved_student_name),
    keep_row.section = COALESCE(NULLIF(keep_row.section, ''), duplicates.resolved_section),
    keep_row.time_in = COALESCE(duplicates.first_time_in, keep_row.time_in),
    keep_row.time_out = COALESCE(duplicates.last_time_out, keep_row.time_out);

DELETE duplicate_row
FROM attendance_records AS duplicate_row
JOIN (
    SELECT event_id, student_number, MIN(record_id) AS keep_id
    FROM attendance_records
    WHERE student_number IS NOT NULL
    GROUP BY event_id, student_number
    HAVING COUNT(*) > 1
) AS duplicates
  ON duplicates.event_id = duplicate_row.event_id
 AND duplicates.student_number = duplicate_row.student_number
 AND duplicate_row.record_id <> duplicates.keep_id;

SET @attendance_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'attendance_records'
      AND INDEX_NAME = 'uq_attendance_event_student'
);
SET @attendance_unique_sql = IF(
    @attendance_unique_exists = 0,
    'ALTER TABLE attendance_records ADD UNIQUE KEY uq_attendance_event_student (event_id, student_number)',
    'SELECT 1'
);
PREPARE attendance_unique_stmt FROM @attendance_unique_sql;
EXECUTE attendance_unique_stmt;
DEALLOCATE PREPARE attendance_unique_stmt;
