-- AISERS Multi-Organization Database Setup (SQL Server)
-- Schema parity with aisers_database_setup_mysql.sql
-- Target: SQL Server Management Studio 21

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

CREATE TABLE dbo.users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    student_number VARCHAR(20) NULL,
    employee_number VARCHAR(20) NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL CONSTRAINT df_users_account_type DEFAULT 'student',
    has_unpaid_debt BIT NOT NULL CONSTRAINT df_users_has_unpaid_debt DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT df_users_is_active DEFAULT 1,
    last_login_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_users_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_account_type CHECK (account_type IN ('student', 'osa_staff'))
);
GO

CREATE TABLE dbo.organizations (
    org_id INT IDENTITY(1,1) PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL,
    org_code VARCHAR(20) NOT NULL,
    description NVARCHAR(MAX) NULL,
    logo_url VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_organizations_status DEFAULT 'active',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_organizations_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_organizations_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_organizations_org_name UNIQUE (org_name),
    CONSTRAINT uq_organizations_org_code UNIQUE (org_code),
    CONSTRAINT chk_org_status CHECK (status IN ('active', 'probation', 'suspended'))
);
GO

CREATE TABLE dbo.org_roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    can_access_org_dashboard BIT NOT NULL CONSTRAINT df_org_roles_can_access DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT df_org_roles_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_org_roles_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_org_roles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_org_role_name UNIQUE (org_id, role_name),
    CONSTRAINT uq_org_role_org_roleid UNIQUE (org_id, role_id),
    CONSTRAINT fk_org_roles_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.organization_members (
    membership_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role_id INT NOT NULL,
    joined_at DATE NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_org_members_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_org_members_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_org_members_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_member_org UNIQUE (user_id, org_id),
    CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_role FOREIGN KEY (role_id) REFERENCES dbo.org_roles(role_id),
    CONSTRAINT fk_org_members_org_role FOREIGN KEY (org_id, role_id) REFERENCES dbo.org_roles(org_id, role_id)
);
GO

CREATE TABLE dbo.institutes (
    institute_id INT IDENTITY(1,1) PRIMARY KEY,
    institute_name VARCHAR(255) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_institutes_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_institutes_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_institutes_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_institutes_name UNIQUE (institute_name)
);
GO

CREATE TABLE dbo.academic_programs (
    program_id INT IDENTITY(1,1) PRIMARY KEY,
    program_code VARCHAR(30) NOT NULL,
    institute_id INT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_programs_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_programs_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_programs_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_program_code UNIQUE (program_code),
    CONSTRAINT fk_programs_institute FOREIGN KEY (institute_id) REFERENCES dbo.institutes(institute_id)
);
GO

CREATE TABLE dbo.student_profiles (
    user_id INT PRIMARY KEY,
    program_id INT NOT NULL,
    section VARCHAR(30) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_student_profiles_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_student_profiles_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_student_profiles_program FOREIGN KEY (program_id) REFERENCES dbo.academic_programs(program_id)
);
GO

