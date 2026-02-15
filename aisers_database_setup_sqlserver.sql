-- =====================================================
-- AISERS Database Setup Script (SQL Server / T-SQL)
-- Version: 1.0
-- Date: February 15, 2026
-- Target: Microsoft SQL Server 2016+
-- =====================================================

-- =====================================================
-- STEP 1: Create Database
-- =====================================================
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'aisers_db')
BEGIN
    ALTER DATABASE aisers_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE aisers_db;
END
GO

CREATE DATABASE aisers_db;
GO

USE aisers_db;
GO

-- =====================================================
-- STEP 2: Create Tables
-- =====================================================

-- -----------------------------------------------------
-- Table: users
-- Purpose: Core identity and authentication data
-- NOTE: Students (including officers) use student_number
--       OSA Staff (employees) use employee_number
-- -----------------------------------------------------
CREATE TABLE users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    student_number VARCHAR(20) NULL,  -- For students only (uniqueness enforced by filtered index)
    employee_number VARCHAR(20) NULL, -- For OSA staff only (uniqueness enforced by filtered index)
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'osa_staff')),
    -- Academic details (for students only)
    course VARCHAR(50) NULL,          -- e.g., 'BS-IT', 'BS-Aeronautics', 'BS-CS'
    year_level INT NULL CHECK (year_level BETWEEN 1 AND 5),
    section VARCHAR(20) NULL,         -- e.g., 'A', 'B', '1-1', 'Bravo'
    barcode VARCHAR(50) UNIQUE,
    has_unpaid_debt BIT DEFAULT 0,  -- Only applies to students
    is_active BIT DEFAULT 1,
    last_login_at DATETIME2 NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    -- Constraint: Students must have student_number, OSA staff must have employee_number
    CONSTRAINT chk_user_id_number CHECK (
        (role = 'student' AND student_number IS NOT NULL AND employee_number IS NULL) OR
        (role = 'osa_staff' AND employee_number IS NOT NULL AND student_number IS NULL)
    )
);
GO

-- Filtered unique indexes for student_number and employee_number
-- These enforce uniqueness only for non-NULL values (allowing multiple NULLs)
CREATE UNIQUE INDEX idx_student_number ON users(student_number) WHERE student_number IS NOT NULL;
CREATE UNIQUE INDEX idx_employee_number ON users(employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX idx_barcode ON users(barcode);
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_course_year_section ON users(course, year_level, section) WHERE course IS NOT NULL;
GO

-- Trigger for updated_at on users
CREATE TRIGGER trg_users_updated_at
ON users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE users
    SET updated_at = GETDATE()
    FROM users u
    INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO

-- -----------------------------------------------------
-- Table: organizations
-- Purpose: Student organizations registry
-- -----------------------------------------------------
CREATE TABLE organizations (
    org_id INT IDENTITY(1,1) PRIMARY KEY,
    org_name VARCHAR(255) UNIQUE NOT NULL,
    org_code VARCHAR(20) UNIQUE NOT NULL,
    description NVARCHAR(MAX),
    logo_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'probation', 'suspended')),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

CREATE INDEX idx_org_code ON organizations(org_code);
GO

CREATE TRIGGER trg_organizations_updated_at
ON organizations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE organizations
    SET updated_at = GETDATE()
    FROM organizations o
    INNER JOIN inserted i ON o.org_id = i.org_id;
END;
GO

-- -----------------------------------------------------
-- Table: organization_members
-- Purpose: Junction table linking users to organizations
-- -----------------------------------------------------
CREATE TABLE organization_members (
    membership_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'officer', 'president', 'treasurer', 'secretary')),
    joined_at DATE NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT unique_membership UNIQUE (user_id, org_id),
    CONSTRAINT fk_orgmembers_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_orgmembers_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_user_org_role ON organization_members(user_id, org_id, role);
CREATE INDEX idx_org_members ON organization_members(org_id);
GO

