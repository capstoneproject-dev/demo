-- OPTIONAL schema rollback only. Stop application writes and the email worker first.
-- Restore rollback/upload files before executing this in the correct database.
-- Keep a full database backup. This does not restore deleted waived requests.
DROP TRIGGER IF EXISTS print_number_insert;
DROP TRIGGER IF EXISTS print_number_update;
DROP TABLE IF EXISTS printing_number_counters;
ALTER TABLE print_jobs DROP INDEX IF EXISTS uq_print_org_reference;
ALTER TABLE print_jobs DROP COLUMN IF EXISTS request_number;