CREATE TABLE dbo.program_org_mappings (
    mapping_id INT IDENTITY(1,1) PRIMARY KEY,
    program_id INT NOT NULL,
    org_id INT NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_program_org_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_program_org_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_program_org_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_program_org UNIQUE (program_id, org_id),
    CONSTRAINT fk_program_org_program FOREIGN KEY (program_id) REFERENCES dbo.academic_programs(program_id) ON DELETE CASCADE,
    CONSTRAINT fk_program_org_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE
);
GO
CREATE TABLE dbo.inventory_categories (
    category_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_inventory_categories_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_categories_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_categories_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_inventory_category_name UNIQUE (org_id, category_name),
    CONSTRAINT uq_inventory_category_org_catid UNIQUE (org_id, category_id),
    CONSTRAINT fk_inventory_categories_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.inventory_items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) NOT NULL,
    category_id INT NOT NULL,
    stock_quantity INT NOT NULL CONSTRAINT df_inventory_stock_qty DEFAULT 1,
    available_quantity INT NOT NULL CONSTRAINT df_inventory_available_qty DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL CONSTRAINT df_inventory_hourly_rate DEFAULT 0.00,
    overtime_interval_minutes INT NULL,
    overtime_rate_per_block DECIMAL(10, 2) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_inventory_status DEFAULT 'available',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_inventory_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_inventory_items_barcode UNIQUE (barcode),
    CONSTRAINT chk_inventory_status CHECK (status IN ('available', 'rented', 'maintenance')),
    CONSTRAINT chk_stock_quantity CHECK (stock_quantity >= 0),
    CONSTRAINT chk_available_quantity CHECK (available_quantity >= 0 AND available_quantity <= stock_quantity),
    CONSTRAINT chk_hourly_rate CHECK (hourly_rate >= 0),
    CONSTRAINT chk_overtime_interval CHECK (overtime_interval_minutes IS NULL OR overtime_interval_minutes > 0),
    CONSTRAINT chk_overtime_rate CHECK (overtime_rate_per_block IS NULL OR overtime_rate_per_block >= 0),
    CONSTRAINT fk_inventory_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
    CONSTRAINT fk_inventory_category FOREIGN KEY (category_id) REFERENCES dbo.inventory_categories(category_id),
    CONSTRAINT fk_inventory_org_category FOREIGN KEY (org_id, category_id) REFERENCES dbo.inventory_categories(org_id, category_id)
);
GO

CREATE TABLE dbo.rentals (
    rental_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    renter_user_id INT NOT NULL,
    processed_by_user_id INT NOT NULL,
    rent_time DATETIME2(0) NOT NULL,
    expected_return_time DATETIME2(0) NOT NULL,
    actual_return_time DATETIME2(0) NULL,
    total_cost DECIMAL(10, 2) NOT NULL CONSTRAINT df_rentals_total_cost DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL CONSTRAINT df_rentals_payment_status DEFAULT 'unpaid',
    payment_method VARCHAR(20) NULL,
    paid_at DATETIME2(0) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_rentals_status DEFAULT 'active',
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_rentals_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_rentals_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_rentals_payment_status CHECK (payment_status IN ('unpaid', 'paid')),
    CONSTRAINT chk_rentals_payment_method CHECK (payment_method = 'cash' OR payment_method IS NULL),
    CONSTRAINT chk_rentals_status CHECK (status IN ('active', 'returned', 'overdue', 'cancelled')),
    CONSTRAINT chk_rentals_time_order CHECK (expected_return_time >= rent_time AND (actual_return_time IS NULL OR actual_return_time >= rent_time)),
    CONSTRAINT chk_rentals_total_cost CHECK (total_cost >= 0),
    CONSTRAINT fk_rentals_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
    CONSTRAINT fk_rentals_renter FOREIGN KEY (renter_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT fk_rentals_processor FOREIGN KEY (processed_by_user_id) REFERENCES dbo.users(user_id)
);
GO

CREATE TABLE dbo.rental_items (
    rental_item_id INT IDENTITY(1,1) PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL CONSTRAINT df_rental_items_qty DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    overtime_interval_minutes INT NULL,
    overtime_rate_per_block DECIMAL(10, 2) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_rental_items_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_rental_items_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_rental_item UNIQUE (rental_id, item_id),
    CONSTRAINT chk_rental_qty CHECK (quantity > 0),
    CONSTRAINT chk_rental_unit_rate CHECK (unit_rate >= 0),
    CONSTRAINT chk_rental_item_cost CHECK (item_cost >= 0),
    CONSTRAINT chk_rental_overtime_interval CHECK (overtime_interval_minutes IS NULL OR overtime_interval_minutes > 0),
    CONSTRAINT chk_rental_overtime_rate CHECK (overtime_rate_per_block IS NULL OR overtime_rate_per_block >= 0),
    CONSTRAINT fk_rental_items_rental FOREIGN KEY (rental_id) REFERENCES dbo.rentals(rental_id) ON DELETE CASCADE,
    CONSTRAINT fk_rental_items_item FOREIGN KEY (item_id) REFERENCES dbo.inventory_items(item_id)
);
GO

CREATE TABLE dbo.event_types (
    event_type_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    event_type_name VARCHAR(100) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT df_event_types_is_active DEFAULT 1,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_event_types_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_event_types_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT uq_event_type_name UNIQUE (org_id, event_type_name),
    CONSTRAINT uq_event_type_org_typeid UNIQUE (org_id, event_type_id),
    CONSTRAINT fk_event_types_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE
);
GO
CREATE TABLE dbo.events (
    event_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    location VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME(0) NOT NULL,
    end_time TIME(0) NOT NULL,
    event_type_id INT NOT NULL,
    approval_status VARCHAR(20) NOT NULL CONSTRAINT df_events_approval_status DEFAULT 'draft',
    is_published BIT NOT NULL CONSTRAINT df_events_is_published DEFAULT 0,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_events_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_events_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_events_approval CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
    CONSTRAINT chk_events_time CHECK (end_time > start_time),
    CONSTRAINT chk_events_publish CHECK (is_published = 0 OR approval_status = 'approved'),
    CONSTRAINT fk_events_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT fk_events_type FOREIGN KEY (event_type_id) REFERENCES dbo.event_types(event_type_id),
    CONSTRAINT fk_events_org_type FOREIGN KEY (org_id, event_type_id) REFERENCES dbo.event_types(org_id, event_type_id)
);
GO

CREATE TABLE dbo.announcements (
    announcement_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    audience_type VARCHAR(20) NOT NULL CONSTRAINT df_announcements_audience DEFAULT 'all_students',
    is_published BIT NOT NULL CONSTRAINT df_announcements_is_published DEFAULT 0,
    published_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_announcements_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_announcements_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_announce_audience CHECK (audience_type IN ('all_students', 'members_only', 'officers_only')),
    CONSTRAINT fk_announce_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_announce_creator FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id)
);
GO

