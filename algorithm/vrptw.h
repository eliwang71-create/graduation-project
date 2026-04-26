#ifndef ALGORITHM_VRPTW_H
#define ALGORITHM_VRPTW_H

#include <string>
#include <optional>
#include <vector>

struct TimeWindow {
    int earliest_minutes = 0;
    int latest_minutes = 0;
};

struct Station {
    int id = 0;
    std::string code;
    std::string name;
    int demand = 0;
    int service_minutes = 0;
    bool is_depot = false;
    TimeWindow window;
};

struct Vehicle {
    int id = 0;
    std::string code;
    std::string plate_number;
    int capacity = 0;
    int max_run_minutes = 0;
    int earliest_departure_minutes = 0;
};

struct RoutePlan {
    int vehicle_id = 0;
    std::vector<int> station_ids;
    std::vector<int> arrival_times_minutes;
    int total_travel_minutes = 0;
    int total_service_minutes = 0;
    int total_runtime_minutes = 0;
    int total_load = 0;
    double total_distance_km = 0.0;
    bool feasible = false;
};

struct VRPTWInstance {
    std::vector<Station> stations;
    std::vector<Vehicle> vehicles;
    std::vector<std::vector<double>> distance_matrix_km;
    std::vector<std::vector<int>> travel_time_matrix_minutes;
    int destination_station_id = 0;
};

struct ACOConfig {
    int ant_count = 20;
    int max_iterations = 100;
    double alpha = 1.0;
    double beta = 3.0;
    double evaporation_rate = 0.5;
    double pheromone_constant = 100.0;
};

struct ACOIterationSummary {
    int iteration = 0;
    double best_objective = 0.0;
    std::optional<double> iteration_best_objective;
    std::optional<double> global_best_objective;
    int feasible_ant_count = 0;
    int total_runtime_minutes = 0;
    bool feasible = false;
    std::vector<RoutePlan> best_routes;
};

struct ACOResult {
    std::vector<RoutePlan> routes;
    double objective_value = 0.0;
    int total_runtime_minutes = 0;
    bool feasible = false;
    std::vector<ACOIterationSummary> iteration_history;
};

class AcoVrptwSolver {
public:
    explicit AcoVrptwSolver(ACOConfig config = {});

    ACOResult solve(const VRPTWInstance& instance, bool collect_iteration_history = false) const;
    bool isRouteFeasible(const VRPTWInstance& instance, const RoutePlan& route) const;

private:
    ACOConfig config_;
};

#endif
