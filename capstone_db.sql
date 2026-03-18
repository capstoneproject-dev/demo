-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 18, 2026 at 02:10 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `capstone_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `academic_programs`
--

CREATE TABLE `academic_programs` (
  `program_id` int(11) NOT NULL,
  `program_code` varchar(30) NOT NULL,
  `institute_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `academic_programs`
--
DELIMITER $$
CREATE TRIGGER `trg_academic_programs_updated_at` BEFORE UPDATE ON `academic_programs` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `announcement_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `created_by_user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `audience_type` varchar(20) NOT NULL DEFAULT 'all_students',
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `announcements`
--
DELIMITER $$
CREATE TRIGGER `trg_announcements_updated_at` BEFORE UPDATE ON `announcements` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `record_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `student_number` varchar(20) DEFAULT NULL,
  `student_name` varchar(200) DEFAULT NULL,
  `section` varchar(30) DEFAULT NULL,
  `time_in` datetime NOT NULL,
  `time_out` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `attendance_records`
--
DELIMITER $$
CREATE TRIGGER `trg_attendance_records_updated_at` BEFORE UPDATE ON `attendance_records` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `documents_approved`
--

CREATE TABLE `documents_approved` (
  `repo_id` int(11) NOT NULL,
  `submission_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `approved_by_user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `semester` enum('1st','2nd') DEFAULT NULL,
  `academic_year` varchar(9) DEFAULT NULL,
  `approved_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_annotations`
--

CREATE TABLE `document_annotations` (
  `annotation_id` int(11) NOT NULL,
  `submission_id` int(11) NOT NULL,
  `page_number` int(11) NOT NULL,
  `selected_text` text NOT NULL,
  `rects_json` longtext NOT NULL,
  `comment_text` text DEFAULT NULL,
  `created_by_user_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `document_submissions`
--

