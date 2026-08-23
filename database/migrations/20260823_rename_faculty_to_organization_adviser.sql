-- Rename the initial adviser terminology on databases where the earlier
-- faculty-adviser migration was already applied.

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_account_type;

UPDATE users
SET account_type = 'organization_adviser'
WHERE account_type = 'faculty_adviser';

UPDATE pending_registrations
SET requested_role = 'organization_adviser',
    requested_position = 'Organization Adviser'
WHERE requested_role = 'faculty_adviser'
   OR LOWER(TRIM(COALESCE(requested_position, ''))) = 'faculty adviser';

UPDATE org_roles
SET role_name = 'organization_adviser'
WHERE role_name = 'faculty_adviser';

UPDATE organization_members
SET position_title = 'Organization Adviser'
WHERE LOWER(TRIM(COALESCE(position_title, ''))) = 'faculty adviser';

ALTER TABLE users
    ADD CONSTRAINT chk_users_account_type
    CHECK (account_type IN ('student', 'osa_staff', 'organization_adviser'));
