-- =====================================================
-- AISERS Database Setup Script
-- Version: 1.0
-- Date: February 15, 2026
-- Target: MySQL 8.0+ / MariaDB 10.5+
-- =====================================================

-- =====================================================
-- STEP 1: Create Database
-- =====================================================
DROP DATABASE IF EXISTS aisers_db;
CREATE DATABASE aisers_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aisers_db;

-- =====================================================
-- STEP 2: Create Tables
-- =====================================================

-- -----------------------------------------------------
-- Table: users
-- Purpose: Core identity and authentication data
-- -----------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'osa_staff') NOT NULL DEFAULT 'student',
    barcode VARCHAR(50) UNIQUE,
    has_unpaid_debt BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_number (student_number),
    INDEX idx_barcode (barcode),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: organizations
-- Purpose: Student organizations registry
-- -----------------------------------------------------
CREATE TABLE organizations (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(255) UNIQUE NOT NULL,
    org_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    status ENUM('active', 'probation', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_code (org_code)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: organization_members
-- Purpose: Junction table linking users to organizations
-- -----------------------------------------------------
CREATE TABLE organization_members (
    membership_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role ENUM('member', 'officer', 'president', 'treasurer', 'secretary') DEFAULT 'member',
    joined_at DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_membership (user_id, org_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    INDEX idx_user_org_role (user_id, org_id, role),
    INDEX idx_org_members (org_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: documents
-- Purpose: Document submissions and approval workflow
-- -----------------------------------------------------
CREATE TABLE documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type ENUM('proposal', 'activity_report', 'financial_statement', 'resolution', 'other') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    status ENUM('pending', 'ssc_review', 'osa_review', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_org_status (org_id, status),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: events
-- Purpose: Events created by organizations
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
    event_type ENUM('meeting', 'seminar', 'workshop', 'competition', 'social', 'other') DEFAULT 'other',
    qr_code_url VARCHAR(500),
    is_published BOOLEAN DEFAULT FALSE,
    max_participants INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_event_date_published (event_date, is_published),
    INDEX idx_org_events (org_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: attendance_logs
-- Purpose: Event attendance tracking (time-in/time-out)
-- -----------------------------------------------------
CREATE TABLE attendance_logs (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    time_in TIMESTAMP NOT NULL,
    time_out TIMESTAMP NULL,
    duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, time_in, time_out)) STORED,
    scan_method ENUM('qr_code', 'barcode', 'manual') DEFAULT 'qr_code',
    is_synced BOOLEAN DEFAULT FALSE,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_event_user (event_id, user_id),
    INDEX idx_sync_status (is_synced)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: inventory_items
-- Purpose: Equipment and uniforms for rental
-- -----------------------------------------------------
CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    category ENUM('uniform', 'equipment', 'sports_gear', 'electronics', 'other') NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 1,
    available_quantity INT NOT NULL DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status ENUM('available', 'rented', 'maintenance', 'retired') DEFAULT 'available',
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    CHECK (available_quantity <= stock_quantity),
    INDEX idx_barcode (barcode),
    INDEX idx_org_status (org_id, status)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: rentals
-- Purpose: Rental transactions
-- -----------------------------------------------------
CREATE TABLE rentals (
    rental_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    processed_by INT NOT NULL,
    rent_time TIMESTAMP NOT NULL,
    expected_return_time TIMESTAMP NOT NULL,
    actual_return_time TIMESTAMP NULL,
    total_cost DECIMAL(10, 2) DEFAULT 0.00,
    payment_status ENUM('unpaid', 'paid', 'waived') DEFAULT 'unpaid',
    payment_method ENUM('cash', 'gcash', 'bank_transfer', 'free') NULL,
    paid_at TIMESTAMP NULL,
    status ENUM('active', 'returned', 'overdue', 'cancelled') DEFAULT 'active',
    notes TEXT,
    version INT DEFAULT 1,
    is_synced BOOLEAN DEFAULT FALSE,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_user_payment (user_id, payment_status),
    INDEX idx_status_due (status, expected_return_time),
    INDEX idx_sync_status (is_synced)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: rental_items
-- Purpose: Junction table for multi-item rentals
-- -----------------------------------------------------
CREATE TABLE rental_items (
    rental_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rental_item (rental_id, item_id),
    FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE RESTRICT,
    INDEX idx_rental_item (rental_id, item_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table: announcements
-- Purpose: Posts created by organizations
-- -----------------------------------------------------
CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_id INT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience_type ENUM('all_students', 'members_only', 'officers_only') DEFAULT 'all_students',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE SET NULL,
    INDEX idx_org_published (org_id, is_published, published_at),
    INDEX idx_event_announcements (event_id)
) ENGINE=InnoDB;

-- =====================================================
-- STEP 3: Insert Sample Data
-- =====================================================

-- -----------------------------------------------------
-- Sample Users (Password: "password123" hashed with Argon2id)
-- Note: Replace these hashes with actual Argon2id hashes in production
-- -----------------------------------------------------
INSERT INTO users (student_number, email, password_hash, first_name, last_name, role, barcode) VALUES
('2023-10523', 'juan.delacruz@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Juan', 'Dela Cruz', 'student', 'BC202310523'),
('2023-10524', 'maria.santos@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Maria', 'Santos', 'student', 'BC202310524'),
('2023-10525', 'pedro.reyes@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Pedro', 'Reyes', 'student', 'BC202310525'),
('2023-10526', 'ana.garcia@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Ana', 'Garcia', 'osa_staff', 'BC202310526'),
('2023-10527', 'carlo.mendoza@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Z3K5Y', 'Carlo', 'Mendoza', 'osa_staff', 'BC202310527');

-- -----------------------------------------------------
-- Sample Organizations
-- -----------------------------------------------------
INSERT INTO organizations (org_name, org_code, description, status) VALUES
('Association for Computing Machinery', 'ACM', 'Computing and technology student organization promoting excellence in IT education and innovation', 'active'),
('Institute of Governance and Public Relations', 'IGP', 'Organization managing campus events, equipment rentals, and student governance initiatives', 'active'),
('Student Council', 'SC', 'Main governing body representing all students in university affairs', 'active'),
('Engineering Society', 'ENGSOC', 'Professional organization for engineering students fostering technical excellence', 'active');

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

-- -----------------------------------------------------
-- Sample Inventory Items
-- -----------------------------------------------------
INSERT INTO inventory_items (org_id, item_name, barcode, category, stock_quantity, available_quantity, hourly_rate, status) VALUES
-- IGP Equipment
(2, 'Shoe Cover Size L', 'ITM001', 'uniform', 10, 10, 5.00, 'available'),
(2, 'Hair Net', 'ITM002', 'uniform', 20, 20, 3.00, 'available'),
(2, 'Projector Sony VPL', 'ITM003', 'electronics', 2, 2, 50.00, 'available'),
(2, 'Wireless Microphone Set', 'ITM004', 'electronics', 3, 3, 30.00, 'available'),
(2, 'Food Service Uniform Set', 'ITM005', 'uniform', 15, 15, 10.00, 'available'),
-- ACM Equipment
(1, 'Arduino Starter Kit', 'ITM006', 'equipment', 5, 5, 20.00, 'available'),
(1, 'Raspberry Pi 4 Model B', 'ITM007', 'electronics', 3, 3, 40.00, 'available'),
-- Engineering Society Equipment
(4, 'Digital Multimeter', 'ITM008', 'equipment', 8, 8, 15.00, 'available'),
(4, 'Oscilloscope', 'ITM009', 'electronics', 2, 2, 60.00, 'available');

-- -----------------------------------------------------
-- Sample Events
-- -----------------------------------------------------
INSERT INTO events (org_id, created_by, event_name, description, location, event_date, start_time, end_time, event_type, is_published, max_participants) VALUES
-- Upcoming Events
(1, 1, 'Tech Summit 2026', 'Annual technology conference featuring industry speakers and workshop sessions', 'Engineering Building Auditorium', '2026-03-15', '09:00:00', '17:00:00', 'seminar', TRUE, 200),
(2, 2, 'Leadership Training Workshop', 'Developing leadership skills for student organization officers', 'Student Center Room 201', '2026-02-25', '14:00:00', '18:00:00', 'workshop', TRUE, 50),
(3, 2, 'General Assembly', 'Monthly student council meeting to discuss campus initiatives', 'Main Campus Gym', '2026-02-20', '15:00:00', '17:00:00', 'meeting', TRUE, NULL),
(4, 3, 'Engineering Fair 2026', 'Showcase of student engineering projects and innovations', 'Engineering Building Lobby', '2026-04-10', '08:00:00', '18:00:00', 'competition', TRUE, 150),
-- Past Events
(1, 1, 'Web Development Bootcamp', 'Intensive 2-day workshop on modern web technologies', 'Computer Lab 3', '2026-02-01', '09:00:00', '16:00:00', 'workshop', TRUE, 30);

-- -----------------------------------------------------
-- Sample Attendance Logs
-- -----------------------------------------------------
INSERT INTO attendance_logs (event_id, user_id, time_in, time_out, scan_method, is_synced) VALUES
-- Past event attendance (event_id 5: Web Development Bootcamp)
(5, 1, '2026-02-01 09:15:00', '2026-02-01 16:00:00', 'qr_code', TRUE),
(5, 2, '2026-02-01 09:10:00', '2026-02-01 15:45:00', 'barcode', TRUE),
(5, 3, '2026-02-01 09:20:00', '2026-02-01 16:10:00', 'qr_code', TRUE);

-- -----------------------------------------------------
-- Sample Rentals
-- -----------------------------------------------------
INSERT INTO rentals (user_id, processed_by, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, payment_method, paid_at, status) VALUES
-- Completed rental
(1, 2, '2026-02-10 10:00:00', '2026-02-10 14:00:00', '2026-02-10 13:45:00', 150.00, 'paid', 'cash', '2026-02-10 13:50:00', 'returned'),
-- Active rental
(3, 2, '2026-02-14 09:00:00', '2026-02-15 09:00:00', NULL, 0.00, 'unpaid', NULL, NULL, 'active');

-- -----------------------------------------------------
-- Sample Rental Items
-- -----------------------------------------------------
INSERT INTO rental_items (rental_id, item_id, quantity, unit_rate, item_cost) VALUES
-- Rental 1 items (Projector for 3 hours)
(1, 3, 1, 50.00, 150.00),
-- Rental 2 items (Wireless Mic + Food Uniforms)
(2, 4, 1, 30.00, 0.00),  -- Cost will be calculated on return
(2, 5, 5, 10.00, 0.00);

-- Update inventory quantities for active rentals
UPDATE inventory_items SET available_quantity = available_quantity - 1 WHERE item_id IN (4);
UPDATE inventory_items SET available_quantity = available_quantity - 5 WHERE item_id = 5;

-- -----------------------------------------------------
-- Sample Announcements
-- -----------------------------------------------------
INSERT INTO announcements (org_id, created_by, event_id, title, content, audience_type, priority, is_published, published_at) VALUES
(1, 1, 1, 'Tech Summit 2026 Registration Now Open!', 'We are excited to announce that registration for Tech Summit 2026 is now open! Join us for a day filled with inspiring talks, hands-on workshops, and networking opportunities with industry professionals. Limited slots available!', 'all_students', 'high', TRUE, '2026-02-10 08:00:00'),
(2, 2, 2, 'Leadership Workshop Reminder', 'Reminder: Leadership Training Workshop is happening this February 25! All organization officers are encouraged to attend. Certificates will be provided.', 'officers_only', 'normal', TRUE, '2026-02-12 10:00:00'),
(3, 2, NULL, 'New Campus Guidelines', 'Please be informed of the updated campus guidelines effective March 1, 2026. All students are expected to comply with the new policies. Details will be sent to your university email.', 'all_students', 'urgent', TRUE, '2026-02-13 14:00:00'),
(2, 2, NULL, 'Equipment Rental Available', 'IGP equipment rental services are now available for all student activities. Visit our office or check the online system for available items and rates.', 'all_students', 'low', TRUE, '2026-02-01 09:00:00');

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

-- =====================================================
-- USEFUL QUERIES FOR TESTING
-- =====================================================

-- View all users with their roles
-- SELECT user_id, student_number, CONCAT(first_name, ' ', last_name) AS full_name, role, barcode FROM users;

-- View organization memberships with names
-- SELECT u.student_number, CONCAT(u.first_name, ' ', u.last_name) AS member_name, 
--        o.org_code, o.org_name, om.role, om.joined_at
-- FROM organization_members om
-- JOIN users u ON om.user_id = u.user_id
-- JOIN organizations o ON om.org_id = o.org_id
-- WHERE om.is_active = TRUE
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
-- WHERE e.is_published = TRUE AND e.event_date >= CURDATE()
-- ORDER BY e.event_date, e.start_time;

-- View active rentals with customer info
-- SELECT r.rental_id, u.student_number, CONCAT(u.first_name, ' ', u.last_name) AS renter_name,
--        r.rent_time, r.expected_return_time, r.status, r.payment_status,
--        GROUP_CONCAT(i.item_name SEPARATOR ', ') AS rented_items
-- FROM rentals r
-- JOIN users u ON r.user_id = u.user_id
-- JOIN rental_items ri ON r.rental_id = ri.rental_id
-- JOIN inventory_items i ON ri.item_id = i.item_id
-- WHERE r.status = 'active'
-- GROUP BY r.rental_id
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
-- Tables: 10 core tables created
-- Sample Data: Loaded successfully
-- Indexes: All performance indexes applied
-- 
-- Next Steps:
-- 1. Update password_hash values with real Argon2id hashes
-- 2. Configure your application's database connection
-- 3. Set up regular backups
-- 4. Monitor query performance with slow query logs
-- =====================================================
