-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 28, 2026 at 04:59 PM
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
-- Dumping data for table `academic_programs`
--

INSERT INTO `academic_programs` (`program_id`, `program_code`, `institute_id`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'BSAIT', 1, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(2, 'BSAIS', 1, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(3, 'BSAET', 2, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(4, 'BSAT', 2, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(5, 'BSAMT', 2, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(6, 'BSAEE', 2, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(7, 'BAT-AET', 2, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(8, 'AVCOMM', 3, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(9, 'AVLOG', 3, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(10, 'AVSSM', 3, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(11, 'AVTOUR', 3, 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26');

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
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`record_id`, `event_id`, `user_id`, `student_number`, `student_name`, `section`, `time_in`, `time_out`, `created_at`, `updated_at`) VALUES
(1, 4, 6, '12324MN-000094', 'Charles Gabriel A. Martinez', '3-2', '2026-02-28 22:51:17', '2026-02-28 23:05:18', '2026-02-28 22:51:17', '2026-02-28 23:05:18'),
(2, 5, 6, '12324MN-000094', 'Charles Gabriel A. Martinez', '3-2', '2026-02-28 23:19:59', '2026-02-28 23:20:02', '2026-02-28 23:19:59', '2026-02-28 23:20:02');

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
-- Table structure for table `document_submissions`
--

CREATE TABLE `document_submissions` (
  `submission_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `submitted_by_user_id` int(11) NOT NULL,
  `reviewed_by_user_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `document_type` varchar(50) NOT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `recipient` varchar(50) NOT NULL DEFAULT 'OSA',
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `reviewer_notes` text DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Triggers `document_submissions`
--
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
  `event_date` date NOT NULL,
  `event_type_id` int(11) NOT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`event_id`, `org_id`, `created_by_user_id`, `event_name`, `description`, `location`, `event_date`, `event_type_id`, `is_published`, `created_at`, `updated_at`) VALUES
(4, 2, 4, 'EVENT', NULL, 'TBA', '2026-02-28', 7, 1, '2026-02-28 22:38:46', '2026-02-28 22:38:46'),
(5, 2, 4, 'AISAHAN', NULL, 'TBA', '2026-02-28', 7, 1, '2026-02-28 23:19:39', '2026-02-28 23:19:39');

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
-- Table structure for table `event_types`
--

CREATE TABLE `event_types` (
  `event_type_id` int(11) NOT NULL,
  `org_id` int(11) NOT NULL,
  `event_type_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `event_types`
--

INSERT INTO `event_types` (`event_type_id`, `org_id`, `event_type_name`, `is_active`, `created_at`, `updated_at`) VALUES
(7, 2, 'QR Attendance', 1, '2026-02-28 22:38:46', '2026-02-28 22:38:46');

--
-- Triggers `event_types`
--
DELIMITER $$
CREATE TRIGGER `trg_event_types_updated_at` BEFORE UPDATE ON `event_types` FOR EACH ROW BEGIN
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
-- Dumping data for table `institutes`
--

INSERT INTO `institutes` (`institute_id`, `institute_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Institute of Computer Studies', 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(2, 'Institute of Engineering Technology', 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26'),
(3, 'Institute of Liberal Arts and Sciences', 1, '2026-02-25 15:30:26', '2026-02-25 15:30:26');

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
-- Dumping data for table `inventory_categories`
--

INSERT INTO `inventory_categories` (`category_id`, `org_id`, `category_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 2, 'Shoe Cover', 1, '2026-02-27 14:03:59', '2026-02-27 14:03:59'),
(2, 2, 'Calculator', 1, '2026-02-27 14:18:25', '2026-02-27 14:18:25');

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
  `stock_quantity` int(11) NOT NULL DEFAULT 1,
  `available_quantity` int(11) NOT NULL DEFAULT 1,
  `hourly_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `overtime_interval_minutes` int(11) DEFAULT NULL COMMENT 'Minutes per overtime block (e.g., 30). NULL = no overtime charging.',
  `overtime_rate_per_block` decimal(10,2) DEFAULT NULL COMMENT 'Fee per overtime block (e.g., 5.00). NULL = no overtime charging.',
  `status` varchar(20) NOT NULL DEFAULT 'available',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `inventory_items`
--

INSERT INTO `inventory_items` (`item_id`, `org_id`, `item_name`, `barcode`, `category_id`, `stock_quantity`, `available_quantity`, `hourly_rate`, `overtime_interval_minutes`, `overtime_rate_per_block`, `status`, `created_at`, `updated_at`) VALUES
(1, 2, 'shoe', 'SH001', 1, 1, 0, 10.00, 30, 5.00, 'rented', '2026-02-27 14:03:59', '2026-02-28 20:16:40'),
(2, 2, 'shoe', 'SH002', 1, 1, 0, 10.00, 30, 5.00, 'rented', '2026-02-27 14:07:03', '2026-02-28 20:19:08'),
(3, 2, 'Sci Cal', 'CAL001', 2, 1, 1, 15.00, 30, 5.00, 'available', '2026-02-27 14:18:25', '2026-02-28 20:16:22'),
(4, 2, 'Business Calculator', 'CAL002', 2, 1, 1, 10.00, 30, 5.00, 'available', '2026-02-27 14:18:55', '2026-02-27 14:18:55');

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
-- Dumping data for table `organizations`
--

INSERT INTO `organizations` (`org_id`, `org_name`, `org_code`, `logo_url`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Supreme Student Council', 'SSC', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(2, 'Alliance in Information System Empowered Responsive Students', 'AISERS', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(3, 'Elite Technologist Society', 'ELITECH', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(4, 'Institute of Liberal Arts and Sciences Student Organization', 'ILASSO', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(5, 'Aeronautical Engineering Organization', 'AERO-ATSO', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(6, 'Aeronautical Engineering Technology Student Organization', 'AETSO', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(7, 'Aviation Maintenance Technology Student Organization', 'AMTSO', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(8, 'Red Cross Youth Council', 'RCYC', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(9, 'College Youth Club', 'CYC', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(10, 'Scholar\'s Guild', 'SCHOLARS', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43'),
(11, 'Aeronautica', 'AERONAUTICA', NULL, 'active', '2026-02-25 19:13:37', '2026-02-25 19:26:43');

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
-- Dumping data for table `organization_members`
--

INSERT INTO `organization_members` (`membership_id`, `user_id`, `org_id`, `role_id`, `joined_at`, `is_active`, `created_at`, `updated_at`) VALUES
(3, 4, 2, 10, '2026-02-27', 1, '2026-02-27 11:44:45', '2026-02-27 11:44:45'),
(4, 5, 3, 11, '2026-02-27', 1, '2026-02-27 13:46:39', '2026-02-27 13:46:39'),
(5, 6, 2, 10, '2026-02-27', 1, '2026-02-27 13:48:26', '2026-02-27 13:48:26'),
(6, 7, 1, 12, '2026-02-28', 1, '2026-02-28 19:45:28', '2026-02-28 19:45:28');

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
-- Dumping data for table `org_roles`
--

INSERT INTO `org_roles` (`role_id`, `org_id`, `role_name`, `can_access_org_dashboard`, `is_active`, `created_at`, `updated_at`) VALUES
(10, 2, 'officer', 1, 1, '2026-02-27 11:44:45', '2026-02-27 11:44:45'),
(11, 3, 'officer', 1, 1, '2026-02-27 13:46:39', '2026-02-27 13:46:39'),
(12, 1, 'officer', 1, 1, '2026-02-28 19:45:28', '2026-02-28 19:45:28');

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
  `reviewer_notes` text DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `pending_registrations`
--

INSERT INTO `pending_registrations` (`reg_id`, `student_number`, `student_name`, `email`, `phone`, `password_hash`, `program_code`, `year_section`, `requested_role`, `requested_org`, `status`, `reviewed_by_user_id`, `reviewer_notes`, `requested_at`, `reviewed_at`, `updated_at`) VALUES
(2, 'ITstudent', 'ITstudent', 'ITstudent@gmail.com', '+63 1234567890', '$2y$10$cNK9c2VG/87QEsWBqxXOKOOjO7Dv84CSjubQocidhoVeh91LjEcsS', 'BSAIT', '3-2', 'student', NULL, 'approved', 1, NULL, '2026-02-25 18:41:30', '2026-02-25 18:48:15', '2026-02-25 18:48:15'),
(3, 'aisers', 'aisers', 'aisers@gmail.com', '+63 1234567890', '$2y$10$0FvPli/TnKLKOkmyei3lBOK.S1VBZWA/.SDI2Zlr1SoT6miFT2bIK', 'BSAIS', '3-2', 'org_officer', 'AISERS', 'approved', 1, NULL, '2026-02-27 11:44:03', '2026-02-27 11:44:45', '2026-02-27 11:44:45'),
(4, 'elitech', 'elitech', 'elitech@gmail.com', '+63 1234567890', '$2y$10$Z98l15c6yvWuCpVn2HADZuncX.Fu9x1qg8CQ62WMDvXd40NvCnfjG', 'BSAIT', '3-2', 'org_officer', 'ELITECH', 'approved', 1, NULL, '2026-02-27 13:46:28', '2026-02-27 13:46:39', '2026-02-27 13:46:39'),
(5, '12324MN-000094', 'Charles Gabriel A. Martinez', 'charles.martinez232610@gmail.com', '+63 9763395956', '$2y$10$R4Sx52NV6nncQbl3mw7ctuqYaC2jdlv9IIWKB1/w5fa56vfF5A49a', 'BSAIS', '3-2', 'org_officer', 'AISERS', 'approved', 1, NULL, '2026-02-27 13:48:15', '2026-02-27 13:48:26', '2026-02-27 13:48:26'),
(6, 'ssc', 'ssc', 'ssc@gmail.com', '+63 1234567890', '$2y$10$UM5ah0sZDl.eUF1Y7MWuxONTCIXd6ZHpTGy8WqYX6aEGu9fxl/LVe', 'BSAIS', '3-2', 'org_officer', 'Supreme Student Council', 'approved', 1, NULL, '2026-02-28 19:37:43', '2026-02-28 19:45:28', '2026-02-28 19:45:28');

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
-- Dumping data for table `program_org_mappings`
--

INSERT INTO `program_org_mappings` (`mapping_id`, `program_id`, `org_id`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 3, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(2, 2, 2, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(3, 3, 6, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(4, 4, 5, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(5, 5, 7, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(6, 6, 5, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(7, 7, 5, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(8, 8, 4, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(9, 9, 4, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(10, 10, 4, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42'),
(11, 11, 4, 1, '2026-02-27 13:39:42', '2026-02-27 13:39:42');

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
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Dumping data for table `rentals`
--

INSERT INTO `rentals` (`rental_id`, `org_id`, `renter_user_id`, `processed_by_user_id`, `rent_time`, `expected_return_time`, `actual_return_time`, `total_cost`, `payment_status`, `payment_method`, `paid_at`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 2, 6, 6, '2026-02-27 08:16:32', '2026-02-27 09:16:32', '2026-02-27 08:20:52', 15.00, 'paid', 'cash', '2026-02-27 15:21:09', 'returned', NULL, '2026-02-27 15:16:32', '2026-02-27 15:21:09'),
(2, 2, 6, 6, '2026-02-27 08:21:17', '2026-02-27 09:21:17', '2026-02-27 08:21:44', 15.00, 'paid', 'cash', '2026-02-27 15:21:54', 'returned', NULL, '2026-02-27 15:21:17', '2026-02-27 15:21:54'),
(3, 2, 6, 6, '2026-02-27 08:22:03', '2026-02-27 10:22:03', '2026-02-27 08:26:45', 30.00, 'paid', 'cash', '2026-02-27 15:26:48', 'returned', NULL, '2026-02-27 15:22:03', '2026-02-27 15:26:48'),
(4, 2, 6, 6, '2026-02-27 08:26:58', '2026-02-27 09:26:58', '2026-02-27 08:27:24', 15.00, 'paid', 'cash', '2026-02-27 15:27:26', 'returned', NULL, '2026-02-27 15:26:58', '2026-02-27 15:27:26'),
(5, 2, 6, 6, '2026-02-27 08:30:48', '2026-02-27 09:30:48', '2026-02-27 08:31:02', 15.00, 'paid', 'cash', '2026-02-27 15:31:04', 'returned', NULL, '2026-02-27 15:30:48', '2026-02-27 15:31:04'),
(6, 2, 6, 6, '2026-02-27 08:32:30', '2026-02-27 09:32:30', '2026-02-27 08:33:56', 15.00, 'paid', 'cash', '2026-02-27 15:33:58', 'returned', NULL, '2026-02-27 15:32:30', '2026-02-27 15:33:58'),
(7, 2, 6, 6, '2026-02-27 08:34:02', '2026-02-27 09:34:02', '2026-02-27 08:49:17', 15.00, 'paid', 'cash', '2026-02-27 15:49:19', 'returned', NULL, '2026-02-27 15:34:02', '2026-02-27 15:49:19'),
(8, 2, 6, 6, '2026-02-27 08:49:45', '2026-02-27 10:49:45', '2026-02-27 08:52:29', 30.00, 'paid', 'cash', '2026-02-27 15:52:31', 'returned', NULL, '2026-02-27 15:49:45', '2026-02-27 15:52:31'),
(9, 2, 6, 6, '2026-02-27 09:00:12', '2026-02-27 12:00:12', '2026-02-28 13:16:22', 300.00, 'paid', 'cash', '2026-02-28 20:16:28', 'overdue', NULL, '2026-02-27 16:00:12', '2026-02-28 20:16:28'),
(10, 2, 6, 6, '2026-02-28 13:16:40', '2026-02-28 14:16:40', NULL, 10.00, 'unpaid', NULL, NULL, 'active', NULL, '2026-02-28 20:16:40', '2026-02-28 20:16:40'),
(11, 2, 6, 6, '2026-02-28 20:19:08', '2026-02-28 21:19:08', NULL, 10.00, 'unpaid', NULL, NULL, 'active', NULL, '2026-02-28 20:19:08', '2026-02-28 20:19:08');

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
-- Dumping data for table `rental_items`
--

INSERT INTO `rental_items` (`rental_item_id`, `rental_id`, `item_id`, `quantity`, `unit_rate`, `item_cost`, `overtime_interval_minutes`, `overtime_rate_per_block`, `created_at`, `updated_at`) VALUES
(1, 1, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:16:32', '2026-02-27 15:16:32'),
(2, 2, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:21:17', '2026-02-27 15:21:17'),
(3, 3, 3, 1, 15.00, 30.00, 30, 5.00, '2026-02-27 15:22:03', '2026-02-27 15:22:03'),
(4, 4, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:26:58', '2026-02-27 15:26:58'),
(5, 5, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:30:48', '2026-02-27 15:30:48'),
(6, 6, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:32:30', '2026-02-27 15:32:30'),
(7, 7, 3, 1, 15.00, 15.00, 30, 5.00, '2026-02-27 15:34:02', '2026-02-27 15:34:02'),
(8, 8, 3, 1, 15.00, 30.00, 30, 5.00, '2026-02-27 15:49:45', '2026-02-27 15:49:45'),
(9, 9, 3, 1, 15.00, 45.00, 30, 5.00, '2026-02-27 16:00:12', '2026-02-27 16:00:12'),
(10, 10, 1, 1, 10.00, 10.00, 30, 5.00, '2026-02-28 20:16:40', '2026-02-28 20:16:40'),
(11, 11, 2, 1, 10.00, 10.00, 30, 5.00, '2026-02-28 20:19:08', '2026-02-28 20:19:08');

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
-- Dumping data for table `student_numbers`
--

INSERT INTO `student_numbers` (`sn_id`, `student_number`, `student_name`, `year_section`, `program_id`, `institute_id`, `is_active`, `added_by_user_id`, `added_at`, `updated_at`) VALUES
(1, 'ISstudent', 'ISstudent', '3-2', 2, 1, 1, 1, '2026-02-25 18:29:37', '2026-02-27 17:23:07'),
(2, 'ITstudent', 'ITstudent', '3-2', 1, 1, 1, 1, '2026-02-25 18:41:23', '2026-02-27 17:23:07'),
(3, 'aisers', 'aisers', '3-2', 2, 1, 1, 1, '2026-02-27 11:43:50', '2026-02-27 17:23:07'),
(4, 'elitech', 'elitech', '3-2', 1, 1, 1, 1, '2026-02-27 13:46:19', '2026-02-27 17:23:07'),
(5, '12324MN-000094', 'Charles Gabriel A. Martinez', '3-2', 2, 1, 1, 1, '2026-02-27 13:47:48', '2026-02-27 17:23:07'),
(6, 'ssc', 'ssc', '3-2', 2, 1, 1, 1, '2026-02-28 19:37:41', '2026-02-28 19:37:41');

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
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `student_number`, `program_id`, `institute_id`, `first_name`, `last_name`, `employee_number`, `email`, `phone`, `password_hash`, `account_type`, `has_unpaid_debt`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, NULL, NULL, NULL, 'osa', '-', 'osa', 'osa@gmail.com', '+63 1234567890', '$2y$10$84lLDKnVilseyCYVSCFrxOherPdoFcnV.2/I261teTT6mPKasRCOS', 'osa_staff', 0, 1, '2026-02-28 21:27:13', '2026-02-25 18:19:21', '2026-02-28 21:27:13'),
(2, 'ITstudent', 1, 1, 'ITstudent', 'ITstudent', NULL, 'ITstudent@gmail.com', '+63 1234567890', '$2y$10$cNK9c2VG/87QEsWBqxXOKOOjO7Dv84CSjubQocidhoVeh91LjEcsS', 'student', 0, 1, '2026-02-27 17:18:46', '2026-02-25 18:48:15', '2026-02-27 17:18:46'),
(4, 'aisers', 2, 1, 'aisers', 'aisers', NULL, 'aisers@gmail.com', '+63 1234567890', '$2y$10$0FvPli/TnKLKOkmyei3lBOK.S1VBZWA/.SDI2Zlr1SoT6miFT2bIK', 'student', 0, 1, '2026-02-28 22:47:21', '2026-02-27 11:44:45', '2026-02-28 22:47:21'),
(5, 'elitech', 1, 1, 'elitech', 'elitech', NULL, 'elitech@gmail.com', '+63 1234567890', '$2y$10$Z98l15c6yvWuCpVn2HADZuncX.Fu9x1qg8CQ62WMDvXd40NvCnfjG', 'student', 0, 1, '2026-02-27 17:43:16', '2026-02-27 13:46:39', '2026-02-27 17:43:16'),
(6, '12324MN-000094', 2, 1, 'Charles Gabriel A.', 'Martinez', NULL, 'charles.martinez232610@gmail.com', '+63 9763395956', '$2y$10$R4Sx52NV6nncQbl3mw7ctuqYaC2jdlv9IIWKB1/w5fa56vfF5A49a', 'student', 0, 1, '2026-02-27 17:32:33', '2026-02-27 13:48:26', '2026-02-27 17:32:33'),
(7, 'ssc', 2, 1, 'ssc', 'ssc', NULL, 'ssc@gmail.com', '+63 1234567890', '$2y$10$UM5ah0sZDl.eUF1Y7MWuxONTCIXd6ZHpTGy8WqYX6aEGu9fxl/LVe', 'student', 0, 1, '2026-02-28 19:45:38', '2026-02-28 19:45:28', '2026-02-28 19:45:38');

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
  ADD KEY `fk_events_org_type` (`org_id`,`event_type_id`),
  ADD KEY `idx_events_org_date` (`org_id`,`event_date`),
  ADD KEY `idx_events_type` (`event_type_id`);

--
-- Indexes for table `event_types`
--
ALTER TABLE `event_types`
  ADD PRIMARY KEY (`event_type_id`),
  ADD UNIQUE KEY `uq_event_type_name` (`org_id`,`event_type_name`),
  ADD UNIQUE KEY `uq_event_type_org_typeid` (`org_id`,`event_type_id`),
  ADD KEY `idx_event_types_org` (`org_id`,`is_active`);

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
  MODIFY `program_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

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
-- AUTO_INCREMENT for table `document_submissions`
--
ALTER TABLE `document_submissions`
  MODIFY `submission_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `event_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `event_types`
--
ALTER TABLE `event_types`
  MODIFY `event_type_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `institutes`
--
ALTER TABLE `institutes`
  MODIFY `institute_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

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
  MODIFY `membership_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `org_roles`
--
ALTER TABLE `org_roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `pending_registrations`
--
ALTER TABLE `pending_registrations`
  MODIFY `reg_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `program_org_mappings`
--
ALTER TABLE `program_org_mappings`
  MODIFY `mapping_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

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
  MODIFY `sn_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

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
  ADD CONSTRAINT `fk_events_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_events_org_type` FOREIGN KEY (`org_id`,`event_type_id`) REFERENCES `event_types` (`org_id`, `event_type_id`),
  ADD CONSTRAINT `fk_events_type` FOREIGN KEY (`event_type_id`) REFERENCES `event_types` (`event_type_id`);

--
-- Constraints for table `event_types`
--
ALTER TABLE `event_types`
  ADD CONSTRAINT `fk_event_types_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`org_id`) ON DELETE CASCADE;

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
  ADD CONSTRAINT `fk_reg_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

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