CREATE TABLE dbo.attendance_records (
    record_id INT IDENTITY(1,1) PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NULL,
    student_number VARCHAR(20) NULL,
    student_name VARCHAR(200) NULL,
    section VARCHAR(30) NULL,
    time_in DATETIME2(0) NOT NULL,
    time_out DATETIME2(0) NULL,
    scan_mode VARCHAR(20) NOT NULL CONSTRAINT df_attendance_scan_mode DEFAULT 'barcode',
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_attendance_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_attendance_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_attendance_scan_mode CHECK (scan_mode IN ('barcode', 'manual')),
    CONSTRAINT chk_attendance_timeout CHECK (time_out IS NULL OR time_out >= time_in),
    CONSTRAINT fk_attendance_event FOREIGN KEY (event_id) REFERENCES dbo.events(event_id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL
);
GO

CREATE TABLE dbo.document_submissions (
    submission_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by_user_id INT NOT NULL,
    reviewed_by_user_id INT NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(500) NULL,
    recipient VARCHAR(50) NOT NULL CONSTRAINT df_document_submissions_recipient DEFAULT 'OSA',
    status VARCHAR(30) NOT NULL CONSTRAINT df_document_submissions_status DEFAULT 'pending',
    reviewer_notes NVARCHAR(MAX) NULL,
    submitted_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_submitted_at DEFAULT SYSDATETIME(),
    reviewed_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_created_at DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT df_document_submissions_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT chk_doc_type CHECK (document_type IN ('Financial Statement', 'Budget Proposal', 'Activity Proposal', 'Liquidation Report', 'Legal Document', 'Other')),
    CONSTRAINT chk_doc_recipient CHECK (recipient IN ('OSA', 'SSC')),
    CONSTRAINT chk_doc_status CHECK (status IN ('pending', 'sent_to_osa', 'ssc_approved', 'approved', 'rejected')),
    CONSTRAINT fk_doc_sub_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id),
    CONSTRAINT fk_doc_sub_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT fk_doc_sub_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL
);
GO

