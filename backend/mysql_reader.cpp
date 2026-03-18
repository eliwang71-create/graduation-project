#include "mysql_reader.h"

#include <mysql.h>

#include <cstdlib>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

using MySqlHandle = std::unique_ptr<MYSQL, decltype(&mysql_close)>;

int parseTimeToMinutes(const std::string& value) {
    int hours = 0;
    int minutes = 0;
    int seconds = 0;
    char colon = '\0';
    std::istringstream input(value);
    input >> hours >> colon >> minutes >> colon >> seconds;
    return hours * 60 + minutes;
}

std::string normalizeTimeString(const std::string& value, const std::string& fallback = "06:40:00") {
    return value.empty() ? fallback : value;
}

std::string columnValue(MYSQL_ROW row, unsigned long* lengths, int index) {
    if (row[index] == nullptr) {
        return "";
    }
    return std::string(row[index], lengths[index]);
}

double parseDouble(const std::string& value) {
    return value.empty() ? 0.0 : std::stod(value);
}

int parseInt(const std::string& value) {
    return value.empty() ? 0 : std::stoi(value);
}

int stationIndexById(const std::vector<Station>& stations, int station_id) {
    for (std::size_t i = 0; i < stations.size(); ++i) {
        if (stations[i].id == station_id) {
            return static_cast<int>(i);
        }
    }
    return -1;
}

void runQuery(MYSQL* connection, const std::string& query) {
    if (mysql_query(connection, query.c_str()) != 0) {
        throw std::runtime_error(mysql_error(connection));
    }
}

}  // namespace

MySqlReader::MySqlReader(MySqlConfig config) : config_(std::move(config)) {}

VRPTWInstance MySqlReader::loadInstance() const {
    MySqlHandle connection(mysql_init(nullptr), mysql_close);
    if (!connection) {
        throw std::runtime_error("Failed to initialize MySQL client.");
    }

    if (mysql_real_connect(
            connection.get(),
            config_.host.c_str(),
            config_.user.c_str(),
            config_.password.empty() ? nullptr : config_.password.c_str(),
            config_.database.c_str(),
            config_.port,
            nullptr,
            0) == nullptr) {
        throw std::runtime_error(mysql_error(connection.get()));
    }

    VRPTWInstance instance;

    runQuery(
        connection.get(),
        "SELECT id, station_code, station_name, demand, service_minutes, "
        "time_window_start, time_window_end, is_depot "
        "FROM stations ORDER BY id");

    {
        MYSQL_RES* raw_result = mysql_store_result(connection.get());
        if (raw_result == nullptr) {
            throw std::runtime_error(mysql_error(connection.get()));
        }

        std::unique_ptr<MYSQL_RES, decltype(&mysql_free_result)> result(raw_result, mysql_free_result);
        MYSQL_ROW row = nullptr;
        while ((row = mysql_fetch_row(result.get())) != nullptr) {
            unsigned long* lengths = mysql_fetch_lengths(result.get());
            Station station;
            station.id = parseInt(columnValue(row, lengths, 0));
            station.code = columnValue(row, lengths, 1);
            station.name = columnValue(row, lengths, 2);
            station.demand = parseInt(columnValue(row, lengths, 3));
            station.service_minutes = parseInt(columnValue(row, lengths, 4));
            station.window.earliest_minutes = parseTimeToMinutes(columnValue(row, lengths, 5));
            station.window.latest_minutes = parseTimeToMinutes(columnValue(row, lengths, 6));
            station.is_depot = parseInt(columnValue(row, lengths, 7)) == 1;

            if (station.is_depot && station.name == "西安财经大学长安校区东大门") {
                instance.destination_station_id = station.id;
            }
            instance.stations.push_back(station);
        }
    }

    if (instance.destination_station_id == 0) {
        for (const auto& station : instance.stations) {
            if (station.is_depot) {
                instance.destination_station_id = station.id;
                break;
            }
        }
    }

    runQuery(
        connection.get(),
        "SELECT id, vehicle_code, plate_number, capacity, max_run_minutes, "
        "TIME_FORMAT(earliest_departure_time, '%H:%i:%s') "
        "FROM vehicles ORDER BY id");

    {
        MYSQL_RES* raw_result = mysql_store_result(connection.get());
        if (raw_result == nullptr) {
            throw std::runtime_error(mysql_error(connection.get()));
        }

        std::unique_ptr<MYSQL_RES, decltype(&mysql_free_result)> result(raw_result, mysql_free_result);
        MYSQL_ROW row = nullptr;
        while ((row = mysql_fetch_row(result.get())) != nullptr) {
            unsigned long* lengths = mysql_fetch_lengths(result.get());
            Vehicle vehicle;
            vehicle.id = parseInt(columnValue(row, lengths, 0));
            vehicle.code = columnValue(row, lengths, 1);
            vehicle.plate_number = columnValue(row, lengths, 2);
            vehicle.capacity = parseInt(columnValue(row, lengths, 3));
            vehicle.max_run_minutes = parseInt(columnValue(row, lengths, 4));
            vehicle.earliest_departure_minutes =
                parseTimeToMinutes(normalizeTimeString(columnValue(row, lengths, 5)));
            instance.vehicles.push_back(vehicle);
        }
    }

    const std::size_t station_count = instance.stations.size();
    instance.distance_matrix_km.assign(station_count, std::vector<double>(station_count, 0.0));
    instance.travel_time_matrix_minutes.assign(station_count, std::vector<int>(station_count, 0));

    runQuery(
        connection.get(),
        "SELECT from_station_id, to_station_id, distance_km, travel_minutes "
        "FROM distance_matrix ORDER BY from_station_id, to_station_id");

    {
        MYSQL_RES* raw_result = mysql_store_result(connection.get());
        if (raw_result == nullptr) {
            throw std::runtime_error(mysql_error(connection.get()));
        }

        std::unique_ptr<MYSQL_RES, decltype(&mysql_free_result)> result(raw_result, mysql_free_result);
        MYSQL_ROW row = nullptr;
        while ((row = mysql_fetch_row(result.get())) != nullptr) {
            unsigned long* lengths = mysql_fetch_lengths(result.get());
            const int from_station_id = parseInt(columnValue(row, lengths, 0));
            const int to_station_id = parseInt(columnValue(row, lengths, 1));
            const double distance_km = parseDouble(columnValue(row, lengths, 2));
            const int travel_minutes = parseInt(columnValue(row, lengths, 3));

            const int from_index = stationIndexById(instance.stations, from_station_id);
            const int to_index = stationIndexById(instance.stations, to_station_id);
            if (from_index >= 0 && to_index >= 0) {
                instance.distance_matrix_km[static_cast<std::size_t>(from_index)][static_cast<std::size_t>(to_index)] =
                    distance_km;
                instance.travel_time_matrix_minutes[static_cast<std::size_t>(from_index)]
                                                  [static_cast<std::size_t>(to_index)] = travel_minutes;
            }
        }
    }

    if (instance.destination_station_id == 0) {
        throw std::runtime_error("No destination depot was found in stations table.");
    }

    return instance;
}
