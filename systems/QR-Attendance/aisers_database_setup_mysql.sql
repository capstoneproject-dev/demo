-- =====================================================
-- AISERS Database Setup Script (MySQL/MariaDB for XAMPP/phpMyAdmin)
-- Version: 1.0
-- Date: February 22, 2026
-- Target: MySQL 8.0+ / MariaDB 10.4+
-- Source parity: aisers_database_setup_sqlserver.sql
-- =====================================================

-- =====================================================
-- STEP 1: Create Database
-- =====================================================
DROP DATABASE IF EXISTS aisers_db;
CREATE DATABASE aisers_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aisers_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- STEP 2: Create Tables
-- =====================================================

-- -----------------------------------------------------
-- Table: users
-- -----------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    student_number VARCHAR(20) NULL,
    employee_number VARCHAR(20) NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    course VARCHAR(50) NULL,
    year_level INT NULL,
    section VARCHAR(20) NULL,
    barcode VARCHAR(50) UNIQUE,
    has_unpaid_debt TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_role CHECK (role IN ('student', 'osa_staff')),
    CONSTRAINT chk_users_year_level CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 5),
    CONSTRAINT chk_user_id_number CHECK (
        (role = 'student' AND student_number IS NOT NULL AND employee_number IS NULL) OR
        (role = 'osa_staff' AND employee_number IS NOT NULL AND student_number IS NULL)
    ),
    CONSTRAINT chk_user_academic_fields CHECK (
        (role = 'student') OR
        (role = 'osa_staff' AND course IS NULL AND year_level IS NULL AND section IS NULL)
    )
) ENGINE=InnoDB;

CREATE UNIQUE INDEX idx_student_number ON users(student_number);
CREATE UNIQUE INDEX idx_employee_number ON users(employee_number);
CREATE INDEX idx_barcode ON users(barcode);
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_course_year_section ON users(course, year_level, section);

-- -----------------------------------------------------
-- Table: organizations
-- -----------------------------------------------------
CREATE TABLE organizations (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL UNIQUE,
    org_code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    logo_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_organizations_status CHECK (status IN ('active', 'probation', 'suspended'))
) ENGINE=InnoDB;

CREATE INDEX idx_org_code ON organizations(org_code);

