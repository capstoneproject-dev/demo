-- =====================================================
-- AISERS Multi-Organization Database Setup (MySQL/MariaDB)
-- Version: 2.0 (Fresh schema)
-- Date: February 23, 2026
-- =====================================================

DROP DATABASE IF EXISTS aisers_db;
CREATE DATABASE aisers_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aisers_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 1) Core Identity and Organization Tables
-- =====================================================

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    student_number VARCHAR(20) NULL UNIQUE,
    employee_number VARCHAR(20) NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'student',
    has_unpaid_debt TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_account_type CHECK (account_type IN ('student', 'osa_staff'))
) ENGINE=InnoDB;

CREATE TABLE organizations (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL UNIQUE,
    org_code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT NULL,
    logo_url VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_org_status CHECK (status IN ('active', 'probation', 'suspended'))
) ENGINE=InnoDB;

CREATE TABLE org_roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    can_access_org_dashboard TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_role_name UNIQUE (org_id, role_name),
    CONSTRAINT uq_org_role_org_roleid UNIQUE (org_id, role_id),
    CONSTRAINT fk_org_roles_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE organization_members (
    membership_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role_id INT NOT NULL,
    joined_at DATE NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_org UNIQUE (user_id, org_id),
    CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_role FOREIGN KEY (role_id) REFERENCES org_roles(role_id) ON DELETE RESTRICT,
    CONSTRAINT fk_org_members_org_role FOREIGN KEY (org_id, role_id) REFERENCES org_roles(org_id, role_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================
-- 2) Organization-Scoped Data Tables
-- =====================================================

CREATE TABLE inventory_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_category_name UNIQUE (org_id, category_name),
    CONSTRAINT uq_inventory_category_org_catid UNIQUE (org_id, category_id),
    CONSTRAINT fk_inventory_categories_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 1,
    available_quantity INT NOT NULL DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inventory_status CHECK (status IN ('available', 'rented', 'maintenance')),
    CONSTRAINT chk_stock_quantity CHECK (stock_quantity >= 0),
    CONSTRAINT chk_available_quantity CHECK (available_quantity >= 0 AND available_quantity <= stock_quantity),
    CONSTRAINT chk_hourly_rate CHECK (hourly_rate >= 0),
    CONSTRAINT fk_inventory_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_category FOREIGN KEY (category_id) REFERENCES inventory_categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_org_category FOREIGN KEY (org_id, category_id) REFERENCES inventory_categories(org_id, category_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE rentals (
    rental_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    renter_user_id INT NOT NULL,
    processed_by_user_id INT NOT NULL,
    rent_time DATETIME NOT NULL,
    expected_return_time DATETIME NOT NULL,
    actual_return_time DATETIME NULL,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(20) NULL,
    paid_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rentals_payment_status CHECK (payment_status IN ('unpaid', 'paid')),
    CONSTRAINT chk_rentals_payment_method CHECK (payment_method = 'cash' OR payment_method IS NULL),
    CONSTRAINT chk_rentals_status CHECK (status IN ('active', 'returned', 'overdue', 'cancelled')),
    CONSTRAINT chk_rentals_time_order CHECK (expected_return_time >= rent_time AND (actual_return_time IS NULL OR actual_return_time >= rent_time)),
    CONSTRAINT chk_rentals_total_cost CHECK (total_cost >= 0),
    CONSTRAINT fk_rentals_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    CONSTRAINT fk_rentals_renter FOREIGN KEY (renter_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_rentals_processor FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE rental_items (
    rental_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rental_item UNIQUE (rental_id, item_id),
    CONSTRAINT chk_rental_qty CHECK (quantity > 0),
    CONSTRAINT chk_rental_unit_rate CHECK (unit_rate >= 0),
    CONSTRAINT chk_rental_item_cost CHECK (item_cost >= 0),
    CONSTRAINT fk_rental_items_rental FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE,
    CONSTRAINT fk_rental_items_item FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE event_types (
    event_type_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    event_type_name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_event_type_name UNIQUE (org_id, event_type_name),
    CONSTRAINT uq_event_type_org_typeid UNIQUE (org_id, event_type_id),
    CONSTRAINT fk_event_types_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    location VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    event_type_id INT NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_events_approval CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
    CONSTRAINT chk_events_time CHECK (end_time > start_time),
    CONSTRAINT chk_events_publish CHECK (is_published = 0 OR approval_status = 'approved'),
    CONSTRAINT fk_events_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_events_type FOREIGN KEY (event_type_id) REFERENCES event_types(event_type_id) ON DELETE RESTRICT,
    CONSTRAINT fk_events_org_type FOREIGN KEY (org_id, event_type_id) REFERENCES event_types(org_id, event_type_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by_user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience_type VARCHAR(20) NOT NULL DEFAULT 'all_students',
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_announce_audience CHECK (audience_type IN ('all_students', 'members_only', 'officers_only')),
    CONSTRAINT fk_announce_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_announce_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================
-- 3) Indexes
-- =====================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_org_code ON organizations(org_code);
CREATE INDEX idx_org_roles_org ON org_roles(org_id, is_active);
CREATE INDEX idx_org_roles_name ON org_roles(org_id, role_name);
CREATE INDEX idx_org_members_org ON organization_members(org_id, role_id, is_active);
CREATE INDEX idx_org_members_user ON organization_members(user_id, is_active);
CREATE INDEX idx_inventory_categories_org ON inventory_categories(org_id, is_active);
CREATE INDEX idx_inventory_org_status ON inventory_items(org_id, status);
CREATE INDEX idx_inventory_category ON inventory_items(category_id);
CREATE INDEX idx_rentals_org_status ON rentals(org_id, status, expected_return_time);
CREATE INDEX idx_rentals_renter ON rentals(renter_user_id, payment_status);
CREATE INDEX idx_rental_items_rental ON rental_items(rental_id);
CREATE INDEX idx_event_types_org ON event_types(org_id, is_active);
CREATE INDEX idx_events_org_date ON events(org_id, event_date);
CREATE INDEX idx_events_type ON events(event_type_id);
CREATE INDEX idx_announcements_org_published ON announcements(org_id, is_published, published_at);

-- =====================================================
-- 4) Triggers
-- =====================================================

DELIMITER $$

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_org_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_org_roles_updated_at
BEFORE UPDATE ON org_roles
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_org_members_updated_at
BEFORE UPDATE ON organization_members
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_inventory_categories_updated_at
BEFORE UPDATE ON inventory_categories
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_rentals_updated_at
BEFORE UPDATE ON rentals
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_rental_items_updated_at
BEFORE UPDATE ON rental_items
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

CREATE TRIGGER trg_event_types_updated_at
BEFORE UPDATE ON event_types
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

CREATE TRIGGER trg_rentals_block_unpaid_student
BEFORE INSERT ON rentals
FOR EACH ROW
BEGIN
    DECLARE v_account_type VARCHAR(20);
    DECLARE v_has_unpaid_debt TINYINT(1);

    SELECT account_type, has_unpaid_debt
    INTO v_account_type, v_has_unpaid_debt
    FROM users
    WHERE user_id = NEW.renter_user_id;

    IF v_account_type = 'student' AND v_has_unpaid_debt = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Rental blocked: student account has unpaid debt.';
    END IF;
END$$

-- Prevent cross-organization item mixing in a rental
CREATE TRIGGER trg_rental_items_org_guard_insert
BEFORE INSERT ON rental_items
FOR EACH ROW
BEGIN
    DECLARE v_rental_org_id INT;
    DECLARE v_item_org_id INT;

    SELECT org_id INTO v_rental_org_id FROM rentals WHERE rental_id = NEW.rental_id;
    SELECT org_id INTO v_item_org_id FROM inventory_items WHERE item_id = NEW.item_id;

    IF v_rental_org_id IS NULL OR v_item_org_id IS NULL OR v_rental_org_id <> v_item_org_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid rental item: inventory item belongs to a different organization.';
    END IF;
END$$

CREATE TRIGGER trg_rental_items_org_guard_update
BEFORE UPDATE ON rental_items
FOR EACH ROW
BEGIN
    DECLARE v_rental_org_id INT;
    DECLARE v_item_org_id INT;

    SELECT org_id INTO v_rental_org_id FROM rentals WHERE rental_id = NEW.rental_id;
    SELECT org_id INTO v_item_org_id FROM inventory_items WHERE item_id = NEW.item_id;

    IF v_rental_org_id IS NULL OR v_item_org_id IS NULL OR v_rental_org_id <> v_item_org_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid rental item update: inventory item belongs to a different organization.';
    END IF;
END$$

DELIMITER ;

-- =====================================================
-- 5) Seed Data
-- =====================================================

INSERT INTO organizations (
    org_id, org_name, org_code, description, status
) VALUES
(1, 'AISERS', 'AISERS', 'Aviation and engineering student organization', 'active'),
(2, 'Elitech', 'ELITECH', 'Electronics and technology organization', 'active'),
(3, 'CYC', 'CYC', 'Campus youth community', 'active');

INSERT INTO users (
    user_id, student_number, employee_number, email, password_hash, first_name, last_name, account_type
) VALUES
(1, '2023-10001', NULL, 'aisers.officer1@school.edu', '$argon2id$demohash1', 'Aira', 'Santos', 'student'),
(2, '2023-10002', NULL, 'elitech.officer1@school.edu', '$argon2id$demohash2', 'Liam', 'Reyes', 'student'),
(3, '2023-10003', NULL, 'cyc.officer1@school.edu', '$argon2id$demohash3', 'Chloe', 'Cruz', 'student'),
(4, NULL, 'OSA-0001', 'osa.staff@school.edu', '$argon2id$demohash4', 'Olivia', 'Garcia', 'osa_staff');

INSERT INTO org_roles (
    role_id, org_id, role_name, can_access_org_dashboard, is_active
) VALUES
(1, 1, 'officer', 1, 1),
(2, 1, 'auditor', 1, 1),
(3, 2, 'officer', 1, 1),
(4, 2, 'auditor', 1, 1),
(5, 3, 'officer', 1, 1),
(6, 3, 'auditor', 1, 1);

INSERT INTO organization_members (
    user_id, org_id, role_id, joined_at, is_active
) VALUES
(1, 1, 1, '2025-08-01', 1),
(2, 2, 3, '2025-08-01', 1),
(3, 3, 5, '2025-08-01', 1),
(4, 1, 2, '2025-08-01', 1),
(4, 2, 4, '2025-08-01', 1),
(4, 3, 6, '2025-08-01', 1);

INSERT INTO inventory_categories (category_id, org_id, category_name, is_active) VALUES
(1, 1, 'uniform', 1),
(2, 2, 'equipment', 1),
(3, 3, 'electronics', 1),
(4, 3, 'other', 1);

INSERT INTO inventory_items (org_id, item_name, barcode, category_id, stock_quantity, available_quantity, hourly_rate, status) VALUES
(1, 'AISERS Shoe Cover', 'AISERS-ITM-001', 1, 30, 30, 5.00, 'available'),
(1, 'AISERS Safety Vest', 'AISERS-ITM-002', 1, 20, 20, 8.00, 'available'),
(2, 'Elitech Multimeter', 'ELITECH-ITM-001', 2, 12, 12, 12.00, 'available'),
(2, 'Elitech Soldering Kit', 'ELITECH-ITM-002', 2, 8, 8, 15.00, 'available'),
(3, 'CYC Event Megaphone', 'CYC-ITM-001', 3, 6, 6, 10.00, 'available'),
(3, 'CYC Booth Table Set', 'CYC-ITM-002', 4, 10, 10, 7.00, 'available');

INSERT INTO event_types (event_type_id, org_id, event_type_name, is_active) VALUES
(1, 1, 'workshop', 1),
(2, 2, 'workshop', 1),
(3, 3, 'meeting', 1);

INSERT INTO events (org_id, created_by_user_id, event_name, description, location, event_date, start_time, end_time, event_type_id, approval_status, is_published) VALUES
(1, 1, 'AISERS Skills Workshop', 'Technical workshop for AISERS members', 'Lab 1', '2026-03-10', '09:00:00', '12:00:00', 1, 'approved', 1),
(2, 2, 'Elitech Build Day', 'Electronics prototyping session', 'Lab 2', '2026-03-12', '13:00:00', '17:00:00', 2, 'approved', 1),
(3, 3, 'CYC Outreach Planning', 'Community outreach preparation', 'Student Hub', '2026-03-15', '10:00:00', '12:00:00', 3, 'approved', 1);

INSERT INTO announcements (org_id, created_by_user_id, title, content, audience_type, is_published, published_at) VALUES
(1, 1, 'AISERS Rental Desk Open', 'AISERS members may now reserve uniform items online.', 'members_only', 1, '2026-02-23 08:00:00'),
(2, 2, 'Elitech Lab Slots', 'Elitech officers can now manage inventory from the dashboard.', 'officers_only', 1, '2026-02-23 09:00:00'),
(3, 3, 'CYC Volunteer Call', 'CYC is opening volunteer registration for March activities.', 'all_students', 1, '2026-02-23 10:00:00');

-- Example rentals (org-specific)
INSERT INTO rentals (
    org_id, renter_user_id, processed_by_user_id, rent_time,
    expected_return_time, total_cost, payment_status, payment_method, status
) VALUES
(1, 1, 1, '2026-02-23 13:00:00', '2026-02-23 17:00:00', 20.00, 'paid', 'cash', 'active'),
(2, 2, 2, '2026-02-23 14:00:00', '2026-02-23 18:00:00', 24.00, 'unpaid', NULL, 'active');

INSERT INTO rental_items (rental_id, item_id, quantity, unit_rate, item_cost) VALUES
(1, 1, 2, 5.00, 10.00),
(1, 2, 1, 8.00, 8.00),
(2, 3, 2, 12.00, 24.00);

-- =====================================================
-- 6) Verification Queries
-- =====================================================

SELECT 'users' AS table_name, COUNT(*) AS record_count FROM users
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'org_roles', COUNT(*) FROM org_roles
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL SELECT 'inventory_categories', COUNT(*) FROM inventory_categories
UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
UNION ALL SELECT 'rentals', COUNT(*) FROM rentals
UNION ALL SELECT 'rental_items', COUNT(*) FROM rental_items
UNION ALL SELECT 'event_types', COUNT(*) FROM event_types
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'announcements', COUNT(*) FROM announcements;

-- Officer dashboard lookup example (student can also be an officer):
-- SELECT o.org_id, o.org_name, o.org_code, r.role_name
-- FROM organization_members om
-- JOIN organizations o ON o.org_id = om.org_id
-- JOIN org_roles r ON r.role_id = om.role_id
-- WHERE om.user_id = ?
--   AND om.is_active = 1
--   AND r.is_active = 1
--   AND r.can_access_org_dashboard = 1;

-- Post-login routing helper:
-- 1) Student dashboard allowed when users.account_type = 'student'
-- 2) Officer dashboard options come from query above
-- 3) OSA dashboard allowed when users.account_type = 'osa_staff'
