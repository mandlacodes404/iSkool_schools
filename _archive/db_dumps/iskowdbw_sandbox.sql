-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 25, 2026 at 01:08 PM
-- Server version: 11.4.10-MariaDB-cll-lve
-- PHP Version: 8.3.31

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `iskowdbw_sandbox`
--

-- --------------------------------------------------------

--
-- Table structure for table `academic_events`
--

CREATE TABLE `academic_events` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `event_date` date NOT NULL,
  `event_type` enum('test','exam','holiday','event','other') NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `academic_events`
--

INSERT INTO `academic_events` (`id`, `title`, `event_date`, `event_type`, `class_id`, `academic_year_id`, `created_by`, `created_at`) VALUES
(1, 'Filters', '2026-03-20', 'test', 1, 5, 'lerato.patel@iskool.demo', '2026-03-02 16:05:03'),
(2, 'Maths test', '2026-03-30', 'test', 1, 5, 'sibusiso.mokoena@iskool.demo', '2026-03-26 09:20:38'),
(3, 'Maths revision', '2026-04-30', 'event', 1, 5, 'sibusiso.mokoena@iskool.demo', '2026-04-20 11:48:33'),
(4, 'Maths revision', '2026-05-29', 'exam', 1, 5, 'lerato.patel@iskool.demo', '2026-05-13 18:25:18');

-- --------------------------------------------------------

--
-- Table structure for table `academic_years`
--

CREATE TABLE `academic_years` (
  `id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL,
  `name` varchar(20) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_current` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `academic_years`
--

INSERT INTO `academic_years` (`id`, `school_id`, `name`, `start_date`, `end_date`, `is_current`, `created_at`) VALUES
(1, 0, '2025', '2025-01-01', '2025-12-31', 0, '2025-11-29 18:16:19'),
(2, 1, '2024', '2024-01-01', '2024-12-31', 0, '2025-12-07 11:31:20'),
(3, 1, '2023', '2023-01-01', '2023-12-31', 0, '2025-12-07 11:31:20'),
(5, 1, '2026', '2026-01-01', '2026-12-31', 1, '2026-01-10 08:43:34');

-- --------------------------------------------------------

--
-- Table structure for table `access_keys`
--

CREATE TABLE `access_keys` (
  `id` int(11) NOT NULL,
  `role` enum('learner','teacher','parent','school_admin') NOT NULL,
  `access_key` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `access_keys`
--

INSERT INTO `access_keys` (`id`, `role`, `access_key`, `created_at`) VALUES
(1, 'learner', 'LEARNER2025', '2025-11-29 13:17:09'),
(2, 'teacher', 'TEACHER2025', '2025-11-29 13:17:09'),
(3, 'parent', 'PARENT2025', '2025-11-29 13:17:09'),
(4, 'school_admin', 'ADMIN2025', '2025-11-29 13:17:09');

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` int(11) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) NOT NULL DEFAULT 4,
  `send_to` enum('parents','learners','teachers','both') NOT NULL DEFAULT 'learners',
  `target_role` enum('all','teachers','learners') DEFAULT 'all'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `class_id`, `title`, `message`, `created_by`, `created_at`, `academic_year_id`, `term_number`, `send_to`, `target_role`) VALUES
(1, 5, 'New Announcement', 'This is a testing announcement okay', 'mandlasimphiwe500@gmail.com', '2025-12-16 15:04:54', 1, 4, 'learners', 'all'),
(2, 5, 'Another Testing', 'We are testing an announcement system again.', 'lerato.patel@iskool.demo', '2025-12-19 10:02:10', 1, 4, 'learners', 'all'),
(3, 5, 'Third Testing', 'We are testing the announcement again', 'lerato.patel@iskool.demo', '2025-12-19 11:20:41', 1, 4, 'learners', 'all'),
(4, 5, 'Testing again', 'We are testing an announcemnt', 'lerato.patel@iskool.demo', '2025-12-19 11:23:31', 1, 4, 'learners', 'all'),
(5, 5, 'Testing', 'This is a testing announcment', 'lerato.patel@iskool.demo', '2025-12-19 11:29:46', 1, 4, 'learners', 'all'),
(6, 1, 'Maths Assignment', 'This is a reminder that we have a maths assignment on the 3rd of February.', 'lerato.patel@iskool.demo', '2026-01-02 16:07:39', 1, 4, 'learners', 'all'),
(7, 1, 'Maths Assignment', 'This is a reminder that we have a maths assignment on the 3rd of February.', 'lerato.patel@iskool.demo', '2026-01-02 16:13:35', 1, 4, 'learners', 'all'),
(8, 1, 'Physics Reminder', 'This is a reminder that we have a Physics assignment on the 3rd of February. Dont say I didn\'t remind and and please try and prepare early, because it wont be easy if you didn\'t study', 'lerato.patel@iskool.demo', '2026-01-02 16:17:56', 1, 4, 'learners', 'all'),
(9, 1, 'Geography Test', 'Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:01:30', 1, 4, 'learners', 'all'),
(10, 1, 'Geography Test', 'Message: Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:06:27', 1, 4, 'learners', 'all'),
(11, 1, 'Geography Test 2', 'Message: Message: Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:11:44', 1, 4, 'learners', 'all'),
(12, 1, 'Geography Test 3', 'Message: Message: Message: Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:19:37', 1, 4, 'learners', 'all'),
(13, 1, 'Geography Test 4', 'Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:25:40', 1, 4, 'learners', 'all'),
(14, 1, 'Geography Test 5', 'Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:29:14', 1, 4, 'learners', 'all'),
(15, 1, 'Geography Test 6', 'Good day guys, i am just letting you know that we will have a geography test on monday, please come prepared.', 'lerato.patel@iskool.demo', '2026-01-03 06:34:32', 1, 4, 'learners', 'all'),
(16, 1, 'Physics Test Date', 'We are going to have our first physics test on 09 Jan.', 'lerato.patel@iskool.demo', '2026-01-05 10:30:58', 1, 4, 'learners', 'all'),
(17, 1, 'Physics Test Date', 'We are going to have our first physics test on 09 Jan.', 'lerato.patel@iskool.demo', '2026-01-05 10:43:53', 1, 4, 'learners', 'all'),
(18, 1, 'Test Date', 'We are going to have our first physics test on 09 Jan.', 'lerato.patel@iskool.demo', '2026-01-05 10:45:23', 1, 4, 'learners', 'all'),
(19, 1, 'The Culprits', 'Those of you who left early will get a zero.', 'lerato.patel@iskool.demo', '2026-01-05 11:05:33', 1, 4, 'learners', 'all'),
(20, 1, 'Postponement!', 'We have decided to shift Maths to Monday', 'lerato.patel@iskool.demo', '2026-01-05 11:31:13', 1, 4, 'learners', 'all'),
(21, 1, 'Testing', 'Testing new icon', 'lerato.patel@iskool.demo', '2026-01-06 11:42:44', 1, 4, 'learners', 'all'),
(22, 1, 'Testing', 'This is a testing tool', 'lerato.patel@iskool.demo', '2026-01-06 11:45:59', 1, 4, 'learners', 'all'),
(23, 1, 'Testing', 'This is Testing', 'lerato.patel@iskool.demo', '2026-01-06 11:47:38', 1, 4, 'learners', 'all'),
(24, 1, 'Testing', 'We are testing', 'lerato.patel@iskool.demo', '2026-01-06 16:36:25', 1, 4, 'learners', 'all'),
(25, 1, 'Testing', 'This is a testing announcement', 'lerato.patel@iskool.demo', '2026-01-08 11:09:02', 1, 4, 'learners', 'all'),
(26, 1, 'Testing', 'we are testing', 'lerato.patel@iskool.demo', '2026-01-09 10:00:29', 1, 4, 'learners', 'all'),
(27, 1, 'Testing announcements', 'We are testing announcements', 'lerato.patel@iskool.demo', '2026-01-13 08:28:45', 5, 1, 'learners', 'all'),
(28, 1, 'Class Attendance', 'We are not attending school on Wednesday', 'lerato.patel@iskool.demo', '2026-01-25 04:55:17', 5, 1, 'learners', 'all'),
(29, 1, 'Hshdx', 'Jznzzj', 'lerato.patel@iskool.demo', '2026-01-25 04:56:17', 5, 1, 'learners', 'all'),
(30, 1, 'bujbgyubhfjmg', 'tvdjfhvbh', 'lerato.patel@iskool.demo', '2026-01-25 04:57:53', 5, 1, 'learners', 'all'),
(31, 1, 'bujbgyubhfjmg', 'tvdjfhvbh', 'lerato.patel@iskool.demo', '2026-01-25 04:58:11', 5, 1, 'learners', 'all'),
(32, 1, 'new announcement', 'this is new announcement', 'lerato.patel@iskool.demo', '2026-01-25 05:59:47', 5, 1, 'learners', 'all'),
(33, 1, 'No Class', 'We have no class on Monday', 'lerato.patel@iskool.demo', '2026-01-28 05:27:24', 5, 1, 'learners', 'all'),
(34, 1, 'Term marks', 'i will publish the term marks on friday', 'lerato.patel@iskool.demo', '2026-01-30 11:12:58', 5, 1, 'learners', 'all'),
(35, 1, 'Class Test', 'We have a new class test on Monday', 'lerato.patel@iskool.demo', '2026-01-30 11:37:23', 5, 1, 'learners', 'all'),
(36, 1, 'New test', 'the will be a new date for the test', 'lerato.patel@iskool.demo', '2026-01-30 11:47:40', 5, 1, 'learners', 'all'),
(37, 1, 'New week', 'this week we will do thinks differently', 'lerato.patel@iskool.demo', '2026-01-30 11:52:05', 5, 1, 'learners', 'all'),
(38, 1, 'api announcement', 'we are testing api announcement', 'thabo.nkosi@iskool.demo', '2026-02-07 09:24:27', 5, 1, 'learners', 'all'),
(39, 1, 'Term Tests', 'In this we will only have 2 tests', 'lerato.patel@iskool.demo', '2026-02-11 03:59:41', 5, 1, 'learners', 'all'),
(40, 1, 'Midterm Break', 'We will have the midterm break in march', 'lerato.patel@iskool.demo', '2026-02-11 04:09:26', 5, 1, 'learners', 'all'),
(41, 1, 'Friday Test', 'We have a test on Friday', 'lerato.patel@iskool.demo', '2026-02-11 04:33:10', 5, 1, 'learners', 'all'),
(42, 1, 'Class Test', 'We have a class test on Tuesday.', 'lerato.patel@iskool.demo', '2026-02-11 04:44:40', 5, 1, 'learners', 'all'),
(43, 1, 'Friday Afteroon', 'We have a Friday afternoon class', 'lerato.patel@iskool.demo', '2026-02-11 05:19:38', 5, 1, 'learners', 'all'),
(44, 1, 'Friday Test', 'We have a test this friday', 'lerato.patel@iskool.demo', '2026-02-11 05:30:06', 5, 1, 'learners', 'all'),
(45, 1, 'Wednesday Test', 'We have a test on wednesday afternoon', 'lerato.patel@iskool.demo', '2026-02-11 07:18:53', 5, 1, 'learners', 'all'),
(46, 1, 'Tuesday Announcemnet', 'We do not have a test on tuesday', 'lerato.patel@iskool.demo', '2026-02-11 07:27:52', 5, 1, 'learners', 'all'),
(47, 1, 'Friday Test', 'We have a test on Friday, please be prepared', 'lerato.patel@iskool.demo', '2026-02-18 13:05:08', 5, 1, 'learners', 'all'),
(48, 1, 'Test Week', 'We have a test on Thursday', 'lerato.patel@iskool.demo', '2026-02-22 16:04:14', 5, 1, 'learners', 'all'),
(49, 1, 'New Teacher', 'Hi guys i will be your new teacher for Geography starting from next week', 'sibusiso.mokoena@iskool.demo', '2026-03-04 08:36:14', 5, 1, 'learners', 'all'),
(50, 1, 'Update', 'i meant from Monday', 'sibusiso.mokoena@iskool.demo', '2026-03-04 08:39:36', 5, 1, 'learners', 'all'),
(51, 1, 'Subject brief', 'I will share the syllabus with you tommorrow.', 'sibusiso.mokoena@iskool.demo', '2026-03-04 08:55:16', 5, 1, 'learners', 'all'),
(52, 1, 'Teerm Break', 'We close the 1st term on the 27 April learners.', 'sibusiso.mokoena@iskool.demo', '2026-03-16 10:12:06', 5, 1, 'learners', 'all'),
(53, 1, 'Midweek Test', 'The test is no longer in the midweek guys. take care.', 'sibusiso.mokoena@iskool.demo', '2026-03-22 08:14:17', 5, 1, 'learners', 'all'),
(54, 1, 'Maths Test', 'We have a maths test next week', 'lerato.patel@iskool.demo', '2026-04-08 09:15:34', 5, 1, 'learners', 'all'),
(55, NULL, 'Staff Metting', 'No staff meeting', 'admin1@gmail.com', '2026-04-14 06:02:13', 5, 1, 'both', 'all'),
(56, 1, 'Test week', 'this is a test week. We are going to have a test week and this is a reminder that you guys must try and study becuase these tests are going to be challenging, so it will be in your benefit to make sure that you study hard and make sure that you ace this tests becuase the exams are going to be brutal okay', 'sibusiso.mokoena@iskool.demo', '2026-04-18 07:37:37', 5, 1, 'learners', 'all'),
(57, 1, 'Manifest', 'we are checking the manifest file notifications', 'sibusiso.mokoena@iskool.demo', '2026-04-19 15:28:19', 5, 1, 'learners', 'all'),
(58, 1, 'Manifest II', 'We are still testing the manifest file guys okay', 'sibusiso.mokoena@iskool.demo', '2026-04-19 15:57:58', 5, 1, 'learners', 'all'),
(59, 1, 'Manifest III', 'We are still testing the manifest file guys', 'sibusiso.mokoena@iskool.demo', '2026-04-19 16:31:04', 5, 1, 'learners', 'all'),
(60, 1, 'Manifest IV', 'we are still dealing with manifest files', 'sibusiso.mokoena@iskool.demo', '2026-04-19 16:40:23', 5, 1, 'learners', 'all'),
(61, 1, 'Manifest V', 'We are testing the manifest file guys', 'sibusiso.mokoena@iskool.demo', '2026-04-19 16:50:15', 5, 1, 'learners', 'all'),
(62, 1, 'Manifest VI', 'We are still testing', 'sibusiso.mokoena@iskool.demo', '2026-04-19 17:14:46', 5, 1, 'learners', 'all'),
(63, 1, 'Manifest VII', 'We are testing again guys', 'sibusiso.mokoena@iskool.demo', '2026-04-19 17:21:04', 5, 1, 'learners', 'all'),
(64, 1, 'Manifest VIII', 'We are testing guys', 'sibusiso.mokoena@iskool.demo', '2026-04-19 17:34:14', 5, 1, 'learners', 'all'),
(65, 1, 'Manifest 1', 'we are testing', 'sibusiso.mokoena@iskool.demo', '2026-04-19 17:35:59', 5, 1, 'learners', 'all'),
(66, 1, 'Manifest 1.2', 'This a  manifest notification', 'sibusiso.mokoena@iskool.demo', '2026-04-20 05:58:06', 5, 1, 'learners', 'all'),
(67, 1, 'Manifest 1.3', 'This is a manifest announcment guys', 'sibusiso.mokoena@iskool.demo', '2026-04-20 06:01:30', 5, 1, 'learners', 'all'),
(68, 1, 'Manifest 1.4', 'This is a manifest announcment guys', 'sibusiso.mokoena@iskool.demo', '2026-04-20 06:05:43', 5, 1, 'learners', 'all'),
(69, 1, 'Manifest 2', 'This is an announcement notification', 'sibusiso.mokoena@iskool.demo', '2026-04-20 06:07:03', 5, 1, 'learners', 'all'),
(70, 1, 'Manifest 2.2', 'We are testing the manifest page', 'sibusiso.mokoena@iskool.demo', '2026-04-20 07:30:08', 5, 1, 'learners', 'all'),
(71, 1, 'Manifest 4', 'We are testing notifications', 'sibusiso.mokoena@iskool.demo', '2026-04-20 07:32:01', 5, 1, 'learners', 'all'),
(72, 1, 'New Week', 'Please lets study hard and forget about the politics okay', 'sibusiso.mokoena@iskool.demo', '2026-04-27 09:54:46', 5, 1, 'learners', 'all'),
(73, 1, 'Test Scope', 'I will give you guys the test scope next week so please dont send me emails i will not respond to them or may not see them becuase i am currently busy with a lot of stuff', 'sibusiso.mokoena@iskool.demo', '2026-04-27 10:08:36', 5, 1, 'learners', 'all'),
(74, 1, 'Test month', 'we have a term test this month please be prepared', 'sibusiso.mokoena@iskool.demo', '2026-04-28 08:40:33', 5, 1, 'learners', 'all'),
(75, 1, 'Test month II', 'Dont forget that i will send the scope closer to the test dates okay', 'sibusiso.mokoena@iskool.demo', '2026-04-28 08:42:12', 5, 1, 'learners', 'all'),
(76, 6, 'Test week', 'We have a test guys dont forget to check your calendar', 'sibusiso.mokoena@iskool.demo', '2026-04-28 08:47:32', 5, 1, 'learners', 'all'),
(77, 1, 'iSkool v1.1.2', 'iSkool has released a new version which includes the basic language model, we believe this is a cool feature and will help the schools immensely', 'sibusiso.mokoena@iskool.demo', '2026-05-11 10:15:36', 5, 1, 'learners', 'all'),
(78, 1, 'iSkool v1.1.2', 'iSkool has released a new version which includes the basic language model, we believe this is a cool feature and will help the schools immensely', 'sibusiso.mokoena@iskool.demo', '2026-05-11 10:16:54', 5, 1, 'learners', 'all'),
(79, 1, 'Class Test', 'iSkool has released a new version which includes the basic language model, we believe this is a cool feature and will help the schools immensely', 'sibusiso.mokoena@iskool.demo', '2026-05-13 06:56:35', 5, 1, 'learners', 'all'),
(80, 1, 'Test week II', 'iSkool has released a new version which includes the basic language model, we believe this is a cool feature and will help the schools immensely', 'sibusiso.mokoena@iskool.demo', '2026-05-13 06:59:47', 5, 1, 'learners', 'all'),
(81, 1, 'No class', 'We have no class next week teachers are going to a workshop please use this time wisely and study for the upcoming exams i will also make sure that i talk to the class rep and make sure that everyone is on their best behaviour during the period, thank you have a good long weekend!', 'lerato.patel@iskool.demo', '2026-05-14 07:04:01', 5, 1, 'learners', 'all'),
(82, 1, 'June exams', 'We will commence the june exams on the first week of june but we will release the time table soon, latest by next week monday have a good weekend.', 'sibusiso.mokoena@iskool.demo', '2026-05-17 08:48:12', 5, 1, 'learners', 'all'),
(83, 1, 'iSkool v1.1.3', 'We have released a new version of iSkool now the teachers can connect with the parents directly through a feature called threads', 'sibusiso.mokoena@iskool.demo', '2026-05-17 09:16:43', 5, 1, 'learners', 'all'),
(84, 1, 'Testing Announcement', 'This is an announcement to test that we have successfully added .env file to the server and we have successfully secure the passwords successfully as we anticipated okay, you can ignone the message if you receive it, this is just a testing alert. have a good weekend to you all', 'sibusiso.mokoena@iskool.demo', '2026-05-24 15:13:59', 5, 1, 'learners', 'all'),
(85, 1, 'iSkool Workflows', 'We are testing the iSkool workflows', 'sibusiso.mokoena@iskool.demo', '2026-05-24 18:23:39', 5, 1, 'learners', 'all');

-- --------------------------------------------------------

--
-- Table structure for table `answers`
--

CREATE TABLE `answers` (
  `id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `comment` text NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `assignments`
--

CREATE TABLE `assignments` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `file_url` varchar(255) DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `class_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) NOT NULL DEFAULT 4,
  `allow_late` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assignments`
--

INSERT INTO `assignments` (`id`, `title`, `description`, `file_url`, `due_date`, `class_id`, `teacher_id`, `academic_year_id`, `term_number`, `allow_late`, `created_at`, `created_by`) VALUES
(1, 'Testing Assignment', 'This is a testing announcement', 'assignment_Uploads/1766134459_Securities_Register_MandlaSimphiwe.pdf', '2025-12-26 12:00:00', 5, 0, 1, 4, 0, '2025-12-19 08:54:19', 'lerato.patel@iskool.demo'),
(2, 'English Assignment', 'This is the first english assignment it weighs 5% of the term mark', 'assignment_Uploads/1767450490_namecheap-order-190158192.pdf', '2026-01-31 16:30:00', 1, 0, 1, 4, 0, '2026-01-03 14:28:10', 'lerato.patel@iskool.demo'),
(3, 'Chemistry Assignment', 'I have uploaded the assignment learners!', 'assignment_Uploads/1767635945_namecheap-order-190158192.pdf', '2026-01-31 23:59:00', 1, 0, 1, 4, 0, '2026-01-05 17:59:05', 'lerato.patel@iskool.demo'),
(4, 'Chemistry Assignment', 'I have uploaded the assignment', 'assignment_Uploads/1767636041_namecheap-order-190158192.pdf', '2026-01-31 23:00:00', 1, 0, 1, 4, 0, '2026-01-05 18:00:41', 'lerato.patel@iskool.demo'),
(5, 'Testing announcement', 'We are testing the announcement system', 'assignment_Uploads/1768296163_namecheap-order-190158192.pdf', '2026-01-31 16:20:00', 1, 0, 5, 1, 0, '2026-01-13 09:22:43', 'lerato.patel@iskool.demo'),
(6, 'Testing assignment', 'We are testing a new assignment', 'assignment_Uploads/1768307131_namecheap-order-190158192.pdf', '2026-01-31 14:30:00', 1, 0, 5, 1, 0, '2026-01-13 12:25:31', 'lerato.patel@iskool.demo'),
(7, 'New testing', 'We are testing assignments', 'assignment_Uploads/1768308659_namecheap-order-190158192.pdf', '2026-01-13 14:55:00', 1, 0, 5, 1, 0, '2026-01-13 12:50:59', 'lerato.patel@iskool.demo'),
(8, 'New assignment', 'new', 'assignment_Uploads/1769339151_namecheap-order-190158192.pdf', '2026-01-31 13:07:00', 1, 0, 5, 1, 0, '2026-01-25 11:05:51', 'lerato.patel@iskool.demo'),
(9, 'new assignment', 'this is new assignment', 'assignment_Uploads/1769792395_namecheap-order-190158192.pdf', '2026-02-07 18:59:00', 1, 0, 5, 1, 0, '2026-01-30 16:59:55', 'lerato.patel@iskool.demo'),
(10, 'Polynomials', 'This is for polynomials', 'assignment_Uploads/1769799838_namecheap-order-190158192.pdf', '2026-02-07 21:03:00', 1, 0, 5, 1, 0, '2026-01-30 19:03:58', 'lerato.patel@iskool.demo'),
(11, 'api assignment', 'we are testing api', 'assignment_Uploads/1770474219_namecheap-order-190158192.pdf', '2026-02-28 16:28:00', 1, 0, 5, 1, 0, '2026-02-07 14:23:39', 'thabo.nkosi@iskool.demo'),
(12, 'API', 'Testing', 'assignment_Uploads/1770733544_namecheap-order-190158192.pdf', '2026-04-25 16:28:00', 1, 0, 5, 1, 0, '2026-02-10 14:25:44', 'lerato.patel@iskool.demo'),
(13, 'Bernoulli\'s equations', 'This is the assignment on the 2nd chapter of the textbook', 'assignment_Uploads/1771944657_Tutorial.pdf', '2026-06-24 16:50:00', 1, 0, 5, 1, 0, '2026-02-24 14:50:57', 'lerato.patel@iskool.demo'),
(14, 'Discrete signals', 'this is discrete signals assignment', 'assignment_Uploads/1772637917_iSkool_Sample_Official_Letter.pdf', '2026-03-04 17:30:00', 1, 0, 5, 1, 0, '2026-03-04 15:25:17', 'sibusiso.mokoena@iskool.demo'),
(15, 'Essay', 'This is an assignment', 'assignment_Uploads/1774181462_namecheap-order-190158192.pdf', '2026-03-22 14:14:00', 1, 0, 5, 1, 0, '2026-03-22 12:11:02', 'sibusiso.mokoena@iskool.demo'),
(16, 'Momentum', 'You have to submit in pairs', 'assignment_Uploads/demo_school/1775558194_Tutorial.pdf', '2026-06-07 12:40:00', 1, 0, 5, 1, 0, '2026-04-07 10:36:34', 'sibusiso.mokoena@iskool.demo'),
(17, 'Essay', 'new Essay assignment', 'assignment_Uploads/demo_school/1775656928_Tutorial.pdf', '2026-04-15 16:00:00', 1, 0, 5, 1, 0, '2026-04-08 14:02:08', 'lerato.patel@iskool.demo'),
(18, 'Chapter 5', 'this is an assignment', 'assignment_Uploads/sandbox_high_school/1776511978_Tutorial.pdf', '2026-04-18 13:35:00', 1, 0, 5, 1, 0, '2026-04-18 11:32:58', 'sibusiso.mokoena@iskool.demo'),
(19, 'Manifest', 'This is manifest', 'assignment_Uploads/sandbox_high_school/1776677922_Tutorial.pdf', '2026-04-30 11:37:00', 1, 0, 5, 1, 0, '2026-04-20 09:38:42', 'sibusiso.mokoena@iskool.demo'),
(20, 'Manifest II', 'This is manifest', 'assignment_Uploads/sandbox_high_school/1776678109_Tutorial.pdf', '2026-04-29 11:41:00', 1, 0, 5, 1, 0, '2026-04-20 09:41:49', 'sibusiso.mokoena@iskool.demo'),
(21, 'Diagonals', 'We have diagonals that we need to do as an assignment guys for the term mark', 'assignment_Uploads/sandbox_high_school/1776686011_Tutorial.pdf', '2026-04-28 13:52:00', 1, 0, 5, 1, 0, '2026-04-20 11:53:31', 'sibusiso.mokoena@iskool.demo'),
(22, 'Chapter 8', 'This is a term mark assignment', 'assignment_Uploads/sandbox_high_school/1777369095_Tutorial.pdf', '2026-04-30 11:42:00', 1, 0, 5, 1, 0, '2026-04-28 09:38:15', 'sibusiso.mokoena@iskool.demo'),
(23, 'State Space', 'This is an assignment for state space analysis and it will cover 30% of the term mark like i said in the syllabus overview', 'assignment_Uploads/sandbox_high_school/1778669669_api resource.pdf', '2026-05-30 12:53:00', 1, 0, 5, 1, 0, '2026-05-13 10:54:29', 'sibusiso.mokoena@iskool.demo'),
(24, 'Chapter 10', 'iSkool has released a new version which includes the basic language model, we believe this is a cool feature and will help the schools immensely', 'assignment_Uploads/sandbox_high_school/1778670126_api resource.pdf', '2026-05-26 13:01:00', 1, 0, 5, 1, 0, '2026-05-13 11:02:06', 'sibusiso.mokoena@iskool.demo'),
(25, 'Quantum Physics', 'This is a quantum physics assignments okay', 'assignment_Uploads/sandbox_high_school/1779653070_create_quiz.php', '2026-06-06 00:03:00', 1, 0, 5, 1, 0, '2026-05-24 20:04:30', 'sibusiso.mokoena@iskool.demo'),
(26, 'Quantum Physics II', 'This is a quantum physics term test okay', 'assignment_Uploads/sandbox_high_school/1779653228_api resource.pdf', '2026-06-04 00:06:00', 1, 0, 5, 1, 0, '2026-05-24 20:07:08', 'sibusiso.mokoena@iskool.demo');

-- --------------------------------------------------------

--
-- Table structure for table `choices`
--

CREATE TABLE `choices` (
  `id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `choice_text` varchar(255) NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `choices`
--

INSERT INTO `choices` (`id`, `question_id`, `choice_text`, `is_correct`) VALUES
(1, 396, '1', 1),
(2, 396, '2', 0),
(3, 396, '3', 0),
(4, 396, '4', 0),
(5, 397, '1', 1),
(6, 397, '2', 0),
(7, 397, '3', 0),
(8, 397, '4', 0),
(9, 398, '1', 1),
(10, 398, '2', 0),
(11, 398, '3', 0),
(12, 398, '4', 0),
(13, 399, '1', 1),
(14, 399, '2', 0),
(15, 399, '3', 0),
(16, 399, '4', 0),
(17, 400, '1', 1),
(18, 400, '2', 0),
(19, 400, '3', 0),
(20, 400, '5', 0),
(21, 401, '1', 1),
(22, 401, '2', 0),
(23, 401, '3', 0),
(24, 401, '4', 0),
(25, 402, '1', 1),
(26, 402, '2', 0),
(27, 402, '3', 0),
(28, 402, '4', 0),
(29, 403, '1', 1),
(30, 403, '2', 0),
(31, 403, '3', 0),
(32, 403, '4', 0),
(33, 404, '1', 1),
(34, 404, '2', 0),
(35, 404, '5', 0),
(36, 404, '4', 0),
(37, 405, '1', 1),
(38, 405, '2', 0),
(39, 405, '3', 0),
(40, 405, '4', 0),
(41, 406, '1', 1),
(42, 406, '2', 0),
(43, 406, '3', 0),
(44, 406, '4', 0),
(45, 407, '1', 1),
(46, 407, '2', 0),
(47, 407, '3', 0),
(48, 407, '4', 0),
(49, 408, '1', 1),
(50, 408, '2', 0),
(51, 408, '3', 0),
(52, 408, '4', 0),
(53, 409, '1', 1),
(54, 409, '2', 0),
(55, 409, '3', 0),
(56, 409, '4', 0),
(57, 410, '1', 1),
(58, 410, '2', 0),
(59, 410, '3', 0),
(60, 410, '4', 0),
(61, 411, '1', 1),
(62, 411, '2', 0),
(63, 411, '3', 0),
(64, 411, '4', 0),
(65, 412, '1', 1),
(66, 412, '2', 0),
(67, 412, '3', 0),
(68, 412, '4', 0),
(69, 413, '1', 1),
(70, 413, '2', 0),
(71, 413, '3', 0),
(72, 413, '4', 0),
(73, 414, '1', 1),
(74, 414, '2', 0),
(75, 414, '4', 0),
(76, 414, '3', 0),
(77, 415, '1', 1),
(78, 415, '2', 0),
(79, 415, '3', 0),
(80, 415, '4', 0),
(81, 416, '1', 1),
(82, 416, '2', 0),
(83, 416, '3', 0),
(84, 416, '4', 0),
(85, 417, '1', 1),
(86, 417, '2', 0),
(87, 417, '3', 0),
(88, 417, '4', 0),
(89, 418, '1', 1),
(90, 418, '2', 0),
(91, 418, '34', 0),
(92, 418, '4', 0),
(93, 419, '1', 1),
(94, 419, '2', 0),
(95, 419, '3', 0),
(96, 419, '4', 0),
(97, 420, '1', 1),
(98, 420, '2', 0),
(99, 420, '3', 0),
(100, 420, '4', 0),
(101, 421, '1', 1),
(102, 421, '2', 0),
(103, 421, '3', 0),
(104, 421, '4', 0),
(105, 422, '1', 1),
(106, 422, '2', 0),
(107, 422, '3', 0),
(108, 422, '4', 0),
(109, 423, '1', 1),
(110, 423, '2', 0),
(111, 423, '3', 0),
(112, 423, '4', 0),
(113, 424, '1', 1),
(114, 424, '2', 0),
(115, 424, '3', 0),
(116, 424, '4', 0),
(117, 425, '1', 1),
(118, 425, '2', 0),
(119, 425, '3', 0),
(120, 425, '4', 0),
(121, 426, '1', 1),
(122, 426, '2', 0),
(123, 426, '3', 0),
(124, 426, '4', 0),
(125, 427, '1', 1),
(126, 427, '2', 0),
(127, 427, 'e', 0),
(128, 427, '5', 0),
(129, 428, '1', 1),
(130, 428, '2', 0),
(131, 428, '3', 0),
(132, 428, '4', 0),
(133, 429, '1', 1),
(134, 429, '2', 0),
(135, 429, '3', 0),
(136, 429, '4', 0),
(137, 430, '1', 1),
(138, 430, '2', 0),
(139, 430, '3', 0),
(140, 430, '4', 0),
(141, 431, '1', 1),
(142, 431, '2', 0),
(143, 431, '3', 0),
(144, 431, '4', 0),
(145, 432, '1', 1),
(146, 432, '23', 0),
(147, 432, '4', 0),
(148, 432, '5', 0),
(149, 433, '1', 1),
(150, 433, '2', 0),
(151, 433, '3', 0),
(152, 433, '4', 0),
(153, 434, '1', 1),
(154, 434, '2', 0),
(155, 434, '3', 0),
(156, 434, '4', 0),
(157, 435, '1', 1),
(158, 435, '2', 0),
(159, 435, '3', 0),
(160, 435, '4', 0),
(161, 436, '1', 1),
(162, 436, '2', 0),
(163, 436, '3', 0),
(164, 436, '4', 0),
(165, 437, 'A woman', 0),
(166, 437, 'A cat', 0),
(167, 437, 'a dog', 1),
(168, 437, 'A man', 0),
(169, 438, '1', 0),
(170, 438, '2', 1),
(171, 438, '3', 0),
(172, 438, '4', 0),
(173, 439, '1', 1),
(174, 439, '2', 0),
(175, 439, '3', 0),
(176, 439, '4', 0),
(177, 440, '1', 1),
(178, 440, '2', 0),
(179, 440, '3', 0),
(180, 440, '4', 0),
(181, 441, '1', 1),
(182, 441, '2', 0),
(183, 441, '3', 0),
(184, 441, '4', 0),
(185, 442, '1', 1),
(186, 442, '2', 0),
(187, 442, '3', 0),
(188, 442, '4', 0),
(189, 443, '1', 1),
(190, 443, '2', 0),
(191, 443, '3', 0),
(192, 443, '4', 0),
(193, 444, '1', 1),
(194, 444, '2', 0),
(195, 444, '3', 0),
(196, 444, '4', 0),
(197, 445, '1', 1),
(198, 445, '2', 0),
(199, 445, '3', 0),
(200, 445, '4', 0),
(201, 446, '1', 1),
(202, 446, '2', 0),
(203, 446, '3', 0),
(204, 446, '4', 0),
(205, 447, '1', 1),
(206, 447, '2', 0),
(207, 447, '3', 0),
(208, 447, '4', 0),
(209, 448, '1', 1),
(210, 448, '2', 0),
(211, 448, '3', 0),
(212, 448, '4', 0),
(213, 449, '1', 1),
(214, 449, '2', 0),
(215, 449, '3', 0),
(216, 449, '4', 0),
(217, 450, '1', 1),
(218, 450, '2', 0),
(219, 450, '3', 0),
(220, 450, '4', 0),
(221, 451, '1', 1),
(222, 451, '2', 0),
(223, 451, '3', 0),
(224, 451, '4', 0),
(225, 452, '1', 1),
(226, 452, '2', 0),
(227, 452, '3', 0),
(228, 452, '4', 0),
(229, 453, '1', 1),
(230, 453, '2', 0),
(231, 453, '3', 0),
(232, 453, '4', 0),
(233, 454, '1', 1),
(234, 454, '2', 0),
(235, 454, '3', 0),
(236, 454, '4', 0),
(237, 455, '1', 1),
(238, 455, '2', 0),
(239, 455, '3', 0),
(240, 455, '4', 0),
(241, 456, '1', 1),
(242, 456, '2', 0),
(243, 456, '3', 0),
(244, 456, '4', 0),
(245, 457, '1', 1),
(246, 457, '2', 0),
(247, 457, '3', 0),
(248, 457, '4', 0),
(249, 458, '1', 1),
(250, 458, '2', 0),
(251, 458, '3', 0),
(252, 458, '4', 0),
(253, 459, '1', 1),
(254, 459, '2', 0),
(255, 459, '3', 0),
(256, 459, '3', 0),
(257, 460, '1', 1),
(258, 460, '2', 0),
(259, 460, '3', 0),
(260, 460, '4', 0),
(261, 461, '1', 1),
(262, 461, '2', 0),
(263, 461, '3', 0),
(264, 461, '4', 0),
(265, 462, '1', 1),
(266, 462, '2', 0),
(267, 462, '3', 0),
(268, 462, '4', 0),
(269, 463, '1', 1),
(270, 463, 'a group of people', 0),
(271, 463, 'a ball', 0),
(272, 463, 'a group of men', 0),
(273, 464, 'a group of people', 1),
(274, 464, 'a ball', 0),
(275, 464, 'a man', 0),
(276, 464, 'a monkey', 0),
(277, 465, '1', 1),
(278, 465, '2000', 0),
(279, 465, 'a dog', 0),
(280, 465, '5', 0),
(281, 466, 'A woman', 1),
(282, 466, '1', 0),
(283, 466, '5', 0),
(284, 466, '10', 0),
(285, 467, '1', 1),
(286, 467, 'a group of people', 0),
(287, 467, 'a ball', 0),
(288, 467, 'a man', 0),
(289, 468, 'a group of people', 1),
(290, 468, 'a ball', 0),
(291, 468, 'a group of men', 0),
(292, 468, 'eggs', 0),
(293, 469, '1', 1),
(294, 469, '2', 0),
(295, 469, '3', 0),
(296, 469, '4', 0),
(297, 470, '1', 1),
(298, 470, '2', 0),
(299, 470, '3', 0),
(300, 470, '4', 0),
(301, 471, '1', 1),
(302, 471, '2', 0),
(303, 471, '3', 0),
(304, 471, '4', 0),
(305, 472, '1', 1),
(306, 472, '2', 0),
(307, 472, '3', 0),
(308, 472, '4', 0),
(309, 473, '1', 1),
(310, 473, '2', 0),
(311, 473, '3', 0),
(312, 473, '4', 0),
(313, 474, '1', 1),
(314, 474, '2', 0),
(315, 474, '3', 0),
(316, 474, '4', 0),
(317, 475, '1', 1),
(318, 475, '2', 0),
(319, 475, '3', 0),
(320, 475, '4', 0),
(321, 476, 'a group of people', 1),
(322, 476, '1', 0),
(323, 476, 'a ball', 0),
(324, 476, 'a man', 0),
(325, 477, '1', 1),
(326, 477, 'a group of people', 0),
(327, 477, 'a ball', 0),
(328, 477, 'a dog', 0),
(329, 478, '1', 1),
(330, 478, '2000', 0),
(331, 478, 'a dog', 0),
(332, 478, '5', 0),
(333, 479, '1', 1),
(334, 479, '2', 0),
(335, 479, '3', 0),
(336, 479, '4', 0),
(337, 480, '1', 1),
(338, 480, '2', 0),
(339, 480, '3', 0),
(340, 480, '4', 0),
(341, 481, '1', 1),
(342, 481, '2', 0),
(343, 481, '3', 0),
(344, 481, '4', 0),
(345, 482, '1', 1),
(346, 482, '2', 0),
(347, 482, '3', 0),
(348, 482, '4', 0),
(349, 483, '1', 1),
(350, 483, '2', 0),
(351, 483, '3', 0),
(352, 483, '4', 0),
(353, 484, '1', 1),
(354, 484, '2', 0),
(355, 484, '3', 0),
(356, 484, '4', 0),
(357, 485, '1', 1),
(358, 485, '2', 0),
(359, 485, '3', 0),
(360, 485, '4', 0),
(361, 486, '1', 1),
(362, 486, '2', 0),
(363, 486, '3', 0),
(364, 486, '4', 0),
(365, 487, '1', 1),
(366, 487, '2', 0),
(367, 487, '3', 0),
(368, 487, '4', 0),
(369, 488, '1', 1),
(370, 488, '2', 0),
(371, 488, '3', 0),
(372, 488, '4', 0),
(373, 489, '1', 1),
(374, 489, '2', 0),
(375, 489, '3', 0),
(376, 489, '4', 0),
(377, 490, '1', 1),
(378, 490, '2', 0),
(379, 490, '3', 0),
(380, 490, '4', 0),
(381, 491, '1', 1),
(382, 491, '2', 0),
(383, 491, '3', 0),
(384, 491, '4', 0),
(385, 492, '1', 1),
(386, 492, '2', 0),
(387, 492, '3', 0),
(388, 492, '4', 0),
(389, 493, '1', 1),
(390, 493, '2', 0),
(391, 493, '3', 0),
(392, 493, '4', 0),
(393, 494, '1', 1),
(394, 494, '2', 0),
(395, 494, '3', 0),
(396, 494, '4', 0),
(397, 495, '1', 1),
(398, 495, '2', 0),
(399, 495, '3', 0),
(400, 495, '4', 0),
(401, 496, '1', 1),
(402, 496, '2', 0),
(403, 496, '3', 0),
(404, 496, '4', 0),
(405, 497, '1', 1),
(406, 497, '2', 0),
(407, 497, '3', 0),
(408, 497, '4', 0),
(409, 498, '1', 1),
(410, 498, '2', 0),
(411, 498, '3', 0),
(412, 498, '4', 0),
(413, 499, '1', 1),
(414, 499, '2', 0),
(415, 499, '3', 0),
(416, 499, '4', 0),
(417, 500, '1', 1),
(418, 500, '2', 0),
(419, 500, '3', 0),
(420, 500, '4', 0),
(421, 501, '1', 1),
(422, 501, '2', 0),
(423, 501, '3', 0),
(424, 501, '4', 0),
(425, 502, '1', 1),
(426, 502, '2', 0),
(427, 502, '3', 0),
(428, 502, '4', 0),
(429, 503, '1', 1),
(430, 503, '2', 0),
(431, 503, '3', 0),
(432, 503, '4', 0),
(433, 504, '1', 1),
(434, 504, '2', 0),
(435, 504, '3', 0),
(436, 504, '4', 0),
(437, 505, '1', 1),
(438, 505, '2', 0),
(439, 505, '3', 0),
(440, 505, '4', 0),
(441, 506, '1', 1),
(442, 506, '2', 0),
(443, 506, '3', 0),
(444, 506, '4', 0),
(445, 507, '1', 1),
(446, 507, '2', 0),
(447, 507, '3', 0),
(448, 507, '4', 0),
(449, 508, '1', 1),
(450, 508, '2', 0),
(451, 508, '3', 0),
(452, 508, '4', 0),
(453, 509, '1', 1),
(454, 509, '2', 0),
(455, 509, '3', 0),
(456, 509, '4', 0),
(457, 510, '1', 1),
(458, 510, '2', 0),
(459, 510, '3', 0),
(460, 510, '4', 0),
(461, 511, '1', 1),
(462, 511, '2', 0),
(463, 511, '3', 0),
(464, 511, '4', 0),
(465, 512, '1', 1),
(466, 512, '2', 0),
(467, 512, '3', 0),
(468, 512, '4', 0),
(469, 513, '1', 1),
(470, 513, '2', 0),
(471, 513, '3', 0),
(472, 513, '4', 0),
(473, 514, '1', 1),
(474, 514, '2', 0),
(475, 514, '3', 0),
(476, 514, '4', 0),
(477, 515, '1', 1),
(478, 515, '2', 0),
(479, 515, '3', 0),
(480, 515, '4', 0),
(481, 516, '1', 1),
(482, 516, '2', 0),
(483, 516, '3', 0),
(484, 516, '4', 0),
(485, 517, '1', 1),
(486, 517, '2', 0),
(487, 517, '3', 0),
(488, 517, '4', 0),
(489, 518, '1', 1),
(490, 518, '2', 0),
(491, 518, '3', 0),
(492, 518, '4', 0),
(493, 519, '1', 1),
(494, 519, '2', 0),
(495, 519, '3', 0),
(496, 519, '4', 0),
(497, 520, '1', 1),
(498, 520, '2', 0),
(499, 520, '3', 0),
(500, 520, '4', 0),
(501, 521, '1', 1),
(502, 521, '2', 0),
(503, 521, '3', 0),
(504, 521, '4', 0),
(505, 522, '1', 1),
(506, 522, '2', 0),
(507, 522, '3', 0),
(508, 522, '4', 0),
(509, 523, '1', 1),
(510, 523, '2', 0),
(511, 523, '3', 0),
(512, 523, '4', 0),
(513, 524, '1', 1),
(514, 524, '2', 0),
(515, 524, '3', 0),
(516, 524, '4', 0),
(517, 525, '1', 1),
(518, 525, '2', 0),
(519, 525, '3', 0),
(520, 525, '4', 0),
(521, 526, '1', 1),
(522, 526, '2', 0),
(523, 526, '3', 0),
(524, 526, '4', 0),
(525, 527, '1', 1),
(526, 527, '2', 0),
(527, 527, '3', 0),
(528, 527, '4', 0);

-- --------------------------------------------------------

--
-- Table structure for table `classes`
--

CREATE TABLE `classes` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `subject` varchar(100) NOT NULL,
  `created_by` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `classes`
--

INSERT INTO `classes` (`id`, `name`, `subject`, `created_by`) VALUES
(1, '8A', 'General', 'superadmin@iskool.co.za'),
(2, '8B', 'General', 'superadmin@iskool.co.za'),
(5, '10A', 'Mathematics', 'thabo.nkosi@iskool.demo'),
(6, '11B', 'Physical Sciences', 'lerato.patel@iskool.demo'),
(7, '8C', 'General', 'admin1@gmail.com');

-- --------------------------------------------------------

--
-- Table structure for table `class_discussions`
--

CREATE TABLE `class_discussions` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `initial_message` text NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `creator_email` varchar(100) NOT NULL,
  `creator_anonymous` tinyint(1) DEFAULT 1,
  `creator_name` varchar(150) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `attachment` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `class_discussions`
--

INSERT INTO `class_discussions` (`id`, `title`, `initial_message`, `class_id`, `academic_year_id`, `creator_email`, `creator_anonymous`, `creator_name`, `created_at`, `attachment`) VALUES
(1, 'Quadratic Equations', 'Can you guys please help me with 5.1 of exercise 5', 5, 1, 'lungile.buthelezi@iskool.demo', 1, NULL, '2025-12-23 16:34:46', NULL),
(2, 'Functions', 'hi guys can you please help me with exercise 5 please', 1, 5, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-03 10:29:32', NULL),
(3, 'Chemistry', 'Can you guys assist me with finding empirical formula', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-06 15:53:37', NULL),
(4, 'Momentum', 'Can you guys please assist', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-06 15:55:41', NULL),
(5, 'Quadratic fuo', 'Please help 5.1', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-06 16:00:42', NULL),
(6, 'Empirical formula', 'Hi guys can you assist me with exercise 2.4', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-07 04:50:27', NULL),
(7, 'Formula sheets', 'can someone help me with navigating these formula sheets...', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-07 05:15:41', NULL),
(8, 'Polynomials', 'Can you help please', 1, 1, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-12 06:56:17', NULL),
(9, 'Brain funtions', 'can you guys please', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-12 06:58:32', NULL),
(10, 'djkdj', 'jxcvblf', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-12 07:00:17', NULL),
(11, 'djjjjjjjjjjjjjjjjj', 'dvkrhtttttttt', 1, 1, 'zinhle.mkhathini@iskool.demo', 1, NULL, '2026-01-12 07:02:08', NULL),
(12, 'Vertical Motion', 'Can you guys please help me with vertical projectile motion questions please', 1, 1, 'zinhle.mkhathini@iskool.demo', 1, NULL, '2026-01-13 08:35:34', NULL),
(13, 'Vertical Motion 2', 'when an object is thrown upward will it come back to the same point at the same speed it was thrown up ?', 1, 1, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-13 08:44:35', NULL),
(14, 'Polynomials', 'can you guys please assist me with the attached picture', 1, NULL, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-14 05:40:40', 'disc_1768387240_696772a877a86.jpg'),
(15, 'Polynomials', 'Can you help with the attached document', 1, 5, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-14 05:56:01', 'disc_1768388161_69677641dba55.jpg'),
(16, 'New', 'kdchtmyyyyyyyylcy', 1, 5, 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', '2026-01-14 06:30:43', 'disc_1768390243_69677e633a2e5.jpg'),
(17, 'jvhhj', 'ctdjuvjkdhjv', 1, 5, 'zinhle.mkhathini@iskool.demo', 1, NULL, '2026-01-14 06:36:20', 'disc_1768390580_69677fb4c4c53.jpg'),
(18, 'Financial Maths', 'Can you help me please', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-24 08:32:33', NULL),
(19, 'Quadratic Sequence', 'Explain to me how this works please', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-25 04:48:16', NULL),
(20, 'Newton Laws', 'Can you explain Newton’s Law of University Gravitation', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-25 14:38:42', NULL),
(21, 'Momentum', 'Can you explain please', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-26 14:01:58', NULL),
(22, 'Vertical Motion', 'explain this concept please', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-26 14:03:19', NULL),
(23, 'Testing', 'Yes', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi', '2026-01-26 14:08:47', NULL),
(24, 'Bschdbc', 'Abxbxb', 1, 5, 'mandlasimphiwe99@gmail.com', 0, 'Mandla', '2026-01-28 07:22:20', NULL),
(25, 'Filters', 'Can you guys please explain the concept of bandwidth in filters particularly exercise 3.5', 1, 5, 'mandi.vava@iskool.demo', 1, NULL, '2026-03-04 03:10:59', 'disc_1772611859_69a7e913744fa.pdf'),
(26, 'Matrices', 'can you guys please help me with some matrices please.', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi Vava', '2026-03-04 09:12:17', NULL),
(27, 'Gauss Jordan', 'help please', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi Vava', '2026-03-04 09:24:07', NULL),
(28, 'Chartilier\'s Principle', 'can someone explain please', 1, 5, 'mandi.vava@iskool.demo', 1, NULL, '2026-03-04 09:43:44', NULL),
(29, 'Last Test', 'can someone share the memo please', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi Vava', '2026-03-04 09:46:14', NULL),
(30, 'Last Test', 'When is the lab test and what are we expected to do please someone respond as soon as you can so i dont miss the deadline okay.', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi Vava', '2026-05-13 10:24:12', NULL),
(31, 'Filters Lab', 'When is the lab test and what are we expected to do please someone respond as soon as you can so i dont miss the deadline okay.', 1, 5, 'mandi.vava@iskool.demo', 0, 'Mandi Vava', '2026-05-13 10:25:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `class_students`
--

CREATE TABLE `class_students` (
  `id` int(11) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `student_email` varchar(100) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `class_students`
--

INSERT INTO `class_students` (`id`, `class_id`, `student_email`, `academic_year_id`) VALUES
(50, 6, 'amahle.hlongwane@iskool.demo', 1),
(13, 5, 'andile.mthethwa@iskool.demo', 1),
(18, 5, 'athi.hlongwane@iskool.demo', 1),
(33, 6, 'athi.mathenjwa@iskool.demo', 1),
(20, 5, 'ayanda.gumede@iskool.demo', 1),
(5, 5, 'ayanda.khoza@iskool.demo', 1),
(25, 5, 'ayanda.mathenjwa@iskool.demo', 1),
(51, 6, 'boitumelo.sithole@iskool.demo', 1),
(27, 5, 'bongani.khuzwayo@iskool.demo', 1),
(11, 5, 'bongani.mbatha@iskool.demo', 1),
(59, 6, 'dineo.gumede@iskool.demo', 1),
(62, 6, 'extra0_thulani.mthembu@iskool.demo', 1),
(72, 6, 'extra10_mlungisi.sibiya@iskool.demo', 1),
(73, 6, 'extra11_dumisani.ndlovu@iskool.demo', 1),
(74, 6, 'extra12_bonginkosi.buthelezi@iskool.demo', 1),
(75, 6, 'extra13_siphelele.hlongwane@iskool.demo', 1),
(76, 6, 'extra14_mvelo.mbatha@iskool.demo', 1),
(63, 6, 'extra1_siyabonga.dlamini@iskool.demo', 1),
(64, 6, 'extra2_nkosinathi.zungu@iskool.demo', 1),
(65, 6, 'extra3_mthokozisi.mkhize@iskool.demo', 1),
(66, 6, 'extra4_sandile.nene@iskool.demo', 1),
(67, 6, 'extra5_mzwandile.gumede@iskool.demo', 1),
(68, 6, 'extra6_bhekumuzi.shabalala@iskool.demo', 1),
(69, 6, 'extra7_mandla.mthethwa@iskool.demo', 1),
(70, 6, 'extra8_sifiso.nkosi@iskool.demo', 1),
(71, 6, 'extra9_xolani.khoza@iskool.demo', 1),
(7, 5, 'junior.khuzwayo@iskool.demo', 1),
(24, 5, 'junior.mthembu@iskool.demo', 1),
(35, 6, 'kgomotso.khuzwayo@iskool.demo', 1),
(40, 6, 'kgomotso.mthembu@iskool.demo', 1),
(45, 6, 'lerato.sibiya@iskool.demo', 1),
(21, 5, 'lindani.sibiya@iskool.demo', 1),
(14, 5, 'lindani.vilakazi@iskool.demo', 1),
(39, 6, 'lindiwe.dlamini@iskool.demo', 1),
(2, 5, 'lungile.buthelezi@iskool.demo', 1),
(9, 5, 'lwandle.mthembu@iskool.demo', 1),
(3, 5, 'lwandle.ngubane@iskool.demo', 1),
(78, 1, 'mandi.vava@iskool.demo', 1),
(81, 1, 'mandi.vava@iskool.demo', 5),
(1, 1, 'mandlasimphiwe99@gmail.com', 1),
(79, 1, 'mandlasimphiwe99@gmail.com', 5),
(31, 5, 'mpho.hlongwane@iskool.demo', 1),
(37, 6, 'naledi.ndlovu@iskool.demo', 1),
(57, 6, 'nokuthula.gumede@iskool.demo', 1),
(52, 6, 'nokuthula.khoza@iskool.demo', 1),
(47, 6, 'nomvula.mbatha@iskool.demo', 1),
(55, 6, 'nomvula.mhlongo@iskool.demo', 1),
(44, 6, 'nomvula.ndlovu@iskool.demo', 1),
(54, 6, 'ntokozo.ndlovu@iskool.demo', 1),
(29, 5, 'ofentse.mbatha@iskool.demo', 1),
(30, 5, 'ofentse.ngubane@iskool.demo', 1),
(41, 6, 'onthatile.khoza@iskool.demo', 1),
(48, 6, 'precious.zulu@iskool.demo', 1),
(43, 6, 'refilwe.ngubane@iskool.demo', 1),
(58, 6, 'refilwe.sithole@iskool.demo', 1),
(4, 5, 'rethabile.dlamini@iskool.demo', 1),
(15, 5, 'rethabile.hlongwane@iskool.demo', 1),
(28, 5, 'rethabile.khoza@iskool.demo', 1),
(22, 5, 'rethabile.mbatha@iskool.demo', 1),
(10, 5, 'rethabile.vilakazi@iskool.demo', 1),
(16, 5, 'sanele.dlamini@iskool.demo', 1),
(6, 5, 'sanele.khuzwayo@iskool.demo', 1),
(8, 5, 'sanele.mokoena@iskool.demo', 1),
(49, 6, 'siphesihle.shabalala@iskool.demo', 1),
(17, 5, 'sipho.dlamini@iskool.demo', 1),
(23, 5, 'sipho.mathenjwa@iskool.demo', 1),
(32, 6, 'sipho.shabalala@iskool.demo', 1),
(19, 5, 'siya.vilakazi@iskool.demo', 1),
(56, 6, 'thandi.khoza@iskool.demo', 1),
(38, 6, 'thandi.mhlongo@iskool.demo', 1),
(34, 6, 'thando.nkosi@iskool.demo', 1),
(12, 5, 'tshepo.gumede@iskool.demo', 1),
(26, 5, 'tshepo.nkosi@iskool.demo', 1),
(42, 6, 'tumelo.ndlovu@iskool.demo', 1),
(60, 6, 'tumelo.shabalala@iskool.demo', 1),
(36, 6, 'zandi.buthelezi@iskool.demo', 1),
(53, 6, 'zandi.nkosi@iskool.demo', 1),
(61, 6, 'zandi.shabalala@iskool.demo', 1),
(46, 6, 'zinhle.mbatha@iskool.demo', 1),
(77, 1, 'zinhle.mkhathini@iskool.demo', 1),
(80, 1, 'zinhle.mkhathini@iskool.demo', 5);

-- --------------------------------------------------------

--
-- Table structure for table `discussion_replies`
--

CREATE TABLE `discussion_replies` (
  `id` int(11) NOT NULL,
  `discussion_id` int(11) NOT NULL,
  `parent_reply_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `replier_email` varchar(100) NOT NULL,
  `replier_anonymous` tinyint(1) DEFAULT 1,
  `replier_name` varchar(150) DEFAULT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `discussion_replies`
--

INSERT INTO `discussion_replies` (`id`, `discussion_id`, `parent_reply_id`, `message`, `replier_email`, `replier_anonymous`, `replier_name`, `attachment`, `created_at`) VALUES
(1, 1, NULL, 'I will ask Thando to please help with the question', 'lungile.buthelezi@iskool.demo', 1, NULL, NULL, '2025-12-23 16:48:46'),
(2, 1, NULL, 'I think i can help give me a few minutes', 'lwandle.ngubane@iskool.demo', 0, NULL, NULL, '2025-12-23 16:53:24'),
(3, 1, NULL, 'We are waiting', 'lungile.buthelezi@iskool.demo', 0, 'Lungile', NULL, '2025-12-23 17:31:20'),
(4, 1, NULL, 'Zinhle we are waiting for the answer please?', 'rethabile.dlamini@iskool.demo', 0, 'Rethabile', NULL, '2025-12-23 18:07:00'),
(5, 1, 3, 'Give me like 5 minutes lol', 'rethabile.dlamini@iskool.demo', 1, NULL, NULL, '2025-12-23 18:34:40'),
(6, 1, NULL, 'can you please help me with this question', 'lungile.buthelezi@iskool.demo', 1, NULL, 'disc_695238ce0640d.pdf', '2025-12-29 10:16:14'),
(7, 1, NULL, 'this is the picture of the question right ?', 'rethabile.dlamini@iskool.demo', 1, NULL, 'disc_6952396ae74b0.jpg', '2025-12-29 10:18:50'),
(8, 1, NULL, 'This looks like WhatsApp low-key 🔥😅', 'lungile.buthelezi@iskool.demo', 0, 'Lungile', NULL, '2026-01-08 13:23:39'),
(9, 1, NULL, '😅', 'lungile.buthelezi@iskool.demo', 0, 'Lungile', NULL, '2026-01-08 13:24:18'),
(10, 13, NULL, 'Bro just go read the notes!', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-01-13 08:46:22'),
(11, 13, NULL, '😅😅', 'mandlasimphiwe99@gmail.com', 0, 'Mandla', NULL, '2026-01-13 08:46:44'),
(12, 17, NULL, 'We will soon!', 'mandlasimphiwe99@gmail.com', 0, 'Mandla', NULL, '2026-01-14 06:37:31'),
(13, 17, NULL, '😅😅🔥', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-01-14 14:49:21'),
(14, 17, NULL, '', 'mandlasimphiwe99@gmail.com', 0, 'Mandla', 'disc_6968cd77b6e98.pdf', '2026-01-15 06:20:23'),
(15, 24, NULL, 'Shebadb', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-01-28 07:23:36'),
(16, 17, NULL, 'Mybe we will do it tommorrow guys', 'zinhle.mkhathini@iskool.demo', 1, NULL, NULL, '2026-02-21 14:41:12'),
(17, 17, NULL, 'I meant to say monday', 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', NULL, '2026-02-21 14:41:52'),
(18, 17, NULL, 'Okay but let’s do it in the afternoon okes', 'mandi.vava@iskool.demo', 0, 'Mandi', NULL, '2026-02-21 14:44:12'),
(19, 17, NULL, 'Okay', 'mandlasimphiwe99@gmail.com', 0, 'Mandla', NULL, '2026-02-21 14:47:59'),
(20, 17, NULL, 'okay let me sleep then before they close the chat box', 'mandlasimphiwe99@gmail.com', 0, 'Mandla', NULL, '2026-02-21 15:00:58'),
(21, 17, NULL, 'Why do they close the chat box again ?😅🤦🏽‍♂️', 'zinhle.mkhathini@iskool.demo', 0, 'Zinhle', NULL, '2026-02-21 15:02:49'),
(22, 17, NULL, 'Okay I will', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-03-04 04:17:49'),
(23, 25, NULL, 'I will try to help now', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-03-04 04:32:53'),
(24, 25, NULL, 'oh okay', 'mandi.vava@iskool.demo', 1, NULL, NULL, '2026-03-04 04:45:30'),
(25, 25, NULL, 'Oh nice', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-03-04 04:45:49'),
(26, 24, NULL, 'Nice', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-03-04 04:46:34'),
(27, 25, NULL, 'Yeah okah', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-03-04 07:34:39'),
(28, 17, 22, 'Yes now', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-03-30 06:29:40'),
(29, 17, NULL, '', 'mandlasimphiwe99@gmail.com', 1, NULL, 'disc_69de62020d6bf.webm', '2026-04-14 11:49:22'),
(30, 31, NULL, 'Next Monday is the deadline', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-13 10:27:21'),
(31, 31, NULL, 'I meant this coming week', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-13 10:27:57'),
(32, 31, NULL, '12 May', 'mandlasimphiwe99@gmail.com', 1, NULL, NULL, '2026-05-13 10:28:13'),
(33, 17, NULL, 'When are the exams ?', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-24 16:38:24'),
(34, 17, NULL, 'I mean the time table', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-24 16:44:28'),
(35, 17, NULL, 'Yes', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-24 16:44:49'),
(36, 17, NULL, 'No', 'mandlasimphiwe99@gmail.com', 0, 'Mandla Mahlangu', NULL, '2026-05-24 16:45:31');

-- --------------------------------------------------------

--
-- Table structure for table `discussion_reports`
--

CREATE TABLE `discussion_reports` (
  `id` int(11) NOT NULL,
  `discussion_id` int(11) DEFAULT NULL,
  `reply_id` int(11) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `reporter_email` varchar(100) NOT NULL,
  `reason` enum('bullying','inappropriate','off_topic','spam','other') NOT NULL,
  `comment` text DEFAULT NULL,
  `reported_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `discussion_reports`
--

INSERT INTO `discussion_reports` (`id`, `discussion_id`, `reply_id`, `academic_year_id`, `reporter_email`, `reason`, `comment`, `reported_at`) VALUES
(1, NULL, 4, 1, 'lungile.buthelezi@iskool.demo', 'bullying', 'can you please check this text i think its bullying', '2025-12-24 12:28:38'),
(2, 1, 4, 1, 'lungile.buthelezi@iskool.demo', 'bullying', 'can you check this message please', '2025-12-24 12:44:52');

-- --------------------------------------------------------

--
-- Table structure for table `discussion_teachers`
--

CREATE TABLE `discussion_teachers` (
  `id` int(11) NOT NULL,
  `discussion_id` int(11) NOT NULL,
  `teacher_email` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `discussion_teachers`
--

INSERT INTO `discussion_teachers` (`id`, `discussion_id`, `teacher_email`) VALUES
(1, 1, 'lerato.patel@iskool.demo'),
(2, 2, 'lerato.patel@iskool.demo'),
(3, 3, 'lerato.patel@iskool.demo'),
(4, 4, 'lerato.patel@iskool.demo'),
(5, 5, 'lerato.patel@iskool.demo'),
(6, 6, 'lerato.patel@iskool.demo'),
(7, 7, 'lerato.patel@iskool.demo'),
(8, 8, 'thabo.nkosi@iskool.demo'),
(9, 9, 'thabo.nkosi@iskool.demo'),
(10, 10, 'lerato.patel@iskool.demo'),
(11, 11, 'mandlasimphiwe500@gmail.com'),
(12, 12, 'nomsa.khumalo@iskool.demo'),
(13, 13, 'nomsa.khumalo@iskool.demo'),
(14, 14, 'lerato.patel@iskool.demo'),
(15, 15, 'lerato.patel@iskool.demo'),
(16, 16, 'nomsa.khumalo@iskool.demo'),
(17, 17, 'nomsa.khumalo@iskool.demo'),
(18, 18, 'mandlasimphiwe500@gmail.com'),
(19, 19, 'thabo.nkosi@iskool.demo'),
(20, 20, 'mandlasimphiwe500@gmail.com'),
(21, 21, 'mandlasimphiwe500@gmail.com'),
(22, 22, 'nomsa.khumalo@iskool.demo'),
(23, 23, 'mandlasimphiwe500@gmail.com'),
(24, 24, 'thabo.nkosi@iskool.demo'),
(25, 25, 'lerato.patel@iskool.demo'),
(26, 26, 'nomsa.khumalo@iskool.demo'),
(27, 27, 'nomsa.khumalo@iskool.demo'),
(28, 28, 'nomsa.khumalo@iskool.demo'),
(29, 29, 'mandlasimphiwe500@gmail.com'),
(30, 30, 'thabo.nkosi@iskool.demo'),
(31, 31, 'sibusiso.mokoena@iskool.demo');

-- --------------------------------------------------------

--
-- Table structure for table `discussion_typing`
--

CREATE TABLE `discussion_typing` (
  `discussion_id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `discussion_typing`
--

INSERT INTO `discussion_typing` (`discussion_id`, `user_email`, `updated_at`) VALUES
(17, 'mandi.vava@iskool.demo', '2026-05-07 13:53:57'),
(17, 'mandlasimphiwe99@gmail.com', '2026-05-24 20:45:29'),
(24, 'mandlasimphiwe99@gmail.com', '2026-03-04 09:46:30'),
(25, 'mandi.vava@iskool.demo', '2026-03-04 09:45:24'),
(25, 'mandlasimphiwe99@gmail.com', '2026-05-06 12:37:38'),
(31, 'mandlasimphiwe99@gmail.com', '2026-05-13 14:28:08');

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_answers`
--

CREATE TABLE `evaluation_answers` (
  `id` int(11) NOT NULL,
  `response_id` int(11) NOT NULL,
  `statement_id` int(11) NOT NULL,
  `answer` enum('strongly_agree','agree','neutral','disagree','strongly_disagree') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `evaluation_answers`
--

INSERT INTO `evaluation_answers` (`id`, `response_id`, `statement_id`, `answer`) VALUES
(1, 1, 9, 'agree'),
(2, 1, 10, 'neutral'),
(3, 1, 11, 'agree'),
(4, 1, 12, 'neutral'),
(5, 1, 13, 'agree'),
(6, 1, 14, 'disagree'),
(7, 1, 15, 'disagree'),
(8, 1, 16, 'strongly_agree'),
(9, 2, 109, 'strongly_agree'),
(10, 2, 110, 'disagree'),
(11, 2, 111, 'neutral'),
(12, 2, 112, 'neutral'),
(13, 2, 113, 'strongly_agree'),
(14, 2, 114, 'strongly_disagree'),
(15, 2, 115, 'strongly_agree'),
(16, 2, 116, 'neutral'),
(17, 3, 171, 'agree'),
(18, 3, 172, 'disagree'),
(19, 3, 173, 'agree'),
(20, 3, 174, 'strongly_disagree'),
(21, 3, 175, 'strongly_agree'),
(22, 3, 176, 'agree'),
(23, 3, 177, 'disagree'),
(24, 3, 178, 'disagree');

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_responses`
--

CREATE TABLE `evaluation_responses` (
  `id` int(11) NOT NULL,
  `evaluation_id` int(11) NOT NULL,
  `class_id` int(11) NOT NULL,
  `comments` text DEFAULT NULL,
  `submitted_at` datetime DEFAULT current_timestamp(),
  `unique_hash` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `evaluation_responses`
--

INSERT INTO `evaluation_responses` (`id`, `evaluation_id`, `class_id`, `comments`, `submitted_at`, `unique_hash`) VALUES
(1, 2, 5, 'The teacher is good overall but i think we can learn more if he arrives early for the periods', '2025-12-21 14:30:45', '4e15837522ec34eca88993164ebbd35d0cc64280ac8d91cdc61e5e7ebec0b44e'),
(2, 10, 1, 'I don’t have anything to say', '2026-02-13 09:20:58', '0aa6795a00592bdb6ab566a8153dee1c03046e535a664fff2535d5a691811c04'),
(3, 16, 1, 'I have nothing to say', '2026-05-05 09:54:00', 'f1955acc8bd3ef41b50e07b39ebf3d020f1c3e2f4afeedd798a8a698886747d5');

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_statements`
--

CREATE TABLE `evaluation_statements` (
  `id` int(11) NOT NULL,
  `evaluation_id` int(11) NOT NULL,
  `statement` text NOT NULL,
  `order_num` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `evaluation_statements`
--

INSERT INTO `evaluation_statements` (`id`, `evaluation_id`, `statement`, `order_num`) VALUES
(1, 1, 'The teacher explains concepts clearly.', 1),
(2, 1, 'The teacher is well-prepared for lessons.', 2),
(3, 1, 'The teacher encourages student participation.', 3),
(4, 1, 'The teacher provides helpful feedback on work.', 4),
(5, 1, 'The teacher treats students with respect.', 5),
(6, 1, 'Lessons are engaging and interesting.', 6),
(7, 1, 'The teacher manages class time effectively.', 7),
(8, 1, 'I feel supported in this subject.', 8),
(9, 2, 'The teacher explains concepts clearly.', 1),
(10, 2, 'The teacher is well-prepared for lessons.', 2),
(11, 2, 'The teacher encourages student participation.', 3),
(12, 2, 'The teacher provides helpful feedback on work.', 4),
(13, 2, 'The teacher treats students with respect.', 5),
(14, 2, 'Lessons are engaging and interesting.', 6),
(15, 2, 'The teacher manages class time effectively.', 7),
(16, 2, 'I feel supported in this subject.', 8),
(17, 3, 'The teacher explains concepts clearly.', 1),
(18, 3, 'The teacher is well-prepared for lessons.', 2),
(19, 3, 'The teacher encourages student participation.', 3),
(20, 3, 'The teacher provides helpful feedback on work.', 4),
(21, 3, 'The teacher treats students with respect.', 5),
(22, 3, 'Lessons are engaging and interesting.', 6),
(23, 3, 'The teacher manages class time effectively.', 7),
(24, 3, 'I feel supported in this subject.', 8),
(32, 3, 'Does the teacher arrive early in class ?', 0),
(33, 4, 'The teacher explains concepts clearly.', 1),
(34, 4, 'The teacher is well-prepared for lessons.', 2),
(35, 4, 'The teacher encourages student participation.', 3),
(36, 4, 'The teacher provides helpful feedback on work.', 4),
(37, 4, 'The teacher treats students with respect.', 5),
(38, 4, 'Lessons are engaging and interesting.', 6),
(39, 4, 'The teacher manages class time effectively.', 7),
(40, 4, 'I feel supported in this subject.', 8),
(48, 5, 'The teacher explains concepts clearly.', 1),
(49, 5, 'The teacher is well-prepared for lessons.', 2),
(50, 5, 'The teacher encourages student participation.', 3),
(51, 5, 'The teacher provides helpful feedback on work.', 4),
(52, 5, 'The teacher treats students with respect.', 5),
(53, 5, 'Lessons are engaging and interesting.', 6),
(54, 5, 'The teacher manages class time effectively.', 7),
(55, 5, 'I feel supported in this subject.', 8),
(56, 6, 'The teacher explains concepts clearly.', 1),
(57, 6, 'The teacher is well-prepared for lessons.', 2),
(58, 6, 'The teacher encourages student participation.', 3),
(59, 6, 'The teacher provides helpful feedback on work.', 4),
(60, 6, 'The teacher treats students with respect.', 5),
(61, 6, 'Lessons are engaging and interesting.', 6),
(62, 6, 'The teacher manages class time effectively.', 7),
(63, 6, 'I feel supported in this subject.', 8),
(71, 7, 'The teacher explains concepts clearly.', 1),
(72, 7, 'The teacher is well-prepared for lessons.', 2),
(73, 7, 'The teacher encourages student participation.', 3),
(74, 7, 'The teacher provides helpful feedback on work.', 4),
(75, 7, 'The teacher treats students with respect.', 5),
(76, 7, 'Lessons are engaging and interesting.', 6),
(77, 7, 'The teacher manages class time effectively.', 7),
(78, 7, 'I feel supported in this subject.', 8),
(86, 8, 'The teacher explains concepts clearly.', 1),
(87, 8, 'The teacher is well-prepared for lessons.', 2),
(88, 8, 'The teacher encourages student participation.', 3),
(89, 8, 'The teacher provides helpful feedback on work.', 4),
(90, 8, 'The teacher treats students with respect.', 5),
(91, 8, 'Lessons are engaging and interesting.', 6),
(92, 8, 'The teacher manages class time effectively.', 7),
(93, 8, 'I feel supported in this subject.', 8),
(94, 9, 'The teacher explains concepts clearly.', 1),
(95, 9, 'The teacher is well-prepared for lessons.', 2),
(96, 9, 'The teacher encourages student participation.', 3),
(97, 9, 'The teacher provides helpful feedback on work.', 4),
(98, 9, 'The teacher treats students with respect.', 5),
(99, 9, 'Lessons are engaging and interesting.', 6),
(100, 9, 'The teacher manages class time effectively.', 7),
(101, 9, 'I feel supported in this subject.', 8),
(109, 10, 'The teacher explains concepts clearly.', 1),
(110, 10, 'The teacher is well-prepared for lessons.', 2),
(111, 10, 'The teacher encourages student participation.', 3),
(112, 10, 'The teacher provides helpful feedback on work.', 4),
(113, 10, 'The teacher treats students with respect.', 5),
(114, 10, 'Lessons are engaging and interesting.', 6),
(115, 10, 'The teacher manages class time effectively.', 7),
(116, 10, 'I feel supported in this subject.', 8),
(124, 11, 'The teacher explains concepts clearly.', 1),
(125, 11, 'The teacher is well-prepared for lessons.', 2),
(126, 11, 'The teacher encourages student participation.', 3),
(127, 11, 'The teacher provides helpful feedback on work.', 4),
(128, 11, 'The teacher treats students with respect.', 5),
(129, 11, 'Lessons are engaging and interesting.', 6),
(130, 11, 'The teacher manages class time effectively.', 7),
(131, 11, 'I feel supported in this subject.', 8),
(132, 12, 'The teacher explains concepts clearly.', 1),
(133, 12, 'The teacher is well-prepared for lessons.', 2),
(134, 12, 'The teacher encourages student participation.', 3),
(135, 12, 'The teacher provides helpful feedback on work.', 4),
(136, 12, 'The teacher treats students with respect.', 5),
(137, 12, 'Lessons are engaging and interesting.', 6),
(138, 12, 'The teacher manages class time effectively.', 7),
(139, 12, 'I feel supported in this subject.', 8),
(147, 13, 'The teacher explains concepts clearly.', 1),
(148, 13, 'The teacher is well-prepared for lessons.', 2),
(149, 13, 'The teacher encourages student participation.', 3),
(150, 13, 'The teacher provides helpful feedback on work.', 4),
(151, 13, 'The teacher treats students with respect.', 5),
(152, 13, 'Lessons are engaging and interesting.', 6),
(153, 13, 'The teacher manages class time effectively.', 7),
(154, 13, 'I feel supported in this subject.', 8),
(155, 14, 'The teacher explains concepts clearly.', 1),
(156, 14, 'The teacher is well-prepared for lessons.', 2),
(157, 14, 'The teacher encourages student participation.', 3),
(158, 14, 'The teacher provides helpful feedback on work.', 4),
(159, 14, 'The teacher treats students with respect.', 5),
(160, 14, 'Lessons are engaging and interesting.', 6),
(161, 14, 'The teacher manages class time effectively.', 7),
(162, 14, 'I feel supported in this subject.', 8),
(163, 15, 'The teacher explains concepts clearly.', 1),
(164, 15, 'The teacher is well-prepared for lessons.', 2),
(165, 15, 'The teacher encourages student participation.', 3),
(166, 15, 'The teacher provides helpful feedback on work.', 4),
(167, 15, 'The teacher treats students with respect.', 5),
(168, 15, 'Lessons are engaging and interesting.', 6),
(169, 15, 'The teacher manages class time effectively.', 7),
(170, 15, 'I feel supported in this subject.', 8),
(171, 16, 'The teacher explains concepts clearly.', 1),
(172, 16, 'The teacher is well-prepared for lessons.', 2),
(173, 16, 'The teacher encourages student participation.', 3),
(174, 16, 'The teacher provides helpful feedback on work.', 4),
(175, 16, 'The teacher treats students with respect.', 5),
(176, 16, 'Lessons are engaging and interesting.', 6),
(177, 16, 'The teacher manages class time effectively.', 7),
(178, 16, 'I feel supported in this subject.', 8),
(179, 17, 'The teacher explains concepts clearly.', 1),
(180, 17, 'The teacher is well-prepared for lessons.', 2),
(181, 17, 'The teacher encourages student participation.', 3),
(182, 17, 'The teacher provides helpful feedback on work.', 4),
(183, 17, 'The teacher treats students with respect.', 5),
(184, 17, 'Lessons are engaging and interesting.', 6),
(185, 17, 'The teacher manages class time effectively.', 7),
(186, 17, 'I feel supported in this subject.', 8);

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `parent_email` varchar(255) NOT NULL,
  `teacher_email` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `sent_at` datetime NOT NULL,
  `receiver_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `parent_classes`
--

CREATE TABLE `parent_classes` (
  `parent_email` varchar(255) DEFAULT NULL,
  `class_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `parent_classes`
--

INSERT INTO `parent_classes` (`parent_email`, `class_id`) VALUES
('zandi.ndlovu@iskool.demo', 1);

-- --------------------------------------------------------

--
-- Table structure for table `parent_links`
--

CREATE TABLE `parent_links` (
  `id` int(11) NOT NULL,
  `parent_email` varchar(255) NOT NULL,
  `learner_email` varchar(255) NOT NULL,
  `class_id` int(11) NOT NULL,
  `approved_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `parent_links`
--

INSERT INTO `parent_links` (`id`, `parent_email`, `learner_email`, `class_id`, `approved_at`) VALUES
(1, 'zandi.ndlovu@iskool.demo', 'mandlasimphiwe99@gmail.com', 1, '2026-01-21 07:51:23');

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `password_resets`
--

INSERT INTO `password_resets` (`id`, `email`, `token`, `expires_at`) VALUES
(1, 'mandlasimphiwe99@gmail.com', '7f8985af553e41a7268fb57fe223da4b5a8b8c82fc6d66b109484b287d50fe96', '2026-01-12 19:03:41'),
(2, 'mandlasimphiwe99@gmail.com', '9415a70f8501ba94e70c7a63eec6300cd6efd75b5aaee4b8f2522e63bb74f5fe', '2026-01-12 22:25:36'),
(3, 'mandlasimphiwe99@gmail.com', 'cd6042e86f6d824824c407c52c448dc18b3555e74784942ecbe128668d52d97e', '2026-01-12 22:26:19'),
(4, 'mandlasimphiwe99@gmail.com', '5608bb1d710933363a8443faf97ac17ab26e6643ddd18a3feb3a87e923f6ab7f', '2026-03-22 15:46:43'),
(5, 'mandlasimphiwe99@gmail.com', 'bfcf0831ef1f8236c454baa58d2a0549350bb60fd757474df948bb52ffe28159', '2026-04-17 20:52:14'),
(6, 'mandlasimphiwe99@gmail.com', '45add61b52c69af5705286b9ae2014009d365b4064b4c4eb8c9cb0762f464ce3', '2026-04-17 21:40:58'),
(7, 'mandlasimphiwe99@gmail.com', '5fc16a8a541f99de3e496c37a91c618f411640dbdd5ecb671e40beff7c365bf9', '2026-04-20 12:44:26'),
(8, 'mandlasimphiwe99@gmail.com', '90cbe53eea494db169a2f7aa64d28ff491e33473ff89f83eeea7e41e3e266d5c', '2026-04-20 15:38:48'),
(9, 'mandlasimphiwe99@gmail.com', '50f961d65bc0a5b3b50f3aa08d5cb73e48d8ba36f0afa82dcd9b283f8a397c9f', '2026-04-20 15:54:32'),
(10, 'mandla_mahlangu@icloud.com', '3fe206751c8766189970ef2bce8c8094d77d78178eb129eec22d8b51faeb4489', '2026-05-04 13:20:35'),
(11, 'mandlasimphiwe99@gmail.com', '63b24b8937a6f588a6bb05cec7670817cba7c57abb8970757e6073ef5ac16b18', '2026-05-04 13:22:00'),
(12, 'mandlasimphiwe99@gmail.com', 'c2fcb16d757432567e4a87c8dfc3380c180b39c3620b32dcdf9ce80bd95e8f1b', '2026-05-04 13:23:16'),
(13, 'johannesmahlangu101@gmail.com', '8da5a3ad3f6983ffc70c5fe90f647e23d745e820694bd2356a219e2ba8dd2de2', '2026-05-04 13:24:31'),
(14, 'mandlasimphiwe99@gmail.com', 'b5d62a2cff1270cbfb9758e42e4e29eef9003be839fc0717ad7706ed188ce47b', '2026-05-04 13:26:46'),
(15, 'johannesmahlangu101@gmail.com', '864c8ef909f8689111431be682a86e2632df79d3e62ddba18d0bbe59c4e79027', '2026-05-04 13:43:26'),
(16, 'mandla_mahlangu@icloud.com', 'dcd202b082cdec885b5235abfbd8f89030047f0a04f20779f59e4ee00d806b8b', '2026-05-04 14:08:50'),
(17, 'mandlasimphiwe99@gmail.com', '498bad35e5d739b61cf6fbb71b93fbab7423c6713306bf1fa613886bd1b0df98', '2026-05-24 22:15:53');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `platform_settings`
--

CREATE TABLE `platform_settings` (
  `id` int(11) NOT NULL,
  `current_global_term` tinyint(1) NOT NULL DEFAULT 4
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `platform_settings`
--

INSERT INTO `platform_settings` (`id`, `current_global_term`) VALUES
(1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `questions`
--

CREATE TABLE `questions` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quizquestions`
--

CREATE TABLE `quizquestions` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `question_text` text NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `points` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizquestions`
--

INSERT INTO `quizquestions` (`id`, `quiz_id`, `question_text`, `image_path`, `points`) VALUES
(1, 1, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q1)', NULL, 5),
(2, 1, 'What is the derivative of x³? (Q2)', NULL, 5),
(3, 1, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q3)', NULL, 3),
(4, 1, 'Solve for y: 3y - 7 = 11 (Q4)', NULL, 4),
(5, 1, 'What is sin(30°)? (Q5)', NULL, 5),
(6, 1, 'Solve the quadratic: x² - 5x + 6 = 0 (Q6)', NULL, 2),
(7, 1, 'Simplify: √(16 × 9) (Q7)', NULL, 3),
(8, 1, 'What is the value of x in the equation 2x + 5 = 13? (Q8)', NULL, 5),
(9, 1, 'What is the gradient of the line y = 3x + 2? (Q9)', NULL, 2),
(10, 1, 'Factorise: x² + 5x + 6 (Q10)', NULL, 2),
(11, 1, 'Convert 45° to radians. (Q11)', NULL, 3),
(12, 1, 'Expand (x + 2)(x - 3) (Q12)', NULL, 5),
(13, 2, 'Solve for y: 3y - 7 = 11 (Q1)', NULL, 2),
(14, 2, 'Factorise: x² + 5x + 6 (Q2)', NULL, 2),
(15, 2, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q3)', NULL, 4),
(16, 2, 'Solve the quadratic: x² - 5x + 6 = 0 (Q4)', NULL, 5),
(17, 2, 'What is the value of x in the equation 2x + 5 = 13? (Q5)', NULL, 4),
(18, 2, 'What is the gradient of the line y = 3x + 2? (Q6)', NULL, 2),
(19, 2, 'Simplify: √(16 × 9) (Q7)', NULL, 2),
(20, 2, 'What is the derivative of x³? (Q8)', NULL, 5),
(21, 3, 'Convert 45° to radians. (Q1)', NULL, 5),
(22, 3, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q2)', NULL, 5),
(23, 3, 'What is the derivative of x³? (Q3)', NULL, 3),
(24, 3, 'What is the value of x in the equation 2x + 5 = 13? (Q4)', NULL, 4),
(25, 3, 'What is sin(30°)? (Q5)', NULL, 3),
(26, 3, 'What is the gradient of the line y = 3x + 2? (Q6)', NULL, 2),
(27, 3, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q7)', NULL, 2),
(28, 3, 'Solve for y: 3y - 7 = 11 (Q8)', NULL, 5),
(29, 3, 'Solve the quadratic: x² - 5x + 6 = 0 (Q9)', NULL, 4),
(30, 4, 'What is the formula for momentum? (Q1)', NULL, 4),
(31, 4, 'Calculate work done when force = 10N and distance = 5m. (Q2)', NULL, 3),
(32, 4, 'What is Newton\'s Second Law? (Q3)', NULL, 2),
(33, 4, 'What is the unit of force? (Q4)', NULL, 4),
(34, 4, 'Define velocity. (Q5)', NULL, 2),
(35, 4, 'Define kinetic energy. (Q6)', NULL, 3),
(36, 4, 'State Ohm\'s Law. (Q7)', NULL, 3),
(37, 4, 'What is the speed of light in a vacuum? (Q8)', NULL, 2),
(38, 5, 'What is the speed of light in a vacuum? (Q1)', NULL, 2),
(39, 5, 'Explain refraction. (Q2)', NULL, 2),
(40, 5, 'Define velocity. (Q3)', NULL, 2),
(41, 5, 'Calculate work done when force = 10N and distance = 5m. (Q4)', NULL, 4),
(42, 5, 'What is wavelength? (Q5)', NULL, 2),
(43, 5, 'What is the unit of force? (Q6)', NULL, 2),
(44, 5, 'State the law of conservation of energy. (Q7)', NULL, 4),
(45, 5, 'State Ohm\'s Law. (Q8)', NULL, 3),
(46, 5, 'Define kinetic energy. (Q9)', NULL, 3),
(47, 5, 'What is acceleration due to gravity on Earth? (Q10)', NULL, 4),
(48, 5, 'What is Newton\'s Second Law? (Q11)', NULL, 3),
(49, 6, 'What is sin(30°)? (Q1)', NULL, 5),
(50, 6, 'Factorise: x² + 5x + 6 (Q2)', NULL, 2),
(51, 6, 'Expand (x + 2)(x - 3) (Q3)', NULL, 2),
(52, 6, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q4)', NULL, 2),
(53, 6, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q5)', NULL, 5),
(54, 6, 'Simplify: √(16 × 9) (Q6)', NULL, 4),
(55, 6, 'What is the value of x in the equation 2x + 5 = 13? (Q7)', NULL, 2),
(56, 6, 'Convert 45° to radians. (Q8)', NULL, 4),
(57, 7, 'Simplify: √(16 × 9) (Q1)', NULL, 4),
(58, 7, 'What is sin(30°)? (Q2)', NULL, 3),
(59, 7, 'Factorise: x² + 5x + 6 (Q3)', NULL, 5),
(60, 7, 'Expand (x + 2)(x - 3) (Q4)', NULL, 4),
(61, 7, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q5)', NULL, 5),
(62, 7, 'What is the value of x in the equation 2x + 5 = 13? (Q6)', NULL, 2),
(63, 7, 'What is the gradient of the line y = 3x + 2? (Q7)', NULL, 5),
(64, 7, 'Convert 45° to radians. (Q8)', NULL, 5),
(65, 7, 'Solve the quadratic: x² - 5x + 6 = 0 (Q9)', NULL, 2),
(66, 8, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q1)', NULL, 5),
(67, 8, 'What is the gradient of the line y = 3x + 2? (Q2)', NULL, 2),
(68, 8, 'Convert 45° to radians. (Q3)', NULL, 5),
(69, 8, 'What is sin(30°)? (Q4)', NULL, 2),
(70, 8, 'Factorise: x² + 5x + 6 (Q5)', NULL, 3),
(71, 8, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q6)', NULL, 2),
(72, 8, 'What is the value of x in the equation 2x + 5 = 13? (Q7)', NULL, 5),
(73, 8, 'Expand (x + 2)(x - 3) (Q8)', NULL, 2),
(74, 8, 'Solve for y: 3y - 7 = 11 (Q9)', NULL, 4),
(75, 9, 'State Ohm\'s Law. (Q1)', NULL, 3),
(76, 9, 'What is the unit of force? (Q2)', NULL, 5),
(77, 9, 'State the law of conservation of energy. (Q3)', NULL, 5),
(78, 9, 'What is Newton\'s Second Law? (Q4)', NULL, 2),
(79, 9, 'What is the speed of light in a vacuum? (Q5)', NULL, 5),
(80, 9, 'Calculate work done when force = 10N and distance = 5m. (Q6)', NULL, 5),
(81, 9, 'What is acceleration due to gravity on Earth? (Q7)', NULL, 5),
(82, 9, 'What is the formula for momentum? (Q8)', NULL, 5),
(83, 9, 'Define velocity. (Q9)', NULL, 2),
(84, 10, 'What is wavelength? (Q1)', NULL, 4),
(85, 10, 'What is the unit of force? (Q2)', NULL, 5),
(86, 10, 'What is acceleration due to gravity on Earth? (Q3)', NULL, 5),
(87, 10, 'State the law of conservation of energy. (Q4)', NULL, 4),
(88, 10, 'What is Newton\'s Second Law? (Q5)', NULL, 3),
(89, 10, 'Explain refraction. (Q6)', NULL, 3),
(90, 10, 'State Ohm\'s Law. (Q7)', NULL, 3),
(91, 10, 'Define velocity. (Q8)', NULL, 5),
(92, 10, 'Define kinetic energy. (Q9)', NULL, 5),
(93, 10, 'Calculate work done when force = 10N and distance = 5m. (Q10)', NULL, 2),
(94, 10, 'What is the formula for momentum? (Q11)', NULL, 5),
(95, 11, 'What is wavelength? (Q1)', NULL, 2),
(96, 11, 'What is the formula for momentum? (Q2)', NULL, 2),
(97, 11, 'What is Newton\'s Second Law? (Q3)', NULL, 5),
(98, 11, 'Explain refraction. (Q4)', NULL, 4),
(99, 11, 'What is the unit of force? (Q5)', NULL, 5),
(100, 11, 'What is acceleration due to gravity on Earth? (Q6)', NULL, 5),
(101, 11, 'State the law of conservation of energy. (Q7)', NULL, 4),
(102, 11, 'State Ohm\'s Law. (Q8)', NULL, 5),
(103, 12, 'Solve for y: 3y - 7 = 11 (Q1)', NULL, 4),
(104, 12, 'What is the value of x in the equation 2x + 5 = 13? (Q2)', NULL, 5),
(105, 12, 'Convert 45° to radians. (Q3)', NULL, 3),
(106, 12, 'Solve the quadratic: x² - 5x + 6 = 0 (Q4)', NULL, 4),
(107, 12, 'What is the derivative of x³? (Q5)', NULL, 2),
(108, 12, 'Factorise: x² + 5x + 6 (Q6)', NULL, 2),
(109, 12, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q7)', NULL, 3),
(110, 12, 'Expand (x + 2)(x - 3) (Q8)', NULL, 2),
(111, 13, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q1)', NULL, 4),
(112, 13, 'Factorise: x² + 5x + 6 (Q2)', NULL, 2),
(113, 13, 'What is the derivative of x³? (Q3)', NULL, 3),
(114, 13, 'Simplify: √(16 × 9) (Q4)', NULL, 5),
(115, 13, 'What is sin(30°)? (Q5)', NULL, 5),
(116, 13, 'What is the value of x in the equation 2x + 5 = 13? (Q6)', NULL, 4),
(117, 13, 'Solve the quadratic: x² - 5x + 6 = 0 (Q7)', NULL, 4),
(118, 13, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q8)', NULL, 2),
(119, 13, 'Convert 45° to radians. (Q9)', NULL, 2),
(120, 14, 'Calculate the area of a triangle with base 8cm and height 5cm. (Q1)', NULL, 4),
(121, 14, 'Find the hypotenuse of a right triangle with legs 3 and 4. (Q2)', NULL, 5),
(122, 14, 'What is the gradient of the line y = 3x + 2? (Q3)', NULL, 2),
(123, 14, 'What is sin(30°)? (Q4)', NULL, 2),
(124, 14, 'Simplify: √(16 × 9) (Q5)', NULL, 3),
(125, 14, 'Factorise: x² + 5x + 6 (Q6)', NULL, 2),
(126, 14, 'Solve for y: 3y - 7 = 11 (Q7)', NULL, 2),
(127, 14, 'Solve the quadratic: x² - 5x + 6 = 0 (Q8)', NULL, 3),
(128, 14, 'Expand (x + 2)(x - 3) (Q9)', NULL, 4),
(129, 14, 'Convert 45° to radians. (Q10)', NULL, 3),
(130, 14, 'What is the derivative of x³? (Q11)', NULL, 3),
(131, 14, 'What is the value of x in the equation 2x + 5 = 13? (Q12)', NULL, 2),
(132, 15, 'What is Newton\'s Second Law? (Q1)', NULL, 3),
(133, 15, 'What is acceleration due to gravity on Earth? (Q2)', NULL, 5),
(134, 15, 'State the law of conservation of energy. (Q3)', NULL, 5),
(135, 15, 'Define kinetic energy. (Q4)', NULL, 4),
(136, 15, 'What is the formula for momentum? (Q5)', NULL, 2),
(137, 15, 'Calculate work done when force = 10N and distance = 5m. (Q6)', NULL, 3),
(138, 15, 'Define velocity. (Q7)', NULL, 5),
(139, 15, 'What is wavelength? (Q8)', NULL, 2),
(140, 15, 'What is the speed of light in a vacuum? (Q9)', NULL, 2),
(141, 16, 'State Ohm\'s Law. (Q1)', NULL, 5),
(142, 16, 'Explain refraction. (Q2)', NULL, 5),
(143, 16, 'Define velocity. (Q3)', NULL, 5),
(144, 16, 'Define kinetic energy. (Q4)', NULL, 3),
(145, 16, 'What is wavelength? (Q5)', NULL, 4),
(146, 16, 'Calculate work done when force = 10N and distance = 5m. (Q6)', NULL, 2),
(147, 16, 'What is acceleration due to gravity on Earth? (Q7)', NULL, 2),
(148, 16, 'What is the speed of light in a vacuum? (Q8)', NULL, 3),
(149, 17, 'Physics Question 1 for Term 1: Forces & Motion Summative', NULL, 8),
(150, 17, 'Physics Question 2 for Term 1: Forces & Motion Summative', NULL, 6),
(151, 17, 'Physics Question 3 for Term 1: Forces & Motion Summative', NULL, 6),
(152, 17, 'Physics Question 4 for Term 1: Forces & Motion Summative', NULL, 6),
(153, 17, 'Physics Question 5 for Term 1: Forces & Motion Summative', NULL, 8),
(154, 17, 'Physics Question 6 for Term 1: Forces & Motion Summative', NULL, 6),
(155, 17, 'Physics Question 7 for Term 1: Forces & Motion Summative', NULL, 4),
(156, 17, 'Physics Question 8 for Term 1: Forces & Motion Summative', NULL, 4),
(157, 17, 'Physics Question 9 for Term 1: Forces & Motion Summative', NULL, 6),
(158, 17, 'Physics Question 10 for Term 1: Forces & Motion Summative', NULL, 8),
(159, 18, 'Physics Question 1 for Term 1: Energy & Power Assessment', NULL, 8),
(160, 18, 'Physics Question 2 for Term 1: Energy & Power Assessment', NULL, 6),
(161, 18, 'Physics Question 3 for Term 1: Energy & Power Assessment', NULL, 4),
(162, 18, 'Physics Question 4 for Term 1: Energy & Power Assessment', NULL, 6),
(163, 18, 'Physics Question 5 for Term 1: Energy & Power Assessment', NULL, 8),
(164, 18, 'Physics Question 6 for Term 1: Energy & Power Assessment', NULL, 6),
(165, 18, 'Physics Question 7 for Term 1: Energy & Power Assessment', NULL, 5),
(166, 18, 'Physics Question 8 for Term 1: Energy & Power Assessment', NULL, 4),
(167, 18, 'Physics Question 9 for Term 1: Energy & Power Assessment', NULL, 4),
(168, 18, 'Physics Question 10 for Term 1: Energy & Power Assessment', NULL, 4),
(169, 19, 'Physics Question 1 for Term 1: Electrostatics Final Test', NULL, 5),
(170, 19, 'Physics Question 2 for Term 1: Electrostatics Final Test', NULL, 6),
(171, 19, 'Physics Question 3 for Term 1: Electrostatics Final Test', NULL, 6),
(172, 19, 'Physics Question 4 for Term 1: Electrostatics Final Test', NULL, 8),
(173, 19, 'Physics Question 5 for Term 1: Electrostatics Final Test', NULL, 8),
(174, 19, 'Physics Question 6 for Term 1: Electrostatics Final Test', NULL, 8),
(175, 19, 'Physics Question 7 for Term 1: Electrostatics Final Test', NULL, 5),
(176, 19, 'Physics Question 8 for Term 1: Electrostatics Final Test', NULL, 8),
(177, 19, 'Physics Question 9 for Term 1: Electrostatics Final Test', NULL, 4),
(178, 19, 'Physics Question 10 for Term 1: Electrostatics Final Test', NULL, 7),
(179, 20, 'Physics Question 1 for Term 1: Momentum & Impulse Exam', NULL, 8),
(180, 20, 'Physics Question 2 for Term 1: Momentum & Impulse Exam', NULL, 4),
(181, 20, 'Physics Question 3 for Term 1: Momentum & Impulse Exam', NULL, 7),
(182, 20, 'Physics Question 4 for Term 1: Momentum & Impulse Exam', NULL, 6),
(183, 20, 'Physics Question 5 for Term 1: Momentum & Impulse Exam', NULL, 8),
(184, 20, 'Physics Question 6 for Term 1: Momentum & Impulse Exam', NULL, 4),
(185, 20, 'Physics Question 7 for Term 1: Momentum & Impulse Exam', NULL, 6),
(186, 20, 'Physics Question 8 for Term 1: Momentum & Impulse Exam', NULL, 6),
(187, 20, 'Physics Question 9 for Term 1: Momentum & Impulse Exam', NULL, 8),
(188, 20, 'Physics Question 10 for Term 1: Momentum & Impulse Exam', NULL, 5),
(189, 21, 'Simple interest: P=10000, r=8%, t=2 years (Q1)', NULL, 5),
(190, 21, 'What is tan(45°)? (Q2)', NULL, 6),
(191, 21, 'Expand (x + 4)^2 (Q3)', NULL, 8),
(192, 21, 'Area of triangle: base=10, height=8 (Q4)', NULL, 8),
(193, 21, 'Find the mean of 8, 12, 15, 18, 22 (Q5)', NULL, 8),
(194, 21, 'Solve x² - 10x + 21 = 0 (Q6)', NULL, 5),
(195, 21, 'Solve: 3(x - 4) = 27 (Q7)', NULL, 8),
(196, 21, 'Find the median of 5, 7, 9, 12, 15 (Q8)', NULL, 8),
(197, 21, 'Probability of heads on a coin flip? (Q9)', NULL, 5),
(198, 21, 'Convert 30° to radians (Q10)', NULL, 5),
(199, 21, 'Probability of rolling a 4 or 5 on a die (Q11)', NULL, 5),
(200, 21, 'Calculate sin(30°) (Q12)', NULL, 8),
(201, 21, 'Factorise x² - 16 (Q13)', NULL, 8),
(202, 21, 'Simple interest: P=10000, r=8%, t=2 years (Q14)', NULL, 7),
(203, 22, 'Find the mean of 8, 12, 15, 18, 22 (Q1)', NULL, 5),
(204, 22, 'Expand (x + 4)^2 (Q2)', NULL, 7),
(205, 22, 'Probability of rolling a 4 or 5 on a die (Q3)', NULL, 8),
(206, 22, 'Factorise x² - 16 (Q4)', NULL, 5),
(207, 22, 'Probability of heads on a coin flip? (Q5)', NULL, 5),
(208, 22, 'Simple interest: P=10000, r=8%, t=2 years (Q6)', NULL, 8),
(209, 22, 'Find the median of 5, 7, 9, 12, 15 (Q7)', NULL, 8),
(210, 22, 'Area of triangle: base=10, height=8 (Q8)', NULL, 5),
(211, 22, 'Solve x² - 10x + 21 = 0 (Q9)', NULL, 7),
(212, 22, 'Convert 30° to radians (Q10)', NULL, 5),
(213, 22, 'Solve: 3(x - 4) = 27 (Q11)', NULL, 7),
(214, 22, 'What is tan(45°)? (Q12)', NULL, 8),
(215, 23, 'Probability of rolling a 4 or 5 on a die (Q1)', NULL, 5),
(216, 23, 'Probability of heads on a coin flip? (Q2)', NULL, 5),
(217, 23, 'Area of triangle: base=10, height=8 (Q3)', NULL, 6),
(218, 23, 'What is tan(45°)? (Q4)', NULL, 6),
(219, 23, 'Calculate sin(30°) (Q5)', NULL, 8),
(220, 23, 'Solve x² - 10x + 21 = 0 (Q6)', NULL, 5),
(221, 23, 'Find the mean of 8, 12, 15, 18, 22 (Q7)', NULL, 6),
(222, 23, 'Simple interest: P=10000, r=8%, t=2 years (Q8)', NULL, 6),
(223, 23, 'Find the median of 5, 7, 9, 12, 15 (Q9)', NULL, 6),
(224, 23, 'Convert 30° to radians (Q10)', NULL, 8),
(225, 23, 'Expand (x + 4)^2 (Q11)', NULL, 7),
(226, 23, 'Solve: 3(x - 4) = 27 (Q12)', NULL, 8),
(227, 24, 'Find the mean of 8, 12, 15, 18, 22 (Q1)', NULL, 7),
(228, 24, 'What is tan(45°)? (Q2)', NULL, 5),
(229, 24, 'Probability of rolling a 4 or 5 on a die (Q3)', NULL, 5),
(230, 24, 'Convert 30° to radians (Q4)', NULL, 6),
(231, 24, 'Calculate sin(30°) (Q5)', NULL, 8),
(232, 24, 'Expand (x + 4)^2 (Q6)', NULL, 5),
(233, 24, 'Area of triangle: base=10, height=8 (Q7)', NULL, 7),
(234, 24, 'Simple interest: P=10000, r=8%, t=2 years (Q8)', NULL, 5),
(235, 24, 'Probability of heads on a coin flip? (Q9)', NULL, 5),
(236, 24, 'Solve x² - 10x + 21 = 0 (Q10)', NULL, 7),
(237, 24, 'Solve: 3(x - 4) = 27 (Q11)', NULL, 5),
(238, 24, 'Find the median of 5, 7, 9, 12, 15 (Q12)', NULL, 5),
(239, 31, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q1)', NULL, 5),
(240, 31, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q2)', NULL, 5),
(241, 31, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q3)', NULL, 5),
(242, 31, 'State and prove the theorem about angles in the same segment (Q4)', NULL, 6),
(243, 31, 'Find the turning point of y = -x² + 6x - 5 (Q5)', NULL, 7),
(244, 31, 'Find the equation of the line passing through points (2,3) and (5,9) (Q6)', NULL, 5),
(245, 31, 'Find the gradient and y-intercept of y = -3x + 7 (Q7)', NULL, 5),
(246, 31, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q8)', NULL, 6),
(247, 31, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q9)', NULL, 5),
(248, 31, 'Prove triangles ABC and DEF are similar (give reasons) (Q10)', NULL, 6),
(249, 31, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q11)', NULL, 5),
(250, 31, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q12)', NULL, 7),
(251, 33, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q1)', NULL, 7),
(252, 33, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q2)', NULL, 8),
(253, 33, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q3)', NULL, 5),
(254, 33, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q4)', NULL, 6),
(255, 33, 'Find the equation of the line passing through points (2,3) and (5,9) (Q5)', NULL, 6),
(256, 33, 'Find the turning point of y = -x² + 6x - 5 (Q6)', NULL, 5),
(257, 33, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q7)', NULL, 7),
(258, 33, 'State and prove the theorem about angles in the same segment (Q8)', NULL, 7),
(259, 33, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q9)', NULL, 7),
(260, 33, 'Prove triangles ABC and DEF are similar (give reasons) (Q10)', NULL, 8),
(261, 33, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q11)', NULL, 5),
(262, 33, 'Find the gradient and y-intercept of y = -3x + 7 (Q12)', NULL, 8),
(263, 33, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q13)', NULL, 6),
(264, 33, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q14)', NULL, 6),
(265, 32, 'State and prove the theorem about angles in the same segment (Q1)', NULL, 7),
(266, 32, 'Find the gradient and y-intercept of y = -3x + 7 (Q2)', NULL, 7),
(267, 32, 'Find the turning point of y = -x² + 6x - 5 (Q3)', NULL, 8),
(268, 32, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q4)', NULL, 7),
(269, 32, 'Prove triangles ABC and DEF are similar (give reasons) (Q5)', NULL, 7),
(270, 32, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q6)', NULL, 6),
(271, 32, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q7)', NULL, 6),
(272, 32, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q8)', NULL, 7),
(273, 32, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q9)', NULL, 5),
(274, 32, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q10)', NULL, 8),
(275, 32, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q11)', NULL, 6),
(276, 32, 'Find the equation of the line passing through points (2,3) and (5,9) (Q12)', NULL, 8),
(277, 25, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q1)', NULL, 8),
(278, 25, 'Find the turning point of y = -x² + 6x - 5 (Q2)', NULL, 5),
(279, 25, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q3)', NULL, 7),
(280, 25, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q4)', NULL, 7),
(281, 25, 'Find the gradient and y-intercept of y = -3x + 7 (Q5)', NULL, 5),
(282, 25, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q6)', NULL, 5),
(283, 25, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q7)', NULL, 5),
(284, 25, 'Find the equation of the line passing through points (2,3) and (5,9) (Q8)', NULL, 7),
(285, 25, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q9)', NULL, 5),
(286, 25, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q10)', NULL, 7),
(287, 25, 'Prove triangles ABC and DEF are similar (give reasons) (Q11)', NULL, 7),
(288, 25, 'State and prove the theorem about angles in the same segment (Q12)', NULL, 7),
(289, 27, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q1)', NULL, 6),
(290, 27, 'State and prove the theorem about angles in the same segment (Q2)', NULL, 8),
(291, 27, 'Find the turning point of y = -x² + 6x - 5 (Q3)', NULL, 6),
(292, 27, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q4)', NULL, 5),
(293, 27, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q5)', NULL, 8),
(294, 27, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q6)', NULL, 7),
(295, 27, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q7)', NULL, 7),
(296, 27, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q8)', NULL, 7),
(297, 27, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q9)', NULL, 5),
(298, 27, 'Prove triangles ABC and DEF are similar (give reasons) (Q10)', NULL, 5),
(299, 27, 'Find the gradient and y-intercept of y = -3x + 7 (Q11)', NULL, 6),
(300, 27, 'Find the equation of the line passing through points (2,3) and (5,9) (Q12)', NULL, 6),
(301, 26, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q1)', NULL, 7),
(302, 26, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q2)', NULL, 5),
(303, 26, 'State and prove the theorem about angles in the same segment (Q3)', NULL, 6),
(304, 26, 'Find the turning point of y = -x² + 6x - 5 (Q4)', NULL, 6),
(305, 26, 'Find the equation of the line passing through points (2,3) and (5,9) (Q5)', NULL, 5),
(306, 26, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q6)', NULL, 6),
(307, 26, 'Find the gradient and y-intercept of y = -3x + 7 (Q7)', NULL, 7),
(308, 26, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q8)', NULL, 7),
(309, 26, 'Prove triangles ABC and DEF are similar (give reasons) (Q9)', NULL, 7),
(310, 26, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q10)', NULL, 6),
(311, 26, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q11)', NULL, 5),
(312, 26, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q12)', NULL, 7),
(313, 26, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q13)', NULL, 6),
(314, 34, 'Find the equation of the line passing through points (2,3) and (5,9) (Q1)', NULL, 7),
(315, 34, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q2)', NULL, 6),
(316, 34, 'State and prove the theorem about angles in the same segment (Q3)', NULL, 7),
(317, 34, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q4)', NULL, 7),
(318, 34, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q5)', NULL, 7),
(319, 34, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q6)', NULL, 6),
(320, 34, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q7)', NULL, 7),
(321, 34, 'Find the gradient and y-intercept of y = -3x + 7 (Q8)', NULL, 7),
(322, 34, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q9)', NULL, 7),
(323, 34, 'Find the turning point of y = -x² + 6x - 5 (Q10)', NULL, 7),
(324, 34, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q11)', NULL, 6),
(325, 34, 'Prove triangles ABC and DEF are similar (give reasons) (Q12)', NULL, 5),
(326, 34, 'Find the equation of the line passing through points (2,3) and (5,9) (Q13)', NULL, 6),
(327, 36, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q1)', NULL, 7),
(328, 36, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q2)', NULL, 8),
(329, 36, 'Prove triangles ABC and DEF are similar (give reasons) (Q3)', NULL, 8),
(330, 36, 'Find the turning point of y = -x² + 6x - 5 (Q4)', NULL, 5),
(331, 36, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q5)', NULL, 6),
(332, 36, 'State and prove the theorem about angles in the same segment (Q6)', NULL, 7),
(333, 36, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q7)', NULL, 5),
(334, 36, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q8)', NULL, 5),
(335, 36, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q9)', NULL, 8),
(336, 36, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q10)', NULL, 6),
(337, 36, 'Find the gradient and y-intercept of y = -3x + 7 (Q11)', NULL, 6),
(338, 36, 'Find the equation of the line passing through points (2,3) and (5,9) (Q12)', NULL, 5),
(339, 35, 'Prove triangles ABC and DEF are similar (give reasons) (Q1)', NULL, 5),
(340, 35, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q2)', NULL, 6),
(341, 35, 'Find the turning point of y = -x² + 6x - 5 (Q3)', NULL, 5),
(342, 35, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q4)', NULL, 6),
(343, 35, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q5)', NULL, 7),
(344, 35, 'Find the equation of the line passing through points (2,3) and (5,9) (Q6)', NULL, 6),
(345, 35, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q7)', NULL, 7),
(346, 35, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q8)', NULL, 5),
(347, 35, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q9)', NULL, 5),
(348, 35, 'Find the gradient and y-intercept of y = -3x + 7 (Q10)', NULL, 5),
(349, 35, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q11)', NULL, 6),
(350, 35, 'State and prove the theorem about angles in the same segment (Q12)', NULL, 8),
(351, 35, 'Prove triangles ABC and DEF are similar (give reasons) (Q13)', NULL, 8),
(352, 35, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q14)', NULL, 8),
(353, 28, 'Find the turning point of y = -x² + 6x - 5 (Q1)', NULL, 8),
(354, 28, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q2)', NULL, 7),
(355, 28, 'Prove triangles ABC and DEF are similar (give reasons) (Q3)', NULL, 6),
(356, 28, 'State and prove the theorem about angles in the same segment (Q4)', NULL, 7),
(357, 28, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q5)', NULL, 7),
(358, 28, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q6)', NULL, 5),
(359, 28, 'Find the gradient and y-intercept of y = -3x + 7 (Q7)', NULL, 5),
(360, 28, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q8)', NULL, 7),
(361, 28, 'Find the equation of the line passing through points (2,3) and (5,9) (Q9)', NULL, 5),
(362, 28, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q10)', NULL, 8),
(363, 28, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q11)', NULL, 5),
(364, 28, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q12)', NULL, 6),
(365, 28, 'Find the turning point of y = -x² + 6x - 5 (Q13)', NULL, 8),
(366, 28, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q14)', NULL, 6),
(367, 28, 'Prove triangles ABC and DEF are similar (give reasons) (Q15)', NULL, 8),
(368, 30, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q1)', NULL, 7),
(369, 30, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q2)', NULL, 7),
(370, 30, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q3)', NULL, 7),
(371, 30, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q4)', NULL, 6),
(372, 30, 'Find the gradient and y-intercept of y = -3x + 7 (Q5)', NULL, 7),
(373, 30, 'Find the turning point of y = -x² + 6x - 5 (Q6)', NULL, 7),
(374, 30, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q7)', NULL, 5),
(375, 30, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q8)', NULL, 6),
(376, 30, 'State and prove the theorem about angles in the same segment (Q9)', NULL, 8),
(377, 30, 'Find the equation of the line passing through points (2,3) and (5,9) (Q10)', NULL, 6),
(378, 30, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q11)', NULL, 7),
(379, 30, 'Prove triangles ABC and DEF are similar (give reasons) (Q12)', NULL, 7),
(380, 30, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q13)', NULL, 6),
(381, 30, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q14)', NULL, 6),
(382, 29, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q1)', NULL, 7),
(383, 29, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q2)', NULL, 5),
(384, 29, 'Sketch the parabola y = x² - 4x + 3 and state its vertex (Q3)', NULL, 8),
(385, 29, 'Solve the system: y = 2x + 1 and y = x² - 3 (Q4)', NULL, 5),
(386, 29, 'Calculate the area of a triangle with vertices (0,0), (6,0), (3,4) (Q5)', NULL, 6),
(387, 29, 'Find the equation of the line passing through points (2,3) and (5,9) (Q6)', NULL, 5),
(388, 29, 'Find the turning point of y = -x² + 6x - 5 (Q7)', NULL, 6),
(389, 29, 'Solve the inequality x² - 5x - 6 ≥ 0 (Q8)', NULL, 5),
(390, 29, 'Prove triangles ABC and DEF are similar (give reasons) (Q9)', NULL, 5),
(391, 29, 'State and prove the theorem about angles in the same segment (Q10)', NULL, 6),
(392, 29, 'Find the gradient and y-intercept of y = -3x + 7 (Q11)', NULL, 6),
(393, 29, 'Determine if points are collinear: (1,2), (3,6), (5,10) (Q12)', NULL, 7),
(394, 29, 'Calculate the length of the hypotenuse in a 8-15-17 triangle (Q13)', NULL, 8),
(395, 29, 'Determine the midpoint and distance between A(-1,4) and B(3, -2) (Q14)', NULL, 6),
(396, 37, 'WHAT IS IN THE IMAGE', NULL, 5),
(397, 37, 'WHAT IS IN THE IMAGE', 'quiz_images/1767450986_user2.jpg', 15),
(398, 38, 'WHAT IS IN THE IMAGE', NULL, 10),
(399, 38, 'WHAT IS IN THE IMAGE', 'quiz_images/1767451410_basketball.png', 7),
(400, 39, 'WHAT IS IN THE IMAGE', NULL, 1),
(401, 40, 'WHAT IS IN THE IMAGE', NULL, 1),
(402, 41, 'WHAT IS IN THE IMAGE', NULL, 1),
(403, 42, 'WHAT IS IN THE IMAGE', NULL, 5),
(404, 42, 'WHAT IS IN THE IMAGE', 'quiz_images/1767866593_1750499092_user2.jpg', 7),
(405, 43, 'WHAT IS IN THE IMAGE', NULL, 5),
(406, 44, 'WHAT IS IN THE IMAGE', NULL, 3),
(407, 44, 'WHAT IS IN THE IMAGE', NULL, 7),
(408, 45, 'WHAT IS IN THE IMAGE', NULL, 1),
(409, 46, 'WHAT IS IN THE IMAGE', NULL, 5),
(410, 47, 'WHAT IS IN THE IMAGE', NULL, 4),
(411, 48, 'WHAT IS IN THE IMAGE', NULL, 3),
(412, 49, 'WHAT IS IN THE IMAGE', NULL, 2),
(413, 50, 'WHAT IS IN THE IMAGE', NULL, 3),
(414, 51, 'WHAT IS IN THE IMAGE', NULL, 3),
(415, 52, 'WHAT IS IN THE IMAGE', NULL, 3),
(416, 53, 'WHAT IS IN THE IMAGE', NULL, 1),
(417, 54, 'WHAT IS IN THE IMAGE', NULL, 1),
(418, 55, 'WHAT IS IN THE IMAGE', NULL, 1),
(419, 57, 'WHAT IS IN THE IMAGE', NULL, 2),
(420, 59, 'WHAT IS IN THE IMAGE', NULL, 3),
(421, 60, 'WHAT IS IN THE IMAGE', NULL, 2),
(422, 61, 'WHAT IS IN THE IMAGE', NULL, 2),
(423, 62, 'WHAT IS IN THE IMAGE', NULL, 1),
(424, 62, 'WHAT IS IN THE IMAGE', NULL, 1),
(425, 62, 'WHAT IS IN THE IMAGE', NULL, 1),
(426, 63, 'WHAT IS IN THE IMAGE', NULL, 1),
(427, 63, 'WHAT IS IN THE IMAGE', NULL, 1),
(428, 64, 'WHAT IS IN THE IMAGE', NULL, 1),
(429, 65, 'WHAT IS IN THE IMAGE', NULL, 1),
(430, 66, 'WHAT IS IN THE IMAGE', NULL, 1),
(431, 67, 'WHAT IS IN THE IMAGE', NULL, 1),
(432, 68, 'WHAT IS IN THE IMAGE', NULL, 3),
(433, 69, 'WHAT IS IN THE IMAGE', NULL, 3),
(434, 70, 'WHAT IS IN THE IMAGE', NULL, 3),
(435, 71, 'WHAT IS IN THE IMAGE', NULL, 4),
(436, 71, 'WHAT IS IN THE IMAGE', NULL, 5),
(437, 71, 'WHAT IS IN THE IMAGE', 'quiz_images/1768127557_1750499092_user2.jpg', 5),
(438, 71, 'WHAT IS IN THE IMAGE', NULL, 6),
(439, 72, 'WHAT IS IN THE IMAGE', NULL, 5),
(440, 72, 'WHAT IS IN THE IMAGE', NULL, 5),
(441, 72, 'WHAT IS IN THE IMAGE', NULL, 5),
(442, 72, 'WHAT IS IN THE IMAGE', NULL, 1),
(443, 72, 'WHAT IS IN THE IMAGE', NULL, 5),
(444, 73, 'WHAT IS IN THE IMAGE', NULL, 5),
(445, 73, 'WHAT IS IN THE IMAGE', NULL, 5),
(446, 76, 'WHAT IS IN THE IMAGE', NULL, 1),
(447, 76, 'WHAT IS IN THE IMAGE', NULL, 2),
(448, 76, 'WHAT IS IN THE IMAGE', NULL, 3),
(449, 76, 'WHAT IS IN THE IMAGE', NULL, 4),
(450, 76, 'WHAT IS IN THE IMAGE', NULL, 5),
(451, 76, 'WHAT IS IN THE IMAGE', NULL, 6),
(452, 77, 'WHAT IS IN THE IMAGE', NULL, 1),
(453, 77, 'WHAT IS IN THE IMAGE', NULL, 2),
(454, 78, 'WHAT IS IN THE IMAGE', NULL, 1),
(455, 78, 'WHAT IS IN THE IMAGE', NULL, 2),
(456, 78, 'WHAT IS IN THE IMAGE', NULL, 3),
(457, 78, 'WHAT IS IN THE IMAGE', NULL, 4),
(458, 78, 'WHAT IS IN THE IMAGE', NULL, 5),
(459, 79, 'question 1', NULL, 1),
(460, 79, 'Question ', NULL, 1),
(461, 80, 'WHAT IS IN THE IMAGE', NULL, 1),
(462, 81, 'WHAT IS IN THE IMAGE', NULL, 1),
(463, 82, 'WHAT IS IN THE IMAGE', NULL, 1),
(464, 83, 'WHAT IS IN THE IMAGE', NULL, 1),
(465, 83, 'WHAT IS IN THE IMAGE', NULL, 1),
(466, 83, 'WHAT IS IN THE IMAGE', NULL, 1),
(467, 84, 'WHAT IS IN THE IMAGE', NULL, 1),
(468, 86, 'WHAT IS IN THE IMAGE', NULL, 1),
(469, 87, 'WHAT IS IN THE IMAGE', NULL, 1),
(470, 87, 'WHAT IS IN THE IMAGE', NULL, 2),
(471, 87, 'WHAT IS IN THE IMAGE', NULL, 3),
(472, 87, 'WHAT IS IN THE IMAGE', NULL, 4),
(473, 87, 'WHAT IS IN THE IMAGE', NULL, 5),
(474, 88, 'WHAT IS IN THE IMAGE', NULL, 3),
(475, 89, 'WHAT IS IN THE IMAGE', NULL, 7),
(476, 90, 'WHAT IS IN THE IMAGE', NULL, 1),
(477, 91, 'WHAT IS IN THE IMAGE', NULL, 1),
(478, 91, 'WHAT IS IN THE IMAGE', NULL, 2),
(479, 92, 'WHAT IS IN THE IMAGE', NULL, 1),
(480, 92, 'WHAT IS IN THE IMAGE', NULL, 2),
(481, 92, 'WHAT IS IN THE IMAGE', NULL, 3),
(482, 92, 'WHAT IS IN THE IMAGE', NULL, 4),
(483, 92, 'WHAT IS IN THE IMAGE', NULL, 5),
(484, 92, 'WHAT IS IN THE IMAGE', NULL, 6),
(485, 92, 'WHAT IS IN THE IMAGE', NULL, 7),
(486, 92, 'WHAT IS IN THE IMAGE', NULL, 8),
(487, 92, 'WHAT IS IN THE IMAGE', NULL, 9),
(488, 92, 'WHAT IS IN THE IMAGE', NULL, 10),
(489, 93, 'WHAT IS IN THE IMAGE', NULL, 1),
(490, 93, 'WHAT IS IN THE IMAGE', NULL, 2),
(491, 93, 'WHAT IS IN THE IMAGE', NULL, 3),
(492, 93, 'WHAT IS IN THE IMAGE', NULL, 4),
(493, 93, 'WHAT IS IN THE IMAGE', NULL, 5),
(494, 93, 'WHAT IS IN THE IMAGE', NULL, 6),
(495, 93, 'WHAT IS IN THE IMAGE', NULL, 7),
(496, 93, 'WHAT IS IN THE IMAGE', NULL, 8),
(497, 94, 'WHAT IS IN THE IMAGE', NULL, 1),
(498, 94, 'WHAT IS IN THE IMAGE', NULL, 2),
(499, 94, 'WHAT IS IN THE IMAGE', NULL, 3),
(500, 94, 'WHAT IS IN THE IMAGE', NULL, 4),
(501, 94, 'WHAT IS IN THE IMAGE', NULL, 5),
(502, 94, 'WHAT IS IN THE IMAGE', NULL, 6),
(503, 94, 'WHAT IS IN THE IMAGE', NULL, 7),
(504, 95, 'WHAT IS IN THE IMAGE', NULL, 1),
(505, 95, 'WHAT IS IN THE IMAGE', NULL, 2),
(506, 95, 'WHAT IS IN THE IMAGE', NULL, 3),
(507, 97, 'WHAT IS IN THE IMAGE', NULL, 1),
(508, 97, 'WHAT IS IN THE IMAGE', NULL, 2),
(509, 98, 'WHAT IS IN THE IMAGE', NULL, 1),
(510, 98, 'WHAT IS IN THE IMAGE', NULL, 2),
(511, 99, 'WHAT IS IN THE IMAGE', NULL, 1),
(512, 99, 'WHAT IS IN THE IMAGE', NULL, 2),
(513, 99, 'WHAT IS IN THE IMAGE', NULL, 3),
(514, 100, 'WHAT IS IN THE IMAGE', NULL, 1),
(515, 100, 'WHAT IS IN THE IMAGE', NULL, 2),
(516, 101, 'WHAT IS IN THE IMAGE', NULL, 1),
(517, 101, 'WHAT IS IN THE IMAGE', NULL, 2),
(518, 103, 'WHAT IS IN THE IMAGE', NULL, 1),
(519, 104, 'WHAT IS IN THE IMAGE', NULL, 2),
(520, 105, 'WHAT IS IN THE IMAGE', NULL, 1),
(521, 106, 'WHAT IS IN THE IMAGE', NULL, 1),
(522, 107, 'WHAT IS IN THE IMAGE', NULL, 1),
(523, 108, 'WHAT IS IN THE IMAGE', NULL, 1),
(524, 109, 'WHAT IS IN THE IMAGE', NULL, 1),
(525, 110, 'WHAT IS IN THE IMAGE', NULL, 1),
(526, 112, 'WHAT IS IN THE IMAGE', NULL, 1),
(527, 113, 'WHAT IS IN THE IMAGE', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `quizzes`
--

CREATE TABLE `quizzes` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `duration` int(11) NOT NULL,
  `publish_marks` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `class_id` int(11) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) NOT NULL DEFAULT 4,
  `attempt_limit` int(11) DEFAULT 1,
  `start_time` datetime DEFAULT NULL,
  `notify` tinyint(1) DEFAULT 0,
  `notification_sent` tinyint(1) DEFAULT 0,
  `status` enum('Scheduled','Open','Closed') DEFAULT 'Open',
  `is_summative` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 if counts toward term mark (verified), 0 if practice',
  `weight_percent` decimal(5,2) DEFAULT NULL COMMENT 'Weight % for term mark (e.g., 40.00 for 40%)',
  `layout_mode` enum('single_page','multi_page') DEFAULT 'single_page',
  `shuffle_questions` tinyint(1) DEFAULT 0,
  `is_linear` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quizzes`
--

INSERT INTO `quizzes` (`id`, `title`, `duration`, `publish_marks`, `created_by`, `created_at`, `class_id`, `academic_year_id`, `term_number`, `attempt_limit`, `start_time`, `notify`, `notification_sent`, `status`, `is_summative`, `weight_percent`, `layout_mode`, `shuffle_questions`, `is_linear`) VALUES
(1, 'Term 1: Number Patterns', 30, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:19', 5, 1, 1, 1, '2025-02-20 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(2, 'Term 1: Algebra Basics', 40, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:19', 5, 1, 1, 1, '2025-02-20 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(3, 'Term 1: Summative Test 1', 60, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:19', 5, 1, 1, 1, '2025-02-14 09:00:00', 0, 0, 'Closed', 1, 30.00, 'single_page', 0, 0),
(4, 'Test 1', 45, 1, 'lerato.patel@iskool.demo', '2025-12-10 12:07:19', 6, 1, 1, 1, '2025-02-16 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(5, 'Test 2', 60, 1, 'lerato.patel@iskool.demo', '2025-12-10 12:07:19', 6, 1, 1, 1, '2025-02-25 09:00:00', 0, 0, 'Closed', 1, 35.00, 'single_page', 0, 0),
(6, 'Term 2: Equations & Inequalities', 35, 1, 'nomsa.khumalo@iskool.demo', '2025-12-10 12:07:19', 5, 1, 2, 1, '2025-05-10 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(7, 'Term 2: Functions Practice', 40, 1, 'nomsa.khumalo@iskool.demo', '2025-12-10 12:07:20', 5, 1, 2, 1, '2025-05-22 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(8, 'Term 2: Mid-Year Summative', 90, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:20', 5, 1, 2, 1, '2025-05-16 09:00:00', 0, 0, 'Closed', 1, 40.00, 'single_page', 0, 0),
(9, 'Term 2: Waves & Sound', 50, 1, 'pieter.vandermerwe@iskool.demo', '2025-12-10 12:07:20', 6, 1, 2, 1, '2025-05-18 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(10, 'Term 2: Electricity Basics', 45, 1, 'lerato.patel@iskool.demo', '2025-12-10 12:07:20', 6, 1, 2, 1, '2025-05-11 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(11, 'Term 2: Summative Test', 70, 1, 'lerato.patel@iskool.demo', '2025-12-10 12:07:20', 6, 1, 2, 1, '2025-05-15 09:00:00', 0, 0, 'Closed', 1, 40.00, 'single_page', 0, 0),
(12, 'Term 3: Euclidean Geometry', 50, 1, 'nomsa.khumalo@iskool.demo', '2025-12-10 12:07:20', 5, 1, 3, 1, '2025-08-10 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(13, 'Term 3: Analytical Geometry', 40, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:20', 5, 1, 3, 1, '2025-08-21 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(14, 'Term 3: Final Summative', 120, 1, 'thabo.nkosi@iskool.demo', '2025-12-10 12:07:20', 5, 1, 3, 1, '2025-08-22 09:00:00', 0, 0, 'Closed', 1, 30.00, 'single_page', 0, 0),
(15, 'Term 3: Chemical Bonding', 55, 1, 'pieter.vandermerwe@iskool.demo', '2025-12-10 12:07:20', 6, 1, 3, 1, '2025-08-21 09:00:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(16, 'Term 3: End-of-Year Summative', 120, 1, 'lerato.patel@iskool.demo', '2025-12-10 12:07:20', 6, 1, 3, 1, '2025-08-17 09:00:00', 0, 0, 'Closed', 1, 30.00, 'single_page', 0, 0),
(17, 'Test 5', 70, 1, 'lerato.patel@iskool.demo', '2025-12-11 15:03:20', 6, 1, 1, 1, '2025-03-23 09:00:00', 0, 0, 'Closed', 1, 40.00, 'single_page', 0, 0),
(18, 'Test 4', 65, 1, 'lerato.patel@iskool.demo', '2025-12-11 15:03:20', 6, 1, 1, 1, '2025-03-26 09:00:00', 0, 0, 'Closed', 1, 35.00, 'single_page', 0, 0),
(19, 'Test 3', 80, 1, 'lerato.patel@iskool.demo', '2025-12-11 15:03:20', 6, 1, 1, 1, '2025-03-19 09:00:00', 0, 0, 'Closed', 1, 45.00, 'single_page', 0, 0),
(20, 'Test 1', 75, 1, 'lerato.patel@iskool.demo', '2025-12-11 15:03:21', 6, 1, 1, 1, '2025-03-28 09:00:00', 0, 0, 'Closed', 1, 40.00, 'single_page', 0, 0),
(21, 'Term 4: Trigonometry Summative Assessment', 90, 1, 'mandlasimphiwe500@gmail.com', '2025-12-14 09:20:17', 5, 1, 4, 1, '2025-10-18 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(22, 'Term 4: Statistics & Data Handling Summative', 90, 1, 'thabo.nkosi@iskool.demo', '2025-12-14 09:20:17', 5, 1, 4, 1, '2025-10-21 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(23, 'Term 4: Probability Summative Assessment', 90, 1, 'lerato.patel@iskool.demo', '2025-12-14 09:20:17', 5, 1, 4, 1, '2025-10-14 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(24, 'Term 4: Financial Mathematics Summative', 90, 1, 'nomsa.khumalo@iskool.demo', '2025-12-14 09:20:17', 5, 1, 4, 1, '2025-10-08 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(25, 'Term 4: Analytical Geometry Summative Assessment', 97, 1, 'mandlasimphiwe500@gmail.com', '2025-12-14 09:37:09', 5, 1, 4, 1, '2025-10-10 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(26, 'Term 4: Functions and Graphs Summative Assessment', 97, 1, 'mandlasimphiwe500@gmail.com', '2025-12-14 09:37:09', 5, 1, 4, 1, '2025-10-21 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(27, 'Term 4: Euclidean Geometry Summative Assessment', 83, 1, 'mandlasimphiwe500@gmail.com', '2025-12-14 09:37:09', 5, 1, 4, 1, '2025-10-18 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(28, 'Term 4: Analytical Geometry Summative Assessment', 82, 1, 'thabo.nkosi@iskool.demo', '2025-12-14 09:37:09', 5, 1, 4, 1, '2025-10-10 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(29, 'Term 4: Functions and Graphs Summative Assessment', 98, 1, 'thabo.nkosi@iskool.demo', '2025-12-14 09:37:09', 5, 1, 4, 1, '2025-10-14 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(30, 'Term 4: Euclidean Geometry Summative Assessment', 94, 1, 'thabo.nkosi@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-10-15 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(31, 'Term 4: Analytical Geometry Summative Assessment', 81, 1, 'lerato.patel@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-15 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(32, 'Term 4: Functions and Graphs Summative Assessment', 85, 1, 'lerato.patel@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-15 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(33, 'Term 4: Euclidean Geometry Summative Assessment', 80, 1, 'lerato.patel@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-23 09:00:00', 0, 0, 'Open', 1, 25.00, 'single_page', 0, 0),
(34, 'Term 4: Analytical Geometry Summative Assessment', 99, 1, 'nomsa.khumalo@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-20 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(35, 'Term 4: Functions and Graphs Summative Assessment', 81, 1, 'nomsa.khumalo@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-24 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(36, 'Term 4: Euclidean Geometry Summative Assessment', 84, 1, 'nomsa.khumalo@iskool.demo', '2025-12-14 09:37:10', 5, 1, 4, 1, '2025-11-15 09:00:00', 0, 0, 'Closed', 1, 25.00, 'single_page', 0, 0),
(37, 'Chemistry Test 1', 4, 1, 'lerato.patel@iskool.demo', '2026-01-03 14:36:26', 1, 1, 4, 1, '2026-01-03 16:38:00', 0, 0, '', 1, 10.00, 'single_page', 0, 0),
(38, 'Chemistry Test 2', 4, 1, 'lerato.patel@iskool.demo', '2026-01-03 14:43:30', 1, 1, 4, 1, '2026-01-03 16:45:00', 0, 0, '', 1, 10.00, 'single_page', 0, 0),
(39, 'Chemistry Test 3', 4, 1, 'lerato.patel@iskool.demo', '2026-01-03 14:47:30', 1, 1, 4, 1, '2026-01-03 16:49:00', 0, 0, '', 1, 10.00, 'single_page', 0, 0),
(40, 'Quiz Testing 1', 10, 1, 'lerato.patel@iskool.demo', '2026-01-07 20:28:11', 1, 1, 4, 1, '2026-01-07 22:30:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(41, 'Momentum', 4, 1, 'lerato.patel@iskool.demo', '2026-01-08 08:36:24', 1, 1, 4, 1, '2026-01-08 10:37:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(42, 'Polynomials', 3, 1, 'lerato.patel@iskool.demo', '2026-01-08 10:03:13', 1, 1, 4, 1, '2026-01-08 12:04:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(43, 'Polynomials 2', 3, 1, 'lerato.patel@iskool.demo', '2026-01-08 10:13:46', 1, 1, 4, 1, '2026-01-08 12:15:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(44, 'Polynomials 3', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 10:24:39', 1, 1, 4, 1, '2026-01-08 12:25:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(45, 'Polynomials 4', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 12:12:55', 1, 1, 4, 1, '2026-01-08 14:14:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(46, 'Polynomials 5', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 16:06:14', 1, 1, 4, 1, '2026-01-08 18:07:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(47, 'Polynomials 6', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 16:07:57', 1, 1, 4, 1, '2026-01-08 18:09:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(48, 'Polynomials 7', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 16:11:05', 1, 1, 4, 1, '2026-01-08 18:12:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(49, 'Polynomials 1.1', 2, 1, 'lerato.patel@iskool.demo', '2026-01-08 16:32:11', 1, 1, 4, 1, '2026-01-08 18:33:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(50, 'Chemistry 3', 2, 0, 'lerato.patel@iskool.demo', '2026-01-09 14:52:43', 1, 1, 4, 1, '2026-01-09 16:54:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(51, 'Chemistry 4', 2, 0, 'lerato.patel@iskool.demo', '2026-01-09 14:54:42', 1, 1, 4, 1, '2026-01-09 16:55:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(52, 'Chemistry 5', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 14:56:26', 1, 1, 4, 1, '2026-01-09 17:57:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(53, 'Quiz', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 14:58:31', 1, 1, 4, 1, '2026-01-09 17:00:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(54, 'Quiz Testing 1.1', 2, 0, 'lerato.patel@iskool.demo', '2026-01-09 15:16:53', 1, 1, 4, 1, '2026-01-09 17:18:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(55, 'Chemistry 6', 2, 0, 'lerato.patel@iskool.demo', '2026-01-09 15:19:38', 1, 1, 4, 1, '2026-01-09 17:21:00', 0, 0, '', 0, NULL, 'single_page', 0, 0),
(56, 'Testing', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 15:51:23', 1, 1, 4, 1, '2026-01-09 17:52:00', 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(57, 'Testing', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 15:51:23', 1, 1, 4, 1, '2026-01-09 17:52:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(58, 'Testing 2', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 15:53:58', 1, 1, 4, 1, '2026-01-09 17:56:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(59, 'Testing 2', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 15:53:58', 1, 1, 4, 1, '2026-01-09 17:56:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(60, 'Testing 3', 2, 1, 'lerato.patel@iskool.demo', '2026-01-09 16:03:55', 1, 1, 4, 1, '2026-01-09 18:08:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(61, 'Isizulu', 3, 1, 'lerato.patel@iskool.demo', '2026-01-09 21:04:09', 1, 1, 4, 1, '2026-01-09 23:05:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(62, 'Quadratics', 3, 1, 'lerato.patel@iskool.demo', '2026-01-10 08:31:42', 1, 1, 4, 1, '2026-01-10 10:33:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(63, 'Quadratics', 3, 1, 'lerato.patel@iskool.demo', '2026-01-10 08:56:46', 1, 5, 1, 1, '2026-01-10 10:58:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(64, 'Quadratics 2', 3, 1, 'lerato.patel@iskool.demo', '2026-01-10 09:01:54', 1, 5, 1, 1, '2026-01-10 11:03:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(65, 'Quadratics 3', 3, 1, 'lerato.patel@iskool.demo', '2026-01-10 09:36:52', 1, 5, 1, 1, '2026-01-10 11:38:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(66, 'Quadratics 3', 3, 1, 'lerato.patel@iskool.demo', '2026-01-10 10:47:01', 1, 5, 1, 1, '2026-01-10 12:48:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(67, 'Quadratics 4', 4, 1, 'lerato.patel@iskool.demo', '2026-01-10 10:57:35', 1, 5, 1, 1, '2026-01-10 12:59:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(68, 'Quadratics 5', 4, 1, 'lerato.patel@iskool.demo', '2026-01-10 11:35:26', 1, 5, 1, 1, '2026-01-10 13:37:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(69, 'Quadratics 6', 4, 1, 'lerato.patel@iskool.demo', '2026-01-10 11:36:51', 1, 5, 1, 1, '2026-01-10 13:38:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(70, 'Quadratics 7', 3, 1, 'lerato.patel@iskool.demo', '2026-01-11 08:47:41', 1, 5, 1, 1, '2026-01-11 10:49:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(71, 'Quadratics 8', 3, 1, 'lerato.patel@iskool.demo', '2026-01-11 10:32:37', 1, 5, 1, 1, '2026-01-11 12:34:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 0),
(72, 'Quadratics 9', 4, 1, 'lerato.patel@iskool.demo', '2026-01-11 12:45:56', 1, 5, 1, 1, '2026-01-11 14:47:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 0),
(73, 'Quadratics 10', 3, 1, 'lerato.patel@iskool.demo', '2026-01-11 12:48:03', 1, 5, 1, 1, '2026-01-11 14:49:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(74, 'Momentum', 0, 0, 'lerato.patel@iskool.demo', '2026-01-12 14:57:41', 1, 5, 1, 1, NULL, 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(75, 'Momentum 2', 0, 0, 'lerato.patel@iskool.demo', '2026-01-12 15:02:26', 1, 5, 1, 1, NULL, 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(76, 'Doppler Effect', 3, 1, 'lerato.patel@iskool.demo', '2026-01-13 15:00:55', 1, 5, 1, 1, '2026-01-13 17:03:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 0),
(77, 'Quiz Testing 200', 3, 1, 'lerato.patel@iskool.demo', '2026-01-13 15:06:10', 1, 5, 1, 1, '2026-01-13 17:08:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 0),
(78, 'Quadratics 11', 3, 1, 'lerato.patel@iskool.demo', '2026-01-15 13:01:59', 1, 5, 1, 1, '2026-01-15 15:04:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 1),
(79, 'Linear Series', 3, 0, 'lerato.patel@iskool.demo', '2026-01-25 09:52:41', 1, 5, 1, 1, '2026-01-25 11:55:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 1),
(80, 'Api quiz', 25, 1, 'thabo.nkosi@iskool.demo', '2026-02-07 14:17:12', 1, 5, 1, 1, '2026-02-07 16:19:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(81, 'Dynamic header', 100, 1, 'lerato.patel@iskool.demo', '2026-02-10 11:42:22', 1, 5, 1, 1, '2026-02-10 13:44:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(82, 'Quadratics', 100, 1, 'lerato.patel@iskool.demo', '2026-02-11 10:43:40', 1, 5, 1, 1, '2026-02-11 12:50:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(83, 'Quadratics', 5, 1, 'lerato.patel@iskool.demo', '2026-02-18 18:02:48', 1, 5, 1, 1, '2026-02-18 19:02:00', 0, 0, 'Open', 1, 10.00, 'multi_page', 1, 1),
(84, 'Physics', 4, 1, 'lerato.patel@iskool.demo', '2026-02-18 18:12:09', 1, 5, 1, 1, '2026-02-18 20:14:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(85, 'Chemistry Test', 0, 0, 'lerato.patel@iskool.demo', '2026-02-23 19:55:53', 1, 5, 1, 1, NULL, 0, 0, 'Closed', 0, NULL, 'single_page', 0, 0),
(86, 'MATHS TEST 1', 5, 1, 'lerato.patel@iskool.demo', '2026-02-24 14:07:29', 1, 5, 1, 1, '2026-02-24 16:08:00', 0, 0, 'Scheduled', 1, 5.00, 'single_page', 0, 0),
(87, 'Branch Cuts', 3, 1, 'lerato.patel@iskool.demo', '2026-02-28 11:50:18', 1, 5, 1, 1, '2026-02-28 13:55:00', 0, 0, 'Scheduled', 1, 5.00, 'multi_page', 1, 1),
(88, 'Riemann Sum', 3, 1, 'lerato.patel@iskool.demo', '2026-02-28 12:08:59', 1, 5, 1, 1, '2026-02-28 14:12:00', 0, 0, 'Scheduled', 1, 5.00, 'single_page', 0, 0),
(89, 'Induction', 3, 1, 'lerato.patel@iskool.demo', '2026-02-28 12:15:32', 1, 5, 1, 1, '2026-02-28 14:19:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(90, 'Fourier Series', 5, 1, 'lerato.patel@iskool.demo', '2026-03-02 08:55:35', 1, 5, 1, 1, '2026-03-02 11:15:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(91, 'Filters', 3, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-04 15:18:06', 1, 5, 1, 1, '2026-03-04 17:25:00', 0, 0, 'Scheduled', 1, 15.00, 'single_page', 0, 0),
(92, 'Multi-page', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-05 12:41:14', 1, 5, 1, 1, '2026-03-05 14:44:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 1),
(93, 'State Space Analysis', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-05 14:29:11', 1, 5, 1, 1, '2026-03-05 16:32:00', 0, 0, 'Scheduled', 1, 15.00, 'multi_page', 1, 1),
(94, 'Multi-page 2', 10, 0, 'sibusiso.mokoena@iskool.demo', '2026-03-05 18:13:17', 1, 5, 1, 1, '2026-03-05 20:16:00', 0, 0, 'Scheduled', 0, NULL, 'multi_page', 1, 1),
(95, 'Probability', 5, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 12:26:21', 1, 5, 2, 1, '2026-03-08 14:30:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(96, 'Statistics', 5, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 12:29:45', 1, 5, 2, 1, '2026-03-08 14:32:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(97, 'Geometry', 5, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 12:34:48', 1, 5, 3, 1, '2026-03-08 14:37:00', 0, 0, 'Scheduled', 1, 5.00, 'single_page', 0, 0),
(98, 'Venn diagram', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 12:36:45', 1, 5, 3, 1, '2026-03-08 14:39:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(99, 'Functions', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 13:00:43', 1, 5, 1, 1, '2026-03-08 15:02:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(100, 'Annuities', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 13:02:46', 1, 5, 1, 1, '2026-03-08 15:05:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(101, 'Limits', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-08 13:04:32', 1, 5, 1, 1, '2026-03-08 15:06:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 0, 0),
(102, 'Polygons', 5, 1, 'thabo.nkosi@iskool.demo', '2026-03-08 13:06:48', 1, 5, 1, 1, '2026-03-08 15:09:00', 0, 0, 'Scheduled', 1, 10.00, 'multi_page', 1, 1),
(103, 'Polygons II', 5, 1, 'thabo.nkosi@iskool.demo', '2026-03-08 13:08:32', 1, 5, 1, 1, '2026-03-08 15:10:00', 0, 0, 'Scheduled', 1, 10.00, 'single_page', 0, 0),
(104, 'Identities', 5, 1, 'lerato.patel@iskool.demo', '2026-03-08 13:10:14', 1, 5, 1, 1, '2026-03-08 15:12:00', 0, 0, 'Scheduled', 1, 10.00, 'single_page', 0, 0),
(105, 'Chapter 3 test', 10, 1, 'sibusiso.mokoena@iskool.demo', '2026-03-22 12:09:07', 1, 5, 1, 1, '2026-03-22 14:13:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(106, 'Chemistry 3', 30, 1, 'lerato.patel@iskool.demo', '2026-04-08 13:51:43', 1, 5, 1, 1, '2026-04-08 15:54:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(107, 'New quiz', 10, 0, 'sibusiso.mokoena@iskool.demo', '2026-04-18 13:10:33', 1, 5, 1, 1, '2026-04-18 15:14:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(108, 'Diagonals', 20, 0, 'sibusiso.mokoena@iskool.demo', '2026-04-20 11:50:51', 1, 5, 1, 1, '2026-04-20 13:55:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(109, 'Chapter 5', 25, 1, 'sibusiso.mokoena@iskool.demo', '2026-04-28 09:34:24', 1, 5, 1, 1, '2026-04-28 11:38:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(110, 'Fourier Series', 25, 1, 'sibusiso.mokoena@iskool.demo', '2026-05-13 10:48:47', 1, 5, 1, 1, '2026-05-13 13:47:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0),
(111, 'Quadratics', 25, 1, 'sibusiso.mokoena@iskool.demo', '2026-05-13 11:08:16', 1, 5, 1, 1, '2026-05-13 13:11:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(112, 'Quadratics', 30, 1, 'sibusiso.mokoena@iskool.demo', '2026-05-13 11:10:02', 1, 5, 1, 1, '2026-05-13 13:14:00', 0, 0, 'Open', 0, NULL, 'single_page', 0, 0),
(113, 'Linear Test', 15, 1, 'sibusiso.mokoena@iskool.demo', '2026-05-25 13:17:18', 1, 5, 1, 1, '2026-05-25 15:24:00', 0, 0, 'Scheduled', 0, NULL, 'single_page', 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_attempts`
--

CREATE TABLE `quiz_attempts` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) DEFAULT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `attempt_count` int(11) DEFAULT 0,
  `last_attempt` timestamp NOT NULL DEFAULT current_timestamp(),
  `start_time` datetime DEFAULT NULL,
  `status` enum('in_progress','submitted','timed_out') DEFAULT 'in_progress',
  `current_step` int(11) DEFAULT 0,
  `question_order` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quiz_attempts`
--

INSERT INTO `quiz_attempts` (`id`, `user_email`, `quiz_id`, `attempt_count`, `last_attempt`, `start_time`, `status`, `current_step`, `question_order`) VALUES
(1, 'ayanda.gumede@iskool.demo', 1, 1, '2025-02-19 03:06:39', NULL, 'in_progress', 0, NULL),
(2, 'ayanda.khoza@iskool.demo', 1, 1, '2025-02-23 23:50:41', NULL, 'in_progress', 0, NULL),
(3, 'sanele.khuzwayo@iskool.demo', 1, 1, '2025-02-17 07:16:45', NULL, 'in_progress', 0, NULL),
(4, 'junior.khuzwayo@iskool.demo', 1, 1, '2025-02-23 23:02:23', NULL, 'in_progress', 0, NULL),
(5, 'rethabile.vilakazi@iskool.demo', 1, 1, '2025-02-25 02:42:06', NULL, 'in_progress', 0, NULL),
(6, 'tshepo.nkosi@iskool.demo', 1, 1, '2025-02-19 12:57:18', NULL, 'in_progress', 0, NULL),
(7, 'rethabile.khoza@iskool.demo', 1, 1, '2025-02-18 21:06:37', NULL, 'in_progress', 0, NULL),
(8, 'rethabile.hlongwane@iskool.demo', 1, 1, '2025-02-26 20:17:54', NULL, 'in_progress', 0, NULL),
(9, 'ofentse.ngubane@iskool.demo', 1, 1, '2025-02-19 00:49:18', NULL, 'in_progress', 0, NULL),
(10, 'siya.vilakazi@iskool.demo', 1, 1, '2025-02-17 20:27:54', NULL, 'in_progress', 0, NULL),
(11, 'bongani.mbatha@iskool.demo', 1, 1, '2025-02-18 05:34:38', NULL, 'in_progress', 0, NULL),
(12, 'rethabile.mbatha@iskool.demo', 1, 1, '2025-02-22 00:46:41', NULL, 'in_progress', 0, NULL),
(13, 'sipho.dlamini@iskool.demo', 1, 1, '2025-02-26 14:24:42', NULL, 'in_progress', 0, NULL),
(14, 'junior.mthembu@iskool.demo', 1, 1, '2025-02-22 01:00:30', NULL, 'in_progress', 0, NULL),
(15, 'mpho.hlongwane@iskool.demo', 1, 1, '2025-02-19 03:55:24', NULL, 'in_progress', 0, NULL),
(16, 'sanele.dlamini@iskool.demo', 1, 1, '2025-02-25 13:25:18', NULL, 'in_progress', 0, NULL),
(17, 'bongani.khuzwayo@iskool.demo', 1, 1, '2025-02-24 09:35:57', NULL, 'in_progress', 0, NULL),
(18, 'lungile.buthelezi@iskool.demo', 1, 1, '2025-02-19 15:42:17', NULL, 'in_progress', 0, NULL),
(19, 'athi.hlongwane@iskool.demo', 1, 1, '2025-02-24 11:38:04', NULL, 'in_progress', 0, NULL),
(20, 'andile.mthethwa@iskool.demo', 1, 1, '2025-02-18 23:26:43', NULL, 'in_progress', 0, NULL),
(21, 'lindani.sibiya@iskool.demo', 1, 1, '2025-02-18 22:13:01', NULL, 'in_progress', 0, NULL),
(22, 'ayanda.mathenjwa@iskool.demo', 1, 1, '2025-02-18 22:36:54', NULL, 'in_progress', 0, NULL),
(23, 'rethabile.dlamini@iskool.demo', 1, 1, '2025-02-17 21:38:15', NULL, 'in_progress', 0, NULL),
(24, 'lindani.vilakazi@iskool.demo', 1, 1, '2025-02-23 11:23:03', NULL, 'in_progress', 0, NULL),
(25, 'andile.mthethwa@iskool.demo', 2, 1, '2025-02-23 21:12:50', NULL, 'in_progress', 0, NULL),
(26, 'rethabile.hlongwane@iskool.demo', 2, 1, '2025-02-18 03:48:25', NULL, 'in_progress', 0, NULL),
(27, 'lwandle.mthembu@iskool.demo', 2, 1, '2025-02-25 16:59:11', NULL, 'in_progress', 0, NULL),
(28, 'ayanda.gumede@iskool.demo', 2, 1, '2025-02-25 22:18:24', NULL, 'in_progress', 0, NULL),
(29, 'mpho.hlongwane@iskool.demo', 2, 1, '2025-02-18 00:36:03', NULL, 'in_progress', 0, NULL),
(30, 'athi.hlongwane@iskool.demo', 2, 1, '2025-02-17 16:04:51', NULL, 'in_progress', 0, NULL),
(31, 'lwandle.ngubane@iskool.demo', 2, 1, '2025-02-17 09:30:00', NULL, 'in_progress', 0, NULL),
(32, 'sanele.mokoena@iskool.demo', 2, 1, '2025-02-23 12:09:30', NULL, 'in_progress', 0, NULL),
(33, 'junior.mthembu@iskool.demo', 2, 1, '2025-02-18 21:43:16', NULL, 'in_progress', 0, NULL),
(34, 'rethabile.mbatha@iskool.demo', 2, 1, '2025-02-26 17:07:01', NULL, 'in_progress', 0, NULL),
(35, 'ayanda.mathenjwa@iskool.demo', 2, 1, '2025-02-27 05:00:06', NULL, 'in_progress', 0, NULL),
(36, 'ayanda.khoza@iskool.demo', 2, 1, '2025-02-25 23:43:19', NULL, 'in_progress', 0, NULL),
(37, 'lindani.vilakazi@iskool.demo', 2, 1, '2025-02-20 14:02:02', NULL, 'in_progress', 0, NULL),
(38, 'bongani.mbatha@iskool.demo', 2, 1, '2025-02-21 00:06:55', NULL, 'in_progress', 0, NULL),
(39, 'siya.vilakazi@iskool.demo', 2, 1, '2025-02-23 14:45:12', NULL, 'in_progress', 0, NULL),
(40, 'tshepo.gumede@iskool.demo', 2, 1, '2025-02-21 07:10:47', NULL, 'in_progress', 0, NULL),
(41, 'bongani.khuzwayo@iskool.demo', 2, 1, '2025-02-18 05:40:42', NULL, 'in_progress', 0, NULL),
(42, 'tshepo.nkosi@iskool.demo', 2, 1, '2025-02-22 23:05:58', NULL, 'in_progress', 0, NULL),
(43, 'sanele.dlamini@iskool.demo', 2, 1, '2025-02-21 15:01:43', NULL, 'in_progress', 0, NULL),
(44, 'sipho.dlamini@iskool.demo', 2, 1, '2025-02-23 20:09:11', NULL, 'in_progress', 0, NULL),
(45, 'rethabile.khoza@iskool.demo', 2, 1, '2025-02-19 16:38:59', NULL, 'in_progress', 0, NULL),
(46, 'rethabile.dlamini@iskool.demo', 2, 1, '2025-02-24 20:57:41', NULL, 'in_progress', 0, NULL),
(47, 'lungile.buthelezi@iskool.demo', 2, 1, '2025-02-22 11:30:00', NULL, 'in_progress', 0, NULL),
(48, 'ofentse.ngubane@iskool.demo', 2, 1, '2025-02-21 01:34:04', NULL, 'in_progress', 0, NULL),
(49, 'junior.khuzwayo@iskool.demo', 2, 1, '2025-02-20 22:48:27', NULL, 'in_progress', 0, NULL),
(50, 'sanele.khuzwayo@iskool.demo', 2, 1, '2025-02-21 21:36:36', NULL, 'in_progress', 0, NULL),
(51, 'sipho.mathenjwa@iskool.demo', 2, 1, '2025-02-19 00:29:13', NULL, 'in_progress', 0, NULL),
(52, 'rethabile.vilakazi@iskool.demo', 2, 1, '2025-02-23 05:46:10', NULL, 'in_progress', 0, NULL),
(53, 'lindani.sibiya@iskool.demo', 3, 1, '2025-02-13 07:11:00', NULL, 'in_progress', 0, NULL),
(54, 'sanele.khuzwayo@iskool.demo', 3, 1, '2025-02-13 10:27:32', NULL, 'in_progress', 0, NULL),
(55, 'sanele.mokoena@iskool.demo', 3, 1, '2025-02-13 12:58:32', NULL, 'in_progress', 0, NULL),
(56, 'sipho.mathenjwa@iskool.demo', 3, 1, '2025-02-20 15:09:36', NULL, 'in_progress', 0, NULL),
(57, 'andile.mthethwa@iskool.demo', 3, 1, '2025-02-21 02:33:29', NULL, 'in_progress', 0, NULL),
(58, 'lungile.buthelezi@iskool.demo', 3, 1, '2025-02-18 17:08:25', NULL, 'in_progress', 0, NULL),
(59, 'mpho.hlongwane@iskool.demo', 3, 1, '2025-02-16 16:08:11', NULL, 'in_progress', 0, NULL),
(60, 'rethabile.mbatha@iskool.demo', 3, 1, '2025-02-17 13:25:59', NULL, 'in_progress', 0, NULL),
(61, 'bongani.mbatha@iskool.demo', 3, 1, '2025-02-21 01:49:40', NULL, 'in_progress', 0, NULL),
(62, 'rethabile.hlongwane@iskool.demo', 3, 1, '2025-02-11 07:14:18', NULL, 'in_progress', 0, NULL),
(63, 'tshepo.gumede@iskool.demo', 3, 1, '2025-02-17 19:42:49', NULL, 'in_progress', 0, NULL),
(64, 'rethabile.khoza@iskool.demo', 3, 1, '2025-02-13 15:24:08', NULL, 'in_progress', 0, NULL),
(65, 'lindani.vilakazi@iskool.demo', 3, 1, '2025-02-18 21:15:50', NULL, 'in_progress', 0, NULL),
(66, 'athi.hlongwane@iskool.demo', 3, 1, '2025-02-19 00:49:37', NULL, 'in_progress', 0, NULL),
(67, 'rethabile.vilakazi@iskool.demo', 3, 1, '2025-02-18 15:33:21', NULL, 'in_progress', 0, NULL),
(68, 'tshepo.nkosi@iskool.demo', 3, 1, '2025-02-17 18:59:08', NULL, 'in_progress', 0, NULL),
(69, 'rethabile.dlamini@iskool.demo', 3, 1, '2025-02-13 04:03:32', NULL, 'in_progress', 0, NULL),
(70, 'siya.vilakazi@iskool.demo', 3, 1, '2025-02-14 13:49:57', NULL, 'in_progress', 0, NULL),
(71, 'ayanda.gumede@iskool.demo', 3, 1, '2025-02-14 12:00:38', NULL, 'in_progress', 0, NULL),
(72, 'junior.mthembu@iskool.demo', 3, 1, '2025-02-17 12:56:20', NULL, 'in_progress', 0, NULL),
(73, 'sipho.dlamini@iskool.demo', 3, 1, '2025-02-18 09:44:42', NULL, 'in_progress', 0, NULL),
(74, 'ofentse.ngubane@iskool.demo', 3, 1, '2025-02-19 14:57:00', NULL, 'in_progress', 0, NULL),
(75, 'ayanda.mathenjwa@iskool.demo', 3, 1, '2025-02-18 13:41:13', NULL, 'in_progress', 0, NULL),
(76, 'ofentse.mbatha@iskool.demo', 3, 1, '2025-02-17 07:47:31', NULL, 'in_progress', 0, NULL),
(77, 'bongani.khuzwayo@iskool.demo', 3, 1, '2025-02-21 02:48:38', NULL, 'in_progress', 0, NULL),
(78, 'sanele.dlamini@iskool.demo', 3, 1, '2025-02-16 13:51:55', NULL, 'in_progress', 0, NULL),
(79, 'ayanda.khoza@iskool.demo', 3, 1, '2025-02-16 00:45:58', NULL, 'in_progress', 0, NULL),
(80, 'zandi.buthelezi@iskool.demo', 4, 1, '2025-02-22 04:20:26', NULL, 'in_progress', 0, NULL),
(81, 'nokuthula.gumede@iskool.demo', 4, 1, '2025-02-13 21:39:00', NULL, 'in_progress', 0, NULL),
(82, 'sipho.shabalala@iskool.demo', 4, 1, '2025-02-16 00:42:53', NULL, 'in_progress', 0, NULL),
(83, 'thando.nkosi@iskool.demo', 4, 1, '2025-02-20 07:20:50', NULL, 'in_progress', 0, NULL),
(84, 'refilwe.ngubane@iskool.demo', 4, 1, '2025-02-18 12:35:16', NULL, 'in_progress', 0, NULL),
(85, 'onthatile.khoza@iskool.demo', 4, 1, '2025-02-19 00:59:14', NULL, 'in_progress', 0, NULL),
(86, 'dineo.gumede@iskool.demo', 4, 1, '2025-02-17 15:40:29', NULL, 'in_progress', 0, NULL),
(87, 'tumelo.shabalala@iskool.demo', 4, 1, '2025-02-21 03:57:10', NULL, 'in_progress', 0, NULL),
(88, 'nokuthula.khoza@iskool.demo', 4, 1, '2025-02-19 06:24:32', NULL, 'in_progress', 0, NULL),
(89, 'zandi.shabalala@iskool.demo', 4, 1, '2025-02-20 22:47:19', NULL, 'in_progress', 0, NULL),
(90, 'nomvula.ndlovu@iskool.demo', 4, 1, '2025-02-14 09:39:04', NULL, 'in_progress', 0, NULL),
(91, 'lerato.sibiya@iskool.demo', 4, 1, '2025-02-14 06:16:53', NULL, 'in_progress', 0, NULL),
(92, 'zinhle.mbatha@iskool.demo', 4, 1, '2025-02-21 09:23:29', NULL, 'in_progress', 0, NULL),
(93, 'ntokozo.ndlovu@iskool.demo', 4, 1, '2025-02-18 11:00:09', NULL, 'in_progress', 0, NULL),
(94, 'athi.mathenjwa@iskool.demo', 4, 1, '2025-02-13 14:37:31', NULL, 'in_progress', 0, NULL),
(95, 'lindiwe.dlamini@iskool.demo', 4, 1, '2025-02-21 05:23:17', NULL, 'in_progress', 0, NULL),
(96, 'zandi.nkosi@iskool.demo', 4, 1, '2025-02-21 23:30:30', NULL, 'in_progress', 0, NULL),
(97, 'kgomotso.khuzwayo@iskool.demo', 4, 1, '2025-02-17 08:59:37', NULL, 'in_progress', 0, NULL),
(98, 'nomvula.mbatha@iskool.demo', 4, 1, '2025-02-14 23:50:22', NULL, 'in_progress', 0, NULL),
(99, 'amahle.hlongwane@iskool.demo', 4, 1, '2025-02-20 08:20:21', NULL, 'in_progress', 0, NULL),
(100, 'refilwe.sithole@iskool.demo', 4, 1, '2025-02-22 01:32:18', NULL, 'in_progress', 0, NULL),
(101, 'tumelo.ndlovu@iskool.demo', 4, 1, '2025-02-15 01:21:40', NULL, 'in_progress', 0, NULL),
(102, 'thandi.mhlongo@iskool.demo', 4, 1, '2025-02-15 02:00:18', NULL, 'in_progress', 0, NULL),
(103, 'naledi.ndlovu@iskool.demo', 4, 1, '2025-02-16 03:22:51', NULL, 'in_progress', 0, NULL),
(104, 'thandi.khoza@iskool.demo', 4, 1, '2025-02-19 01:20:32', NULL, 'in_progress', 0, NULL),
(105, 'siphesihle.shabalala@iskool.demo', 4, 1, '2025-02-18 12:36:06', NULL, 'in_progress', 0, NULL),
(106, 'athi.mathenjwa@iskool.demo', 5, 1, '2025-03-04 00:22:06', NULL, 'in_progress', 0, NULL),
(107, 'zandi.buthelezi@iskool.demo', 5, 1, '2025-02-27 14:54:18', NULL, 'in_progress', 0, NULL),
(108, 'refilwe.sithole@iskool.demo', 5, 1, '2025-02-23 23:40:34', NULL, 'in_progress', 0, NULL),
(109, 'zinhle.mbatha@iskool.demo', 5, 1, '2025-03-01 02:04:38', NULL, 'in_progress', 0, NULL),
(110, 'nokuthula.gumede@iskool.demo', 5, 1, '2025-02-22 07:39:18', NULL, 'in_progress', 0, NULL),
(111, 'kgomotso.mthembu@iskool.demo', 5, 1, '2025-02-24 06:36:14', NULL, 'in_progress', 0, NULL),
(112, 'ntokozo.ndlovu@iskool.demo', 5, 1, '2025-02-26 07:37:10', NULL, 'in_progress', 0, NULL),
(113, 'lindiwe.dlamini@iskool.demo', 5, 1, '2025-02-24 22:02:41', NULL, 'in_progress', 0, NULL),
(114, 'thando.nkosi@iskool.demo', 5, 1, '2025-02-27 19:28:26', NULL, 'in_progress', 0, NULL),
(115, 'kgomotso.khuzwayo@iskool.demo', 5, 1, '2025-02-28 03:23:02', NULL, 'in_progress', 0, NULL),
(116, 'thandi.khoza@iskool.demo', 5, 1, '2025-03-01 14:01:36', NULL, 'in_progress', 0, NULL),
(117, 'siphesihle.shabalala@iskool.demo', 5, 1, '2025-02-25 18:15:24', NULL, 'in_progress', 0, NULL),
(118, 'nokuthula.khoza@iskool.demo', 5, 1, '2025-02-23 18:20:56', NULL, 'in_progress', 0, NULL),
(119, 'nomvula.mhlongo@iskool.demo', 5, 1, '2025-02-25 05:10:41', NULL, 'in_progress', 0, NULL),
(120, 'sipho.shabalala@iskool.demo', 5, 1, '2025-03-04 04:10:09', NULL, 'in_progress', 0, NULL),
(121, 'dineo.gumede@iskool.demo', 5, 1, '2025-03-02 09:18:36', NULL, 'in_progress', 0, NULL),
(122, 'thandi.mhlongo@iskool.demo', 5, 1, '2025-02-26 05:24:05', NULL, 'in_progress', 0, NULL),
(123, 'nomvula.mbatha@iskool.demo', 5, 1, '2025-02-24 01:21:23', NULL, 'in_progress', 0, NULL),
(124, 'zandi.shabalala@iskool.demo', 5, 1, '2025-03-03 17:58:37', NULL, 'in_progress', 0, NULL),
(125, 'zandi.nkosi@iskool.demo', 5, 1, '2025-02-27 12:05:11', NULL, 'in_progress', 0, NULL),
(126, 'naledi.ndlovu@iskool.demo', 5, 1, '2025-02-23 13:18:58', NULL, 'in_progress', 0, NULL),
(127, 'tumelo.shabalala@iskool.demo', 5, 1, '2025-02-22 18:00:46', NULL, 'in_progress', 0, NULL),
(128, 'nomvula.ndlovu@iskool.demo', 5, 1, '2025-02-27 00:10:20', NULL, 'in_progress', 0, NULL),
(129, 'refilwe.ngubane@iskool.demo', 5, 1, '2025-02-25 23:45:38', NULL, 'in_progress', 0, NULL),
(130, 'tumelo.ndlovu@iskool.demo', 5, 1, '2025-02-24 21:41:50', NULL, 'in_progress', 0, NULL),
(131, 'boitumelo.sithole@iskool.demo', 5, 1, '2025-02-26 13:08:40', NULL, 'in_progress', 0, NULL),
(132, 'lerato.sibiya@iskool.demo', 5, 1, '2025-02-23 04:51:29', NULL, 'in_progress', 0, NULL),
(133, 'amahle.hlongwane@iskool.demo', 5, 1, '2025-02-24 05:12:20', NULL, 'in_progress', 0, NULL),
(134, 'sanele.dlamini@iskool.demo', 6, 1, '2025-05-14 05:02:41', NULL, 'in_progress', 0, NULL),
(135, 'rethabile.vilakazi@iskool.demo', 6, 1, '2025-05-15 05:22:18', NULL, 'in_progress', 0, NULL),
(136, 'rethabile.dlamini@iskool.demo', 6, 1, '2025-05-14 13:44:59', NULL, 'in_progress', 0, NULL),
(137, 'lungile.buthelezi@iskool.demo', 6, 1, '2025-05-08 10:27:51', NULL, 'in_progress', 0, NULL),
(138, 'ayanda.khoza@iskool.demo', 6, 1, '2025-05-12 09:09:26', NULL, 'in_progress', 0, NULL),
(139, 'sanele.mokoena@iskool.demo', 6, 1, '2025-05-14 07:01:31', NULL, 'in_progress', 0, NULL),
(140, 'andile.mthethwa@iskool.demo', 6, 1, '2025-05-12 22:42:02', NULL, 'in_progress', 0, NULL),
(141, 'mpho.hlongwane@iskool.demo', 6, 1, '2025-05-07 12:33:03', NULL, 'in_progress', 0, NULL),
(142, 'ayanda.mathenjwa@iskool.demo', 6, 1, '2025-05-08 06:14:23', NULL, 'in_progress', 0, NULL),
(143, 'siya.vilakazi@iskool.demo', 6, 1, '2025-05-14 14:10:38', NULL, 'in_progress', 0, NULL),
(144, 'bongani.khuzwayo@iskool.demo', 6, 1, '2025-05-10 05:38:28', NULL, 'in_progress', 0, NULL),
(145, 'tshepo.nkosi@iskool.demo', 6, 1, '2025-05-11 03:06:09', NULL, 'in_progress', 0, NULL),
(146, 'sanele.khuzwayo@iskool.demo', 6, 1, '2025-05-11 01:11:47', NULL, 'in_progress', 0, NULL),
(147, 'tshepo.gumede@iskool.demo', 6, 1, '2025-05-14 00:34:04', NULL, 'in_progress', 0, NULL),
(148, 'lwandle.ngubane@iskool.demo', 6, 1, '2025-05-07 11:48:51', NULL, 'in_progress', 0, NULL),
(149, 'athi.hlongwane@iskool.demo', 6, 1, '2025-05-11 14:34:07', NULL, 'in_progress', 0, NULL),
(150, 'rethabile.hlongwane@iskool.demo', 6, 1, '2025-05-08 12:03:45', NULL, 'in_progress', 0, NULL),
(151, 'sipho.dlamini@iskool.demo', 6, 1, '2025-05-11 10:27:22', NULL, 'in_progress', 0, NULL),
(152, 'junior.khuzwayo@iskool.demo', 6, 1, '2025-05-14 11:07:04', NULL, 'in_progress', 0, NULL),
(153, 'sipho.mathenjwa@iskool.demo', 6, 1, '2025-05-17 06:54:28', NULL, 'in_progress', 0, NULL),
(154, 'lindani.sibiya@iskool.demo', 6, 1, '2025-05-13 09:59:45', NULL, 'in_progress', 0, NULL),
(155, 'rethabile.khoza@iskool.demo', 6, 1, '2025-05-07 22:32:38', NULL, 'in_progress', 0, NULL),
(156, 'ofentse.mbatha@iskool.demo', 6, 1, '2025-05-09 04:29:13', NULL, 'in_progress', 0, NULL),
(157, 'lungile.buthelezi@iskool.demo', 7, 1, '2025-05-29 04:44:15', NULL, 'in_progress', 0, NULL),
(158, 'mpho.hlongwane@iskool.demo', 7, 1, '2025-05-20 08:38:12', NULL, 'in_progress', 0, NULL),
(159, 'sanele.dlamini@iskool.demo', 7, 1, '2025-05-28 18:22:13', NULL, 'in_progress', 0, NULL),
(160, 'bongani.mbatha@iskool.demo', 7, 1, '2025-05-22 07:54:40', NULL, 'in_progress', 0, NULL),
(161, 'bongani.khuzwayo@iskool.demo', 7, 1, '2025-05-21 09:47:20', NULL, 'in_progress', 0, NULL),
(162, 'rethabile.dlamini@iskool.demo', 7, 1, '2025-05-21 04:20:39', NULL, 'in_progress', 0, NULL),
(163, 'sanele.khuzwayo@iskool.demo', 7, 1, '2025-05-22 23:37:40', NULL, 'in_progress', 0, NULL),
(164, 'andile.mthethwa@iskool.demo', 7, 1, '2025-05-24 22:46:21', NULL, 'in_progress', 0, NULL),
(165, 'lwandle.ngubane@iskool.demo', 7, 1, '2025-05-23 10:55:28', NULL, 'in_progress', 0, NULL),
(166, 'lindani.sibiya@iskool.demo', 7, 1, '2025-05-24 16:27:48', NULL, 'in_progress', 0, NULL),
(167, 'ayanda.khoza@iskool.demo', 7, 1, '2025-05-20 04:33:27', NULL, 'in_progress', 0, NULL),
(168, 'rethabile.khoza@iskool.demo', 7, 1, '2025-05-20 09:01:28', NULL, 'in_progress', 0, NULL),
(169, 'lwandle.mthembu@iskool.demo', 7, 1, '2025-05-28 17:02:31', NULL, 'in_progress', 0, NULL),
(170, 'ofentse.mbatha@iskool.demo', 7, 1, '2025-05-28 03:15:18', NULL, 'in_progress', 0, NULL),
(171, 'lindani.vilakazi@iskool.demo', 7, 1, '2025-05-25 12:14:14', NULL, 'in_progress', 0, NULL),
(172, 'junior.mthembu@iskool.demo', 7, 1, '2025-05-22 01:56:41', NULL, 'in_progress', 0, NULL),
(173, 'athi.hlongwane@iskool.demo', 7, 1, '2025-05-20 03:25:50', NULL, 'in_progress', 0, NULL),
(174, 'ayanda.mathenjwa@iskool.demo', 7, 1, '2025-05-25 09:47:29', NULL, 'in_progress', 0, NULL),
(175, 'ofentse.ngubane@iskool.demo', 7, 1, '2025-05-25 00:05:04', NULL, 'in_progress', 0, NULL),
(176, 'sipho.mathenjwa@iskool.demo', 7, 1, '2025-05-23 19:14:55', NULL, 'in_progress', 0, NULL),
(177, 'ayanda.gumede@iskool.demo', 7, 1, '2025-05-20 12:01:43', NULL, 'in_progress', 0, NULL),
(178, 'rethabile.vilakazi@iskool.demo', 7, 1, '2025-05-23 09:26:10', NULL, 'in_progress', 0, NULL),
(179, 'rethabile.hlongwane@iskool.demo', 7, 1, '2025-05-21 09:20:16', NULL, 'in_progress', 0, NULL),
(180, 'siya.vilakazi@iskool.demo', 7, 1, '2025-05-27 13:24:44', NULL, 'in_progress', 0, NULL),
(181, 'junior.khuzwayo@iskool.demo', 7, 1, '2025-05-27 18:47:16', NULL, 'in_progress', 0, NULL),
(182, 'tshepo.gumede@iskool.demo', 7, 1, '2025-05-21 07:54:08', NULL, 'in_progress', 0, NULL),
(183, 'andile.mthethwa@iskool.demo', 8, 1, '2025-05-17 17:36:11', NULL, 'in_progress', 0, NULL),
(184, 'athi.hlongwane@iskool.demo', 8, 1, '2025-05-20 22:05:01', NULL, 'in_progress', 0, NULL),
(185, 'rethabile.dlamini@iskool.demo', 8, 1, '2025-05-20 12:52:55', NULL, 'in_progress', 0, NULL),
(186, 'junior.mthembu@iskool.demo', 8, 1, '2025-05-20 00:18:22', NULL, 'in_progress', 0, NULL),
(187, 'sanele.mokoena@iskool.demo', 8, 1, '2025-05-16 16:13:03', NULL, 'in_progress', 0, NULL),
(188, 'junior.khuzwayo@iskool.demo', 8, 1, '2025-05-20 12:46:35', NULL, 'in_progress', 0, NULL),
(189, 'ayanda.khoza@iskool.demo', 8, 1, '2025-05-23 06:14:35', NULL, 'in_progress', 0, NULL),
(190, 'sipho.dlamini@iskool.demo', 8, 1, '2025-05-22 01:17:07', NULL, 'in_progress', 0, NULL),
(191, 'rethabile.khoza@iskool.demo', 8, 1, '2025-05-20 15:24:37', NULL, 'in_progress', 0, NULL),
(192, 'ofentse.ngubane@iskool.demo', 8, 1, '2025-05-18 13:11:04', NULL, 'in_progress', 0, NULL),
(193, 'ofentse.mbatha@iskool.demo', 8, 1, '2025-05-19 19:42:18', NULL, 'in_progress', 0, NULL),
(194, 'rethabile.mbatha@iskool.demo', 8, 1, '2025-05-19 16:50:03', NULL, 'in_progress', 0, NULL),
(195, 'sanele.dlamini@iskool.demo', 8, 1, '2025-05-19 17:59:07', NULL, 'in_progress', 0, NULL),
(196, 'rethabile.hlongwane@iskool.demo', 8, 1, '2025-05-19 06:54:29', NULL, 'in_progress', 0, NULL),
(197, 'tshepo.gumede@iskool.demo', 8, 1, '2025-05-14 03:01:37', NULL, 'in_progress', 0, NULL),
(198, 'lwandle.ngubane@iskool.demo', 8, 1, '2025-05-16 08:49:51', NULL, 'in_progress', 0, NULL),
(199, 'lindani.sibiya@iskool.demo', 8, 1, '2025-05-13 13:20:39', NULL, 'in_progress', 0, NULL),
(200, 'bongani.mbatha@iskool.demo', 8, 1, '2025-05-14 15:37:42', NULL, 'in_progress', 0, NULL),
(201, 'sipho.mathenjwa@iskool.demo', 8, 1, '2025-05-15 08:13:52', NULL, 'in_progress', 0, NULL),
(202, 'rethabile.vilakazi@iskool.demo', 8, 1, '2025-05-21 06:12:50', NULL, 'in_progress', 0, NULL),
(203, 'bongani.khuzwayo@iskool.demo', 8, 1, '2025-05-20 01:14:44', NULL, 'in_progress', 0, NULL),
(204, 'siya.vilakazi@iskool.demo', 8, 1, '2025-05-16 22:23:53', NULL, 'in_progress', 0, NULL),
(205, 'mpho.hlongwane@iskool.demo', 8, 1, '2025-05-16 19:04:51', NULL, 'in_progress', 0, NULL),
(206, 'ayanda.gumede@iskool.demo', 8, 1, '2025-05-14 19:23:36', NULL, 'in_progress', 0, NULL),
(207, 'lerato.sibiya@iskool.demo', 9, 1, '2025-05-15 14:59:12', NULL, 'in_progress', 0, NULL),
(208, 'naledi.ndlovu@iskool.demo', 9, 1, '2025-05-22 08:36:36', NULL, 'in_progress', 0, NULL),
(209, 'refilwe.ngubane@iskool.demo', 9, 1, '2025-05-21 03:36:29', NULL, 'in_progress', 0, NULL),
(210, 'zandi.nkosi@iskool.demo', 9, 1, '2025-05-21 08:04:08', NULL, 'in_progress', 0, NULL),
(211, 'zandi.buthelezi@iskool.demo', 9, 1, '2025-05-17 12:01:14', NULL, 'in_progress', 0, NULL),
(212, 'boitumelo.sithole@iskool.demo', 9, 1, '2025-05-18 03:13:54', NULL, 'in_progress', 0, NULL),
(213, 'thando.nkosi@iskool.demo', 9, 1, '2025-05-22 15:25:00', NULL, 'in_progress', 0, NULL),
(214, 'zinhle.mbatha@iskool.demo', 9, 1, '2025-05-16 04:57:57', NULL, 'in_progress', 0, NULL),
(215, 'nokuthula.khoza@iskool.demo', 9, 1, '2025-05-15 10:15:18', NULL, 'in_progress', 0, NULL),
(216, 'athi.mathenjwa@iskool.demo', 9, 1, '2025-05-18 16:52:35', NULL, 'in_progress', 0, NULL),
(217, 'ntokozo.ndlovu@iskool.demo', 9, 1, '2025-05-25 03:15:18', NULL, 'in_progress', 0, NULL),
(218, 'dineo.gumede@iskool.demo', 9, 1, '2025-05-17 03:07:10', NULL, 'in_progress', 0, NULL),
(219, 'nomvula.mbatha@iskool.demo', 9, 1, '2025-05-15 22:11:17', NULL, 'in_progress', 0, NULL),
(220, 'refilwe.sithole@iskool.demo', 9, 1, '2025-05-20 08:57:28', NULL, 'in_progress', 0, NULL),
(221, 'tumelo.ndlovu@iskool.demo', 9, 1, '2025-05-24 21:45:10', NULL, 'in_progress', 0, NULL),
(222, 'nomvula.ndlovu@iskool.demo', 9, 1, '2025-05-20 01:36:34', NULL, 'in_progress', 0, NULL),
(223, 'kgomotso.mthembu@iskool.demo', 9, 1, '2025-05-25 05:30:41', NULL, 'in_progress', 0, NULL),
(224, 'onthatile.khoza@iskool.demo', 9, 1, '2025-05-19 16:47:09', NULL, 'in_progress', 0, NULL),
(225, 'precious.zulu@iskool.demo', 9, 1, '2025-05-16 11:11:03', NULL, 'in_progress', 0, NULL),
(226, 'sipho.shabalala@iskool.demo', 9, 1, '2025-05-15 20:05:01', NULL, 'in_progress', 0, NULL),
(227, 'nokuthula.gumede@iskool.demo', 9, 1, '2025-05-22 15:50:35', NULL, 'in_progress', 0, NULL),
(228, 'amahle.hlongwane@iskool.demo', 9, 1, '2025-05-21 15:57:26', NULL, 'in_progress', 0, NULL),
(229, 'lindiwe.dlamini@iskool.demo', 9, 1, '2025-05-16 01:42:40', NULL, 'in_progress', 0, NULL),
(230, 'zandi.shabalala@iskool.demo', 9, 1, '2025-05-24 06:15:33', NULL, 'in_progress', 0, NULL),
(231, 'athi.mathenjwa@iskool.demo', 10, 1, '2025-05-08 19:02:23', NULL, 'in_progress', 0, NULL),
(232, 'naledi.ndlovu@iskool.demo', 10, 1, '2025-05-14 16:23:38', NULL, 'in_progress', 0, NULL),
(233, 'kgomotso.mthembu@iskool.demo', 10, 1, '2025-05-14 07:08:40', NULL, 'in_progress', 0, NULL),
(234, 'siphesihle.shabalala@iskool.demo', 10, 1, '2025-05-18 02:46:38', NULL, 'in_progress', 0, NULL),
(235, 'nokuthula.khoza@iskool.demo', 10, 1, '2025-05-13 12:13:58', NULL, 'in_progress', 0, NULL),
(236, 'sipho.shabalala@iskool.demo', 10, 1, '2025-05-12 20:16:04', NULL, 'in_progress', 0, NULL),
(237, 'zinhle.mbatha@iskool.demo', 10, 1, '2025-05-17 08:45:41', NULL, 'in_progress', 0, NULL),
(238, 'refilwe.ngubane@iskool.demo', 10, 1, '2025-05-09 19:42:57', NULL, 'in_progress', 0, NULL),
(239, 'boitumelo.sithole@iskool.demo', 10, 1, '2025-05-08 12:37:38', NULL, 'in_progress', 0, NULL),
(240, 'thandi.khoza@iskool.demo', 10, 1, '2025-05-09 10:31:55', NULL, 'in_progress', 0, NULL),
(241, 'kgomotso.khuzwayo@iskool.demo', 10, 1, '2025-05-13 03:09:58', NULL, 'in_progress', 0, NULL),
(242, 'refilwe.sithole@iskool.demo', 10, 1, '2025-05-11 07:58:52', NULL, 'in_progress', 0, NULL),
(243, 'thando.nkosi@iskool.demo', 10, 1, '2025-05-12 22:47:52', NULL, 'in_progress', 0, NULL),
(244, 'zandi.buthelezi@iskool.demo', 10, 1, '2025-05-10 05:51:32', NULL, 'in_progress', 0, NULL),
(245, 'amahle.hlongwane@iskool.demo', 10, 1, '2025-05-15 07:42:27', NULL, 'in_progress', 0, NULL),
(246, 'zandi.shabalala@iskool.demo', 10, 1, '2025-05-11 05:27:50', NULL, 'in_progress', 0, NULL),
(247, 'lerato.sibiya@iskool.demo', 10, 1, '2025-05-16 02:46:49', NULL, 'in_progress', 0, NULL),
(248, 'onthatile.khoza@iskool.demo', 10, 1, '2025-05-14 20:44:17', NULL, 'in_progress', 0, NULL),
(249, 'tumelo.shabalala@iskool.demo', 10, 1, '2025-05-08 13:09:39', NULL, 'in_progress', 0, NULL),
(250, 'tumelo.ndlovu@iskool.demo', 10, 1, '2025-05-14 01:36:06', NULL, 'in_progress', 0, NULL),
(251, 'zandi.nkosi@iskool.demo', 10, 1, '2025-05-10 22:06:28', NULL, 'in_progress', 0, NULL),
(252, 'thandi.mhlongo@iskool.demo', 10, 1, '2025-05-13 08:59:00', NULL, 'in_progress', 0, NULL),
(253, 'nomvula.ndlovu@iskool.demo', 10, 1, '2025-05-09 17:19:10', NULL, 'in_progress', 0, NULL),
(254, 'nomvula.mhlongo@iskool.demo', 11, 1, '2025-05-13 03:18:44', NULL, 'in_progress', 0, NULL),
(255, 'refilwe.ngubane@iskool.demo', 11, 1, '2025-05-18 20:42:54', NULL, 'in_progress', 0, NULL),
(256, 'precious.zulu@iskool.demo', 11, 1, '2025-05-20 06:37:03', NULL, 'in_progress', 0, NULL),
(257, 'sipho.shabalala@iskool.demo', 11, 1, '2025-05-13 12:31:09', NULL, 'in_progress', 0, NULL),
(258, 'onthatile.khoza@iskool.demo', 11, 1, '2025-05-17 10:27:21', NULL, 'in_progress', 0, NULL),
(259, 'zandi.nkosi@iskool.demo', 11, 1, '2025-05-18 23:41:07', NULL, 'in_progress', 0, NULL),
(260, 'zandi.shabalala@iskool.demo', 11, 1, '2025-05-20 23:40:14', NULL, 'in_progress', 0, NULL),
(261, 'tumelo.shabalala@iskool.demo', 11, 1, '2025-05-13 17:19:18', NULL, 'in_progress', 0, NULL),
(262, 'refilwe.sithole@iskool.demo', 11, 1, '2025-05-13 00:38:05', NULL, 'in_progress', 0, NULL),
(263, 'nokuthula.gumede@iskool.demo', 11, 1, '2025-05-15 13:41:52', NULL, 'in_progress', 0, NULL),
(264, 'siphesihle.shabalala@iskool.demo', 11, 1, '2025-05-14 19:38:36', NULL, 'in_progress', 0, NULL),
(265, 'nokuthula.khoza@iskool.demo', 11, 1, '2025-05-21 07:22:59', NULL, 'in_progress', 0, NULL),
(266, 'lerato.sibiya@iskool.demo', 11, 1, '2025-05-19 02:23:33', NULL, 'in_progress', 0, NULL),
(267, 'thandi.mhlongo@iskool.demo', 11, 1, '2025-05-18 06:50:59', NULL, 'in_progress', 0, NULL),
(268, 'thandi.khoza@iskool.demo', 11, 1, '2025-05-21 06:59:27', NULL, 'in_progress', 0, NULL),
(269, 'naledi.ndlovu@iskool.demo', 11, 1, '2025-05-12 11:05:22', NULL, 'in_progress', 0, NULL),
(270, 'nomvula.ndlovu@iskool.demo', 11, 1, '2025-05-21 17:56:15', NULL, 'in_progress', 0, NULL),
(271, 'thando.nkosi@iskool.demo', 11, 1, '2025-05-14 18:41:03', NULL, 'in_progress', 0, NULL),
(272, 'kgomotso.mthembu@iskool.demo', 11, 1, '2025-05-14 09:46:41', NULL, 'in_progress', 0, NULL),
(273, 'dineo.gumede@iskool.demo', 11, 1, '2025-05-18 06:08:33', NULL, 'in_progress', 0, NULL),
(274, 'amahle.hlongwane@iskool.demo', 11, 1, '2025-05-22 01:22:23', NULL, 'in_progress', 0, NULL),
(275, 'kgomotso.khuzwayo@iskool.demo', 11, 1, '2025-05-20 20:37:26', NULL, 'in_progress', 0, NULL),
(276, 'boitumelo.sithole@iskool.demo', 11, 1, '2025-05-21 06:37:18', NULL, 'in_progress', 0, NULL),
(277, 'nomvula.mbatha@iskool.demo', 11, 1, '2025-05-14 18:47:20', NULL, 'in_progress', 0, NULL),
(278, 'tumelo.ndlovu@iskool.demo', 11, 1, '2025-05-19 05:45:16', NULL, 'in_progress', 0, NULL),
(279, 'ntokozo.ndlovu@iskool.demo', 11, 1, '2025-05-16 07:28:20', NULL, 'in_progress', 0, NULL),
(280, 'mpho.hlongwane@iskool.demo', 12, 1, '2025-08-07 12:26:33', NULL, 'in_progress', 0, NULL),
(281, 'athi.hlongwane@iskool.demo', 12, 1, '2025-08-13 22:52:13', NULL, 'in_progress', 0, NULL),
(282, 'rethabile.hlongwane@iskool.demo', 12, 1, '2025-08-13 03:00:51', NULL, 'in_progress', 0, NULL),
(283, 'tshepo.gumede@iskool.demo', 12, 1, '2025-08-13 21:31:40', NULL, 'in_progress', 0, NULL),
(284, 'rethabile.khoza@iskool.demo', 12, 1, '2025-08-07 08:41:12', NULL, 'in_progress', 0, NULL),
(285, 'lungile.buthelezi@iskool.demo', 12, 1, '2025-08-09 23:24:14', NULL, 'in_progress', 0, NULL),
(286, 'junior.khuzwayo@iskool.demo', 12, 1, '2025-08-10 19:08:29', NULL, 'in_progress', 0, NULL),
(287, 'lindani.sibiya@iskool.demo', 12, 1, '2025-08-15 15:54:26', NULL, 'in_progress', 0, NULL),
(288, 'ayanda.khoza@iskool.demo', 12, 1, '2025-08-13 10:14:48', NULL, 'in_progress', 0, NULL),
(289, 'ayanda.mathenjwa@iskool.demo', 12, 1, '2025-08-09 06:59:19', NULL, 'in_progress', 0, NULL),
(290, 'lwandle.ngubane@iskool.demo', 12, 1, '2025-08-09 07:52:52', NULL, 'in_progress', 0, NULL),
(291, 'lwandle.mthembu@iskool.demo', 12, 1, '2025-08-10 20:45:51', NULL, 'in_progress', 0, NULL),
(292, 'andile.mthethwa@iskool.demo', 12, 1, '2025-08-11 22:56:31', NULL, 'in_progress', 0, NULL),
(293, 'bongani.khuzwayo@iskool.demo', 12, 1, '2025-08-07 17:23:46', NULL, 'in_progress', 0, NULL),
(294, 'sanele.mokoena@iskool.demo', 12, 1, '2025-08-16 07:44:34', NULL, 'in_progress', 0, NULL),
(295, 'sanele.dlamini@iskool.demo', 12, 1, '2025-08-14 12:29:46', NULL, 'in_progress', 0, NULL),
(296, 'sanele.khuzwayo@iskool.demo', 12, 1, '2025-08-15 18:26:03', NULL, 'in_progress', 0, NULL),
(297, 'rethabile.vilakazi@iskool.demo', 12, 1, '2025-08-09 00:47:49', NULL, 'in_progress', 0, NULL),
(298, 'siya.vilakazi@iskool.demo', 12, 1, '2025-08-07 22:57:53', NULL, 'in_progress', 0, NULL),
(299, 'rethabile.mbatha@iskool.demo', 12, 1, '2025-08-08 15:35:25', NULL, 'in_progress', 0, NULL),
(300, 'rethabile.dlamini@iskool.demo', 12, 1, '2025-08-15 09:38:14', NULL, 'in_progress', 0, NULL),
(301, 'ofentse.mbatha@iskool.demo', 12, 1, '2025-08-11 14:37:46', NULL, 'in_progress', 0, NULL),
(302, 'ayanda.gumede@iskool.demo', 12, 1, '2025-08-09 23:31:37', NULL, 'in_progress', 0, NULL),
(303, 'rethabile.dlamini@iskool.demo', 13, 1, '2025-08-22 07:13:15', NULL, 'in_progress', 0, NULL),
(304, 'ofentse.mbatha@iskool.demo', 13, 1, '2025-08-19 20:38:26', NULL, 'in_progress', 0, NULL),
(305, 'sipho.mathenjwa@iskool.demo', 13, 1, '2025-08-24 01:10:22', NULL, 'in_progress', 0, NULL),
(306, 'sipho.dlamini@iskool.demo', 13, 1, '2025-08-23 05:33:31', NULL, 'in_progress', 0, NULL),
(307, 'siya.vilakazi@iskool.demo', 13, 1, '2025-08-24 04:18:52', NULL, 'in_progress', 0, NULL),
(308, 'rethabile.mbatha@iskool.demo', 13, 1, '2025-08-18 22:42:02', NULL, 'in_progress', 0, NULL),
(309, 'andile.mthethwa@iskool.demo', 13, 1, '2025-08-21 19:46:25', NULL, 'in_progress', 0, NULL),
(310, 'lindani.sibiya@iskool.demo', 13, 1, '2025-08-18 18:56:34', NULL, 'in_progress', 0, NULL),
(311, 'junior.khuzwayo@iskool.demo', 13, 1, '2025-08-25 02:54:48', NULL, 'in_progress', 0, NULL),
(312, 'athi.hlongwane@iskool.demo', 13, 1, '2025-08-26 17:59:37', NULL, 'in_progress', 0, NULL),
(313, 'rethabile.khoza@iskool.demo', 13, 1, '2025-08-23 05:53:24', NULL, 'in_progress', 0, NULL),
(314, 'rethabile.vilakazi@iskool.demo', 13, 1, '2025-08-26 19:12:47', NULL, 'in_progress', 0, NULL),
(315, 'lwandle.ngubane@iskool.demo', 13, 1, '2025-08-27 06:18:30', NULL, 'in_progress', 0, NULL),
(316, 'lwandle.mthembu@iskool.demo', 13, 1, '2025-08-25 22:26:24', NULL, 'in_progress', 0, NULL),
(317, 'sanele.mokoena@iskool.demo', 13, 1, '2025-08-22 03:17:05', NULL, 'in_progress', 0, NULL),
(318, 'bongani.mbatha@iskool.demo', 13, 1, '2025-08-19 03:16:55', NULL, 'in_progress', 0, NULL),
(319, 'mpho.hlongwane@iskool.demo', 13, 1, '2025-08-21 06:04:41', NULL, 'in_progress', 0, NULL),
(320, 'junior.mthembu@iskool.demo', 13, 1, '2025-08-19 00:50:58', NULL, 'in_progress', 0, NULL),
(321, 'tshepo.gumede@iskool.demo', 13, 1, '2025-08-23 02:58:01', NULL, 'in_progress', 0, NULL),
(322, 'ayanda.gumede@iskool.demo', 13, 1, '2025-08-25 10:07:57', NULL, 'in_progress', 0, NULL),
(323, 'ofentse.ngubane@iskool.demo', 13, 1, '2025-08-27 08:46:17', NULL, 'in_progress', 0, NULL),
(324, 'ayanda.mathenjwa@iskool.demo', 13, 1, '2025-08-18 10:12:04', NULL, 'in_progress', 0, NULL),
(325, 'ayanda.khoza@iskool.demo', 13, 1, '2025-08-20 21:01:40', NULL, 'in_progress', 0, NULL),
(326, 'bongani.khuzwayo@iskool.demo', 13, 1, '2025-08-25 10:14:21', NULL, 'in_progress', 0, NULL),
(327, 'lungile.buthelezi@iskool.demo', 13, 1, '2025-08-24 16:18:33', NULL, 'in_progress', 0, NULL),
(328, 'sipho.mathenjwa@iskool.demo', 14, 1, '2025-08-28 13:12:53', NULL, 'in_progress', 0, NULL),
(329, 'lindani.sibiya@iskool.demo', 14, 1, '2025-08-25 04:25:10', NULL, 'in_progress', 0, NULL),
(330, 'lungile.buthelezi@iskool.demo', 14, 1, '2025-08-24 21:34:27', NULL, 'in_progress', 0, NULL),
(331, 'rethabile.hlongwane@iskool.demo', 14, 1, '2025-08-21 20:39:51', NULL, 'in_progress', 0, NULL),
(332, 'bongani.khuzwayo@iskool.demo', 14, 1, '2025-08-19 22:04:35', NULL, 'in_progress', 0, NULL),
(333, 'andile.mthethwa@iskool.demo', 14, 1, '2025-08-28 19:44:50', NULL, 'in_progress', 0, NULL),
(334, 'sanele.dlamini@iskool.demo', 14, 1, '2025-08-19 09:18:08', NULL, 'in_progress', 0, NULL),
(335, 'lwandle.ngubane@iskool.demo', 14, 1, '2025-08-24 01:53:54', NULL, 'in_progress', 0, NULL),
(336, 'sipho.dlamini@iskool.demo', 14, 1, '2025-08-24 10:14:26', NULL, 'in_progress', 0, NULL),
(337, 'sanele.khuzwayo@iskool.demo', 14, 1, '2025-08-25 06:13:35', NULL, 'in_progress', 0, NULL),
(338, 'rethabile.khoza@iskool.demo', 14, 1, '2025-08-20 20:49:21', NULL, 'in_progress', 0, NULL),
(339, 'ayanda.gumede@iskool.demo', 14, 1, '2025-08-20 09:09:12', NULL, 'in_progress', 0, NULL),
(340, 'ofentse.mbatha@iskool.demo', 14, 1, '2025-08-21 12:48:28', NULL, 'in_progress', 0, NULL),
(341, 'tshepo.gumede@iskool.demo', 14, 1, '2025-08-25 09:18:38', NULL, 'in_progress', 0, NULL),
(342, 'ofentse.ngubane@iskool.demo', 14, 1, '2025-08-19 22:05:41', NULL, 'in_progress', 0, NULL),
(343, 'lindani.vilakazi@iskool.demo', 14, 1, '2025-08-24 21:55:44', NULL, 'in_progress', 0, NULL),
(344, 'tshepo.nkosi@iskool.demo', 14, 1, '2025-08-27 02:24:47', NULL, 'in_progress', 0, NULL),
(345, 'ayanda.khoza@iskool.demo', 14, 1, '2025-08-27 01:18:18', NULL, 'in_progress', 0, NULL),
(346, 'siya.vilakazi@iskool.demo', 14, 1, '2025-08-27 01:59:06', NULL, 'in_progress', 0, NULL),
(347, 'lwandle.mthembu@iskool.demo', 14, 1, '2025-08-20 19:00:45', NULL, 'in_progress', 0, NULL),
(348, 'sanele.mokoena@iskool.demo', 14, 1, '2025-08-28 10:38:43', NULL, 'in_progress', 0, NULL),
(349, 'rethabile.vilakazi@iskool.demo', 14, 1, '2025-08-26 00:34:20', NULL, 'in_progress', 0, NULL),
(350, 'rethabile.mbatha@iskool.demo', 14, 1, '2025-08-24 13:23:03', NULL, 'in_progress', 0, NULL),
(351, 'mpho.hlongwane@iskool.demo', 14, 1, '2025-08-25 23:50:57', NULL, 'in_progress', 0, NULL),
(352, 'bongani.mbatha@iskool.demo', 14, 1, '2025-08-21 21:09:47', NULL, 'in_progress', 0, NULL),
(353, 'junior.khuzwayo@iskool.demo', 14, 1, '2025-08-28 21:41:13', NULL, 'in_progress', 0, NULL),
(354, 'junior.mthembu@iskool.demo', 14, 1, '2025-08-25 06:23:41', NULL, 'in_progress', 0, NULL),
(355, 'rethabile.dlamini@iskool.demo', 14, 1, '2025-08-21 04:11:46', NULL, 'in_progress', 0, NULL),
(356, 'siphesihle.shabalala@iskool.demo', 15, 1, '2025-08-25 06:33:00', NULL, 'in_progress', 0, NULL),
(357, 'kgomotso.mthembu@iskool.demo', 15, 1, '2025-08-19 19:09:13', NULL, 'in_progress', 0, NULL),
(358, 'sipho.shabalala@iskool.demo', 15, 1, '2025-08-20 17:34:01', NULL, 'in_progress', 0, NULL),
(359, 'lerato.sibiya@iskool.demo', 15, 1, '2025-08-20 04:41:23', NULL, 'in_progress', 0, NULL),
(360, 'refilwe.ngubane@iskool.demo', 15, 1, '2025-08-26 08:04:41', NULL, 'in_progress', 0, NULL),
(361, 'zinhle.mbatha@iskool.demo', 15, 1, '2025-08-19 12:21:19', NULL, 'in_progress', 0, NULL),
(362, 'nomvula.mhlongo@iskool.demo', 15, 1, '2025-08-23 21:45:11', NULL, 'in_progress', 0, NULL),
(363, 'nokuthula.gumede@iskool.demo', 15, 1, '2025-08-20 19:21:03', NULL, 'in_progress', 0, NULL),
(364, 'dineo.gumede@iskool.demo', 15, 1, '2025-08-27 19:45:30', NULL, 'in_progress', 0, NULL),
(365, 'tumelo.ndlovu@iskool.demo', 15, 1, '2025-08-20 03:38:26', NULL, 'in_progress', 0, NULL),
(366, 'lindiwe.dlamini@iskool.demo', 15, 1, '2025-08-22 15:58:46', NULL, 'in_progress', 0, NULL),
(367, 'thando.nkosi@iskool.demo', 15, 1, '2025-08-24 21:05:15', NULL, 'in_progress', 0, NULL),
(368, 'nomvula.ndlovu@iskool.demo', 15, 1, '2025-08-18 16:21:31', NULL, 'in_progress', 0, NULL),
(369, 'zandi.nkosi@iskool.demo', 15, 1, '2025-08-20 03:19:22', NULL, 'in_progress', 0, NULL),
(370, 'ntokozo.ndlovu@iskool.demo', 15, 1, '2025-08-22 13:43:36', NULL, 'in_progress', 0, NULL),
(371, 'refilwe.sithole@iskool.demo', 15, 1, '2025-08-19 19:35:48', NULL, 'in_progress', 0, NULL),
(372, 'thandi.khoza@iskool.demo', 15, 1, '2025-08-24 11:36:31', NULL, 'in_progress', 0, NULL),
(373, 'zandi.buthelezi@iskool.demo', 15, 1, '2025-08-25 10:33:12', NULL, 'in_progress', 0, NULL),
(374, 'precious.zulu@iskool.demo', 15, 1, '2025-08-26 16:57:21', NULL, 'in_progress', 0, NULL),
(375, 'onthatile.khoza@iskool.demo', 15, 1, '2025-08-20 16:57:27', NULL, 'in_progress', 0, NULL),
(376, 'boitumelo.sithole@iskool.demo', 15, 1, '2025-08-20 15:00:41', NULL, 'in_progress', 0, NULL),
(377, 'tumelo.shabalala@iskool.demo', 15, 1, '2025-08-18 11:51:30', NULL, 'in_progress', 0, NULL),
(378, 'zandi.shabalala@iskool.demo', 15, 1, '2025-08-27 14:40:39', NULL, 'in_progress', 0, NULL),
(379, 'kgomotso.khuzwayo@iskool.demo', 15, 1, '2025-08-27 01:57:04', NULL, 'in_progress', 0, NULL),
(380, 'nokuthula.khoza@iskool.demo', 15, 1, '2025-08-20 08:30:54', NULL, 'in_progress', 0, NULL),
(381, 'naledi.ndlovu@iskool.demo', 15, 1, '2025-08-27 18:42:59', NULL, 'in_progress', 0, NULL),
(382, 'thandi.mhlongo@iskool.demo', 15, 1, '2025-08-27 17:12:05', NULL, 'in_progress', 0, NULL),
(383, 'nomvula.mbatha@iskool.demo', 15, 1, '2025-08-23 08:01:59', NULL, 'in_progress', 0, NULL),
(384, 'amahle.hlongwane@iskool.demo', 16, 1, '2025-08-16 20:14:21', NULL, 'in_progress', 0, NULL),
(385, 'thandi.mhlongo@iskool.demo', 16, 1, '2025-08-15 08:11:56', NULL, 'in_progress', 0, NULL),
(386, 'nokuthula.gumede@iskool.demo', 16, 1, '2025-08-17 07:34:16', NULL, 'in_progress', 0, NULL),
(387, 'zandi.nkosi@iskool.demo', 16, 1, '2025-08-21 01:41:35', NULL, 'in_progress', 0, NULL),
(388, 'boitumelo.sithole@iskool.demo', 16, 1, '2025-08-23 07:50:03', NULL, 'in_progress', 0, NULL),
(389, 'onthatile.khoza@iskool.demo', 16, 1, '2025-08-19 09:52:51', NULL, 'in_progress', 0, NULL),
(390, 'ntokozo.ndlovu@iskool.demo', 16, 1, '2025-08-16 22:17:59', NULL, 'in_progress', 0, NULL),
(391, 'kgomotso.mthembu@iskool.demo', 16, 1, '2025-08-21 01:12:03', NULL, 'in_progress', 0, NULL),
(392, 'zandi.shabalala@iskool.demo', 16, 1, '2025-08-20 06:18:16', NULL, 'in_progress', 0, NULL),
(393, 'lindiwe.dlamini@iskool.demo', 16, 1, '2025-08-16 12:09:27', NULL, 'in_progress', 0, NULL),
(394, 'nokuthula.khoza@iskool.demo', 16, 1, '2025-08-24 02:24:45', NULL, 'in_progress', 0, NULL),
(395, 'nomvula.ndlovu@iskool.demo', 16, 1, '2025-08-17 19:47:07', NULL, 'in_progress', 0, NULL),
(396, 'tumelo.shabalala@iskool.demo', 16, 1, '2025-08-18 09:13:29', NULL, 'in_progress', 0, NULL),
(397, 'thando.nkosi@iskool.demo', 16, 1, '2025-08-19 06:40:01', NULL, 'in_progress', 0, NULL),
(398, 'zandi.buthelezi@iskool.demo', 16, 1, '2025-08-16 06:23:25', NULL, 'in_progress', 0, NULL),
(399, 'athi.mathenjwa@iskool.demo', 16, 1, '2025-08-22 13:30:46', NULL, 'in_progress', 0, NULL),
(400, 'nomvula.mhlongo@iskool.demo', 16, 1, '2025-08-21 12:35:04', NULL, 'in_progress', 0, NULL),
(401, 'kgomotso.khuzwayo@iskool.demo', 16, 1, '2025-08-15 17:31:16', NULL, 'in_progress', 0, NULL),
(402, 'precious.zulu@iskool.demo', 16, 1, '2025-08-21 06:48:41', NULL, 'in_progress', 0, NULL),
(403, 'tumelo.ndlovu@iskool.demo', 16, 1, '2025-08-22 09:19:20', NULL, 'in_progress', 0, NULL),
(404, 'refilwe.sithole@iskool.demo', 16, 1, '2025-08-15 00:50:12', NULL, 'in_progress', 0, NULL),
(405, 'sipho.shabalala@iskool.demo', 16, 1, '2025-08-16 15:42:50', NULL, 'in_progress', 0, NULL),
(406, 'refilwe.ngubane@iskool.demo', 16, 1, '2025-08-20 11:39:49', NULL, 'in_progress', 0, NULL),
(407, 'lerato.sibiya@iskool.demo', 16, 1, '2025-08-18 02:11:37', NULL, 'in_progress', 0, NULL),
(408, 'siphesihle.shabalala@iskool.demo', 16, 1, '2025-08-14 12:22:20', NULL, 'in_progress', 0, NULL),
(409, 'zinhle.mbatha@iskool.demo', 16, 1, '2025-08-18 19:49:19', NULL, 'in_progress', 0, NULL),
(410, 'nomvula.mbatha@iskool.demo', 16, 1, '2025-08-23 17:39:01', NULL, 'in_progress', 0, NULL),
(411, 'dineo.gumede@iskool.demo', 16, 1, '2025-08-15 18:43:21', NULL, 'in_progress', 0, NULL),
(412, 'sipho.shabalala@iskool.demo', 17, 1, '2025-03-16 08:24:00', NULL, 'in_progress', 0, NULL),
(413, 'athi.mathenjwa@iskool.demo', 17, 1, '2025-03-18 08:20:00', NULL, 'in_progress', 0, NULL),
(414, 'thando.nkosi@iskool.demo', 17, 1, '2025-03-19 08:59:00', NULL, 'in_progress', 0, NULL),
(415, 'kgomotso.khuzwayo@iskool.demo', 17, 1, '2025-03-22 08:30:00', NULL, 'in_progress', 0, NULL),
(416, 'zandi.buthelezi@iskool.demo', 17, 1, '2025-03-26 08:43:00', NULL, 'in_progress', 0, NULL),
(417, 'naledi.ndlovu@iskool.demo', 17, 1, '2025-03-20 08:21:00', NULL, 'in_progress', 0, NULL),
(418, 'thandi.mhlongo@iskool.demo', 17, 1, '2025-03-16 08:17:00', NULL, 'in_progress', 0, NULL),
(419, 'lindiwe.dlamini@iskool.demo', 17, 1, '2025-03-20 08:37:00', NULL, 'in_progress', 0, NULL),
(420, 'kgomotso.mthembu@iskool.demo', 17, 1, '2025-03-18 08:04:00', NULL, 'in_progress', 0, NULL),
(421, 'onthatile.khoza@iskool.demo', 17, 1, '2025-03-24 08:18:00', NULL, 'in_progress', 0, NULL),
(422, 'tumelo.ndlovu@iskool.demo', 17, 1, '2025-03-24 08:01:00', NULL, 'in_progress', 0, NULL),
(423, 'refilwe.ngubane@iskool.demo', 17, 1, '2025-03-28 08:46:00', NULL, 'in_progress', 0, NULL),
(424, 'nomvula.ndlovu@iskool.demo', 17, 1, '2025-03-21 08:26:00', NULL, 'in_progress', 0, NULL),
(425, 'lerato.sibiya@iskool.demo', 17, 1, '2025-03-18 08:57:00', NULL, 'in_progress', 0, NULL),
(426, 'zinhle.mbatha@iskool.demo', 17, 1, '2025-03-23 08:36:00', NULL, 'in_progress', 0, NULL),
(427, 'nomvula.mbatha@iskool.demo', 17, 1, '2025-03-19 08:10:00', NULL, 'in_progress', 0, NULL),
(428, 'precious.zulu@iskool.demo', 17, 1, '2025-03-23 08:07:00', NULL, 'in_progress', 0, NULL),
(429, 'siphesihle.shabalala@iskool.demo', 17, 1, '2025-03-28 08:58:00', NULL, 'in_progress', 0, NULL),
(430, 'amahle.hlongwane@iskool.demo', 17, 1, '2025-03-27 08:21:00', NULL, 'in_progress', 0, NULL),
(431, 'boitumelo.sithole@iskool.demo', 17, 1, '2025-03-24 08:02:00', NULL, 'in_progress', 0, NULL),
(432, 'nokuthula.khoza@iskool.demo', 17, 1, '2025-03-26 08:47:00', NULL, 'in_progress', 0, NULL),
(433, 'zandi.nkosi@iskool.demo', 17, 1, '2025-03-19 08:35:00', NULL, 'in_progress', 0, NULL),
(434, 'ntokozo.ndlovu@iskool.demo', 17, 1, '2025-03-17 08:46:00', NULL, 'in_progress', 0, NULL),
(435, 'nomvula.mhlongo@iskool.demo', 17, 1, '2025-03-25 08:32:00', NULL, 'in_progress', 0, NULL),
(436, 'thandi.khoza@iskool.demo', 17, 1, '2025-03-23 08:54:00', NULL, 'in_progress', 0, NULL),
(437, 'nokuthula.gumede@iskool.demo', 17, 1, '2025-03-27 08:27:00', NULL, 'in_progress', 0, NULL),
(438, 'refilwe.sithole@iskool.demo', 17, 1, '2025-03-16 08:00:00', NULL, 'in_progress', 0, NULL),
(439, 'dineo.gumede@iskool.demo', 17, 1, '2025-03-28 08:00:00', NULL, 'in_progress', 0, NULL),
(440, 'tumelo.shabalala@iskool.demo', 17, 1, '2025-03-18 08:59:00', NULL, 'in_progress', 0, NULL),
(441, 'zandi.shabalala@iskool.demo', 17, 1, '2025-03-23 08:13:00', NULL, 'in_progress', 0, NULL),
(442, 'extra0_thulani.mthembu@iskool.demo', 17, 1, '2025-03-23 08:15:00', NULL, 'in_progress', 0, NULL),
(443, 'extra1_siyabonga.dlamini@iskool.demo', 17, 1, '2025-03-27 08:45:00', NULL, 'in_progress', 0, NULL),
(444, 'extra2_nkosinathi.zungu@iskool.demo', 17, 1, '2025-03-20 08:10:00', NULL, 'in_progress', 0, NULL),
(445, 'extra3_mthokozisi.mkhize@iskool.demo', 17, 1, '2025-03-21 08:42:00', NULL, 'in_progress', 0, NULL),
(446, 'extra4_sandile.nene@iskool.demo', 17, 1, '2025-03-18 08:21:00', NULL, 'in_progress', 0, NULL),
(447, 'extra5_mzwandile.gumede@iskool.demo', 17, 1, '2025-03-27 08:56:00', NULL, 'in_progress', 0, NULL),
(448, 'extra6_bhekumuzi.shabalala@iskool.demo', 17, 1, '2025-03-19 08:39:00', NULL, 'in_progress', 0, NULL),
(449, 'extra7_mandla.mthethwa@iskool.demo', 17, 1, '2025-03-16 08:28:00', NULL, 'in_progress', 0, NULL),
(450, 'extra8_sifiso.nkosi@iskool.demo', 17, 1, '2025-03-28 08:04:00', NULL, 'in_progress', 0, NULL),
(451, 'extra9_xolani.khoza@iskool.demo', 17, 1, '2025-03-24 08:59:00', NULL, 'in_progress', 0, NULL),
(452, 'extra10_mlungisi.sibiya@iskool.demo', 17, 1, '2025-03-24 08:12:00', NULL, 'in_progress', 0, NULL),
(453, 'extra11_dumisani.ndlovu@iskool.demo', 17, 1, '2025-03-24 08:06:00', NULL, 'in_progress', 0, NULL),
(454, 'extra12_bonginkosi.buthelezi@iskool.demo', 17, 1, '2025-03-26 08:45:00', NULL, 'in_progress', 0, NULL),
(455, 'extra13_siphelele.hlongwane@iskool.demo', 17, 1, '2025-03-25 08:09:00', NULL, 'in_progress', 0, NULL),
(456, 'extra14_mvelo.mbatha@iskool.demo', 17, 1, '2025-03-22 08:57:00', NULL, 'in_progress', 0, NULL),
(457, 'sipho.shabalala@iskool.demo', 18, 1, '2025-03-24 08:34:00', NULL, 'in_progress', 0, NULL),
(458, 'athi.mathenjwa@iskool.demo', 18, 1, '2025-03-17 08:56:00', NULL, 'in_progress', 0, NULL),
(459, 'thando.nkosi@iskool.demo', 18, 1, '2025-03-28 08:02:00', NULL, 'in_progress', 0, NULL),
(460, 'kgomotso.khuzwayo@iskool.demo', 18, 1, '2025-03-28 08:36:00', NULL, 'in_progress', 0, NULL),
(461, 'zandi.buthelezi@iskool.demo', 18, 1, '2025-03-23 08:12:00', NULL, 'in_progress', 0, NULL),
(462, 'naledi.ndlovu@iskool.demo', 18, 1, '2025-03-25 08:11:00', NULL, 'in_progress', 0, NULL),
(463, 'thandi.mhlongo@iskool.demo', 18, 1, '2025-03-26 08:41:00', NULL, 'in_progress', 0, NULL),
(464, 'lindiwe.dlamini@iskool.demo', 18, 1, '2025-03-22 08:48:00', NULL, 'in_progress', 0, NULL),
(465, 'kgomotso.mthembu@iskool.demo', 18, 1, '2025-03-16 08:52:00', NULL, 'in_progress', 0, NULL),
(466, 'onthatile.khoza@iskool.demo', 18, 1, '2025-03-19 08:36:00', NULL, 'in_progress', 0, NULL),
(467, 'tumelo.ndlovu@iskool.demo', 18, 1, '2025-03-21 08:51:00', NULL, 'in_progress', 0, NULL),
(468, 'refilwe.ngubane@iskool.demo', 18, 1, '2025-03-21 08:20:00', NULL, 'in_progress', 0, NULL),
(469, 'nomvula.ndlovu@iskool.demo', 18, 1, '2025-03-16 08:10:00', NULL, 'in_progress', 0, NULL),
(470, 'lerato.sibiya@iskool.demo', 18, 1, '2025-03-23 08:00:00', NULL, 'in_progress', 0, NULL),
(471, 'zinhle.mbatha@iskool.demo', 18, 1, '2025-03-17 08:29:00', NULL, 'in_progress', 0, NULL),
(472, 'nomvula.mbatha@iskool.demo', 18, 1, '2025-03-16 08:54:00', NULL, 'in_progress', 0, NULL),
(473, 'precious.zulu@iskool.demo', 18, 1, '2025-03-24 08:35:00', NULL, 'in_progress', 0, NULL),
(474, 'siphesihle.shabalala@iskool.demo', 18, 1, '2025-03-25 08:46:00', NULL, 'in_progress', 0, NULL),
(475, 'amahle.hlongwane@iskool.demo', 18, 1, '2025-03-22 08:34:00', NULL, 'in_progress', 0, NULL),
(476, 'boitumelo.sithole@iskool.demo', 18, 1, '2025-03-25 08:39:00', NULL, 'in_progress', 0, NULL),
(477, 'nokuthula.khoza@iskool.demo', 18, 1, '2025-03-21 08:55:00', NULL, 'in_progress', 0, NULL),
(478, 'zandi.nkosi@iskool.demo', 18, 1, '2025-03-16 08:56:00', NULL, 'in_progress', 0, NULL),
(479, 'ntokozo.ndlovu@iskool.demo', 18, 1, '2025-03-18 08:36:00', NULL, 'in_progress', 0, NULL),
(480, 'nomvula.mhlongo@iskool.demo', 18, 1, '2025-03-23 08:10:00', NULL, 'in_progress', 0, NULL),
(481, 'thandi.khoza@iskool.demo', 18, 1, '2025-03-23 08:57:00', NULL, 'in_progress', 0, NULL),
(482, 'nokuthula.gumede@iskool.demo', 18, 1, '2025-03-26 08:17:00', NULL, 'in_progress', 0, NULL),
(483, 'refilwe.sithole@iskool.demo', 18, 1, '2025-03-25 08:02:00', NULL, 'in_progress', 0, NULL),
(484, 'dineo.gumede@iskool.demo', 18, 1, '2025-03-19 08:38:00', NULL, 'in_progress', 0, NULL),
(485, 'tumelo.shabalala@iskool.demo', 18, 1, '2025-03-16 08:28:00', NULL, 'in_progress', 0, NULL),
(486, 'zandi.shabalala@iskool.demo', 18, 1, '2025-03-25 08:18:00', NULL, 'in_progress', 0, NULL),
(487, 'extra0_thulani.mthembu@iskool.demo', 18, 1, '2025-03-19 08:06:00', NULL, 'in_progress', 0, NULL),
(488, 'extra1_siyabonga.dlamini@iskool.demo', 18, 1, '2025-03-28 08:59:00', NULL, 'in_progress', 0, NULL),
(489, 'extra2_nkosinathi.zungu@iskool.demo', 18, 1, '2025-03-16 08:47:00', NULL, 'in_progress', 0, NULL),
(490, 'extra3_mthokozisi.mkhize@iskool.demo', 18, 1, '2025-03-24 08:37:00', NULL, 'in_progress', 0, NULL),
(491, 'extra4_sandile.nene@iskool.demo', 18, 1, '2025-03-28 08:32:00', NULL, 'in_progress', 0, NULL),
(492, 'extra5_mzwandile.gumede@iskool.demo', 18, 1, '2025-03-21 08:35:00', NULL, 'in_progress', 0, NULL),
(493, 'extra6_bhekumuzi.shabalala@iskool.demo', 18, 1, '2025-03-21 08:40:00', NULL, 'in_progress', 0, NULL),
(494, 'extra7_mandla.mthethwa@iskool.demo', 18, 1, '2025-03-18 08:23:00', NULL, 'in_progress', 0, NULL),
(495, 'extra8_sifiso.nkosi@iskool.demo', 18, 1, '2025-03-19 08:07:00', NULL, 'in_progress', 0, NULL),
(496, 'extra9_xolani.khoza@iskool.demo', 18, 1, '2025-03-19 08:33:00', NULL, 'in_progress', 0, NULL),
(497, 'extra10_mlungisi.sibiya@iskool.demo', 18, 1, '2025-03-26 08:37:00', NULL, 'in_progress', 0, NULL),
(498, 'extra11_dumisani.ndlovu@iskool.demo', 18, 1, '2025-03-22 08:00:00', NULL, 'in_progress', 0, NULL),
(499, 'extra12_bonginkosi.buthelezi@iskool.demo', 18, 1, '2025-03-17 08:43:00', NULL, 'in_progress', 0, NULL),
(500, 'extra13_siphelele.hlongwane@iskool.demo', 18, 1, '2025-03-27 08:49:00', NULL, 'in_progress', 0, NULL),
(501, 'extra14_mvelo.mbatha@iskool.demo', 18, 1, '2025-03-18 08:57:00', NULL, 'in_progress', 0, NULL),
(502, 'sipho.shabalala@iskool.demo', 19, 1, '2025-03-18 08:14:00', NULL, 'in_progress', 0, NULL),
(503, 'athi.mathenjwa@iskool.demo', 19, 1, '2025-03-19 08:27:00', NULL, 'in_progress', 0, NULL),
(504, 'thando.nkosi@iskool.demo', 19, 1, '2025-03-24 08:45:00', NULL, 'in_progress', 0, NULL),
(505, 'kgomotso.khuzwayo@iskool.demo', 19, 1, '2025-03-20 08:16:00', NULL, 'in_progress', 0, NULL),
(506, 'zandi.buthelezi@iskool.demo', 19, 1, '2025-03-27 08:04:00', NULL, 'in_progress', 0, NULL),
(507, 'naledi.ndlovu@iskool.demo', 19, 1, '2025-03-27 08:44:00', NULL, 'in_progress', 0, NULL),
(508, 'thandi.mhlongo@iskool.demo', 19, 1, '2025-03-17 08:00:00', NULL, 'in_progress', 0, NULL),
(509, 'lindiwe.dlamini@iskool.demo', 19, 1, '2025-03-16 08:39:00', NULL, 'in_progress', 0, NULL),
(510, 'kgomotso.mthembu@iskool.demo', 19, 1, '2025-03-18 08:58:00', NULL, 'in_progress', 0, NULL),
(511, 'onthatile.khoza@iskool.demo', 19, 1, '2025-03-25 08:12:00', NULL, 'in_progress', 0, NULL),
(512, 'tumelo.ndlovu@iskool.demo', 19, 1, '2025-03-21 08:44:00', NULL, 'in_progress', 0, NULL),
(513, 'refilwe.ngubane@iskool.demo', 19, 1, '2025-03-17 08:10:00', NULL, 'in_progress', 0, NULL),
(514, 'nomvula.ndlovu@iskool.demo', 19, 1, '2025-03-27 08:28:00', NULL, 'in_progress', 0, NULL),
(515, 'lerato.sibiya@iskool.demo', 19, 1, '2025-03-19 08:50:00', NULL, 'in_progress', 0, NULL),
(516, 'zinhle.mbatha@iskool.demo', 19, 1, '2025-03-16 08:39:00', NULL, 'in_progress', 0, NULL),
(517, 'nomvula.mbatha@iskool.demo', 19, 1, '2025-03-28 08:38:00', NULL, 'in_progress', 0, NULL),
(518, 'precious.zulu@iskool.demo', 19, 1, '2025-03-26 08:24:00', NULL, 'in_progress', 0, NULL),
(519, 'siphesihle.shabalala@iskool.demo', 19, 1, '2025-03-22 08:16:00', NULL, 'in_progress', 0, NULL),
(520, 'amahle.hlongwane@iskool.demo', 19, 1, '2025-03-24 08:46:00', NULL, 'in_progress', 0, NULL),
(521, 'boitumelo.sithole@iskool.demo', 19, 1, '2025-03-20 08:18:00', NULL, 'in_progress', 0, NULL),
(522, 'nokuthula.khoza@iskool.demo', 19, 1, '2025-03-17 08:52:00', NULL, 'in_progress', 0, NULL);
INSERT INTO `quiz_attempts` (`id`, `user_email`, `quiz_id`, `attempt_count`, `last_attempt`, `start_time`, `status`, `current_step`, `question_order`) VALUES
(523, 'zandi.nkosi@iskool.demo', 19, 1, '2025-03-19 08:26:00', NULL, 'in_progress', 0, NULL),
(524, 'ntokozo.ndlovu@iskool.demo', 19, 1, '2025-03-16 08:22:00', NULL, 'in_progress', 0, NULL),
(525, 'nomvula.mhlongo@iskool.demo', 19, 1, '2025-03-28 08:49:00', NULL, 'in_progress', 0, NULL),
(526, 'thandi.khoza@iskool.demo', 19, 1, '2025-03-21 08:39:00', NULL, 'in_progress', 0, NULL),
(527, 'nokuthula.gumede@iskool.demo', 19, 1, '2025-03-23 08:33:00', NULL, 'in_progress', 0, NULL),
(528, 'refilwe.sithole@iskool.demo', 19, 1, '2025-03-21 08:30:00', NULL, 'in_progress', 0, NULL),
(529, 'dineo.gumede@iskool.demo', 19, 1, '2025-03-18 08:45:00', NULL, 'in_progress', 0, NULL),
(530, 'tumelo.shabalala@iskool.demo', 19, 1, '2025-03-18 08:13:00', NULL, 'in_progress', 0, NULL),
(531, 'zandi.shabalala@iskool.demo', 19, 1, '2025-03-28 08:46:00', NULL, 'in_progress', 0, NULL),
(532, 'extra0_thulani.mthembu@iskool.demo', 19, 1, '2025-03-23 08:10:00', NULL, 'in_progress', 0, NULL),
(533, 'extra1_siyabonga.dlamini@iskool.demo', 19, 1, '2025-03-20 08:55:00', NULL, 'in_progress', 0, NULL),
(534, 'extra2_nkosinathi.zungu@iskool.demo', 19, 1, '2025-03-26 08:30:00', NULL, 'in_progress', 0, NULL),
(535, 'extra3_mthokozisi.mkhize@iskool.demo', 19, 1, '2025-03-27 08:13:00', NULL, 'in_progress', 0, NULL),
(536, 'extra4_sandile.nene@iskool.demo', 19, 1, '2025-03-21 08:04:00', NULL, 'in_progress', 0, NULL),
(537, 'extra5_mzwandile.gumede@iskool.demo', 19, 1, '2025-03-24 08:57:00', NULL, 'in_progress', 0, NULL),
(538, 'extra6_bhekumuzi.shabalala@iskool.demo', 19, 1, '2025-03-21 08:19:00', NULL, 'in_progress', 0, NULL),
(539, 'extra7_mandla.mthethwa@iskool.demo', 19, 1, '2025-03-18 08:34:00', NULL, 'in_progress', 0, NULL),
(540, 'extra8_sifiso.nkosi@iskool.demo', 19, 1, '2025-03-22 08:02:00', NULL, 'in_progress', 0, NULL),
(541, 'extra9_xolani.khoza@iskool.demo', 19, 1, '2025-03-25 08:00:00', NULL, 'in_progress', 0, NULL),
(542, 'extra10_mlungisi.sibiya@iskool.demo', 19, 1, '2025-03-23 08:31:00', NULL, 'in_progress', 0, NULL),
(543, 'extra11_dumisani.ndlovu@iskool.demo', 19, 1, '2025-03-26 08:44:00', NULL, 'in_progress', 0, NULL),
(544, 'extra12_bonginkosi.buthelezi@iskool.demo', 19, 1, '2025-03-28 08:22:00', NULL, 'in_progress', 0, NULL),
(545, 'extra13_siphelele.hlongwane@iskool.demo', 19, 1, '2025-03-24 08:58:00', NULL, 'in_progress', 0, NULL),
(546, 'extra14_mvelo.mbatha@iskool.demo', 19, 1, '2025-03-21 08:54:00', NULL, 'in_progress', 0, NULL),
(547, 'sipho.shabalala@iskool.demo', 20, 1, '2025-03-24 08:16:00', NULL, 'in_progress', 0, NULL),
(548, 'athi.mathenjwa@iskool.demo', 20, 1, '2025-03-18 08:51:00', NULL, 'in_progress', 0, NULL),
(549, 'thando.nkosi@iskool.demo', 20, 1, '2025-03-18 08:48:00', NULL, 'in_progress', 0, NULL),
(550, 'kgomotso.khuzwayo@iskool.demo', 20, 1, '2025-03-16 08:23:00', NULL, 'in_progress', 0, NULL),
(551, 'zandi.buthelezi@iskool.demo', 20, 1, '2025-03-19 08:15:00', NULL, 'in_progress', 0, NULL),
(552, 'naledi.ndlovu@iskool.demo', 20, 1, '2025-03-24 08:13:00', NULL, 'in_progress', 0, NULL),
(553, 'thandi.mhlongo@iskool.demo', 20, 1, '2025-03-26 08:45:00', NULL, 'in_progress', 0, NULL),
(554, 'lindiwe.dlamini@iskool.demo', 20, 1, '2025-03-27 08:51:00', NULL, 'in_progress', 0, NULL),
(555, 'kgomotso.mthembu@iskool.demo', 20, 1, '2025-03-16 08:19:00', NULL, 'in_progress', 0, NULL),
(556, 'onthatile.khoza@iskool.demo', 20, 1, '2025-03-20 08:50:00', NULL, 'in_progress', 0, NULL),
(557, 'tumelo.ndlovu@iskool.demo', 20, 1, '2025-03-24 08:25:00', NULL, 'in_progress', 0, NULL),
(558, 'refilwe.ngubane@iskool.demo', 20, 1, '2025-03-16 08:15:00', NULL, 'in_progress', 0, NULL),
(559, 'nomvula.ndlovu@iskool.demo', 20, 1, '2025-03-17 08:56:00', NULL, 'in_progress', 0, NULL),
(560, 'lerato.sibiya@iskool.demo', 20, 1, '2025-03-24 08:24:00', NULL, 'in_progress', 0, NULL),
(561, 'zinhle.mbatha@iskool.demo', 20, 1, '2025-03-25 08:09:00', NULL, 'in_progress', 0, NULL),
(562, 'nomvula.mbatha@iskool.demo', 20, 1, '2025-03-25 08:32:00', NULL, 'in_progress', 0, NULL),
(563, 'precious.zulu@iskool.demo', 20, 1, '2025-03-27 08:43:00', NULL, 'in_progress', 0, NULL),
(564, 'siphesihle.shabalala@iskool.demo', 20, 1, '2025-03-24 08:18:00', NULL, 'in_progress', 0, NULL),
(565, 'amahle.hlongwane@iskool.demo', 20, 1, '2025-03-27 08:39:00', NULL, 'in_progress', 0, NULL),
(566, 'boitumelo.sithole@iskool.demo', 20, 1, '2025-03-17 08:27:00', NULL, 'in_progress', 0, NULL),
(567, 'nokuthula.khoza@iskool.demo', 20, 1, '2025-03-19 08:05:00', NULL, 'in_progress', 0, NULL),
(568, 'zandi.nkosi@iskool.demo', 20, 1, '2025-03-24 08:26:00', NULL, 'in_progress', 0, NULL),
(569, 'ntokozo.ndlovu@iskool.demo', 20, 1, '2025-03-20 08:32:00', NULL, 'in_progress', 0, NULL),
(570, 'nomvula.mhlongo@iskool.demo', 20, 1, '2025-03-16 08:33:00', NULL, 'in_progress', 0, NULL),
(571, 'thandi.khoza@iskool.demo', 20, 1, '2025-03-25 08:47:00', NULL, 'in_progress', 0, NULL),
(572, 'nokuthula.gumede@iskool.demo', 20, 1, '2025-03-25 08:36:00', NULL, 'in_progress', 0, NULL),
(573, 'refilwe.sithole@iskool.demo', 20, 1, '2025-03-26 08:39:00', NULL, 'in_progress', 0, NULL),
(574, 'dineo.gumede@iskool.demo', 20, 1, '2025-03-19 08:01:00', NULL, 'in_progress', 0, NULL),
(575, 'tumelo.shabalala@iskool.demo', 20, 1, '2025-03-19 08:50:00', NULL, 'in_progress', 0, NULL),
(576, 'zandi.shabalala@iskool.demo', 20, 1, '2025-03-24 08:44:00', NULL, 'in_progress', 0, NULL),
(577, 'extra0_thulani.mthembu@iskool.demo', 20, 1, '2025-03-21 08:44:00', NULL, 'in_progress', 0, NULL),
(578, 'extra1_siyabonga.dlamini@iskool.demo', 20, 1, '2025-03-24 08:53:00', NULL, 'in_progress', 0, NULL),
(579, 'extra2_nkosinathi.zungu@iskool.demo', 20, 1, '2025-03-20 08:39:00', NULL, 'in_progress', 0, NULL),
(580, 'extra3_mthokozisi.mkhize@iskool.demo', 20, 1, '2025-03-23 08:51:00', NULL, 'in_progress', 0, NULL),
(581, 'extra4_sandile.nene@iskool.demo', 20, 1, '2025-03-22 08:13:00', NULL, 'in_progress', 0, NULL),
(582, 'extra5_mzwandile.gumede@iskool.demo', 20, 1, '2025-03-17 08:15:00', NULL, 'in_progress', 0, NULL),
(583, 'extra6_bhekumuzi.shabalala@iskool.demo', 20, 1, '2025-03-20 08:45:00', NULL, 'in_progress', 0, NULL),
(584, 'extra7_mandla.mthethwa@iskool.demo', 20, 1, '2025-03-26 08:54:00', NULL, 'in_progress', 0, NULL),
(585, 'extra8_sifiso.nkosi@iskool.demo', 20, 1, '2025-03-21 08:38:00', NULL, 'in_progress', 0, NULL),
(586, 'extra9_xolani.khoza@iskool.demo', 20, 1, '2025-03-25 08:14:00', NULL, 'in_progress', 0, NULL),
(587, 'extra10_mlungisi.sibiya@iskool.demo', 20, 1, '2025-03-25 08:25:00', NULL, 'in_progress', 0, NULL),
(588, 'extra11_dumisani.ndlovu@iskool.demo', 20, 1, '2025-03-18 08:01:00', NULL, 'in_progress', 0, NULL),
(589, 'extra12_bonginkosi.buthelezi@iskool.demo', 20, 1, '2025-03-19 08:38:00', NULL, 'in_progress', 0, NULL),
(590, 'extra13_siphelele.hlongwane@iskool.demo', 20, 1, '2025-03-16 08:29:00', NULL, 'in_progress', 0, NULL),
(591, 'extra14_mvelo.mbatha@iskool.demo', 20, 1, '2025-03-22 08:37:00', NULL, 'in_progress', 0, NULL),
(592, 'ayanda.gumede@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(593, 'ayanda.mathenjwa@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(594, 'lindani.vilakazi@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(595, 'rethabile.mbatha@iskool.demo', 21, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(596, 'sanele.mokoena@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(597, 'junior.khuzwayo@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(598, 'ayanda.khoza@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(599, 'rethabile.hlongwane@iskool.demo', 21, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(600, 'lwandle.mthembu@iskool.demo', 21, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(601, 'sanele.dlamini@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(602, 'andile.mthethwa@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(603, 'sanele.khuzwayo@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(604, 'bongani.khuzwayo@iskool.demo', 21, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(605, 'sipho.dlamini@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(606, 'ofentse.mbatha@iskool.demo', 21, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(607, 'lwandle.ngubane@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(608, 'rethabile.vilakazi@iskool.demo', 21, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(609, 'tshepo.gumede@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(610, 'lungile.buthelezi@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(611, 'junior.mthembu@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(612, 'tshepo.nkosi@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(613, 'bongani.mbatha@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(614, 'ofentse.ngubane@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(615, 'siya.vilakazi@iskool.demo', 21, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(616, 'mpho.hlongwane@iskool.demo', 21, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(617, 'sipho.mathenjwa@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(618, 'athi.hlongwane@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(619, 'rethabile.dlamini@iskool.demo', 21, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(620, 'rethabile.khoza@iskool.demo', 21, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(621, 'andile.mthethwa@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(622, 'sanele.dlamini@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(623, 'rethabile.mbatha@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(624, 'rethabile.vilakazi@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(625, 'lwandle.ngubane@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(626, 'ofentse.mbatha@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(627, 'sipho.mathenjwa@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(628, 'lindani.sibiya@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(629, 'ayanda.mathenjwa@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(630, 'ayanda.khoza@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(631, 'lindani.vilakazi@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(632, 'ayanda.gumede@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(633, 'rethabile.dlamini@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(634, 'rethabile.hlongwane@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(635, 'ofentse.ngubane@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(636, 'lungile.buthelezi@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(637, 'sipho.dlamini@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(638, 'bongani.mbatha@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(639, 'mpho.hlongwane@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(640, 'siya.vilakazi@iskool.demo', 22, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(641, 'tshepo.gumede@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(642, 'sanele.khuzwayo@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(643, 'athi.hlongwane@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(644, 'rethabile.khoza@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(645, 'junior.khuzwayo@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(646, 'tshepo.nkosi@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(647, 'junior.mthembu@iskool.demo', 22, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(648, 'sanele.mokoena@iskool.demo', 22, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(649, 'lwandle.mthembu@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(650, 'bongani.khuzwayo@iskool.demo', 22, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(651, 'junior.mthembu@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(652, 'bongani.mbatha@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(653, 'sipho.mathenjwa@iskool.demo', 23, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(654, 'mpho.hlongwane@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(655, 'rethabile.dlamini@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(656, 'lwandle.mthembu@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(657, 'sanele.dlamini@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(658, 'lwandle.ngubane@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(659, 'ayanda.khoza@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(660, 'lindani.vilakazi@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(661, 'sipho.dlamini@iskool.demo', 23, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(662, 'ofentse.mbatha@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(663, 'athi.hlongwane@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(664, 'junior.khuzwayo@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(665, 'lungile.buthelezi@iskool.demo', 23, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(666, 'sanele.mokoena@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(667, 'sanele.khuzwayo@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(668, 'rethabile.vilakazi@iskool.demo', 23, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(669, 'tshepo.gumede@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(670, 'ofentse.ngubane@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(671, 'bongani.khuzwayo@iskool.demo', 23, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(672, 'rethabile.mbatha@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(673, 'ayanda.gumede@iskool.demo', 23, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(674, 'tshepo.nkosi@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(675, 'lindani.sibiya@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(676, 'siya.vilakazi@iskool.demo', 23, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(677, 'rethabile.hlongwane@iskool.demo', 23, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(678, 'rethabile.khoza@iskool.demo', 23, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(679, 'andile.mthethwa@iskool.demo', 23, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(680, 'sanele.dlamini@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(681, 'siya.vilakazi@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(682, 'tshepo.gumede@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(683, 'rethabile.khoza@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(684, 'junior.khuzwayo@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(685, 'athi.hlongwane@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(686, 'sipho.mathenjwa@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(687, 'lindani.vilakazi@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(688, 'ayanda.mathenjwa@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(689, 'ayanda.gumede@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(690, 'sipho.dlamini@iskool.demo', 24, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(691, 'rethabile.mbatha@iskool.demo', 24, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(692, 'mpho.hlongwane@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(693, 'ayanda.khoza@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(694, 'ofentse.ngubane@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(695, 'ofentse.mbatha@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(696, 'lwandle.ngubane@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(697, 'sanele.mokoena@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(698, 'tshepo.nkosi@iskool.demo', 24, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(699, 'rethabile.vilakazi@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(700, 'andile.mthethwa@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(701, 'lindani.sibiya@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(702, 'rethabile.dlamini@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(703, 'sanele.khuzwayo@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(704, 'bongani.mbatha@iskool.demo', 24, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(705, 'junior.mthembu@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(706, 'bongani.khuzwayo@iskool.demo', 24, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(707, 'lungile.buthelezi@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(708, 'lwandle.mthembu@iskool.demo', 24, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(709, 'rethabile.hlongwane@iskool.demo', 24, 1, '2025-10-07 07:00:00', NULL, 'in_progress', 0, NULL),
(710, 'bongani.khuzwayo@iskool.demo', 31, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(711, 'junior.mthembu@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(712, 'rethabile.dlamini@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(713, 'sanele.mokoena@iskool.demo', 31, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(714, 'ayanda.gumede@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(715, 'ayanda.mathenjwa@iskool.demo', 31, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(716, 'rethabile.mbatha@iskool.demo', 31, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(717, 'andile.mthethwa@iskool.demo', 31, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(718, 'ofentse.mbatha@iskool.demo', 31, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(719, 'sanele.khuzwayo@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(720, 'bongani.mbatha@iskool.demo', 31, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(721, 'tshepo.gumede@iskool.demo', 31, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(722, 'ofentse.ngubane@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(723, 'tshepo.nkosi@iskool.demo', 31, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(724, 'lindani.sibiya@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(725, 'lwandle.mthembu@iskool.demo', 31, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(726, 'junior.khuzwayo@iskool.demo', 31, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(727, 'ayanda.khoza@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(728, 'sipho.dlamini@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(729, 'lungile.buthelezi@iskool.demo', 31, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(730, 'siya.vilakazi@iskool.demo', 31, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(731, 'sipho.mathenjwa@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(732, 'lindani.vilakazi@iskool.demo', 31, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(733, 'athi.hlongwane@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(734, 'rethabile.vilakazi@iskool.demo', 31, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(735, 'rethabile.khoza@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(736, 'lwandle.ngubane@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(737, 'sanele.dlamini@iskool.demo', 31, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(738, 'rethabile.hlongwane@iskool.demo', 31, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(739, 'mpho.hlongwane@iskool.demo', 31, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(740, 'sanele.khuzwayo@iskool.demo', 33, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(741, 'bongani.mbatha@iskool.demo', 33, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(742, 'junior.khuzwayo@iskool.demo', 33, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(743, 'lungile.buthelezi@iskool.demo', 33, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(744, 'rethabile.khoza@iskool.demo', 33, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(745, 'sanele.dlamini@iskool.demo', 33, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(746, 'andile.mthethwa@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(747, 'mpho.hlongwane@iskool.demo', 33, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(748, 'bongani.khuzwayo@iskool.demo', 33, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(749, 'lwandle.ngubane@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(750, 'rethabile.vilakazi@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(751, 'sipho.mathenjwa@iskool.demo', 33, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(752, 'junior.mthembu@iskool.demo', 33, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(753, 'rethabile.hlongwane@iskool.demo', 33, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(754, 'ofentse.ngubane@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(755, 'sipho.dlamini@iskool.demo', 33, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(756, 'sanele.mokoena@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(757, 'siya.vilakazi@iskool.demo', 33, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(758, 'ayanda.khoza@iskool.demo', 33, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(759, 'rethabile.mbatha@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(760, 'lwandle.mthembu@iskool.demo', 33, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(761, 'rethabile.dlamini@iskool.demo', 33, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(762, 'lindani.vilakazi@iskool.demo', 33, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(763, 'tshepo.nkosi@iskool.demo', 33, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(764, 'athi.hlongwane@iskool.demo', 33, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(765, 'ayanda.gumede@iskool.demo', 33, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(766, 'lindani.sibiya@iskool.demo', 33, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(767, 'tshepo.gumede@iskool.demo', 33, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(768, 'ayanda.mathenjwa@iskool.demo', 33, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(769, 'lwandle.ngubane@iskool.demo', 32, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(770, 'lindani.sibiya@iskool.demo', 32, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(771, 'rethabile.vilakazi@iskool.demo', 32, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(772, 'rethabile.khoza@iskool.demo', 32, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(773, 'andile.mthethwa@iskool.demo', 32, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(774, 'lungile.buthelezi@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(775, 'ayanda.mathenjwa@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(776, 'mpho.hlongwane@iskool.demo', 32, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(777, 'lindani.vilakazi@iskool.demo', 32, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(778, 'rethabile.dlamini@iskool.demo', 32, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(779, 'sipho.dlamini@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(780, 'ayanda.khoza@iskool.demo', 32, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(781, 'junior.khuzwayo@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(782, 'rethabile.mbatha@iskool.demo', 32, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(783, 'ofentse.mbatha@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(784, 'bongani.mbatha@iskool.demo', 32, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(785, 'sanele.dlamini@iskool.demo', 32, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(786, 'junior.mthembu@iskool.demo', 32, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(787, 'rethabile.hlongwane@iskool.demo', 32, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(788, 'sanele.khuzwayo@iskool.demo', 32, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(789, 'lwandle.mthembu@iskool.demo', 32, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(790, 'ayanda.gumede@iskool.demo', 32, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(791, 'bongani.khuzwayo@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(792, 'sanele.mokoena@iskool.demo', 32, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(793, 'tshepo.nkosi@iskool.demo', 32, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(794, 'athi.hlongwane@iskool.demo', 32, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(795, 'ofentse.ngubane@iskool.demo', 32, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(796, 'tshepo.gumede@iskool.demo', 32, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(797, 'sipho.mathenjwa@iskool.demo', 32, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(798, 'sanele.dlamini@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(799, 'lwandle.mthembu@iskool.demo', 25, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(800, 'sanele.mokoena@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(801, 'rethabile.khoza@iskool.demo', 25, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(802, 'mpho.hlongwane@iskool.demo', 25, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(803, 'junior.mthembu@iskool.demo', 25, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(804, 'rethabile.mbatha@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(805, 'lindani.sibiya@iskool.demo', 25, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(806, 'ayanda.mathenjwa@iskool.demo', 25, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(807, 'rethabile.vilakazi@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(808, 'rethabile.hlongwane@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(809, 'bongani.mbatha@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(810, 'sipho.dlamini@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(811, 'lindani.vilakazi@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(812, 'siya.vilakazi@iskool.demo', 25, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(813, 'junior.khuzwayo@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(814, 'lungile.buthelezi@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(815, 'ayanda.khoza@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(816, 'ayanda.gumede@iskool.demo', 25, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(817, 'lwandle.ngubane@iskool.demo', 25, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(818, 'athi.hlongwane@iskool.demo', 25, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(819, 'sanele.khuzwayo@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(820, 'tshepo.gumede@iskool.demo', 25, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(821, 'ofentse.ngubane@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(822, 'rethabile.dlamini@iskool.demo', 25, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(823, 'ofentse.mbatha@iskool.demo', 25, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(824, 'sipho.mathenjwa@iskool.demo', 25, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(825, 'tshepo.nkosi@iskool.demo', 25, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(826, 'andile.mthethwa@iskool.demo', 25, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(827, 'lwandle.ngubane@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(828, 'rethabile.khoza@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(829, 'athi.hlongwane@iskool.demo', 27, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(830, 'ofentse.ngubane@iskool.demo', 27, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(831, 'siya.vilakazi@iskool.demo', 27, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(832, 'sanele.dlamini@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(833, 'andile.mthethwa@iskool.demo', 27, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(834, 'tshepo.nkosi@iskool.demo', 27, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(835, 'mpho.hlongwane@iskool.demo', 27, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(836, 'sipho.dlamini@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(837, 'rethabile.hlongwane@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(838, 'sipho.mathenjwa@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(839, 'rethabile.vilakazi@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(840, 'junior.khuzwayo@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(841, 'tshepo.gumede@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(842, 'sanele.khuzwayo@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(843, 'lindani.vilakazi@iskool.demo', 27, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(844, 'lindani.sibiya@iskool.demo', 27, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(845, 'sanele.mokoena@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(846, 'ayanda.mathenjwa@iskool.demo', 27, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(847, 'ofentse.mbatha@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(848, 'lwandle.mthembu@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(849, 'bongani.mbatha@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(850, 'rethabile.dlamini@iskool.demo', 27, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(851, 'ayanda.khoza@iskool.demo', 27, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(852, 'junior.mthembu@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(853, 'rethabile.mbatha@iskool.demo', 27, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(854, 'ayanda.gumede@iskool.demo', 27, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(855, 'bongani.khuzwayo@iskool.demo', 27, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(856, 'sipho.mathenjwa@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(857, 'bongani.khuzwayo@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(858, 'rethabile.khoza@iskool.demo', 26, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(859, 'athi.hlongwane@iskool.demo', 26, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(860, 'sipho.dlamini@iskool.demo', 26, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(861, 'siya.vilakazi@iskool.demo', 26, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(862, 'ofentse.mbatha@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(863, 'lindani.vilakazi@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(864, 'mpho.hlongwane@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(865, 'tshepo.nkosi@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(866, 'junior.mthembu@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(867, 'sanele.dlamini@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(868, 'rethabile.dlamini@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(869, 'tshepo.gumede@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(870, 'rethabile.vilakazi@iskool.demo', 26, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(871, 'bongani.mbatha@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(872, 'lwandle.mthembu@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(873, 'ayanda.khoza@iskool.demo', 26, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(874, 'ofentse.ngubane@iskool.demo', 26, 1, '2025-10-24 07:00:00', NULL, 'in_progress', 0, NULL),
(875, 'junior.khuzwayo@iskool.demo', 26, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(876, 'ayanda.mathenjwa@iskool.demo', 26, 1, '2025-10-23 07:00:00', NULL, 'in_progress', 0, NULL),
(877, 'ayanda.gumede@iskool.demo', 26, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(878, 'sanele.mokoena@iskool.demo', 26, 1, '2025-10-19 07:00:00', NULL, 'in_progress', 0, NULL),
(879, 'lindani.sibiya@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(880, 'lungile.buthelezi@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(881, 'andile.mthethwa@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(882, 'lwandle.ngubane@iskool.demo', 26, 1, '2025-10-20 07:00:00', NULL, 'in_progress', 0, NULL),
(883, 'rethabile.hlongwane@iskool.demo', 26, 1, '2025-10-22 07:00:00', NULL, 'in_progress', 0, NULL),
(884, 'rethabile.mbatha@iskool.demo', 26, 1, '2025-10-21 07:00:00', NULL, 'in_progress', 0, NULL),
(885, 'andile.mthethwa@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(886, 'lwandle.mthembu@iskool.demo', 34, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(887, 'rethabile.dlamini@iskool.demo', 34, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(888, 'lungile.buthelezi@iskool.demo', 34, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(889, 'ayanda.khoza@iskool.demo', 34, 1, '2025-11-19 07:00:00', NULL, 'in_progress', 0, NULL),
(890, 'lwandle.ngubane@iskool.demo', 34, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(891, 'junior.khuzwayo@iskool.demo', 34, 1, '2025-11-20 07:00:00', NULL, 'in_progress', 0, NULL),
(892, 'lindani.sibiya@iskool.demo', 34, 1, '2025-11-19 07:00:00', NULL, 'in_progress', 0, NULL),
(893, 'bongani.mbatha@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(894, 'sanele.dlamini@iskool.demo', 34, 1, '2025-11-20 07:00:00', NULL, 'in_progress', 0, NULL),
(895, 'sipho.dlamini@iskool.demo', 34, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(896, 'mpho.hlongwane@iskool.demo', 34, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(897, 'tshepo.nkosi@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(898, 'athi.hlongwane@iskool.demo', 34, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(899, 'sanele.khuzwayo@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(900, 'ofentse.mbatha@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(901, 'ofentse.ngubane@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(902, 'ayanda.mathenjwa@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(903, 'sanele.mokoena@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(904, 'rethabile.khoza@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(905, 'lindani.vilakazi@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(906, 'rethabile.vilakazi@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(907, 'rethabile.hlongwane@iskool.demo', 34, 1, '2025-11-19 07:00:00', NULL, 'in_progress', 0, NULL),
(908, 'junior.mthembu@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(909, 'bongani.khuzwayo@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(910, 'tshepo.gumede@iskool.demo', 34, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(911, 'ayanda.gumede@iskool.demo', 34, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(912, 'sipho.mathenjwa@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(913, 'rethabile.mbatha@iskool.demo', 34, 1, '2025-11-21 07:00:00', NULL, 'in_progress', 0, NULL),
(914, 'bongani.mbatha@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(915, 'ofentse.mbatha@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(916, 'sanele.dlamini@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(917, 'rethabile.mbatha@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(918, 'junior.khuzwayo@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(919, 'sipho.mathenjwa@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(920, 'lindani.vilakazi@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(921, 'ayanda.khoza@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(922, 'lwandle.ngubane@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(923, 'rethabile.vilakazi@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(924, 'sipho.dlamini@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(925, 'andile.mthethwa@iskool.demo', 36, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(926, 'sanele.mokoena@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(927, 'tshepo.nkosi@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(928, 'ayanda.gumede@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(929, 'lindani.sibiya@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(930, 'sanele.khuzwayo@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(931, 'ofentse.ngubane@iskool.demo', 36, 1, '2025-11-16 07:00:00', NULL, 'in_progress', 0, NULL),
(932, 'ayanda.mathenjwa@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(933, 'lwandle.mthembu@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(934, 'athi.hlongwane@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(935, 'siya.vilakazi@iskool.demo', 36, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(936, 'rethabile.dlamini@iskool.demo', 36, 1, '2025-11-17 07:00:00', NULL, 'in_progress', 0, NULL),
(937, 'bongani.khuzwayo@iskool.demo', 36, 1, '2025-11-13 07:00:00', NULL, 'in_progress', 0, NULL),
(938, 'tshepo.gumede@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(939, 'lungile.buthelezi@iskool.demo', 36, 1, '2025-11-18 07:00:00', NULL, 'in_progress', 0, NULL),
(940, 'rethabile.khoza@iskool.demo', 36, 1, '2025-11-14 07:00:00', NULL, 'in_progress', 0, NULL),
(941, 'rethabile.hlongwane@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(942, 'junior.mthembu@iskool.demo', 36, 1, '2025-11-15 07:00:00', NULL, 'in_progress', 0, NULL),
(943, 'bongani.mbatha@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(944, 'athi.hlongwane@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(945, 'lwandle.ngubane@iskool.demo', 35, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(946, 'junior.mthembu@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(947, 'ofentse.mbatha@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(948, 'rethabile.mbatha@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(949, 'siya.vilakazi@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(950, 'sanele.khuzwayo@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(951, 'sanele.dlamini@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(952, 'bongani.khuzwayo@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(953, 'lwandle.mthembu@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(954, 'ofentse.ngubane@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(955, 'sipho.dlamini@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(956, 'rethabile.dlamini@iskool.demo', 35, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(957, 'lindani.vilakazi@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(958, 'ayanda.mathenjwa@iskool.demo', 35, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(959, 'ayanda.khoza@iskool.demo', 35, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(960, 'andile.mthethwa@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(961, 'lungile.buthelezi@iskool.demo', 35, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(962, 'tshepo.gumede@iskool.demo', 35, 1, '2025-11-23 07:00:00', NULL, 'in_progress', 0, NULL),
(963, 'rethabile.khoza@iskool.demo', 35, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(964, 'rethabile.hlongwane@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(965, 'sanele.mokoena@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(966, 'lindani.sibiya@iskool.demo', 35, 1, '2025-11-26 07:00:00', NULL, 'in_progress', 0, NULL),
(967, 'tshepo.nkosi@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(968, 'mpho.hlongwane@iskool.demo', 35, 1, '2025-11-25 07:00:00', NULL, 'in_progress', 0, NULL),
(969, 'junior.khuzwayo@iskool.demo', 35, 1, '2025-11-24 07:00:00', NULL, 'in_progress', 0, NULL),
(970, 'rethabile.vilakazi@iskool.demo', 35, 1, '2025-11-22 07:00:00', NULL, 'in_progress', 0, NULL),
(971, 'ayanda.gumede@iskool.demo', 35, 1, '2025-11-27 07:00:00', NULL, 'in_progress', 0, NULL),
(972, 'sanele.dlamini@iskool.demo', 28, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(973, 'athi.hlongwane@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(974, 'junior.khuzwayo@iskool.demo', 28, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(975, 'tshepo.nkosi@iskool.demo', 28, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(976, 'ofentse.mbatha@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(977, 'lindani.vilakazi@iskool.demo', 28, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(978, 'tshepo.gumede@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(979, 'andile.mthethwa@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(980, 'rethabile.mbatha@iskool.demo', 28, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(981, 'sipho.dlamini@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(982, 'sanele.khuzwayo@iskool.demo', 28, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(983, 'bongani.mbatha@iskool.demo', 28, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(984, 'sanele.mokoena@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(985, 'ayanda.gumede@iskool.demo', 28, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(986, 'rethabile.hlongwane@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(987, 'ofentse.ngubane@iskool.demo', 28, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(988, 'junior.mthembu@iskool.demo', 28, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(989, 'mpho.hlongwane@iskool.demo', 28, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(990, 'lungile.buthelezi@iskool.demo', 28, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(991, 'lindani.sibiya@iskool.demo', 28, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(992, 'rethabile.vilakazi@iskool.demo', 28, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(993, 'sipho.mathenjwa@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(994, 'lwandle.mthembu@iskool.demo', 28, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(995, 'rethabile.khoza@iskool.demo', 28, 1, '2025-10-08 07:00:00', NULL, 'in_progress', 0, NULL),
(996, 'siya.vilakazi@iskool.demo', 28, 1, '2025-10-10 07:00:00', NULL, 'in_progress', 0, NULL),
(997, 'rethabile.dlamini@iskool.demo', 28, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(998, 'ayanda.khoza@iskool.demo', 28, 1, '2025-10-09 07:00:00', NULL, 'in_progress', 0, NULL),
(999, 'ayanda.mathenjwa@iskool.demo', 28, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(1000, 'lwandle.ngubane@iskool.demo', 28, 1, '2025-10-11 07:00:00', NULL, 'in_progress', 0, NULL),
(1001, 'rethabile.vilakazi@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1002, 'lwandle.mthembu@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1003, 'lwandle.ngubane@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1004, 'bongani.mbatha@iskool.demo', 30, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1005, 'rethabile.dlamini@iskool.demo', 30, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1006, 'sipho.mathenjwa@iskool.demo', 30, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1007, 'ofentse.mbatha@iskool.demo', 30, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(1008, 'sanele.mokoena@iskool.demo', 30, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(1009, 'ayanda.gumede@iskool.demo', 30, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(1010, 'rethabile.khoza@iskool.demo', 30, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1011, 'sipho.dlamini@iskool.demo', 30, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1012, 'siya.vilakazi@iskool.demo', 30, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(1013, 'rethabile.hlongwane@iskool.demo', 30, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1014, 'ayanda.mathenjwa@iskool.demo', 30, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(1015, 'rethabile.mbatha@iskool.demo', 30, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(1016, 'junior.mthembu@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1017, 'junior.khuzwayo@iskool.demo', 30, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1018, 'lungile.buthelezi@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1019, 'tshepo.nkosi@iskool.demo', 30, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1020, 'sanele.dlamini@iskool.demo', 30, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1021, 'lindani.vilakazi@iskool.demo', 30, 1, '2025-10-17 07:00:00', NULL, 'in_progress', 0, NULL),
(1022, 'lindani.sibiya@iskool.demo', 30, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1023, 'tshepo.gumede@iskool.demo', 30, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1024, 'ayanda.khoza@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1025, 'bongani.khuzwayo@iskool.demo', 30, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1026, 'mpho.hlongwane@iskool.demo', 30, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1027, 'athi.hlongwane@iskool.demo', 30, 1, '2025-10-18 07:00:00', NULL, 'in_progress', 0, NULL),
(1028, 'andile.mthethwa@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1029, 'ofentse.ngubane@iskool.demo', 30, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1030, 'lungile.buthelezi@iskool.demo', 29, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1031, 'siya.vilakazi@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1032, 'junior.mthembu@iskool.demo', 29, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(1033, 'sanele.khuzwayo@iskool.demo', 29, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(1034, 'bongani.mbatha@iskool.demo', 29, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1035, 'andile.mthethwa@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1036, 'ofentse.mbatha@iskool.demo', 29, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1037, 'rethabile.vilakazi@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1038, 'sipho.mathenjwa@iskool.demo', 29, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1039, 'tshepo.nkosi@iskool.demo', 29, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL);
INSERT INTO `quiz_attempts` (`id`, `user_email`, `quiz_id`, `attempt_count`, `last_attempt`, `start_time`, `status`, `current_step`, `question_order`) VALUES
(1040, 'ayanda.gumede@iskool.demo', 29, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1041, 'lindani.vilakazi@iskool.demo', 29, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1042, 'rethabile.dlamini@iskool.demo', 29, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(1043, 'tshepo.gumede@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1044, 'lindani.sibiya@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1045, 'bongani.khuzwayo@iskool.demo', 29, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1046, 'ofentse.ngubane@iskool.demo', 29, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1047, 'sanele.dlamini@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1048, 'rethabile.hlongwane@iskool.demo', 29, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1049, 'junior.khuzwayo@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1050, 'athi.hlongwane@iskool.demo', 29, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1051, 'sipho.dlamini@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1052, 'lwandle.ngubane@iskool.demo', 29, 1, '2025-10-12 07:00:00', NULL, 'in_progress', 0, NULL),
(1053, 'sanele.mokoena@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1054, 'lwandle.mthembu@iskool.demo', 29, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1055, 'rethabile.mbatha@iskool.demo', 29, 1, '2025-10-13 07:00:00', NULL, 'in_progress', 0, NULL),
(1056, 'rethabile.khoza@iskool.demo', 29, 1, '2025-10-16 07:00:00', NULL, 'in_progress', 0, NULL),
(1057, 'mpho.hlongwane@iskool.demo', 29, 1, '2025-10-15 07:00:00', NULL, 'in_progress', 0, NULL),
(1058, 'ayanda.mathenjwa@iskool.demo', 29, 1, '2025-10-14 07:00:00', NULL, 'in_progress', 0, NULL),
(1059, 'mandlasimphiwe99@gmail.com', 37, 0, '2026-01-06 12:55:35', NULL, 'in_progress', 0, NULL),
(1060, 'mandlasimphiwe99@gmail.com', 40, 0, '2026-01-07 20:29:46', '2026-01-07 22:29:46', 'in_progress', 0, NULL),
(1061, 'mandlasimphiwe99@gmail.com', 41, 0, '2026-01-08 08:39:06', '2026-01-08 10:39:06', 'in_progress', 0, NULL),
(1062, 'mandlasimphiwe99@gmail.com', 39, 0, '2026-01-08 08:56:55', '2026-01-08 10:56:55', 'in_progress', 0, NULL),
(1063, 'mandlasimphiwe99@gmail.com', 42, 0, '2026-01-08 10:05:11', '2026-01-08 12:05:11', 'submitted', 0, NULL),
(1064, 'mandlasimphiwe99@gmail.com', 43, 0, '2026-01-08 10:15:05', '2026-01-08 12:15:05', 'submitted', 0, NULL),
(1065, 'mandlasimphiwe99@gmail.com', 44, 0, '2026-01-08 10:25:46', '2026-01-08 12:25:46', 'submitted', 0, NULL),
(1066, 'mandlasimphiwe99@gmail.com', 45, 0, '2026-01-08 12:14:20', '2026-01-08 14:14:20', 'submitted', 0, NULL),
(1067, 'mandlasimphiwe99@gmail.com', 49, 0, '2026-01-08 18:34:11', '2026-01-08 20:34:11', 'submitted', 0, NULL),
(1068, 'mandlasimphiwe99@gmail.com', 53, 0, '2026-01-09 15:14:26', '2026-01-09 17:14:26', 'submitted', 0, NULL),
(1069, 'mandlasimphiwe99@gmail.com', 51, 0, '2026-01-09 15:14:51', '2026-01-09 17:14:51', 'submitted', 0, NULL),
(1070, 'mandlasimphiwe99@gmail.com', 50, 0, '2026-01-09 15:15:34', '2026-01-09 17:15:34', 'submitted', 0, NULL),
(1071, 'mandlasimphiwe99@gmail.com', 52, 0, '2026-01-09 15:17:24', '2026-01-09 17:17:24', 'submitted', 0, NULL),
(1072, 'mandlasimphiwe99@gmail.com', 60, 0, '2026-01-09 20:28:13', '2026-01-09 22:28:13', 'submitted', 0, NULL),
(1073, 'mandi.vava@iskool.demo', 59, 0, '2026-01-09 20:35:53', '2026-01-09 22:35:53', 'submitted', 0, NULL),
(1074, 'mandlasimphiwe99@gmail.com', 58, 0, '2026-01-09 20:36:48', '2026-01-09 22:36:48', 'submitted', 0, NULL),
(1075, 'mandi.vava@iskool.demo', 61, 0, '2026-01-09 21:05:46', '2026-01-09 23:05:46', 'submitted', 0, NULL),
(1076, 'mandlasimphiwe99@gmail.com', 62, 0, '2026-01-10 08:33:08', '2026-01-10 10:33:08', 'submitted', 0, NULL),
(1077, 'mandi.vava@iskool.demo', 63, 0, '2026-01-10 08:58:15', '2026-01-10 10:58:15', 'submitted', 0, NULL),
(1078, 'mandlasimphiwe99@gmail.com', 64, 0, '2026-01-10 09:03:09', '2026-01-10 11:03:09', 'submitted', 0, NULL),
(1079, 'mandlasimphiwe99@gmail.com', 65, 0, '2026-01-10 09:38:05', '2026-01-10 11:38:05', 'submitted', 0, NULL),
(1080, 'mandlasimphiwe99@gmail.com', 66, 0, '2026-01-10 10:48:12', '2026-01-10 12:48:12', 'submitted', 0, NULL),
(1081, 'zinhle.mkhathini@iskool.demo', 66, 0, '2026-01-10 10:48:49', '2026-01-10 12:48:49', 'submitted', 0, NULL),
(1082, 'mandi.vava@iskool.demo', 66, 0, '2026-01-10 10:50:06', '2026-01-10 12:50:06', 'submitted', 0, NULL),
(1083, 'mandlasimphiwe99@gmail.com', 67, 0, '2026-01-10 10:59:07', '2026-01-10 12:59:07', 'submitted', 0, NULL),
(1084, 'mandlasimphiwe99@gmail.com', 68, 0, '2026-01-10 11:38:09', '2026-01-10 13:38:09', 'submitted', 0, NULL),
(1085, 'mandi.vava@iskool.demo', 68, 0, '2026-01-10 14:47:58', '2026-01-10 16:47:58', 'submitted', 0, NULL),
(1086, 'mandi.vava@iskool.demo', 69, 0, '2026-01-10 15:03:34', '2026-01-10 17:03:34', 'submitted', 0, NULL),
(1087, 'mandlasimphiwe99@gmail.com', 69, 0, '2026-01-10 15:30:43', '2026-01-10 17:30:43', 'submitted', 0, NULL),
(1088, 'zinhle.mkhathini@iskool.demo', 69, 0, '2026-01-10 16:11:58', '2026-01-10 18:11:58', 'submitted', 0, NULL),
(1089, 'zinhle.mkhathini@iskool.demo', 68, 0, '2026-01-10 16:17:14', '2026-01-10 18:17:14', 'submitted', 0, NULL),
(1090, 'mandlasimphiwe99@gmail.com', 70, 0, '2026-01-11 08:49:09', '2026-01-11 10:49:09', 'submitted', 0, NULL),
(1091, 'mandi.vava@iskool.demo', 70, 0, '2026-01-11 08:50:50', '2026-01-11 10:50:50', 'submitted', 0, NULL),
(1092, 'zinhle.mkhathini@iskool.demo', 70, 0, '2026-01-11 08:53:42', '2026-01-11 10:53:42', 'submitted', 0, NULL),
(1093, 'mandlasimphiwe99@gmail.com', 71, 0, '2026-01-11 10:58:08', '2026-01-11 12:58:08', 'submitted', 0, NULL),
(1094, 'zinhle.mkhathini@iskool.demo', 71, 0, '2026-01-11 11:32:17', '2026-01-11 13:32:17', 'submitted', 0, NULL),
(1095, 'mandi.vava@iskool.demo', 71, 0, '2026-01-11 12:03:39', '2026-01-11 14:03:39', 'submitted', 0, NULL),
(1096, 'mandlasimphiwe99@gmail.com', 73, 0, '2026-01-11 12:49:25', '2026-01-11 14:49:25', 'submitted', 0, NULL),
(1097, 'mandlasimphiwe99@gmail.com', 72, 0, '2026-01-11 12:50:15', '2026-01-11 14:50:15', 'submitted', 0, NULL),
(1098, 'zinhle.mkhathini@iskool.demo', 72, 0, '2026-01-11 13:22:16', '2026-01-11 15:22:16', 'submitted', 0, NULL),
(1099, 'mandi.vava@iskool.demo', 72, 0, '2026-01-11 13:36:25', '2026-01-11 15:36:25', 'submitted', 0, NULL),
(1100, 'mandlasimphiwe99@gmail.com', 78, 0, '2026-01-15 13:58:33', '2026-01-15 15:58:33', 'submitted', 0, NULL),
(1101, 'zinhle.mkhathini@iskool.demo', 78, 0, '2026-01-15 14:33:28', '2026-01-15 16:33:28', 'submitted', 0, NULL),
(1102, 'mandi.vava@iskool.demo', 78, 0, '2026-01-15 18:01:41', '2026-01-15 20:01:41', 'submitted', 0, NULL),
(1103, 'mandi.vava@iskool.demo', 77, 0, '2026-01-25 12:18:19', '2026-01-25 14:18:19', 'submitted', 0, NULL),
(1104, 'mandi.vava@iskool.demo', 76, 0, '2026-01-25 12:20:56', '2026-01-25 14:20:56', 'submitted', 0, NULL),
(1105, 'mandi.vava@iskool.demo', 73, 0, '2026-01-25 12:21:48', '2026-01-25 14:21:48', 'in_progress', 0, NULL),
(1106, 'mandi.vava@iskool.demo', 79, 0, '2026-01-25 12:22:34', '2026-01-25 14:22:34', 'submitted', 0, NULL),
(1107, 'mandlasimphiwe99@gmail.com', 76, 0, '2026-01-25 13:29:49', '2026-01-25 15:29:49', 'submitted', 5, NULL),
(1108, 'mandlasimphiwe99@gmail.com', 79, 0, '2026-01-25 13:32:49', '2026-01-25 15:32:49', 'submitted', 1, NULL),
(1109, 'mandlasimphiwe99@gmail.com', 77, 0, '2026-01-25 13:55:26', '2026-01-25 15:55:26', 'submitted', 1, NULL),
(1110, 'zinhle.mkhathini@iskool.demo', 79, 0, '2026-01-25 14:04:39', '2026-01-25 16:04:39', 'submitted', 1, NULL),
(1111, 'zinhle.mkhathini@iskool.demo', 76, 0, '2026-01-25 14:08:33', '2026-01-25 16:08:33', 'submitted', 5, NULL),
(1112, 'zinhle.mkhathini@iskool.demo', 77, 0, '2026-01-25 14:10:55', '2026-01-25 16:10:55', 'submitted', 1, NULL),
(1113, 'zinhle.mkhathini@iskool.demo', 73, 0, '2026-01-25 14:30:14', '2026-01-25 16:30:14', 'submitted', 0, NULL),
(1114, 'zinhle.mkhathini@iskool.demo', 67, 0, '2026-01-25 14:31:37', '2026-01-25 16:31:37', 'submitted', 0, NULL),
(1115, 'zinhle.mkhathini@iskool.demo', 65, 0, '2026-01-25 14:38:23', '2026-01-25 16:38:23', 'submitted', 0, NULL),
(1116, 'mandi.vava@iskool.demo', 67, 0, '2026-01-25 19:12:10', '2026-01-25 21:12:10', 'in_progress', 0, NULL),
(1117, 'mandlasimphiwe99@gmail.com', 80, 0, '2026-02-09 18:49:55', '2026-02-09 20:49:55', 'submitted', 0, NULL),
(1118, 'mandlasimphiwe99@gmail.com', 81, 0, '2026-02-10 11:44:30', '2026-02-10 13:44:30', 'submitted', 0, NULL),
(1119, 'mandi.vava@iskool.demo', 80, 0, '2026-02-10 12:58:03', '2026-02-10 14:58:03', 'submitted', 0, NULL),
(1120, 'mandi.vava@iskool.demo', 81, 0, '2026-02-10 18:50:10', '2026-02-10 20:50:10', 'submitted', 0, NULL),
(1121, 'mandlasimphiwe99@gmail.com', 83, 0, '2026-02-18 18:17:49', '2026-02-18 20:17:49', 'submitted', 2, NULL),
(1122, 'mandlasimphiwe99@gmail.com', 84, 0, '2026-02-20 14:19:34', '2026-02-20 16:19:34', 'submitted', 0, NULL),
(1123, 'mandi.vava@iskool.demo', 83, 0, '2026-02-21 09:43:17', '2026-02-21 11:43:17', 'submitted', 2, NULL),
(1124, 'mandi.vava@iskool.demo', 82, 0, '2026-02-21 10:09:54', '2026-02-21 12:09:54', 'submitted', 0, NULL),
(1125, 'mandi.vava@iskool.demo', 84, 0, '2026-02-21 10:29:08', '2026-02-21 12:29:08', 'submitted', 0, NULL),
(1126, 'mandlasimphiwe99@gmail.com', 82, 0, '2026-02-21 12:25:48', '2026-02-21 14:25:48', 'submitted', 0, NULL),
(1127, 'zinhle.mkhathini@iskool.demo', 82, 0, '2026-02-21 12:42:37', '2026-02-21 14:42:37', 'submitted', 0, NULL),
(1128, 'zinhle.mkhathini@iskool.demo', 83, 0, '2026-02-21 12:47:24', '2026-02-21 14:47:24', 'submitted', 2, NULL),
(1129, 'zinhle.mkhathini@iskool.demo', 84, 0, '2026-02-21 14:25:42', '2026-02-21 16:25:42', 'in_progress', 0, NULL),
(1130, 'zinhle.mkhathini@iskool.demo', 86, 0, '2026-02-28 09:10:43', '2026-02-28 11:10:43', 'in_progress', 0, NULL),
(1131, 'zinhle.mkhathini@iskool.demo', 64, 0, '2026-02-28 11:34:27', '2026-02-28 13:34:27', 'submitted', 0, NULL),
(1132, 'zinhle.mkhathini@iskool.demo', 63, 0, '2026-02-28 11:38:13', '2026-02-28 13:38:13', 'submitted', 0, NULL),
(1133, 'mandlasimphiwe99@gmail.com', 87, 0, '2026-03-01 10:24:55', '2026-03-01 12:24:55', 'submitted', 4, NULL),
(1134, 'zinhle.mkhathini@iskool.demo', 87, 0, '2026-03-01 19:18:13', '2026-03-01 21:18:13', 'in_progress', 1, NULL),
(1135, 'mandi.vava@iskool.demo', 87, 0, '2026-03-05 11:58:53', '2026-03-05 13:58:53', 'submitted', 0, NULL),
(1136, 'mandi.vava@iskool.demo', 86, 0, '2026-03-05 12:03:11', '2026-03-05 14:03:11', 'submitted', 0, NULL),
(1137, 'mandi.vava@iskool.demo', 88, 0, '2026-03-05 12:12:28', '2026-03-05 14:12:28', 'submitted', 0, NULL),
(1138, 'mandi.vava@iskool.demo', 91, 0, '2026-03-05 12:33:29', '2026-03-05 14:33:29', 'in_progress', 0, NULL),
(1139, 'mandi.vava@iskool.demo', 90, 0, '2026-03-05 12:34:12', '2026-03-05 14:34:12', 'in_progress', 0, NULL),
(1140, 'mandi.vava@iskool.demo', 89, 0, '2026-03-05 12:34:35', '2026-03-05 14:34:35', 'in_progress', 0, NULL),
(1141, 'mandlasimphiwe99@gmail.com', 92, 0, '2026-03-05 12:46:00', '2026-03-05 14:46:00', 'submitted', 9, NULL),
(1142, 'mandi.vava@iskool.demo', 92, 0, '2026-03-05 12:55:15', '2026-03-05 14:55:15', 'submitted', 9, NULL),
(1143, 'zinhle.mkhathini@iskool.demo', 92, 0, '2026-03-05 13:32:27', '2026-03-05 15:32:27', 'submitted', 9, NULL),
(1144, 'mandlasimphiwe99@gmail.com', 93, 0, '2026-03-05 14:32:20', '2026-03-05 16:32:20', 'submitted', 7, NULL),
(1145, 'zinhle.mkhathini@iskool.demo', 93, 0, '2026-03-05 14:45:11', '2026-03-05 16:45:11', 'submitted', 7, NULL),
(1146, 'mandi.vava@iskool.demo', 93, 0, '2026-03-05 15:39:22', '2026-03-05 17:39:22', 'submitted', 7, NULL),
(1147, 'mandlasimphiwe99@gmail.com', 91, 0, '2026-03-05 16:05:56', '2026-03-05 18:05:56', 'submitted', 0, NULL),
(1148, 'zinhle.mkhathini@iskool.demo', 91, 0, '2026-03-05 16:07:09', '2026-03-05 18:07:09', 'submitted', 0, NULL),
(1149, 'mandlasimphiwe99@gmail.com', 94, 0, '2026-03-05 18:16:12', '2026-03-05 20:16:12', 'submitted', 6, NULL),
(1150, 'zinhle.mkhathini@iskool.demo', 94, 0, '2026-03-05 18:35:41', '2026-03-05 20:35:41', 'submitted', 6, '[498,503,500,501,502,499,497]'),
(1151, 'mandlasimphiwe99@gmail.com', 95, 0, '2026-03-08 12:40:03', '2026-03-08 14:40:03', 'submitted', 2, '[504,505,506]'),
(1152, 'mandlasimphiwe99@gmail.com', 96, 0, '2026-03-08 12:41:07', '2026-03-08 14:41:07', 'submitted', 0, '[]'),
(1153, 'mandlasimphiwe99@gmail.com', 97, 0, '2026-03-08 12:42:15', '2026-03-08 14:42:15', 'submitted', 0, NULL),
(1154, 'mandlasimphiwe99@gmail.com', 98, 0, '2026-03-08 12:43:17', '2026-03-08 14:43:17', 'submitted', 1, '[509,510]'),
(1155, 'mandi.vava@iskool.demo', 95, 0, '2026-03-08 12:45:39', '2026-03-08 14:45:39', 'submitted', 2, '[504,505,506]'),
(1156, 'mandi.vava@iskool.demo', 96, 0, '2026-03-08 12:46:58', '2026-03-08 14:46:58', 'submitted', 0, '[]'),
(1157, 'mandi.vava@iskool.demo', 97, 0, '2026-03-08 12:47:34', '2026-03-08 14:47:34', 'submitted', 0, NULL),
(1158, 'mandi.vava@iskool.demo', 98, 0, '2026-03-08 12:48:15', '2026-03-08 14:48:15', 'submitted', 1, '[509,510]'),
(1159, 'zinhle.mkhathini@iskool.demo', 95, 0, '2026-03-08 12:49:17', '2026-03-08 14:49:17', 'submitted', 2, '[506,504,505]'),
(1160, 'zinhle.mkhathini@iskool.demo', 96, 0, '2026-03-08 12:49:57', '2026-03-08 14:49:57', 'submitted', 0, '[]'),
(1161, 'zinhle.mkhathini@iskool.demo', 97, 0, '2026-03-08 12:50:25', '2026-03-08 14:50:25', 'submitted', 0, NULL),
(1162, 'zinhle.mkhathini@iskool.demo', 98, 0, '2026-03-08 12:51:00', '2026-03-08 14:51:00', 'submitted', 1, '[509,510]'),
(1163, 'mandlasimphiwe99@gmail.com', 99, 0, '2026-03-08 13:11:06', '2026-03-08 15:11:06', 'submitted', 2, '[513,512,511]'),
(1164, 'mandlasimphiwe99@gmail.com', 100, 0, '2026-03-08 13:11:43', '2026-03-08 15:11:43', 'submitted', 1, '[514,515]'),
(1165, 'mandlasimphiwe99@gmail.com', 101, 0, '2026-03-08 13:12:26', '2026-03-08 15:12:26', 'submitted', 1, NULL),
(1166, 'mandlasimphiwe99@gmail.com', 103, 0, '2026-03-08 13:13:16', '2026-03-08 15:13:16', 'submitted', 0, NULL),
(1167, 'mandlasimphiwe99@gmail.com', 104, 0, '2026-03-08 13:13:51', '2026-03-08 15:13:51', 'submitted', 0, NULL),
(1168, 'mandi.vava@iskool.demo', 101, 0, '2026-03-08 13:17:04', '2026-03-08 15:17:04', 'submitted', 1, NULL),
(1169, 'mandi.vava@iskool.demo', 100, 0, '2026-03-08 13:17:59', '2026-03-08 15:17:59', 'submitted', 1, '[515,514]'),
(1170, 'mandi.vava@iskool.demo', 99, 0, '2026-03-08 13:18:38', '2026-03-08 15:18:38', 'submitted', 2, '[512,513,511]'),
(1171, 'zinhle.mkhathini@iskool.demo', 99, 0, '2026-03-08 13:19:56', '2026-03-08 15:19:56', 'submitted', 2, '[513,512,511]'),
(1172, 'zinhle.mkhathini@iskool.demo', 100, 0, '2026-03-08 13:20:36', '2026-03-08 15:20:36', 'submitted', 1, '[514,515]'),
(1173, 'zinhle.mkhathini@iskool.demo', 101, 0, '2026-03-08 13:22:08', '2026-03-08 15:22:08', 'submitted', 1, NULL),
(1174, 'mandlasimphiwe99@gmail.com', 105, 0, '2026-03-30 09:57:52', '2026-03-30 11:57:52', 'submitted', 0, NULL),
(1175, 'mandlasimphiwe99@gmail.com', 102, 0, '2026-04-06 12:24:57', '2026-04-06 14:24:57', 'in_progress', 0, '[]'),
(1176, 'mandlasimphiwe99@gmail.com', 90, 0, '2026-04-06 12:25:15', '2026-04-06 14:25:15', 'submitted', 0, NULL),
(1177, 'mandlasimphiwe99@gmail.com', 109, 0, '2026-05-01 22:20:30', '2026-05-02 00:20:30', 'in_progress', 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_integrity_logs`
--

CREATE TABLE `quiz_integrity_logs` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `event_type` enum('tab_hidden','window_blur','tab_switch','quiz_exit','rapid_navigation') NOT NULL,
  `occurred_at` timestamp NULL DEFAULT current_timestamp(),
  `layout_mode` enum('single_page','multi_page') DEFAULT 'single_page',
  `active_question_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quiz_integrity_logs`
--

INSERT INTO `quiz_integrity_logs` (`id`, `quiz_id`, `user_email`, `event_type`, `occurred_at`, `layout_mode`, `active_question_id`) VALUES
(61, 72, 'zinhle.mkhathini@iskool.demo', '', '2026-01-11 13:22:27', 'multi_page', 439),
(62, 72, 'zinhle.mkhathini@iskool.demo', '', '2026-01-11 13:22:27', 'multi_page', 440),
(63, 72, 'zinhle.mkhathini@iskool.demo', '', '2026-01-11 13:22:29', 'multi_page', 443),
(104, 76, 'zinhle.mkhathini@iskool.demo', '', '2026-01-25 14:08:45', 'multi_page', 451),
(213, 63, 'zinhle.mkhathini@iskool.demo', '', '2026-02-28 11:39:19', 'single_page', 426),
(218, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:47:08', 'multi_page', 480),
(219, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:47:08', 'multi_page', 480),
(220, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:48:32', 'multi_page', 479),
(221, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:48:32', 'multi_page', 479),
(222, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:50:38', 'multi_page', 485),
(223, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:50:39', 'multi_page', 485),
(224, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:51:07', 'multi_page', 485),
(225, 92, 'mandlasimphiwe99@gmail.com', '', '2026-03-05 12:51:19', 'multi_page', 485),
(226, 92, 'mandi.vava@iskool.demo', '', '2026-03-05 12:56:13', 'multi_page', 482),
(227, 92, 'mandi.vava@iskool.demo', '', '2026-03-05 12:56:13', 'multi_page', 482),
(228, 92, 'mandi.vava@iskool.demo', '', '2026-03-05 12:57:46', 'multi_page', 483),
(229, 92, 'mandi.vava@iskool.demo', '', '2026-03-05 12:57:46', 'multi_page', 483),
(230, 92, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 13:33:34', 'multi_page', 481),
(231, 92, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 13:33:34', 'multi_page', 481),
(232, 92, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 13:34:16', 'multi_page', 488),
(233, 92, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 13:34:16', 'multi_page', 488),
(234, 93, 'mandlasimphiwe99@gmail.com', 'quiz_exit', '2026-03-05 14:32:55', 'multi_page', 490),
(235, 93, 'mandlasimphiwe99@gmail.com', 'tab_switch', '2026-03-05 14:32:55', 'multi_page', 490),
(236, 93, 'mandlasimphiwe99@gmail.com', 'quiz_exit', '2026-03-05 14:34:52', 'multi_page', 494),
(237, 93, 'mandlasimphiwe99@gmail.com', 'tab_switch', '2026-03-05 14:34:52', 'multi_page', 494),
(238, 93, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 14:47:35', 'multi_page', 492),
(239, 93, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 14:47:35', 'multi_page', 492),
(240, 93, 'mandi.vava@iskool.demo', 'tab_switch', '2026-03-05 15:39:37', 'multi_page', 491),
(241, 93, 'mandi.vava@iskool.demo', 'quiz_exit', '2026-03-05 15:39:37', 'multi_page', 491),
(242, 93, 'mandi.vava@iskool.demo', 'tab_switch', '2026-03-05 15:40:07', 'multi_page', 491),
(243, 93, 'mandi.vava@iskool.demo', 'quiz_exit', '2026-03-05 15:40:07', 'multi_page', 491),
(244, 93, 'mandi.vava@iskool.demo', 'rapid_navigation', '2026-03-05 15:41:36', 'multi_page', 490),
(245, 93, 'mandi.vava@iskool.demo', 'rapid_navigation', '2026-03-05 15:41:37', 'multi_page', 489),
(246, 93, 'mandi.vava@iskool.demo', 'rapid_navigation', '2026-03-05 15:41:38', 'multi_page', 495),
(247, 93, 'mandi.vava@iskool.demo', 'rapid_navigation', '2026-03-05 15:41:40', 'multi_page', 491),
(248, 94, 'mandlasimphiwe99@gmail.com', 'quiz_exit', '2026-03-05 18:17:13', 'multi_page', 502),
(249, 94, 'mandlasimphiwe99@gmail.com', 'tab_switch', '2026-03-05 18:17:13', 'multi_page', 502),
(250, 94, 'mandlasimphiwe99@gmail.com', 'quiz_exit', '2026-03-05 18:18:16', 'multi_page', 501),
(251, 94, 'mandlasimphiwe99@gmail.com', 'tab_switch', '2026-03-05 18:18:16', 'multi_page', 501),
(252, 94, 'mandlasimphiwe99@gmail.com', 'rapid_navigation', '2026-03-05 18:18:47', 'multi_page', 498),
(253, 94, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 18:36:42', 'multi_page', 500),
(254, 94, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 18:36:42', 'multi_page', 500),
(255, 94, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 18:38:04', 'multi_page', 501),
(256, 94, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 18:38:04', 'multi_page', 501),
(257, 94, 'zinhle.mkhathini@iskool.demo', 'quiz_exit', '2026-03-05 18:39:46', 'multi_page', 499),
(258, 94, 'zinhle.mkhathini@iskool.demo', 'tab_switch', '2026-03-05 18:39:46', 'multi_page', 499);

-- --------------------------------------------------------

--
-- Table structure for table `quiz_results`
--

CREATE TABLE `quiz_results` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `score` int(11) NOT NULL,
  `total` int(11) NOT NULL,
  `time_taken` int(11) DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quiz_results`
--

INSERT INTO `quiz_results` (`id`, `user_email`, `quiz_id`, `academic_year_id`, `score`, `total`, `time_taken`, `submitted_at`) VALUES
(1, 'ayanda.gumede@iskool.demo', 1, 1, 43, 44, 60, '2025-02-19 05:06:39'),
(2, 'ayanda.khoza@iskool.demo', 1, 1, 36, 44, 60, '2025-02-24 01:50:41'),
(3, 'sanele.khuzwayo@iskool.demo', 1, 1, 31, 44, 0, '2025-02-17 09:16:45'),
(4, 'junior.khuzwayo@iskool.demo', 1, 1, 25, 44, 0, '2025-02-24 01:02:23'),
(5, 'rethabile.vilakazi@iskool.demo', 1, 1, 28, 44, 60, '2025-02-25 04:42:06'),
(6, 'tshepo.nkosi@iskool.demo', 1, 1, 23, 44, 0, '2025-02-19 14:57:18'),
(7, 'rethabile.khoza@iskool.demo', 1, 1, 23, 44, 60, '2025-02-18 23:06:37'),
(8, 'rethabile.hlongwane@iskool.demo', 1, 1, 25, 44, 0, '2025-02-26 22:17:54'),
(9, 'ofentse.ngubane@iskool.demo', 1, 1, 37, 44, 60, '2025-02-19 02:49:18'),
(10, 'siya.vilakazi@iskool.demo', 1, 1, 27, 44, 60, '2025-02-17 22:27:54'),
(11, 'bongani.mbatha@iskool.demo', 1, 1, 34, 44, 60, '2025-02-18 07:34:38'),
(12, 'rethabile.mbatha@iskool.demo', 1, 1, 25, 44, 60, '2025-02-22 02:46:41'),
(13, 'sipho.dlamini@iskool.demo', 1, 1, 39, 44, 0, '2025-02-26 16:24:42'),
(14, 'junior.mthembu@iskool.demo', 1, 1, 27, 44, 60, '2025-02-22 03:00:30'),
(15, 'mpho.hlongwane@iskool.demo', 1, 1, 43, 44, 60, '2025-02-19 05:55:24'),
(16, 'sanele.dlamini@iskool.demo', 1, 1, 36, 44, 0, '2025-02-25 15:25:18'),
(17, 'bongani.khuzwayo@iskool.demo', 1, 1, 31, 44, 0, '2025-02-24 11:35:57'),
(18, 'lungile.buthelezi@iskool.demo', 1, 1, 33, 44, 0, '2025-02-19 17:42:17'),
(19, 'athi.hlongwane@iskool.demo', 1, 1, 36, 44, 0, '2025-02-24 13:38:04'),
(20, 'andile.mthethwa@iskool.demo', 1, 1, 37, 44, 0, '2025-02-19 01:26:43'),
(21, 'lindani.sibiya@iskool.demo', 1, 1, 27, 44, 0, '2025-02-19 00:13:01'),
(22, 'ayanda.mathenjwa@iskool.demo', 1, 1, 29, 44, 0, '2025-02-19 00:36:54'),
(23, 'rethabile.dlamini@iskool.demo', 1, 1, 41, 44, 0, '2025-02-17 23:38:15'),
(24, 'lindani.vilakazi@iskool.demo', 1, 1, 26, 44, 60, '2025-02-23 13:23:03'),
(25, 'andile.mthethwa@iskool.demo', 2, 1, 19, 26, 60, '2025-02-23 23:12:50'),
(26, 'rethabile.hlongwane@iskool.demo', 2, 1, 24, 26, 60, '2025-02-18 05:48:25'),
(27, 'lwandle.mthembu@iskool.demo', 2, 1, 21, 26, 60, '2025-02-25 18:59:11'),
(28, 'ayanda.gumede@iskool.demo', 2, 1, 16, 26, 60, '2025-02-26 00:18:24'),
(29, 'mpho.hlongwane@iskool.demo', 2, 1, 15, 26, 0, '2025-02-18 02:36:03'),
(30, 'athi.hlongwane@iskool.demo', 2, 1, 21, 26, 60, '2025-02-17 18:04:51'),
(31, 'lwandle.ngubane@iskool.demo', 2, 1, 25, 26, 60, '2025-02-17 11:30:00'),
(32, 'sanele.mokoena@iskool.demo', 2, 1, 23, 26, 60, '2025-02-23 14:09:30'),
(33, 'junior.mthembu@iskool.demo', 2, 1, 20, 26, 60, '2025-02-18 23:43:16'),
(34, 'rethabile.mbatha@iskool.demo', 2, 1, 15, 26, 60, '2025-02-26 19:07:01'),
(35, 'ayanda.mathenjwa@iskool.demo', 2, 1, 22, 26, 0, '2025-02-27 07:00:06'),
(36, 'ayanda.khoza@iskool.demo', 2, 1, 15, 26, 60, '2025-02-26 01:43:19'),
(37, 'lindani.vilakazi@iskool.demo', 2, 1, 21, 26, 60, '2025-02-20 16:02:02'),
(38, 'bongani.mbatha@iskool.demo', 2, 1, 25, 26, 60, '2025-02-21 02:06:55'),
(39, 'siya.vilakazi@iskool.demo', 2, 1, 24, 26, 60, '2025-02-23 16:45:12'),
(40, 'tshepo.gumede@iskool.demo', 2, 1, 15, 26, 60, '2025-02-21 09:10:47'),
(41, 'bongani.khuzwayo@iskool.demo', 2, 1, 21, 26, 0, '2025-02-18 07:40:42'),
(42, 'tshepo.nkosi@iskool.demo', 2, 1, 22, 26, 60, '2025-02-23 01:05:58'),
(43, 'sanele.dlamini@iskool.demo', 2, 1, 22, 26, 60, '2025-02-21 17:01:43'),
(44, 'sipho.dlamini@iskool.demo', 2, 1, 21, 26, 0, '2025-02-23 22:09:11'),
(45, 'rethabile.khoza@iskool.demo', 2, 1, 20, 26, 60, '2025-02-19 18:38:59'),
(46, 'rethabile.dlamini@iskool.demo', 2, 1, 25, 26, 60, '2025-02-24 22:57:41'),
(47, 'lungile.buthelezi@iskool.demo', 2, 1, 16, 26, 0, '2025-02-22 13:30:00'),
(48, 'ofentse.ngubane@iskool.demo', 2, 1, 18, 26, 60, '2025-02-21 03:34:04'),
(49, 'junior.khuzwayo@iskool.demo', 2, 1, 16, 26, 60, '2025-02-21 00:48:27'),
(50, 'sanele.khuzwayo@iskool.demo', 2, 1, 21, 26, 60, '2025-02-21 23:36:36'),
(51, 'sipho.mathenjwa@iskool.demo', 2, 1, 15, 26, 0, '2025-02-19 02:29:13'),
(52, 'rethabile.vilakazi@iskool.demo', 2, 1, 23, 26, 60, '2025-02-23 07:46:10'),
(53, 'lindani.sibiya@iskool.demo', 3, 1, 17, 33, 60, '2025-02-13 09:11:00'),
(54, 'sanele.khuzwayo@iskool.demo', 3, 1, 27, 33, 60, '2025-02-13 12:27:32'),
(55, 'sanele.mokoena@iskool.demo', 3, 1, 25, 33, 60, '2025-02-13 14:58:32'),
(56, 'sipho.mathenjwa@iskool.demo', 3, 1, 28, 33, 60, '2025-02-20 17:09:36'),
(57, 'andile.mthethwa@iskool.demo', 3, 1, 24, 33, 60, '2025-02-21 04:33:29'),
(58, 'lungile.buthelezi@iskool.demo', 3, 1, 24, 33, 60, '2025-02-18 19:08:25'),
(59, 'mpho.hlongwane@iskool.demo', 3, 1, 25, 33, 60, '2025-02-16 18:08:11'),
(60, 'rethabile.mbatha@iskool.demo', 3, 1, 25, 33, 60, '2025-02-17 15:25:59'),
(61, 'bongani.mbatha@iskool.demo', 3, 1, 22, 33, 60, '2025-02-21 03:49:40'),
(62, 'rethabile.hlongwane@iskool.demo', 3, 1, 21, 33, 60, '2025-02-11 09:14:18'),
(63, 'tshepo.gumede@iskool.demo', 3, 1, 20, 33, 60, '2025-02-17 21:42:49'),
(64, 'rethabile.khoza@iskool.demo', 3, 1, 27, 33, 60, '2025-02-13 17:24:08'),
(65, 'lindani.vilakazi@iskool.demo', 3, 1, 23, 33, 60, '2025-02-18 23:15:50'),
(66, 'athi.hlongwane@iskool.demo', 3, 1, 26, 33, 60, '2025-02-19 02:49:37'),
(67, 'rethabile.vilakazi@iskool.demo', 3, 1, 22, 33, 60, '2025-02-18 17:33:21'),
(68, 'tshepo.nkosi@iskool.demo', 3, 1, 26, 33, 60, '2025-02-17 20:59:08'),
(69, 'rethabile.dlamini@iskool.demo', 3, 1, 27, 33, 60, '2025-02-13 06:03:32'),
(70, 'siya.vilakazi@iskool.demo', 3, 1, 26, 33, 60, '2025-02-14 15:49:57'),
(71, 'ayanda.gumede@iskool.demo', 3, 1, 24, 33, 60, '2025-02-14 14:00:38'),
(72, 'junior.mthembu@iskool.demo', 3, 1, 19, 33, 60, '2025-02-17 14:56:20'),
(73, 'sipho.dlamini@iskool.demo', 3, 1, 17, 33, 60, '2025-02-18 11:44:42'),
(74, 'ofentse.ngubane@iskool.demo', 3, 1, 32, 33, 60, '2025-02-19 16:57:00'),
(75, 'ayanda.mathenjwa@iskool.demo', 3, 1, 22, 33, 60, '2025-02-18 15:41:13'),
(76, 'ofentse.mbatha@iskool.demo', 3, 1, 30, 33, 60, '2025-02-17 09:47:31'),
(77, 'bongani.khuzwayo@iskool.demo', 3, 1, 19, 33, 60, '2025-02-21 04:48:38'),
(78, 'sanele.dlamini@iskool.demo', 3, 1, 28, 33, 60, '2025-02-16 15:51:55'),
(79, 'ayanda.khoza@iskool.demo', 3, 1, 29, 33, 60, '2025-02-16 02:45:58'),
(80, 'zandi.buthelezi@iskool.demo', 4, 1, 19, 23, 60, '2025-02-22 06:20:26'),
(81, 'nokuthula.gumede@iskool.demo', 4, 1, 14, 23, 60, '2025-02-13 23:39:00'),
(82, 'sipho.shabalala@iskool.demo', 4, 1, 21, 23, 0, '2025-02-16 02:42:53'),
(83, 'thando.nkosi@iskool.demo', 4, 1, 17, 23, 0, '2025-02-20 09:20:50'),
(84, 'refilwe.ngubane@iskool.demo', 4, 1, 21, 23, 60, '2025-02-18 14:35:16'),
(85, 'onthatile.khoza@iskool.demo', 4, 1, 19, 23, 60, '2025-02-19 02:59:14'),
(86, 'dineo.gumede@iskool.demo', 4, 1, 17, 23, 60, '2025-02-17 17:40:29'),
(87, 'tumelo.shabalala@iskool.demo', 4, 1, 17, 23, 60, '2025-02-21 05:57:10'),
(88, 'nokuthula.khoza@iskool.demo', 4, 1, 21, 23, 0, '2025-02-19 08:24:32'),
(89, 'zandi.shabalala@iskool.demo', 4, 1, 18, 23, 60, '2025-02-21 00:47:19'),
(90, 'nomvula.ndlovu@iskool.demo', 4, 1, 20, 23, 0, '2025-02-14 11:39:04'),
(91, 'lerato.sibiya@iskool.demo', 4, 1, 15, 23, 60, '2025-02-14 08:16:53'),
(92, 'zinhle.mbatha@iskool.demo', 4, 1, 20, 23, 60, '2025-02-21 11:23:29'),
(93, 'ntokozo.ndlovu@iskool.demo', 4, 1, 13, 23, 60, '2025-02-18 13:00:09'),
(94, 'athi.mathenjwa@iskool.demo', 4, 1, 14, 23, 60, '2025-02-13 16:37:31'),
(95, 'lindiwe.dlamini@iskool.demo', 4, 1, 14, 23, 60, '2025-02-21 07:23:17'),
(96, 'zandi.nkosi@iskool.demo', 4, 1, 17, 23, 60, '2025-02-22 01:30:30'),
(97, 'kgomotso.khuzwayo@iskool.demo', 4, 1, 21, 23, 60, '2025-02-17 10:59:37'),
(98, 'nomvula.mbatha@iskool.demo', 4, 1, 19, 23, 60, '2025-02-15 01:50:22'),
(99, 'amahle.hlongwane@iskool.demo', 4, 1, 21, 23, 0, '2025-02-20 10:20:21'),
(100, 'refilwe.sithole@iskool.demo', 4, 1, 12, 23, 60, '2025-02-22 03:32:18'),
(101, 'tumelo.ndlovu@iskool.demo', 4, 1, 14, 23, 60, '2025-02-15 03:21:40'),
(102, 'thandi.mhlongo@iskool.demo', 4, 1, 15, 23, 0, '2025-02-15 04:00:18'),
(103, 'naledi.ndlovu@iskool.demo', 4, 1, 14, 23, 60, '2025-02-16 05:22:51'),
(104, 'thandi.khoza@iskool.demo', 4, 1, 12, 23, 60, '2025-02-19 03:20:32'),
(105, 'siphesihle.shabalala@iskool.demo', 4, 1, 20, 23, 60, '2025-02-18 14:36:06'),
(106, 'athi.mathenjwa@iskool.demo', 5, 1, 30, 31, 60, '2025-03-04 02:22:06'),
(107, 'zandi.buthelezi@iskool.demo', 5, 1, 30, 31, 60, '2025-02-27 16:54:18'),
(108, 'refilwe.sithole@iskool.demo', 5, 1, 18, 31, 60, '2025-02-24 01:40:34'),
(109, 'zinhle.mbatha@iskool.demo', 5, 1, 19, 31, 60, '2025-03-01 04:04:38'),
(110, 'nokuthula.gumede@iskool.demo', 5, 1, 20, 31, 60, '2025-02-22 09:39:18'),
(111, 'kgomotso.mthembu@iskool.demo', 5, 1, 26, 31, 60, '2025-02-24 08:36:14'),
(112, 'ntokozo.ndlovu@iskool.demo', 5, 1, 17, 31, 60, '2025-02-26 09:37:10'),
(113, 'lindiwe.dlamini@iskool.demo', 5, 1, 23, 31, 60, '2025-02-25 00:02:41'),
(114, 'thando.nkosi@iskool.demo', 5, 1, 22, 31, 60, '2025-02-27 21:28:26'),
(115, 'kgomotso.khuzwayo@iskool.demo', 5, 1, 20, 31, 60, '2025-02-28 05:23:02'),
(116, 'thandi.khoza@iskool.demo', 5, 1, 25, 31, 60, '2025-03-01 16:01:36'),
(117, 'siphesihle.shabalala@iskool.demo', 5, 1, 28, 31, 60, '2025-02-25 20:15:24'),
(118, 'nokuthula.khoza@iskool.demo', 5, 1, 21, 31, 60, '2025-02-23 20:20:56'),
(119, 'nomvula.mhlongo@iskool.demo', 5, 1, 24, 31, 60, '2025-02-25 07:10:41'),
(120, 'sipho.shabalala@iskool.demo', 5, 1, 26, 31, 60, '2025-03-04 06:10:09'),
(121, 'dineo.gumede@iskool.demo', 5, 1, 30, 31, 60, '2025-03-02 11:18:36'),
(122, 'thandi.mhlongo@iskool.demo', 5, 1, 25, 31, 60, '2025-02-26 07:24:05'),
(123, 'nomvula.mbatha@iskool.demo', 5, 1, 29, 31, 60, '2025-02-24 03:21:23'),
(124, 'zandi.shabalala@iskool.demo', 5, 1, 22, 31, 60, '2025-03-03 19:58:37'),
(125, 'zandi.nkosi@iskool.demo', 5, 1, 20, 31, 60, '2025-02-27 14:05:11'),
(126, 'naledi.ndlovu@iskool.demo', 5, 1, 18, 31, 60, '2025-02-23 15:18:58'),
(127, 'tumelo.shabalala@iskool.demo', 5, 1, 27, 31, 60, '2025-02-22 20:00:46'),
(128, 'nomvula.ndlovu@iskool.demo', 5, 1, 20, 31, 60, '2025-02-27 02:10:20'),
(129, 'refilwe.ngubane@iskool.demo', 5, 1, 27, 31, 60, '2025-02-26 01:45:38'),
(130, 'tumelo.ndlovu@iskool.demo', 5, 1, 26, 31, 60, '2025-02-24 23:41:50'),
(131, 'boitumelo.sithole@iskool.demo', 5, 1, 17, 31, 60, '2025-02-26 15:08:40'),
(132, 'lerato.sibiya@iskool.demo', 5, 1, 30, 31, 60, '2025-02-23 06:51:29'),
(133, 'amahle.hlongwane@iskool.demo', 5, 1, 17, 31, 60, '2025-02-24 07:12:20'),
(134, 'sanele.dlamini@iskool.demo', 6, 1, 23, 26, 0, '2025-05-14 07:02:41'),
(135, 'rethabile.vilakazi@iskool.demo', 6, 1, 17, 26, 60, '2025-05-15 07:22:18'),
(136, 'rethabile.dlamini@iskool.demo', 6, 1, 17, 26, 60, '2025-05-14 15:44:59'),
(137, 'lungile.buthelezi@iskool.demo', 6, 1, 15, 26, 60, '2025-05-08 12:27:51'),
(138, 'ayanda.khoza@iskool.demo', 6, 1, 24, 26, 0, '2025-05-12 11:09:26'),
(139, 'sanele.mokoena@iskool.demo', 6, 1, 22, 26, 60, '2025-05-14 09:01:31'),
(140, 'andile.mthethwa@iskool.demo', 6, 1, 18, 26, 60, '2025-05-13 00:42:02'),
(141, 'mpho.hlongwane@iskool.demo', 6, 1, 17, 26, 0, '2025-05-07 14:33:03'),
(142, 'ayanda.mathenjwa@iskool.demo', 6, 1, 14, 26, 60, '2025-05-08 08:14:23'),
(143, 'siya.vilakazi@iskool.demo', 6, 1, 23, 26, 60, '2025-05-14 16:10:38'),
(144, 'bongani.khuzwayo@iskool.demo', 6, 1, 15, 26, 60, '2025-05-10 07:38:28'),
(145, 'tshepo.nkosi@iskool.demo', 6, 1, 16, 26, 60, '2025-05-11 05:06:09'),
(146, 'sanele.khuzwayo@iskool.demo', 6, 1, 20, 26, 60, '2025-05-11 03:11:47'),
(147, 'tshepo.gumede@iskool.demo', 6, 1, 19, 26, 60, '2025-05-14 02:34:04'),
(148, 'lwandle.ngubane@iskool.demo', 6, 1, 22, 26, 0, '2025-05-07 13:48:51'),
(149, 'athi.hlongwane@iskool.demo', 6, 1, 21, 26, 60, '2025-05-11 16:34:07'),
(150, 'rethabile.hlongwane@iskool.demo', 6, 1, 21, 26, 60, '2025-05-08 14:03:45'),
(151, 'sipho.dlamini@iskool.demo', 6, 1, 14, 26, 0, '2025-05-11 12:27:22'),
(152, 'junior.khuzwayo@iskool.demo', 6, 1, 16, 26, 0, '2025-05-14 13:07:04'),
(153, 'sipho.mathenjwa@iskool.demo', 6, 1, 25, 26, 0, '2025-05-17 08:54:28'),
(154, 'lindani.sibiya@iskool.demo', 6, 1, 18, 26, 60, '2025-05-13 11:59:45'),
(155, 'rethabile.khoza@iskool.demo', 6, 1, 17, 26, 60, '2025-05-08 00:32:38'),
(156, 'ofentse.mbatha@iskool.demo', 6, 1, 16, 26, 60, '2025-05-09 06:29:13'),
(157, 'lungile.buthelezi@iskool.demo', 7, 1, 30, 35, 0, '2025-05-29 06:44:15'),
(158, 'mpho.hlongwane@iskool.demo', 7, 1, 30, 35, 0, '2025-05-20 10:38:12'),
(159, 'sanele.dlamini@iskool.demo', 7, 1, 29, 35, 60, '2025-05-28 20:22:13'),
(160, 'bongani.mbatha@iskool.demo', 7, 1, 30, 35, 60, '2025-05-22 09:54:40'),
(161, 'bongani.khuzwayo@iskool.demo', 7, 1, 23, 35, 60, '2025-05-21 11:47:20'),
(162, 'rethabile.dlamini@iskool.demo', 7, 1, 23, 35, 60, '2025-05-21 06:20:39'),
(163, 'sanele.khuzwayo@iskool.demo', 7, 1, 28, 35, 0, '2025-05-23 01:37:40'),
(164, 'andile.mthethwa@iskool.demo', 7, 1, 19, 35, 60, '2025-05-25 00:46:21'),
(165, 'lwandle.ngubane@iskool.demo', 7, 1, 30, 35, 60, '2025-05-23 12:55:28'),
(166, 'lindani.sibiya@iskool.demo', 7, 1, 32, 35, 60, '2025-05-24 18:27:48'),
(167, 'ayanda.khoza@iskool.demo', 7, 1, 32, 35, 60, '2025-05-20 06:33:27'),
(168, 'rethabile.khoza@iskool.demo', 7, 1, 28, 35, 60, '2025-05-20 11:01:28'),
(169, 'lwandle.mthembu@iskool.demo', 7, 1, 28, 35, 0, '2025-05-28 19:02:31'),
(170, 'ofentse.mbatha@iskool.demo', 7, 1, 23, 35, 0, '2025-05-28 05:15:18'),
(171, 'lindani.vilakazi@iskool.demo', 7, 1, 23, 35, 60, '2025-05-25 14:14:14'),
(172, 'junior.mthembu@iskool.demo', 7, 1, 21, 35, 60, '2025-05-22 03:56:41'),
(173, 'athi.hlongwane@iskool.demo', 7, 1, 31, 35, 60, '2025-05-20 05:25:50'),
(174, 'ayanda.mathenjwa@iskool.demo', 7, 1, 19, 35, 60, '2025-05-25 11:47:29'),
(175, 'ofentse.ngubane@iskool.demo', 7, 1, 23, 35, 60, '2025-05-25 02:05:04'),
(176, 'sipho.mathenjwa@iskool.demo', 7, 1, 34, 35, 60, '2025-05-23 21:14:55'),
(177, 'ayanda.gumede@iskool.demo', 7, 1, 32, 35, 60, '2025-05-20 14:01:43'),
(178, 'rethabile.vilakazi@iskool.demo', 7, 1, 20, 35, 60, '2025-05-23 11:26:10'),
(179, 'rethabile.hlongwane@iskool.demo', 7, 1, 24, 35, 0, '2025-05-21 11:20:16'),
(180, 'siya.vilakazi@iskool.demo', 7, 1, 21, 35, 60, '2025-05-27 15:24:44'),
(181, 'junior.khuzwayo@iskool.demo', 7, 1, 26, 35, 60, '2025-05-27 20:47:16'),
(182, 'tshepo.gumede@iskool.demo', 7, 1, 21, 35, 60, '2025-05-21 09:54:08'),
(183, 'andile.mthethwa@iskool.demo', 8, 1, 27, 30, 120, '2025-05-17 19:36:11'),
(184, 'athi.hlongwane@iskool.demo', 8, 1, 26, 30, 60, '2025-05-21 00:05:01'),
(185, 'rethabile.dlamini@iskool.demo', 8, 1, 29, 30, 60, '2025-05-20 14:52:55'),
(186, 'junior.mthembu@iskool.demo', 8, 1, 28, 30, 120, '2025-05-20 02:18:22'),
(187, 'sanele.mokoena@iskool.demo', 8, 1, 23, 30, 60, '2025-05-16 18:13:03'),
(188, 'junior.khuzwayo@iskool.demo', 8, 1, 24, 30, 60, '2025-05-20 14:46:35'),
(189, 'ayanda.khoza@iskool.demo', 8, 1, 17, 30, 60, '2025-05-23 08:14:35'),
(190, 'sipho.dlamini@iskool.demo', 8, 1, 26, 30, 120, '2025-05-22 03:17:07'),
(191, 'rethabile.khoza@iskool.demo', 8, 1, 20, 30, 60, '2025-05-20 17:24:37'),
(192, 'ofentse.ngubane@iskool.demo', 8, 1, 19, 30, 60, '2025-05-18 15:11:04'),
(193, 'ofentse.mbatha@iskool.demo', 8, 1, 17, 30, 120, '2025-05-19 21:42:18'),
(194, 'rethabile.mbatha@iskool.demo', 8, 1, 19, 30, 60, '2025-05-19 18:50:03'),
(195, 'sanele.dlamini@iskool.demo', 8, 1, 28, 30, 60, '2025-05-19 19:59:07'),
(196, 'rethabile.hlongwane@iskool.demo', 8, 1, 24, 30, 60, '2025-05-19 08:54:29'),
(197, 'tshepo.gumede@iskool.demo', 8, 1, 23, 30, 120, '2025-05-14 05:01:37'),
(198, 'lwandle.ngubane@iskool.demo', 8, 1, 20, 30, 60, '2025-05-16 10:49:51'),
(199, 'lindani.sibiya@iskool.demo', 8, 1, 21, 30, 60, '2025-05-13 15:20:39'),
(200, 'bongani.mbatha@iskool.demo', 8, 1, 23, 30, 120, '2025-05-14 17:37:42'),
(201, 'sipho.mathenjwa@iskool.demo', 8, 1, 15, 30, 120, '2025-05-15 10:13:52'),
(202, 'rethabile.vilakazi@iskool.demo', 8, 1, 19, 30, 120, '2025-05-21 08:12:50'),
(203, 'bongani.khuzwayo@iskool.demo', 8, 1, 20, 30, 120, '2025-05-20 03:14:44'),
(204, 'siya.vilakazi@iskool.demo', 8, 1, 24, 30, 120, '2025-05-17 00:23:53'),
(205, 'mpho.hlongwane@iskool.demo', 8, 1, 15, 30, 120, '2025-05-16 21:04:51'),
(206, 'ayanda.gumede@iskool.demo', 8, 1, 29, 30, 60, '2025-05-14 21:23:36'),
(207, 'lerato.sibiya@iskool.demo', 9, 1, 30, 37, 60, '2025-05-15 16:59:12'),
(208, 'naledi.ndlovu@iskool.demo', 9, 1, 21, 37, 60, '2025-05-22 10:36:36'),
(209, 'refilwe.ngubane@iskool.demo', 9, 1, 35, 37, 60, '2025-05-21 05:36:29'),
(210, 'zandi.nkosi@iskool.demo', 9, 1, 22, 37, 60, '2025-05-21 10:04:08'),
(211, 'zandi.buthelezi@iskool.demo', 9, 1, 24, 37, 60, '2025-05-17 14:01:14'),
(212, 'boitumelo.sithole@iskool.demo', 9, 1, 30, 37, 60, '2025-05-18 05:13:54'),
(213, 'thando.nkosi@iskool.demo', 9, 1, 33, 37, 60, '2025-05-22 17:25:00'),
(214, 'zinhle.mbatha@iskool.demo', 9, 1, 26, 37, 60, '2025-05-16 06:57:57'),
(215, 'nokuthula.khoza@iskool.demo', 9, 1, 26, 37, 60, '2025-05-15 12:15:18'),
(216, 'athi.mathenjwa@iskool.demo', 9, 1, 30, 37, 60, '2025-05-18 18:52:35'),
(217, 'ntokozo.ndlovu@iskool.demo', 9, 1, 23, 37, 60, '2025-05-25 05:15:18'),
(218, 'dineo.gumede@iskool.demo', 9, 1, 34, 37, 60, '2025-05-17 05:07:10'),
(219, 'nomvula.mbatha@iskool.demo', 9, 1, 35, 37, 60, '2025-05-16 00:11:17'),
(220, 'refilwe.sithole@iskool.demo', 9, 1, 33, 37, 60, '2025-05-20 10:57:28'),
(221, 'tumelo.ndlovu@iskool.demo', 9, 1, 29, 37, 60, '2025-05-24 23:45:10'),
(222, 'nomvula.ndlovu@iskool.demo', 9, 1, 30, 37, 60, '2025-05-20 03:36:34'),
(223, 'kgomotso.mthembu@iskool.demo', 9, 1, 34, 37, 60, '2025-05-25 07:30:41'),
(224, 'onthatile.khoza@iskool.demo', 9, 1, 33, 37, 60, '2025-05-19 18:47:09'),
(225, 'precious.zulu@iskool.demo', 9, 1, 34, 37, 60, '2025-05-16 13:11:03'),
(226, 'sipho.shabalala@iskool.demo', 9, 1, 31, 37, 60, '2025-05-15 22:05:01'),
(227, 'nokuthula.gumede@iskool.demo', 9, 1, 36, 37, 60, '2025-05-22 17:50:35'),
(228, 'amahle.hlongwane@iskool.demo', 9, 1, 29, 37, 60, '2025-05-21 17:57:26'),
(229, 'lindiwe.dlamini@iskool.demo', 9, 1, 36, 37, 60, '2025-05-16 03:42:40'),
(230, 'zandi.shabalala@iskool.demo', 9, 1, 33, 37, 60, '2025-05-24 08:15:33'),
(231, 'athi.mathenjwa@iskool.demo', 10, 1, 33, 44, 60, '2025-05-08 21:02:23'),
(232, 'naledi.ndlovu@iskool.demo', 10, 1, 33, 44, 60, '2025-05-14 18:23:38'),
(233, 'kgomotso.mthembu@iskool.demo', 10, 1, 41, 44, 0, '2025-05-14 09:08:40'),
(234, 'siphesihle.shabalala@iskool.demo', 10, 1, 39, 44, 60, '2025-05-18 04:46:38'),
(235, 'nokuthula.khoza@iskool.demo', 10, 1, 34, 44, 60, '2025-05-13 14:13:58'),
(236, 'sipho.shabalala@iskool.demo', 10, 1, 40, 44, 60, '2025-05-12 22:16:04'),
(237, 'zinhle.mbatha@iskool.demo', 10, 1, 41, 44, 60, '2025-05-17 10:45:41'),
(238, 'refilwe.ngubane@iskool.demo', 10, 1, 22, 44, 60, '2025-05-09 21:42:57'),
(239, 'boitumelo.sithole@iskool.demo', 10, 1, 40, 44, 60, '2025-05-08 14:37:38'),
(240, 'thandi.khoza@iskool.demo', 10, 1, 33, 44, 60, '2025-05-09 12:31:55'),
(241, 'kgomotso.khuzwayo@iskool.demo', 10, 1, 37, 44, 60, '2025-05-13 05:09:58'),
(242, 'refilwe.sithole@iskool.demo', 10, 1, 33, 44, 60, '2025-05-11 09:58:52'),
(243, 'thando.nkosi@iskool.demo', 10, 1, 42, 44, 0, '2025-05-13 00:47:52'),
(244, 'zandi.buthelezi@iskool.demo', 10, 1, 38, 44, 60, '2025-05-10 07:51:32'),
(245, 'amahle.hlongwane@iskool.demo', 10, 1, 38, 44, 60, '2025-05-15 09:42:27'),
(246, 'zandi.shabalala@iskool.demo', 10, 1, 33, 44, 0, '2025-05-11 07:27:50'),
(247, 'lerato.sibiya@iskool.demo', 10, 1, 41, 44, 60, '2025-05-16 04:46:49'),
(248, 'onthatile.khoza@iskool.demo', 10, 1, 42, 44, 60, '2025-05-14 22:44:17'),
(249, 'tumelo.shabalala@iskool.demo', 10, 1, 33, 44, 60, '2025-05-08 15:09:39'),
(250, 'tumelo.ndlovu@iskool.demo', 10, 1, 41, 44, 0, '2025-05-14 03:36:06'),
(251, 'zandi.nkosi@iskool.demo', 10, 1, 26, 44, 60, '2025-05-11 00:06:28'),
(252, 'thandi.mhlongo@iskool.demo', 10, 1, 43, 44, 60, '2025-05-13 10:59:00'),
(253, 'nomvula.ndlovu@iskool.demo', 10, 1, 33, 44, 0, '2025-05-09 19:19:10'),
(254, 'nomvula.mhlongo@iskool.demo', 11, 1, 18, 32, 60, '2025-05-13 05:18:44'),
(255, 'refilwe.ngubane@iskool.demo', 11, 1, 28, 32, 60, '2025-05-18 22:42:54'),
(256, 'precious.zulu@iskool.demo', 11, 1, 26, 32, 60, '2025-05-20 08:37:03'),
(257, 'sipho.shabalala@iskool.demo', 11, 1, 23, 32, 60, '2025-05-13 14:31:09'),
(258, 'onthatile.khoza@iskool.demo', 11, 1, 28, 32, 60, '2025-05-17 12:27:21'),
(259, 'zandi.nkosi@iskool.demo', 11, 1, 24, 32, 60, '2025-05-19 01:41:07'),
(260, 'zandi.shabalala@iskool.demo', 11, 1, 27, 32, 60, '2025-05-21 01:40:14'),
(261, 'tumelo.shabalala@iskool.demo', 11, 1, 30, 32, 60, '2025-05-13 19:19:18'),
(262, 'refilwe.sithole@iskool.demo', 11, 1, 23, 32, 60, '2025-05-13 02:38:05'),
(263, 'nokuthula.gumede@iskool.demo', 11, 1, 20, 32, 60, '2025-05-15 15:41:52'),
(264, 'siphesihle.shabalala@iskool.demo', 11, 1, 24, 32, 60, '2025-05-14 21:38:36'),
(265, 'nokuthula.khoza@iskool.demo', 11, 1, 28, 32, 60, '2025-05-21 09:22:59'),
(266, 'lerato.sibiya@iskool.demo', 11, 1, 24, 32, 60, '2025-05-19 04:23:33'),
(267, 'thandi.mhlongo@iskool.demo', 11, 1, 24, 32, 120, '2025-05-18 08:50:59'),
(268, 'thandi.khoza@iskool.demo', 11, 1, 27, 32, 60, '2025-05-21 08:59:27'),
(269, 'naledi.ndlovu@iskool.demo', 11, 1, 28, 32, 60, '2025-05-12 13:05:22'),
(270, 'nomvula.ndlovu@iskool.demo', 11, 1, 25, 32, 60, '2025-05-21 19:56:15'),
(271, 'thando.nkosi@iskool.demo', 11, 1, 19, 32, 60, '2025-05-14 20:41:03'),
(272, 'kgomotso.mthembu@iskool.demo', 11, 1, 25, 32, 60, '2025-05-14 11:46:41'),
(273, 'dineo.gumede@iskool.demo', 11, 1, 27, 32, 60, '2025-05-18 08:08:33'),
(274, 'amahle.hlongwane@iskool.demo', 11, 1, 20, 32, 60, '2025-05-22 03:22:23'),
(275, 'kgomotso.khuzwayo@iskool.demo', 11, 1, 26, 32, 60, '2025-05-20 22:37:26'),
(276, 'boitumelo.sithole@iskool.demo', 11, 1, 23, 32, 60, '2025-05-21 08:37:18'),
(277, 'nomvula.mbatha@iskool.demo', 11, 1, 30, 32, 60, '2025-05-14 20:47:20'),
(278, 'tumelo.ndlovu@iskool.demo', 11, 1, 21, 32, 60, '2025-05-19 07:45:16'),
(279, 'ntokozo.ndlovu@iskool.demo', 11, 1, 22, 32, 60, '2025-05-16 09:28:20'),
(280, 'mpho.hlongwane@iskool.demo', 12, 1, 19, 25, 60, '2025-08-07 14:26:33'),
(281, 'athi.hlongwane@iskool.demo', 12, 1, 22, 25, 60, '2025-08-14 00:52:13'),
(282, 'rethabile.hlongwane@iskool.demo', 12, 1, 15, 25, 60, '2025-08-13 05:00:51'),
(283, 'tshepo.gumede@iskool.demo', 12, 1, 16, 25, 60, '2025-08-13 23:31:40'),
(284, 'rethabile.khoza@iskool.demo', 12, 1, 19, 25, 60, '2025-08-07 10:41:12'),
(285, 'lungile.buthelezi@iskool.demo', 12, 1, 16, 25, 60, '2025-08-10 01:24:14'),
(286, 'junior.khuzwayo@iskool.demo', 12, 1, 25, 25, 60, '2025-08-10 21:08:29'),
(287, 'lindani.sibiya@iskool.demo', 12, 1, 20, 25, 60, '2025-08-15 17:54:26'),
(288, 'ayanda.khoza@iskool.demo', 12, 1, 13, 25, 60, '2025-08-13 12:14:48'),
(289, 'ayanda.mathenjwa@iskool.demo', 12, 1, 16, 25, 60, '2025-08-09 08:59:19'),
(290, 'lwandle.ngubane@iskool.demo', 12, 1, 18, 25, 60, '2025-08-09 09:52:52'),
(291, 'lwandle.mthembu@iskool.demo', 12, 1, 22, 25, 60, '2025-08-10 22:45:51'),
(292, 'andile.mthethwa@iskool.demo', 12, 1, 23, 25, 60, '2025-08-12 00:56:31'),
(293, 'bongani.khuzwayo@iskool.demo', 12, 1, 19, 25, 60, '2025-08-07 19:23:46'),
(294, 'sanele.mokoena@iskool.demo', 12, 1, 16, 25, 60, '2025-08-16 09:44:34'),
(295, 'sanele.dlamini@iskool.demo', 12, 1, 16, 25, 60, '2025-08-14 14:29:46'),
(296, 'sanele.khuzwayo@iskool.demo', 12, 1, 21, 25, 60, '2025-08-15 20:26:03'),
(297, 'rethabile.vilakazi@iskool.demo', 12, 1, 23, 25, 60, '2025-08-09 02:47:49'),
(298, 'siya.vilakazi@iskool.demo', 12, 1, 20, 25, 60, '2025-08-08 00:57:53'),
(299, 'rethabile.mbatha@iskool.demo', 12, 1, 22, 25, 60, '2025-08-08 17:35:25'),
(300, 'rethabile.dlamini@iskool.demo', 12, 1, 19, 25, 60, '2025-08-15 11:38:14'),
(301, 'ofentse.mbatha@iskool.demo', 12, 1, 22, 25, 60, '2025-08-11 16:37:46'),
(302, 'ayanda.gumede@iskool.demo', 12, 1, 15, 25, 60, '2025-08-10 01:31:37'),
(303, 'rethabile.dlamini@iskool.demo', 13, 1, 25, 31, 60, '2025-08-22 09:13:15'),
(304, 'ofentse.mbatha@iskool.demo', 13, 1, 20, 31, 60, '2025-08-19 22:38:26'),
(305, 'sipho.mathenjwa@iskool.demo', 13, 1, 24, 31, 60, '2025-08-24 03:10:22'),
(306, 'sipho.dlamini@iskool.demo', 13, 1, 29, 31, 60, '2025-08-23 07:33:31'),
(307, 'siya.vilakazi@iskool.demo', 13, 1, 28, 31, 60, '2025-08-24 06:18:52'),
(308, 'rethabile.mbatha@iskool.demo', 13, 1, 29, 31, 60, '2025-08-19 00:42:02'),
(309, 'andile.mthethwa@iskool.demo', 13, 1, 22, 31, 0, '2025-08-21 21:46:25'),
(310, 'lindani.sibiya@iskool.demo', 13, 1, 29, 31, 60, '2025-08-18 20:56:34'),
(311, 'junior.khuzwayo@iskool.demo', 13, 1, 24, 31, 60, '2025-08-25 04:54:48'),
(312, 'athi.hlongwane@iskool.demo', 13, 1, 17, 31, 60, '2025-08-26 19:59:37'),
(313, 'rethabile.khoza@iskool.demo', 13, 1, 30, 31, 60, '2025-08-23 07:53:24'),
(314, 'rethabile.vilakazi@iskool.demo', 13, 1, 29, 31, 60, '2025-08-26 21:12:47'),
(315, 'lwandle.ngubane@iskool.demo', 13, 1, 22, 31, 60, '2025-08-27 08:18:30'),
(316, 'lwandle.mthembu@iskool.demo', 13, 1, 21, 31, 60, '2025-08-26 00:26:24'),
(317, 'sanele.mokoena@iskool.demo', 13, 1, 25, 31, 60, '2025-08-22 05:17:05'),
(318, 'bongani.mbatha@iskool.demo', 13, 1, 24, 31, 60, '2025-08-19 05:16:55'),
(319, 'mpho.hlongwane@iskool.demo', 13, 1, 29, 31, 60, '2025-08-21 08:04:41'),
(320, 'junior.mthembu@iskool.demo', 13, 1, 30, 31, 60, '2025-08-19 02:50:58'),
(321, 'tshepo.gumede@iskool.demo', 13, 1, 20, 31, 60, '2025-08-23 04:58:01'),
(322, 'ayanda.gumede@iskool.demo', 13, 1, 29, 31, 60, '2025-08-25 12:07:57'),
(323, 'ofentse.ngubane@iskool.demo', 13, 1, 26, 31, 60, '2025-08-27 10:46:17'),
(324, 'ayanda.mathenjwa@iskool.demo', 13, 1, 25, 31, 60, '2025-08-18 12:12:04'),
(325, 'ayanda.khoza@iskool.demo', 13, 1, 25, 31, 60, '2025-08-20 23:01:40'),
(326, 'bongani.khuzwayo@iskool.demo', 13, 1, 17, 31, 0, '2025-08-25 12:14:21'),
(327, 'lungile.buthelezi@iskool.demo', 13, 1, 30, 31, 60, '2025-08-24 18:18:33'),
(328, 'sipho.mathenjwa@iskool.demo', 14, 1, 22, 35, 120, '2025-08-28 15:12:53'),
(329, 'lindani.sibiya@iskool.demo', 14, 1, 20, 35, 120, '2025-08-25 06:25:10'),
(330, 'lungile.buthelezi@iskool.demo', 14, 1, 21, 35, 120, '2025-08-24 23:34:27'),
(331, 'rethabile.hlongwane@iskool.demo', 14, 1, 27, 35, 120, '2025-08-21 22:39:51'),
(332, 'bongani.khuzwayo@iskool.demo', 14, 1, 27, 35, 60, '2025-08-20 00:04:35'),
(333, 'andile.mthethwa@iskool.demo', 14, 1, 30, 35, 120, '2025-08-28 21:44:50'),
(334, 'sanele.dlamini@iskool.demo', 14, 1, 28, 35, 180, '2025-08-19 11:18:08'),
(335, 'lwandle.ngubane@iskool.demo', 14, 1, 22, 35, 60, '2025-08-24 03:53:54'),
(336, 'sipho.dlamini@iskool.demo', 14, 1, 23, 35, 120, '2025-08-24 12:14:26'),
(337, 'sanele.khuzwayo@iskool.demo', 14, 1, 22, 35, 60, '2025-08-25 08:13:35'),
(338, 'rethabile.khoza@iskool.demo', 14, 1, 23, 35, 120, '2025-08-20 22:49:21'),
(339, 'ayanda.gumede@iskool.demo', 14, 1, 20, 35, 120, '2025-08-20 11:09:12'),
(340, 'ofentse.mbatha@iskool.demo', 14, 1, 19, 35, 60, '2025-08-21 14:48:28'),
(341, 'tshepo.gumede@iskool.demo', 14, 1, 27, 35, 120, '2025-08-25 11:18:38'),
(342, 'ofentse.ngubane@iskool.demo', 14, 1, 31, 35, 120, '2025-08-20 00:05:41'),
(343, 'lindani.vilakazi@iskool.demo', 14, 1, 20, 35, 180, '2025-08-24 23:55:44'),
(344, 'tshepo.nkosi@iskool.demo', 14, 1, 29, 35, 120, '2025-08-27 04:24:47'),
(345, 'ayanda.khoza@iskool.demo', 14, 1, 26, 35, 120, '2025-08-27 03:18:18'),
(346, 'siya.vilakazi@iskool.demo', 14, 1, 32, 35, 120, '2025-08-27 03:59:06'),
(347, 'lwandle.mthembu@iskool.demo', 14, 1, 19, 35, 60, '2025-08-20 21:00:45'),
(348, 'sanele.mokoena@iskool.demo', 14, 1, 30, 35, 120, '2025-08-28 12:38:43'),
(349, 'rethabile.vilakazi@iskool.demo', 14, 1, 20, 35, 120, '2025-08-26 02:34:20'),
(350, 'rethabile.mbatha@iskool.demo', 14, 1, 33, 35, 60, '2025-08-24 15:23:03'),
(351, 'mpho.hlongwane@iskool.demo', 14, 1, 26, 35, 180, '2025-08-26 01:50:57'),
(352, 'bongani.mbatha@iskool.demo', 14, 1, 30, 35, 120, '2025-08-21 23:09:47'),
(353, 'junior.khuzwayo@iskool.demo', 14, 1, 19, 35, 60, '2025-08-28 23:41:13'),
(354, 'junior.mthembu@iskool.demo', 14, 1, 24, 35, 180, '2025-08-25 08:23:41'),
(355, 'rethabile.dlamini@iskool.demo', 14, 1, 28, 35, 120, '2025-08-21 06:11:46'),
(356, 'siphesihle.shabalala@iskool.demo', 15, 1, 21, 31, 60, '2025-08-25 08:33:00'),
(357, 'kgomotso.mthembu@iskool.demo', 15, 1, 15, 31, 60, '2025-08-19 21:09:13'),
(358, 'sipho.shabalala@iskool.demo', 15, 1, 18, 31, 60, '2025-08-20 19:34:01'),
(359, 'lerato.sibiya@iskool.demo', 15, 1, 17, 31, 60, '2025-08-20 06:41:23'),
(360, 'refilwe.ngubane@iskool.demo', 15, 1, 19, 31, 60, '2025-08-26 10:04:41'),
(361, 'zinhle.mbatha@iskool.demo', 15, 1, 17, 31, 60, '2025-08-19 14:21:19'),
(362, 'nomvula.mhlongo@iskool.demo', 15, 1, 23, 31, 60, '2025-08-23 23:45:11'),
(363, 'nokuthula.gumede@iskool.demo', 15, 1, 19, 31, 60, '2025-08-20 21:21:03'),
(364, 'dineo.gumede@iskool.demo', 15, 1, 30, 31, 60, '2025-08-27 21:45:30'),
(365, 'tumelo.ndlovu@iskool.demo', 15, 1, 24, 31, 60, '2025-08-20 05:38:26'),
(366, 'lindiwe.dlamini@iskool.demo', 15, 1, 26, 31, 60, '2025-08-22 17:58:46'),
(367, 'thando.nkosi@iskool.demo', 15, 1, 17, 31, 60, '2025-08-24 23:05:15'),
(368, 'nomvula.ndlovu@iskool.demo', 15, 1, 21, 31, 60, '2025-08-18 18:21:31'),
(369, 'zandi.nkosi@iskool.demo', 15, 1, 18, 31, 60, '2025-08-20 05:19:22'),
(370, 'ntokozo.ndlovu@iskool.demo', 15, 1, 22, 31, 60, '2025-08-22 15:43:36'),
(371, 'refilwe.sithole@iskool.demo', 15, 1, 24, 31, 60, '2025-08-19 21:35:48'),
(372, 'thandi.khoza@iskool.demo', 15, 1, 20, 31, 60, '2025-08-24 13:36:31'),
(373, 'zandi.buthelezi@iskool.demo', 15, 1, 20, 31, 60, '2025-08-25 12:33:12'),
(374, 'precious.zulu@iskool.demo', 15, 1, 24, 31, 60, '2025-08-26 18:57:21'),
(375, 'onthatile.khoza@iskool.demo', 15, 1, 22, 31, 60, '2025-08-20 18:57:27'),
(376, 'boitumelo.sithole@iskool.demo', 15, 1, 25, 31, 60, '2025-08-20 17:00:41'),
(377, 'tumelo.shabalala@iskool.demo', 15, 1, 28, 31, 60, '2025-08-18 13:51:30'),
(378, 'zandi.shabalala@iskool.demo', 15, 1, 20, 31, 60, '2025-08-27 16:40:39'),
(379, 'kgomotso.khuzwayo@iskool.demo', 15, 1, 18, 31, 60, '2025-08-27 03:57:04'),
(380, 'nokuthula.khoza@iskool.demo', 15, 1, 18, 31, 60, '2025-08-20 10:30:54'),
(381, 'naledi.ndlovu@iskool.demo', 15, 1, 19, 31, 60, '2025-08-27 20:42:59'),
(382, 'thandi.mhlongo@iskool.demo', 15, 1, 22, 31, 60, '2025-08-27 19:12:05'),
(383, 'nomvula.mbatha@iskool.demo', 15, 1, 26, 31, 60, '2025-08-23 10:01:59'),
(384, 'amahle.hlongwane@iskool.demo', 16, 1, 16, 29, 180, '2025-08-16 22:14:21'),
(385, 'thandi.mhlongo@iskool.demo', 16, 1, 21, 29, 120, '2025-08-15 10:11:56'),
(386, 'nokuthula.gumede@iskool.demo', 16, 1, 25, 29, 120, '2025-08-17 09:34:16'),
(387, 'zandi.nkosi@iskool.demo', 16, 1, 22, 29, 120, '2025-08-21 03:41:35'),
(388, 'boitumelo.sithole@iskool.demo', 16, 1, 22, 29, 120, '2025-08-23 09:50:03'),
(389, 'onthatile.khoza@iskool.demo', 16, 1, 22, 29, 120, '2025-08-19 11:52:51'),
(390, 'ntokozo.ndlovu@iskool.demo', 16, 1, 28, 29, 120, '2025-08-17 00:17:59'),
(391, 'kgomotso.mthembu@iskool.demo', 16, 1, 25, 29, 120, '2025-08-21 03:12:03'),
(392, 'zandi.shabalala@iskool.demo', 16, 1, 16, 29, 120, '2025-08-20 08:18:16'),
(393, 'lindiwe.dlamini@iskool.demo', 16, 1, 19, 29, 60, '2025-08-16 14:09:27'),
(394, 'nokuthula.khoza@iskool.demo', 16, 1, 19, 29, 120, '2025-08-24 04:24:45'),
(395, 'nomvula.ndlovu@iskool.demo', 16, 1, 23, 29, 120, '2025-08-17 21:47:07'),
(396, 'tumelo.shabalala@iskool.demo', 16, 1, 19, 29, 120, '2025-08-18 11:13:29'),
(397, 'thando.nkosi@iskool.demo', 16, 1, 17, 29, 60, '2025-08-19 08:40:01'),
(398, 'zandi.buthelezi@iskool.demo', 16, 1, 25, 29, 120, '2025-08-16 08:23:25'),
(399, 'athi.mathenjwa@iskool.demo', 16, 1, 28, 29, 120, '2025-08-22 15:30:46'),
(400, 'nomvula.mhlongo@iskool.demo', 16, 1, 27, 29, 120, '2025-08-21 14:35:04'),
(401, 'kgomotso.khuzwayo@iskool.demo', 16, 1, 28, 29, 120, '2025-08-15 19:31:16'),
(402, 'precious.zulu@iskool.demo', 16, 1, 17, 29, 180, '2025-08-21 08:48:41'),
(403, 'tumelo.ndlovu@iskool.demo', 16, 1, 24, 29, 120, '2025-08-22 11:19:20'),
(404, 'refilwe.sithole@iskool.demo', 16, 1, 26, 29, 120, '2025-08-15 02:50:12'),
(405, 'sipho.shabalala@iskool.demo', 16, 1, 22, 29, 120, '2025-08-16 17:42:50'),
(406, 'refilwe.ngubane@iskool.demo', 16, 1, 19, 29, 120, '2025-08-20 13:39:49'),
(407, 'lerato.sibiya@iskool.demo', 16, 1, 24, 29, 120, '2025-08-18 04:11:37'),
(408, 'siphesihle.shabalala@iskool.demo', 16, 1, 26, 29, 60, '2025-08-14 14:22:20'),
(409, 'zinhle.mbatha@iskool.demo', 16, 1, 27, 29, 120, '2025-08-18 21:49:19'),
(410, 'nomvula.mbatha@iskool.demo', 16, 1, 23, 29, 60, '2025-08-23 19:39:01'),
(411, 'dineo.gumede@iskool.demo', 16, 1, 25, 29, 60, '2025-08-15 20:43:21'),
(412, 'sipho.shabalala@iskool.demo', 17, 1, 42, 62, 60, '2025-03-16 10:24:00'),
(413, 'athi.mathenjwa@iskool.demo', 17, 1, 53, 62, 60, '2025-03-18 10:20:00'),
(414, 'thando.nkosi@iskool.demo', 17, 1, 43, 62, 60, '2025-03-19 10:59:00'),
(415, 'kgomotso.khuzwayo@iskool.demo', 17, 1, 51, 62, 60, '2025-03-22 10:30:00'),
(416, 'zandi.buthelezi@iskool.demo', 17, 1, 47, 62, 60, '2025-03-26 10:43:00'),
(417, 'naledi.ndlovu@iskool.demo', 17, 1, 49, 62, 60, '2025-03-20 10:21:00'),
(418, 'thandi.mhlongo@iskool.demo', 17, 1, 52, 62, 60, '2025-03-16 10:17:00'),
(419, 'lindiwe.dlamini@iskool.demo', 17, 1, 41, 62, 60, '2025-03-20 10:37:00'),
(420, 'kgomotso.mthembu@iskool.demo', 17, 1, 48, 62, 60, '2025-03-18 10:04:00'),
(421, 'onthatile.khoza@iskool.demo', 17, 1, 55, 62, 60, '2025-03-24 10:18:00'),
(422, 'tumelo.ndlovu@iskool.demo', 17, 1, 54, 62, 60, '2025-03-24 10:01:00'),
(423, 'refilwe.ngubane@iskool.demo', 17, 1, 45, 62, 60, '2025-03-28 10:46:00'),
(424, 'nomvula.ndlovu@iskool.demo', 17, 1, 49, 62, 60, '2025-03-21 10:26:00'),
(425, 'lerato.sibiya@iskool.demo', 17, 1, 50, 62, 60, '2025-03-18 10:57:00'),
(426, 'zinhle.mbatha@iskool.demo', 17, 1, 41, 62, 60, '2025-03-23 10:36:00'),
(427, 'nomvula.mbatha@iskool.demo', 17, 1, 43, 62, 60, '2025-03-19 10:10:00'),
(428, 'precious.zulu@iskool.demo', 17, 1, 53, 62, 60, '2025-03-23 10:07:00'),
(429, 'siphesihle.shabalala@iskool.demo', 17, 1, 55, 62, 60, '2025-03-28 10:58:00'),
(430, 'amahle.hlongwane@iskool.demo', 17, 1, 54, 62, 60, '2025-03-27 10:21:00'),
(431, 'boitumelo.sithole@iskool.demo', 17, 1, 50, 62, 60, '2025-03-24 10:02:00'),
(432, 'nokuthula.khoza@iskool.demo', 17, 1, 47, 62, 60, '2025-03-26 10:47:00'),
(433, 'zandi.nkosi@iskool.demo', 17, 1, 56, 62, 60, '2025-03-19 10:35:00'),
(434, 'ntokozo.ndlovu@iskool.demo', 17, 1, 52, 62, 60, '2025-03-17 10:46:00'),
(435, 'nomvula.mhlongo@iskool.demo', 17, 1, 50, 62, 60, '2025-03-25 10:32:00'),
(436, 'thandi.khoza@iskool.demo', 17, 1, 47, 62, 60, '2025-03-23 10:54:00'),
(437, 'nokuthula.gumede@iskool.demo', 17, 1, 50, 62, 60, '2025-03-27 10:27:00'),
(438, 'refilwe.sithole@iskool.demo', 17, 1, 46, 62, 60, '2025-03-16 10:00:00'),
(439, 'dineo.gumede@iskool.demo', 17, 1, 52, 62, 60, '2025-03-28 10:00:00'),
(440, 'tumelo.shabalala@iskool.demo', 17, 1, 43, 62, 60, '2025-03-18 10:59:00'),
(441, 'zandi.shabalala@iskool.demo', 17, 1, 43, 62, 60, '2025-03-23 10:13:00'),
(442, 'extra0_thulani.mthembu@iskool.demo', 17, 1, 43, 62, 60, '2025-03-23 10:15:00'),
(443, 'extra1_siyabonga.dlamini@iskool.demo', 17, 1, 55, 62, 60, '2025-03-27 10:45:00'),
(444, 'extra2_nkosinathi.zungu@iskool.demo', 17, 1, 55, 62, 60, '2025-03-20 10:10:00'),
(445, 'extra3_mthokozisi.mkhize@iskool.demo', 17, 1, 51, 62, 60, '2025-03-21 10:42:00'),
(446, 'extra4_sandile.nene@iskool.demo', 17, 1, 48, 62, 60, '2025-03-18 10:21:00'),
(447, 'extra5_mzwandile.gumede@iskool.demo', 17, 1, 47, 62, 60, '2025-03-27 10:56:00'),
(448, 'extra6_bhekumuzi.shabalala@iskool.demo', 17, 1, 49, 62, 60, '2025-03-19 10:39:00'),
(449, 'extra7_mandla.mthethwa@iskool.demo', 17, 1, 50, 62, 60, '2025-03-16 10:28:00'),
(450, 'extra8_sifiso.nkosi@iskool.demo', 17, 1, 57, 62, 60, '2025-03-28 10:04:00'),
(451, 'extra9_xolani.khoza@iskool.demo', 17, 1, 48, 62, 60, '2025-03-24 10:59:00'),
(452, 'extra10_mlungisi.sibiya@iskool.demo', 17, 1, 54, 62, 60, '2025-03-24 10:12:00'),
(453, 'extra11_dumisani.ndlovu@iskool.demo', 17, 1, 41, 62, 60, '2025-03-24 10:06:00'),
(454, 'extra12_bonginkosi.buthelezi@iskool.demo', 17, 1, 48, 62, 60, '2025-03-26 10:45:00'),
(455, 'extra13_siphelele.hlongwane@iskool.demo', 17, 1, 46, 62, 60, '2025-03-25 10:09:00'),
(456, 'extra14_mvelo.mbatha@iskool.demo', 17, 1, 48, 62, 60, '2025-03-22 10:57:00'),
(457, 'sipho.shabalala@iskool.demo', 18, 1, 41, 55, 60, '2025-03-24 10:34:00'),
(458, 'athi.mathenjwa@iskool.demo', 18, 1, 47, 55, 60, '2025-03-17 10:56:00'),
(459, 'thando.nkosi@iskool.demo', 18, 1, 43, 55, 60, '2025-03-28 10:02:00'),
(460, 'kgomotso.khuzwayo@iskool.demo', 18, 1, 39, 55, 60, '2025-03-28 10:36:00'),
(461, 'zandi.buthelezi@iskool.demo', 18, 1, 40, 55, 60, '2025-03-23 10:12:00'),
(462, 'naledi.ndlovu@iskool.demo', 18, 1, 44, 55, 60, '2025-03-25 10:11:00'),
(463, 'thandi.mhlongo@iskool.demo', 18, 1, 42, 55, 60, '2025-03-26 10:41:00'),
(464, 'lindiwe.dlamini@iskool.demo', 18, 1, 36, 55, 60, '2025-03-22 10:48:00'),
(465, 'kgomotso.mthembu@iskool.demo', 18, 1, 36, 55, 60, '2025-03-16 10:52:00'),
(466, 'onthatile.khoza@iskool.demo', 18, 1, 46, 55, 60, '2025-03-19 10:36:00'),
(467, 'tumelo.ndlovu@iskool.demo', 18, 1, 38, 55, 60, '2025-03-21 10:51:00'),
(468, 'refilwe.ngubane@iskool.demo', 18, 1, 40, 55, 60, '2025-03-21 10:20:00'),
(469, 'nomvula.ndlovu@iskool.demo', 18, 1, 36, 55, 60, '2025-03-16 10:10:00'),
(470, 'lerato.sibiya@iskool.demo', 18, 1, 48, 55, 60, '2025-03-23 10:00:00'),
(471, 'zinhle.mbatha@iskool.demo', 18, 1, 50, 55, 60, '2025-03-17 10:29:00'),
(472, 'nomvula.mbatha@iskool.demo', 18, 1, 42, 55, 60, '2025-03-16 10:54:00'),
(473, 'precious.zulu@iskool.demo', 18, 1, 42, 55, 60, '2025-03-24 10:35:00'),
(474, 'siphesihle.shabalala@iskool.demo', 18, 1, 48, 55, 60, '2025-03-25 10:46:00'),
(475, 'amahle.hlongwane@iskool.demo', 18, 1, 48, 55, 60, '2025-03-22 10:34:00'),
(476, 'boitumelo.sithole@iskool.demo', 18, 1, 42, 55, 60, '2025-03-25 10:39:00'),
(477, 'nokuthula.khoza@iskool.demo', 18, 1, 40, 55, 60, '2025-03-21 10:55:00'),
(478, 'zandi.nkosi@iskool.demo', 18, 1, 47, 55, 60, '2025-03-16 10:56:00'),
(479, 'ntokozo.ndlovu@iskool.demo', 18, 1, 40, 55, 60, '2025-03-18 10:36:00'),
(480, 'nomvula.mhlongo@iskool.demo', 18, 1, 48, 55, 60, '2025-03-23 10:10:00'),
(481, 'thandi.khoza@iskool.demo', 18, 1, 40, 55, 60, '2025-03-23 10:57:00'),
(482, 'nokuthula.gumede@iskool.demo', 18, 1, 45, 55, 60, '2025-03-26 10:17:00'),
(483, 'refilwe.sithole@iskool.demo', 18, 1, 37, 55, 60, '2025-03-25 10:02:00'),
(484, 'dineo.gumede@iskool.demo', 18, 1, 48, 55, 60, '2025-03-19 10:38:00'),
(485, 'tumelo.shabalala@iskool.demo', 18, 1, 42, 55, 60, '2025-03-16 10:28:00'),
(486, 'zandi.shabalala@iskool.demo', 18, 1, 40, 55, 60, '2025-03-25 10:18:00'),
(487, 'extra0_thulani.mthembu@iskool.demo', 18, 1, 37, 55, 60, '2025-03-19 10:06:00'),
(488, 'extra1_siyabonga.dlamini@iskool.demo', 18, 1, 48, 55, 60, '2025-03-28 10:59:00'),
(489, 'extra2_nkosinathi.zungu@iskool.demo', 18, 1, 39, 55, 60, '2025-03-16 10:47:00'),
(490, 'extra3_mthokozisi.mkhize@iskool.demo', 18, 1, 36, 55, 60, '2025-03-24 10:37:00'),
(491, 'extra4_sandile.nene@iskool.demo', 18, 1, 37, 55, 60, '2025-03-28 10:32:00'),
(492, 'extra5_mzwandile.gumede@iskool.demo', 18, 1, 50, 55, 60, '2025-03-21 10:35:00'),
(493, 'extra6_bhekumuzi.shabalala@iskool.demo', 18, 1, 41, 55, 60, '2025-03-21 10:40:00'),
(494, 'extra7_mandla.mthethwa@iskool.demo', 18, 1, 48, 55, 60, '2025-03-18 10:23:00'),
(495, 'extra8_sifiso.nkosi@iskool.demo', 18, 1, 42, 55, 60, '2025-03-19 10:07:00'),
(496, 'extra9_xolani.khoza@iskool.demo', 18, 1, 47, 55, 60, '2025-03-19 10:33:00'),
(497, 'extra10_mlungisi.sibiya@iskool.demo', 18, 1, 48, 55, 60, '2025-03-26 10:37:00'),
(498, 'extra11_dumisani.ndlovu@iskool.demo', 18, 1, 47, 55, 60, '2025-03-22 10:00:00'),
(499, 'extra12_bonginkosi.buthelezi@iskool.demo', 18, 1, 48, 55, 60, '2025-03-17 10:43:00'),
(500, 'extra13_siphelele.hlongwane@iskool.demo', 18, 1, 47, 55, 60, '2025-03-27 10:49:00'),
(501, 'extra14_mvelo.mbatha@iskool.demo', 18, 1, 47, 55, 60, '2025-03-18 10:57:00'),
(502, 'sipho.shabalala@iskool.demo', 19, 1, 51, 65, 120, '2025-03-18 10:14:00'),
(503, 'athi.mathenjwa@iskool.demo', 19, 1, 47, 65, 60, '2025-03-19 10:27:00'),
(504, 'thando.nkosi@iskool.demo', 19, 1, 58, 65, 60, '2025-03-24 10:45:00'),
(505, 'kgomotso.khuzwayo@iskool.demo', 19, 1, 43, 65, 120, '2025-03-20 10:16:00'),
(506, 'zandi.buthelezi@iskool.demo', 19, 1, 46, 65, 60, '2025-03-27 10:04:00'),
(507, 'naledi.ndlovu@iskool.demo', 19, 1, 57, 65, 60, '2025-03-27 10:44:00'),
(508, 'thandi.mhlongo@iskool.demo', 19, 1, 44, 65, 60, '2025-03-17 10:00:00'),
(509, 'lindiwe.dlamini@iskool.demo', 19, 1, 54, 65, 60, '2025-03-16 10:39:00'),
(510, 'kgomotso.mthembu@iskool.demo', 19, 1, 44, 65, 60, '2025-03-18 10:58:00'),
(511, 'onthatile.khoza@iskool.demo', 19, 1, 52, 65, 120, '2025-03-25 10:12:00'),
(512, 'tumelo.ndlovu@iskool.demo', 19, 1, 57, 65, 60, '2025-03-21 10:44:00'),
(513, 'refilwe.ngubane@iskool.demo', 19, 1, 57, 65, 60, '2025-03-17 10:10:00'),
(514, 'nomvula.ndlovu@iskool.demo', 19, 1, 57, 65, 60, '2025-03-27 10:28:00'),
(515, 'lerato.sibiya@iskool.demo', 19, 1, 57, 65, 60, '2025-03-19 10:50:00'),
(516, 'zinhle.mbatha@iskool.demo', 19, 1, 48, 65, 60, '2025-03-16 10:39:00'),
(517, 'nomvula.mbatha@iskool.demo', 19, 1, 49, 65, 60, '2025-03-28 10:38:00'),
(518, 'precious.zulu@iskool.demo', 19, 1, 53, 65, 60, '2025-03-26 10:24:00'),
(519, 'siphesihle.shabalala@iskool.demo', 19, 1, 59, 65, 60, '2025-03-22 10:16:00'),
(520, 'amahle.hlongwane@iskool.demo', 19, 1, 47, 65, 60, '2025-03-24 10:46:00'),
(521, 'boitumelo.sithole@iskool.demo', 19, 1, 52, 65, 120, '2025-03-20 10:18:00'),
(522, 'nokuthula.khoza@iskool.demo', 19, 1, 52, 65, 60, '2025-03-17 10:52:00'),
(523, 'zandi.nkosi@iskool.demo', 19, 1, 54, 65, 60, '2025-03-19 10:26:00'),
(524, 'ntokozo.ndlovu@iskool.demo', 19, 1, 56, 65, 60, '2025-03-16 10:22:00'),
(525, 'nomvula.mhlongo@iskool.demo', 19, 1, 45, 65, 60, '2025-03-28 10:49:00'),
(526, 'thandi.khoza@iskool.demo', 19, 1, 58, 65, 60, '2025-03-21 10:39:00'),
(527, 'nokuthula.gumede@iskool.demo', 19, 1, 52, 65, 60, '2025-03-23 10:33:00'),
(528, 'refilwe.sithole@iskool.demo', 19, 1, 56, 65, 60, '2025-03-21 10:30:00'),
(529, 'dineo.gumede@iskool.demo', 19, 1, 53, 65, 60, '2025-03-18 10:45:00'),
(530, 'tumelo.shabalala@iskool.demo', 19, 1, 51, 65, 60, '2025-03-18 10:13:00'),
(531, 'zandi.shabalala@iskool.demo', 19, 1, 51, 65, 60, '2025-03-28 10:46:00'),
(532, 'extra0_thulani.mthembu@iskool.demo', 19, 1, 55, 65, 60, '2025-03-23 10:10:00'),
(533, 'extra1_siyabonga.dlamini@iskool.demo', 19, 1, 56, 65, 60, '2025-03-20 10:55:00'),
(534, 'extra2_nkosinathi.zungu@iskool.demo', 19, 1, 49, 65, 60, '2025-03-26 10:30:00'),
(535, 'extra3_mthokozisi.mkhize@iskool.demo', 19, 1, 52, 65, 60, '2025-03-27 10:13:00'),
(536, 'extra4_sandile.nene@iskool.demo', 19, 1, 53, 65, 60, '2025-03-21 10:04:00'),
(537, 'extra5_mzwandile.gumede@iskool.demo', 19, 1, 43, 65, 60, '2025-03-24 10:57:00'),
(538, 'extra6_bhekumuzi.shabalala@iskool.demo', 19, 1, 46, 65, 60, '2025-03-21 10:19:00'),
(539, 'extra7_mandla.mthethwa@iskool.demo', 19, 1, 49, 65, 60, '2025-03-18 10:34:00'),
(540, 'extra8_sifiso.nkosi@iskool.demo', 19, 1, 55, 65, 60, '2025-03-22 10:02:00'),
(541, 'extra9_xolani.khoza@iskool.demo', 19, 1, 46, 65, 60, '2025-03-25 10:00:00'),
(542, 'extra10_mlungisi.sibiya@iskool.demo', 19, 1, 44, 65, 120, '2025-03-23 10:31:00'),
(543, 'extra11_dumisani.ndlovu@iskool.demo', 19, 1, 51, 65, 120, '2025-03-26 10:44:00'),
(544, 'extra12_bonginkosi.buthelezi@iskool.demo', 19, 1, 51, 65, 60, '2025-03-28 10:22:00'),
(545, 'extra13_siphelele.hlongwane@iskool.demo', 19, 1, 51, 65, 60, '2025-03-24 10:58:00'),
(546, 'extra14_mvelo.mbatha@iskool.demo', 19, 1, 49, 65, 60, '2025-03-21 10:54:00'),
(547, 'sipho.shabalala@iskool.demo', 20, 1, 54, 62, 60, '2025-03-24 10:16:00'),
(548, 'athi.mathenjwa@iskool.demo', 20, 1, 49, 62, 60, '2025-03-18 10:51:00'),
(549, 'thando.nkosi@iskool.demo', 20, 1, 55, 62, 60, '2025-03-18 10:48:00'),
(550, 'kgomotso.khuzwayo@iskool.demo', 20, 1, 55, 62, 60, '2025-03-16 10:23:00'),
(551, 'zandi.buthelezi@iskool.demo', 20, 1, 57, 62, 60, '2025-03-19 10:15:00'),
(552, 'naledi.ndlovu@iskool.demo', 20, 1, 45, 62, 60, '2025-03-24 10:13:00'),
(553, 'thandi.mhlongo@iskool.demo', 20, 1, 49, 62, 60, '2025-03-26 10:45:00'),
(554, 'lindiwe.dlamini@iskool.demo', 20, 1, 47, 62, 60, '2025-03-27 10:51:00'),
(555, 'kgomotso.mthembu@iskool.demo', 20, 1, 42, 62, 60, '2025-03-16 10:19:00'),
(556, 'onthatile.khoza@iskool.demo', 20, 1, 42, 62, 60, '2025-03-20 10:50:00'),
(557, 'tumelo.ndlovu@iskool.demo', 20, 1, 46, 62, 60, '2025-03-24 10:25:00'),
(558, 'refilwe.ngubane@iskool.demo', 20, 1, 54, 62, 60, '2025-03-16 10:15:00'),
(559, 'nomvula.ndlovu@iskool.demo', 20, 1, 51, 62, 60, '2025-03-17 10:56:00'),
(560, 'lerato.sibiya@iskool.demo', 20, 1, 45, 62, 60, '2025-03-24 10:24:00'),
(561, 'zinhle.mbatha@iskool.demo', 20, 1, 53, 62, 60, '2025-03-25 10:09:00'),
(562, 'nomvula.mbatha@iskool.demo', 20, 1, 55, 62, 60, '2025-03-25 10:32:00'),
(563, 'precious.zulu@iskool.demo', 20, 1, 42, 62, 60, '2025-03-27 10:43:00'),
(564, 'siphesihle.shabalala@iskool.demo', 20, 1, 44, 62, 60, '2025-03-24 10:18:00'),
(565, 'amahle.hlongwane@iskool.demo', 20, 1, 52, 62, 60, '2025-03-27 10:39:00'),
(566, 'boitumelo.sithole@iskool.demo', 20, 1, 47, 62, 60, '2025-03-17 10:27:00'),
(567, 'nokuthula.khoza@iskool.demo', 20, 1, 53, 62, 60, '2025-03-19 10:05:00'),
(568, 'zandi.nkosi@iskool.demo', 20, 1, 47, 62, 60, '2025-03-24 10:26:00'),
(569, 'ntokozo.ndlovu@iskool.demo', 20, 1, 50, 62, 60, '2025-03-20 10:32:00'),
(570, 'nomvula.mhlongo@iskool.demo', 20, 1, 45, 62, 60, '2025-03-16 10:33:00'),
(571, 'thandi.khoza@iskool.demo', 20, 1, 52, 62, 60, '2025-03-25 10:47:00'),
(572, 'nokuthula.gumede@iskool.demo', 20, 1, 51, 62, 60, '2025-03-25 10:36:00'),
(573, 'refilwe.sithole@iskool.demo', 20, 1, 56, 62, 60, '2025-03-26 10:39:00'),
(574, 'dineo.gumede@iskool.demo', 20, 1, 50, 62, 60, '2025-03-19 10:01:00'),
(575, 'tumelo.shabalala@iskool.demo', 20, 1, 52, 62, 60, '2025-03-19 10:50:00'),
(576, 'zandi.shabalala@iskool.demo', 20, 1, 42, 62, 60, '2025-03-24 10:44:00'),
(577, 'extra0_thulani.mthembu@iskool.demo', 20, 1, 42, 62, 120, '2025-03-21 10:44:00'),
(578, 'extra1_siyabonga.dlamini@iskool.demo', 20, 1, 55, 62, 60, '2025-03-24 10:53:00'),
(579, 'extra2_nkosinathi.zungu@iskool.demo', 20, 1, 57, 62, 60, '2025-03-20 10:39:00'),
(580, 'extra3_mthokozisi.mkhize@iskool.demo', 20, 1, 50, 62, 60, '2025-03-23 10:51:00'),
(581, 'extra4_sandile.nene@iskool.demo', 20, 1, 55, 62, 60, '2025-03-22 10:13:00'),
(582, 'extra5_mzwandile.gumede@iskool.demo', 20, 1, 51, 62, 60, '2025-03-17 10:15:00'),
(583, 'extra6_bhekumuzi.shabalala@iskool.demo', 20, 1, 50, 62, 60, '2025-03-20 10:45:00'),
(584, 'extra7_mandla.mthethwa@iskool.demo', 20, 1, 55, 62, 60, '2025-03-26 10:54:00'),
(585, 'extra8_sifiso.nkosi@iskool.demo', 20, 1, 53, 62, 60, '2025-03-21 10:38:00'),
(586, 'extra9_xolani.khoza@iskool.demo', 20, 1, 42, 62, 60, '2025-03-25 10:14:00'),
(587, 'extra10_mlungisi.sibiya@iskool.demo', 20, 1, 45, 62, 60, '2025-03-25 10:25:00'),
(588, 'extra11_dumisani.ndlovu@iskool.demo', 20, 1, 54, 62, 60, '2025-03-18 10:01:00'),
(589, 'extra12_bonginkosi.buthelezi@iskool.demo', 20, 1, 56, 62, 60, '2025-03-19 10:38:00'),
(590, 'extra13_siphelele.hlongwane@iskool.demo', 20, 1, 53, 62, 60, '2025-03-16 10:29:00'),
(591, 'extra14_mvelo.mbatha@iskool.demo', 20, 1, 46, 62, 60, '2025-03-22 10:37:00'),
(592, 'ayanda.gumede@iskool.demo', 21, 1, 41, 94, 60, '2025-10-17 09:00:00'),
(593, 'ayanda.mathenjwa@iskool.demo', 21, 1, 51, 94, 60, '2025-10-17 09:00:00'),
(594, 'lindani.vilakazi@iskool.demo', 21, 1, 59, 94, 60, '2025-10-17 09:00:00'),
(595, 'rethabile.mbatha@iskool.demo', 21, 1, 57, 94, 60, '2025-10-20 09:00:00'),
(596, 'sanele.mokoena@iskool.demo', 21, 1, 32, 94, 60, '2025-10-19 09:00:00'),
(597, 'junior.khuzwayo@iskool.demo', 21, 1, 61, 94, 60, '2025-10-19 09:00:00'),
(598, 'ayanda.khoza@iskool.demo', 21, 1, 49, 94, 60, '2025-10-19 09:00:00'),
(599, 'rethabile.hlongwane@iskool.demo', 21, 1, 47, 94, 60, '2025-10-20 09:00:00'),
(600, 'lwandle.mthembu@iskool.demo', 21, 1, 73, 94, 120, '2025-10-20 09:00:00'),
(601, 'sanele.dlamini@iskool.demo', 21, 1, 89, 94, 60, '2025-10-17 09:00:00'),
(602, 'andile.mthethwa@iskool.demo', 21, 1, 53, 94, 60, '2025-10-17 09:00:00'),
(603, 'sanele.khuzwayo@iskool.demo', 21, 1, 89, 94, 120, '2025-10-19 09:00:00'),
(604, 'bongani.khuzwayo@iskool.demo', 21, 1, 44, 94, 60, '2025-10-18 09:00:00'),
(605, 'sipho.dlamini@iskool.demo', 21, 1, 41, 94, 60, '2025-10-17 09:00:00'),
(606, 'ofentse.mbatha@iskool.demo', 21, 1, 42, 94, 60, '2025-10-20 09:00:00'),
(607, 'lwandle.ngubane@iskool.demo', 21, 1, 62, 94, 60, '2025-10-17 09:00:00'),
(608, 'rethabile.vilakazi@iskool.demo', 21, 1, 49, 94, 120, '2025-10-18 09:00:00'),
(609, 'tshepo.gumede@iskool.demo', 21, 1, 53, 94, 120, '2025-10-19 09:00:00'),
(610, 'lungile.buthelezi@iskool.demo', 21, 1, 58, 94, 60, '2025-10-19 09:00:00'),
(611, 'junior.mthembu@iskool.demo', 21, 1, 56, 94, 60, '2025-10-17 09:00:00'),
(612, 'tshepo.nkosi@iskool.demo', 21, 1, 70, 94, 120, '2025-10-17 09:00:00'),
(613, 'bongani.mbatha@iskool.demo', 21, 1, 43, 94, 120, '2025-10-17 09:00:00'),
(614, 'ofentse.ngubane@iskool.demo', 21, 1, 53, 94, 60, '2025-10-17 09:00:00'),
(615, 'siya.vilakazi@iskool.demo', 21, 1, 75, 94, 60, '2025-10-20 09:00:00'),
(616, 'mpho.hlongwane@iskool.demo', 21, 1, 88, 94, 60, '2025-10-18 09:00:00'),
(617, 'sipho.mathenjwa@iskool.demo', 21, 1, 44, 94, 120, '2025-10-17 09:00:00'),
(618, 'athi.hlongwane@iskool.demo', 21, 1, 47, 94, 60, '2025-10-17 09:00:00'),
(619, 'rethabile.dlamini@iskool.demo', 21, 1, 71, 94, 120, '2025-10-17 09:00:00'),
(620, 'rethabile.khoza@iskool.demo', 21, 1, 74, 94, 120, '2025-10-19 09:00:00'),
(621, 'andile.mthethwa@iskool.demo', 22, 1, 54, 78, 60, '2025-10-20 09:00:00'),
(622, 'sanele.dlamini@iskool.demo', 22, 1, 64, 78, 60, '2025-10-21 09:00:00'),
(623, 'rethabile.mbatha@iskool.demo', 22, 1, 48, 78, 60, '2025-10-22 09:00:00'),
(624, 'rethabile.vilakazi@iskool.demo', 22, 1, 58, 78, 120, '2025-10-23 09:00:00'),
(625, 'lwandle.ngubane@iskool.demo', 22, 1, 69, 78, 120, '2025-10-23 09:00:00'),
(626, 'ofentse.mbatha@iskool.demo', 22, 1, 50, 78, 60, '2025-10-20 09:00:00'),
(627, 'sipho.mathenjwa@iskool.demo', 22, 1, 53, 78, 120, '2025-10-22 09:00:00'),
(628, 'lindani.sibiya@iskool.demo', 22, 1, 38, 78, 120, '2025-10-20 09:00:00'),
(629, 'ayanda.mathenjwa@iskool.demo', 22, 1, 56, 78, 60, '2025-10-23 09:00:00'),
(630, 'ayanda.khoza@iskool.demo', 22, 1, 59, 78, 60, '2025-10-22 09:00:00'),
(631, 'lindani.vilakazi@iskool.demo', 22, 1, 66, 78, 120, '2025-10-21 09:00:00'),
(632, 'ayanda.gumede@iskool.demo', 22, 1, 59, 78, 120, '2025-10-21 09:00:00'),
(633, 'rethabile.dlamini@iskool.demo', 22, 1, 74, 78, 120, '2025-10-22 09:00:00'),
(634, 'rethabile.hlongwane@iskool.demo', 22, 1, 52, 78, 60, '2025-10-21 09:00:00'),
(635, 'ofentse.ngubane@iskool.demo', 22, 1, 62, 78, 120, '2025-10-20 09:00:00'),
(636, 'lungile.buthelezi@iskool.demo', 22, 1, 25, 78, 60, '2025-10-20 09:00:00'),
(637, 'sipho.dlamini@iskool.demo', 22, 1, 62, 78, 60, '2025-10-21 09:00:00'),
(638, 'bongani.mbatha@iskool.demo', 22, 1, 29, 78, 120, '2025-10-21 09:00:00'),
(639, 'mpho.hlongwane@iskool.demo', 22, 1, 47, 78, 60, '2025-10-21 09:00:00');
INSERT INTO `quiz_results` (`id`, `user_email`, `quiz_id`, `academic_year_id`, `score`, `total`, `time_taken`, `submitted_at`) VALUES
(640, 'siya.vilakazi@iskool.demo', 22, 1, 54, 78, 120, '2025-10-20 09:00:00'),
(641, 'tshepo.gumede@iskool.demo', 22, 1, 36, 78, 60, '2025-10-22 09:00:00'),
(642, 'sanele.khuzwayo@iskool.demo', 22, 1, 58, 78, 60, '2025-10-22 09:00:00'),
(643, 'athi.hlongwane@iskool.demo', 22, 1, 38, 78, 120, '2025-10-23 09:00:00'),
(644, 'rethabile.khoza@iskool.demo', 22, 1, 42, 78, 120, '2025-10-23 09:00:00'),
(645, 'junior.khuzwayo@iskool.demo', 22, 1, 53, 78, 120, '2025-10-22 09:00:00'),
(646, 'tshepo.nkosi@iskool.demo', 22, 1, 46, 78, 60, '2025-10-21 09:00:00'),
(647, 'junior.mthembu@iskool.demo', 22, 1, 70, 78, 120, '2025-10-22 09:00:00'),
(648, 'sanele.mokoena@iskool.demo', 22, 1, 66, 78, 60, '2025-10-23 09:00:00'),
(649, 'lwandle.mthembu@iskool.demo', 22, 1, 51, 78, 60, '2025-10-21 09:00:00'),
(650, 'bongani.khuzwayo@iskool.demo', 22, 1, 58, 78, 120, '2025-10-21 09:00:00'),
(651, 'junior.mthembu@iskool.demo', 23, 1, 61, 76, 120, '2025-10-14 09:00:00'),
(652, 'bongani.mbatha@iskool.demo', 23, 1, 37, 76, 60, '2025-10-13 09:00:00'),
(653, 'sipho.mathenjwa@iskool.demo', 23, 1, 41, 76, 60, '2025-10-15 09:00:00'),
(654, 'mpho.hlongwane@iskool.demo', 23, 1, 51, 76, 60, '2025-10-13 09:00:00'),
(655, 'rethabile.dlamini@iskool.demo', 23, 1, 52, 76, 60, '2025-10-14 09:00:00'),
(656, 'lwandle.mthembu@iskool.demo', 23, 1, 62, 76, 120, '2025-10-13 09:00:00'),
(657, 'sanele.dlamini@iskool.demo', 23, 1, 53, 76, 120, '2025-10-13 09:00:00'),
(658, 'lwandle.ngubane@iskool.demo', 23, 1, 67, 76, 120, '2025-10-14 09:00:00'),
(659, 'ayanda.khoza@iskool.demo', 23, 1, 43, 76, 60, '2025-10-14 09:00:00'),
(660, 'lindani.vilakazi@iskool.demo', 23, 1, 48, 76, 60, '2025-10-13 09:00:00'),
(661, 'sipho.dlamini@iskool.demo', 23, 1, 38, 76, 60, '2025-10-15 09:00:00'),
(662, 'ofentse.mbatha@iskool.demo', 23, 1, 31, 76, 60, '2025-10-14 09:00:00'),
(663, 'athi.hlongwane@iskool.demo', 23, 1, 57, 76, 60, '2025-10-13 09:00:00'),
(664, 'junior.khuzwayo@iskool.demo', 23, 1, 43, 76, 120, '2025-10-14 09:00:00'),
(665, 'lungile.buthelezi@iskool.demo', 23, 1, 72, 76, 60, '2025-10-16 09:00:00'),
(666, 'sanele.mokoena@iskool.demo', 23, 1, 43, 76, 120, '2025-10-14 09:00:00'),
(667, 'sanele.khuzwayo@iskool.demo', 23, 1, 56, 76, 60, '2025-10-13 09:00:00'),
(668, 'rethabile.vilakazi@iskool.demo', 23, 1, 51, 76, 60, '2025-10-15 09:00:00'),
(669, 'tshepo.gumede@iskool.demo', 23, 1, 36, 76, 60, '2025-10-13 09:00:00'),
(670, 'ofentse.ngubane@iskool.demo', 23, 1, 65, 76, 60, '2025-10-14 09:00:00'),
(671, 'bongani.khuzwayo@iskool.demo', 23, 1, 40, 76, 120, '2025-10-16 09:00:00'),
(672, 'rethabile.mbatha@iskool.demo', 23, 1, 39, 76, 120, '2025-10-13 09:00:00'),
(673, 'ayanda.gumede@iskool.demo', 23, 1, 41, 76, 60, '2025-10-14 09:00:00'),
(674, 'tshepo.nkosi@iskool.demo', 23, 1, 31, 76, 60, '2025-10-13 09:00:00'),
(675, 'lindani.sibiya@iskool.demo', 23, 1, 43, 76, 120, '2025-10-13 09:00:00'),
(676, 'siya.vilakazi@iskool.demo', 23, 1, 64, 76, 120, '2025-10-15 09:00:00'),
(677, 'rethabile.hlongwane@iskool.demo', 23, 1, 39, 76, 120, '2025-10-13 09:00:00'),
(678, 'rethabile.khoza@iskool.demo', 23, 1, 72, 76, 120, '2025-10-15 09:00:00'),
(679, 'andile.mthethwa@iskool.demo', 23, 1, 69, 76, 120, '2025-10-16 09:00:00'),
(680, 'sanele.dlamini@iskool.demo', 24, 1, 25, 70, 60, '2025-10-09 09:00:00'),
(681, 'siya.vilakazi@iskool.demo', 24, 1, 44, 70, 120, '2025-10-09 09:00:00'),
(682, 'tshepo.gumede@iskool.demo', 24, 1, 54, 70, 120, '2025-10-07 09:00:00'),
(683, 'rethabile.khoza@iskool.demo', 24, 1, 45, 70, 120, '2025-10-09 09:00:00'),
(684, 'junior.khuzwayo@iskool.demo', 24, 1, 57, 70, 120, '2025-10-08 09:00:00'),
(685, 'athi.hlongwane@iskool.demo', 24, 1, 36, 70, 60, '2025-10-08 09:00:00'),
(686, 'sipho.mathenjwa@iskool.demo', 24, 1, 49, 70, 60, '2025-10-07 09:00:00'),
(687, 'lindani.vilakazi@iskool.demo', 24, 1, 44, 70, 120, '2025-10-07 09:00:00'),
(688, 'ayanda.mathenjwa@iskool.demo', 24, 1, 53, 70, 60, '2025-10-08 09:00:00'),
(689, 'ayanda.gumede@iskool.demo', 24, 1, 58, 70, 120, '2025-10-09 09:00:00'),
(690, 'sipho.dlamini@iskool.demo', 24, 1, 41, 70, 120, '2025-10-10 09:00:00'),
(691, 'rethabile.mbatha@iskool.demo', 24, 1, 40, 70, 120, '2025-10-10 09:00:00'),
(692, 'mpho.hlongwane@iskool.demo', 24, 1, 42, 70, 120, '2025-10-07 09:00:00'),
(693, 'ayanda.khoza@iskool.demo', 24, 1, 60, 70, 60, '2025-10-09 09:00:00'),
(694, 'ofentse.ngubane@iskool.demo', 24, 1, 50, 70, 60, '2025-10-09 09:00:00'),
(695, 'ofentse.mbatha@iskool.demo', 24, 1, 56, 70, 120, '2025-10-07 09:00:00'),
(696, 'lwandle.ngubane@iskool.demo', 24, 1, 55, 70, 60, '2025-10-07 09:00:00'),
(697, 'sanele.mokoena@iskool.demo', 24, 1, 44, 70, 120, '2025-10-07 09:00:00'),
(698, 'tshepo.nkosi@iskool.demo', 24, 1, 30, 70, 120, '2025-10-10 09:00:00'),
(699, 'rethabile.vilakazi@iskool.demo', 24, 1, 50, 70, 60, '2025-10-08 09:00:00'),
(700, 'andile.mthethwa@iskool.demo', 24, 1, 47, 70, 60, '2025-10-07 09:00:00'),
(701, 'lindani.sibiya@iskool.demo', 24, 1, 54, 70, 60, '2025-10-08 09:00:00'),
(702, 'rethabile.dlamini@iskool.demo', 24, 1, 54, 70, 60, '2025-10-09 09:00:00'),
(703, 'sanele.khuzwayo@iskool.demo', 24, 1, 44, 70, 60, '2025-10-08 09:00:00'),
(704, 'bongani.mbatha@iskool.demo', 24, 1, 39, 70, 120, '2025-10-09 09:00:00'),
(705, 'junior.mthembu@iskool.demo', 24, 1, 50, 70, 60, '2025-10-08 09:00:00'),
(706, 'bongani.khuzwayo@iskool.demo', 24, 1, 25, 70, 60, '2025-10-10 09:00:00'),
(707, 'lungile.buthelezi@iskool.demo', 24, 1, 45, 70, 60, '2025-10-08 09:00:00'),
(708, 'lwandle.mthembu@iskool.demo', 24, 1, 56, 70, 60, '2025-10-08 09:00:00'),
(709, 'rethabile.hlongwane@iskool.demo', 24, 1, 51, 70, 60, '2025-10-07 09:00:00'),
(710, 'bongani.khuzwayo@iskool.demo', 31, 1, 50, 67, 60, '2025-11-17 09:00:00'),
(711, 'junior.mthembu@iskool.demo', 31, 1, 55, 67, 60, '2025-11-15 09:00:00'),
(712, 'rethabile.dlamini@iskool.demo', 31, 1, 51, 67, 60, '2025-11-15 09:00:00'),
(713, 'sanele.mokoena@iskool.demo', 31, 1, 45, 67, 60, '2025-11-16 09:00:00'),
(714, 'ayanda.gumede@iskool.demo', 31, 1, 61, 67, 60, '2025-11-15 09:00:00'),
(715, 'ayanda.mathenjwa@iskool.demo', 31, 1, 35, 67, 120, '2025-11-16 09:00:00'),
(716, 'rethabile.mbatha@iskool.demo', 31, 1, 48, 67, 60, '2025-11-14 09:00:00'),
(717, 'andile.mthethwa@iskool.demo', 31, 1, 55, 67, 60, '2025-11-17 09:00:00'),
(718, 'ofentse.mbatha@iskool.demo', 31, 1, 25, 67, 60, '2025-11-18 09:00:00'),
(719, 'sanele.khuzwayo@iskool.demo', 31, 1, 45, 67, 60, '2025-11-15 09:00:00'),
(720, 'bongani.mbatha@iskool.demo', 31, 1, 48, 67, 120, '2025-11-17 09:00:00'),
(721, 'tshepo.gumede@iskool.demo', 31, 1, 44, 67, 60, '2025-11-17 09:00:00'),
(722, 'ofentse.ngubane@iskool.demo', 31, 1, 47, 67, 60, '2025-11-13 09:00:00'),
(723, 'tshepo.nkosi@iskool.demo', 31, 1, 63, 67, 60, '2025-11-14 09:00:00'),
(724, 'lindani.sibiya@iskool.demo', 31, 1, 54, 67, 120, '2025-11-15 09:00:00'),
(725, 'lwandle.mthembu@iskool.demo', 31, 1, 64, 67, 60, '2025-11-18 09:00:00'),
(726, 'junior.khuzwayo@iskool.demo', 31, 1, 53, 67, 60, '2025-11-18 09:00:00'),
(727, 'ayanda.khoza@iskool.demo', 31, 1, 35, 67, 60, '2025-11-15 09:00:00'),
(728, 'sipho.dlamini@iskool.demo', 31, 1, 38, 67, 60, '2025-11-13 09:00:00'),
(729, 'lungile.buthelezi@iskool.demo', 31, 1, 62, 67, 60, '2025-11-16 09:00:00'),
(730, 'siya.vilakazi@iskool.demo', 31, 1, 42, 67, 120, '2025-11-17 09:00:00'),
(731, 'sipho.mathenjwa@iskool.demo', 31, 1, 44, 67, 60, '2025-11-15 09:00:00'),
(732, 'lindani.vilakazi@iskool.demo', 31, 1, 46, 67, 60, '2025-11-18 09:00:00'),
(733, 'athi.hlongwane@iskool.demo', 31, 1, 43, 67, 60, '2025-11-13 09:00:00'),
(734, 'rethabile.vilakazi@iskool.demo', 31, 1, 47, 67, 60, '2025-11-18 09:00:00'),
(735, 'rethabile.khoza@iskool.demo', 31, 1, 59, 67, 60, '2025-11-13 09:00:00'),
(736, 'lwandle.ngubane@iskool.demo', 31, 1, 55, 67, 60, '2025-11-13 09:00:00'),
(737, 'sanele.dlamini@iskool.demo', 31, 1, 44, 67, 60, '2025-11-16 09:00:00'),
(738, 'rethabile.hlongwane@iskool.demo', 31, 1, 42, 67, 60, '2025-11-13 09:00:00'),
(739, 'mpho.hlongwane@iskool.demo', 31, 1, 37, 67, 60, '2025-11-15 09:00:00'),
(740, 'sanele.khuzwayo@iskool.demo', 33, 1, 54, 91, 60, '2025-11-22 09:00:00'),
(741, 'bongani.mbatha@iskool.demo', 33, 1, 57, 91, 60, '2025-11-24 09:00:00'),
(742, 'junior.khuzwayo@iskool.demo', 33, 1, 60, 91, 60, '2025-11-23 09:00:00'),
(743, 'lungile.buthelezi@iskool.demo', 33, 1, 31, 91, 60, '2025-11-24 09:00:00'),
(744, 'rethabile.khoza@iskool.demo', 33, 1, 45, 91, 60, '2025-11-21 09:00:00'),
(745, 'sanele.dlamini@iskool.demo', 33, 1, 41, 91, 120, '2025-11-22 09:00:00'),
(746, 'andile.mthethwa@iskool.demo', 33, 1, 27, 91, 60, '2025-11-25 09:00:00'),
(747, 'mpho.hlongwane@iskool.demo', 33, 1, 69, 91, 60, '2025-11-24 09:00:00'),
(748, 'bongani.khuzwayo@iskool.demo', 33, 1, 69, 91, 60, '2025-11-22 09:00:00'),
(749, 'lwandle.ngubane@iskool.demo', 33, 1, 56, 91, 60, '2025-11-25 09:00:00'),
(750, 'rethabile.vilakazi@iskool.demo', 33, 1, 60, 91, 60, '2025-11-25 09:00:00'),
(751, 'sipho.mathenjwa@iskool.demo', 33, 1, 62, 91, 120, '2025-11-23 09:00:00'),
(752, 'junior.mthembu@iskool.demo', 33, 1, 57, 91, 60, '2025-11-23 09:00:00'),
(753, 'rethabile.hlongwane@iskool.demo', 33, 1, 52, 91, 120, '2025-11-21 09:00:00'),
(754, 'ofentse.ngubane@iskool.demo', 33, 1, 55, 91, 60, '2025-11-25 09:00:00'),
(755, 'sipho.dlamini@iskool.demo', 33, 1, 55, 91, 60, '2025-11-26 09:00:00'),
(756, 'sanele.mokoena@iskool.demo', 33, 1, 27, 91, 60, '2025-11-25 09:00:00'),
(757, 'siya.vilakazi@iskool.demo', 33, 1, 49, 91, 60, '2025-11-26 09:00:00'),
(758, 'ayanda.khoza@iskool.demo', 33, 1, 44, 91, 60, '2025-11-21 09:00:00'),
(759, 'rethabile.mbatha@iskool.demo', 33, 1, 67, 91, 60, '2025-11-25 09:00:00'),
(760, 'lwandle.mthembu@iskool.demo', 33, 1, 59, 91, 60, '2025-11-23 09:00:00'),
(761, 'rethabile.dlamini@iskool.demo', 33, 1, 66, 91, 60, '2025-11-24 09:00:00'),
(762, 'lindani.vilakazi@iskool.demo', 33, 1, 61, 91, 60, '2025-11-22 09:00:00'),
(763, 'tshepo.nkosi@iskool.demo', 33, 1, 64, 91, 60, '2025-11-26 09:00:00'),
(764, 'athi.hlongwane@iskool.demo', 33, 1, 69, 91, 60, '2025-11-25 09:00:00'),
(765, 'ayanda.gumede@iskool.demo', 33, 1, 72, 91, 60, '2025-11-21 09:00:00'),
(766, 'lindani.sibiya@iskool.demo', 33, 1, 64, 91, 60, '2025-11-23 09:00:00'),
(767, 'tshepo.gumede@iskool.demo', 33, 1, 55, 91, 60, '2025-11-22 09:00:00'),
(768, 'ayanda.mathenjwa@iskool.demo', 33, 1, 61, 91, 60, '2025-11-21 09:00:00'),
(769, 'lwandle.ngubane@iskool.demo', 32, 1, 78, 82, 60, '2025-11-13 09:00:00'),
(770, 'lindani.sibiya@iskool.demo', 32, 1, 46, 82, 60, '2025-11-13 09:00:00'),
(771, 'rethabile.vilakazi@iskool.demo', 32, 1, 51, 82, 60, '2025-11-17 09:00:00'),
(772, 'rethabile.khoza@iskool.demo', 32, 1, 61, 82, 120, '2025-11-17 09:00:00'),
(773, 'andile.mthethwa@iskool.demo', 32, 1, 27, 82, 60, '2025-11-14 09:00:00'),
(774, 'lungile.buthelezi@iskool.demo', 32, 1, 53, 82, 120, '2025-11-18 09:00:00'),
(775, 'ayanda.mathenjwa@iskool.demo', 32, 1, 67, 82, 120, '2025-11-18 09:00:00'),
(776, 'mpho.hlongwane@iskool.demo', 32, 1, 39, 82, 60, '2025-11-16 09:00:00'),
(777, 'lindani.vilakazi@iskool.demo', 32, 1, 67, 82, 120, '2025-11-16 09:00:00'),
(778, 'rethabile.dlamini@iskool.demo', 32, 1, 36, 82, 60, '2025-11-16 09:00:00'),
(779, 'sipho.dlamini@iskool.demo', 32, 1, 67, 82, 60, '2025-11-18 09:00:00'),
(780, 'ayanda.khoza@iskool.demo', 32, 1, 39, 82, 60, '2025-11-14 09:00:00'),
(781, 'junior.khuzwayo@iskool.demo', 32, 1, 53, 82, 60, '2025-11-18 09:00:00'),
(782, 'rethabile.mbatha@iskool.demo', 32, 1, 55, 82, 120, '2025-11-13 09:00:00'),
(783, 'ofentse.mbatha@iskool.demo', 32, 1, 55, 82, 120, '2025-11-18 09:00:00'),
(784, 'bongani.mbatha@iskool.demo', 32, 1, 73, 82, 60, '2025-11-13 09:00:00'),
(785, 'sanele.dlamini@iskool.demo', 32, 1, 63, 82, 120, '2025-11-17 09:00:00'),
(786, 'junior.mthembu@iskool.demo', 32, 1, 66, 82, 60, '2025-11-14 09:00:00'),
(787, 'rethabile.hlongwane@iskool.demo', 32, 1, 63, 82, 60, '2025-11-16 09:00:00'),
(788, 'sanele.khuzwayo@iskool.demo', 32, 1, 62, 82, 120, '2025-11-14 09:00:00'),
(789, 'lwandle.mthembu@iskool.demo', 32, 1, 44, 82, 60, '2025-11-17 09:00:00'),
(790, 'ayanda.gumede@iskool.demo', 32, 1, 50, 82, 60, '2025-11-15 09:00:00'),
(791, 'bongani.khuzwayo@iskool.demo', 32, 1, 57, 82, 60, '2025-11-18 09:00:00'),
(792, 'sanele.mokoena@iskool.demo', 32, 1, 44, 82, 60, '2025-11-14 09:00:00'),
(793, 'tshepo.nkosi@iskool.demo', 32, 1, 36, 82, 120, '2025-11-17 09:00:00'),
(794, 'athi.hlongwane@iskool.demo', 32, 1, 61, 82, 60, '2025-11-13 09:00:00'),
(795, 'ofentse.ngubane@iskool.demo', 32, 1, 45, 82, 60, '2025-11-15 09:00:00'),
(796, 'tshepo.gumede@iskool.demo', 32, 1, 71, 82, 60, '2025-11-18 09:00:00'),
(797, 'sipho.mathenjwa@iskool.demo', 32, 1, 45, 82, 60, '2025-11-16 09:00:00'),
(798, 'sanele.dlamini@iskool.demo', 25, 1, 46, 75, 120, '2025-10-09 09:00:00'),
(799, 'lwandle.mthembu@iskool.demo', 25, 1, 47, 75, 120, '2025-10-11 09:00:00'),
(800, 'sanele.mokoena@iskool.demo', 25, 1, 56, 75, 60, '2025-10-12 09:00:00'),
(801, 'rethabile.khoza@iskool.demo', 25, 1, 44, 75, 60, '2025-10-10 09:00:00'),
(802, 'mpho.hlongwane@iskool.demo', 25, 1, 45, 75, 60, '2025-10-13 09:00:00'),
(803, 'junior.mthembu@iskool.demo', 25, 1, 44, 75, 60, '2025-10-08 09:00:00'),
(804, 'rethabile.mbatha@iskool.demo', 25, 1, 44, 75, 60, '2025-10-09 09:00:00'),
(805, 'lindani.sibiya@iskool.demo', 25, 1, 47, 75, 120, '2025-10-10 09:00:00'),
(806, 'ayanda.mathenjwa@iskool.demo', 25, 1, 48, 75, 120, '2025-10-11 09:00:00'),
(807, 'rethabile.vilakazi@iskool.demo', 25, 1, 39, 75, 60, '2025-10-12 09:00:00'),
(808, 'rethabile.hlongwane@iskool.demo', 25, 1, 64, 75, 120, '2025-10-09 09:00:00'),
(809, 'bongani.mbatha@iskool.demo', 25, 1, 37, 75, 120, '2025-10-09 09:00:00'),
(810, 'sipho.dlamini@iskool.demo', 25, 1, 55, 75, 60, '2025-10-12 09:00:00'),
(811, 'lindani.vilakazi@iskool.demo', 25, 1, 59, 75, 60, '2025-10-09 09:00:00'),
(812, 'siya.vilakazi@iskool.demo', 25, 1, 41, 75, 60, '2025-10-08 09:00:00'),
(813, 'junior.khuzwayo@iskool.demo', 25, 1, 58, 75, 120, '2025-10-09 09:00:00'),
(814, 'lungile.buthelezi@iskool.demo', 25, 1, 47, 75, 60, '2025-10-12 09:00:00'),
(815, 'ayanda.khoza@iskool.demo', 25, 1, 48, 75, 60, '2025-10-09 09:00:00'),
(816, 'ayanda.gumede@iskool.demo', 25, 1, 44, 75, 120, '2025-10-13 09:00:00'),
(817, 'lwandle.ngubane@iskool.demo', 25, 1, 35, 75, 120, '2025-10-08 09:00:00'),
(818, 'athi.hlongwane@iskool.demo', 25, 1, 53, 75, 120, '2025-10-11 09:00:00'),
(819, 'sanele.khuzwayo@iskool.demo', 25, 1, 49, 75, 120, '2025-10-12 09:00:00'),
(820, 'tshepo.gumede@iskool.demo', 25, 1, 45, 75, 120, '2025-10-09 09:00:00'),
(821, 'ofentse.ngubane@iskool.demo', 25, 1, 43, 75, 120, '2025-10-12 09:00:00'),
(822, 'rethabile.dlamini@iskool.demo', 25, 1, 51, 75, 120, '2025-10-08 09:00:00'),
(823, 'ofentse.mbatha@iskool.demo', 25, 1, 39, 75, 60, '2025-10-11 09:00:00'),
(824, 'sipho.mathenjwa@iskool.demo', 25, 1, 55, 75, 60, '2025-10-10 09:00:00'),
(825, 'tshepo.nkosi@iskool.demo', 25, 1, 51, 75, 60, '2025-10-08 09:00:00'),
(826, 'andile.mthethwa@iskool.demo', 25, 1, 63, 75, 120, '2025-10-12 09:00:00'),
(827, 'lwandle.ngubane@iskool.demo', 27, 1, 51, 76, 60, '2025-10-16 09:00:00'),
(828, 'rethabile.khoza@iskool.demo', 27, 1, 69, 76, 120, '2025-10-16 09:00:00'),
(829, 'athi.hlongwane@iskool.demo', 27, 1, 68, 76, 120, '2025-10-20 09:00:00'),
(830, 'ofentse.ngubane@iskool.demo', 27, 1, 58, 76, 60, '2025-10-18 09:00:00'),
(831, 'siya.vilakazi@iskool.demo', 27, 1, 36, 76, 120, '2025-10-19 09:00:00'),
(832, 'sanele.dlamini@iskool.demo', 27, 1, 38, 76, 60, '2025-10-17 09:00:00'),
(833, 'andile.mthethwa@iskool.demo', 27, 1, 61, 76, 120, '2025-10-20 09:00:00'),
(834, 'tshepo.nkosi@iskool.demo', 27, 1, 28, 76, 60, '2025-10-18 09:00:00'),
(835, 'mpho.hlongwane@iskool.demo', 27, 1, 49, 76, 60, '2025-10-20 09:00:00'),
(836, 'sipho.dlamini@iskool.demo', 27, 1, 59, 76, 60, '2025-10-21 09:00:00'),
(837, 'rethabile.hlongwane@iskool.demo', 27, 1, 52, 76, 60, '2025-10-16 09:00:00'),
(838, 'sipho.mathenjwa@iskool.demo', 27, 1, 62, 76, 60, '2025-10-21 09:00:00'),
(839, 'rethabile.vilakazi@iskool.demo', 27, 1, 31, 76, 60, '2025-10-21 09:00:00'),
(840, 'junior.khuzwayo@iskool.demo', 27, 1, 59, 76, 60, '2025-10-17 09:00:00'),
(841, 'tshepo.gumede@iskool.demo', 27, 1, 32, 76, 60, '2025-10-17 09:00:00'),
(842, 'sanele.khuzwayo@iskool.demo', 27, 1, 62, 76, 60, '2025-10-21 09:00:00'),
(843, 'lindani.vilakazi@iskool.demo', 27, 1, 44, 76, 60, '2025-10-20 09:00:00'),
(844, 'lindani.sibiya@iskool.demo', 27, 1, 61, 76, 60, '2025-10-18 09:00:00'),
(845, 'sanele.mokoena@iskool.demo', 27, 1, 56, 76, 60, '2025-10-21 09:00:00'),
(846, 'ayanda.mathenjwa@iskool.demo', 27, 1, 38, 76, 60, '2025-10-21 09:00:00'),
(847, 'ofentse.mbatha@iskool.demo', 27, 1, 41, 76, 120, '2025-10-17 09:00:00'),
(848, 'lwandle.mthembu@iskool.demo', 27, 1, 43, 76, 60, '2025-10-17 09:00:00'),
(849, 'bongani.mbatha@iskool.demo', 27, 1, 63, 76, 120, '2025-10-16 09:00:00'),
(850, 'rethabile.dlamini@iskool.demo', 27, 1, 61, 76, 60, '2025-10-19 09:00:00'),
(851, 'ayanda.khoza@iskool.demo', 27, 1, 54, 76, 60, '2025-10-17 09:00:00'),
(852, 'junior.mthembu@iskool.demo', 27, 1, 50, 76, 60, '2025-10-16 09:00:00'),
(853, 'rethabile.mbatha@iskool.demo', 27, 1, 69, 76, 60, '2025-10-20 09:00:00'),
(854, 'ayanda.gumede@iskool.demo', 27, 1, 52, 76, 120, '2025-10-16 09:00:00'),
(855, 'bongani.khuzwayo@iskool.demo', 27, 1, 37, 76, 60, '2025-10-18 09:00:00'),
(856, 'sipho.mathenjwa@iskool.demo', 26, 1, 37, 80, 120, '2025-10-24 09:00:00'),
(857, 'bongani.khuzwayo@iskool.demo', 26, 1, 53, 80, 120, '2025-10-21 09:00:00'),
(858, 'rethabile.khoza@iskool.demo', 26, 1, 24, 80, 120, '2025-10-22 09:00:00'),
(859, 'athi.hlongwane@iskool.demo', 26, 1, 43, 80, 120, '2025-10-20 09:00:00'),
(860, 'sipho.dlamini@iskool.demo', 26, 1, 50, 80, 60, '2025-10-20 09:00:00'),
(861, 'siya.vilakazi@iskool.demo', 26, 1, 60, 80, 120, '2025-10-23 09:00:00'),
(862, 'ofentse.mbatha@iskool.demo', 26, 1, 59, 80, 120, '2025-10-19 09:00:00'),
(863, 'lindani.vilakazi@iskool.demo', 26, 1, 57, 80, 120, '2025-10-21 09:00:00'),
(864, 'mpho.hlongwane@iskool.demo', 26, 1, 63, 80, 60, '2025-10-24 09:00:00'),
(865, 'tshepo.nkosi@iskool.demo', 26, 1, 54, 80, 120, '2025-10-19 09:00:00'),
(866, 'junior.mthembu@iskool.demo', 26, 1, 43, 80, 60, '2025-10-19 09:00:00'),
(867, 'sanele.dlamini@iskool.demo', 26, 1, 41, 80, 60, '2025-10-24 09:00:00'),
(868, 'rethabile.dlamini@iskool.demo', 26, 1, 51, 80, 120, '2025-10-24 09:00:00'),
(869, 'tshepo.gumede@iskool.demo', 26, 1, 42, 80, 60, '2025-10-19 09:00:00'),
(870, 'rethabile.vilakazi@iskool.demo', 26, 1, 44, 80, 60, '2025-10-23 09:00:00'),
(871, 'bongani.mbatha@iskool.demo', 26, 1, 50, 80, 120, '2025-10-24 09:00:00'),
(872, 'lwandle.mthembu@iskool.demo', 26, 1, 50, 80, 120, '2025-10-19 09:00:00'),
(873, 'ayanda.khoza@iskool.demo', 26, 1, 59, 80, 120, '2025-10-20 09:00:00'),
(874, 'ofentse.ngubane@iskool.demo', 26, 1, 53, 80, 60, '2025-10-24 09:00:00'),
(875, 'junior.khuzwayo@iskool.demo', 26, 1, 62, 80, 120, '2025-10-23 09:00:00'),
(876, 'ayanda.mathenjwa@iskool.demo', 26, 1, 62, 80, 120, '2025-10-23 09:00:00'),
(877, 'ayanda.gumede@iskool.demo', 26, 1, 55, 80, 120, '2025-10-22 09:00:00'),
(878, 'sanele.mokoena@iskool.demo', 26, 1, 56, 80, 60, '2025-10-19 09:00:00'),
(879, 'lindani.sibiya@iskool.demo', 26, 1, 55, 80, 60, '2025-10-21 09:00:00'),
(880, 'lungile.buthelezi@iskool.demo', 26, 1, 62, 80, 120, '2025-10-21 09:00:00'),
(881, 'andile.mthethwa@iskool.demo', 26, 1, 60, 80, 60, '2025-10-21 09:00:00'),
(882, 'lwandle.ngubane@iskool.demo', 26, 1, 42, 80, 60, '2025-10-20 09:00:00'),
(883, 'rethabile.hlongwane@iskool.demo', 26, 1, 64, 80, 120, '2025-10-22 09:00:00'),
(884, 'rethabile.mbatha@iskool.demo', 26, 1, 47, 80, 60, '2025-10-21 09:00:00'),
(885, 'andile.mthethwa@iskool.demo', 34, 1, 42, 85, 120, '2025-11-23 09:00:00'),
(886, 'lwandle.mthembu@iskool.demo', 34, 1, 46, 85, 120, '2025-11-22 09:00:00'),
(887, 'rethabile.dlamini@iskool.demo', 34, 1, 30, 85, 120, '2025-11-18 09:00:00'),
(888, 'lungile.buthelezi@iskool.demo', 34, 1, 46, 85, 120, '2025-11-22 09:00:00'),
(889, 'ayanda.khoza@iskool.demo', 34, 1, 53, 85, 120, '2025-11-19 09:00:00'),
(890, 'lwandle.ngubane@iskool.demo', 34, 1, 43, 85, 120, '2025-11-22 09:00:00'),
(891, 'junior.khuzwayo@iskool.demo', 34, 1, 57, 85, 60, '2025-11-20 09:00:00'),
(892, 'lindani.sibiya@iskool.demo', 34, 1, 66, 85, 60, '2025-11-19 09:00:00'),
(893, 'bongani.mbatha@iskool.demo', 34, 1, 60, 85, 60, '2025-11-21 09:00:00'),
(894, 'sanele.dlamini@iskool.demo', 34, 1, 45, 85, 120, '2025-11-20 09:00:00'),
(895, 'sipho.dlamini@iskool.demo', 34, 1, 38, 85, 120, '2025-11-18 09:00:00'),
(896, 'mpho.hlongwane@iskool.demo', 34, 1, 81, 85, 120, '2025-11-22 09:00:00'),
(897, 'tshepo.nkosi@iskool.demo', 34, 1, 44, 85, 120, '2025-11-21 09:00:00'),
(898, 'athi.hlongwane@iskool.demo', 34, 1, 43, 85, 120, '2025-11-22 09:00:00'),
(899, 'sanele.khuzwayo@iskool.demo', 34, 1, 61, 85, 120, '2025-11-23 09:00:00'),
(900, 'ofentse.mbatha@iskool.demo', 34, 1, 49, 85, 120, '2025-11-21 09:00:00'),
(901, 'ofentse.ngubane@iskool.demo', 34, 1, 52, 85, 120, '2025-11-23 09:00:00'),
(902, 'ayanda.mathenjwa@iskool.demo', 34, 1, 58, 85, 120, '2025-11-21 09:00:00'),
(903, 'sanele.mokoena@iskool.demo', 34, 1, 73, 85, 120, '2025-11-23 09:00:00'),
(904, 'rethabile.khoza@iskool.demo', 34, 1, 48, 85, 120, '2025-11-21 09:00:00'),
(905, 'lindani.vilakazi@iskool.demo', 34, 1, 56, 85, 60, '2025-11-21 09:00:00'),
(906, 'rethabile.vilakazi@iskool.demo', 34, 1, 28, 85, 60, '2025-11-21 09:00:00'),
(907, 'rethabile.hlongwane@iskool.demo', 34, 1, 69, 85, 120, '2025-11-19 09:00:00'),
(908, 'junior.mthembu@iskool.demo', 34, 1, 39, 85, 60, '2025-11-23 09:00:00'),
(909, 'bongani.khuzwayo@iskool.demo', 34, 1, 62, 85, 120, '2025-11-23 09:00:00'),
(910, 'tshepo.gumede@iskool.demo', 34, 1, 31, 85, 120, '2025-11-18 09:00:00'),
(911, 'ayanda.gumede@iskool.demo', 34, 1, 44, 85, 120, '2025-11-23 09:00:00'),
(912, 'sipho.mathenjwa@iskool.demo', 34, 1, 51, 85, 120, '2025-11-21 09:00:00'),
(913, 'rethabile.mbatha@iskool.demo', 34, 1, 54, 85, 60, '2025-11-21 09:00:00'),
(914, 'bongani.mbatha@iskool.demo', 36, 1, 52, 76, 60, '2025-11-16 09:00:00'),
(915, 'ofentse.mbatha@iskool.demo', 36, 1, 72, 76, 60, '2025-11-16 09:00:00'),
(916, 'sanele.dlamini@iskool.demo', 36, 1, 40, 76, 60, '2025-11-15 09:00:00'),
(917, 'rethabile.mbatha@iskool.demo', 36, 1, 63, 76, 120, '2025-11-17 09:00:00'),
(918, 'junior.khuzwayo@iskool.demo', 36, 1, 38, 76, 60, '2025-11-14 09:00:00'),
(919, 'sipho.mathenjwa@iskool.demo', 36, 1, 63, 76, 60, '2025-11-17 09:00:00'),
(920, 'lindani.vilakazi@iskool.demo', 36, 1, 60, 76, 60, '2025-11-15 09:00:00'),
(921, 'ayanda.khoza@iskool.demo', 36, 1, 50, 76, 120, '2025-11-15 09:00:00'),
(922, 'lwandle.ngubane@iskool.demo', 36, 1, 64, 76, 60, '2025-11-16 09:00:00'),
(923, 'rethabile.vilakazi@iskool.demo', 36, 1, 67, 76, 120, '2025-11-14 09:00:00'),
(924, 'sipho.dlamini@iskool.demo', 36, 1, 42, 76, 60, '2025-11-16 09:00:00'),
(925, 'andile.mthethwa@iskool.demo', 36, 1, 72, 76, 60, '2025-11-13 09:00:00'),
(926, 'sanele.mokoena@iskool.demo', 36, 1, 35, 76, 60, '2025-11-14 09:00:00'),
(927, 'tshepo.nkosi@iskool.demo', 36, 1, 36, 76, 120, '2025-11-15 09:00:00'),
(928, 'ayanda.gumede@iskool.demo', 36, 1, 48, 76, 60, '2025-11-17 09:00:00'),
(929, 'lindani.sibiya@iskool.demo', 36, 1, 41, 76, 60, '2025-11-16 09:00:00'),
(930, 'sanele.khuzwayo@iskool.demo', 36, 1, 50, 76, 60, '2025-11-14 09:00:00'),
(931, 'ofentse.ngubane@iskool.demo', 36, 1, 52, 76, 60, '2025-11-16 09:00:00'),
(932, 'ayanda.mathenjwa@iskool.demo', 36, 1, 60, 76, 60, '2025-11-17 09:00:00'),
(933, 'lwandle.mthembu@iskool.demo', 36, 1, 39, 76, 60, '2025-11-17 09:00:00'),
(934, 'athi.hlongwane@iskool.demo', 36, 1, 33, 76, 60, '2025-11-15 09:00:00'),
(935, 'siya.vilakazi@iskool.demo', 36, 1, 60, 76, 120, '2025-11-13 09:00:00'),
(936, 'rethabile.dlamini@iskool.demo', 36, 1, 51, 76, 60, '2025-11-17 09:00:00'),
(937, 'bongani.khuzwayo@iskool.demo', 36, 1, 39, 76, 60, '2025-11-13 09:00:00'),
(938, 'tshepo.gumede@iskool.demo', 36, 1, 32, 76, 60, '2025-11-14 09:00:00'),
(939, 'lungile.buthelezi@iskool.demo', 36, 1, 42, 76, 60, '2025-11-18 09:00:00'),
(940, 'rethabile.khoza@iskool.demo', 36, 1, 43, 76, 60, '2025-11-14 09:00:00'),
(941, 'rethabile.hlongwane@iskool.demo', 36, 1, 42, 76, 120, '2025-11-15 09:00:00'),
(942, 'junior.mthembu@iskool.demo', 36, 1, 67, 76, 120, '2025-11-15 09:00:00'),
(943, 'bongani.mbatha@iskool.demo', 35, 1, 69, 87, 60, '2025-11-27 09:00:00'),
(944, 'athi.hlongwane@iskool.demo', 35, 1, 55, 87, 60, '2025-11-25 09:00:00'),
(945, 'lwandle.ngubane@iskool.demo', 35, 1, 46, 87, 60, '2025-11-22 09:00:00'),
(946, 'junior.mthembu@iskool.demo', 35, 1, 51, 87, 60, '2025-11-24 09:00:00'),
(947, 'ofentse.mbatha@iskool.demo', 35, 1, 53, 87, 60, '2025-11-25 09:00:00'),
(948, 'rethabile.mbatha@iskool.demo', 35, 1, 80, 87, 60, '2025-11-27 09:00:00'),
(949, 'siya.vilakazi@iskool.demo', 35, 1, 56, 87, 60, '2025-11-24 09:00:00'),
(950, 'sanele.khuzwayo@iskool.demo', 35, 1, 67, 87, 60, '2025-11-24 09:00:00'),
(951, 'sanele.dlamini@iskool.demo', 35, 1, 49, 87, 60, '2025-11-25 09:00:00'),
(952, 'bongani.khuzwayo@iskool.demo', 35, 1, 53, 87, 60, '2025-11-27 09:00:00'),
(953, 'lwandle.mthembu@iskool.demo', 35, 1, 49, 87, 60, '2025-11-25 09:00:00'),
(954, 'ofentse.ngubane@iskool.demo', 35, 1, 43, 87, 60, '2025-11-27 09:00:00'),
(955, 'sipho.dlamini@iskool.demo', 35, 1, 64, 87, 60, '2025-11-27 09:00:00'),
(956, 'rethabile.dlamini@iskool.demo', 35, 1, 66, 87, 60, '2025-11-26 09:00:00'),
(957, 'lindani.vilakazi@iskool.demo', 35, 1, 78, 87, 60, '2025-11-24 09:00:00'),
(958, 'ayanda.mathenjwa@iskool.demo', 35, 1, 36, 87, 60, '2025-11-26 09:00:00'),
(959, 'ayanda.khoza@iskool.demo', 35, 1, 41, 87, 60, '2025-11-23 09:00:00'),
(960, 'andile.mthethwa@iskool.demo', 35, 1, 73, 87, 60, '2025-11-25 09:00:00'),
(961, 'lungile.buthelezi@iskool.demo', 35, 1, 61, 87, 60, '2025-11-23 09:00:00'),
(962, 'tshepo.gumede@iskool.demo', 35, 1, 37, 87, 60, '2025-11-23 09:00:00'),
(963, 'rethabile.khoza@iskool.demo', 35, 1, 72, 87, 60, '2025-11-26 09:00:00'),
(964, 'rethabile.hlongwane@iskool.demo', 35, 1, 49, 87, 120, '2025-11-25 09:00:00'),
(965, 'sanele.mokoena@iskool.demo', 35, 1, 58, 87, 60, '2025-11-27 09:00:00'),
(966, 'lindani.sibiya@iskool.demo', 35, 1, 26, 87, 60, '2025-11-26 09:00:00'),
(967, 'tshepo.nkosi@iskool.demo', 35, 1, 53, 87, 60, '2025-11-24 09:00:00'),
(968, 'mpho.hlongwane@iskool.demo', 35, 1, 48, 87, 60, '2025-11-25 09:00:00'),
(969, 'junior.khuzwayo@iskool.demo', 35, 1, 51, 87, 60, '2025-11-24 09:00:00'),
(970, 'rethabile.vilakazi@iskool.demo', 35, 1, 57, 87, 60, '2025-11-22 09:00:00'),
(971, 'ayanda.gumede@iskool.demo', 35, 1, 46, 87, 60, '2025-11-27 09:00:00'),
(972, 'sanele.dlamini@iskool.demo', 28, 1, 77, 98, 60, '2025-10-13 09:00:00'),
(973, 'athi.hlongwane@iskool.demo', 28, 1, 83, 98, 60, '2025-10-11 09:00:00'),
(974, 'junior.khuzwayo@iskool.demo', 28, 1, 65, 98, 60, '2025-10-09 09:00:00'),
(975, 'tshepo.nkosi@iskool.demo', 28, 1, 80, 98, 60, '2025-10-12 09:00:00'),
(976, 'ofentse.mbatha@iskool.demo', 28, 1, 55, 98, 60, '2025-10-11 09:00:00'),
(977, 'lindani.vilakazi@iskool.demo', 28, 1, 87, 98, 60, '2025-10-09 09:00:00'),
(978, 'tshepo.gumede@iskool.demo', 28, 1, 83, 98, 60, '2025-10-11 09:00:00'),
(979, 'andile.mthethwa@iskool.demo', 28, 1, 64, 98, 60, '2025-10-11 09:00:00'),
(980, 'rethabile.mbatha@iskool.demo', 28, 1, 41, 98, 60, '2025-10-08 09:00:00'),
(981, 'sipho.dlamini@iskool.demo', 28, 1, 37, 98, 120, '2025-10-11 09:00:00'),
(982, 'sanele.khuzwayo@iskool.demo', 28, 1, 75, 98, 60, '2025-10-09 09:00:00'),
(983, 'bongani.mbatha@iskool.demo', 28, 1, 65, 98, 60, '2025-10-13 09:00:00'),
(984, 'sanele.mokoena@iskool.demo', 28, 1, 70, 98, 60, '2025-10-11 09:00:00'),
(985, 'ayanda.gumede@iskool.demo', 28, 1, 49, 98, 60, '2025-10-13 09:00:00'),
(986, 'rethabile.hlongwane@iskool.demo', 28, 1, 56, 98, 60, '2025-10-11 09:00:00'),
(987, 'ofentse.ngubane@iskool.demo', 28, 1, 63, 98, 60, '2025-10-12 09:00:00'),
(988, 'junior.mthembu@iskool.demo', 28, 1, 29, 98, 120, '2025-10-10 09:00:00'),
(989, 'mpho.hlongwane@iskool.demo', 28, 1, 67, 98, 120, '2025-10-08 09:00:00'),
(990, 'lungile.buthelezi@iskool.demo', 28, 1, 52, 98, 60, '2025-10-13 09:00:00'),
(991, 'lindani.sibiya@iskool.demo', 28, 1, 93, 98, 60, '2025-10-09 09:00:00'),
(992, 'rethabile.vilakazi@iskool.demo', 28, 1, 70, 98, 120, '2025-10-12 09:00:00'),
(993, 'sipho.mathenjwa@iskool.demo', 28, 1, 77, 98, 60, '2025-10-11 09:00:00'),
(994, 'lwandle.mthembu@iskool.demo', 28, 1, 81, 98, 120, '2025-10-08 09:00:00'),
(995, 'rethabile.khoza@iskool.demo', 28, 1, 86, 98, 60, '2025-10-08 09:00:00'),
(996, 'siya.vilakazi@iskool.demo', 28, 1, 29, 98, 60, '2025-10-10 09:00:00'),
(997, 'rethabile.dlamini@iskool.demo', 28, 1, 88, 98, 60, '2025-10-12 09:00:00'),
(998, 'ayanda.khoza@iskool.demo', 28, 1, 63, 98, 60, '2025-10-09 09:00:00'),
(999, 'ayanda.mathenjwa@iskool.demo', 28, 1, 48, 98, 60, '2025-10-12 09:00:00'),
(1000, 'lwandle.ngubane@iskool.demo', 28, 1, 75, 98, 120, '2025-10-11 09:00:00'),
(1001, 'rethabile.vilakazi@iskool.demo', 30, 1, 58, 92, 120, '2025-10-15 09:00:00'),
(1002, 'lwandle.mthembu@iskool.demo', 30, 1, 62, 92, 120, '2025-10-15 09:00:00'),
(1003, 'lwandle.ngubane@iskool.demo', 30, 1, 40, 92, 120, '2025-10-15 09:00:00'),
(1004, 'bongani.mbatha@iskool.demo', 30, 1, 62, 92, 120, '2025-10-14 09:00:00'),
(1005, 'rethabile.dlamini@iskool.demo', 30, 1, 49, 92, 60, '2025-10-14 09:00:00'),
(1006, 'sipho.mathenjwa@iskool.demo', 30, 1, 65, 92, 120, '2025-10-16 09:00:00'),
(1007, 'ofentse.mbatha@iskool.demo', 30, 1, 65, 92, 60, '2025-10-18 09:00:00'),
(1008, 'sanele.mokoena@iskool.demo', 30, 1, 69, 92, 60, '2025-10-17 09:00:00'),
(1009, 'ayanda.gumede@iskool.demo', 30, 1, 39, 92, 120, '2025-10-18 09:00:00'),
(1010, 'rethabile.khoza@iskool.demo', 30, 1, 45, 92, 120, '2025-10-14 09:00:00'),
(1011, 'sipho.dlamini@iskool.demo', 30, 1, 82, 92, 120, '2025-10-16 09:00:00'),
(1012, 'siya.vilakazi@iskool.demo', 30, 1, 40, 92, 120, '2025-10-17 09:00:00'),
(1013, 'rethabile.hlongwane@iskool.demo', 30, 1, 58, 92, 60, '2025-10-14 09:00:00'),
(1014, 'ayanda.mathenjwa@iskool.demo', 30, 1, 45, 92, 60, '2025-10-17 09:00:00'),
(1015, 'rethabile.mbatha@iskool.demo', 30, 1, 87, 92, 60, '2025-10-17 09:00:00'),
(1016, 'junior.mthembu@iskool.demo', 30, 1, 52, 92, 120, '2025-10-15 09:00:00'),
(1017, 'junior.khuzwayo@iskool.demo', 30, 1, 62, 92, 60, '2025-10-13 09:00:00'),
(1018, 'lungile.buthelezi@iskool.demo', 30, 1, 58, 92, 120, '2025-10-15 09:00:00'),
(1019, 'tshepo.nkosi@iskool.demo', 30, 1, 49, 92, 120, '2025-10-16 09:00:00'),
(1020, 'sanele.dlamini@iskool.demo', 30, 1, 57, 92, 120, '2025-10-14 09:00:00'),
(1021, 'lindani.vilakazi@iskool.demo', 30, 1, 50, 92, 60, '2025-10-17 09:00:00'),
(1022, 'lindani.sibiya@iskool.demo', 30, 1, 60, 92, 60, '2025-10-13 09:00:00'),
(1023, 'tshepo.gumede@iskool.demo', 30, 1, 79, 92, 60, '2025-10-13 09:00:00'),
(1024, 'ayanda.khoza@iskool.demo', 30, 1, 43, 92, 120, '2025-10-15 09:00:00'),
(1025, 'bongani.khuzwayo@iskool.demo', 30, 1, 66, 92, 60, '2025-10-16 09:00:00'),
(1026, 'mpho.hlongwane@iskool.demo', 30, 1, 45, 92, 60, '2025-10-13 09:00:00'),
(1027, 'athi.hlongwane@iskool.demo', 30, 1, 87, 92, 120, '2025-10-18 09:00:00'),
(1028, 'andile.mthethwa@iskool.demo', 30, 1, 45, 92, 60, '2025-10-15 09:00:00'),
(1029, 'ofentse.ngubane@iskool.demo', 30, 1, 51, 92, 120, '2025-10-15 09:00:00'),
(1030, 'lungile.buthelezi@iskool.demo', 29, 1, 66, 85, 120, '2025-10-15 09:00:00'),
(1031, 'siya.vilakazi@iskool.demo', 29, 1, 69, 85, 120, '2025-10-16 09:00:00'),
(1032, 'junior.mthembu@iskool.demo', 29, 1, 49, 85, 120, '2025-10-12 09:00:00'),
(1033, 'sanele.khuzwayo@iskool.demo', 29, 1, 69, 85, 60, '2025-10-12 09:00:00'),
(1034, 'bongani.mbatha@iskool.demo', 29, 1, 65, 85, 120, '2025-10-15 09:00:00'),
(1035, 'andile.mthethwa@iskool.demo', 29, 1, 62, 85, 60, '2025-10-16 09:00:00'),
(1036, 'ofentse.mbatha@iskool.demo', 29, 1, 26, 85, 60, '2025-10-14 09:00:00'),
(1037, 'rethabile.vilakazi@iskool.demo', 29, 1, 79, 85, 60, '2025-10-16 09:00:00'),
(1038, 'sipho.mathenjwa@iskool.demo', 29, 1, 38, 85, 60, '2025-10-13 09:00:00'),
(1039, 'tshepo.nkosi@iskool.demo', 29, 1, 55, 85, 120, '2025-10-12 09:00:00'),
(1040, 'ayanda.gumede@iskool.demo', 29, 1, 64, 85, 60, '2025-10-14 09:00:00'),
(1041, 'lindani.vilakazi@iskool.demo', 29, 1, 57, 85, 60, '2025-10-14 09:00:00'),
(1042, 'rethabile.dlamini@iskool.demo', 29, 1, 70, 85, 60, '2025-10-12 09:00:00'),
(1043, 'tshepo.gumede@iskool.demo', 29, 1, 34, 85, 60, '2025-10-16 09:00:00'),
(1044, 'lindani.sibiya@iskool.demo', 29, 1, 65, 85, 120, '2025-10-16 09:00:00'),
(1045, 'bongani.khuzwayo@iskool.demo', 29, 1, 60, 85, 60, '2025-10-14 09:00:00'),
(1046, 'ofentse.ngubane@iskool.demo', 29, 1, 47, 85, 60, '2025-10-13 09:00:00'),
(1047, 'sanele.dlamini@iskool.demo', 29, 1, 52, 85, 120, '2025-10-16 09:00:00'),
(1048, 'rethabile.hlongwane@iskool.demo', 29, 1, 40, 85, 60, '2025-10-13 09:00:00'),
(1049, 'junior.khuzwayo@iskool.demo', 29, 1, 55, 85, 120, '2025-10-16 09:00:00'),
(1050, 'athi.hlongwane@iskool.demo', 29, 1, 61, 85, 60, '2025-10-15 09:00:00'),
(1051, 'sipho.dlamini@iskool.demo', 29, 1, 73, 85, 60, '2025-10-16 09:00:00'),
(1052, 'lwandle.ngubane@iskool.demo', 29, 1, 69, 85, 120, '2025-10-12 09:00:00'),
(1053, 'sanele.mokoena@iskool.demo', 29, 1, 39, 85, 120, '2025-10-16 09:00:00'),
(1054, 'lwandle.mthembu@iskool.demo', 29, 1, 81, 85, 60, '2025-10-15 09:00:00'),
(1055, 'rethabile.mbatha@iskool.demo', 29, 1, 56, 85, 60, '2025-10-13 09:00:00'),
(1056, 'rethabile.khoza@iskool.demo', 29, 1, 43, 85, 60, '2025-10-16 09:00:00'),
(1057, 'mpho.hlongwane@iskool.demo', 29, 1, 53, 85, 60, '2025-10-15 09:00:00'),
(1058, 'ayanda.mathenjwa@iskool.demo', 29, 1, 45, 85, 120, '2025-10-14 09:00:00'),
(1059, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 10, '2026-01-06 07:52:14'),
(1060, 'mandlasimphiwe99@gmail.com', 37, NULL, 20, 20, 7, '2026-01-06 07:53:32'),
(1061, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 12, '2026-01-06 07:55:35'),
(1062, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 9, '2026-01-06 08:05:06'),
(1063, 'mandlasimphiwe99@gmail.com', 37, NULL, 20, 20, 6, '2026-01-06 08:09:46'),
(1064, 'mandlasimphiwe99@gmail.com', 37, NULL, 20, 20, 6, '2026-01-06 08:14:55'),
(1065, 'mandlasimphiwe99@gmail.com', 37, NULL, 20, 20, 11, '2026-01-06 08:17:02'),
(1066, 'mandlasimphiwe99@gmail.com', 37, NULL, 0, 20, 11, '2026-01-06 08:18:09'),
(1067, 'mandlasimphiwe99@gmail.com', 37, NULL, 20, 20, 5, '2026-01-06 08:25:18'),
(1068, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 6, '2026-01-06 08:31:03'),
(1069, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 6, '2026-01-06 08:40:50'),
(1070, 'mandlasimphiwe99@gmail.com', 37, NULL, 5, 20, 22, '2026-01-07 09:34:25'),
(1071, 'mandlasimphiwe99@gmail.com', 42, NULL, 5, 12, 32, '2026-01-08 05:06:07'),
(1072, 'mandlasimphiwe99@gmail.com', 44, NULL, 3, 10, 70, '2026-01-08 05:27:51'),
(1073, 'mandlasimphiwe99@gmail.com', 45, NULL, 0, 1, 469, '2026-01-08 07:22:09'),
(1074, 'mandlasimphiwe99@gmail.com', 43, NULL, 0, 5, 10870, '2026-01-08 08:16:15'),
(1075, 'mandlasimphiwe99@gmail.com', 42, NULL, 0, 12, 30453, '2026-01-08 13:32:44'),
(1076, 'mandlasimphiwe99@gmail.com', 49, NULL, 2, 2, 23, '2026-01-08 13:34:34'),
(1077, 'mandlasimphiwe99@gmail.com', 53, NULL, 0, 1, 7, '2026-01-09 10:14:33'),
(1078, 'mandlasimphiwe99@gmail.com', 51, NULL, 0, 3, 6, '2026-01-09 10:14:57'),
(1079, 'mandlasimphiwe99@gmail.com', 50, NULL, 0, 3, 7, '2026-01-09 10:15:41'),
(1080, 'mandlasimphiwe99@gmail.com', 52, NULL, 0, 3, 6, '2026-01-09 10:17:53'),
(1081, 'mandlasimphiwe99@gmail.com', 60, NULL, 2, 2, 105, '2026-01-09 15:29:58'),
(1082, 'mandi.vava@iskool.demo', 59, NULL, 0, 3, 4, '2026-01-09 15:35:57'),
(1083, 'mandi.vava@iskool.demo', 61, NULL, 2, 2, 13, '2026-01-09 16:07:45'),
(1084, 'mandlasimphiwe99@gmail.com', 58, NULL, 0, 0, 42702, '2026-01-10 03:28:30'),
(1085, 'mandlasimphiwe99@gmail.com', 62, NULL, 1, 3, 17, '2026-01-10 03:33:25'),
(1086, 'mandi.vava@iskool.demo', 63, NULL, 1, 2, 7, '2026-01-10 03:58:22'),
(1087, 'mandlasimphiwe99@gmail.com', 64, NULL, 0, 1, 1383, '2026-01-10 04:26:12'),
(1088, 'mandlasimphiwe99@gmail.com', 65, NULL, 0, 1, 9, '2026-01-10 04:38:14'),
(1089, 'mandlasimphiwe99@gmail.com', 66, NULL, 0, 1, 249, '2026-01-10 05:52:21'),
(1090, 'mandi.vava@iskool.demo', 66, NULL, 0, 1, 12, '2026-01-10 05:53:11'),
(1091, 'mandlasimphiwe99@gmail.com', 67, NULL, 0, 1, 405, '2026-01-10 06:05:52'),
(1092, 'mandlasimphiwe99@gmail.com', 68, 1, 3, 3, 16, '2026-01-10 06:40:20'),
(1093, 'mandi.vava@iskool.demo', 68, NULL, 0, 3, 17, '2026-01-10 09:48:15'),
(1094, 'mandi.vava@iskool.demo', 69, 5, 0, 3, 16, '2026-01-10 10:03:50'),
(1095, 'mandlasimphiwe99@gmail.com', 69, 5, 3, 3, 6, '2026-01-10 10:30:49'),
(1096, 'zinhle.mkhathini@iskool.demo', 69, 5, 3, 3, 21, '2026-01-10 11:13:42'),
(1097, 'zinhle.mkhathini@iskool.demo', 68, 5, 3, 3, 13, '2026-01-10 11:18:56'),
(1098, 'mandlasimphiwe99@gmail.com', 70, 5, 0, 3, 14, '2026-01-11 03:50:00'),
(1099, 'mandi.vava@iskool.demo', 70, 5, 3, 3, 60, '2026-01-11 03:52:18'),
(1100, 'zinhle.mkhathini@iskool.demo', 70, 5, 3, 3, 16, '2026-01-11 03:56:23'),
(1101, 'mandlasimphiwe99@gmail.com', 71, 5, 0, 20, 247, '2026-01-11 06:02:15'),
(1102, 'zinhle.mkhathini@iskool.demo', 71, 5, 5, 20, 178, '2026-01-11 06:35:15'),
(1103, 'mandi.vava@iskool.demo', 71, 5, 6, 20, 149, '2026-01-11 07:06:08'),
(1104, 'mandlasimphiwe99@gmail.com', 73, 5, 5, 10, 28, '2026-01-11 07:49:53'),
(1105, 'mandlasimphiwe99@gmail.com', 72, 5, 16, 21, 158, '2026-01-11 07:52:53'),
(1106, 'zinhle.mkhathini@iskool.demo', 72, 5, 11, 21, 89, '2026-01-11 08:23:45'),
(1107, 'mandi.vava@iskool.demo', 72, 5, 11, 21, 24, '2026-01-11 08:36:49'),
(1108, 'mandi.vava@iskool.demo', 75, NULL, 50, 100, 0, '2026-01-12 10:03:13'),
(1109, 'mandlasimphiwe99@gmail.com', 75, NULL, 71, 100, 0, '2026-01-13 04:59:45'),
(1110, 'zinhle.mkhathini@iskool.demo', 75, NULL, 65, 100, 0, '2026-01-12 10:03:48'),
(1111, 'mandlasimphiwe99@gmail.com', 78, 5, 14, 15, 163, '2026-01-15 09:01:16'),
(1112, 'zinhle.mkhathini@iskool.demo', 78, 5, 10, 15, 96, '2026-01-15 09:35:04'),
(1113, 'mandi.vava@iskool.demo', 78, 5, 7, 15, 69, '2026-01-15 13:02:50'),
(1114, 'mandi.vava@iskool.demo', 77, 5, 1, 3, 106, '2026-01-25 07:20:05'),
(1115, 'mandi.vava@iskool.demo', 79, 5, 2, 2, 179, '2026-01-25 07:25:33'),
(1116, 'mandi.vava@iskool.demo', 76, 5, 4, 21, 332, '2026-01-25 07:26:28'),
(1117, 'mandlasimphiwe99@gmail.com', 76, 5, 19, 21, 139, '2026-01-25 08:32:08'),
(1118, 'mandlasimphiwe99@gmail.com', 79, 5, 1, 2, 91, '2026-01-25 08:34:20'),
(1119, 'mandlasimphiwe99@gmail.com', 77, 5, 3, 3, 45, '2026-01-25 08:56:11'),
(1120, 'zinhle.mkhathini@iskool.demo', 79, 5, 2, 2, 76, '2026-01-25 09:05:55'),
(1121, 'zinhle.mkhathini@iskool.demo', 76, 5, 19, 21, 17, '2026-01-25 09:08:50'),
(1122, 'zinhle.mkhathini@iskool.demo', 77, 5, 3, 3, 74, '2026-01-25 09:12:09'),
(1123, 'zinhle.mkhathini@iskool.demo', 73, 5, 10, 10, 13, '2026-01-25 09:30:27'),
(1124, 'zinhle.mkhathini@iskool.demo', 67, 5, 1, 1, 8, '2026-01-25 09:31:45'),
(1125, 'zinhle.mkhathini@iskool.demo', 65, 5, 0, 1, 7, '2026-01-25 09:38:30'),
(1126, 'zinhle.mkhathini@iskool.demo', 66, 5, 0, 1, 1309827, '2026-01-25 09:39:16'),
(1127, 'mandlasimphiwe99@gmail.com', 81, 5, 0, 1, 4214, '2026-02-10 07:54:44'),
(1128, 'mandi.vava@iskool.demo', 80, 5, 0, 1, 27, '2026-02-10 07:58:30'),
(1129, 'mandlasimphiwe99@gmail.com', 80, 5, 0, 1, 86611, '2026-02-10 13:53:26'),
(1130, 'mandlasimphiwe99@gmail.com', 83, 5, 1, 3, 79, '2026-02-18 13:19:08'),
(1131, 'mandlasimphiwe99@gmail.com', 84, 5, 1, 1, 248, '2026-02-20 09:23:42'),
(1132, 'mandi.vava@iskool.demo', 81, 5, 0, 1, 916720, '2026-02-21 04:28:50'),
(1133, 'mandi.vava@iskool.demo', 83, 5, 0, 3, 121, '2026-02-21 04:45:18'),
(1134, 'mandi.vava@iskool.demo', 82, 5, 1, 1, 23, '2026-02-21 05:10:17'),
(1135, 'mandi.vava@iskool.demo', 84, 5, 1, 1, 10, '2026-02-21 05:29:18'),
(1136, 'mandlasimphiwe99@gmail.com', 82, 5, 0, 1, 21, '2026-02-21 07:26:09'),
(1137, 'zinhle.mkhathini@iskool.demo', 82, 5, 0, 1, 17, '2026-02-21 07:42:54'),
(1138, 'zinhle.mkhathini@iskool.demo', 83, 5, 1, 3, 92, '2026-02-21 07:48:56'),
(1139, 'zinhle.mkhathini@iskool.demo', 64, 5, 1, 1, 139, '2026-02-28 06:36:46'),
(1140, 'zinhle.mkhathini@iskool.demo', 63, 5, 1, 2, 156, '2026-02-28 06:40:49'),
(1141, 'mandlasimphiwe99@gmail.com', 87, 5, 7, 15, 180, '2026-03-01 05:27:55'),
(1142, 'mandi.vava@iskool.demo', 87, 5, 0, 15, 315, '2026-03-05 07:04:08'),
(1143, 'mandi.vava@iskool.demo', 86, 5, 0, 1, 528, '2026-03-05 07:11:59'),
(1144, 'mandi.vava@iskool.demo', 88, 5, 3, 3, 133, '2026-03-05 07:14:41'),
(1145, 'mandlasimphiwe99@gmail.com', 92, 5, 33, 55, 329, '2026-03-05 07:51:29'),
(1146, 'mandi.vava@iskool.demo', 92, 5, 31, 55, 239, '2026-03-05 07:59:14'),
(1147, 'zinhle.mkhathini@iskool.demo', 92, 5, 39, 55, 198, '2026-03-05 08:35:45'),
(1148, 'mandlasimphiwe99@gmail.com', 93, 5, 22, 36, 320, '2026-03-05 09:37:40'),
(1149, 'zinhle.mkhathini@iskool.demo', 93, 5, 10, 36, 285, '2026-03-05 09:49:56'),
(1150, 'mandi.vava@iskool.demo', 93, 5, 15, 36, 142, '2026-03-05 10:41:44'),
(1151, 'mandlasimphiwe99@gmail.com', 91, 5, 1, 3, 19, '2026-03-05 11:06:15'),
(1152, 'zinhle.mkhathini@iskool.demo', 91, 5, 3, 3, 84, '2026-03-05 11:08:33'),
(1153, 'mandlasimphiwe99@gmail.com', 94, 5, 8, 28, 162, '2026-03-05 13:18:54'),
(1154, 'zinhle.mkhathini@iskool.demo', 94, 5, 17, 28, 313, '2026-03-05 13:40:54'),
(1155, 'mandlasimphiwe99@gmail.com', 95, 5, 3, 6, 36, '2026-03-08 08:40:39'),
(1156, 'mandlasimphiwe99@gmail.com', 96, 5, 0, 0, 45, '2026-03-08 08:41:52'),
(1157, 'mandlasimphiwe99@gmail.com', 97, 5, 3, 3, 32, '2026-03-08 08:42:47'),
(1158, 'mandlasimphiwe99@gmail.com', 98, 5, 2, 3, 18, '2026-03-08 08:43:35'),
(1159, 'mandi.vava@iskool.demo', 95, 5, 1, 6, 56, '2026-03-08 08:46:35'),
(1160, 'mandi.vava@iskool.demo', 96, 5, 0, 0, 7, '2026-03-08 08:47:05'),
(1161, 'mandi.vava@iskool.demo', 97, 5, 1, 3, 19, '2026-03-08 08:47:53'),
(1162, 'mandi.vava@iskool.demo', 98, 5, 3, 3, 19, '2026-03-08 08:48:34'),
(1163, 'zinhle.mkhathini@iskool.demo', 95, 5, 4, 6, 18, '2026-03-08 08:49:35'),
(1164, 'zinhle.mkhathini@iskool.demo', 96, 5, 0, 0, 5, '2026-03-08 08:50:02'),
(1165, 'zinhle.mkhathini@iskool.demo', 97, 5, 3, 3, 14, '2026-03-08 08:50:39'),
(1166, 'zinhle.mkhathini@iskool.demo', 98, 5, 2, 3, 37, '2026-03-08 08:51:37'),
(1167, 'mandlasimphiwe99@gmail.com', 99, 5, 6, 6, 15, '2026-03-08 09:11:21'),
(1168, 'mandlasimphiwe99@gmail.com', 100, 5, 1, 3, 14, '2026-03-08 09:11:57'),
(1169, 'mandlasimphiwe99@gmail.com', 101, 5, 2, 3, 25, '2026-03-08 09:12:51'),
(1170, 'mandlasimphiwe99@gmail.com', 103, 5, 1, 1, 8, '2026-03-08 09:13:24'),
(1171, 'mandlasimphiwe99@gmail.com', 104, 5, 2, 2, 18, '2026-03-08 09:14:09'),
(1172, 'mandi.vava@iskool.demo', 101, 5, 1, 3, 35, '2026-03-08 09:17:39'),
(1173, 'mandi.vava@iskool.demo', 100, 5, 1, 3, 15, '2026-03-08 09:18:14'),
(1174, 'mandi.vava@iskool.demo', 99, 5, 2, 6, 32, '2026-03-08 09:19:10'),
(1175, 'zinhle.mkhathini@iskool.demo', 99, 5, 3, 6, 19, '2026-03-08 09:20:15'),
(1176, 'zinhle.mkhathini@iskool.demo', 100, 5, 1, 3, 42, '2026-03-08 09:21:18'),
(1177, 'zinhle.mkhathini@iskool.demo', 101, 5, 2, 3, 30, '2026-03-08 09:22:38'),
(1178, 'mandlasimphiwe99@gmail.com', 105, 5, 1, 1, 14, '2026-03-30 05:58:06'),
(1179, 'mandlasimphiwe99@gmail.com', 90, 5, 0, 1, 19, '2026-04-06 08:25:34');

-- --------------------------------------------------------

--
-- Table structure for table `resources`
--

CREATE TABLE `resources` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `class_id` int(11) NOT NULL,
  `uploaded_by` varchar(255) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) NOT NULL DEFAULT 4,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resource_type` enum('file','video') NOT NULL DEFAULT 'file',
  `video_url` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `resources`
--

INSERT INTO `resources` (`id`, `title`, `filename`, `class_id`, `uploaded_by`, `academic_year_id`, `term_number`, `uploaded_at`, `resource_type`, `video_url`) VALUES
(1, 'Testing Resource', '1766134629_Securities_Register_MandlaSimphiwe.pdf', 5, 'lerato.patel@iskool.demo', 1, 4, '2025-12-19 08:57:09', 'file', NULL),
(2, 'Another Testing', '1766134846_Securities_Register_MandlaSimphiwe.pdf', 5, 'lerato.patel@iskool.demo', 1, 4, '2025-12-19 09:00:46', 'file', NULL),
(3, 'Third Testing', '1766135373_Securities_Register_MandlaSimphiwe.pdf', 5, 'lerato.patel@iskool.demo', 1, 4, '2025-12-19 09:09:33', 'file', NULL),
(4, 'English notes', '1767451852_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-03 14:50:52', 'file', NULL),
(5, 'English notes 2', '1767452266_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-03 14:57:46', 'file', NULL),
(6, 'English notes 3', '1767452359_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-03 14:59:19', 'file', NULL),
(7, 'Isizulu Notes', '1767636683_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-05 18:11:23', 'file', NULL),
(8, 'Isizulu notes', '1767636792_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-05 18:13:12', 'file', NULL),
(9, 'Maths notes', '1767970968_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-09 15:02:48', 'file', NULL),
(10, 'Geography notes', '1767971553_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 1, 4, '2026-01-09 15:12:33', 'file', NULL),
(11, 'Testing Resource', '1768313189_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-01-13 14:06:29', 'file', NULL),
(12, 'new resource', '1769339224_namecheap-order-190158192.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-01-25 11:07:04', 'file', NULL),
(13, 'Tutorial', '1769967319_BeneficialOwnership_60007588035.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-02-01 17:35:19', 'file', NULL),
(14, 'api resource', '1770474366_namecheap-order-190158192.pdf', 1, 'thabo.nkosi@iskool.demo', 5, 1, '2026-02-07 14:26:06', 'file', NULL),
(15, 'Tutorial', '1770805912_apiresource.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-02-11 10:31:52', 'file', NULL),
(16, 'Polynomials', '1770806454_Tutorial.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-02-11 10:40:54', 'file', NULL),
(17, 'Quadratics', '1771531187_IMG_9393.jpg', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-02-19 19:59:47', 'file', NULL),
(18, 'Chapter 3 notes', '1771792460_Tutorial.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-02-22 20:34:20', 'file', NULL),
(19, 'Homework corrections', '1772641139_iSkool_Sample_Official_Letter.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-03-04 16:18:59', 'file', NULL),
(20, 'Momentum', '1774183279_apiresource.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-03-22 12:41:19', 'file', NULL),
(21, 'State SpACE', 'demo_school/1775558035_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-07 10:33:55', 'file', NULL),
(22, 'Maths notes', 'demo_school/1775652772_Tutorial.pdf', 1, 'lerato.patel@iskool.demo', 5, 1, '2026-04-08 12:52:52', 'file', NULL),
(23, 'Prime numbers', '', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-15 10:39:02', 'video', 'https://www.youtube.com/embed/5gBtzdM5M5k?rel=0&modestbranding=1'),
(24, 'Integers', 'sandbox_high_school/1776512396_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-18 11:39:56', 'file', NULL),
(25, 'Surds simplification', 'sandbox_high_school/1776686132_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-20 11:55:32', 'file', NULL),
(26, 'Surds simplification II', 'sandbox_high_school/1776686242_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-20 11:57:22', 'file', NULL),
(27, 'Chapter 8', 'sandbox_high_school/1777369298_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-28 09:41:38', 'file', NULL),
(28, 'Chapter 9', 'sandbox_high_school/1777369478_Tutorial.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-04-28 09:44:38', 'file', NULL),
(29, 'Workflows PDF', 'sandbox_high_school/1779661510_apiresource.pdf', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, '2026-05-24 22:25:10', 'file', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `school_name`
--

CREATE TABLE `school_name` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` varchar(255) DEFAULT NULL,
  `school_logo` varchar(255) DEFAULT 'Uploads/schools/default_school.png'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `school_name`
--

INSERT INTO `school_name` (`setting_key`, `setting_value`, `school_logo`) VALUES
('school_name', 'Sandbox High School', 'uploads/schools/school_logo.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `subject_briefs`
--

CREATE TABLE `subject_briefs` (
  `id` int(11) NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) NOT NULL,
  `term_number` int(11) NOT NULL,
  `subject_name` varchar(255) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `topics` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`topics`)),
  `assessments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`assessments`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `subject_briefs`
--

INSERT INTO `subject_briefs` (`id`, `class_id`, `academic_year_id`, `term_number`, `subject_name`, `created_by`, `topics`, `assessments`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 5, 1, 'Mathematics', 'thabo.nkosi@iskool.demo', '[\"Linear Equations\",\"Number Patterns\",\"Financial Maths\",\"Geometry\",\"Polynomials\",\"Probability\"]', '[{\"type\":\"Tests x3\",\"weight\":50},{\"type\":\"Assignments x1\",\"weight\":20},{\"type\":\"Labs x6\",\"weight\":30}]', 'No exam this term. We have 3 tests, 1 Assignment and 6 labs', '2026-03-02 19:46:21', '2026-03-02 19:46:21'),
(2, 1, 5, 1, 'Physical Science', 'lerato.patel@iskool.demo', '[\"Momentum\",\"Laws of Motion\",\"Dopppler Effect\",\"Vertical Projectile Motion\",\"Chartiler\'s Principle\",\"Matter and Particles\",\"Energy and Bonds\"]', '[{\"type\":\"Tests x2\",\"weight\":70},{\"type\":\"Lab and Report x1\",\"weight\":20},{\"type\":\"Assignment x1\",\"weight\":10}]', 'These are all the marks that will make up for your term 1 mark', '2026-03-02 20:02:17', '2026-03-02 20:02:17'),
(3, 1, 5, 2, 'Mathematics', 'lerato.patel@iskool.demo', '[\"Linear Equations\",\"Surds\",\"Calculus\",\"Algebra\"]', '[{\"type\":\"Tests x5\",\"weight\":90},{\"type\":\"Assignment x1\",\"weight\":10}]', 'No exam', '2026-03-03 10:31:02', '2026-03-03 10:31:02'),
(4, 1, 5, 1, 'English', 'sibusiso.mokoena@iskool.demo', '[\"Novels\",\"Short stories\",\"Verbs and Pronouns\",\"Spelling\"]', '[{\"type\":\"Assignemnts x1\",\"weight\":10},{\"type\":\"Tests x5\",\"weight\":80},{\"type\":\"Reading\",\"weight\":10}]', 'No exam', '2026-03-04 15:56:27', '2026-03-04 15:56:27'),
(5, 1, 5, 3, 'Geography', 'sibusiso.mokoena@iskool.demo', '[\"Map work\",\"Migration\",\"Socio-economic\",\"Settlements\"]', '[{\"type\":\"Tests\",\"weight\":30},{\"type\":\"assignment\",\"weight\":70}]', 'No exam this term', '2026-04-20 11:45:31', '2026-04-20 11:45:31');

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE `submissions` (
  `id` int(11) NOT NULL,
  `assignment_id` int(11) NOT NULL,
  `student_email` varchar(255) NOT NULL,
  `submission_type` enum('file','text','audio') DEFAULT 'file',
  `file_url` varchar(255) DEFAULT NULL,
  `text_answer` text DEFAULT NULL,
  `audio_url` varchar(255) DEFAULT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_late` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `submissions`
--

INSERT INTO `submissions` (`id`, `assignment_id`, `student_email`, `submission_type`, `file_url`, `text_answer`, `audio_url`, `submitted_at`, `is_late`) VALUES
(1, 11, 'mandlasimphiwe99@gmail.com', 'file', 'assignment_submissions/1770733406_namecheap-order-190158192.pdf', '', NULL, '2026-02-10 14:23:26', 0),
(2, 12, 'mandlasimphiwe99@gmail.com', 'file', 'assignment_submissions/1770736296_IEC-Contract.pdf', '', NULL, '2026-02-10 15:11:36', 0);

-- --------------------------------------------------------

--
-- Table structure for table `teacher_evaluations`
--

CREATE TABLE `teacher_evaluations` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `class_id` int(11) NOT NULL,
  `created_by` varchar(100) NOT NULL,
  `academic_year_id` int(11) NOT NULL,
  `term_number` tinyint(4) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teacher_evaluations`
--

INSERT INTO `teacher_evaluations` (`id`, `title`, `description`, `class_id`, `created_by`, `academic_year_id`, `term_number`, `is_active`, `created_at`) VALUES
(1, 'Default Teacher Evaluation', 'Standard feedback form - feel free to edit or add questions', 0, 'system', 1, 1, 1, '2025-12-20 10:56:48'),
(2, 'First Evaluation', 'This is the first evaluation', 5, 'lerato.patel@iskool.demo', 1, 4, 1, '2025-12-20 14:13:01'),
(3, 'English Evalution', 'This evaluation will help the teacher to improve the learning in class', 5, 'lerato.patel@iskool.demo', 1, 4, 1, '2025-12-23 15:19:57'),
(4, 'Physics Evaluation', 'This will help the teacher improve teaching', 6, 'lerato.patel@iskool.demo', 1, 4, 1, '2025-12-23 15:22:41'),
(5, 'Mechanics Evaluation', 'This is a mechanics evaluation', 1, 'lerato.patel@iskool.demo', 1, 4, 1, '2025-12-23 15:24:31'),
(6, 'Physical Science', 'Please participate in order to help me improve and also help your get better marks okay...', 1, 'lerato.patel@iskool.demo', 1, 4, 1, '2026-01-03 10:07:32'),
(7, 'Maths Evaluation', 'This evaluation will help me improve as a teacher please participate', 1, 'lerato.patel@iskool.demo', 1, 4, 1, '2026-01-05 13:16:02'),
(8, 'Maths Evaluation', 'This is a maths evaluation', 1, 'lerato.patel@iskool.demo', 1, 4, 1, '2026-01-05 13:18:06'),
(9, 'Testing evaluation', 'We are testing evaluation here', 1, 'lerato.patel@iskool.demo', 5, 1, 1, '2026-01-13 09:03:50'),
(10, 'vugifg', 'jfvjvgf', 1, 'lerato.patel@iskool.demo', 5, 1, 1, '2026-01-30 14:15:32'),
(11, 'Term 1 feedback', 'This is term 1 feedback for Mathematics', 1, 'lerato.patel@iskool.demo', 5, 1, 1, '2026-02-23 14:19:18'),
(12, 'Term 1 feedback', 'this is term one feed back', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, 1, '2026-03-04 10:21:54'),
(13, 'Term 1 feed back', 'new term 1 feed back', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, 1, '2026-03-04 10:43:56'),
(14, 'Term 3', 'This is term 3 evaluation please respond', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, 1, '2026-03-22 08:06:32'),
(15, 'English Evaluation', 'new evaluation please try and participate', 1, 'lerato.patel@iskool.demo', 5, 1, 1, '2026-04-08 10:08:39'),
(16, 'Term 2', 'This is for the term 2 feedback', 1, 'sibusiso.mokoena@iskool.demo', 5, 1, 1, '2026-04-20 07:47:15'),
(17, 'Signals and Systems', 'This is the evaluation for signals and systems please take it for your own benefit', 1, 'lerato.patel@iskool.demo', 5, 1, 1, '2026-05-14 06:59:32');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_reminders`
--

CREATE TABLE `teacher_reminders` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `event_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `teacher_reminders`
--

INSERT INTO `teacher_reminders` (`id`, `user_email`, `title`, `event_date`, `created_at`) VALUES
(1, 'lerato.patel@iskool.demo', 'Create Test', '2026-02-28', '2026-02-26 14:12:36'),
(2, 'thabo.nkosi@iskool.demo', 'Filters scope', '2026-03-19', '2026-03-02 16:14:08');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_subjects`
--

CREATE TABLE `teacher_subjects` (
  `id` int(11) NOT NULL,
  `teacher_email` varchar(255) NOT NULL,
  `class_id` int(11) NOT NULL,
  `subject_name` varchar(100) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `teacher_subjects`
--

INSERT INTO `teacher_subjects` (`id`, `teacher_email`, `class_id`, `subject_name`, `updated_at`) VALUES
(1, 'thabo.nkosi@iskool.demo', 5, 'Mathematics', '2025-12-13 11:03:30'),
(2, 'lerato.patel@iskool.demo', 5, 'Physical Science', '2025-12-14 09:59:48'),
(3, 'lerato.patel@iskool.demo', 6, 'Geography', '2026-01-01 00:32:59'),
(4, 'sibusiso.mokoena@iskool.demo', 1, 'Mathematics', '2026-03-08 12:57:17');

-- --------------------------------------------------------

--
-- Table structure for table `top_achievers`
--

CREATE TABLE `top_achievers` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `class` varchar(20) NOT NULL,
  `term` tinyint(4) NOT NULL,
  `medal` enum('Gold','Silver','Bronze') NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `second_name` varchar(100) DEFAULT NULL,
  `title` enum('Mr','Mrs','Ms','Dr','Prof','Rev') DEFAULT NULL,
  `surname` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('learner','teacher','parent','school_admin','admin') NOT NULL DEFAULT 'learner',
  `profile_pic` varchar(255) DEFAULT 'uploads/default_profile.png',
  `gender` enum('male','female','other') DEFAULT NULL,
  `age` int(3) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `id_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `guardian_name` varchar(100) DEFAULT NULL,
  `guardian_relationship` varchar(50) DEFAULT NULL,
  `guardian_phone` varchar(20) DEFAULT NULL,
  `guardian_email` varchar(100) DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(20) DEFAULT NULL,
  `medical_notes` text DEFAULT NULL,
  `profile_status` enum('incomplete','complete') DEFAULT 'incomplete',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Teacher direct contact number',
  `subject_specialization` varchar(100) DEFAULT NULL COMMENT 'e.g. Mathematics, Physical Sciences',
  `employment_type` enum('permanent','contract','substitute') DEFAULT NULL COMMENT 'Employment type',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_deleted` tinyint(1) DEFAULT 0,
  `profile_picture` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `second_name`, `title`, `surname`, `email`, `password`, `role`, `profile_pic`, `gender`, `age`, `date_of_birth`, `id_number`, `address`, `guardian_name`, `guardian_relationship`, `guardian_phone`, `guardian_email`, `emergency_contact_name`, `emergency_contact_phone`, `medical_notes`, `profile_status`, `phone`, `subject_specialization`, `employment_type`, `created_at`, `is_deleted`, `profile_picture`) VALUES
(1, 'Mandla', NULL, 'Mr', 'Mahlangu', 'mandlasimphiwe99@gmail.com', '$2y$10$dNMxD1Rj1WUbTzJWqB6dNeifjsfgSfAtrdDu1VBS.bMk/9e4cZOVG', 'learner', 'uploads/default_profile.png', 'male', 17, '2002-03-27', '9001065599086', '2047 Mandisa street, Tokoza', 'Zinhle Mahlangu', 'Mother', '0655750255', 'mandlasimphiwe99@gmail.com', 'Jonh Doe', '0655750255', 'No allergies', 'complete', NULL, NULL, NULL, '2025-11-29 14:02:43', 0, 'default.png'),
(2, 'Siba', NULL, 'Mr', 'Mnqovu', 'mandlasimphiwe500@gmail.com', '$2y$10$GtRQT69MicRf8APvP4NWQ.IHeb8g2A7Pi9bsghHQMmAmTa6rAEXJm', 'teacher', 'uploads/default_profile.png', 'male', 30, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-11-29 14:18:01', 0, NULL),
(3, 'Siphephelo', NULL, 'Mr', 'Ntuli', 'mandlasimphiwe510@gmail.com', '$2y$10$I071xwrl8GigQoGZCQ1EreULH.4nfjIRAmZMLobPKqOvdzDoLrtW.', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-11-29 14:32:10', 0, NULL),
(4, 'Thandeka', NULL, 'Mr', 'Mahlangu', 'admin1@gmail.com', '$2y$10$jwvedIWi7aY0FhcL.58ptOQcHEg12UzCzgDnHzifUdlAGp3Aq7Gre', 'school_admin', 'uploads/default_profile.png', 'male', 34, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-02 07:44:27', 0, NULL),
(5, 'Nwabisa', NULL, 'Mrs', 'Mahlangu', 'mandlasimphiwe100@gmail.com', '$2y$10$fghchmNcV6fwN7gBPAcU8.hlD4UWtYla5dg50AeTsth/.alYf/n4q', 'parent', 'uploads/default_profile.png', 'female', 45, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-03 07:08:28', 0, NULL),
(8, 'Super Admin', NULL, 'Mr', 'iSkool', 'superadmin@iskool.co.za', '$2y$10$1EFVPhNC9xb3qe.KmntsyOjWOVssvHkNJTZAqebsF45dLiu7SP5Xa', 'admin', 'uploads/default_profile.png', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-04 11:39:50', 0, NULL),
(25, 'Thabo', NULL, 'Mr', 'Nkosi', 'thabo.nkosi@iskool.demo', '$2y$10$lKL.z9.wGycJ.SQ3oOfmcupAVvqA.0g0tnStWAuq.rbzR9gHjpCJq', 'teacher', 'uploads/default_profile.png', 'male', 35, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:04', 0, NULL),
(26, 'Lerato', NULL, 'Mrs', 'Patel', 'lerato.patel@iskool.demo', '$2y$10$YcQpy7Zyxedl9OWMgTsHT.NTP9a/YcuKiJDRCqpuGY.mGIJeb6yUS', 'teacher', 'uploads/default_profile.png', 'female', 35, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:05', 0, 'default.png'),
(27, 'Nomsa', NULL, 'Ms', 'Khumalo', 'nomsa.khumalo@iskool.demo', '$2y$10$w4R.J9ZAD98ShfDJXJ.mvuNvBfqYHRrRwnPDXz2aKSyZNX/iKbxH2', 'teacher', 'uploads/default_profile.png', 'female', 35, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:05', 0, NULL),
(28, 'Pieter', NULL, 'Dr', 'van der Merwe', 'pieter.vandermerwe@iskool.demo', '$2y$10$KaevZZXeFOjU3.Z8YtHbce.aByZwwlK0oGMK6nAyC1ptjtiqBm2tq', 'teacher', 'uploads/default_profile.png', 'male', 35, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:05', 0, NULL),
(29, 'Sibusiso', NULL, 'Mr', 'Mokoena', 'sibusiso.mokoena@iskool.demo', '$2y$10$2ZoACtqwi4Ew1UCU/ev.GOqh5Nn/PhSaQ0xq5iWRhde.7UkvVxUXG', 'teacher', 'uploads/default_profile.png', 'male', 35, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:05', 0, NULL),
(30, 'Lungile', NULL, NULL, 'Buthelezi', 'lungile.buthelezi@iskool.demo', '$2y$10$JBKVgB8Ds24TLd8zKgZQHOMgWKDORdpmTh.sXwayVjUfn2Nyqm/A6', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:05', 0, 'default.png'),
(31, 'Lwandle', NULL, NULL, 'Ngubane', 'lwandle.ngubane@iskool.demo', '$2y$10$unkFn2L9cIRwGdSo1D.cEuYEa5MRMDfd0YYxtNWx3sWaakfSRoXZ.', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(32, 'Rethabile', NULL, NULL, 'Dlamini', 'rethabile.dlamini@iskool.demo', '$2y$10$8gnVdI7sphH4xsdfrvAEguGKZaXR4W/MlnWWnsUC6/fX0j3mVo.um', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(33, 'Ayanda', NULL, NULL, 'Khoza', 'ayanda.khoza@iskool.demo', '$2y$10$BgLiLepTB09/oyI.WrnPMe7qKCJIYeC7xoSugYS78ZbezlKCBRrBC', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(34, 'Sanele', NULL, NULL, 'Khuzwayo', 'sanele.khuzwayo@iskool.demo', '$2y$10$6XGNOKIkre5NsUWegO1AMuyyodiN/sTdgfvqnVrgHBso5Gdxm6RtK', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(35, 'Junior', NULL, NULL, 'Khuzwayo', 'junior.khuzwayo@iskool.demo', '$2y$10$9MSHlnKknd.3zGM9LY1le.r15jU19B5VufzEDxfjzwr3VtwVX753e', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(36, 'Sanele', NULL, NULL, 'Mokoena', 'sanele.mokoena@iskool.demo', '$2y$10$2Pns1poKndO6gCvc97qxnuuOjT9pVUnlZ.KdtiNDzh1/XtI07Yv7C', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(37, 'Lwandle', NULL, NULL, 'Mthembu', 'lwandle.mthembu@iskool.demo', '$2y$10$9FoN3OY4ZvMqLbyRfzjWLuWW90uh0IiM8iZyJIhFwt6lWgr3nWsZK', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:06', 0, NULL),
(38, 'Rethabile', NULL, NULL, 'Vilakazi', 'rethabile.vilakazi@iskool.demo', '$2y$10$oQ8UJ0hvlJBVubBhC3SEFuHVrqcF1iIHa8cO4wMXbKogwQRVlQVje', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(39, 'Bongani', NULL, NULL, 'Mbatha', 'bongani.mbatha@iskool.demo', '$2y$10$7wopX8OgazaGVo5Ao/2iLOMKp9SDVffzqOLUBWYoCju8ZWVGKsTMa', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(40, 'Tshepo', NULL, NULL, 'Gumede', 'tshepo.gumede@iskool.demo', '$2y$10$mg.owHhkvpbO80CLTkj/X.t9uGRnuPV4vhctm01Fx7danuOfEYOQ.', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(41, 'Andile', NULL, NULL, 'Mthethwa', 'andile.mthethwa@iskool.demo', '$2y$10$ZZ2Bz.0VSXlwKSqPRv6o3eGTwYmSXYm2ZnTRq9GhHy29KT.5Dk8Ea', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(42, 'Lindani', NULL, NULL, 'Vilakazi', 'lindani.vilakazi@iskool.demo', '$2y$10$DuyM783EzyteO7vViI3eaeDQpba/kRD2Le5tqL72NlQSi8l3/CEby', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(43, 'Rethabile', NULL, NULL, 'Hlongwane', 'rethabile.hlongwane@iskool.demo', '$2y$10$Dl3FAgzmoqAgzL.4s70bRunjE2.XlF0TlMDb6SOXREiEGVGaVD3aa', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:07', 0, NULL),
(44, 'Sanele', NULL, NULL, 'Dlamini', 'sanele.dlamini@iskool.demo', '$2y$10$C0jflluiVErgUXBUTWSpL.WSjr5aS4KIMNJX.TU9KNtFD/zmGM79e', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(45, 'Sipho', NULL, NULL, 'Dlamini', 'sipho.dlamini@iskool.demo', '$2y$10$tWvUhsI4b1.a.ZZLhlZrnuNRaKJFexQ74WRb10FfTTWr.pvwHtwcq', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(46, 'Athi', NULL, NULL, 'Hlongwane', 'athi.hlongwane@iskool.demo', '$2y$10$iL3WNaUh2u2yuG1SCXTXHOaNVXm/WsmBfqrtwE4Bl2kquuXzKut.u', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(47, 'Siya', NULL, NULL, 'Vilakazi', 'siya.vilakazi@iskool.demo', '$2y$10$kEXs8wVPyGnfSg9AmOsRae/BEin7c.8C7ExvHx55PwD9X30ECBTny', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(48, 'Ayanda', NULL, NULL, 'Gumede', 'ayanda.gumede@iskool.demo', '$2y$10$HHEZ7eWZ.VO.srWBVAo0muO4gFiKWnB6gJ9p6A35.hlu7eWWQik7i', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(49, 'Lindani', NULL, NULL, 'Sibiya', 'lindani.sibiya@iskool.demo', '$2y$10$NmlzoL7e.aaGeYsX5mp4V.RkaOKhIK/aKAViIN0DzhxMn.F720AD2', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:08', 0, NULL),
(50, 'Rethabile', NULL, NULL, 'Mbatha', 'rethabile.mbatha@iskool.demo', '$2y$10$HXtzEJb/kxGF4DXoIjRINukZqiC.eh06w25zzdlitYHqfCbYhFemq', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(51, 'Sipho', NULL, NULL, 'Mathenjwa', 'sipho.mathenjwa@iskool.demo', '$2y$10$.jdN4cptfDm2ys8RAkKS3usgAOchTNT77jQOmcF/yIyRbM1HrsJiy', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(52, 'Junior', NULL, NULL, 'Mthembu', 'junior.mthembu@iskool.demo', '$2y$10$5CD3MkphA.QS1.Lr46pJ4ONub5l5VEhrGZUm885jbvuLYU5wEMi2u', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(53, 'Ayanda', NULL, NULL, 'Mathenjwa', 'ayanda.mathenjwa@iskool.demo', '$2y$10$yCWzGH3X5Pw.jzeyAMmQ/.SgADq0EkCeTBwoHHldZ8JPT4jTzcrx.', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(54, 'Tshepo', NULL, NULL, 'Nkosi', 'tshepo.nkosi@iskool.demo', '$2y$10$NW/ShoSdL9R1hIG79S1RwOV6g1vFCl62fVpzQ0kuFhnI/yzE6aXCu', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(55, 'Bongani', NULL, NULL, 'Khuzwayo', 'bongani.khuzwayo@iskool.demo', '$2y$10$5UZOhh4DlzMADYqIoGM.JeCvwqNRvTwrMd8Fg4nunW6SiOC5k7Sg.', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(56, 'Rethabile', NULL, NULL, 'Khoza', 'rethabile.khoza@iskool.demo', '$2y$10$XltR.fQ08sPWAg41TzlxLOua3ZGMxExxHqpiwM0JgaPOYE6BzSOka', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:09', 0, NULL),
(57, 'Ofentse', NULL, NULL, 'Mbatha', 'ofentse.mbatha@iskool.demo', '$2y$10$yDlEbyMxr2Op/xxp0Iup3.6kByGdY8dPI.EOyo00aQAzo1ChaqifK', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:10', 0, NULL),
(58, 'Ofentse', NULL, NULL, 'Ngubane', 'ofentse.ngubane@iskool.demo', '$2y$10$U95gqKe2EVBUY0DSoD7zt.K8SilJQ428qi2eAGyn6NQPDdehbTQYW', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:10', 0, NULL),
(59, 'Mpho', NULL, NULL, 'Hlongwane', 'mpho.hlongwane@iskool.demo', '$2y$10$UU5G1Sc3d0Yrhin/9Pldb.AEmjGsM5zMT4yZoUexbDcGUHHTuOpUK', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:10', 0, NULL),
(60, 'Sipho', NULL, NULL, 'Shabalala', 'sipho.shabalala@iskool.demo', '$2y$10$wwsXycFRip5W.bmyZZ5f3ee2n28YXQaDGpxPRtFguwnKPs9k4ySMm', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(61, 'Athi', NULL, NULL, 'Mathenjwa', 'athi.mathenjwa@iskool.demo', '$2y$10$wai6W3r4LpC/eemSOl7Wx.iUPniroxsq39vGVUtj3JiLrEvByIq3i', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(62, 'Thando', NULL, NULL, 'Nkosi', 'thando.nkosi@iskool.demo', '$2y$10$JLIPbSgM02tAcQJxU3VSxeltFwBF0UymXlONe.Fkz1BSfH6Ni9pRu', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(63, 'Kgomotso', NULL, NULL, 'Khuzwayo', 'kgomotso.khuzwayo@iskool.demo', '$2y$10$de2LYJL18rBfk6AFwz/LXO065Z8C8bmcXpPuUWmyZqjsEt0.K0k0m', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(64, 'Zandi', NULL, NULL, 'Buthelezi', 'zandi.buthelezi@iskool.demo', '$2y$10$OBAvXWeXHYjF32Nje7SgouRVNNOw2cWnobgpRLkYkgPP3/l5rGr7W', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(65, 'Naledi', NULL, NULL, 'Ndlovu', 'naledi.ndlovu@iskool.demo', '$2y$10$wqLI54kni3cZTwIkSKeE9e1uPRU15mpQsaAyCHYimgWrFpkhOrF1O', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:11', 0, NULL),
(66, 'Thandi', NULL, NULL, 'Mhlongo', 'thandi.mhlongo@iskool.demo', '$2y$10$h1QVK2oA7zTG.4CCWBE7g.emSrhyJC38K/gmC2PxamPZfpHS4S.yW', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(67, 'Lindiwe', NULL, NULL, 'Dlamini', 'lindiwe.dlamini@iskool.demo', '$2y$10$BT8A6VxByTXGpM6jZh42MOgQuNHYObrKZgsykTlbylCsKyr4jSOOW', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(68, 'Kgomotso', NULL, NULL, 'Mthembu', 'kgomotso.mthembu@iskool.demo', '$2y$10$AjYk0rVLI1pItTz6X0yPmuJK99LfpIbfT6Sj/Ik8siVDQPN2kUD3u', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(69, 'Onthatile', NULL, NULL, 'Khoza', 'onthatile.khoza@iskool.demo', '$2y$10$..KCL3XGvwT0.HMmLygTdOftZDgsbe5J4OcUFvr79TaagM9xn7Prq', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(70, 'Tumelo', NULL, NULL, 'Ndlovu', 'tumelo.ndlovu@iskool.demo', '$2y$10$g.znp0R3zypa7RBP7Aq7QOvI9OjJTm3X9xR60l.H6HFZyQZ7uG2R6', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(71, 'Refilwe', NULL, NULL, 'Ngubane', 'refilwe.ngubane@iskool.demo', '$2y$10$OqTNj0cVv/81SkmiinG1o.7J1MF6IM9XdFJbQ185/YAhYxjGjoQUW', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(72, 'Nomvula', NULL, NULL, 'Ndlovu', 'nomvula.ndlovu@iskool.demo', '$2y$10$O1zVbbJPpZ/U/H4JHMfL8ec5TWwc3Go.gffKGNLpd2ihLpy0F.Fue', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:12', 0, NULL),
(73, 'Lerato', NULL, NULL, 'Sibiya', 'lerato.sibiya@iskool.demo', '$2y$10$nUG6VXLc3wmr9K.iiN7wv.Hd/2b1ebTTzdSHEkK0Se1YLOtsnhzCa', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(74, 'Zinhle', NULL, NULL, 'Mbatha', 'zinhle.mbatha@iskool.demo', '$2y$10$UqI1yn5UlDrGCEPUkk5FIOAB.e0VoOlv.Y/MunvjUtNvxIlokLMxu', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(75, 'Nomvula', NULL, NULL, 'Mbatha', 'nomvula.mbatha@iskool.demo', '$2y$10$T5wc/3GKFNq0lJnaO8/MpObS3eB9Wr/VwOcvg9NvulVQgrVkBa.GK', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(76, 'Precious', NULL, NULL, 'Zulu', 'precious.zulu@iskool.demo', '$2y$10$d.BiKBfDGDwaiZTBxqG57eZoxJfxzDGssSKzVDTh3TfIVekJEEhyi', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(77, 'Siphesihle', NULL, NULL, 'Shabalala', 'siphesihle.shabalala@iskool.demo', '$2y$10$yk874hhvp.USOpqolqrWPOxnVZofhu0VZRau6laRGc2A9JbRZb0na', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(78, 'Amahle', NULL, NULL, 'Hlongwane', 'amahle.hlongwane@iskool.demo', '$2y$10$BKveeBdrAeuGFu/mXDLfQOoXNwk/qnghwAMgiXPEqsFZLcxMidH0e', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(79, 'Boitumelo', NULL, NULL, 'Sithole', 'boitumelo.sithole@iskool.demo', '$2y$10$7mWhY/h3UAE6xjo10CdTVOelwqQVbPTAJkIxpiuIeWdnRfSZcSpgK', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:13', 0, NULL),
(80, 'Nokuthula', NULL, NULL, 'Khoza', 'nokuthula.khoza@iskool.demo', '$2y$10$gioGgx21AzY9l40AYRvDvuYb0vR64aJrOJq1W2yT469cemBB3RyY2', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(81, 'Zandi', NULL, NULL, 'Nkosi', 'zandi.nkosi@iskool.demo', '$2y$10$Fb3kMrTHeDpLx78pL7GcpeTxHAP1GzxR/Z9qWj1nO78uJt0rFFPWy', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(82, 'Ntokozo', NULL, NULL, 'Ndlovu', 'ntokozo.ndlovu@iskool.demo', '$2y$10$klhUO4.kujcFDFGWU/97oeg0cEcd1I73Xo8wd.VbvAPDOIu8WlUTS', 'learner', 'uploads/default_profile.png', 'female', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(83, 'Nomvula', NULL, NULL, 'Mhlongo', 'nomvula.mhlongo@iskool.demo', '$2y$10$rNCBW7cXlN29ETPcpZ5HFuA.4alIHArEuu0LbtJ/UGUlPK8zi1IwG', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(84, 'Thandi', NULL, NULL, 'Khoza', 'thandi.khoza@iskool.demo', '$2y$10$0HiXyNHevAXxsdJRED/gS.prOBvxsqhzUiqvpcZ9pCwWd0D4eXn.K', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(85, 'Nokuthula', NULL, NULL, 'Gumede', 'nokuthula.gumede@iskool.demo', '$2y$10$znnOSmWgk2Mnk4cQVJT0D.IxAPIWaXedtcREWkNs0LvIgq/H5TNxi', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:14', 0, NULL),
(86, 'Refilwe', NULL, NULL, 'Sithole', 'refilwe.sithole@iskool.demo', '$2y$10$idWHaRu/Gl0vmGzMwDYWIeOP0lDG9Ir5feNG8OMJijaHjrhqLs7fC', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:15', 0, NULL),
(87, 'Dineo', NULL, NULL, 'Gumede', 'dineo.gumede@iskool.demo', '$2y$10$ak/LsceLNDBhYBa/cxCkP.53NdESHybnPgk.evN.DvC6XjwCKmxDC', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:15', 0, NULL),
(88, 'Tumelo', NULL, NULL, 'Shabalala', 'tumelo.shabalala@iskool.demo', '$2y$10$uZfDxY5xTnDbqxniD1wMt.n6ZCIRxK0KXv/yTY7SAwfQQDQ/EhU/.', 'learner', 'uploads/default_profile.png', 'female', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:15', 0, NULL),
(89, 'Zandi', NULL, NULL, 'Shabalala', 'zandi.shabalala@iskool.demo', '$2y$10$duDvkATF8rCYknT7oMtVjul.P/46pCWDCo0o.nkvGcRb16p5yZiBy', 'learner', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-10 12:07:15', 0, NULL),
(90, 'Thulani', NULL, NULL, 'Mthembu', 'extra0_thulani.mthembu@iskool.demo', '$2y$10$626614BJt6DYKLDcSKxlUekStlexuAk6ZgG0EqICRXehFu.awUsVq', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:16', 0, NULL),
(91, 'Siyabonga', NULL, NULL, 'Dlamini', 'extra1_siyabonga.dlamini@iskool.demo', '$2y$10$jUsYU5DpRuPZNOlgXyLu/ORZ1n1.rDM6zOC4lhLbx4AncVrLBrdFq', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:17', 0, NULL),
(92, 'Nkosinathi', NULL, NULL, 'Zungu', 'extra2_nkosinathi.zungu@iskool.demo', '$2y$10$D8VHhbtPeTb2W8hNKdiXcOC9xKA5N7M5SzlWvhKRqTR4xs89EqBB2', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:18', 0, NULL),
(93, 'Mthokozisi', NULL, NULL, 'Mkhize', 'extra3_mthokozisi.mkhize@iskool.demo', '$2y$10$6bDzhhz4islNKxgvNl6rBOVXm1wNg4hCDCNgMqKHf3hI8HfzcITHK', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:18', 0, NULL),
(94, 'Sandile', NULL, NULL, 'Nene', 'extra4_sandile.nene@iskool.demo', '$2y$10$/3ziccDuByiNwGFrXJoqVuDQnIcU526aT4/OpOpZ37TwTStBgpfkO', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:18', 0, NULL),
(95, 'Mzwandile', NULL, NULL, 'Gumede', 'extra5_mzwandile.gumede@iskool.demo', '$2y$10$XnMzOusxbSr5FdP0EEv8COKMKmyW7TDByMDXPXK4AN3fkA7XBXTUm', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:18', 0, NULL),
(96, 'Bhekumuzi', NULL, NULL, 'Shabalala', 'extra6_bhekumuzi.shabalala@iskool.demo', '$2y$10$E7BHsYtYOmJtNXTrsacud.EOJx.HLGvM6JbGXfVcqMXkz5mlLWc8a', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:18', 0, NULL),
(97, 'Mandla', NULL, NULL, 'Mthethwa', 'extra7_mandla.mthethwa@iskool.demo', '$2y$10$kMyBk/OuatCwx6.u3LkoBevEhICbVnKMMONBz/NVoWQ15riNSTbWm', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:19', 0, NULL),
(98, 'Sifiso', NULL, NULL, 'Nkosi', 'extra8_sifiso.nkosi@iskool.demo', '$2y$10$6wf6SAI8k0ynIa610JSRmekCRDsZVb1fh2EwzUYe6gke2GWLM6uzm', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:19', 0, NULL),
(99, 'Xolani', NULL, NULL, 'Khoza', 'extra9_xolani.khoza@iskool.demo', '$2y$10$u4iEsUiob/wXvDzaXrCGAOq.51wlQmbH8ahGk9.yKxCHjb6nza.JK', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:19', 0, NULL),
(100, 'Mlungisi', NULL, NULL, 'Sibiya', 'extra10_mlungisi.sibiya@iskool.demo', '$2y$10$JZkCrWoHpKoaRr8wGkhhW..bvvH4tf8CHHq/0rc9JQw8vaxgl5ceu', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:19', 0, NULL),
(101, 'Dumisani', NULL, NULL, 'Ndlovu', 'extra11_dumisani.ndlovu@iskool.demo', '$2y$10$ejYyIuMDjNtYmysGWfKCXeDRU/j9b4MEsztYKihe37z4T/QBbwniq', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:20', 0, NULL),
(102, 'Bonginkosi', NULL, NULL, 'Buthelezi', 'extra12_bonginkosi.buthelezi@iskool.demo', '$2y$10$av.PHb/bqqu5PUs9eH53v.SP8qi78xj.lsNmlyHGP4Y2iMs1os5Xe', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:20', 0, NULL),
(103, 'Siphelele', NULL, NULL, 'Hlongwane', 'extra13_siphelele.hlongwane@iskool.demo', '$2y$10$AuF2UTRvpPT3n3y2G1gdZ.w2yVBaR8cnECUu1ThA.2LpzWqYzjXuG', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:20', 0, NULL),
(104, 'Mvelo', NULL, NULL, 'Mbatha', 'extra14_mvelo.mbatha@iskool.demo', '$2y$10$.U6WrlD4ZSLde5dAQ0x4LuZQRtg8trVUrpsDBE13Qa406OjGYv2vW', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2025-12-11 15:03:20', 0, NULL),
(105, 'Zinhle', NULL, 'Ms', 'Mkhathini', 'zinhle.mkhathini@iskool.demo', '$2y$10$Cp6CZME/FfwG/UKmqsgb.ed9nTLE6mUUlSl8DGCkO/MDmTSMuBUAa', 'learner', 'uploads/default_profile.png', 'female', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-01-03 15:18:53', 0, 'default.png'),
(106, 'Mandi', NULL, 'Ms', 'Vava', 'mandi.vava@iskool.demo', '$2y$10$OS2OLsvxbU3nJ18ToYHPne6RdE3BndCRHqQB3LfzKiVlw0ny2oOX2', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-01-09 20:27:08', 0, NULL),
(107, 'Mandla', NULL, 'Mr', 'Mahlangu', 'johannesmahlangu101@gmail.com', '$2y$10$CyWHjNaPes12kikojHUe3OfPsHdoSqivfQ0IQz1UV5q8fULmT4Jsu', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-01-12 19:41:37', 0, NULL),
(108, 'Zandi', NULL, 'Ms', 'Ndlovu', 'zandi.ndlovu@iskool.demo', '$2y$10$mXJ7TI3uLpGmxq6DJm7q.Ob1MJDzjS9iC09tt89R1V2JZz77DJN2W', 'parent', 'uploads/default_profile.png', 'female', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-01-21 09:55:41', 0, NULL),
(109, 'Thandi', NULL, 'Mr', '.mokoena', 'Thandi.mokoena@iskool.demo', '$2y$10$S0oRq0PUcj1M0noKOqgvu.VaI.F568aLBFt.AckwVvaEEpMnjefEe', 'learner', 'uploads/default_profile.png', 'male', 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-03-22 12:49:43', 0, NULL),
(110, 'Thando', NULL, 'Mr', 'Mokoena', 'thando.mokoena@iskool.demo', '$2y$10$Mb2GxnN46c.wA6t0oh9JCujUeTEq8i8VaCRZ3EIFGhAVTu7qHxpo.', 'teacher', 'uploads/default_profile.png', 'male', 32, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-03-22 12:53:53', 0, NULL),
(111, 'Mandla', NULL, 'Mr', 'Mahlangu2', 'johannesmahlangu102@gmail.com', '$2y$10$ZpWAkPN0h.8F4G.B5mfqLOhZF6coQQPlVYaJeEARNsYNCjHQjcC7y', 'learner', 'uploads/default_profile.png', 'male', 17, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-05-04 09:55:40', 0, NULL),
(112, 'Mandla2', NULL, 'Mrs', 'Mahlangu2', 'mandlasimphiwe099@gmail.com', '$2y$10$.SHSfR0LRehoZmb//d7POO75Bj563uNwD3PNVUet2rrFLFNWeqTq2', 'learner', 'uploads/default_profile.png', 'male', 18, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-05-04 10:16:47', 0, NULL),
(113, 'Mandla', NULL, 'Mr', 'Mahlangu', 'mandla_mahlangu@icloud.com', '$2y$10$fOUxZJDWJdawGnRO3hEgmOgG9GjgRWmTfnMjeVePLjUsb9maW8Csy', 'learner', 'uploads/default_profile.png', 'male', 16, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'incomplete', NULL, NULL, NULL, '2026-05-04 10:19:00', 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_answers`
--

CREATE TABLE `user_answers` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) DEFAULT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `result_id` int(11) DEFAULT NULL,
  `question_id` int(11) NOT NULL,
  `selected_choice_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_answers`
--

INSERT INTO `user_answers` (`id`, `user_email`, `quiz_id`, `result_id`, `question_id`, `selected_choice_id`) VALUES
(1, NULL, NULL, 1059, 396, 1),
(2, NULL, NULL, 1059, 397, 6),
(3, NULL, NULL, 1060, 396, 1),
(4, NULL, NULL, 1060, 397, 5),
(5, NULL, NULL, 1061, 396, 1),
(6, NULL, NULL, 1061, 397, 8),
(7, NULL, NULL, 1062, 396, 1),
(8, NULL, NULL, 1062, 397, 6),
(9, NULL, NULL, 1063, 396, 1),
(10, NULL, NULL, 1063, 397, 5),
(11, NULL, NULL, 1065, 396, 1),
(12, NULL, NULL, 1065, 397, 5),
(13, NULL, NULL, 1066, 396, 2),
(14, NULL, NULL, 1066, 397, 6),
(15, NULL, NULL, 1067, 396, 1),
(16, NULL, NULL, 1067, 397, 5),
(17, NULL, NULL, 1068, 396, 1),
(18, NULL, NULL, 1068, 397, 7),
(19, NULL, NULL, 1069, 396, 1),
(20, NULL, NULL, 1069, 397, 7),
(21, NULL, NULL, 1070, 396, 1),
(22, NULL, NULL, 1070, 397, 6),
(23, NULL, NULL, 1071, 403, 29),
(24, NULL, NULL, 1071, 404, 34),
(25, 'mandlasimphiwe99@gmail.com', 43, NULL, 405, 40),
(28, 'mandlasimphiwe99@gmail.com', 44, NULL, 406, 41),
(29, 'mandlasimphiwe99@gmail.com', 44, NULL, 407, 47),
(31, NULL, NULL, 1072, 406, 41),
(32, NULL, NULL, 1072, 407, 47),
(33, 'mandlasimphiwe99@gmail.com', 45, NULL, 408, 51),
(34, NULL, NULL, 1073, 408, 51),
(35, NULL, NULL, 1074, 405, 40),
(36, 'mandlasimphiwe99@gmail.com', 49, NULL, 412, 65),
(38, NULL, NULL, 1076, 412, 65),
(39, 'mandlasimphiwe99@gmail.com', 53, NULL, 416, 82),
(40, NULL, NULL, 1077, 416, 82),
(41, 'mandlasimphiwe99@gmail.com', 51, NULL, 414, 74),
(42, NULL, NULL, 1078, 414, 74),
(43, 'mandlasimphiwe99@gmail.com', 50, NULL, 413, 71),
(44, NULL, NULL, 1079, 413, 71),
(45, 'mandlasimphiwe99@gmail.com', 52, NULL, 415, 79),
(46, NULL, NULL, 1080, 415, 79),
(47, 'mandlasimphiwe99@gmail.com', 60, NULL, 421, 101),
(49, NULL, NULL, 1081, 421, 101),
(50, 'mandi.vava@iskool.demo', 59, NULL, 420, 98),
(51, NULL, NULL, 1082, 420, 98),
(52, 'mandi.vava@iskool.demo', 61, 1083, 422, 105),
(55, 'mandlasimphiwe99@gmail.com', 62, 1085, 423, 110),
(56, 'mandlasimphiwe99@gmail.com', 62, 1085, 424, 113),
(57, 'mandlasimphiwe99@gmail.com', 62, 1085, 425, 118),
(61, 'mandi.vava@iskool.demo', 63, 1086, 426, 122),
(62, 'mandi.vava@iskool.demo', 63, 1086, 427, 125),
(65, 'mandlasimphiwe99@gmail.com', 65, 1088, 429, 134),
(67, 'mandlasimphiwe99@gmail.com', 66, 1089, 430, 138),
(69, 'mandi.vava@iskool.demo', 66, 1090, 430, 138),
(70, 'mandlasimphiwe99@gmail.com', 68, 1092, 432, 145),
(73, 'mandi.vava@iskool.demo', 68, 1093, 432, 147),
(75, 'mandi.vava@iskool.demo', 69, 1094, 433, 150),
(77, 'mandlasimphiwe99@gmail.com', 69, 1095, 433, 149),
(79, 'zinhle.mkhathini@iskool.demo', 69, 1096, 433, 149),
(82, 'zinhle.mkhathini@iskool.demo', 68, 1097, 432, 145),
(85, 'mandlasimphiwe99@gmail.com', 70, 1098, 434, 154),
(87, 'mandi.vava@iskool.demo', 70, 1099, 434, 153),
(92, 'zinhle.mkhathini@iskool.demo', 70, 1100, 434, 153),
(96, 'zinhle.mkhathini@iskool.demo', 71, 1102, 438, 171),
(97, 'zinhle.mkhathini@iskool.demo', 71, 1102, 437, 166),
(98, 'zinhle.mkhathini@iskool.demo', 71, 1102, 435, 158),
(99, 'zinhle.mkhathini@iskool.demo', 71, 1102, 436, 161),
(104, 'mandi.vava@iskool.demo', 71, 1103, 436, 163),
(105, 'mandi.vava@iskool.demo', 71, 1103, 435, 160),
(106, 'mandi.vava@iskool.demo', 71, 1103, 438, 170),
(110, 'mandi.vava@iskool.demo', 71, 1103, 437, 166),
(111, 'mandlasimphiwe99@gmail.com', 73, 1104, 444, 193),
(112, 'mandlasimphiwe99@gmail.com', 73, 1104, 445, 198),
(115, 'mandlasimphiwe99@gmail.com', 72, 1105, 439, 173),
(116, 'mandlasimphiwe99@gmail.com', 72, 1105, 441, 181),
(117, 'mandlasimphiwe99@gmail.com', 72, 1105, 440, 177),
(118, 'mandlasimphiwe99@gmail.com', 72, 1105, 443, 190),
(119, 'mandlasimphiwe99@gmail.com', 72, 1105, 442, 185),
(125, 'zinhle.mkhathini@iskool.demo', 72, 1106, 439, 174),
(126, 'zinhle.mkhathini@iskool.demo', 72, 1106, 442, 185),
(127, 'zinhle.mkhathini@iskool.demo', 72, 1106, 441, 181),
(129, 'zinhle.mkhathini@iskool.demo', 72, 1106, 440, 177),
(130, 'zinhle.mkhathini@iskool.demo', 72, 1106, 443, 190),
(131, 'mandi.vava@iskool.demo', 72, 1107, 443, 189),
(132, 'mandi.vava@iskool.demo', 72, 1107, 441, 182),
(134, 'mandi.vava@iskool.demo', 72, 1107, 439, 174),
(135, 'mandi.vava@iskool.demo', 72, 1107, 442, 185),
(137, 'mandi.vava@iskool.demo', 72, 1107, 440, 177),
(138, 'mandlasimphiwe99@gmail.com', 78, 1111, 454, 236),
(139, 'mandlasimphiwe99@gmail.com', 78, 1111, 455, 237),
(140, 'mandlasimphiwe99@gmail.com', 78, 1111, 456, 241),
(141, 'mandlasimphiwe99@gmail.com', 78, 1111, 457, 245),
(142, 'mandlasimphiwe99@gmail.com', 78, 1111, 458, 249),
(148, 'zinhle.mkhathini@iskool.demo', 78, 1112, 457, 246),
(149, 'zinhle.mkhathini@iskool.demo', 78, 1112, 456, 241),
(150, 'zinhle.mkhathini@iskool.demo', 78, 1112, 458, 249),
(151, 'zinhle.mkhathini@iskool.demo', 78, 1112, 455, 237),
(153, 'zinhle.mkhathini@iskool.demo', 78, 1112, 454, 236),
(154, 'mandi.vava@iskool.demo', 78, 1113, 456, 243),
(155, 'mandi.vava@iskool.demo', 78, 1113, 458, 249),
(156, 'mandi.vava@iskool.demo', 78, 1113, 457, 246),
(158, 'mandi.vava@iskool.demo', 78, 1113, 454, 236),
(159, 'mandi.vava@iskool.demo', 78, 1113, 455, 237),
(160, 'mandi.vava@iskool.demo', 77, 1114, 453, 232),
(161, 'mandi.vava@iskool.demo', 77, 1114, 452, 225),
(164, 'mandi.vava@iskool.demo', 76, 1116, 447, 207),
(165, 'mandi.vava@iskool.demo', 76, 1116, 449, 213),
(166, 'mandi.vava@iskool.demo', 79, 1115, 460, 257),
(167, 'mandi.vava@iskool.demo', 79, 1115, 459, 253),
(172, 'mandlasimphiwe99@gmail.com', 76, 1117, 451, 221),
(173, 'mandlasimphiwe99@gmail.com', 76, 1117, 446, 201),
(174, 'mandlasimphiwe99@gmail.com', 76, 1117, 450, 217),
(175, 'mandlasimphiwe99@gmail.com', 76, 1117, 448, 209),
(176, 'mandlasimphiwe99@gmail.com', 76, 1117, 449, 213),
(178, 'mandlasimphiwe99@gmail.com', 76, 1117, 447, 207),
(182, 'mandlasimphiwe99@gmail.com', 79, 1118, 460, 260),
(184, 'mandlasimphiwe99@gmail.com', 79, 1118, 459, 253),
(185, 'mandlasimphiwe99@gmail.com', 77, 1119, 453, 229),
(186, 'mandlasimphiwe99@gmail.com', 77, 1119, 452, 225),
(188, 'zinhle.mkhathini@iskool.demo', 79, 1120, 460, 257),
(190, 'zinhle.mkhathini@iskool.demo', 79, 1120, 459, 253),
(191, 'zinhle.mkhathini@iskool.demo', 76, 1121, 449, 213),
(192, 'zinhle.mkhathini@iskool.demo', 76, 1121, 446, 201),
(193, 'zinhle.mkhathini@iskool.demo', 76, 1121, 447, 207),
(194, 'zinhle.mkhathini@iskool.demo', 76, 1121, 451, 221),
(195, 'zinhle.mkhathini@iskool.demo', 76, 1121, 450, 217),
(196, 'zinhle.mkhathini@iskool.demo', 76, 1121, 448, 209),
(197, 'zinhle.mkhathini@iskool.demo', 77, 1122, 453, 229),
(198, 'zinhle.mkhathini@iskool.demo', 77, 1122, 452, 225),
(201, 'zinhle.mkhathini@iskool.demo', 73, 1123, 444, 193),
(202, 'zinhle.mkhathini@iskool.demo', 73, 1123, 445, 197),
(205, 'zinhle.mkhathini@iskool.demo', 67, 1124, 431, 141),
(207, 'zinhle.mkhathini@iskool.demo', 65, 1125, 429, 134),
(209, 'mandi.vava@iskool.demo', 80, 1128, 461, 262),
(211, 'mandlasimphiwe99@gmail.com', 83, 1130, 466, 283),
(212, 'mandlasimphiwe99@gmail.com', 83, 1130, 465, 277),
(213, 'mandlasimphiwe99@gmail.com', 83, 1130, 464, 275),
(219, 'mandlasimphiwe99@gmail.com', 84, 1131, 467, 285),
(221, 'mandi.vava@iskool.demo', 83, 1133, 465, 279),
(222, 'mandi.vava@iskool.demo', 83, 1133, 464, 274),
(223, 'mandi.vava@iskool.demo', 83, 1133, 466, 282),
(227, 'mandi.vava@iskool.demo', 82, 1134, 463, 269),
(229, 'mandi.vava@iskool.demo', 84, 1135, 467, 285),
(231, 'mandlasimphiwe99@gmail.com', 82, 1136, 463, 271),
(233, 'zinhle.mkhathini@iskool.demo', 82, 1137, 463, 270),
(235, 'zinhle.mkhathini@iskool.demo', 83, 1138, 464, 276),
(236, 'zinhle.mkhathini@iskool.demo', 83, 1138, 466, 283),
(237, 'zinhle.mkhathini@iskool.demo', 83, 1138, 465, 277),
(245, 'zinhle.mkhathini@iskool.demo', 86, NULL, 468, 289),
(247, 'zinhle.mkhathini@iskool.demo', 64, 1139, 428, 129),
(249, 'zinhle.mkhathini@iskool.demo', 63, 1140, 426, 121),
(251, 'zinhle.mkhathini@iskool.demo', 63, 1140, 427, 126),
(254, 'mandlasimphiwe99@gmail.com', 87, 1141, 473, 309),
(255, 'mandlasimphiwe99@gmail.com', 87, 1141, 470, 297),
(256, 'mandlasimphiwe99@gmail.com', 87, 1141, 472, 306),
(257, 'mandlasimphiwe99@gmail.com', 87, 1141, 471, 303),
(262, 'zinhle.mkhathini@iskool.demo', 87, NULL, 469, 293),
(263, 'mandi.vava@iskool.demo', 88, 1144, 474, 313),
(265, 'mandlasimphiwe99@gmail.com', 92, 1145, 484, 353),
(266, 'mandlasimphiwe99@gmail.com', 92, 1145, 488, 369),
(267, 'mandlasimphiwe99@gmail.com', 92, 1145, 480, 337),
(268, 'mandlasimphiwe99@gmail.com', 92, 1145, 486, 363),
(269, 'mandlasimphiwe99@gmail.com', 92, 1145, 481, 341),
(270, 'mandlasimphiwe99@gmail.com', 92, 1145, 483, 349),
(271, 'mandlasimphiwe99@gmail.com', 92, 1145, 485, 357),
(279, 'mandi.vava@iskool.demo', 92, 1146, 482, 346),
(280, 'mandi.vava@iskool.demo', 92, 1146, 480, 339),
(281, 'mandi.vava@iskool.demo', 92, 1146, 479, 335),
(282, 'mandi.vava@iskool.demo', 92, 1146, 487, 366),
(284, 'mandi.vava@iskool.demo', 92, 1146, 488, 369),
(286, 'mandi.vava@iskool.demo', 92, 1146, 485, 357),
(288, 'mandi.vava@iskool.demo', 92, 1146, 486, 363),
(290, 'mandi.vava@iskool.demo', 92, 1146, 483, 349),
(291, 'mandi.vava@iskool.demo', 92, 1146, 484, 353),
(292, 'mandi.vava@iskool.demo', 92, 1146, 481, 341),
(294, 'zinhle.mkhathini@iskool.demo', 92, 1147, 479, 333),
(295, 'zinhle.mkhathini@iskool.demo', 92, 1147, 483, 351),
(296, 'zinhle.mkhathini@iskool.demo', 92, 1147, 482, 345),
(297, 'zinhle.mkhathini@iskool.demo', 92, 1147, 486, 361),
(298, 'zinhle.mkhathini@iskool.demo', 92, 1147, 484, 353),
(300, 'zinhle.mkhathini@iskool.demo', 92, 1147, 481, 341),
(302, 'zinhle.mkhathini@iskool.demo', 92, 1147, 487, 366),
(303, 'zinhle.mkhathini@iskool.demo', 92, 1147, 488, 369),
(305, 'zinhle.mkhathini@iskool.demo', 92, 1147, 485, 357),
(306, 'zinhle.mkhathini@iskool.demo', 92, 1147, 480, 339),
(308, 'mandlasimphiwe99@gmail.com', 93, 1148, 492, 385),
(309, 'mandlasimphiwe99@gmail.com', 93, 1148, 490, 377),
(310, 'mandlasimphiwe99@gmail.com', 93, 1148, 489, 376),
(311, 'mandlasimphiwe99@gmail.com', 93, 1148, 494, 394),
(312, 'mandlasimphiwe99@gmail.com', 93, 1148, 495, 399),
(313, 'mandlasimphiwe99@gmail.com', 93, 1148, 496, 401),
(314, 'mandlasimphiwe99@gmail.com', 93, 1148, 491, 381),
(315, 'mandlasimphiwe99@gmail.com', 93, 1148, 493, 389),
(324, 'zinhle.mkhathini@iskool.demo', 93, 1149, 489, 373),
(325, 'zinhle.mkhathini@iskool.demo', 93, 1149, 492, 388),
(326, 'zinhle.mkhathini@iskool.demo', 93, 1149, 493, 390),
(327, 'zinhle.mkhathini@iskool.demo', 93, 1149, 491, 384),
(328, 'zinhle.mkhathini@iskool.demo', 93, 1149, 496, 402),
(329, 'zinhle.mkhathini@iskool.demo', 93, 1149, 495, 397),
(330, 'zinhle.mkhathini@iskool.demo', 93, 1149, 490, 377),
(331, 'zinhle.mkhathini@iskool.demo', 93, 1149, 494, 394),
(338, 'mandi.vava@iskool.demo', 93, 1150, 493, 389),
(339, 'mandi.vava@iskool.demo', 93, 1150, 492, 388),
(341, 'mandi.vava@iskool.demo', 93, 1150, 496, 402),
(342, 'mandi.vava@iskool.demo', 93, 1150, 490, 377),
(343, 'mandi.vava@iskool.demo', 93, 1150, 489, 373),
(344, 'mandi.vava@iskool.demo', 93, 1150, 495, 397),
(345, 'mandi.vava@iskool.demo', 93, 1150, 491, 384),
(346, 'mandi.vava@iskool.demo', 93, 1150, 494, 394),
(347, 'mandlasimphiwe99@gmail.com', 91, 1151, 477, 325),
(348, 'mandlasimphiwe99@gmail.com', 91, 1151, 478, 330),
(351, 'zinhle.mkhathini@iskool.demo', 91, 1152, 477, 325),
(352, 'zinhle.mkhathini@iskool.demo', 91, 1152, 478, 329),
(355, 'mandlasimphiwe99@gmail.com', 94, 1153, 497, 405),
(356, 'mandlasimphiwe99@gmail.com', 94, 1153, 498, 409),
(358, 'mandlasimphiwe99@gmail.com', 94, 1153, 499, 415),
(359, 'mandlasimphiwe99@gmail.com', 94, 1153, 503, 432),
(360, 'mandlasimphiwe99@gmail.com', 94, 1153, 501, 421),
(366, 'zinhle.mkhathini@iskool.demo', 94, 1154, 498, 409),
(367, 'zinhle.mkhathini@iskool.demo', 94, 1154, 503, 432),
(368, 'zinhle.mkhathini@iskool.demo', 94, 1154, 500, 417),
(369, 'zinhle.mkhathini@iskool.demo', 94, 1154, 501, 421),
(370, 'zinhle.mkhathini@iskool.demo', 94, 1154, 502, 425),
(371, 'zinhle.mkhathini@iskool.demo', 94, 1154, 499, 414),
(372, 'zinhle.mkhathini@iskool.demo', 94, 1154, 497, 407),
(380, 'mandlasimphiwe99@gmail.com', 95, 1155, 504, 433),
(381, 'mandlasimphiwe99@gmail.com', 95, 1155, 505, 437),
(382, 'mandlasimphiwe99@gmail.com', 95, 1155, 506, 443),
(386, 'mandlasimphiwe99@gmail.com', 97, 1157, 507, 445),
(387, 'mandlasimphiwe99@gmail.com', 97, 1157, 508, 449),
(391, 'mandlasimphiwe99@gmail.com', 98, 1158, 509, 454),
(392, 'mandlasimphiwe99@gmail.com', 98, 1158, 510, 457),
(395, 'mandi.vava@iskool.demo', 95, 1159, 504, 433),
(396, 'mandi.vava@iskool.demo', 95, 1159, 505, 438),
(397, 'mandi.vava@iskool.demo', 95, 1159, 506, 442),
(401, 'mandi.vava@iskool.demo', 97, 1161, 507, 445),
(402, 'mandi.vava@iskool.demo', 97, 1161, 508, 450),
(405, 'mandi.vava@iskool.demo', 98, 1162, 509, 453),
(406, 'mandi.vava@iskool.demo', 98, 1162, 510, 457),
(409, 'zinhle.mkhathini@iskool.demo', 95, 1163, 506, 441),
(410, 'zinhle.mkhathini@iskool.demo', 95, 1163, 504, 433),
(411, 'zinhle.mkhathini@iskool.demo', 95, 1163, 505, 438),
(415, 'zinhle.mkhathini@iskool.demo', 97, 1165, 508, 449),
(416, 'zinhle.mkhathini@iskool.demo', 97, 1165, 507, 445),
(419, 'zinhle.mkhathini@iskool.demo', 98, 1166, 509, 454),
(420, 'zinhle.mkhathini@iskool.demo', 98, 1166, 510, 457),
(423, 'mandlasimphiwe99@gmail.com', 99, 1167, 513, 469),
(424, 'mandlasimphiwe99@gmail.com', 99, 1167, 512, 465),
(425, 'mandlasimphiwe99@gmail.com', 99, 1167, 511, 461),
(429, 'mandlasimphiwe99@gmail.com', 100, 1168, 514, 473),
(431, 'mandlasimphiwe99@gmail.com', 100, 1168, 515, 480),
(434, 'mandlasimphiwe99@gmail.com', 101, 1169, 516, 482),
(435, 'mandlasimphiwe99@gmail.com', 101, 1169, 517, 485),
(438, 'mandlasimphiwe99@gmail.com', 103, 1170, 518, 489),
(440, 'mandlasimphiwe99@gmail.com', 104, 1171, 519, 493),
(442, 'mandi.vava@iskool.demo', 101, 1172, 516, 481),
(444, 'mandi.vava@iskool.demo', 101, 1172, 517, 487),
(449, 'mandi.vava@iskool.demo', 100, 1173, 515, 478),
(451, 'mandi.vava@iskool.demo', 100, 1173, 514, 473),
(454, 'mandi.vava@iskool.demo', 99, 1174, 512, 465),
(455, 'mandi.vava@iskool.demo', 99, 1174, 513, 471),
(456, 'mandi.vava@iskool.demo', 99, 1174, 511, 463),
(460, 'zinhle.mkhathini@iskool.demo', 99, 1175, 513, 469),
(461, 'zinhle.mkhathini@iskool.demo', 99, 1175, 512, 468),
(462, 'zinhle.mkhathini@iskool.demo', 99, 1175, 511, 462),
(466, 'zinhle.mkhathini@iskool.demo', 100, 1176, 514, 473),
(467, 'zinhle.mkhathini@iskool.demo', 100, 1176, 515, 480),
(470, 'zinhle.mkhathini@iskool.demo', 101, 1177, 516, 482),
(471, 'zinhle.mkhathini@iskool.demo', 101, 1177, 517, 485),
(474, 'mandlasimphiwe99@gmail.com', 105, 1178, 520, 497),
(476, 'mandlasimphiwe99@gmail.com', 90, 1179, 476, 322);

-- --------------------------------------------------------

--
-- Table structure for table `user_subscriptions`
--

CREATE TABLE `user_subscriptions` (
  `id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_subscriptions`
--

INSERT INTO `user_subscriptions` (`id`, `user_email`, `endpoint`, `p256dh`, `auth`, `created_at`) VALUES
(468, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QDPOCKQ3UBfdbTkMzmTe_bQn0VRKJrmNkXoBXgobzu1I1DW9SheWqlKz52YRit3q53KkySnnVrsjMOs6C0nibrP7XR9fmjjPl0o-pXEaM87CVJdnERakPtgPIANt-fikmFmIqj1sMt1aJejhppeYXIIXJWeaRISN8AYr0zFnJ9M', 'BCNCcLszlx1wiWEtKveUoyVnIAS9GgqngtRiFZ3rrnQB5yB5MXbFY4vUgh9T9o0ieyKinCQxtUdCvQS95Vpv-jw', 'aOvUiMlAl380vZkKUK-i1Q', '2026-02-07 15:17:04'),
(551, 'mandi.vava@iskool.demo', 'https://web.push.apple.com/QDPOCKQ3UBfdbTkMzmTe_bQn0VRKJrmNkXoBXgobzu1I1DW9SheWqlKz52YRit3q53KkySnnVrsjMOs6C0nibrP7XR9fmjjPl0o-pXEaM87CVJdnERakPtgPIANt-fikmFmIqj1sMt1aJejhppeYXIIXJWeaRISN8AYr0zFnJ9M', 'BCNCcLszlx1wiWEtKveUoyVnIAS9GgqngtRiFZ3rrnQB5yB5MXbFY4vUgh9T9o0ieyKinCQxtUdCvQS95Vpv-jw', 'aOvUiMlAl380vZkKUK-i1Q', '2026-02-10 12:56:45'),
(599, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QHfwJELXXs4dCFvyNPpcM8OB2KLaBHKt8omvi7V_hmc9vr9wgJINgVfM6SkhM6wQtpH-7D-P_M1N-v5GM680mx6qtClZh01cJe86f60Dl7LFCubKZCI_EDECSWcBBN9pJCR56CMZQclv_l978gmR2glGskv6fb5cKjiyuODcJpA', 'BBk4njkZmrJdFRmLKpdLZ0JugL4uT9zrERkJU-PCZu7aj-sGtkBzxpzPvAvV-4kIEcH2MikxqDc7J1egG-UGhjI', '13jfIpr4FRFVp0O5QnKW7g', '2026-02-18 17:58:36'),
(640, 'zinhle.mkhathini@iskool.demo', 'https://web.push.apple.com/QHfwJELXXs4dCFvyNPpcM8OB2KLaBHKt8omvi7V_hmc9vr9wgJINgVfM6SkhM6wQtpH-7D-P_M1N-v5GM680mx6qtClZh01cJe86f60Dl7LFCubKZCI_EDECSWcBBN9pJCR56CMZQclv_l978gmR2glGskv6fb5cKjiyuODcJpA', 'BBk4njkZmrJdFRmLKpdLZ0JugL4uT9zrERkJU-PCZu7aj-sGtkBzxpzPvAvV-4kIEcH2MikxqDc7J1egG-UGhjI', '13jfIpr4FRFVp0O5QnKW7g', '2026-02-21 19:40:41'),
(642, 'mandi.vava@iskool.demo', 'https://web.push.apple.com/QHfwJELXXs4dCFvyNPpcM8OB2KLaBHKt8omvi7V_hmc9vr9wgJINgVfM6SkhM6wQtpH-7D-P_M1N-v5GM680mx6qtClZh01cJe86f60Dl7LFCubKZCI_EDECSWcBBN9pJCR56CMZQclv_l978gmR2glGskv6fb5cKjiyuODcJpA', 'BBk4njkZmrJdFRmLKpdLZ0JugL4uT9zrERkJU-PCZu7aj-sGtkBzxpzPvAvV-4kIEcH2MikxqDc7J1egG-UGhjI', '13jfIpr4FRFVp0O5QnKW7g', '2026-02-21 19:42:50'),
(747, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QHLuxpcVa27YTPmEnP-LFpY-hgG6_JmNWW2HIy_ajXxb5OEMugL3gFPG4NUrwhWlVyr4rB2GSytWQ6S3satJ_bZNjEizLdAT18AdfTAr0gDcnpOB7uySl4WUozSHpVTaNviAr1YbdQ1MBpChPrO87G_wRdlOdCnxNUw86JB4fVw', 'BG6PzSn9sHCUpsumyWUG3X7ez-GsjfJEr7IDjfaroxRMb9-SnimzCZKO9ryoReSryfkluJMin671uwjgvySV0N4', '_jv93wZbexVc64U8jaqrxg', '2026-04-07 10:31:16'),
(790, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QFvK-o-kU4-r_6gA1SVfvlUVA7IlCqzq9DPTs0kbt5AgZHwepORFex0f3fvnn55ZLHo2hLioWs786izPCHM_v5aA2C3enGck4n0FYpxlW7mhqLbDiXqbHduPBhB6y-YPbl5Cs39GKovaJ06vz11HR3L03cPB1TwBjFH5FpJgJ6M', 'BKNyx9kLIvdRZsJJAXn64Tu3F07EnOhNLRKDs3ZE1oEl2Q4Qalcrt9mvE2EtzTdFCHCAJa14CravYwadM8DLJ5k', 'OiOEpkggZGsv5RXx-0L_iA', '2026-04-19 19:26:19'),
(793, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QLGnQqg2-BeUXvYiu889WeMjjp1vOZsVxbomrtIyOijXfisw0MTI-oSmpTQ6NcaT6_GN2PirZo1FgD6hJqbFcw9l7ppVrfK9cvBNqYqjqt7m_vjyImBtWgb97l0lCXk05O29ri9_2_p5yYOh_RCCBP4pTdsXl1vK0vXVEB7wytg', 'BHSwmiLyXXdp2jexI8fS7Cc4jM3BjAPf3V0SgsmvhUBYr6m_MUEoNbVGbqdX0oIj0szPEV0EwE_QVzeWthI-4as', 'YqHIbZB9_lcJAXQ0RIY0xQ', '2026-04-19 19:57:07'),
(795, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QNe_CUGTUq7uXRJQ-UGNzVv62WcY7mr99-3vg9ns2GFTRChcQ7GCsFMuY-wFEGfCz_wQ1lIexIiZiAZ1mf8AMoCcqKAeoj-gBOUozjfih8gzVBMMcrxRuOUGzGh6UNcY82d2WrA1aUNh8XZJxJifTYd_FI9vBeDYWXG5jhjYh0M', 'BByrTwmRq5u2tGi5b48roKRZ4BTE6DWRbB4zXEJeoSmXbklW_POIpvy8U9_2sLuVrXBCPADWrmfxBZxz2xPm85c', '0JzC0cBUeDpc2yLrTe2jDw', '2026-04-19 20:29:38'),
(796, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QLAcdJVT1bPBSKRPT9ueS1xXTwYlIupNHC0GCouAFADsPgk2CJ3wV4e1eB17UjIA5raKn5N8kQrWfec_BGn4J3UspTT9MB42c8L_-xwte8AxusJnsTDFS4JnePyF79Hp-fHZj6mksGMIAY0QcI5Tl6mm0xz0kVtHqdBAphP2XSQ', 'BM4ywOrE-A-iT587mmtbrVcEnn6ghCP8T1cAMEs_GWEMy2Dqm_IzpjKDiF_tlN3czz5viSaiXr6KwixIKeG8cNw', 'WH3fBz6ih-N8d2exKBjcLQ', '2026-04-19 20:39:18'),
(797, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QCIRjSjiqR2ju5bdOIjXsU6aeV4blwA3L_mPeLqJG71nZy_ZAtwD9UjNJm6BpMusKaobv1s2omdB0NZN4X_14Ttxqrf6Ms4c3pYgi5EwEY1TycDaCnSzVC8ioMaDDOfvecDTM1N5Ns68EYkZjfp-IgWeLaPLf-9-gZrBbOstAQU', 'BJL_XsFWc4NncjgU9lHbt0-61wsDZ0S_b2XvyzEafS_rd9OctyJ_19ytEpBXeBZgbYdGoTAEZZk-DKUGP3b-EfM', 'bOT3X_owOO80aWv7ml3P0w', '2026-04-19 20:49:13'),
(798, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QHInxphf5P85oprk7yP5DcQPj_akANic2q7xV1KVFcx21Ck9DN24F8Y7Vc-MfIW5Be_dbHdSG0Urrj8B0aK54wAdKhrz6tZrSY-35ZGtnmnbJHRll0KTfpE0O8ImIMxL1xy6qJDL9ZsO4CJ8fMDNaRiQImrFK1w3VJa65HUAzSY', 'BFERPbiZmsZxttbT_Oi9cdOZRkVQRqUW8IErVqiAzMec3cDcl9X149gGtNyeKRaPa8iFKutrUR7kIEqzyHRIG9w', 'dD50_8uJTAsk7HmsidsEpw', '2026-04-19 21:14:04'),
(799, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QA4jsrhbL5JwSKgoyMuADIBmxbp7HORitz8mzQzlT2TDzAN5wsJvLmbCYdpB-ZdjiRjbb5cCInyDQA7_DMjgRuVw9SE3bdC6mP_iJKMMSMRyzhgNeKTd3cDTvfu93-hMeMywvQo5GPZNcdPIEC2TaITNtgxKEYh3eKbgwvd-GdA', 'BHMpZ5Br6FWkAA11zJMSBOLTNok8LVULx7eXKfVpmpwPBKZ-ll09qHjE6acB5IIhZBwJ0EwkK15xrl-2i9ThHYo', '1v1QmzXh8jLReR3eGhOJEA', '2026-04-19 21:20:11'),
(800, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QMr_IfH2oIp0l4nuSIEzfXcXOKZH03cnqGrsUf56r09vvKk-RfvmFXLF_VtEVzjdLxZiFZRLmLpVjjxK9QYB6nFKcVSN_yvKhsPKp-IzBRk8RO-gprrsHWu06cgnsAgmaLKMZiu9_MQTCcnG9RbNrd8lNZSNYaNqEZ2Ouw0Uaic', 'BNL8eB-oPzukuqvtbGOxrz4qplSySkWU8w_LkUhaQTodmCbWwZFG9AJx8uGYfNSmDZVm_ujTENPR-oLC5SsH23o', '8VNuSUi6iJeme_YEL8tV1Q', '2026-04-19 21:33:21'),
(806, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QBazzdruY_L2C4vzDuM88z8bGCtlIahkV4moWNOGYLNlqbl0l_A0QNxzE_zfLNIUDRDA0lzM-wY8Wj8CTsuUaJCfEU773HMswCwxAz8hU6JIdhBshpirqWLO7215pMYpd4y1mhQGZB3GaVOHqGtLwYC2KnhmF0cZLDSsu3BgAIo', 'BEMiBgXGtwY0MPF6A-4af68TU9FBhjOoG2qKqZJIV7uv4FHYM5XdNDkIN8ZONDtxP_n_v-Qfm763SkriJ4UVQSM', 'Lug6kfTDhbtU7YO61uNLjQ', '2026-04-20 09:35:18'),
(807, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QIn8tZEDFL3oZZDU_MzNJQbRs-fMnPnfKtRMsVERNDZ-CP_XsgmBIfzSUlLl87S-0VGAcIGIpT_t9EVR1rO8hXN3BRNTt-cgwwcPYfWYxctdBbbOBQIWSxRquTFfH4eBBeUh25v1icBAAdPh8mt6DWz518vUMrV7ohh4l3eH53w', 'BAfhnvxvz0YVV4NfY27xMr2oIbmbYkNcrIrqATt3wqGaIa2fB22I6w1WyhpRSm0zikcwIEXo4LMfSI4n3Bw8GFw', 'adFvTBIoG9MsRJKFPNdZ8A', '2026-04-20 10:00:25'),
(809, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QB9PM0Ch7nt7juAxIaFiZ3e22hPLiplZqNy0xVWM37efaRlPexTR8hfing65mn9M1tGmit9S9wSbUjNwRxtX3A_hlL9AuWy1k19ghnkGnvM0M4qhS5y4cZKW7p4U8PGGXWilGwkdEjTpFNT7v2CC0A5ZrN3OQX-yIJopjDCAGtQ', 'BKTH3I5Z697zyR16xC5APGdI1GfplmnXyNYPHcyH-CDE4e-Lzfb-3m6MXG_p1EY-mR-9UiFpENGezw4C3473Orc', 'Rf4we8-tLAaeva76nPenHQ', '2026-04-20 11:29:15'),
(967, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QM8mg4J0GDZ6ecjptMQMVpFUZTkijqobtDdLRLz8UmLM87Gynkr2rCUsaGRwAteZS5GFaAwCbvHr7_jeI9Edtl5WPULMVJ05-_GXgz15zVhjJvA7RANsJEZa7CE931e3BMBFhjqZsSaV9_PEGbZ4jujb9leQT8gQ48ZDhI3V-Ho', 'BNgrLj-eITFguTGzlXsM3h3QoWmYyBbkfagfPYAKLtG9IcFExI_cGHQWAxUOiOLQQ5TilULi7fcLidskKv82q8U', 'mDrRJJS2f82O9Cs_OdD0ig', '2026-05-13 10:51:26'),
(1054, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QFv9AbHdxMW08wRMJvaJmMEO-RWL893hbC9M9gF-A8K_xVgnK2F2UzSPb8JqlwgW7q2sfslMZf7WBU-vdpWM6K48VSHFoQ5bsoZKXiwJ2aWu5bb5vpEjDI_AgT4BvhLyPCkkkcGRBwmfbx7ZzOaenW5YBuSp4L6b5F3Hy8bIjto', 'BI8e6vbuwfHSd3FR5eR8gwMkvucSaeAfI7GsroVus9QNs3GYHNMlkQ1z5kebeBwZm5PwonDG-9H71hX22YeSPxg', 'Q0JYCyDXgHSIg6WfGlWjWw', '2026-05-17 12:47:46'),
(1059, 'mandlasimphiwe99@gmail.com', 'https://web.push.apple.com/QErw6ucEvQfhao-EyqRdLPCqmj5rw-QXpW7QAtdILst6o2y2dRASzImXF-yVbF_As7BlQc7p1RdpcZk7OHpHA3RGbQF4kQEX7QNmEFM6rx-5hY9aiQRxboX57q88vkSlS2NRhb5l-whmM-3HvdLuxao_Cjc9QoZ2fP9ZKAw0ZkY', 'BISUEpAkZ9-PJXkMunGpzmrPRDhfcnc9j6YryvYsNiGXqIDIz_mxIwsdlStXFhTjuanvscBxsrRHjz5X-WLBLvA', 'SFm-OyQalb9T9tJAVw--rQ', '2026-05-17 13:15:05');

-- --------------------------------------------------------

--
-- Table structure for table `user_tokens`
--

CREATE TABLE `user_tokens` (
  `id` int(11) NOT NULL,
  `selector` char(12) NOT NULL,
  `hashed_validator` char(64) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `expiry` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_tokens`
--

INSERT INTO `user_tokens` (`id`, `selector`, `hashed_validator`, `user_email`, `expiry`) VALUES
(2, '43074523676c', 'de6d2305793cddb517185ccd112e57a8a7db812a65e96a2f2b65e863f322b2a4', 'mandlasimphiwe99@gmail.com', '2026-02-05 00:05:25'),
(23, '52470d9ac021', '7add124f76b4a28fd878dfac88561223befb397d005d34eff28945d75f9e8e2b', 'mandlasimphiwe99@gmail.com', '2026-02-25 19:41:45'),
(30, '3ad205d741be', '14a1978f67178e6c27ec1e78b81757b8a24ad2453a8f7fcda1675c5e8031479c', 'mandlasimphiwe99@gmail.com', '2026-03-03 19:29:37'),
(31, '7a22f58ae90a', 'ac2ab22aa836576e70ca1d983b70fd2b961f71acc2f9cee239635629b6de2b46', 'mandlasimphiwe99@gmail.com', '2026-03-08 20:42:53'),
(32, '6fa269dd78cc', 'c40ffc6a8960a5e48ef834f207b96e75165e6fb87beb628f964ed40bd7bb5f79', 'mandlasimphiwe99@gmail.com', '2026-03-08 21:11:36'),
(33, 'a4be98a5913b', '0646848dcbab5bf20c2126b4c210c2e3d3b5f002c56012e8cead61a9a96ff926', 'mandlasimphiwe99@gmail.com', '2026-03-08 22:36:42'),
(36, '3662baa9bd77', '22e7867811861d3cfd69c9d81d98e7d57b12c053e8aba3a519fde09898045d6d', 'mandlasimphiwe99@gmail.com', '2026-03-14 11:21:09'),
(49, '16054792b87b', 'b06ad2c597a2a2828c0e7ea4a99bac71c36cde1a18fe9d3e5d0c2b167d0da54b', 'mandlasimphiwe99@gmail.com', '2026-04-25 16:26:25'),
(52, '2b4b9f25a5fa', '5a9865f2f1b67bff73a30ced75312b4b3f70241f956828e2b453d3c73d6b52b2', 'mandlasimphiwe99@gmail.com', '2026-05-15 17:26:51'),
(53, '8c3ac1abcd47', '05d892ff6ce46ded669100ea89b110c2efcc81293834083b9149b2cd32fa814a', 'mandlasimphiwe99@gmail.com', '2026-05-19 21:25:45'),
(54, 'fd98c74fa885', 'd6276228798aa6696c24ee8fbff9ffecddb8bb2b844a7181cdf364061d0a5407', 'mandlasimphiwe99@gmail.com', '2026-05-19 21:56:24'),
(55, '06d36fb45a86', 'bc89864137edd636e18aa1771a81f1f5f164ef920ad8fe7ca98382127501effd', 'mandlasimphiwe99@gmail.com', '2026-05-19 22:29:29'),
(56, 'e4bb149b4b90', '206d6f3990e4e18ad57ac678fcf114a1229456e650de3a8283feca829f2bcf4c', 'mandlasimphiwe99@gmail.com', '2026-05-19 22:39:07'),
(57, '19d40eccf832', '24e280648c9f82a3ff550d12ae29ee47b5a44857b02b4eeb9f89d38a78f4d954', 'mandlasimphiwe99@gmail.com', '2026-05-19 22:49:05'),
(58, 'b89315bbf7c6', '58e5b343e631b9d0527f24edabeff560792371f9adbc82e6060068f3b7edcbb6', 'mandlasimphiwe99@gmail.com', '2026-05-20 00:33:00'),
(59, '5df859a69de0', 'd7ddba51128e0c2e07849a7b4a1bcaa23475f43bdd2cb14b95d4443df82513cb', 'mandlasimphiwe99@gmail.com', '2026-05-20 11:35:08'),
(60, '29e04429d551', '6241e25ea99ba2feaadc80f37ef0675d6b83622918b78dda914b7c8fb98404cf', 'mandlasimphiwe99@gmail.com', '2026-05-20 12:00:18'),
(62, '8148c7af93dc', 'bbb212aff799a3dce48ff048fb92c1e3bdd4c1f7a9658cda0d487d7dc93400aa', 'mandlasimphiwe99@gmail.com', '2026-06-04 11:50:27'),
(63, 'b5f83600ec94', '931f9bec3981008514ba99f3296331ea5dfd5e8cf01235091bfa86f1bf9d743b', 'mandlasimphiwe99@gmail.com', '2026-06-11 21:46:37'),
(66, 'c39dffb7ecb2', 'ca3ecefa7104005385b1ebe994003b4930bfc6b468d6f17eb82676b3c4122528', 'mandlasimphiwe99@gmail.com', '2026-06-15 15:31:08'),
(67, '9c05159c8ed6', '4df46649533e9666ced5622123890d1eba86ae05457ee20f9207af8c31779d6b', 'mandlasimphiwe99@gmail.com', '2026-06-16 14:27:41'),
(68, '2e512548b39b', 'c3274c83de85043870bb31b7bc3e720e9e789bc7d2e04dfe0b2013e5b1812082', 'mandlasimphiwe99@gmail.com', '2026-06-16 15:14:50');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `academic_events`
--
ALTER TABLE `academic_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `academic_year_id` (`academic_year_id`);

--
-- Indexes for table `academic_years`
--
ALTER TABLE `academic_years`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_year_per_school` (`school_id`,`name`),
  ADD KEY `idx_current` (`school_id`,`is_current`);

--
-- Indexes for table `access_keys`
--
ALTER TABLE `access_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `access_key` (`access_key`),
  ADD KEY `role` (`role`),
  ADD KEY `access_key_2` (`access_key`);

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `idx_announcement_term` (`term_number`);

--
-- Indexes for table `answers`
--
ALTER TABLE `answers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `assignments`
--
ALTER TABLE `assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_assignment_term` (`term_number`);

--
-- Indexes for table `choices`
--
ALTER TABLE `choices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `classes`
--
ALTER TABLE `classes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `class_discussions`
--
ALTER TABLE `class_discussions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_class` (`class_id`),
  ADD KEY `idx_creator` (`creator_email`),
  ADD KEY `academic_year_id` (`academic_year_id`);

--
-- Indexes for table `class_students`
--
ALTER TABLE `class_students`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `fk_class_students_year` (`academic_year_id`),
  ADD KEY `idx_cs_student_year_class` (`student_email`,`academic_year_id`,`class_id`);

--
-- Indexes for table `discussion_replies`
--
ALTER TABLE `discussion_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `discussion_id` (`discussion_id`),
  ADD KEY `parent_reply_id` (`parent_reply_id`);

--
-- Indexes for table `discussion_reports`
--
ALTER TABLE `discussion_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `discussion_id` (`discussion_id`),
  ADD KEY `reply_id` (`reply_id`),
  ADD KEY `academic_year_id` (`academic_year_id`);

--
-- Indexes for table `discussion_teachers`
--
ALTER TABLE `discussion_teachers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_disc_teacher` (`discussion_id`,`teacher_email`);

--
-- Indexes for table `discussion_typing`
--
ALTER TABLE `discussion_typing`
  ADD PRIMARY KEY (`discussion_id`,`user_email`);

--
-- Indexes for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `statement_id` (`statement_id`),
  ADD KEY `idx_response` (`response_id`);

--
-- Indexes for table `evaluation_responses`
--
ALTER TABLE `evaluation_responses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_hash` (`unique_hash`),
  ADD KEY `idx_eval` (`evaluation_id`);

--
-- Indexes for table `evaluation_statements`
--
ALTER TABLE `evaluation_statements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_eval` (`evaluation_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `parent_links`
--
ALTER TABLE `parent_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_link` (`parent_email`,`learner_email`),
  ADD UNIQUE KEY `uniq_learner_class` (`learner_email`,`class_id`),
  ADD KEY `class_id` (`class_id`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `quizquestions`
--
ALTER TABLE `quizquestions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `quiz_id` (`quiz_id`);

--
-- Indexes for table `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_quizzes_year_class` (`academic_year_id`,`class_id`),
  ADD KEY `idx_quizzes_created_class` (`created_by`,`class_id`);

--
-- Indexes for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_quiz_unique` (`user_email`,`quiz_id`);

--
-- Indexes for table `quiz_integrity_logs`
--
ALTER TABLE `quiz_integrity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `quiz_id` (`quiz_id`),
  ADD KEY `user_email` (`user_email`);

--
-- Indexes for table `quiz_results`
--
ALTER TABLE `quiz_results`
  ADD PRIMARY KEY (`id`),
  ADD KEY `quiz_id` (`quiz_id`),
  ADD KEY `idx_qr_user_quiz` (`user_email`,`quiz_id`),
  ADD KEY `idx_qr_quiz_user` (`quiz_id`,`user_email`);

--
-- Indexes for table `resources`
--
ALTER TABLE `resources`
  ADD PRIMARY KEY (`id`),
  ADD KEY `class_id` (`class_id`),
  ADD KEY `idx_resource_term` (`term_number`);

--
-- Indexes for table `school_name`
--
ALTER TABLE `school_name`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `subject_briefs`
--
ALTER TABLE `subject_briefs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_brief` (`class_id`,`academic_year_id`,`term_number`,`created_by`);

--
-- Indexes for table `submissions`
--
ALTER TABLE `submissions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `teacher_evaluations`
--
ALTER TABLE `teacher_evaluations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_class` (`class_id`);

--
-- Indexes for table `teacher_reminders`
--
ALTER TABLE `teacher_reminders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `teacher_subjects`
--
ALTER TABLE `teacher_subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_teacher_class` (`teacher_email`,`class_id`);

--
-- Indexes for table `top_achievers`
--
ALTER TABLE `top_achievers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_answers`
--
ALTER TABLE `user_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_answer` (`user_email`,`quiz_id`,`question_id`),
  ADD UNIQUE KEY `unique_user_answer` (`user_email`,`quiz_id`,`question_id`),
  ADD KEY `result_id` (`result_id`),
  ADD KEY `question_id` (`question_id`),
  ADD KEY `selected_choice_id` (`selected_choice_id`);

--
-- Indexes for table `user_subscriptions`
--
ALTER TABLE `user_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_device` (`user_email`,`endpoint`(255)),
  ADD KEY `user_email` (`user_email`);

--
-- Indexes for table `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_email` (`user_email`),
  ADD KEY `selector` (`selector`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `academic_events`
--
ALTER TABLE `academic_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `academic_years`
--
ALTER TABLE `academic_years`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `access_keys`
--
ALTER TABLE `access_keys`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=86;

--
-- AUTO_INCREMENT for table `answers`
--
ALTER TABLE `answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `assignments`
--
ALTER TABLE `assignments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `choices`
--
ALTER TABLE `choices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=529;

--
-- AUTO_INCREMENT for table `classes`
--
ALTER TABLE `classes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `class_discussions`
--
ALTER TABLE `class_discussions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `class_students`
--
ALTER TABLE `class_students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=82;

--
-- AUTO_INCREMENT for table `discussion_replies`
--
ALTER TABLE `discussion_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `discussion_reports`
--
ALTER TABLE `discussion_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `discussion_teachers`
--
ALTER TABLE `discussion_teachers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `evaluation_responses`
--
ALTER TABLE `evaluation_responses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `evaluation_statements`
--
ALTER TABLE `evaluation_statements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=187;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `parent_links`
--
ALTER TABLE `parent_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `platform_settings`
--
ALTER TABLE `platform_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `questions`
--
ALTER TABLE `questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quizquestions`
--
ALTER TABLE `quizquestions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=528;

--
-- AUTO_INCREMENT for table `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=114;

--
-- AUTO_INCREMENT for table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1178;

--
-- AUTO_INCREMENT for table `quiz_integrity_logs`
--
ALTER TABLE `quiz_integrity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=259;

--
-- AUTO_INCREMENT for table `quiz_results`
--
ALTER TABLE `quiz_results`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1180;

--
-- AUTO_INCREMENT for table `resources`
--
ALTER TABLE `resources`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `subject_briefs`
--
ALTER TABLE `subject_briefs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `submissions`
--
ALTER TABLE `submissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `teacher_evaluations`
--
ALTER TABLE `teacher_evaluations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `teacher_reminders`
--
ALTER TABLE `teacher_reminders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `teacher_subjects`
--
ALTER TABLE `teacher_subjects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `top_achievers`
--
ALTER TABLE `top_achievers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=114;

--
-- AUTO_INCREMENT for table `user_answers`
--
ALTER TABLE `user_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=478;

--
-- AUTO_INCREMENT for table `user_subscriptions`
--
ALTER TABLE `user_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1143;

--
-- AUTO_INCREMENT for table `user_tokens`
--
ALTER TABLE `user_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `academic_events`
--
ALTER TABLE `academic_events`
  ADD CONSTRAINT `academic_events_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  ADD CONSTRAINT `academic_events_ibfk_2` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`);

--
-- Constraints for table `discussion_replies`
--
ALTER TABLE `discussion_replies`
  ADD CONSTRAINT `discussion_replies_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `discussion_replies_ibfk_2` FOREIGN KEY (`parent_reply_id`) REFERENCES `discussion_replies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `discussion_reports`
--
ALTER TABLE `discussion_reports`
  ADD CONSTRAINT `discussion_reports_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `discussion_reports_ibfk_2` FOREIGN KEY (`reply_id`) REFERENCES `discussion_replies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `discussion_teachers`
--
ALTER TABLE `discussion_teachers`
  ADD CONSTRAINT `discussion_teachers_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  ADD CONSTRAINT `evaluation_answers_ibfk_1` FOREIGN KEY (`response_id`) REFERENCES `evaluation_responses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evaluation_answers_ibfk_2` FOREIGN KEY (`statement_id`) REFERENCES `evaluation_statements` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_responses`
--
ALTER TABLE `evaluation_responses`
  ADD CONSTRAINT `evaluation_responses_ibfk_1` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_eval_res` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_statements`
--
ALTER TABLE `evaluation_statements`
  ADD CONSTRAINT `evaluation_statements_ibfk_1` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_eval_stmt` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD CONSTRAINT `user_tokens_ibfk_1` FOREIGN KEY (`user_email`) REFERENCES `users` (`email`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
