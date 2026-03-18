#ifndef BACKEND_SCHEDULE_REPOSITORY_H
#define BACKEND_SCHEDULE_REPOSITORY_H

#include <string>
#include <vector>

#include "mysql_reader.h"

struct ApiScheduleStop {
    int vehicle_id = 0;
    std::string vehicle_code;
    std::string plate_number;
    int station_id = 0;
    std::string station_name;
    double lng = 0.0;
    double lat = 0.0;
    bool is_depot = false;
    int visit_order = 0;
    std::string arrival_time;
    std::string departure_time;
    int feasible_flag = 0;
};

class ScheduleRepository {
public:
    explicit ScheduleRepository(MySqlConfig config);

    std::vector<ApiScheduleStop> listScheduleStops() const;

private:
    MySqlConfig config_;
};

#endif
