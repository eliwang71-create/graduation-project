USE campus_shuttle_system;

SET @has_route_id := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND column_name = 'route_id'
      AND is_nullable = 'NO'
);
SET @sql := IF(
    @has_route_id > 0,
    'ALTER TABLE schedule MODIFY COLUMN route_id INT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_station_id := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND column_name = 'station_id'
);
SET @sql := IF(
    @has_station_id = 0,
    'ALTER TABLE schedule ADD COLUMN station_id INT NULL AFTER vehicle_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_visit_order := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND column_name = 'visit_order'
);
SET @sql := IF(
    @has_visit_order = 0,
    'ALTER TABLE schedule ADD COLUMN visit_order INT NULL AFTER station_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_arrival_time := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND column_name = 'arrival_time'
);
SET @sql := IF(
    @has_arrival_time = 0,
    'ALTER TABLE schedule ADD COLUMN arrival_time DATETIME NULL AFTER departure_date',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_feasible_flag := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND column_name = 'feasible_flag'
);
SET @sql := IF(
    @has_feasible_flag = 0,
    'ALTER TABLE schedule ADD COLUMN feasible_flag TINYINT(1) NOT NULL DEFAULT 1 AFTER is_feasible',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_route := (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND constraint_name = 'fk_schedule_route'
);
SET @sql := IF(
    @has_fk_route > 0,
    'ALTER TABLE schedule DROP FOREIGN KEY fk_schedule_route',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := 'ALTER TABLE schedule ADD CONSTRAINT fk_schedule_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL ON UPDATE CASCADE';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk_station := (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND constraint_name = 'fk_schedule_station'
);
SET @sql := IF(
    @has_fk_station = 0,
    'ALTER TABLE schedule ADD CONSTRAINT fk_schedule_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = 'campus_shuttle_system'
      AND table_name = 'schedule'
      AND index_name = 'idx_schedule_vehicle_station'
);
SET @sql := IF(
    @has_index = 0,
    'CREATE INDEX idx_schedule_vehicle_station ON schedule(vehicle_id, station_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
