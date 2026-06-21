ALTER TABLE `class_discussions`
  ADD COLUMN `type` ENUM('homework','general','off_topic') NOT NULL DEFAULT 'general' AFTER `initial_message`;
