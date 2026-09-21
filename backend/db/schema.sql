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

CREATE TABLE IF NOT EXISTS crops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(100) NOT NULL,
  scientific_name VARCHAR(150),
  category VARCHAR(50) DEFAULT 'ผักสลัด / ผักใบ',
  growth_days INT DEFAULT 30,
  nursery_days INT DEFAULT 14,
  harvest_unit VARCHAR(50) DEFAULT 'กก.',
  default_bag_size VARCHAR(100) DEFAULT 'ถุงใส 4 ขีด (9x18)',
  default_price DECIMAL(10,2) DEFAULT 20.00,
  icon VARCHAR(50) DEFAULT 'leaf',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_number INT DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  dimension VARCHAR(100) DEFAULT 'แคร่ 2 x 6 เมตร',
  soil_recipe TEXT,
  crop_name VARCHAR(255) NULL,
  area_sqm DECIMAL(10,2),
  planting_date DATE NULL,
  expected_harvest_date DATE,
  water_source VARCHAR(255),
  water_source_type VARCHAR(100),
  soil_test_date DATE,
  soil_test_result VARCHAR(255),
  previous_crop_history TEXT,
  field_safety_status VARCHAR(50) DEFAULT 'ปลอดภัย',
  soil_notes TEXT,
  status VARCHAR(50) DEFAULT 'empty',
  current_batch_id INT NULL,
  notes TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS planting_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  batch_code VARCHAR(50) NOT NULL,
  plot_id INT NOT NULL,
  crop_id INT NOT NULL,
  start_date DATE NOT NULL,
  expected_harvest_date DATE NOT NULL,
  actual_harvest_date DATE NULL,
  status VARCHAR(50) DEFAULT 'growing',
  auto_water BOOLEAN DEFAULT TRUE,
  water_schedule VARCHAR(150) DEFAULT 'เช้า-เย็น (น้ำสะอาดมาตรฐาน GAP)',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS water_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  log_date DATE NOT NULL,
  water_source VARCHAR(255),
  water_source_type VARCHAR(100),
  water_quality VARCHAR(100),
  contamination_check BOOLEAN DEFAULT FALSE,
  amount_liters DECIMAL(10,2),
  worker_name VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
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
  application_method VARCHAR(100),
  safety_ppe BOOLEAN DEFAULT FALSE,
  manufacturer VARCHAR(255),
  chemical_label VARCHAR(255),
  phi_days INT DEFAULT 0,
  worker_name VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
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
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
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
  harvest_hygiene VARCHAR(50),
  postharvest_handling TEXT,
  worker_name VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
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
  vehicle_clean_status BOOLEAN DEFAULT FALSE,
  storage_conditions TEXT,
  transport_time TIME,
  delivery_condition VARCHAR(50),
  worker_name VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
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
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(255) NOT NULL,
  record_id INT,
  action VARCHAR(50) NOT NULL,
  user_email VARCHAR(255),
  old_values JSON,
  new_values JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_clusters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cluster_name VARCHAR(100) NOT NULL,
  description TEXT,
  preferred_crops JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  picture_url TEXT,
  phone VARCHAR(50),
  address TEXT,
  cluster_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cluster_id) REFERENCES customer_clusters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plot_id INT,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'ผักสลัด',
  price DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'กก.',
  stock_quantity DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  delivery_type VARCHAR(50) DEFAULT 'delivery',
  payment_method VARCHAR(50) DEFAULT 'transfer',
  delivery_date DATE,
  slip_image_url LONGTEXT,
  tracking_number VARCHAR(100) NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  recommended_product_id INT NOT NULL,
  score DECIMAL(5,4) DEFAULT 1.0000,
  reason VARCHAR(255),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (recommended_product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  order_id INT NULL,
  draft_data JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crop_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plot_id INT NOT NULL,
  cycle_id INT NULL,
  activity_date DATE NOT NULL,
  stage ENUM('soil_prep', 'seed_nursery', 'planting', 'maintenance', 'fertilizing', 'harvest') NOT NULL,
  title VARCHAR(255) NOT NULL,
  materials_used TEXT NULL,
  details TEXT NULL,
  water_frequency VARCHAR(100) NULL,
  operator_name VARCHAR(255) DEFAULT 'เจ้าของฟาร์ม',
  image_url TEXT NULL,
  notes TEXT NULL,
  synced_chem_id INT NULL,
  synced_water_id INT NULL,
  synced_harvest_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
  FOREIGN KEY (cycle_id) REFERENCES crop_cycles(id) ON DELETE SET NULL
);

