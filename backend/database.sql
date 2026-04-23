-- CCTV Security Monitoring System (SOC Sink)
-- Database: cctv_cam_db
-- Generated for MySQL/MariaDB

CREATE DATABASE IF NOT EXISTS cctv_cam_db;
USE cctv_cam_db;

-- 1. USERS TABLE (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. CAMERAS TABLE
CREATE TABLE IF NOT EXISTS cameras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    zone VARCHAR(50) NOT NULL,
    ip_simulated VARCHAR(45),
    status ENUM('online', 'offline', 'error') DEFAULT 'online',
    is_blocked TINYINT(1) DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8)
) ENGINE=InnoDB;

-- 3. ACCESS POINTS TABLE
CREATE TABLE IF NOT EXISTS access_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status ENUM('online', 'offline', 'error') DEFAULT 'online',
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8)
) ENGINE=InnoDB;

-- 4. ACCESS LOGS TABLE
CREATE TABLE IF NOT EXISTS access_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    camera_id INT,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. ALERTS TABLE (IDS + ANOMALIES)
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    description TEXT,
    explanation TEXT,
    affected_entity VARCHAR(255),
    is_acknowledged TINYINT(1) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SEED DATA
-- Default Credentials: admin / admin123
INSERT INTO users (username, password_hash, role) VALUES 
('admin', '$2a$10$Xm57Xf9.f9y9y9y9y9y9yeXm57Xf9.f9y9y9y9y9y9y', 'admin'); 
-- (Note: Use real bcrypt hashes in production, this is a placeholder matching the logical fallback)

INSERT INTO cameras (name, zone, ip_simulated, lat, lng) VALUES 
('Main Entrance', 'Zone A', '192.168.1.10', 51.505, -0.09),
('Parking Lot', 'Zone B', '192.168.1.11', 51.506, -0.091),
('Server Room', 'Zone C', '192.168.1.12', 51.504, -0.089);

INSERT INTO access_points (name, lat, lng) VALUES 
('Node ALPHA', 51.505, -0.09),
('Node BETA', 51.506, -0.091);
