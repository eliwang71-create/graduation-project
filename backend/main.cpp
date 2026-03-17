#include <cstdlib>
#include <exception>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "../algorithm/vrptw.h"
#include "mysql_reader.h"
#include "result_writer.h"

namespace {

std::string readEnvOrDefault(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : std::string(value);
}

unsigned int readPortOrDefault(const char* name, unsigned int fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : static_cast<unsigned int>(std::stoul(value));
}

}  // namespace

namespace {

std::string formatMinutes(int total_minutes) {
    const int hours = total_minutes / 60;
    const int minutes = total_minutes % 60;
    std::ostringstream output;
    output << std::setfill('0') << std::setw(2) << hours
           << ":" << std::setfill('0') << std::setw(2) << minutes;
    return output.str();
}

std::string stationNameById(const VRPTWInstance& instance, int station_id) {
    for (const auto& station : instance.stations) {
        if (station.id == station_id) {
            return station.name;
        }
    }
    return "UNKNOWN";
}

}  // namespace

int main() {
    try {
        MySqlConfig config;
        config.host = readEnvOrDefault("MYSQL_HOST", "127.0.0.1");
        config.port = readPortOrDefault("MYSQL_PORT", 3306);
        config.user = readEnvOrDefault("MYSQL_USER", "root");
        config.password = readEnvOrDefault("MYSQL_PASSWORD", "");
        config.database = readEnvOrDefault("MYSQL_DATABASE", "campus_shuttle_system");

        MySqlReader reader(config);
        VRPTWInstance instance = reader.loadInstance();
        ResultWriter writer(config);

        ACOConfig aco_config;
        aco_config.ant_count = 20;
        aco_config.max_iterations = 50;

        AcoVrptwSolver solver(aco_config);
        ACOResult result = solver.solve(instance);

        std::cout << "Campus Shuttle Scheduling System" << std::endl;
        std::cout << "VRPTW Ant Colony Optimization Result" << std::endl;
        std::cout << "Stations loaded: " << instance.stations.size() << std::endl;
        std::cout << "Vehicles loaded: " << instance.vehicles.size() << std::endl;
        std::cout << "Destination station id: " << instance.destination_station_id << std::endl;
        std::cout << "Best total distance: " << result.objective_value << " km" << std::endl;
        std::cout << "Best total runtime: " << result.total_runtime_minutes << " min" << std::endl;
        std::cout << "Overall feasible: " << (result.feasible ? "YES" : "NO") << std::endl;

        if (!result.feasible || result.routes.empty()) {
            std::cout << "No feasible global best solution was found." << std::endl;
            return 0;
        }

        const std::string schedule_date = readEnvOrDefault("SCHEDULE_DATE", "2026-03-17");
        writer.clearSchedule();
        const int inserted_rows = writer.writeScheduleResult(instance, result, schedule_date);

        for (const auto& route : result.routes) {
            std::cout << "\nVehicle " << route.vehicle_id << std::endl;
            std::cout << "  Visit order:" << std::endl;

            for (std::size_t i = 0; i < route.station_ids.size(); ++i) {
                const int station_id = route.station_ids[i];
                const std::string arrival =
                    i < route.arrival_times_minutes.size() ? formatMinutes(route.arrival_times_minutes[i]) : "--:--";
                std::cout << "    " << (i + 1) << ". "
                          << stationNameById(instance, station_id)
                          << " (id=" << station_id << ", arrival=" << arrival << ")"
                          << std::endl;
            }

            std::cout << "  Total load: " << route.total_load << std::endl;
            std::cout << "  Total distance: " << route.total_distance_km << " km" << std::endl;
            std::cout << "  Total travel time: " << route.total_travel_minutes << " min" << std::endl;
            std::cout << "  Total service time: " << route.total_service_minutes << " min" << std::endl;
            std::cout << "  Total runtime: " << route.total_runtime_minutes << " min" << std::endl;
            std::cout << "  Feasible: " << (route.feasible ? "YES" : "NO") << std::endl;
        }

        std::cout << "\nSchedule write-back completed." << std::endl;
        std::cout << "Cleared old schedule rows and inserted " << inserted_rows
                  << " new schedule records." << std::endl;
    } catch (const std::exception& ex) {
        std::cerr << "Backend startup failed: " << ex.what() << std::endl;
        std::cerr << "Check whether MySQL is running and the campus_shuttle_system database is available."
                  << std::endl;
        return 1;
    }

    return 0;
}