CREATE TRIGGER trg_orgmembers_updated_at
ON organization_members
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE organization_members
    SET updated_at = GETDATE()
    FROM organization_members om
    INNER JOIN inserted i ON om.membership_id = i.membership_id;
END;
GO

-- -----------------------------------------------------
-- Table: documents
-- Purpose: Document submissions and approval workflow
-- -----------------------------------------------------
CREATE TABLE documents (
    document_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('proposal', 'activity_report', 'financial_statement', 'resolution', 'other')),
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'ssc_review', 'osa_review', 'approved', 'rejected')),
    reviewed_by INT NULL,
    review_notes NVARCHAR(MAX),
    reviewed_at DATETIME2 NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_documents_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_documents_submitted FOREIGN KEY (submitted_by) REFERENCES users(user_id),
    CONSTRAINT fk_documents_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);
GO

CREATE INDEX idx_org_status ON documents(org_id, status);
CREATE INDEX idx_status ON documents(status);
GO

CREATE TRIGGER trg_documents_updated_at
ON documents
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE documents
    SET updated_at = GETDATE()
    FROM documents d
    INNER JOIN inserted i ON d.document_id = i.document_id;
END;
GO

-- -----------------------------------------------------
-- Table: events
-- Purpose: Events created by organizations
-- -----------------------------------------------------
CREATE TABLE events (
    event_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    location VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    event_type VARCHAR(20) DEFAULT 'other' CHECK (event_type IN ('meeting', 'seminar', 'workshop', 'competition', 'social', 'other')),
    qr_code_url VARCHAR(500),
    is_published BIT DEFAULT 0,
    max_participants INT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_events_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE NO ACTION,
    CONSTRAINT fk_events_created FOREIGN KEY (created_by) REFERENCES users(user_id)
);
GO

CREATE INDEX idx_event_date_published ON events(event_date, is_published);
CREATE INDEX idx_org_events ON events(org_id);
GO

CREATE TRIGGER trg_events_updated_at
ON events
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE events
    SET updated_at = GETDATE()
    FROM events e
    INNER JOIN inserted i ON e.event_id = i.event_id;
END;
GO

-- -----------------------------------------------------
-- Table: attendance_logs
-- Purpose: Event attendance tracking (time-in/time-out)
-- Note: duration_minutes is NULL when time_out is NULL (student still checked in)
--       Application frontend should handle NULL gracefully for active attendance
-- -----------------------------------------------------
CREATE TABLE attendance_logs (
    attendance_id INT IDENTITY(1,1) PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    time_in DATETIME2 NOT NULL,
    time_out DATETIME2 NULL,
    duration_minutes AS (DATEDIFF(MINUTE, time_in, time_out)) PERSISTED,  -- NULL until time_out is set
    scan_method VARCHAR(20) DEFAULT 'qr_code' CHECK (scan_method IN ('qr_code', 'barcode', 'manual')),
    is_synced BIT DEFAULT 0,
    modified_at DATETIME2 DEFAULT GETDATE(),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT unique_attendance UNIQUE (event_id, user_id),
    CONSTRAINT fk_attendance_events FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE NO ACTION,
    CONSTRAINT fk_attendance_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_event_user ON attendance_logs(event_id, user_id);
CREATE INDEX idx_sync_status ON attendance_logs(is_synced);
GO

CREATE TRIGGER trg_attendance_modified_at
ON attendance_logs
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE attendance_logs
    SET modified_at = GETDATE(), updated_at = GETDATE()
    FROM attendance_logs al
    INNER JOIN inserted i ON al.attendance_id = i.attendance_id;
END;
GO

-- -----------------------------------------------------
-- Table: inventory_items
-- Purpose: Equipment and uniforms for rental
-- -----------------------------------------------------
CREATE TABLE inventory_items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('uniform', 'equipment', 'sports_gear', 'electronics', 'other')),
    stock_quantity INT NOT NULL DEFAULT 1,
    available_quantity INT NOT NULL DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'retired')),
    version INT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_inventory_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT chk_available_quantity CHECK (available_quantity <= stock_quantity)
);
GO

