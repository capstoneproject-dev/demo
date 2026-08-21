ALTER TABLE events
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9) NULL AFTER is_published,
    ADD COLUMN IF NOT EXISTS semester ENUM('1st','2nd') NULL AFTER academic_year,
    ADD COLUMN IF NOT EXISTS grading_period ENUM('prelim','midterm','finals') NULL AFTER semester;

CREATE INDEX IF NOT EXISTS idx_events_org_academic_term
    ON events (org_id, academic_year, semester, grading_period, archived_at, event_datetime);

-- Runtime compatibility assigns legacy NULL rows to the OSA-controlled active
-- term. New event inserts always snapshot that active term.
