-- Migration: 002_schools_table
-- Description: Adds schools tracking table for automated multi-tenant migrations
-- Created: 2026-02-22

CREATE TABLE IF NOT EXISTS schools (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    subdomain  VARCHAR(100) NOT NULL UNIQUE,
    db_name    VARCHAR(100) NOT NULL UNIQUE,
    is_active  TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert the existing live school
INSERT IGNORE INTO schools (name, subdomain, db_name)
VALUES ('Sandton High', 'sandtonhigh', 'iskowdbw_sandtonhigh');