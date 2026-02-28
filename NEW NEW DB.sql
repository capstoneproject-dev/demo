-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 28, 2026 at 04:24 PM
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
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

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
