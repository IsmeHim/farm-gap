CREATE DATABASE IF NOT EXISTS farmgap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE farmgap;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  farm_name VARCHAR(255),
  role ENUM('owner','worker') DEFAULT 'owner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  crop_name VARCHAR(255) NOT NULL,
  area_sqm DECIMAL(10,2),
  planting_date DATE NOT NULL,
  expected_harvest_date DATE,
  water_source VARCHAR(255),
  soil_notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS water_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  log_date DATE NOT NULL,
  water_source VARCHAR(255),
  amount_liters DECIMAL(10,2),
  worker_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chemical_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  log_date DATE NOT NULL,
  chem_type VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2),
  unit VARCHAR(50),
  reason TEXT,
  phi_days INT DEFAULT 0,
  worker_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pest_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  log_date DATE NOT NULL,
  pest_or_disease VARCHAR(255) NOT NULL,
  severity VARCHAR(50),
  treatment_method TEXT,
  worker_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS harvest_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  harvest_date DATE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'kg',
  quality_grade VARCHAR(50),
  lot_code VARCHAR(100),
  revenue DECIMAL(12,2),
  worker_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  harvest_id INT,
  log_date DATE NOT NULL,
  storage_location VARCHAR(255),
  shipped_to VARCHAR(255),
  buyer VARCHAR(255),
  vehicle VARCHAR(255),
  worker_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  phone VARCHAR(50),
  hygiene_training BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cost_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT,
  log_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
