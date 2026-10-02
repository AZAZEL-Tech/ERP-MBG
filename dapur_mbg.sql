-- ============================================================
-- SQL DUMP DATABASE DAPUR MBG (MySQL / MariaDB)
-- Satuan Pelayanan Pemenuhan Gizi (SPPG) - Makan Bergizi Gratis
-- ============================================================

CREATE DATABASE IF NOT EXISTS `dapur_mbg` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dapur_mbg`;

-- 1. Tabel Pembelian Bahan Pangan
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `item_name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `total_price` DECIMAL(14,2) NOT NULL,
  `supplier` VARCHAR(191) DEFAULT '',
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_purchases_date` (`date`),
  INDEX `idx_purchases_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Stok Sisa Bahan Pangan (Inventaris Dapur)
CREATE TABLE IF NOT EXISTS `inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `item_name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `remaining_qty` DECIMAL(10,2) NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `item_condition` VARCHAR(100) DEFAULT 'Baik / Segar',
  `storage_location` VARCHAR(191) DEFAULT 'Gudang Dapur',
  `notes` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_inventory_name` (`item_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Bahan Dibuang (Food Waste & Kerusakan Mutu)
CREATE TABLE IF NOT EXISTS `food_waste` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `item_name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `waste_qty` DECIMAL(10,2) NOT NULL,
  `unit` VARCHAR(50) NOT NULL,
  `estimated_loss` DECIMAL(14,2) NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_waste_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Transaksi Keuangan (Arus Kas Masuk & Keluar)
CREATE TABLE IF NOT EXISTS `finances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` DATE NOT NULL,
  `type` ENUM('INCOME','EXPENSE') NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `source_or_recipient` VARCHAR(191) DEFAULT '',
  `ref_number` VARCHAR(100) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_finances_date` (`date`),
  INDEX `idx_finances_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Pengaturan & Profil SPPG
CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Data Pengaturan SPPG
INSERT IGNORE INTO `settings` (`key`, `value`) VALUES
('kitchen_name', 'Satuan Pelayanan Pemenuhan Gizi (SPPG) MBG Mandiri'),
('service_area', 'Kecamatan Sejahtera, Kab. Nusantara'),
('manager_name', 'Budi Santoso, S.Gz'),
('treasurer_name', 'Siti Rahmawati, S.E'),
('head_cook', 'Chef Agus Priyono'),
('daily_target_portions', '1200'),
('budget_per_portion', '15000'),
('active_schools', 'SDN 01 Harapan, SDN 02 Pagi, SMPN 01 Perintis');
