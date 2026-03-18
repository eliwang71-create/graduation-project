USE campus_shuttle_system;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM distance_matrix;
DELETE FROM schedule;
DELETE FROM routes;
DELETE FROM stations;
DELETE FROM vehicles;

SET FOREIGN_KEY_CHECKS = 1;
