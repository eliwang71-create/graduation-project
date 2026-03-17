USE campus_shuttle_system;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM distance_matrix;
DELETE FROM schedule;
DELETE FROM routes;
DELETE FROM stations;
DELETE FROM vehicles;
DELETE FROM users;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (
    id,
    username,
    password_hash,
    full_name,
    role,
    phone,
    email,
    status
) VALUES (
    1,
    'admin',
    'admin123',
    '系统管理员',
    'admin',
    '13800000000',
    'admin@campus.local',
    'active'
);

INSERT INTO vehicles (
    id,
    vehicle_code,
    plate_number,
    capacity,
    driver_name,
    driver_phone,
    status,
    start_depot,
    end_depot,
    max_run_minutes
) VALUES
    (
        1,
        'BUS-01',
        '陕A10001',
        18,
        '张师傅',
        '13900000001',
        'idle',
        '长安区公交停车场',
        '西安财经大学长安校区东大门',
        120
    ),
    (
        2,
        'BUS-02',
        '陕A10002',
        20,
        '李师傅',
        '13900000002',
        'idle',
        '长安区公交停车场',
        '西安财经大学长安校区东大门',
        120
    );

INSERT INTO stations (
    id,
    station_code,
    station_name,
    address,
    latitude,
    longitude,
    demand,
    service_minutes,
    time_window_start,
    time_window_end,
    is_depot
) VALUES
    (
        1,
        'ST01',
        '金地常宁府',
        '长安区金地常宁府小区门口',
        34.1165000,
        108.9378000,
        7,
        3,
        '06:50:00',
        '07:10:00',
        0
    ),
    (
        2,
        'ST02',
        '任家寨',
        '长安区任家寨村口通勤车停靠点',
        34.1238000,
        108.9286000,
        5,
        2,
        '06:55:00',
        '07:15:00',
        0
    ),
    (
        3,
        'ST03',
        '杜永村',
        '长安区杜永村村委会附近',
        34.1294000,
        108.9199000,
        6,
        2,
        '07:00:00',
        '07:20:00',
        0
    ),
    (
        4,
        'ST04',
        '南长安街壹号',
        '南长安街壹号小区北门',
        34.1412000,
        108.9305000,
        8,
        3,
        '07:05:00',
        '07:25:00',
        0
    ),
    (
        5,
        'ST05',
        '智慧新城',
        '智慧新城社区东门',
        34.1476000,
        108.9418000,
        7,
        3,
        '07:10:00',
        '07:30:00',
        0
    ),
    (
        6,
        'ST06',
        '西安财经大学长安校区东大门',
        '西安财经大学长安校区东大门',
        34.1579000,
        108.9514000,
        0,
        1,
        '07:30:00',
        '07:50:00',
        1
    );

INSERT INTO routes (
    id,
    route_code,
    route_name,
    description,
    start_station_id,
    end_station_id,
    station_sequence_json,
    planned_distance_km,
    planned_duration_minutes,
    status,
    created_by
) VALUES
    (
        1,
        'R001',
        '早高峰北线',
        '覆盖金地常宁府、任家寨、杜永村后到达学校东大门',
        1,
        6,
        JSON_ARRAY(1, 2, 3, 6),
        10.30,
        42,
        'active',
        1
    ),
    (
        2,
        'R002',
        '早高峰南线',
        '覆盖南长安街壹号、智慧新城后到达学校东大门',
        4,
        6,
        JSON_ARRAY(4, 5, 6),
        5.90,
        27,
        'active',
        1
    );

INSERT INTO schedule (
    id,
    schedule_code,
    route_id,
    vehicle_id,
    departure_date,
    departure_time,
    planned_end_time,
    actual_end_time,
    total_distance_km,
    total_duration_minutes,
    objective_value,
    is_feasible,
    status,
    remarks
) VALUES
    (
        1,
        'SCH2026031701',
        1,
        1,
        '2026-03-17',
        '2026-03-17 06:50:00',
        '2026-03-17 07:32:00',
        NULL,
        10.30,
        42,
        10.30,
        1,
        'planned',
        '北线通勤测试计划，满足 07:50 前到校约束'
    ),
    (
        2,
        'SCH2026031702',
        2,
        2,
        '2026-03-17',
        '2026-03-17 07:08:00',
        '2026-03-17 07:35:00',
        NULL,
        5.90,
        27,
        5.90,
        1,
        'planned',
        '南线通勤测试计划，满足终点硬时间窗'
    );

INSERT INTO distance_matrix (
    from_station_id,
    to_station_id,
    distance_km,
    travel_minutes,
    traffic_factor
) VALUES
    (1, 1, 0.00, 0, 1.00),
    (1, 2, 1.60, 6, 1.05),
    (1, 3, 3.10, 10, 1.10),
    (1, 4, 4.20, 13, 1.10),
    (1, 5, 5.60, 17, 1.15),
    (1, 6, 6.90, 21, 1.15),

    (2, 1, 1.60, 6, 1.05),
    (2, 2, 0.00, 0, 1.00),
    (2, 3, 1.80, 6, 1.05),
    (2, 4, 2.70, 9, 1.05),
    (2, 5, 4.20, 13, 1.10),
    (2, 6, 5.80, 17, 1.10),

    (3, 1, 3.10, 10, 1.10),
    (3, 2, 1.80, 6, 1.05),
    (3, 3, 0.00, 0, 1.00),
    (3, 4, 2.10, 7, 1.05),
    (3, 5, 3.50, 11, 1.10),
    (3, 6, 4.90, 15, 1.10),

    (4, 1, 4.20, 13, 1.10),
    (4, 2, 2.70, 9, 1.05),
    (4, 3, 2.10, 7, 1.05),
    (4, 4, 0.00, 0, 1.00),
    (4, 5, 1.40, 5, 1.00),
    (4, 6, 2.80, 10, 1.05),

    (5, 1, 5.60, 17, 1.15),
    (5, 2, 4.20, 13, 1.10),
    (5, 3, 3.50, 11, 1.10),
    (5, 4, 1.40, 5, 1.00),
    (5, 5, 0.00, 0, 1.00),
    (5, 6, 1.90, 7, 1.00),

    (6, 1, 6.90, 21, 1.15),
    (6, 2, 5.80, 17, 1.10),
    (6, 3, 4.90, 15, 1.10),
    (6, 4, 2.80, 10, 1.05),
    (6, 5, 1.90, 7, 1.00),
    (6, 6, 0.00, 0, 1.00);