-- -----------------------------------------------------
-- Table: organization_members
-- -----------------------------------------------------
CREATE TABLE organization_members (
    membership_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at DATE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_membership UNIQUE (user_id, org_id),
    CONSTRAINT chk_orgmembers_role CHECK (role IN ('member', 'officer', 'president', 'treasurer', 'secretary')),
    CONSTRAINT fk_orgmembers_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_orgmembers_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_user_org_role ON organization_members(user_id, org_id, role);
CREATE INDEX idx_org_members ON organization_members(org_id);

-- -----------------------------------------------------
-- Table: documents
-- -----------------------------------------------------
CREATE TABLE documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    file_extension VARCHAR(20) NOT NULL,
    storage_scope VARCHAR(20) NOT NULL DEFAULT 'private',
    file_size INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_documents_type CHECK (document_type IN ('proposal', 'activity_report', 'financial_statement', 'resolution', 'other')),
    CONSTRAINT chk_documents_file_ext CHECK (file_extension IN ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png')),
    CONSTRAINT chk_documents_storage_scope CHECK (storage_scope IN ('private')),
    CONSTRAINT chk_documents_file_size CHECK (file_size > 0),
    CONSTRAINT chk_documents_status CHECK (status IN ('pending', 'ssc_review', 'osa_review', 'approved', 'rejected')),
    CONSTRAINT chk_documents_private_path CHECK (
        file_path NOT LIKE '/%' AND
        file_path NOT LIKE '\\%' AND
        file_path NOT LIKE 'http%' AND
        file_path NOT LIKE '%..%' AND
        file_path NOT LIKE '%wwwroot%' AND
        file_path NOT LIKE '%public%' AND
        file_path NOT LIKE '%htdocs%'
    ),
    CONSTRAINT fk_documents_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    CONSTRAINT fk_documents_submitted FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_documents_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_org_status ON documents(org_id, status);
CREATE INDEX idx_status ON documents(status);
CREATE UNIQUE INDEX idx_documents_file_path ON documents(file_path);

-- -----------------------------------------------------
-- Table: events
-- -----------------------------------------------------
CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'other',
    qr_code_url VARCHAR(500),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at DATETIME NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    max_participants INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_events_event_type CHECK (event_type IN ('meeting', 'seminar', 'workshop', 'competition', 'social', 'other')),
    CONSTRAINT chk_events_approval_status CHECK (approval_status IN ('draft', 'pending', 'ssc_review', 'osa_review', 'approved', 'rejected')),
    CONSTRAINT chk_events_time_range CHECK (end_time > start_time),
    CONSTRAINT chk_events_publish_requires_approval CHECK (is_published = 0 OR approval_status = 'approved'),
    CONSTRAINT fk_events_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_events_created FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_events_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_event_date_published ON events(event_date, is_published);
CREATE INDEX idx_org_events ON events(org_id);
CREATE INDEX idx_events_approval_status ON events(approval_status);

-- -----------------------------------------------------
-- Table: attendance_logs
-- -----------------------------------------------------
CREATE TABLE attendance_logs (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    time_in DATETIME NOT NULL,
    time_out DATETIME NULL,
    duration_minutes INT GENERATED ALWAYS AS (
        CASE
            WHEN time_out IS NULL THEN NULL
            ELSE TIMESTAMPDIFF(MINUTE, time_in, time_out)
        END
    ) STORED,
    scan_method VARCHAR(20) NOT NULL DEFAULT 'qr_code',
    is_synced TINYINT(1) NOT NULL DEFAULT 0,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attendance UNIQUE (event_id, user_id),
    CONSTRAINT chk_attendance_scan_method CHECK (scan_method IN ('qr_code', 'barcode', 'manual')),
    CONSTRAINT chk_attendance_time_range CHECK (time_out IS NULL OR time_out >= time_in),
    CONSTRAINT fk_attendance_events FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_event_user ON attendance_logs(event_id, user_id);
CREATE INDEX idx_sync_status ON attendance_logs(is_synced);

-- -----------------------------------------------------
-- Table: inventory_items
-- -----------------------------------------------------
CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 1,
    available_quantity INT NOT NULL DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inventory_category CHECK (category IN ('uniform', 'equipment', 'sports_gear', 'electronics', 'other')),
    CONSTRAINT chk_inventory_status CHECK (status IN ('available', 'rented', 'maintenance', 'retired')),
    CONSTRAINT chk_stock_quantity_positive CHECK (stock_quantity >= 0),
    CONSTRAINT chk_available_quantity_nonnegative CHECK (available_quantity >= 0),
    CONSTRAINT chk_available_quantity CHECK (available_quantity <= stock_quantity),
    CONSTRAINT chk_hourly_rate_nonnegative CHECK (hourly_rate >= 0),
    CONSTRAINT fk_inventory_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_barcode_inventory ON inventory_items(barcode);
CREATE INDEX idx_org_status_inventory ON inventory_items(org_id, status);

-- -----------------------------------------------------
-- Table: rentals
-- -----------------------------------------------------
CREATE TABLE rentals (
    rental_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    processed_by INT NOT NULL,
    rent_time DATETIME NOT NULL,
    expected_return_time DATETIME NOT NULL,
    actual_return_time DATETIME NULL,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(20) NULL,
    paid_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes TEXT,
    version INT NOT NULL DEFAULT 1,
    is_synced TINYINT(1) NOT NULL DEFAULT 0,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rentals_payment_status CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
    CONSTRAINT chk_rentals_payment_method CHECK (payment_method IN ('cash', 'gcash', 'bank_transfer', 'free') OR payment_method IS NULL),
    CONSTRAINT chk_rentals_status CHECK (status IN ('active', 'returned', 'overdue', 'cancelled')),
    CONSTRAINT chk_rentals_time_order CHECK (
        expected_return_time >= rent_time AND
        (actual_return_time IS NULL OR actual_return_time >= rent_time)
    ),
    CONSTRAINT chk_rentals_total_cost_nonnegative CHECK (total_cost >= 0),
    CONSTRAINT fk_rentals_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_rentals_processed FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_user_payment ON rentals(user_id, payment_status);
CREATE INDEX idx_status_due ON rentals(status, expected_return_time);
CREATE INDEX idx_sync_status_rentals ON rentals(is_synced);

-- -----------------------------------------------------
-- Table: rental_items
-- -----------------------------------------------------
CREATE TABLE rental_items (
    rental_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_rental_item UNIQUE (rental_id, item_id),
    CONSTRAINT chk_rental_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_rental_items_unit_rate_nonnegative CHECK (unit_rate >= 0),
    CONSTRAINT chk_rental_items_item_cost_nonnegative CHECK (item_cost >= 0),
    CONSTRAINT fk_rentalitems_rentals FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE,
    CONSTRAINT fk_rentalitems_inventory FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_rental_item ON rental_items(rental_id, item_id);

-- -----------------------------------------------------
-- Table: announcements
-- -----------------------------------------------------
CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_id INT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience_type VARCHAR(20) NOT NULL DEFAULT 'all_students',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at DATETIME NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_announcements_audience_type CHECK (audience_type IN ('all_students', 'members_only', 'officers_only')),
    CONSTRAINT chk_announcements_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT chk_announcements_approval_status CHECK (approval_status IN ('draft', 'pending', 'ssc_review', 'osa_review', 'approved', 'rejected')),
    CONSTRAINT chk_announcements_publish_requires_approval CHECK (is_published = 0 OR approval_status = 'approved'),
    CONSTRAINT fk_announcements_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_announcements_created FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_announcements_events FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE SET NULL,
    CONSTRAINT fk_announcements_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_org_published ON announcements(org_id, is_published, published_at);
CREATE INDEX idx_event_announcements ON announcements(event_id);
CREATE INDEX idx_announcements_approval_status ON announcements(approval_status);

-- -----------------------------------------------------
-- Table: document_annotations
-- -----------------------------------------------------
CREATE TABLE document_annotations (
    annotation_id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    annotation_type VARCHAR(20) NOT NULL,
    page_number INT NOT NULL,
    x_position DECIMAL(10,4) NOT NULL,
    y_position DECIMAL(10,4) NOT NULL,
    width DECIMAL(10,4) NULL,
    height DECIMAL(10,4) NULL,
    comment_text TEXT NULL,
    color_hex VARCHAR(7) NULL,
    is_resolved TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_doc_annotations_type CHECK (annotation_type IN ('highlight', 'comment')),
    CONSTRAINT chk_doc_annotations_page CHECK (page_number > 0),
    CONSTRAINT chk_doc_annotations_coords CHECK (
        x_position >= 0 AND y_position >= 0 AND
        (width IS NULL OR width >= 0) AND
        (height IS NULL OR height >= 0)
    ),
    CONSTRAINT chk_doc_annotations_comment_required CHECK (
        (annotation_type = 'comment' AND comment_text IS NOT NULL) OR
        (annotation_type = 'highlight')
    ),
    CONSTRAINT chk_doc_annotations_color_hex CHECK (
        color_hex IS NULL OR color_hex REGEXP '^#[0-9A-Fa-f]{6}$'
    ),
    CONSTRAINT fk_doc_annotations_documents FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_annotations_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_doc_annotations_document_page ON document_annotations(document_id, page_number);
CREATE INDEX idx_doc_annotations_user ON document_annotations(user_id);

-- -----------------------------------------------------
-- Table: organization_audits
-- -----------------------------------------------------
CREATE TABLE organization_audits (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    audit_scope VARCHAR(100) NULL,
    audited_by INT NULL,
    audited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_org_audits_status CHECK (status IN ('not_audited', 'in_progress', 'passed', 'passed_with_findings', 'failed')),
    CONSTRAINT fk_org_audits_orgs FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_audits_users FOREIGN KEY (audited_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_org_audits_org_date ON organization_audits(org_id, audited_at DESC);
CREATE INDEX idx_org_audits_status ON organization_audits(status);

-- -----------------------------------------------------
-- Triggers
-- -----------------------------------------------------
DELIMITER $$

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_orgmembers_updated_at
BEFORE UPDATE ON organization_members
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_attendance_modified_at
BEFORE UPDATE ON attendance_logs
FOR EACH ROW
BEGIN
    SET NEW.modified_at = CURRENT_TIMESTAMP;
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_rentals_modified_at
BEFORE UPDATE ON rentals
FOR EACH ROW
BEGIN
    SET NEW.modified_at = CURRENT_TIMESTAMP;
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_rentalitems_updated_at
BEFORE UPDATE ON rental_items
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_document_annotations_updated_at
BEFORE UPDATE ON document_annotations
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_organization_audits_updated_at
BEFORE UPDATE ON organization_audits
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_rentals_block_unpaid_debt
BEFORE INSERT ON rentals
FOR EACH ROW
BEGIN
    DECLARE v_role VARCHAR(20);
    DECLARE v_has_unpaid_debt TINYINT(1);

    SELECT role, has_unpaid_debt
    INTO v_role, v_has_unpaid_debt
    FROM users
    WHERE user_id = NEW.user_id;

    IF v_role = 'student' AND v_has_unpaid_debt = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Rental blocked: student account has unpaid debt.';
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- STEP 3: Insert Sample Data
-- =====================================================

INSERT INTO users (user_id, student_number, employee_number, email, password_hash, first_name, last_name, role, course, year_level, section, barcode) VALUES
(1, '2023-10523', NULL, 'juan.delacruz@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Juan', 'Dela Cruz', 'student', 'BS-IT', 3, 'A', 'STU202310523'),
(2, '2023-10524', NULL, 'maria.santos@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Maria', 'Santos', 'student', 'BS-Aeronautics', 2, '1-1', 'STU202310524'),
(3, '2023-10525', NULL, 'pedro.reyes@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Pedro', 'Reyes', 'student', 'BS-IT', 3, 'A', 'STU202310525'),
(4, NULL, 'EMP-2024-001', 'ana.garcia@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Ana', 'Garcia', 'osa_staff', NULL, NULL, NULL, 'EMP2024001'),
(5, NULL, 'EMP-2024-002', 'carlo.mendoza@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Carlo', 'Mendoza', 'osa_staff', NULL, NULL, NULL, 'EMP2024002');

INSERT INTO organizations (org_id, org_name, org_code, description, status) VALUES
(1, 'Association for Computing Machinery', 'ACM', 'Computing and technology student organization promoting excellence in IT education and innovation', 'active'),
(2, 'Institute of Governance and Public Relations', 'IGP', 'Organization managing campus events, equipment rentals, and student governance initiatives', 'active'),
(3, 'Student Council', 'SC', 'Main governing body representing all students in university affairs', 'active'),
(4, 'Engineering Society', 'ENGSOC', 'Professional organization for engineering students fostering technical excellence', 'active');

INSERT INTO organization_members (user_id, org_id, role, joined_at) VALUES
(1, 1, 'officer', '2023-08-01'),
(1, 2, 'member', '2024-02-01'),
(2, 2, 'president', '2023-08-15'),
(2, 3, 'member', '2024-01-10'),
(3, 1, 'treasurer', '2023-08-01'),
(3, 4, 'member', '2024-01-15');

INSERT INTO inventory_items (item_id, org_id, item_name, barcode, category, stock_quantity, available_quantity, hourly_rate, status) VALUES
(1, 2, 'Shoe Cover Size L', 'ITM001', 'uniform', 10, 10, 5.00, 'available'),
(2, 2, 'Hair Net', 'ITM002', 'uniform', 20, 20, 3.00, 'available'),
(3, 2, 'Projector Sony VPL', 'ITM003', 'electronics', 2, 2, 50.00, 'available'),
(4, 2, 'Wireless Microphone Set', 'ITM004', 'electronics', 3, 3, 30.00, 'available'),
(5, 2, 'Food Service Uniform Set', 'ITM005', 'uniform', 15, 15, 10.00, 'available'),
(6, 1, 'Arduino Starter Kit', 'ITM006', 'equipment', 5, 5, 20.00, 'available'),
(7, 1, 'Raspberry Pi 4 Model B', 'ITM007', 'electronics', 3, 3, 40.00, 'available'),
(8, 4, 'Digital Multimeter', 'ITM008', 'equipment', 8, 8, 15.00, 'available'),
(9, 4, 'Oscilloscope', 'ITM009', 'electronics', 2, 2, 60.00, 'available');

INSERT INTO events (event_id, org_id, created_by, event_name, description, location, event_date, start_time, end_time, event_type, approval_status, is_published, max_participants) VALUES
(1, 1, 1, 'Tech Summit 2026', 'Annual technology conference featuring industry speakers and workshop sessions', 'Engineering Building Auditorium', '2026-03-15', '09:00:00', '17:00:00', 'seminar', 'approved', 1, 200),
(2, 2, 2, 'Leadership Training Workshop', 'Developing leadership skills for student organization officers', 'Student Center Room 201', '2026-02-25', '14:00:00', '18:00:00', 'workshop', 'approved', 1, 50),
(3, 3, 2, 'General Assembly', 'Monthly student council meeting to discuss campus initiatives', 'Main Campus Gym', '2026-02-20', '15:00:00', '17:00:00', 'meeting', 'approved', 1, NULL),
(4, 4, 3, 'Engineering Fair 2026', 'Showcase of student engineering projects and innovations', 'Engineering Building Lobby', '2026-04-10', '08:00:00', '18:00:00', 'competition', 'approved', 1, 150),
(5, 1, 1, 'Web Development Bootcamp', 'Intensive 2-day workshop on modern web technologies', 'Computer Lab 3', '2026-02-01', '09:00:00', '16:00:00', 'workshop', 'approved', 1, 30);

INSERT INTO attendance_logs (event_id, user_id, time_in, time_out, scan_method, is_synced) VALUES
(5, 1, '2026-02-01 09:15:00', '2026-02-01 16:00:00', 'qr_code', 1),
(5, 2, '2026-02-01 09:10:00', '2026-02-01 15:45:00', 'barcode', 1),
(5, 3, '2026-02-01 09:20:00', '2026-02-01 16:10:00', 'qr_code', 1);

INSERT INTO rentals (rental_id, user_id, processed_by, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, payment_method, paid_at, status) VALUES
(1, 1, 2, '2026-02-10 10:00:00', '2026-02-10 14:00:00', '2026-02-10 13:45:00', 150.00, 'paid', 'cash', '2026-02-10 13:50:00', 'returned'),
(2, 3, 2, '2026-02-14 09:00:00', '2026-02-15 09:00:00', NULL, 0.00, 'unpaid', NULL, NULL, 'active');

INSERT INTO rental_items (rental_id, item_id, quantity, unit_rate, item_cost) VALUES
(1, 3, 1, 50.00, 150.00),
(2, 4, 1, 30.00, 0.00),
(2, 5, 5, 10.00, 0.00);

UPDATE inventory_items SET available_quantity = available_quantity - 1 WHERE item_id IN (4);
UPDATE inventory_items SET available_quantity = available_quantity - 5 WHERE item_id = 5;

INSERT INTO announcements (org_id, created_by, event_id, title, content, audience_type, priority, approval_status, is_published, published_at) VALUES
(1, 1, 1, 'Tech Summit 2026 Registration Now Open!', 'We are excited to announce that registration for Tech Summit 2026 is now open! Join us for a day filled with inspiring talks, hands-on workshops, and networking opportunities with industry professionals. Limited slots available!', 'all_students', 'high', 'approved', 1, '2026-02-10 08:00:00'),
(2, 2, 2, 'Leadership Workshop Reminder', 'Reminder: Leadership Training Workshop is happening this February 25! All organization officers are encouraged to attend. Certificates will be provided.', 'officers_only', 'normal', 'approved', 1, '2026-02-12 10:00:00'),
(3, 2, NULL, 'New Campus Guidelines', 'Please be informed of the updated campus guidelines effective March 1, 2026. All students are expected to comply with the new policies. Details will be sent to your university email.', 'all_students', 'urgent', 'approved', 1, '2026-02-13 14:00:00'),
(2, 2, NULL, 'Equipment Rental Available', 'IGP equipment rental services are now available for all student activities. Visit our office or check the online system for available items and rates.', 'all_students', 'low', 'approved', 1, '2026-02-01 09:00:00');

INSERT INTO documents (org_id, submitted_by, title, document_type, file_path, original_filename, mime_type, file_extension, storage_scope, file_size, status, reviewed_by, review_notes, reviewed_at) VALUES
(1, 1, 'Tech Summit 2026 Proposal', 'proposal', 'org_1/2026/01/tech_summit_2026_proposal.pdf', 'tech_summit_2026_proposal.pdf', 'application/pdf', 'pdf', 'private', 2458930, 'approved', 4, 'Approved. Budget allocation confirmed.', '2026-01-20 15:30:00'),
(2, 2, 'Q4 2025 Financial Statement', 'financial_statement', 'org_2/2026/01/financial_q4_2025.pdf', 'financial_q4_2025.pdf', 'application/pdf', 'pdf', 'private', 1523487, 'approved', 5, 'Financial records verified and approved.', '2026-01-15 11:00:00'),
(1, 3, 'ACM General Assembly Minutes - February 2026', 'activity_report', 'org_1/2026/02/ga_minutes_feb_2026.pdf', 'ga_minutes_feb_2026.pdf', 'application/pdf', 'pdf', 'private', 856234, 'pending', NULL, NULL, NULL),
(4, 3, 'Engineering Fair 2026 Budget Proposal', 'proposal', 'org_4/2026/02/engfair_budget_2026.pdf', 'engfair_budget_2026.pdf', 'application/pdf', 'pdf', 'private', 1985643, 'ssc_review', NULL, NULL, NULL),
(3, 2, 'Campus Renovation Proposal', 'proposal', 'org_3/2026/02/renovation_proposal.pdf', 'renovation_proposal.pdf', 'application/pdf', 'pdf', 'private', 3256789, 'rejected', 4, 'Budget exceeds allocation. Please revise and resubmit with adjusted costs.', '2026-02-05 16:45:00');

INSERT INTO organization_audits (org_id, status, audit_scope, audited_by, audited_at, notes) VALUES
(1, 'passed', 'Annual compliance review', 4, '2026-01-12 10:00:00', 'All required compliance documents were complete and valid.'),
(2, 'passed_with_findings', 'Operational process review', 5, '2026-01-18 14:30:00', 'Minor process findings were issued for follow-up next cycle.'),
(3, 'in_progress', 'Policy and governance review', 4, '2026-02-10 09:00:00', 'Audit started. Pending final assessor notes.'),
(4, 'not_audited', NULL, NULL, '2026-01-01 00:00:00', 'No completed audit yet for this period.');

INSERT INTO document_annotations (document_id, user_id, annotation_type, page_number, x_position, y_position, width, height, comment_text, color_hex) VALUES
(1, 4, 'highlight', 2, 124.5000, 342.2500, 180.0000, 20.0000, NULL, '#FFF59D'),
(1, 4, 'comment', 2, 320.0000, 360.0000, NULL, NULL, 'Please confirm if this budget line already includes logistics.', '#64B5F6'),
(2, 5, 'comment', 1, 210.0000, 410.0000, NULL, NULL, 'Attach supporting receipt summary in the next revision.', '#81C784');

-- =====================================================
-- STEP 4: Verification Queries
-- =====================================================
SELECT 'users' AS table_name, COUNT(*) AS record_count FROM users
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'attendance_logs', COUNT(*) FROM attendance_logs
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'rentals', COUNT(*) FROM rentals
UNION ALL SELECT 'rental_items', COUNT(*) FROM rental_items
UNION ALL SELECT 'announcements', COUNT(*) FROM announcements
UNION ALL SELECT 'organization_audits', COUNT(*) FROM organization_audits
UNION ALL SELECT 'document_annotations', COUNT(*) FROM document_annotations;

-- Useful query equivalents for MySQL/MariaDB:
-- 1) Upcoming events date filter: use CURDATE() instead of GETDATE()
-- 2) Active rentals item aggregation: use GROUP_CONCAT instead of STRING_AGG
-- 3) Latest audit per org: use LEFT JOIN with derived MAX(audited_at/audit_id)
