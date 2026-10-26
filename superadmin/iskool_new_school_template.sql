-- ============================================================
--  iSkool LMS — New School Database Template
--  Version: 1.0.0
--  Generated: March 2026
--  Usage: Run this file when onboarding a new school.
--         Replace the placeholder values marked with <<REPLACE>>
--         before running.
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- ============================================================
--  SECTION 1: SCHOOL IDENTITY
-- ============================================================

CREATE TABLE `school_name` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- <<REPLACE>> Update school name before running
INSERT INTO `school_name` (`setting_key`, `setting_value`) VALUES
('school_name', 'School Name Here');

-- ============================================================
--  SECTION 2: PLATFORM SETTINGS
-- ============================================================

CREATE TABLE `platform_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `platform_settings` (`setting_key`, `setting_value`) VALUES
('maintenance_mode', '0');

-- ============================================================
--  SECTION 3: ACCESS KEYS
--  These are the registration codes users enter to sign up.
--  <<REPLACE>> Change these to unique codes per school.
-- ============================================================

CREATE TABLE `access_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role` enum('learner','teacher','parent','school_admin') NOT NULL,
  `access_key` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- <<REPLACE>> Generate unique access keys per school
INSERT INTO `access_keys` (`role`, `access_key`) VALUES
('learner',      'LEARNER-<<SCHOOL_CODE>>'),
('teacher',      'TEACHER-<<SCHOOL_CODE>>'),
('parent',       'PARENT-<<SCHOOL_CODE>>'),
('school_admin', 'ADMIN-<<SCHOOL_CODE>>');

-- ============================================================
--  SECTION 4: ACADEMIC YEARS
--  <<REPLACE>> Update year values to match the school's
--  current academic year at time of onboarding.
-- ============================================================

CREATE TABLE `academic_years` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `school_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(20) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_current` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- <<REPLACE>> Update year and dates as needed
INSERT INTO `academic_years` (`school_id`, `name`, `start_date`, `end_date`, `is_current`) VALUES
(1, '2026', '2026-01-01', '2026-12-31', 1);

-- ============================================================
--  SECTION 5: USERS
-- ============================================================

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `surname` varchar(100) DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('learner','teacher','parent','school_admin','admin') NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `title` varchar(20) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- <<REPLACE>> Set school admin email and hashed password
-- Password below is a bcrypt placeholder — replace with real hash
INSERT INTO `users` (`name`, `surname`, `email`, `password`, `role`) VALUES
('School', 'Admin', '<<ADMIN_EMAIL>>', '<<BCRYPT_HASHED_PASSWORD>>', 'school_admin');

-- ============================================================
--  SECTION 6: CLASSES
-- ============================================================

CREATE TABLE `classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `subject` varchar(100) NOT NULL DEFAULT 'General',
  `created_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 7: CLASS STUDENTS
-- ============================================================

CREATE TABLE `class_students` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_email` varchar(150) NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_class_year` (`student_email`, `class_id`, `academic_year_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 8: TEACHER SUBJECTS
-- ============================================================

CREATE TABLE `teacher_subjects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `teacher_email` varchar(150) NOT NULL,
  `class_id` int(11) NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_teacher_class` (`teacher_email`, `class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 9: QUIZZES
-- ============================================================

CREATE TABLE `quizzes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `created_by` varchar(150) NOT NULL,
  `duration_minutes` int(11) DEFAULT 10,
  `passing_marks` int(11) DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `is_published` tinyint(1) DEFAULT 0,
  `marks_published` tinyint(1) DEFAULT 0,
  `allow_multiple_attempts` tinyint(1) DEFAULT 0,
  `notify_learners` tinyint(1) DEFAULT 0,
  `instructions` text DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 10: QUESTIONS & CHOICES
-- ============================================================

CREATE TABLE `questions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) DEFAULT NULL,
  `question_text` text NOT NULL,
  `points` int(11) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `choices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `question_id` int(11) NOT NULL,
  `choice_text` varchar(500) NOT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `quizquestions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 11: QUIZ ATTEMPTS, RESULTS & ANSWERS
-- ============================================================

CREATE TABLE `quiz_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(150) NOT NULL,
  `quiz_id` int(11) NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `submitted_at` timestamp NULL DEFAULT NULL,
  `status` enum('in_progress','submitted','abandoned') DEFAULT 'in_progress',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `quiz_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(150) DEFAULT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT 0,
  `total` int(11) DEFAULT 0,
  `time_taken` int(11) DEFAULT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_answers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(150) DEFAULT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `result_id` int(11) DEFAULT NULL,
  `question_id` int(11) DEFAULT NULL,
  `selected_choice_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_answer` (`user_email`, `quiz_id`, `question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `answers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) DEFAULT NULL,
  `question_id` int(11) DEFAULT NULL,
  `user_email` varchar(150) DEFAULT NULL,
  `selected_choice` varchar(255) DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 12: AI INTEGRITY MONITORING
-- ============================================================

CREATE TABLE `quiz_integrity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quiz_id` int(11) NOT NULL,
  `user_email` varchar(150) NOT NULL,
  `event_type` varchar(100) DEFAULT NULL,
  `event_detail` text DEFAULT NULL,
  `question_number` int(11) DEFAULT NULL,
  `risk_level` enum('low','medium','high') DEFAULT 'low',
  `logged_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 13: ASSIGNMENTS & SUBMISSIONS
-- ============================================================

CREATE TABLE `assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `class_id` int(11) DEFAULT NULL,
  `created_by` varchar(150) NOT NULL,
  `due_date` datetime DEFAULT NULL,
  `max_score` int(11) DEFAULT 100,
  `file_path` varchar(255) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assignment_id` int(11) NOT NULL,
  `student_email` varchar(150) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `grade` int(11) DEFAULT NULL,
  `feedback` text DEFAULT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 14: ANNOUNCEMENTS
-- ============================================================

CREATE TABLE `announcements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_by` varchar(150) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) NOT NULL DEFAULT 1,
  `send_to` enum('parents','learners') NOT NULL DEFAULT 'learners',
  `target_role` enum('all','teachers','learners') DEFAULT 'all',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 15: DISCUSSIONS
