-- Match the annual roster import contract: only student number and name are required.
-- Safe to run again when these two columns are already nullable.
ALTER TABLE student_numbers
    MODIFY COLUMN program_id INT NULL,
    MODIFY COLUMN institute_id INT NULL;
