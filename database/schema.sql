CREATE DATABASE IF NOT EXISTS campus_shuttle_system
DEFAULT CHARACTER SET utf8mb4
DEFAULT COLLATE utf8mb4_unicode_ci;

USE campus_shuttle_system;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'dispatcher', 'viewer') NOT NULL DEFAULT 'viewer',
    phone VARCHAR(20),
    email VARCHAR(100),
    status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_code VARCHAR(30) NOT NULL UNIQUE,
    plate_number VARCHAR(30) NOT NULL UNIQUE,
    capacity INT NOT NULL,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    status ENUM('idle', 'scheduled', 'running', 'maintenance') NOT NULL DEFAULT 'idle',
    start_depot VARCHAR(100),
    end_depot VARCHAR(100),
    max_run_minutes INT NOT NULL DEFAULT 480,
    earliest_departure_time TIME NOT NULL DEFAULT '06:40:00',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    station_code VARCHAR(30) NOT NULL UNIQUE,
    station_name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    demand INT NOT NULL DEFAULT 0,
    service_minutes INT NOT NULL DEFAULT 5,
    time_window_start TIME NOT NULL,
    time_window_end TIME NOT NULL,
    is_depot TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_code VARCHAR(30) NOT NULL UNIQUE,
    route_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    start_station_id INT,
    end_station_id INT,
    station_sequence_json JSON,
    planned_distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    planned_duration_minutes INT NOT NULL DEFAULT 0,
    status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
    created_by INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_routes_start_station
        FOREIGN KEY (start_station_id) REFERENCES stations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_routes_end_station
        FOREIGN KEY (end_station_id) REFERENCES stations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_routes_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_code VARCHAR(30) NOT NULL UNIQUE,
    route_id INT,
    vehicle_id INT NOT NULL,
    station_id INT,
    visit_order INT,
    departure_date DATE NOT NULL,
    arrival_time DATETIME,
    departure_time DATETIME NOT NULL,
    planned_end_time DATETIME,
    actual_end_time DATETIME,
    total_distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_duration_minutes INT NOT NULL DEFAULT 0,
    objective_value DECIMAL(12, 2),
    is_feasible TINYINT(1) NOT NULL DEFAULT 1,
    feasible_flag TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('planned', 'published', 'running', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
    remarks VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_route
        FOREIGN KEY (route_id) REFERENCES routes(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_schedule_vehicle
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_schedule_station
        FOREIGN KEY (station_id) REFERENCES stations(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS distance_matrix (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    from_station_id INT NOT NULL,
    to_station_id INT NOT NULL,
    distance_km DECIMAL(10, 2) NOT NULL,
    travel_minutes INT NOT NULL,
    traffic_factor DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_distance_from_station
        FOREIGN KEY (from_station_id) REFERENCES stations(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_distance_to_station
        FOREIGN KEY (to_station_id) REFERENCES stations(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT uk_distance_pair UNIQUE (from_station_id, to_station_id),
    CONSTRAINT chk_distance_positive CHECK (distance_km >= 0),
    CONSTRAINT chk_travel_minutes_positive CHECK (travel_minutes >= 0)
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_stations_time_window ON stations(time_window_start, time_window_end);
CREATE INDEX idx_schedule_departure_date ON schedule(departure_date);
CREATE INDEX idx_schedule_status ON schedule(status);
CREATE INDEX idx_schedule_vehicle_station ON schedule(vehicle_id, station_id);
CREATE INDEX idx_distance_from_to ON distance_matrix(from_station_id, to_station_id);