CREATE INDEX idx_barcode_inventory ON inventory_items(barcode);
CREATE INDEX idx_org_status_inventory ON inventory_items(org_id, status);
GO

CREATE TRIGGER trg_inventory_updated_at
ON inventory_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE inventory_items
    SET updated_at = GETDATE()
    FROM inventory_items ii
    INNER JOIN inserted i ON ii.item_id = i.item_id;
END;
GO

-- -----------------------------------------------------
-- Table: rentals
-- Purpose: Rental transactions
-- -----------------------------------------------------
CREATE TABLE rentals (
    rental_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    processed_by INT NOT NULL,
    rent_time DATETIME2 NOT NULL,
    expected_return_time DATETIME2 NOT NULL,
    actual_return_time DATETIME2 NULL,
    total_cost DECIMAL(10, 2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
    payment_method VARCHAR(20) NULL CHECK (payment_method IN ('cash', 'gcash', 'bank_transfer', 'free') OR payment_method IS NULL),
    paid_at DATETIME2 NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'cancelled')),
    notes NVARCHAR(MAX),
    version INT DEFAULT 1,
    is_synced BIT DEFAULT 0,
    modified_at DATETIME2 DEFAULT GETDATE(),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_rentals_users FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_rentals_processed FOREIGN KEY (processed_by) REFERENCES users(user_id)
);
GO

CREATE INDEX idx_user_payment ON rentals(user_id, payment_status);
CREATE INDEX idx_status_due ON rentals(status, expected_return_time);
CREATE INDEX idx_sync_status_rentals ON rentals(is_synced);
GO

CREATE TRIGGER trg_rentals_modified_at
ON rentals
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE rentals
    SET modified_at = GETDATE(), updated_at = GETDATE()
    FROM rentals r
    INNER JOIN inserted i ON r.rental_id = i.rental_id;
END;
GO

-- -----------------------------------------------------
-- Table: rental_items
-- Purpose: Junction table for multi-item rentals
-- -----------------------------------------------------
CREATE TABLE rental_items (
    rental_item_id INT IDENTITY(1,1) PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT unique_rental_item UNIQUE (rental_id, item_id),
    CONSTRAINT fk_rentalitems_rentals FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE,
    CONSTRAINT fk_rentalitems_inventory FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)
);
GO

CREATE INDEX idx_rental_item ON rental_items(rental_id, item_id);
GO

CREATE TRIGGER trg_rentalitems_updated_at
ON rental_items
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE rental_items
    SET updated_at = GETDATE()
    FROM rental_items ri
    INNER JOIN inserted i ON ri.rental_item_id = i.rental_item_id;
END;
GO

