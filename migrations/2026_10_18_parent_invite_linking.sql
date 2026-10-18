-- Parent linking by invite link
-- Run this on EVERY school database (dev first, then each school) BEFORE the matching code is deployed.
-- It is not run automatically: iSkool has no migration runner, so paste it into phpMyAdmin (SQL tab).
--
-- 1. parent_links: a learner can now have more than one parent, and a link no longer belongs to one class.
--    - drops the (learner_email, class_id) unique key, which allowed only ONE parent per learner per class
--    - class_id becomes optional. New links leave it NULL. A child's class comes from class_students for the
--      current academic year, so links survive the year rollover.
--    - the (parent_email, learner_email) unique key `unique_link` stays, so the same pair cannot be linked twice.
-- 2. parent_invites: the one-use links a learner creates in My Class. Only a SHA-256 hash of the code is stored.
--
-- Run each statement once. If the DROP INDEX line says the key does not exist, it has already been run.

ALTER TABLE `parent_links`
  DROP INDEX `uniq_learner_class`,
  MODIFY `class_id` int(11) NULL;

CREATE TABLE IF NOT EXISTS `parent_invites` (
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

-- Check afterwards (both should show what is described above):
--   SHOW CREATE TABLE parent_links;    -- no uniq_learner_class, class_id is NULL-able, unique_link still there
--   SHOW CREATE TABLE parent_invites;