CREATE TABLE `document_submissions` (
  `submission_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `submitted_by_user_id` int(11) NOT NULL,
  `reviewed_by_user_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `document_type` varchar(50) NOT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `recipient` varchar(50) NOT NULL DEFAULT 'OSA',
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `reviewer_notes` text DEFAULT NULL,
  `semester` enum('1st','2nd') DEFAULT NULL,
  `academic_year` varchar(9) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `document_submissions`
--
DELIMITER $$
CREATE TRIGGER `trg_doc_sub_to_repo` AFTER UPDATE ON `document_submissions` FOR EACH ROW BEGIN
  IF NEW.status='approved' AND OLD.status <> 'approved' THEN
    INSERT INTO documents_approved
      (submission_id, org_id, approved_by_user_id, title, document_type, file_url, description, semester, academic_year, approved_at)
    VALUES
      (NEW.submission_id, NEW.org_id, COALESCE(NEW.reviewed_by_user_id, NEW.submitted_by_user_id),
       NEW.title, NEW.document_type, NEW.file_url, NEW.description, NEW.semester, NEW.academic_year, NOW())
    ON DUPLICATE KEY UPDATE
      approved_at = VALUES(approved_at),
      file_url = VALUES(file_url),
      description = VALUES(description),
      semester = VALUES(semester),
      academic_year = VALUES(academic_year);
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_document_submissions_updated_at` BEFORE UPDATE ON `document_submissions` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `event_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `created_by_user_id` int(11) NOT NULL,
  `event_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `location` varchar(255) NOT NULL,
  `event_datetime` datetime NOT NULL,
  `event_photo` longblob DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `events`
--
DELIMITER $$
CREATE TRIGGER `trg_events_updated_at` BEFORE UPDATE ON `events` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `institutes`
--

CREATE TABLE `institutes` (
  `institute_id` int(11) NOT NULL,
  `institute_name` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `institutes`
--
DELIMITER $$
CREATE TRIGGER `trg_institutes_updated_at` BEFORE UPDATE ON `institutes` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_categories`
--

CREATE TABLE `inventory_categories` (
  `category_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `inventory_categories`
--
DELIMITER $$
CREATE TRIGGER `trg_inventory_categories_updated_at` BEFORE UPDATE ON `inventory_categories` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `item_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `barcode` varchar(50) NOT NULL,
  `category_id` int(11) NOT NULL,
  `hourly_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `overtime_interval_minutes` int(11) DEFAULT NULL COMMENT 'Minutes per overtime block (e.g., 30). NULL = no overtime charging.',
  `overtime_rate_per_block` decimal(10,2) DEFAULT NULL COMMENT 'Fee per overtime block (e.g., 5.00). NULL = no overtime charging.',
  `status` varchar(20) NOT NULL DEFAULT 'available',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `inventory_items`
--
DELIMITER $$
CREATE TRIGGER `trg_inventory_updated_at` BEFORE UPDATE ON `inventory_items` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `organizations`
--

CREATE TABLE `organizations` (
  `org_id` int(11) NOT NULL,
  `org_name` varchar(255) NOT NULL,
  `org_code` varchar(20) NOT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `organizations`
--
DELIMITER $$
CREATE TRIGGER `trg_org_updated_at` BEFORE UPDATE ON `organizations` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `organization_members`
--

CREATE TABLE `organization_members` (
  `membership_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `joined_at` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `organization_members`
--
DELIMITER $$
CREATE TRIGGER `trg_org_members_updated_at` BEFORE UPDATE ON `organization_members` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `org_roles`
--

CREATE TABLE `org_roles` (
  `role_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `can_access_org_dashboard` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `org_roles`
--
DELIMITER $$
CREATE TRIGGER `trg_org_roles_updated_at` BEFORE UPDATE ON `org_roles` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `pending_registrations`
--

CREATE TABLE `pending_registrations` (
  `reg_id` int(11) NOT NULL,
  `student_number` varchar(20) NOT NULL,
  `student_name` varchar(200) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `program_code` varchar(30) NOT NULL,
  `year_section` varchar(50) DEFAULT NULL,
  `requested_role` varchar(20) NOT NULL DEFAULT 'student',
  `requested_org` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` int(11) DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `pending_registrations`
--
DELIMITER $$
CREATE TRIGGER `trg_pending_registrations_updated_at` BEFORE UPDATE ON `pending_registrations` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `program_org_mappings`
--

CREATE TABLE `program_org_mappings` (
  `mapping_id` int(11) NOT NULL,
  `program_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `program_org_mappings`
--
DELIMITER $$
CREATE TRIGGER `trg_program_org_mappings_updated_at` BEFORE UPDATE ON `program_org_mappings` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `rentals`
--

CREATE TABLE `rentals` (
  `rental_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `renter_user_id` int(11) NOT NULL,
  `processed_by_user_id` int(11) NOT NULL,
  `rent_time` datetime NOT NULL,
  `expected_return_time` datetime NOT NULL,
  `actual_return_time` datetime DEFAULT NULL,
  `total_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `payment_method` varchar(20) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `rentals`
--
DELIMITER $$
CREATE TRIGGER `trg_rentals_block_unpaid_student` BEFORE INSERT ON `rentals` FOR EACH ROW BEGIN
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
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_rentals_updated_at` BEFORE UPDATE ON `rentals` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `rental_items`
--

CREATE TABLE `rental_items` (
  `rental_item_id` int(11) NOT NULL,
  `rental_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_rate` decimal(10,2) NOT NULL,
  `item_cost` decimal(10,2) NOT NULL,
  `overtime_interval_minutes` int(11) DEFAULT NULL COMMENT 'Snapshot: overtime interval at rental time',
  `overtime_rate_per_block` decimal(10,2) DEFAULT NULL COMMENT 'Snapshot: overtime rate at rental time',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `rental_items`
--
DELIMITER $$
CREATE TRIGGER `trg_rental_items_org_guard_insert` BEFORE INSERT ON `rental_items` FOR EACH ROW BEGIN
    DECLARE v_rental_org_id INT;
    DECLARE v_item_org_id INT;

    SELECT org_id INTO v_rental_org_id FROM rentals WHERE rental_id = NEW.rental_id;
    SELECT org_id INTO v_item_org_id FROM inventory_items WHERE item_id = NEW.item_id;

    IF v_rental_org_id IS NULL OR v_item_org_id IS NULL OR v_rental_org_id <> v_item_org_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid rental item: inventory item belongs to a different organization.';
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_rental_items_org_guard_update` BEFORE UPDATE ON `rental_items` FOR EACH ROW BEGIN
    DECLARE v_rental_org_id INT;
    DECLARE v_item_org_id INT;

    SELECT org_id INTO v_rental_org_id FROM rentals WHERE rental_id = NEW.rental_id;
    SELECT org_id INTO v_item_org_id FROM inventory_items WHERE item_id = NEW.item_id;

    IF v_rental_org_id IS NULL OR v_item_org_id IS NULL OR v_rental_org_id <> v_item_org_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Invalid rental item update: inventory item belongs to a different organization.';
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_rental_items_updated_at` BEFORE UPDATE ON `rental_items` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `student_numbers`
--

CREATE TABLE `student_numbers` (
  `sn_id` int(11) NOT NULL,
  `student_number` varchar(20) NOT NULL,
  `student_name` varchar(200) NOT NULL,
  `year_section` varchar(50) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL,
  `institute_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `added_by_user_id` int(11) DEFAULT NULL,
  `added_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `student_numbers`
--
DELIMITER $$
CREATE TRIGGER `trg_student_numbers_updated_at` BEFORE UPDATE ON `student_numbers` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `student_number` varchar(20) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL,
  `institute_id` int(11) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `employee_number` varchar(20) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `account_type` varchar(20) NOT NULL DEFAULT 'student',
  `has_unpaid_debt` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `users`
--
DELIMITER $$
CREATE TRIGGER `trg_users_set_institute_before_insert` BEFORE INSERT ON `users` FOR EACH ROW BEGIN
    IF NEW.program_id IS NULL THEN
        SET NEW.institute_id = NULL;
    ELSE
        SET NEW.institute_id = (
            SELECT institute_id
            FROM academic_programs
            WHERE program_id = NEW.program_id
            LIMIT 1
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_users_set_institute_before_update` BEFORE UPDATE ON `users` FOR EACH ROW BEGIN
    IF NEW.program_id IS NULL THEN
        SET NEW.institute_id = NULL;
    ELSE
        SET NEW.institute_id = (
            SELECT institute_id
            FROM academic_programs
            WHERE program_id = NEW.program_id
            LIMIT 1
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_users_updated_at` BEFORE UPDATE ON `users` FOR EACH ROW BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `academic_programs`
--
ALTER TABLE `academic_programs`
  ADD PRIMARY KEY (`program_id`),
  ADD UNIQUE KEY `program_code` (`program_code`),
  ADD KEY `idx_programs_code` (`program_code`,`is_active`),
  ADD KEY `idx_programs_institute` (`institute_id`);

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`announcement_id`),
  ADD KEY `fk_announce_creator` (`created_by_user_id`),
  ADD KEY `idx_announcements_org_published` (`org_id`,`is_published`,`published_at`);

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`record_id`),
  ADD KEY `idx_attendance_event` (`event_id`,`time_in`),
  ADD KEY `idx_attendance_student` (`student_number`),
  ADD KEY `idx_attendance_user` (`user_id`);

--
-- Indexes for table `documents_approved`
--
ALTER TABLE `documents_approved`
  ADD PRIMARY KEY (`repo_id`),
  ADD UNIQUE KEY `submission_id` (`submission_id`),
  ADD KEY `fk_repo_org` (`org_id`),
  ADD KEY `fk_repo_approver` (`approved_by_user_id`);

--
-- Indexes for table `document_annotations`
--
ALTER TABLE `document_annotations`
  ADD PRIMARY KEY (`annotation_id`),
  ADD KEY `fk_doc_ann_submission` (`submission_id`),
  ADD KEY `fk_doc_ann_user` (`created_by_user_id`),
  ADD KEY `idx_doc_ann_submission_page` (`submission_id`,`page_number`);

--
-- Indexes for table `document_submissions`
--
ALTER TABLE `document_submissions`
  ADD PRIMARY KEY (`submission_id`),
  ADD KEY `fk_doc_sub_reviewer` (`reviewed_by_user_id`),
  ADD KEY `idx_doc_sub_org_status` (`org_id`,`status`),
  ADD KEY `idx_doc_sub_submitter` (`submitted_by_user_id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`event_id`),
  ADD KEY `fk_events_creator` (`created_by_user_id`),
  ADD KEY `idx_events_org_datetime` (`org_id`,`event_datetime`);

--
-- Indexes for table `institutes`
--
ALTER TABLE `institutes`
  ADD PRIMARY KEY (`institute_id`),
  ADD UNIQUE KEY `institute_name` (`institute_name`);

--
-- Indexes for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `uq_inventory_category_name` (`org_id`,`category_name`),
  ADD UNIQUE KEY `uq_inventory_category_org_catid` (`org_id`,`category_id`),
  ADD KEY `idx_inventory_categories_org` (`org_id`,`is_active`);

--
-- Indexes for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`item_id`),
  ADD UNIQUE KEY `barcode` (`barcode`),
  ADD KEY `fk_inventory_org_category` (`org_id`,`category_id`),
  ADD KEY `idx_inventory_org_status` (`org_id`,`status`),
  ADD KEY `idx_inventory_category` (`category_id`);

--
-- Indexes for table `organizations`
--
ALTER TABLE `organizations`
  ADD PRIMARY KEY (`org_id`),
  ADD UNIQUE KEY `org_name` (`org_name`),
  ADD UNIQUE KEY `org_code` (`org_code`),
  ADD KEY `idx_org_code` (`org_code`);

--
-- Indexes for table `organization_members`
--
ALTER TABLE `organization_members`
  ADD PRIMARY KEY (`membership_id`),
  ADD UNIQUE KEY `uq_member_org` (`user_id`,`org_id`),
  ADD KEY `fk_org_members_role` (`role_id`),
  ADD KEY `idx_org_members_org` (`org_id`,`role_id`,`is_active`),
  ADD KEY `idx_org_members_user` (`user_id`,`is_active`);

--
-- Indexes for table `org_roles`
--
ALTER TABLE `org_roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `uq_org_role_name` (`org_id`,`role_name`),
  ADD UNIQUE KEY `uq_org_role_org_roleid` (`org_id`,`role_id`),
  ADD KEY `idx_org_roles_org` (`org_id`,`is_active`),
  ADD KEY `idx_org_roles_name` (`org_id`,`role_name`);

--
-- Indexes for table `pending_registrations`
--
ALTER TABLE `pending_registrations`
  ADD PRIMARY KEY (`reg_id`),
  ADD KEY `fk_reg_reviewer` (`reviewed_by_user_id`),
  ADD KEY `idx_pending_reg_status` (`status`,`requested_at`),
  ADD KEY `idx_pending_reg_student_num` (`student_number`);

--
-- Indexes for table `program_org_mappings`
--
ALTER TABLE `program_org_mappings`
  ADD PRIMARY KEY (`mapping_id`),
  ADD UNIQUE KEY `uq_program_org` (`program_id`,`org_id`),
  ADD KEY `fk_program_org_org` (`org_id`),
  ADD KEY `idx_program_org_map_program` (`program_id`,`is_active`);

--
-- Indexes for table `rentals`
--
ALTER TABLE `rentals`
  ADD PRIMARY KEY (`rental_id`),
  ADD KEY `fk_rentals_processor` (`processed_by_user_id`),
  ADD KEY `idx_rentals_org_status` (`org_id`,`status`,`expected_return_time`),
  ADD KEY `idx_rentals_renter` (`renter_user_id`,`payment_status`);

--
-- Indexes for table `rental_items`
--
ALTER TABLE `rental_items`
  ADD PRIMARY KEY (`rental_item_id`),
  ADD UNIQUE KEY `uq_rental_item` (`rental_id`,`item_id`),
  ADD KEY `fk_rental_items_item` (`item_id`),
  ADD KEY `idx_rental_items_rental` (`rental_id`);

--
-- Indexes for table `student_numbers`
--
ALTER TABLE `student_numbers`
  ADD PRIMARY KEY (`sn_id`),
  ADD UNIQUE KEY `student_number` (`student_number`),
  ADD KEY `fk_sn_added_by` (`added_by_user_id`),
  ADD KEY `idx_student_numbers_sn` (`student_number`,`is_active`),
  ADD KEY `idx_student_numbers_program_id` (`program_id`),
  ADD KEY `idx_student_numbers_institute_id` (`institute_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `student_number` (`student_number`),
  ADD UNIQUE KEY `employee_number` (`employee_number`),
  ADD KEY `idx_users_email` (`email`),
  ADD KEY `idx_users_program_id` (`program_id`),
  ADD KEY `idx_users_institute_id` (`institute_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `academic_programs`
--
ALTER TABLE `academic_programs`
  MODIFY `program_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `announcement_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attendance_records`
--
ALTER TABLE `attendance_records`
  MODIFY `record_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `documents_approved`
--
ALTER TABLE `documents_approved`
  MODIFY `repo_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `document_annotations`
--
ALTER TABLE `document_annotations`
  MODIFY `annotation_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `document_submissions`
--
ALTER TABLE `document_submissions`
  MODIFY `submission_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `event_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `institutes`
--
ALTER TABLE `institutes`
  MODIFY `institute_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organizations`
--
ALTER TABLE `organizations`
  MODIFY `org_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization_members`
--
ALTER TABLE `organization_members`
  MODIFY `membership_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `org_roles`
--
ALTER TABLE `org_roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pending_registrations`
--
ALTER TABLE `pending_registrations`
  MODIFY `reg_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_org_mappings`
--
ALTER TABLE `program_org_mappings`
  MODIFY `mapping_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rentals`
--
ALTER TABLE `rentals`
  MODIFY `rental_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_items`
--
ALTER TABLE `rental_items`
  MODIFY `rental_item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `student_numbers`
--
ALTER TABLE `student_numbers`
  MODIFY `sn_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `academic_programs`
--
ALTER TABLE `academic_programs`
  ADD CONSTRAINT `fk_programs_institute` FOREIGN KEY (`institute_id`) REFERENCES `institutes` (`institute_id`);

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `fk_announce_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_announce_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE;

--
-- Constraints for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD CONSTRAINT `fk_attendance_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `documents_approved`
--
ALTER TABLE `documents_approved`
  ADD CONSTRAINT `fk_repo_approver` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_repo_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`),
  ADD CONSTRAINT `fk_repo_submission` FOREIGN KEY (`submission_id`) REFERENCES `document_submissions` (`submission_id`);

--
-- Constraints for table `document_annotations`
--
ALTER TABLE `document_annotations`
  ADD CONSTRAINT `fk_doc_ann_submission` FOREIGN KEY (`submission_id`) REFERENCES `document_submissions` (`submission_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_doc_ann_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `document_submissions`
--
ALTER TABLE `document_submissions`
  ADD CONSTRAINT `fk_doc_sub_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`),
  ADD CONSTRAINT `fk_doc_sub_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_doc_sub_submitter` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_events_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  ADD CONSTRAINT `fk_inventory_categories_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `fk_inventory_category` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`category_id`),
  ADD CONSTRAINT `fk_inventory_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`),
  ADD CONSTRAINT `fk_inventory_org_category` FOREIGN KEY (`org_id`,`category_id`) REFERENCES `inventory_categories` (`org_id`, `category_id`);

--
-- Constraints for table `organization_members`
--
ALTER TABLE `organization_members`
  ADD CONSTRAINT `fk_org_members_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_org_members_org_role` FOREIGN KEY (`org_id`,`role_id`) REFERENCES `org_roles` (`org_id`, `role_id`),
  ADD CONSTRAINT `fk_org_members_role` FOREIGN KEY (`role_id`) REFERENCES `org_roles` (`role_id`),
  ADD CONSTRAINT `fk_org_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `org_roles`
--
ALTER TABLE `org_roles`
  ADD CONSTRAINT `fk_org_roles_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE;

--
-- Constraints for table `pending_registrations`
--
ALTER TABLE `pending_registrations`
  ADD CONSTRAINT `fk_reg_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_reg_student_number` FOREIGN KEY (`student_number`) REFERENCES `student_numbers` (`student_number`);

--
-- Constraints for table `program_org_mappings`
--
ALTER TABLE `program_org_mappings`
  ADD CONSTRAINT `fk_program_org_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_program_org_program` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`program_id`) ON DELETE CASCADE;

--
-- Constraints for table `rentals`
--
ALTER TABLE `rentals`
  ADD CONSTRAINT `fk_rentals_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`),
  ADD CONSTRAINT `fk_rentals_processor` FOREIGN KEY (`processed_by_user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_rentals_renter` FOREIGN KEY (`renter_user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `rental_items`
--
ALTER TABLE `rental_items`
  ADD CONSTRAINT `fk_rental_items_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`item_id`),
  ADD CONSTRAINT `fk_rental_items_rental` FOREIGN KEY (`rental_id`) REFERENCES `rentals` (`rental_id`) ON DELETE CASCADE;

--
-- Constraints for table `student_numbers`
--
ALTER TABLE `student_numbers`
  ADD CONSTRAINT `fk_sn_added_by` FOREIGN KEY (`added_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_student_numbers_institute` FOREIGN KEY (`institute_id`) REFERENCES `institutes` (`institute_id`),
  ADD CONSTRAINT `fk_student_numbers_program` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`program_id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_institute` FOREIGN KEY (`institute_id`) REFERENCES `institutes` (`institute_id`),
  ADD CONSTRAINT `fk_users_program` FOREIGN KEY (`program_id`) REFERENCES `academic_programs` (`program_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
