#ifndef BACKEND_SIMULATION_SERVICE_H
#define BACKEND_SIMULATION_SERVICE_H

#include <string>
#include <vector>

#include "../algorithm/vrptw.h"

struct SimulationStationInput {
    int id = 0;
    std::string name;
    double lng = 0.0;
    double lat = 0.0;
    int demand = 0;
    int service_minutes = 0;
    std::string time_window_start;
    std::string time_window_end;
    bool is_depot = false;
};

struct SimulationVehicleInput {
    int id = 0;
    std::string code;
    int capacity = 0;
    int max_run_minutes = 0;
    std::string earliest_departure_time;
};

struct SimulationPlanResult {
    VRPTWInstance instance;
    ACOResult result;
};

class SimulationService {
public:
    SimulationPlanResult runSimulation(
        const std::vector<SimulationStationInput>& stations,
        const std::vector<SimulationVehicleInput>& vehicles,
        ACOConfig config) const;
};

#endif
