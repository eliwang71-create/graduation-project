#include "schedule_repository.h"

#include <mysql.h>

#include <memory>
#include <stdexcept>
#include <string>

namespace {

using MySqlHandle = std::unique_ptr<MYSQL, decltype(&mysql_close)>;
using ResultHandle = std::unique_ptr<MYSQL_RES, decltype(&mysql_free_result)>;

MYSQL* connectDatabase(const MySqlConfig& config) {
    MYSQL* connection = mysql_init(nullptr);
    if (connection == nullptr) {
        throw std::runtime_error("Failed to initialize MySQL client.");
    }

    if (mysql_real_connect(
            connection,
            config.host.c_str(),
            config.user.c_str(),
            config.password.empty() ? nullptr : config.password.c_str(),
            config.database.c_str(),
            config.port,
            nullptr,
            0) == nullptr) {
        const std::string message = mysql_error(connection);
        mysql_close(connection);
        throw std::runtime_error(message);
    }

    return connection;
}

void runQuery(MYSQL* connection, const std::string& query) {
    if (mysql_query(connection, query.c_str()) != 0) {
        throw std::runtime_error(mysql_error(connection));
    }
}

std::string columnValue(MYSQL_ROW row, unsigned long* lengths, int index) {
    if (row[index] == nullptr) {
        return "";
    }
    return std::string(row[index], lengths[index]);
}

int parseInt(const std::string& value) {
    return value.empty() ? 0 : std::stoi(value);
}

double parseDouble(const std::string& value) {
    return value.empty() ? 0.0 : std::stod(value);
}

}  // namespace

ScheduleRepository::ScheduleRepository(MySqlConfig config) : config_(std::move(config)) {}

std::vector<ApiScheduleStop> ScheduleRepository::listScheduleStops() const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(
        connection.get(),
        "SELECT s.vehicle_id, v.vehicle_code, v.plate_number, s.station_id, st.station_name, st.longitude, st.latitude, st.is_depot, s.visit_order, "
        "TIME_FORMAT(s.arrival_time, '%H:%i'), TIME_FORMAT(s.departure_time, '%H:%i'), s.feasible_flag "
        "FROM schedule s "
        "LEFT JOIN vehicles v ON s.vehicle_id = v.id "
        "LEFT JOIN stations st ON s.station_id = st.id "
        "WHERE s.station_id IS NOT NULL "
        "ORDER BY s.vehicle_id, s.visit_order");

    MYSQL_RES* raw_result = mysql_store_result(connection.get());
    if (raw_result == nullptr) {
        throw std::runtime_error(mysql_error(connection.get()));
    }

    ResultHandle result(raw_result, mysql_free_result);
    std::vector<ApiScheduleStop> stops;
    MYSQL_ROW row = nullptr;
    while ((row = mysql_fetch_row(result.get())) != nullptr) {
        unsigned long* lengths = mysql_fetch_lengths(result.get());
        ApiScheduleStop stop;
        stop.vehicle_id = parseInt(columnValue(row, lengths, 0));
        stop.vehicle_code = columnValue(row, lengths, 1);
        stop.plate_number = columnValue(row, lengths, 2);
        stop.station_id = parseInt(columnValue(row, lengths, 3));
        stop.station_name = columnValue(row, lengths, 4);
        stop.lng = parseDouble(columnValue(row, lengths, 5));
        stop.lat = parseDouble(columnValue(row, lengths, 6));
        stop.is_depot = parseInt(columnValue(row, lengths, 7)) == 1;
        stop.visit_order = parseInt(columnValue(row, lengths, 8));
        stop.arrival_time = columnValue(row, lengths, 9);
        stop.departure_time = columnValue(row, lengths, 10);
        stop.feasible_flag = parseInt(columnValue(row, lengths, 11));
        stops.push_back(stop);
    }
    return stops;
}
