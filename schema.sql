-- =============================================================
--  Library Booking System – Database Schema & Seed Data
--  Engine: MySQL 8.x (InnoDB required for row-level locking)
-- =============================================================

CREATE DATABASE IF NOT EXISTS library_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE library_booking;

-- ---------------------------------------------------------------
-- Table: books
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS books;

CREATE TABLE books (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255)     NOT NULL,
  author      VARCHAR(255)     NOT NULL DEFAULT 'Unknown',
  quantity    TINYINT UNSIGNED NOT NULL DEFAULT 1
                COMMENT 'UNSIGNED prevents quantity < 0 at the DB level',
  created_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Extra safety net: MySQL 8.0.16+ CHECK constraint
  CONSTRAINT chk_quantity_non_negative CHECK (quantity >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Table: bookings
-- ---------------------------------------------------------------
CREATE TABLE bookings (
  id          BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  book_id     INT UNSIGNED     NOT NULL,
  user_id     VARCHAR(100)     NOT NULL COMMENT 'External user identifier',
  booked_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Seed data – one book with quantity = 1 (as per task spec)
-- ---------------------------------------------------------------
INSERT INTO books (title, author, quantity) VALUES
  ('The Pragmatic Programmer', 'David Thomas & Andrew Hunt', 1),
  ('Clean Code',               'Robert C. Martin',           2),
  ('Design Patterns',          'Gang of Four',               1);