-- ============================================================

CREATE TABLE `class_discussions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `initial_message` text NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `creator_email` varchar(150) NOT NULL,
  `creator_anonymous` tinyint(1) DEFAULT 1,
  `creator_name` varchar(150) DEFAULT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `discussion_replies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discussion_id` int(11) NOT NULL,
  `parent_reply_id` int(11) DEFAULT NULL,
  `user_email` varchar(150) NOT NULL,
  `user_name` varchar(150) DEFAULT NULL,
  `is_anonymous` tinyint(1) DEFAULT 0,
  `message` text NOT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `discussion_replies_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `discussion_replies_ibfk_2` FOREIGN KEY (`parent_reply_id`) REFERENCES `discussion_replies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `discussion_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discussion_id` int(11) DEFAULT NULL,
  `reply_id` int(11) DEFAULT NULL,
  `reported_by` varchar(150) NOT NULL,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `discussion_reports_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `discussion_reports_ibfk_2` FOREIGN KEY (`reply_id`) REFERENCES `discussion_replies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `discussion_teachers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discussion_id` int(11) NOT NULL,
  `teacher_email` varchar(150) NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `discussion_teachers_ibfk_1` FOREIGN KEY (`discussion_id`) REFERENCES `class_discussions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `discussion_typing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `discussion_id` int(11) NOT NULL,
  `user_email` varchar(150) NOT NULL,
  `last_typed` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 16: RESOURCES
-- ============================================================

CREATE TABLE `resources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `uploaded_by` varchar(150) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 17: SUBJECT BRIEFS (SYLLABUS)
-- ============================================================

CREATE TABLE `subject_briefs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_id` int(11) NOT NULL,
  `teacher_email` varchar(150) NOT NULL,
  `term_number` tinyint(1) NOT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 18: TEACHER EVALUATIONS
-- ============================================================

CREATE TABLE `teacher_evaluations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_id` int(11) NOT NULL,
  `teacher_email` varchar(150) NOT NULL,
  `created_by` varchar(150) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `evaluation_statements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `evaluation_id` int(11) NOT NULL,
  `statement_text` text NOT NULL,
  `order_index` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `evaluation_statements_ibfk_1` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `evaluation_responses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `evaluation_id` int(11) NOT NULL,
  `learner_email` varchar(150) NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `evaluation_responses_ibfk_1` FOREIGN KEY (`evaluation_id`) REFERENCES `teacher_evaluations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `evaluation_answers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `response_id` int(11) NOT NULL,
  `statement_id` int(11) NOT NULL,
  `rating` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `evaluation_answers_ibfk_1` FOREIGN KEY (`response_id`) REFERENCES `evaluation_responses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `evaluation_answers_ibfk_2` FOREIGN KEY (`statement_id`) REFERENCES `evaluation_statements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 19: ACADEMIC EVENTS & TEACHER REMINDERS (CALENDAR)
-- ============================================================

CREATE TABLE `academic_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `event_date` date NOT NULL,
  `event_type` enum('test','exam','holiday','event','other') NOT NULL,
  `class_id` int(11) NOT NULL,
  `academic_year_id` int(11) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `academic_events_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `academic_events_ibfk_2` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `teacher_reminders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `teacher_email` varchar(150) NOT NULL,
  `title` varchar(255) NOT NULL,
  `reminder_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 20: PARENT FEATURES
-- ============================================================

CREATE TABLE `parent_classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_email` varchar(150) NOT NULL,
  `class_id` int(11) NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- A learner can have several parents; a link no longer belongs to one class (a child's class comes from
-- class_students for the current year). Parents are linked by invite link: see parent_invites below.
CREATE TABLE `parent_links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_email` varchar(255) NOT NULL,
  `learner_email` varchar(255) NOT NULL,
  `class_id` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_link` (`parent_email`,`learner_email`),
  KEY `class_id` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- One-use links a learner creates in My Class for a parent. Only a SHA-256 hash of the code is stored.
CREATE TABLE `parent_invites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `learner_email` varchar(255) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `used_by` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code` (`code_hash`),
  KEY `idx_learner` (`learner_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 21: PUSH NOTIFICATIONS
-- ============================================================

CREATE TABLE `user_subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_device` (`user_email`, `endpoint`(255)),
  KEY `user_email` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 22: AUTH & SECURITY
-- ============================================================

CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(150) NOT NULL,
  `selector` varchar(64) NOT NULL,
  `hashed_token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_email` (`user_email`),
  KEY `selector` (`selector`),
  CONSTRAINT `user_tokens_ibfk_1` FOREIGN KEY (`user_email`) REFERENCES `users` (`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 23: MESSAGES
-- ============================================================

CREATE TABLE `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_email` varchar(150) NOT NULL,
  `receiver_email` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
--  SECTION 24: TOP ACHIEVERS
-- ============================================================

CREATE TABLE `top_achievers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_id` int(11) DEFAULT NULL,
  `student_email` varchar(150) NOT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `academic_year_id` int(11) DEFAULT NULL,
  `term_number` tinyint(1) DEFAULT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

-- ============================================================
--  END OF TEMPLATE
--  iSkool LMS — www.iskool.xyz
--  support@iskool.xyz
-- ============================================================
