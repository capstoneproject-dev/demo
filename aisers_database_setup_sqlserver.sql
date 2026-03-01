-- AISERS Database Setup (SQL Server)
-- Generated from: NEW NEW capstone_db.sql

USE [master];
GO
IF DB_ID(N'capstone_db') IS NOT NULL
BEGIN
    ALTER DATABASE [capstone_db] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [capstone_db];
END
GO
CREATE DATABASE [capstone_db];
GO
USE [capstone_db];
GO

CREATE TABLE dbo.academic_programs (
    program_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    program_code VARCHAR(30) NOT NULL,
    institute_id INT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_academic_programs_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_academic_programs_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_academic_programs_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.announcements (
    announcement_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    audience_type VARCHAR(20) NOT NULL CONSTRAINT df_announcements_audience_type DEFAULT 'all_students',
    is_published BIT NOT NULL CONSTRAINT df_announcements_is_published DEFAULT 0,
    published_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_announcements_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_announcements_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.attendance_records (
    record_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NULL,
    student_number VARCHAR(20) NULL,
    student_name VARCHAR(200) NULL,
    section VARCHAR(30) NULL,
    time_in DATETIME2(0) NOT NULL,
    time_out DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_attendance_records_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_attendance_records_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.documents_approved (
    repo_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    submission_id INT NOT NULL,
    org_id INT NOT NULL,
    approved_by_user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(500) NULL,
    description NVARCHAR(MAX) NULL,
    semester VARCHAR(3) NULL,
    academic_year VARCHAR(9) NULL,
    approved_at DATETIME2(0) NOT NULL CONSTRAINT df_documents_approved_approved_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_documents_approved_semester CHECK (semester IN ('1st', '2nd') OR semester IS NULL)
);
GO

CREATE TABLE dbo.document_annotations (
    annotation_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    submission_id INT NOT NULL,
    page_number INT NOT NULL,
    selected_text NVARCHAR(MAX) NOT NULL,
    rects_json NVARCHAR(MAX) NOT NULL,
    comment_text NVARCHAR(MAX) NULL,
    created_by_user_id INT NOT NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_document_annotations_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_document_annotations_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.document_submissions (
    submission_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by_user_id INT NOT NULL,
    reviewed_by_user_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    document_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(500) NULL,
    recipient VARCHAR(50) NOT NULL CONSTRAINT df_document_submissions_recipient DEFAULT 'OSA',
    status VARCHAR(30) NOT NULL CONSTRAINT df_document_submissions_status DEFAULT 'pending',
    reviewer_notes NVARCHAR(MAX) NULL,
    semester VARCHAR(3) NULL,
    academic_year VARCHAR(9) NULL,
    submitted_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_submitted_at DEFAULT SYSDATETIME(),
    reviewed_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_document_submissions_semester CHECK (semester IN ('1st', '2nd') OR semester IS NULL)
);
GO

CREATE TABLE dbo.events (
    event_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    location VARCHAR(255) NOT NULL,
    event_datetime DATETIME2(0) NOT NULL,
    event_photo VARBINARY(MAX) NULL,
    is_published BIT NOT NULL CONSTRAINT df_events_is_published DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_events_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_events_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.institutes (
    institute_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    institute_name VARCHAR(255) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_institutes_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_institutes_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_institutes_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.inventory_categories (
    category_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_inventory_categories_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_categories_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_categories_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.inventory_items (
    item_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) NOT NULL,
    category_id INT NOT NULL,
    stock_quantity INT NOT NULL CONSTRAINT df_inventory_items_stock_quantity DEFAULT 1,
    available_quantity INT NOT NULL CONSTRAINT df_inventory_items_available_quantity DEFAULT 1,
    hourly_rate DECIMAL(10,2) NOT NULL CONSTRAINT df_inventory_items_hourly_rate DEFAULT 0.00,
    overtime_interval_minutes INT NULL,
    overtime_rate_per_block DECIMAL(10,2) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_inventory_items_status DEFAULT 'available',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_items_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_items_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.organizations (
    org_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL,
    org_code VARCHAR(20) NOT NULL,
    logo_url VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_organizations_status DEFAULT 'active',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_organizations_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_organizations_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.organization_members (
    membership_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role_id INT NOT NULL,
    joined_at DATE NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_organization_members_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_organization_members_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_organization_members_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.org_roles (
    role_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    can_access_org_dashboard BIT NOT NULL CONSTRAINT df_org_roles_can_access_org_dashboard DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT df_org_roles_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_org_roles_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_org_roles_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.pending_registrations (
    reg_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    student_number VARCHAR(20) NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    program_code VARCHAR(30) NOT NULL,
    year_section VARCHAR(50) NULL,
    requested_role VARCHAR(20) NOT NULL CONSTRAINT df_pending_registrations_requested_role DEFAULT 'student',
    requested_org VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_pending_registrations_status DEFAULT 'pending',
    reviewed_by_user_id INT NULL,
    reviewer_notes NVARCHAR(MAX) NULL,
    requested_at DATETIME2(0) NOT NULL CONSTRAINT df_pending_registrations_requested_at DEFAULT SYSDATETIME(),
    reviewed_at DATETIME2(0) NULL,
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_pending_registrations_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.program_org_mappings (
    mapping_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    program_id INT NOT NULL,
    org_id INT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_program_org_mappings_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_program_org_mappings_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_program_org_mappings_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.rentals (
    rental_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    org_id INT NOT NULL,
    renter_user_id INT NOT NULL,
    processed_by_user_id INT NOT NULL,
    rent_time DATETIME2(0) NOT NULL,
    expected_return_time DATETIME2(0) NOT NULL,
    actual_return_time DATETIME2(0) NULL,
    total_cost DECIMAL(10,2) NOT NULL CONSTRAINT df_rentals_total_cost DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL CONSTRAINT df_rentals_payment_status DEFAULT 'unpaid',
    payment_method VARCHAR(20) NULL,
    paid_at DATETIME2(0) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_rentals_status DEFAULT 'active',
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_rentals_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_rentals_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.rental_items (
    rental_item_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL CONSTRAINT df_rental_items_quantity DEFAULT 1,
    unit_rate DECIMAL(10,2) NOT NULL,
    item_cost DECIMAL(10,2) NOT NULL,
    overtime_interval_minutes INT NULL,
    overtime_rate_per_block DECIMAL(10,2) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_rental_items_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_rental_items_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.student_numbers (
    sn_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    student_number VARCHAR(20) NOT NULL,
    student_name VARCHAR(200) NOT NULL,
    year_section VARCHAR(50) NULL,
    program_id INT NULL,
    institute_id INT NULL,
    is_active BIT NOT NULL CONSTRAINT df_student_numbers_is_active DEFAULT 1,
    added_by_user_id INT NULL,
    added_at DATETIME2(0) NOT NULL CONSTRAINT df_student_numbers_added_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_student_numbers_updated_at DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.users (
    user_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    student_number VARCHAR(20) NULL,
    program_id INT NULL,
    institute_id INT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    employee_number VARCHAR(20) NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CONSTRAINT df_users_account_type DEFAULT 'student',
    has_unpaid_debt BIT NOT NULL CONSTRAINT df_users_has_unpaid_debt DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT df_users_is_active DEFAULT 1,
    last_login_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_users_updated_at DEFAULT SYSDATETIME()
);
GO
GO




















CREATE UNIQUE INDEX uq_academic_programs_program_code ON dbo.academic_programs(program_code);
CREATE INDEX idx_programs_code ON dbo.academic_programs(program_code, is_active);
CREATE INDEX idx_programs_institute ON dbo.academic_programs(institute_id);

CREATE INDEX idx_announcements_org_published ON dbo.announcements(org_id, is_published, published_at);
CREATE INDEX idx_attendance_event ON dbo.attendance_records(event_id, time_in);
CREATE INDEX idx_attendance_student ON dbo.attendance_records(student_number);
CREATE INDEX idx_attendance_user ON dbo.attendance_records(user_id);

CREATE UNIQUE INDEX uq_documents_approved_submission_id ON dbo.documents_approved(submission_id);
CREATE INDEX idx_documents_approved_org ON dbo.documents_approved(org_id);
CREATE INDEX idx_documents_approved_approver ON dbo.documents_approved(approved_by_user_id);

CREATE INDEX idx_doc_ann_submission ON dbo.document_annotations(submission_id);
CREATE INDEX idx_doc_ann_user ON dbo.document_annotations(created_by_user_id);
CREATE INDEX idx_doc_ann_submission_page ON dbo.document_annotations(submission_id, page_number);

CREATE INDEX idx_doc_sub_reviewer ON dbo.document_submissions(reviewed_by_user_id);
CREATE INDEX idx_doc_sub_org_status ON dbo.document_submissions(org_id, status);
CREATE INDEX idx_doc_sub_submitter ON dbo.document_submissions(submitted_by_user_id);

CREATE INDEX idx_events_creator ON dbo.events(created_by_user_id);
CREATE INDEX idx_events_org_datetime ON dbo.events(org_id, event_datetime);

CREATE UNIQUE INDEX uq_institutes_institute_name ON dbo.institutes(institute_name);

CREATE UNIQUE INDEX uq_inventory_category_name ON dbo.inventory_categories(org_id, category_name);
CREATE UNIQUE INDEX uq_inventory_category_org_catid ON dbo.inventory_categories(org_id, category_id);
CREATE INDEX idx_inventory_categories_org ON dbo.inventory_categories(org_id, is_active);

CREATE UNIQUE INDEX uq_inventory_items_barcode ON dbo.inventory_items(barcode);
CREATE INDEX idx_inventory_org_category ON dbo.inventory_items(org_id, category_id);
CREATE INDEX idx_inventory_org_status ON dbo.inventory_items(org_id, status);
CREATE INDEX idx_inventory_category ON dbo.inventory_items(category_id);

CREATE UNIQUE INDEX uq_organizations_org_name ON dbo.organizations(org_name);
CREATE UNIQUE INDEX uq_organizations_org_code ON dbo.organizations(org_code);
CREATE INDEX idx_org_code ON dbo.organizations(org_code);

CREATE UNIQUE INDEX uq_member_org ON dbo.organization_members(user_id, org_id);
CREATE INDEX idx_org_members_role ON dbo.organization_members(role_id);
CREATE INDEX idx_org_members_org ON dbo.organization_members(org_id, role_id, is_active);
CREATE INDEX idx_org_members_user ON dbo.organization_members(user_id, is_active);

CREATE UNIQUE INDEX uq_org_role_name ON dbo.org_roles(org_id, role_name);
CREATE UNIQUE INDEX uq_org_role_org_roleid ON dbo.org_roles(org_id, role_id);
CREATE INDEX idx_org_roles_org ON dbo.org_roles(org_id, is_active);
CREATE INDEX idx_org_roles_name ON dbo.org_roles(org_id, role_name);

CREATE INDEX idx_pending_reg_reviewer ON dbo.pending_registrations(reviewed_by_user_id);
CREATE INDEX idx_pending_reg_status ON dbo.pending_registrations(status, requested_at);
CREATE INDEX idx_pending_reg_student_num ON dbo.pending_registrations(student_number);

CREATE UNIQUE INDEX uq_program_org ON dbo.program_org_mappings(program_id, org_id);
CREATE INDEX idx_program_org_org ON dbo.program_org_mappings(org_id);
CREATE INDEX idx_program_org_map_program ON dbo.program_org_mappings(program_id, is_active);

CREATE INDEX idx_rentals_processor ON dbo.rentals(processed_by_user_id);
CREATE INDEX idx_rentals_org_status ON dbo.rentals(org_id, status, expected_return_time);
CREATE INDEX idx_rentals_renter ON dbo.rentals(renter_user_id, payment_status);

CREATE UNIQUE INDEX uq_rental_item ON dbo.rental_items(rental_id, item_id);
CREATE INDEX idx_rental_items_item ON dbo.rental_items(item_id);
CREATE INDEX idx_rental_items_rental ON dbo.rental_items(rental_id);

CREATE UNIQUE INDEX uq_student_numbers_student_number ON dbo.student_numbers(student_number);
CREATE INDEX idx_student_numbers_added_by ON dbo.student_numbers(added_by_user_id);
CREATE INDEX idx_student_numbers_sn ON dbo.student_numbers(student_number, is_active);
CREATE INDEX idx_student_numbers_program_id ON dbo.student_numbers(program_id);
CREATE INDEX idx_student_numbers_institute_id ON dbo.student_numbers(institute_id);

CREATE UNIQUE INDEX uq_users_email ON dbo.users(email);
CREATE UNIQUE INDEX uq_users_student_number ON dbo.users(student_number) WHERE student_number IS NOT NULL;
CREATE UNIQUE INDEX uq_users_employee_number ON dbo.users(employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX idx_users_email ON dbo.users(email);
CREATE INDEX idx_users_program_id ON dbo.users(program_id);
CREATE INDEX idx_users_institute_id ON dbo.users(institute_id);
GO

ALTER TABLE dbo.academic_programs
  ADD CONSTRAINT fk_programs_institute FOREIGN KEY (institute_id) REFERENCES dbo.institutes(institute_id);

ALTER TABLE dbo.announcements
  ADD CONSTRAINT fk_announce_creator FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT fk_announce_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE dbo.attendance_records
  ADD CONSTRAINT fk_attendance_event FOREIGN KEY (event_id) REFERENCES dbo.events(event_id) ON DELETE CASCADE,
      CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL;

ALTER TABLE dbo.documents_approved
  ADD CONSTRAINT fk_repo_approver FOREIGN KEY (approved_by_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT fk_repo_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
      CONSTRAINT fk_repo_submission FOREIGN KEY (submission_id) REFERENCES dbo.document_submissions(submission_id);

ALTER TABLE dbo.document_annotations
  ADD CONSTRAINT fk_doc_ann_submission FOREIGN KEY (submission_id) REFERENCES dbo.document_submissions(submission_id) ON DELETE CASCADE,
      CONSTRAINT fk_doc_ann_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id);

ALTER TABLE dbo.document_submissions
  ADD CONSTRAINT fk_doc_sub_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
      CONSTRAINT fk_doc_sub_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL,
      CONSTRAINT fk_doc_sub_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES dbo.users(user_id);

ALTER TABLE dbo.events
  ADD CONSTRAINT fk_events_creator FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT fk_events_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE dbo.inventory_categories
  ADD CONSTRAINT fk_inventory_categories_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE dbo.inventory_items
  ADD CONSTRAINT fk_inventory_category FOREIGN KEY (category_id) REFERENCES dbo.inventory_categories(category_id),
      CONSTRAINT fk_inventory_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
      CONSTRAINT fk_inventory_org_category FOREIGN KEY (org_id, category_id) REFERENCES dbo.inventory_categories(org_id, category_id);

ALTER TABLE dbo.organization_members
  ADD CONSTRAINT fk_org_members_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
      CONSTRAINT fk_org_members_org_role FOREIGN KEY (org_id, role_id) REFERENCES dbo.org_roles(org_id, role_id),
      CONSTRAINT fk_org_members_role FOREIGN KEY (role_id) REFERENCES dbo.org_roles(role_id),
      CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE;

ALTER TABLE dbo.org_roles
  ADD CONSTRAINT fk_org_roles_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE;

ALTER TABLE dbo.pending_registrations
  ADD CONSTRAINT fk_reg_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL;

ALTER TABLE dbo.program_org_mappings
  ADD CONSTRAINT fk_program_org_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
      CONSTRAINT fk_program_org_program FOREIGN KEY (program_id) REFERENCES dbo.academic_programs(program_id) ON DELETE CASCADE;

ALTER TABLE dbo.rentals
  ADD CONSTRAINT fk_rentals_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
      CONSTRAINT fk_rentals_processor FOREIGN KEY (processed_by_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT fk_rentals_renter FOREIGN KEY (renter_user_id) REFERENCES dbo.users(user_id);

ALTER TABLE dbo.rental_items
  ADD CONSTRAINT fk_rental_items_item FOREIGN KEY (item_id) REFERENCES dbo.inventory_items(item_id),
      CONSTRAINT fk_rental_items_rental FOREIGN KEY (rental_id) REFERENCES dbo.rentals(rental_id) ON DELETE CASCADE;

ALTER TABLE dbo.student_numbers
  ADD CONSTRAINT fk_sn_added_by FOREIGN KEY (added_by_user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL,
      CONSTRAINT fk_student_numbers_institute FOREIGN KEY (institute_id) REFERENCES dbo.institutes(institute_id),
      CONSTRAINT fk_student_numbers_program FOREIGN KEY (program_id) REFERENCES dbo.academic_programs(program_id);

ALTER TABLE dbo.users
  ADD CONSTRAINT fk_users_institute FOREIGN KEY (institute_id) REFERENCES dbo.institutes(institute_id),
      CONSTRAINT fk_users_program FOREIGN KEY (program_id) REFERENCES dbo.academic_programs(program_id);
GO

CREATE TRIGGER trg_academic_programs_updated_at ON dbo.academic_programs AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.academic_programs t INNER JOIN inserted i ON t.program_id = i.program_id; END;
GO
CREATE TRIGGER trg_announcements_updated_at ON dbo.announcements AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.announcements t INNER JOIN inserted i ON t.announcement_id = i.announcement_id; END;
GO
CREATE TRIGGER trg_attendance_records_updated_at ON dbo.attendance_records AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.attendance_records t INNER JOIN inserted i ON t.record_id = i.record_id; END;
GO
CREATE TRIGGER trg_document_annotations_updated_at ON dbo.document_annotations AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.document_annotations t INNER JOIN inserted i ON t.annotation_id = i.annotation_id; END;
GO
CREATE TRIGGER trg_document_submissions_updated_at ON dbo.document_submissions AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.document_submissions t INNER JOIN inserted i ON t.submission_id = i.submission_id; END;
GO
CREATE TRIGGER trg_events_updated_at ON dbo.events AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.events t INNER JOIN inserted i ON t.event_id = i.event_id; END;
GO
CREATE TRIGGER trg_institutes_updated_at ON dbo.institutes AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.institutes t INNER JOIN inserted i ON t.institute_id = i.institute_id; END;
GO
CREATE TRIGGER trg_inventory_categories_updated_at ON dbo.inventory_categories AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.inventory_categories t INNER JOIN inserted i ON t.category_id = i.category_id; END;
GO
CREATE TRIGGER trg_inventory_updated_at ON dbo.inventory_items AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.inventory_items t INNER JOIN inserted i ON t.item_id = i.item_id; END;
GO
CREATE TRIGGER trg_org_updated_at ON dbo.organizations AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.organizations t INNER JOIN inserted i ON t.org_id = i.org_id; END;
GO
CREATE TRIGGER trg_org_members_updated_at ON dbo.organization_members AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.organization_members t INNER JOIN inserted i ON t.membership_id = i.membership_id; END;
GO
CREATE TRIGGER trg_org_roles_updated_at ON dbo.org_roles AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.org_roles t INNER JOIN inserted i ON t.role_id = i.role_id; END;
GO
CREATE TRIGGER trg_pending_registrations_updated_at ON dbo.pending_registrations AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.pending_registrations t INNER JOIN inserted i ON t.reg_id = i.reg_id; END;
GO
CREATE TRIGGER trg_program_org_mappings_updated_at ON dbo.program_org_mappings AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.program_org_mappings t INNER JOIN inserted i ON t.mapping_id = i.mapping_id; END;
GO
CREATE TRIGGER trg_rentals_updated_at ON dbo.rentals AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.rentals t INNER JOIN inserted i ON t.rental_id = i.rental_id; END;
GO
CREATE TRIGGER trg_rental_items_updated_at ON dbo.rental_items AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.rental_items t INNER JOIN inserted i ON t.rental_item_id = i.rental_item_id; END;
GO
CREATE TRIGGER trg_student_numbers_updated_at ON dbo.student_numbers AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.student_numbers t INNER JOIN inserted i ON t.sn_id = i.sn_id; END;
GO
CREATE TRIGGER trg_users_updated_at ON dbo.users AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL() > 1 RETURN; UPDATE t SET updated_at = SYSDATETIME() FROM dbo.users t INNER JOIN inserted i ON t.user_id = i.user_id; END;
GO

CREATE TRIGGER trg_doc_sub_to_repo ON dbo.document_submissions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    ;WITH changed AS (
        SELECT i.submission_id, i.org_id, i.reviewed_by_user_id, i.submitted_by_user_id, i.title, i.document_type, i.file_url,
               i.description, i.semester, i.academic_year
        FROM inserted i
        INNER JOIN deleted d ON i.submission_id = d.submission_id
        WHERE i.status = 'approved' AND ISNULL(d.status, '') <> 'approved'
    )
    MERGE dbo.documents_approved AS tgt
    USING changed AS src
      ON tgt.submission_id = src.submission_id
    WHEN MATCHED THEN
      UPDATE SET
        approved_at = SYSDATETIME(),
        file_url = src.file_url,
        description = src.description,
        semester = src.semester,
        academic_year = src.academic_year
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (submission_id, org_id, approved_by_user_id, title, document_type, file_url, description, semester, academic_year, approved_at)
      VALUES (src.submission_id, src.org_id, COALESCE(src.reviewed_by_user_id, src.submitted_by_user_id), src.title, src.document_type,
              src.file_url, src.description, src.semester, src.academic_year, SYSDATETIME());
END;
GO

CREATE TRIGGER trg_rentals_block_unpaid_student ON dbo.rentals AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.users u ON u.user_id = i.renter_user_id
        WHERE u.account_type = 'student' AND u.has_unpaid_debt = 1
    )
    BEGIN
        THROW 51000, 'Rental blocked: student account has unpaid debt.', 1;
    END
END;
GO

CREATE TRIGGER trg_rental_items_org_guard_insert ON dbo.rental_items AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.rentals r ON r.rental_id = i.rental_id
        LEFT JOIN dbo.inventory_items ii ON ii.item_id = i.item_id
        WHERE r.org_id IS NULL OR ii.org_id IS NULL OR r.org_id <> ii.org_id
    )
    BEGIN
        THROW 51001, 'Invalid rental item: inventory item belongs to a different organization.', 1;
    END
END;
GO

CREATE TRIGGER trg_rental_items_org_guard_update ON dbo.rental_items AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        LEFT JOIN dbo.rentals r ON r.rental_id = i.rental_id
        LEFT JOIN dbo.inventory_items ii ON ii.item_id = i.item_id
        WHERE r.org_id IS NULL OR ii.org_id IS NULL OR r.org_id <> ii.org_id
    )
    BEGIN
        THROW 51002, 'Invalid rental item update: inventory item belongs to a different organization.', 1;
    END
END;
GO

CREATE TRIGGER trg_users_set_institute_after_insert_update ON dbo.users AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET institute_id = ap.institute_id
    FROM dbo.users u
    INNER JOIN inserted i ON u.user_id = i.user_id
    LEFT JOIN dbo.academic_programs ap ON ap.program_id = i.program_id;
END;
GO

DBCC CHECKIDENT ('dbo.academic_programs', RESEED, 12);
DBCC CHECKIDENT ('dbo.documents_approved', RESEED, 2);
DBCC CHECKIDENT ('dbo.document_annotations', RESEED, 1);
DBCC CHECKIDENT ('dbo.events', RESEED, 7);
DBCC CHECKIDENT ('dbo.institutes', RESEED, 3);
DBCC CHECKIDENT ('dbo.inventory_categories', RESEED, 2);
DBCC CHECKIDENT ('dbo.organization_members', RESEED, 6);
DBCC CHECKIDENT ('dbo.org_roles', RESEED, 12);
DBCC CHECKIDENT ('dbo.program_org_mappings', RESEED, 11);
DBCC CHECKIDENT ('dbo.student_numbers', RESEED, 6);
GO

