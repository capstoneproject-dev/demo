-- Organization advisers are standalone employees with read-only organization access.

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_account_type;

ALTER TABLE users
    ADD CONSTRAINT chk_users_account_type
    CHECK (account_type IN ('student', 'osa_staff', 'organization_adviser'));

ALTER TABLE pending_registrations
    MODIFY student_number VARCHAR(20) NULL,
    MODIFY program_code VARCHAR(30) NULL,
    ADD COLUMN employee_number VARCHAR(20) NULL AFTER student_number;

CREATE INDEX idx_pending_reg_employee_number
    ON pending_registrations(employee_number);

ALTER TABLE org_roles
    ADD COLUMN can_manage_org_dashboard TINYINT(1) NOT NULL DEFAULT 0
    AFTER can_access_org_dashboard;

UPDATE org_roles
SET can_manage_org_dashboard = can_access_org_dashboard;

INSERT INTO org_roles
    (org_id, role_name, can_access_org_dashboard, can_manage_org_dashboard, is_active)
SELECT org_id, 'organization_adviser', 1, 0, 1
FROM organizations
ON DUPLICATE KEY UPDATE
    can_access_org_dashboard = 1,
    can_manage_org_dashboard = 0,
    is_active = 1;

UPDATE organization_members om
JOIN org_roles adviser_role
  ON adviser_role.org_id = om.org_id
 AND adviser_role.role_name = 'organization_adviser'
SET om.role_id = adviser_role.role_id
WHERE LOWER(TRIM(COALESCE(om.position_title, ''))) IN ('organization adviser', 'adviser');
