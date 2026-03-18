USE campus_shuttle_system;

SET @has_column := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'campus_shuttle_system'
      AND TABLE_NAME = 'vehicles'
      AND COLUMN_NAME = 'earliest_departure_time'
);

SET @alter_sql := IF(
    @has_column = 0,
    'ALTER TABLE vehicles ADD COLUMN earliest_departure_time TIME NOT NULL DEFAULT ''06:40:00'' AFTER max_run_minutes',
    'SELECT 1'
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE vehicles
SET earliest_departure_time = '06:40:00'
WHERE earliest_departure_time IS NULL
   OR earliest_departure_time = '00:00:00';
