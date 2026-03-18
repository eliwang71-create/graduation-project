#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "distance_matrix_repository.h"
#include "station_repository.h"

namespace {

std::string readEnvOrDefault(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : std::string(value);
}

unsigned int readPortOrDefault(const char* name, unsigned int fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : static_cast<unsigned int>(std::stoul(value));
}

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

    const std::string command = "/usr/bin/curl -sS \"" + url.str() + "\"";
    const std::string response = runCommand(command);

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
        throw std::runtime_error("Failed to parse AMap driving distance/duration response.");
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

}  // namespace

int main() {
    try {
        const std::string amap_key = readEnvOrDefault("AMAP_WEB_SERVICE_KEY", "");
        if (amap_key.empty()) {
            throw std::runtime_error("AMAP_WEB_SERVICE_KEY is required for real road network matrix generation.");
        }

        MySqlConfig config;
        config.host = readEnvOrDefault("MYSQL_HOST", "127.0.0.1");
        config.port = readPortOrDefault("MYSQL_PORT", 3306);
        config.user = readEnvOrDefault("MYSQL_USER", "root");
        config.password = readEnvOrDefault("MYSQL_PASSWORD", "");
        config.database = readEnvOrDefault("MYSQL_DATABASE", "campus_shuttle_system");

        StationRepository station_repository(config);
        DistanceMatrixRepository matrix_repository(config);

        const std::vector<ApiStation> stations = station_repository.listStations();
        if (stations.empty()) {
            throw std::runtime_error("No stations found in database.");
        }

        std::vector<DistanceMatrixEntry> entries;
        entries.reserve(stations.size() * stations.size());

        for (const auto& from_station : stations) {
            for (const auto& to_station : stations) {
                if (from_station.id == to_station.id) {
                    entries.push_back(buildSelfEntry(from_station.id));
                    std::cout << "Matrix " << from_station.station_name << " -> "
                              << to_station.station_name << " : 0 km / 0 min" << std::endl;
                    continue;
                }

                const DistanceMatrixEntry entry = requestDrivingCost(from_station, to_station, amap_key);
                entries.push_back(entry);
                std::cout << "Matrix " << from_station.station_name << " -> "
                          << to_station.station_name << " : "
                          << entry.distance_km << " km / "
                          << entry.travel_minutes << " min" << std::endl;
            }
        }

        matrix_repository.replaceAll(entries);
        std::cout << "\nReal road-network distance matrix generated successfully." << std::endl;
        std::cout << "Rows written: " << entries.size() << std::endl;
    } catch (const std::exception& ex) {
        std::cerr << "Distance matrix generation failed: " << ex.what() << std::endl;
        return 1;
    }

    return 0;
}