CREATE UNIQUE INDEX uq_users_student_number ON dbo.users(student_number) WHERE student_number IS NOT NULL;
CREATE UNIQUE INDEX uq_users_employee_number ON dbo.users(employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX idx_users_email ON dbo.users(email);
CREATE INDEX idx_org_code ON dbo.organizations(org_code);
CREATE INDEX idx_org_roles_org ON dbo.org_roles(org_id, is_active);
CREATE INDEX idx_org_roles_name ON dbo.org_roles(org_id, role_name);
CREATE INDEX idx_org_members_org ON dbo.organization_members(org_id, role_id, is_active);
CREATE INDEX idx_org_members_user ON dbo.organization_members(user_id, is_active);
CREATE INDEX idx_programs_code ON dbo.academic_programs(program_code, is_active);
CREATE INDEX idx_programs_institute ON dbo.academic_programs(institute_id);
CREATE INDEX idx_student_profiles_program ON dbo.student_profiles(program_id);
CREATE INDEX idx_program_org_map_program ON dbo.program_org_mappings(program_id, is_active);
CREATE INDEX idx_inventory_categories_org ON dbo.inventory_categories(org_id, is_active);
CREATE INDEX idx_inventory_org_status ON dbo.inventory_items(org_id, status);
CREATE INDEX idx_inventory_category ON dbo.inventory_items(category_id);
CREATE INDEX idx_rentals_org_status ON dbo.rentals(org_id, status, expected_return_time);
CREATE INDEX idx_rentals_renter ON dbo.rentals(renter_user_id, payment_status);
CREATE INDEX idx_rental_items_rental ON dbo.rental_items(rental_id);
CREATE INDEX idx_event_types_org ON dbo.event_types(org_id, is_active);
CREATE INDEX idx_events_org_date ON dbo.events(org_id, event_date);
CREATE INDEX idx_events_type ON dbo.events(event_type_id);
CREATE INDEX idx_announcements_org_published ON dbo.announcements(org_id, is_published, published_at);
CREATE INDEX idx_attendance_event ON dbo.attendance_records(event_id, time_in);
CREATE INDEX idx_attendance_student ON dbo.attendance_records(student_number);
CREATE INDEX idx_attendance_user ON dbo.attendance_records(user_id);
CREATE INDEX idx_doc_sub_org_status ON dbo.document_submissions(org_id, status);
CREATE INDEX idx_doc_sub_submitter ON dbo.document_submissions(submitted_by_user_id);
GO
CREATE TRIGGER trg_users_updated_at ON dbo.users AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE u SET updated_at = SYSDATETIME() FROM dbo.users u INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO
CREATE TRIGGER trg_org_updated_at ON dbo.organizations AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE o SET updated_at = SYSDATETIME() FROM dbo.organizations o INNER JOIN inserted i ON o.org_id = i.org_id;
END;
GO
CREATE TRIGGER trg_org_roles_updated_at ON dbo.org_roles AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE r SET updated_at = SYSDATETIME() FROM dbo.org_roles r INNER JOIN inserted i ON r.role_id = i.role_id;
END;
GO
CREATE TRIGGER trg_org_members_updated_at ON dbo.organization_members AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE om SET updated_at = SYSDATETIME() FROM dbo.organization_members om INNER JOIN inserted i ON om.membership_id = i.membership_id;
END;
GO
CREATE TRIGGER trg_institutes_updated_at ON dbo.institutes AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.institutes x INNER JOIN inserted i ON x.institute_id = i.institute_id;
END;
GO
CREATE TRIGGER trg_academic_programs_updated_at ON dbo.academic_programs AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.academic_programs x INNER JOIN inserted i ON x.program_id = i.program_id;
END;
GO
CREATE TRIGGER trg_student_profiles_updated_at ON dbo.student_profiles AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.student_profiles x INNER JOIN inserted i ON x.user_id = i.user_id;
END;
GO
CREATE TRIGGER trg_program_org_mappings_updated_at ON dbo.program_org_mappings AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.program_org_mappings x INNER JOIN inserted i ON x.mapping_id = i.mapping_id;
END;
GO
CREATE TRIGGER trg_inventory_categories_updated_at ON dbo.inventory_categories AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.inventory_categories x INNER JOIN inserted i ON x.category_id = i.category_id;
END;
GO
CREATE TRIGGER trg_inventory_updated_at ON dbo.inventory_items AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.inventory_items x INNER JOIN inserted i ON x.item_id = i.item_id;
END;
GO
CREATE TRIGGER trg_rentals_updated_at ON dbo.rentals AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.rentals x INNER JOIN inserted i ON x.rental_id = i.rental_id;
END;
GO
CREATE TRIGGER trg_rental_items_updated_at ON dbo.rental_items AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.rental_items x INNER JOIN inserted i ON x.rental_item_id = i.rental_item_id;
END;
GO
CREATE TRIGGER trg_events_updated_at ON dbo.events AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.events x INNER JOIN inserted i ON x.event_id = i.event_id;
END;
GO
CREATE TRIGGER trg_event_types_updated_at ON dbo.event_types AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.event_types x INNER JOIN inserted i ON x.event_type_id = i.event_type_id;
END;
GO
CREATE TRIGGER trg_announcements_updated_at ON dbo.announcements AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.announcements x INNER JOIN inserted i ON x.announcement_id = i.announcement_id;
END;
GO
CREATE TRIGGER trg_attendance_records_updated_at ON dbo.attendance_records AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.attendance_records x INNER JOIN inserted i ON x.record_id = i.record_id;
END;
GO
CREATE TRIGGER trg_document_submissions_updated_at ON dbo.document_submissions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE x SET updated_at = SYSDATETIME() FROM dbo.document_submissions x INNER JOIN inserted i ON x.submission_id = i.submission_id;
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

CREATE TRIGGER trg_student_profiles_auto_org_member ON dbo.student_profiles AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    ;WITH candidate AS (
        SELECT i.user_id, m.org_id, rp.role_id
        FROM inserted i
        OUTER APPLY (
            SELECT TOP (1) pom.org_id
            FROM dbo.program_org_mappings pom
            WHERE pom.program_id = i.program_id AND pom.is_active = 1
            ORDER BY pom.mapping_id
        ) m
        OUTER APPLY (
            SELECT TOP (1) r.role_id
            FROM dbo.org_roles r
            WHERE r.org_id = m.org_id AND r.role_name = 'member' AND r.is_active = 1
            ORDER BY r.role_id
        ) rp
        WHERE m.org_id IS NOT NULL AND rp.role_id IS NOT NULL
    )
    INSERT INTO dbo.organization_members (user_id, org_id, role_id, joined_at, is_active)
    SELECT c.user_id, c.org_id, c.role_id, CAST(GETDATE() AS DATE), 1
    FROM candidate c
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.organization_members om WHERE om.user_id = c.user_id AND om.org_id = c.org_id
    );
