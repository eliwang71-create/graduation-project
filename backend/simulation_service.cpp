#include "simulation_service.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace {

int parseTimeToMinutes(const std::string& value, const std::string& fallback = "07:00") {
    const std::string& source = value.empty() ? fallback : value;
    const std::size_t colon = source.find(':');
    if (colon == std::string::npos) {
        throw std::runtime_error("Invalid time format: " + source);
    }
    const int hour = std::stoi(source.substr(0, colon));
    const int minute = std::stoi(source.substr(colon + 1, 2));
    return hour * 60 + minute;
}

double estimateDistanceKm(double lng1, double lat1, double lng2, double lat2) {
    const double pi = 3.14159265358979323846;
    const double avg_lat_rad = ((lat1 + lat2) / 2.0) * pi / 180.0;
    const double dx = (lng2 - lng1) * 111.320 * std::cos(avg_lat_rad);
    const double dy = (lat2 - lat1) * 110.540;
    return std::sqrt(dx * dx + dy * dy);
}

}  // namespace

SimulationPlanResult SimulationService::runSimulation(
    const std::vector<SimulationStationInput>& station_inputs,
    const std::vector<SimulationVehicleInput>& vehicle_inputs,
    ACOConfig config) const {
    if (station_inputs.empty()) {
        throw std::runtime_error("模拟模式下没有站点，请先添加模拟节点。");
    }

    if (vehicle_inputs.empty()) {
        throw std::runtime_error("模拟模式下没有车辆，请先添加模拟车辆。");
    }

    SimulationPlanResult output;
    int depot_count = 0;

    for (const auto& input : station_inputs) {
        Station station;
        station.id = input.id;
        station.code = "SIM-S" + std::to_string(input.id);
        station.name = input.name;
        station.demand = input.demand;
        station.service_minutes = input.service_minutes;
        station.is_depot = input.is_depot;
        station.window.earliest_minutes = parseTimeToMinutes(input.time_window_start, "07:00");
        station.window.latest_minutes = parseTimeToMinutes(input.time_window_end, "08:00");
        output.instance.stations.push_back(station);
        if (station.is_depot) {
            output.instance.destination_station_id = station.id;
            ++depot_count;
        }
    }

    if (depot_count == 0) {
        throw std::runtime_error("模拟模式缺少终点站，请先设置 1 个终点站。");
    }
    if (depot_count > 1) {
        throw std::runtime_error("模拟模式只允许 1 个终点站，请调整模拟节点配置。");
    }

    int customer_count = 0;
    for (const auto& station : output.instance.stations) {
        if (!station.is_depot) {
            ++customer_count;
        }
    }
    if (customer_count == 0) {
        throw std::runtime_error("模拟模式至少需要 1 个上车点。");
    }

    for (const auto& input : vehicle_inputs) {
        Vehicle vehicle;
        vehicle.id = input.id;
        vehicle.code = input.code;
        vehicle.plate_number = input.code;
        vehicle.capacity = input.capacity;
        vehicle.max_run_minutes = input.max_run_minutes;
        vehicle.earliest_departure_minutes = parseTimeToMinutes(input.earliest_departure_time, "06:40");
        output.instance.vehicles.push_back(vehicle);
    }

    const std::size_t station_count = station_inputs.size();
    output.instance.distance_matrix_km.assign(station_count, std::vector<double>(station_count, 0.0));
    output.instance.travel_time_matrix_minutes.assign(station_count, std::vector<int>(station_count, 0));

    for (std::size_t i = 0; i < station_count; ++i) {
        for (std::size_t j = 0; j < station_count; ++j) {
            if (i == j) {
                continue;
            }
            const double distance_km = estimateDistanceKm(
                station_inputs[i].lng,
                station_inputs[i].lat,
                station_inputs[j].lng,
                station_inputs[j].lat);
            const int travel_minutes = std::max(1, static_cast<int>(std::lround((distance_km / 28.0) * 60.0)));
            output.instance.distance_matrix_km[i][j] = distance_km;
            output.instance.travel_time_matrix_minutes[i][j] = travel_minutes;
        }
    }

    AcoVrptwSolver solver(config);
    output.result = solver.solve(output.instance, true);
    return output;
}