-- -----------------------------------------------------
-- Table: announcements
-- Purpose: Posts created by organizations
-- -----------------------------------------------------
CREATE TABLE announcements (
    announcement_id INT IDENTITY(1,1) PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_id INT NULL,
    title VARCHAR(255) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    audience_type VARCHAR(20) DEFAULT 'all_students' CHECK (audience_type IN ('all_students', 'members_only', 'officers_only')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_published BIT DEFAULT 0,
    published_at DATETIME2 NULL,
    expires_at DATETIME2 NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_announcements_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_announcements_created FOREIGN KEY (created_by) REFERENCES users(user_id),
    CONSTRAINT fk_announcements_events FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE NO ACTION
);
GO

CREATE INDEX idx_org_published ON announcements(org_id, is_published, published_at);
CREATE INDEX idx_event_announcements ON announcements(event_id);
GO

CREATE TRIGGER trg_announcements_updated_at
ON announcements
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE announcements
    SET updated_at = GETDATE()
    FROM announcements a
    INNER JOIN inserted i ON a.announcement_id = i.announcement_id;
END;
GO

-- Trigger to handle organization deletion with proper cascade behavior
-- NOTE: SQL Server doesn't allow multiple cascade paths, so we use this trigger
-- to manually handle cascades while avoiding circular reference issues.
-- When an organization is deleted:
--   1. Delete related events (which triggers event cleanup)
--   2. Delete announcements
--   3. Delete documents
--   4. Delete inventory items (if they exist)
--   5. Delete organization memberships
CREATE TRIGGER trg_organizations_delete_cascade
ON organizations
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get the org_ids being deleted
    DECLARE @deleted_orgs TABLE (org_id INT);
    INSERT INTO @deleted_orgs SELECT org_id FROM deleted;
    
    -- Step 1: Handle events deletion (which will cascade to attendance_logs)
    -- First set event_id to NULL for announcements linked to these events
    UPDATE announcements
    SET event_id = NULL
    WHERE event_id IN (
        SELECT event_id FROM events WHERE org_id IN (SELECT org_id FROM @deleted_orgs)
    );
    
    -- Delete attendance logs for these events
    DELETE FROM attendance_logs
    WHERE event_id IN (
        SELECT event_id FROM events WHERE org_id IN (SELECT org_id FROM @deleted_orgs)
    );
    
    -- Delete the events
    DELETE FROM events
    WHERE org_id IN (SELECT org_id FROM @deleted_orgs);
    
    -- Step 2: Delete announcements from this organization
    DELETE FROM announcements
    WHERE org_id IN (SELECT org_id FROM @deleted_orgs);
    
    -- Step 3: Delete documents (handled by FK - no action needed)
    -- Documents have RESTRICT, so if there are documents, this will be blocked at app level
    
    -- Step 4: Delete inventory items (handled by FK - no action needed)
    -- Inventory has RESTRICT, so if there are items, this will be blocked at app level
    
    -- Step 5: Delete organization memberships (CASCADE via FK)
    DELETE FROM organization_members
    WHERE org_id IN (SELECT org_id FROM @deleted_orgs);
    
    -- Finally, delete the organizations
    DELETE FROM organizations
    WHERE org_id IN (SELECT org_id FROM @deleted_orgs);
END;
GO

-- Trigger to handle individual event deletion
-- When a single event is deleted (not via organization cascade):
--   1. Set event_id to NULL for related announcements
--   2. Delete attendance logs for the event
CREATE TRIGGER trg_events_delete_cascade
ON events
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Set event_id to NULL for announcements linked to deleted events
    UPDATE announcements
    SET event_id = NULL
    WHERE event_id IN (SELECT event_id FROM deleted);
    
    -- Delete attendance logs (cascade behavior)
    DELETE FROM attendance_logs
    WHERE event_id IN (SELECT event_id FROM deleted);
    
    -- Finally, delete the events
    DELETE FROM events
    WHERE event_id IN (SELECT event_id FROM deleted);
END;
GO

-- =====================================================
-- STEP 3: Insert Sample Data
-- =====================================================

-- -----------------------------------------------------
-- Sample Users (Password: "password123" hashed with Argon2id)
-- Note: Replace these hashes with actual Argon2id hashes in production
-- -----------------------------------------------------
SET IDENTITY_INSERT users ON;

-- Students (including those who are officers in organizations)
INSERT INTO users (user_id, student_number, employee_number, email, password_hash, first_name, last_name, role, course, year_level, section, barcode) VALUES
(1, '2023-10523', NULL, 'juan.delacruz@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Juan', 'Dela Cruz', 'student', 'BS-IT', 3, 'A', 'STU202310523'),
(2, '2023-10524', NULL, 'maria.santos@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Maria', 'Santos', 'student', 'BS-Aeronautics', 2, '1-1', 'STU202310524'),
(3, '2023-10525', NULL, 'pedro.reyes@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Pedro', 'Reyes', 'student', 'BS-IT', 3, 'A', 'STU202310525');

-- OSA Staff (employees with employee numbers - no academic details)
INSERT INTO users (user_id, student_number, employee_number, email, password_hash, first_name, last_name, role, course, year_level, section, barcode) VALUES
(4, NULL, 'EMP-2024-001', 'ana.garcia@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Ana', 'Garcia', 'osa_staff', NULL, NULL, NULL, 'EMP2024001'),
(5, NULL, 'EMP-2024-002', 'carlo.mendoza@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Carlo', 'Mendoza', 'osa_staff', NULL, NULL, NULL, 'EMP2024002');

SET IDENTITY_INSERT users OFF;
GO

-- -----------------------------------------------------
-- Sample Organizations
-- -----------------------------------------------------
SET IDENTITY_INSERT organizations ON;
INSERT INTO organizations (org_id, org_name, org_code, description, status) VALUES
(1, 'Association for Computing Machinery', 'ACM', 'Computing and technology student organization promoting excellence in IT education and innovation', 'active'),
(2, 'Institute of Governance and Public Relations', 'IGP', 'Organization managing campus events, equipment rentals, and student governance initiatives', 'active'),
(3, 'Student Council', 'SC', 'Main governing body representing all students in university affairs', 'active'),
(4, 'Engineering Society', 'ENGSOC', 'Professional organization for engineering students fostering technical excellence', 'active');
SET IDENTITY_INSERT organizations OFF;
GO

-- -----------------------------------------------------
-- Sample Organization Memberships
-- -----------------------------------------------------
INSERT INTO organization_members (user_id, org_id, role, joined_at) VALUES
-- Juan is an officer in ACM and a member of IGP
(1, 1, 'officer', '2023-08-01'),
(1, 2, 'member', '2024-02-01'),
-- Maria is president of IGP and member of Student Council
(2, 2, 'president', '2023-08-15'),
(2, 3, 'member', '2024-01-10'),
-- Pedro is treasurer of ACM
(3, 1, 'treasurer', '2023-08-01'),
-- More members
(3, 4, 'member', '2024-01-15');
GO

-- -----------------------------------------------------
-- Sample Inventory Items
-- -----------------------------------------------------
SET IDENTITY_INSERT inventory_items ON;
INSERT INTO inventory_items (item_id, org_id, item_name, barcode, category, stock_quantity, available_quantity, hourly_rate, status) VALUES
-- IGP Equipment
(1, 2, 'Shoe Cover Size L', 'ITM001', 'uniform', 10, 10, 5.00, 'available'),
(2, 2, 'Hair Net', 'ITM002', 'uniform', 20, 20, 3.00, 'available'),
(3, 2, 'Projector Sony VPL', 'ITM003', 'electronics', 2, 2, 50.00, 'available'),
(4, 2, 'Wireless Microphone Set', 'ITM004', 'electronics', 3, 3, 30.00, 'available'),
(5, 2, 'Food Service Uniform Set', 'ITM005', 'uniform', 15, 15, 10.00, 'available'),
-- ACM Equipment
(6, 1, 'Arduino Starter Kit', 'ITM006', 'equipment', 5, 5, 20.00, 'available'),
(7, 1, 'Raspberry Pi 4 Model B', 'ITM007', 'electronics', 3, 3, 40.00, 'available'),
-- Engineering Society Equipment
(8, 4, 'Digital Multimeter', 'ITM008', 'equipment', 8, 8, 15.00, 'available'),
(9, 4, 'Oscilloscope', 'ITM009', 'electronics', 2, 2, 60.00, 'available');
SET IDENTITY_INSERT inventory_items OFF;
GO

-- -----------------------------------------------------
-- Sample Events
-- -----------------------------------------------------
SET IDENTITY_INSERT events ON;
INSERT INTO events (event_id, org_id, created_by, event_name, description, location, event_date, start_time, end_time, event_type, is_published, max_participants) VALUES
-- Upcoming Events
(1, 1, 1, 'Tech Summit 2026', 'Annual technology conference featuring industry speakers and workshop sessions', 'Engineering Building Auditorium', '2026-03-15', '09:00:00', '17:00:00', 'seminar', 1, 200),
(2, 2, 2, 'Leadership Training Workshop', 'Developing leadership skills for student organization officers', 'Student Center Room 201', '2026-02-25', '14:00:00', '18:00:00', 'workshop', 1, 50),
(3, 3, 2, 'General Assembly', 'Monthly student council meeting to discuss campus initiatives', 'Main Campus Gym', '2026-02-20', '15:00:00', '17:00:00', 'meeting', 1, NULL),
(4, 4, 3, 'Engineering Fair 2026', 'Showcase of student engineering projects and innovations', 'Engineering Building Lobby', '2026-04-10', '08:00:00', '18:00:00', 'competition', 1, 150),
-- Past Events
(5, 1, 1, 'Web Development Bootcamp', 'Intensive 2-day workshop on modern web technologies', 'Computer Lab 3', '2026-02-01', '09:00:00', '16:00:00', 'workshop', 1, 30);
SET IDENTITY_INSERT events OFF;
GO

-- -----------------------------------------------------
-- Sample Attendance Logs
-- -----------------------------------------------------
INSERT INTO attendance_logs (event_id, user_id, time_in, time_out, scan_method, is_synced) VALUES
-- Past event attendance (event_id 5: Web Development Bootcamp)
(5, 1, '2026-02-01 09:15:00', '2026-02-01 16:00:00', 'qr_code', 1),
(5, 2, '2026-02-01 09:10:00', '2026-02-01 15:45:00', 'barcode', 1),
(5, 3, '2026-02-01 09:20:00', '2026-02-01 16:10:00', 'qr_code', 1);
GO

-- -----------------------------------------------------
-- Sample Rentals
-- -----------------------------------------------------
SET IDENTITY_INSERT rentals ON;
INSERT INTO rentals (rental_id, user_id, processed_by, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, payment_method, paid_at, status) VALUES
-- Completed rental
(1, 1, 2, '2026-02-10 10:00:00', '2026-02-10 14:00:00', '2026-02-10 13:45:00', 150.00, 'paid', 'cash', '2026-02-10 13:50:00', 'returned'),
-- Active rental
(2, 3, 2, '2026-02-14 09:00:00', '2026-02-15 09:00:00', NULL, 0.00, 'unpaid', NULL, NULL, 'active');
SET IDENTITY_INSERT rentals OFF;
GO

-- -----------------------------------------------------
-- Sample Rental Items
-- -----------------------------------------------------
INSERT INTO rental_items (rental_id, item_id, quantity, unit_rate, item_cost) VALUES
-- Rental 1 items (Projector for 3 hours)
(1, 3, 1, 50.00, 150.00),
-- Rental 2 items (Wireless Mic + Food Uniforms)
(2, 4, 1, 30.00, 0.00),  -- Cost will be calculated on return
(2, 5, 5, 10.00, 0.00);
GO

-- Update inventory quantities for active rentals
UPDATE inventory_items SET available_quantity = available_quantity - 1 WHERE item_id IN (4);
UPDATE inventory_items SET available_quantity = available_quantity - 5 WHERE item_id = 5;
GO

-- -----------------------------------------------------
-- Sample Announcements
-- -----------------------------------------------------
INSERT INTO announcements (org_id, created_by, event_id, title, content, audience_type, priority, is_published, published_at) VALUES
(1, 1, 1, 'Tech Summit 2026 Registration Now Open!', 'We are excited to announce that registration for Tech Summit 2026 is now open! Join us for a day filled with inspiring talks, hands-on workshops, and networking opportunities with industry professionals. Limited slots available!', 'all_students', 'high', 1, '2026-02-10 08:00:00'),
(2, 2, 2, 'Leadership Workshop Reminder', 'Reminder: Leadership Training Workshop is happening this February 25! All organization officers are encouraged to attend. Certificates will be provided.', 'officers_only', 'normal', 1, '2026-02-12 10:00:00'),
(3, 2, NULL, 'New Campus Guidelines', 'Please be informed of the updated campus guidelines effective March 1, 2026. All students are expected to comply with the new policies. Details will be sent to your university email.', 'all_students', 'urgent', 1, '2026-02-13 14:00:00'),
(2, 2, NULL, 'Equipment Rental Available', 'IGP equipment rental services are now available for all student activities. Visit our office or check the online system for available items and rates.', 'all_students', 'low', 1, '2026-02-01 09:00:00');
GO

-- -----------------------------------------------------
-- Sample Documents
-- -----------------------------------------------------
INSERT INTO documents (org_id, submitted_by, title, document_type, file_path, file_size, status, reviewed_by, review_notes, reviewed_at) VALUES
-- Approved documents
(1, 1, 'Tech Summit 2026 Proposal', 'proposal', '/documents/acm/tech_summit_2026_proposal.pdf', 2458930, 'approved', 4, 'Approved. Budget allocation confirmed.', '2026-01-20 15:30:00'),
(2, 2, 'Q4 2025 Financial Statement', 'financial_statement', '/documents/igp/financial_q4_2025.pdf', 1523487, 'approved', 5, 'Financial records verified and approved.', '2026-01-15 11:00:00'),
-- Pending documents
(1, 3, 'ACM General Assembly Minutes - February 2026', 'activity_report', '/documents/acm/ga_minutes_feb_2026.pdf', 856234, 'pending', NULL, NULL, NULL),
(4, 3, 'Engineering Fair 2026 Budget Proposal', 'proposal', '/documents/engsoc/engfair_budget_2026.pdf', 1985643, 'ssc_review', NULL, NULL, NULL),
-- Rejected document
(3, 2, 'Campus Renovation Proposal', 'proposal', '/documents/sc/renovation_proposal.pdf', 3256789, 'rejected', 4, 'Budget exceeds allocation. Please revise and resubmit with adjusted costs.', '2026-02-05 16:45:00');
GO

-- =====================================================
-- STEP 4: Verification Queries
-- =====================================================

-- Verify table counts
SELECT 'users' AS table_name, COUNT(*) AS record_count FROM users
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL
SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL
SELECT 'rentals', COUNT(*) FROM rentals
UNION ALL
SELECT 'rental_items', COUNT(*) FROM rental_items
UNION ALL
SELECT 'announcements', COUNT(*) FROM announcements;
GO

-- =====================================================
-- USEFUL QUERIES FOR TESTING
-- =====================================================

-- View all users with their roles and ID numbers
-- SELECT user_id, 
--        COALESCE(student_number, employee_number) AS id_number,
--        CONCAT(first_name, ' ', last_name) AS full_name, 
--        role, 
--        barcode 
-- FROM users;

-- View students only (including those who are officers)
-- SELECT user_id, student_number, 
--        CONCAT(first_name, ' ', last_name) AS full_name, 
--        course, year_level, section,
--        email, barcode, has_unpaid_debt
-- FROM users 
-- WHERE role = 'student'
-- ORDER BY course, year_level, section, last_name;

-- View OSA staff only
-- SELECT user_id, employee_number, 
--        CONCAT(first_name, ' ', last_name) AS full_name, 
--        email, barcode
-- FROM users 
-- WHERE role = 'osa_staff'
-- ORDER BY employee_number;

-- View organization memberships with names
-- SELECT COALESCE(u.student_number, u.employee_number) AS id_number,
--        CONCAT(u.first_name, ' ', u.last_name) AS member_name, 
--        o.org_code, o.org_name, om.role, om.joined_at
-- FROM organization_members om
-- JOIN users u ON om.user_id = u.user_id
-- JOIN organizations o ON om.org_id = o.org_id
-- WHERE om.is_active = 1
-- ORDER BY o.org_code, om.role, u.last_name;

-- View available inventory
-- SELECT i.item_id, o.org_code, i.item_name, i.barcode, i.category, 
--        i.available_quantity, i.stock_quantity, i.hourly_rate, i.status
-- FROM inventory_items i
-- JOIN organizations o ON i.org_id = o.org_id
-- WHERE i.status = 'available' AND i.available_quantity > 0
-- ORDER BY o.org_code, i.category;

-- View upcoming events
-- SELECT e.event_id, o.org_code, e.event_name, e.event_date, e.start_time, 
--        e.location, e.event_type, e.max_participants
-- FROM events e
-- JOIN organizations o ON e.org_id = o.org_id
-- WHERE e.is_published = 1 AND e.event_date >= CAST(GETDATE() AS DATE)
-- ORDER BY e.event_date, e.start_time;

-- View active rentals with customer info
-- SELECT r.rental_id, 
--        COALESCE(u.student_number, u.employee_number) AS id_number,
--        CONCAT(u.first_name, ' ', u.last_name) AS renter_name,
--        r.rent_time, r.expected_return_time, r.status, r.payment_status,
--        STRING_AGG(i.item_name, ', ') AS rented_items
-- FROM rentals r
-- JOIN users u ON r.user_id = u.user_id
-- JOIN rental_items ri ON r.rental_id = ri.rental_id
-- JOIN inventory_items i ON ri.item_id = i.item_id
-- WHERE r.status = 'active'
-- GROUP BY r.rental_id, u.student_number, u.employee_number, u.first_name, u.last_name, 
--          r.rent_time, r.expected_return_time, r.status, r.payment_status
-- ORDER BY r.rent_time DESC;

-- View pending documents for OSA approval
-- SELECT d.document_id, o.org_code, d.title, d.document_type, d.status,
--        CONCAT(u.first_name, ' ', u.last_name) AS submitted_by, d.created_at
-- FROM documents d
-- JOIN organizations o ON d.org_id = o.org_id
-- JOIN users u ON d.submitted_by = u.user_id
-- WHERE d.status IN ('pending', 'ssc_review', 'osa_review')
-- ORDER BY d.created_at ASC;

-- =====================================================
-- Setup Complete!
-- =====================================================
-- Database: aisers_db
-- Tables: 10 core tables created with triggers for auto-update timestamps
-- Sample Data: Loaded successfully (3 students, 2 OSA staff)
-- Indexes: All performance indexes applied
-- 
-- User Structure:
-- - Students (role='student'): Use student_number, have academic details (course/year/section)
--   Can be members/officers in organizations
-- - OSA Staff (role='osa_staff'): Use employee_number, no academic details
--   Employees who manage the system
-- - has_unpaid_debt only applies to students (for rental blocking)
-- - Barcode format: STU* for students, EMP* for employees
-- - Academic fields (course, year_level, section) enable attendance filtering and grouping
-- 
-- Key SQL Server Differences Applied:
-- 1. IDENTITY(1,1) instead of AUTO_INCREMENT
-- 2. BIT instead of BOOLEAN
-- 3. VARCHAR with CHECK constraints instead of ENUM
-- 4. DATETIME2 instead of TIMESTAMP
-- 5. Triggers for updated_at auto-update
-- 6. NVARCHAR(MAX) for text fields
-- 7. GO batch separators
-- 8. INSTEAD OF DELETE triggers to handle cascade paths without conflicts
-- 9. Filtered UNIQUE indexes for student_number/employee_number (allows multiple NULLs)
-- 
-- Cascade Behavior (Handled via Triggers):
-- - Organization deletion: triggers trg_organizations_delete_cascade
--   → Deletes events, announcements, memberships (documents/inventory blocked if exist)
-- - Event deletion: triggers trg_events_delete_cascade
--   → Sets announcements.event_id to NULL, deletes attendance_logs
-- - This approach avoids SQL Server's "multiple cascade path" restriction
-- 
-- Next Steps:
-- 1. Update password_hash values with real Argon2id hashes
-- 2. Configure your application's database connection
-- 3. Set up SQL Server Agent for automated backups
-- 4. Configure SQL Server Profiler for query monitoring
-- 5. Implement barcode generation for new users (STU/EMP prefix)
-- =====================================================
