#ifndef BACKEND_PLANNING_SERVICE_H
#define BACKEND_PLANNING_SERVICE_H

#include <string>

#include "mysql_reader.h"

struct PlanningSummary {
    bool success = false;
    int station_count = 0;
    int vehicle_count = 0;
    int schedule_rows = 0;
    double objective_value = 0.0;
    int total_runtime_minutes = 0;
    bool feasible = false;
    std::string message;
};

class PlanningService {
public:
    PlanningService(MySqlConfig config, std::string amap_web_service_key);

    PlanningSummary runPlan(const std::string& schedule_date) const;

private:
    MySqlConfig config_;
    std::string amap_web_service_key_;
};

#endif