END;
GO

SELECT 'users' AS table_name, COUNT(*) AS record_count FROM dbo.users
UNION ALL SELECT 'organizations', COUNT(*) FROM dbo.organizations
UNION ALL SELECT 'org_roles', COUNT(*) FROM dbo.org_roles
UNION ALL SELECT 'organization_members', COUNT(*) FROM dbo.organization_members
UNION ALL SELECT 'academic_programs', COUNT(*) FROM dbo.academic_programs
UNION ALL SELECT 'student_profiles', COUNT(*) FROM dbo.student_profiles
UNION ALL SELECT 'program_org_mappings', COUNT(*) FROM dbo.program_org_mappings
UNION ALL SELECT 'inventory_categories', COUNT(*) FROM dbo.inventory_categories
UNION ALL SELECT 'inventory_items', COUNT(*) FROM dbo.inventory_items
UNION ALL SELECT 'rentals', COUNT(*) FROM dbo.rentals
UNION ALL SELECT 'rental_items', COUNT(*) FROM dbo.rental_items
UNION ALL SELECT 'event_types', COUNT(*) FROM dbo.event_types
UNION ALL SELECT 'events', COUNT(*) FROM dbo.events
UNION ALL SELECT 'announcements', COUNT(*) FROM dbo.announcements
UNION ALL SELECT 'attendance_records', COUNT(*) FROM dbo.attendance_records
UNION ALL SELECT 'document_submissions', COUNT(*) FROM dbo.document_submissions;
GO
