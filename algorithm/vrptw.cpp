#include "vrptw.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <random>
#include <unordered_set>
#include <vector>

namespace {

struct Candidate {
    int station_id = 0;
    double pheromone_value = 0.0;
    double heuristic_value = 0.0;
    double transition_weight = 0.0;
};

struct RouteMetrics {
    std::vector<int> arrival_times_minutes;
    int total_travel_minutes = 0;
    int total_service_minutes = 0;
    int total_runtime_minutes = 0;
    int total_load = 0;
    double total_distance_km = 0.0;
    bool feasible = false;
};

struct AntSolution {
    std::vector<RoutePlan> routes;
    double objective_distance = std::numeric_limits<double>::max();
    int total_runtime_minutes = 0;
    bool feasible = false;
};

const Station* findStationById(const VRPTWInstance& instance, int station_id) {
    for (const auto& station : instance.stations) {
        if (station.id == station_id) {
            return &station;
        }
    }
    return nullptr;
}

int stationIndexById(const VRPTWInstance& instance, int station_id) {
    for (std::size_t i = 0; i < instance.stations.size(); ++i) {
        if (instance.stations[i].id == station_id) {
            return static_cast<int>(i);
        }
    }
    return -1;
}

std::unordered_set<int> createCustomerTabuSet(const VRPTWInstance& instance) {
    std::unordered_set<int> station_ids;
    for (const auto& station : instance.stations) {
        if (!station.is_depot) {
            station_ids.insert(station.id);
        }
    }
    return station_ids;
}

std::vector<std::vector<double>> initializePheromoneMatrix(std::size_t station_count, double initial_value = 1.0) {
    return std::vector<std::vector<double>>(station_count, std::vector<double>(station_count, initial_value));
}

RouteMetrics evaluateRoute(
    const VRPTWInstance& instance,
    const Vehicle& vehicle,
    const std::vector<int>& station_ids) {
    RouteMetrics metrics;
    if (station_ids.empty()) {
        return metrics;
    }

    int current_time = 0;
    int load = 0;

    metrics.arrival_times_minutes.reserve(station_ids.size());

    for (std::size_t i = 0; i < station_ids.size(); ++i) {
        const Station* station = findStationById(instance, station_ids[i]);
        if (station == nullptr) {
            return metrics;
        }

        if (i > 0) {
            const int from_index = stationIndexById(instance, station_ids[i - 1]);
            const int to_index = stationIndexById(instance, station_ids[i]);
            if (from_index < 0 || to_index < 0) {
                return metrics;
            }

            metrics.total_travel_minutes += instance.travel_time_matrix_minutes[from_index][to_index];
            metrics.total_distance_km += instance.distance_matrix_km[from_index][to_index];
            current_time += instance.travel_time_matrix_minutes[from_index][to_index];
        }

        if (current_time < station->window.earliest_minutes) {
            current_time = station->window.earliest_minutes;
        }

        metrics.arrival_times_minutes.push_back(current_time);

        if (current_time > station->window.latest_minutes) {
            return metrics;
        }

        if (!station->is_depot) {
            load += station->demand;
            if (load > vehicle.capacity) {
                return metrics;
            }
        }

        metrics.total_service_minutes += station->service_minutes;
        current_time += station->service_minutes;
    }

    metrics.total_load = load;
    metrics.total_runtime_minutes = metrics.total_travel_minutes + metrics.total_service_minutes;
    metrics.feasible = metrics.total_runtime_minutes <= vehicle.max_run_minutes;
    return metrics;
}

bool canAppendStation(
    const VRPTWInstance& instance,
    const Vehicle& vehicle,
    const RoutePlan& current_route,
    int candidate_station_id) {
    std::vector<int> trial_station_ids = current_route.station_ids;
    trial_station_ids.push_back(candidate_station_id);
    trial_station_ids.push_back(instance.destination_station_id);
    return evaluateRoute(instance, vehicle, trial_station_ids).feasible;
}

// Heuristic information combines distance, travel time and time-window urgency.
// Stations that are closer, faster to reach and whose latest allowable time is near
// the current clock receive a larger heuristic value.
double heuristicValue(
    const VRPTWInstance& instance,
    int from_station_id,
    int to_station_id,
    int current_time_minutes) {
    const int from_index = stationIndexById(instance, from_station_id);
    const int to_index = stationIndexById(instance, to_station_id);
    const Station* next_station = findStationById(instance, to_station_id);
    if (from_index < 0 || to_index < 0 || next_station == nullptr) {
        return 1e-6;
    }

    const double distance = instance.distance_matrix_km[from_index][to_index];
    const double travel_time = static_cast<double>(instance.travel_time_matrix_minutes[from_index][to_index]);
    const double expected_arrival = static_cast<double>(current_time_minutes) + travel_time;
    const double wait_time =
        expected_arrival < next_station->window.earliest_minutes
            ? static_cast<double>(next_station->window.earliest_minutes) - expected_arrival
            : 0.0;
    const double slack =
        std::max(0.0, static_cast<double>(next_station->window.latest_minutes) - expected_arrival);
    const double urgency = 1.0 / (1.0 + slack);

    return 1.0 / (1.0 + distance + travel_time + 0.3 * wait_time) + urgency;
}

std::vector<Candidate> buildCandidateList(
    const VRPTWInstance& instance,
    const Vehicle& vehicle,
    const RoutePlan& partial_route,
    const std::unordered_set<int>& tabu_list,
    const std::vector<std::vector<double>>& pheromone,
    const ACOConfig& config,
    int current_station_id,
    int current_time_minutes) {
    std::vector<Candidate> candidates;

    for (int station_id : tabu_list) {
        if (!canAppendStation(instance, vehicle, partial_route, station_id)) {
            continue;
        }

        const int from_index = stationIndexById(instance, current_station_id);
        const int to_index = stationIndexById(instance, station_id);
        if (to_index < 0) {
            continue;
        }

        const double pheromone_value = from_index >= 0 ? pheromone[from_index][to_index] : 1.0;
        const double heuristic =
            from_index >= 0 ? heuristicValue(instance, current_station_id, station_id, current_time_minutes) : 1.0;

        Candidate candidate;
        candidate.station_id = station_id;
        candidate.pheromone_value = pheromone_value;
        candidate.heuristic_value = heuristic;
        candidate.transition_weight =
            std::pow(pheromone_value, config.alpha) * std::pow(heuristic, config.beta);
        candidates.push_back(candidate);
    }

    return candidates;
}

// State transition rule:
// P(i,j) = [tau(i,j)^alpha * eta(i,j)^beta] / sum_k([tau(i,k)^alpha * eta(i,k)^beta])
int selectNextStation(const std::vector<Candidate>& candidates, std::mt19937& generator) {
    if (candidates.empty()) {
        return -1;
    }

    double total_weight = 0.0;
    for (const auto& candidate : candidates) {
        total_weight += candidate.transition_weight;
    }

    if (total_weight <= 0.0) {
        return candidates.front().station_id;
    }

    std::uniform_real_distribution<double> distribution(0.0, total_weight);
    double sample = distribution(generator);
    double cumulative = 0.0;

    for (const auto& candidate : candidates) {
        cumulative += candidate.transition_weight;
        if (sample <= cumulative) {
            return candidate.station_id;
        }
    }

    return candidates.back().station_id;
}

RoutePlan finalizeRoute(const VRPTWInstance& instance, const Vehicle& vehicle, const RoutePlan& partial_route) {
    RoutePlan route = partial_route;
    route.station_ids.push_back(instance.destination_station_id);

    const RouteMetrics metrics = evaluateRoute(instance, vehicle, route.station_ids);
    route.arrival_times_minutes = metrics.arrival_times_minutes;
    route.total_travel_minutes = metrics.total_travel_minutes;
    route.total_service_minutes = metrics.total_service_minutes;
    route.total_runtime_minutes = metrics.total_runtime_minutes;
    route.total_load = metrics.total_load;
    route.total_distance_km = metrics.total_distance_km;
    route.feasible = metrics.feasible;
    return route;
}

AntSolution constructAntSolution(
    const VRPTWInstance& instance,
    const std::vector<std::vector<double>>& pheromone,
    const ACOConfig& config,
    std::mt19937& generator) {
    AntSolution solution;

    // Global tabu list for one ant: once a customer station is visited by a vehicle,
    // it cannot be visited again in the same ant solution.
    std::unordered_set<int> tabu_list = createCustomerTabuSet(instance);

    for (const auto& vehicle : instance.vehicles) {
        if (tabu_list.empty()) {
            break;
        }

        RoutePlan partial_route;
        partial_route.vehicle_id = vehicle.id;

        int current_station_id = -1;
        int current_time_minutes = 0;

        while (!tabu_list.empty()) {
            const auto candidates = buildCandidateList(
                instance,
                vehicle,
                partial_route,
                tabu_list,
                pheromone,
                config,
                current_station_id,
                current_time_minutes);

            if (candidates.empty()) {
                break;
            }

            const int next_station_id = selectNextStation(candidates, generator);
            if (next_station_id < 0) {
                break;
            }

            partial_route.station_ids.push_back(next_station_id);
            tabu_list.erase(next_station_id);

            const int from_index = stationIndexById(instance, current_station_id);
            const int to_index = stationIndexById(instance, next_station_id);
            if (from_index >= 0 && to_index >= 0) {
                current_time_minutes += instance.travel_time_matrix_minutes[from_index][to_index];
            }

            const Station* next_station = findStationById(instance, next_station_id);
            if (next_station != nullptr) {
                if (current_time_minutes < next_station->window.earliest_minutes) {
                    current_time_minutes = next_station->window.earliest_minutes;
                }
                current_time_minutes += next_station->service_minutes;
            }

            current_station_id = next_station_id;
        }

        if (partial_route.station_ids.empty()) {
            continue;
        }

        RoutePlan completed_route = finalizeRoute(instance, vehicle, partial_route);
        solution.routes.push_back(completed_route);
    }

    if (!tabu_list.empty() || solution.routes.empty()) {
        return solution;
    }

    solution.feasible = true;
    solution.objective_distance = 0.0;
    solution.total_runtime_minutes = 0;

    for (const auto& route : solution.routes) {
        if (!route.feasible) {
            solution.feasible = false;
            break;
        }
        solution.objective_distance += route.total_distance_km;
        solution.total_runtime_minutes += route.total_runtime_minutes;
    }

    if (!solution.feasible) {
        solution.objective_distance = std::numeric_limits<double>::max();
        solution.total_runtime_minutes = std::numeric_limits<int>::max();
    }

    return solution;
}

bool isBetterSolution(const AntSolution& lhs, const AntSolution& rhs) {
    if (!lhs.feasible) {
        return false;
    }
    if (!rhs.feasible) {
        return true;
    }
    if (lhs.objective_distance != rhs.objective_distance) {
        return lhs.objective_distance < rhs.objective_distance;
    }
    return lhs.total_runtime_minutes < rhs.total_runtime_minutes;
}

void evaporatePheromone(std::vector<std::vector<double>>& pheromone, double evaporation_rate) {
    for (auto& row : pheromone) {
        for (double& value : row) {
            value *= (1.0 - evaporation_rate);
            if (value < 0.0001) {
                value = 0.0001;
            }
        }
    }
}

void depositPheromone(
    const VRPTWInstance& instance,
    const AntSolution& solution,
    const ACOConfig& config,
    std::vector<std::vector<double>>& pheromone) {
    if (!solution.feasible || solution.objective_distance <= 0.0) {
        return;
    }

    const double delta = config.pheromone_constant / solution.objective_distance;
    for (const auto& route : solution.routes) {
        for (std::size_t i = 1; i < route.station_ids.size(); ++i) {
            const int from_index = stationIndexById(instance, route.station_ids[i - 1]);
            const int to_index = stationIndexById(instance, route.station_ids[i]);
            if (from_index >= 0 && to_index >= 0) {
                pheromone[from_index][to_index] += delta;
            }
        }
    }
}

}  // namespace

