ALTER TABLE student_numbers
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9) NULL AFTER year_section;

SET @academic_year_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_numbers'
      AND INDEX_NAME = 'idx_student_numbers_academic_year'
);

SET @academic_year_index_sql = IF(
    @academic_year_index_exists = 0,
    'ALTER TABLE student_numbers ADD INDEX idx_student_numbers_academic_year (academic_year)',
    'SELECT 1'
);
PREPARE academic_year_index_statement FROM @academic_year_index_sql;
EXECUTE academic_year_index_statement;
DEALLOCATE PREPARE academic_year_index_statement;
