-- Migration: 001_discussion_typing
-- Description: Adds typing indicators support to class discussions
-- Created: 2026-02-22

CREATE TABLE IF NOT EXISTS discussion_typing (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    discussion_id INT NOT NULL,
    user_email    VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255) NOT NULL,
    last_typed_at DATETIME NOT NULL,
    UNIQUE KEY unique_typing (discussion_id, user_email),
    INDEX idx_discussion (discussion_id),
    INDEX idx_last_typed (last_typed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;