AcoVrptwSolver::AcoVrptwSolver(ACOConfig config) : config_(config) {}

ACOResult AcoVrptwSolver::solve(const VRPTWInstance& instance) const {
    ACOResult result;
    if (instance.stations.empty() || instance.vehicles.empty()) {
        return result;
    }

    std::vector<std::vector<double>> pheromone = initializePheromoneMatrix(instance.stations.size(), 1.0);

    std::random_device random_device;
    std::mt19937 generator(random_device());

    AntSolution global_best;

    // Main ACO loop: multiple ants construct solutions in each iteration,
    // then pheromone is evaporated and reinforced using the best solutions found.
    for (int iteration = 0; iteration < config_.max_iterations; ++iteration) {
        AntSolution iteration_best;

        for (int ant = 0; ant < config_.ant_count; ++ant) {
            AntSolution ant_solution = constructAntSolution(instance, pheromone, config_, generator);
            if (isBetterSolution(ant_solution, iteration_best)) {
                iteration_best = ant_solution;
            }
            if (isBetterSolution(ant_solution, global_best)) {
                global_best = ant_solution;
            }
        }

        evaporatePheromone(pheromone, config_.evaporation_rate);
        depositPheromone(instance, iteration_best, config_, pheromone);
        depositPheromone(instance, global_best, config_, pheromone);
    }

    if (!global_best.feasible) {
        return result;
    }

    result.routes = global_best.routes;
    result.objective_value = global_best.objective_distance;
    result.total_runtime_minutes = global_best.total_runtime_minutes;
    result.feasible = global_best.feasible;
    return result;
}

bool AcoVrptwSolver::isRouteFeasible(const VRPTWInstance& instance, const RoutePlan& route) const {
    const auto vehicle_it = std::find_if(
        instance.vehicles.begin(),
        instance.vehicles.end(),
        [&route](const Vehicle& vehicle) { return vehicle.id == route.vehicle_id; });

    if (vehicle_it == instance.vehicles.end()) {
        return false;
    }

    return evaluateRoute(instance, *vehicle_it, route.station_ids).feasible;
}
