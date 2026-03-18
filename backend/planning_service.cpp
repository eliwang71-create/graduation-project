#include "planning_service.h"

#include <cmath>
#include <cstdio>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

#include "../algorithm/vrptw.h"
#include "distance_matrix_repository.h"
#include "mysql_reader.h"
#include "result_writer.h"
#include "station_repository.h"

namespace {

std::string runCommand(const std::string& command) {
    std::string output;
    FILE* pipe = popen(command.c_str(), "r");
    if (pipe == nullptr) {
        throw std::runtime_error("Failed to execute curl command.");
    }

    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        output += buffer;
    }

    const int exit_code = pclose(pipe);
    if (exit_code != 0) {
        throw std::runtime_error("curl command failed with exit code " + std::to_string(exit_code));
    }
    return output;
}

DistanceMatrixEntry buildSelfEntry(int station_id) {
    DistanceMatrixEntry entry;
    entry.from_station_id = station_id;
    entry.to_station_id = station_id;
    entry.distance_km = 0.0;
    entry.travel_minutes = 0;
    entry.traffic_factor = 1.0;
    return entry;
}

const Station* findStationById(const VRPTWInstance& instance, int station_id) {
    for (const auto& station : instance.stations) {
        if (station.id == station_id) {
            return &station;
        }
    }
    return nullptr;
}

DistanceMatrixEntry requestDrivingCost(
    const ApiStation& from_station,
    const ApiStation& to_station,
    const std::string& amap_key) {
    std::ostringstream url;
    url << "https://restapi.amap.com/v3/direction/driving"
        << "?origin=" << from_station.longitude << "," << from_station.latitude
        << "&destination=" << to_station.longitude << "," << to_station.latitude
        << "&extensions=base"
        << "&output=json"
        << "&strategy=0"
        << "&key=" << amap_key;

    const std::string response = runCommand("/usr/bin/curl -sS \"" + url.str() + "\"");
    if (response.find("\"status\":\"1\"") == std::string::npos &&
        response.find("\"status\": \"1\"") == std::string::npos) {
        throw std::runtime_error("AMap route request failed: " + response);
    }

    const std::regex distance_pattern("\"distance\"\\s*:\\s*\"([0-9.]+)\"");
    const std::regex duration_pattern("\"duration\"\\s*:\\s*\"([0-9.]+)\"");
    std::smatch distance_match;
    std::smatch duration_match;
    if (!std::regex_search(response, distance_match, distance_pattern) ||
        !std::regex_search(response, duration_match, duration_pattern)) {
        throw std::runtime_error("Failed to parse AMap route distance/duration response.");
    }

    const double distance_meters = std::stod(distance_match[1].str());
    const double duration_seconds = std::stod(duration_match[1].str());

    DistanceMatrixEntry entry;
    entry.from_station_id = from_station.id;
    entry.to_station_id = to_station.id;
    entry.distance_km = std::round((distance_meters / 1000.0) * 100.0) / 100.0;
    entry.travel_minutes = std::max(1, static_cast<int>(std::lround(duration_seconds / 60.0)));
    entry.traffic_factor = 1.0;
    return entry;
}

std::vector<DistanceMatrixEntry> buildDistanceMatrix(
    const std::vector<ApiStation>& stations,
    const std::string& amap_key) {
    if (amap_key.empty()) {
        throw std::runtime_error("AMAP_WEB_SERVICE_KEY is required.");
    }

    std::vector<DistanceMatrixEntry> entries;
    entries.reserve(stations.size() * stations.size());

    for (const auto& from_station : stations) {
        for (const auto& to_station : stations) {
            if (from_station.id == to_station.id) {
                entries.push_back(buildSelfEntry(from_station.id));
            } else {
                entries.push_back(requestDrivingCost(from_station, to_station, amap_key));
                std::this_thread::sleep_for(std::chrono::milliseconds(250));
            }
        }
    }

    return entries;
}

bool allCustomersCovered(const VRPTWInstance& instance, const ACOResult& result) {
    std::unordered_set<int> covered;
    for (const auto& route : result.routes) {
        for (int station_id : route.station_ids) {
            const Station* station = findStationById(instance, station_id);
            if (station != nullptr && !station->is_depot) {
                covered.insert(station_id);
            }
        }
    }

    int customer_count = 0;
    for (const auto& station : instance.stations) {
        if (!station.is_depot) {
            ++customer_count;
        }
    }
    return static_cast<int>(covered.size()) == customer_count;
}

}  // namespace

PlanningService::PlanningService(MySqlConfig config, std::string amap_web_service_key)
    : config_(std::move(config)), amap_web_service_key_(std::move(amap_web_service_key)) {}

PlanningSummary PlanningService::runPlan(const std::string& schedule_date) const {
    StationRepository station_repository(config_);
    DistanceMatrixRepository matrix_repository(config_);
    MySqlReader reader(config_);
    ResultWriter writer(config_);

    const std::vector<ApiStation> stations = station_repository.listStations();
    if (stations.empty()) {
        throw std::runtime_error("当前没有站点，请先添加真实上车点和学校终点站。");
    }

    bool has_depot = false;
    int customer_count = 0;
    for (const auto& station : stations) {
        if (station.is_depot) {
            has_depot = true;
        } else {
            ++customer_count;
        }
    }

    if (!has_depot) {
        throw std::runtime_error("缺少学校终点站，请先点击“添加学校终点站”，或新增“西安财经大学长安校区东大门”并勾选设为调度起点/终点。");
    }

    if (customer_count == 0) {
        throw std::runtime_error("当前只有学校终点站，没有上车点，无法执行调度。");
    }

    const std::vector<DistanceMatrixEntry> entries = buildDistanceMatrix(stations, amap_web_service_key_);
    matrix_repository.replaceAll(entries);

    VRPTWInstance instance = reader.loadInstance();
    if (instance.vehicles.empty()) {
        throw std::runtime_error("当前没有车辆，请先在车辆管理中新增车辆。");
    }

    ACOConfig config;
    config.ant_count = 20;
    config.max_iterations = 50;

    AcoVrptwSolver solver(config);
    const ACOResult result = solver.solve(instance);

    if (!result.feasible || result.routes.empty()) {
        throw std::runtime_error("当前站点、时间窗和车辆约束下未找到可行调度方案，请检查车辆容量、站点时间窗或上车点数量。");
    }

    if (!allCustomersCovered(instance, result)) {
        throw std::runtime_error("调度结果未覆盖全部上车点，当前方案无效，请调整站点时间窗或增加车辆后重试。");
    }

    writer.clearSchedule();
    const int rows = writer.writeScheduleResult(instance, result, schedule_date);
    if (rows == 0) {
        throw std::runtime_error("调度算法未写入任何结果，请检查当前数据配置是否可行。");
    }

    PlanningSummary summary;
    summary.success = true;
    summary.station_count = static_cast<int>(instance.stations.size());
    summary.vehicle_count = static_cast<int>(instance.vehicles.size());
    summary.schedule_rows = rows;
    summary.objective_value = result.objective_value;
    summary.total_runtime_minutes = result.total_runtime_minutes;
    summary.feasible = result.feasible;
    summary.message = "调度成功";
    return summary;
}
