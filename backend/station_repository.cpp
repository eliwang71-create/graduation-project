#include "station_repository.h"

#include <mysql.h>

#include <chrono>
#include <memory>
#include <sstream>
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

bool parseBool(const std::string& value) {
    return value == "1";
}

std::string escapeString(MYSQL* connection, const std::string& value) {
    std::string output;
    output.resize(value.size() * 2 + 1);
    const unsigned long length = mysql_real_escape_string(
        connection,
        output.data(),
        value.c_str(),
        static_cast<unsigned long>(value.size()));
    output.resize(length);
    return output;
}

ApiStation mapStationRow(MYSQL_ROW row, unsigned long* lengths) {
    ApiStation station;
    station.id = parseInt(columnValue(row, lengths, 0));
    station.station_code = columnValue(row, lengths, 1);
    station.station_name = columnValue(row, lengths, 2);
    station.address = columnValue(row, lengths, 3);
    station.latitude = parseDouble(columnValue(row, lengths, 4));
    station.longitude = parseDouble(columnValue(row, lengths, 5));
    station.demand = parseInt(columnValue(row, lengths, 6));
    station.service_minutes = parseInt(columnValue(row, lengths, 7));
    station.time_window_start = columnValue(row, lengths, 8);
    station.time_window_end = columnValue(row, lengths, 9);
    station.is_depot = parseBool(columnValue(row, lengths, 10));
    return station;
}

std::string buildStationCode() {
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    const auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(now).count();
    return "ST" + std::to_string(millis);
}

ApiStation fetchStationById(MYSQL* connection, int id) {
    std::ostringstream sql;
    sql << "SELECT id, station_code, station_name, address, latitude, longitude, demand, service_minutes, "
           "TIME_FORMAT(time_window_start, '%H:%i'), TIME_FORMAT(time_window_end, '%H:%i'), is_depot "
           "FROM stations WHERE id = " << id;
    runQuery(connection, sql.str());

    MYSQL_RES* raw_result = mysql_store_result(connection);
    if (raw_result == nullptr) {
        throw std::runtime_error(mysql_error(connection));
    }

    ResultHandle result(raw_result, mysql_free_result);
    MYSQL_ROW row = mysql_fetch_row(result.get());
    if (row == nullptr) {
        throw std::runtime_error("Station record was not found.");
    }

    unsigned long* lengths = mysql_fetch_lengths(result.get());
    return mapStationRow(row, lengths);
}

}  // namespace

StationRepository::StationRepository(MySqlConfig config) : config_(std::move(config)) {}

std::vector<ApiStation> StationRepository::listStations() const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(
        connection.get(),
        "SELECT id, station_code, station_name, address, latitude, longitude, demand, service_minutes, "
        "TIME_FORMAT(time_window_start, '%H:%i'), TIME_FORMAT(time_window_end, '%H:%i'), is_depot "
        "FROM stations ORDER BY id");

    MYSQL_RES* raw_result = mysql_store_result(connection.get());
    if (raw_result == nullptr) {
        throw std::runtime_error(mysql_error(connection.get()));
    }

    ResultHandle result(raw_result, mysql_free_result);
    std::vector<ApiStation> stations;
    MYSQL_ROW row = nullptr;
    while ((row = mysql_fetch_row(result.get())) != nullptr) {
        unsigned long* lengths = mysql_fetch_lengths(result.get());
        stations.push_back(mapStationRow(row, lengths));
    }
    return stations;
}

ApiStation StationRepository::createStation(const ApiStation& station) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);

    const std::string station_code = station.station_code.empty() ? buildStationCode() : station.station_code;
    const std::string station_name = escapeString(connection.get(), station.station_name);
    const std::string address = escapeString(connection.get(), station.address);

    std::ostringstream sql;
    sql << "INSERT INTO stations ("
        << "station_code, station_name, address, latitude, longitude, demand, service_minutes, "
        << "time_window_start, time_window_end, is_depot"
        << ") VALUES ("
        << "'" << station_code << "', "
        << "'" << station_name << "', "
        << "'" << address << "', "
        << station.latitude << ", "
        << station.longitude << ", "
        << station.demand << ", "
        << station.service_minutes << ", "
        << "'" << station.time_window_start << ":00', "
        << "'" << station.time_window_end << ":00', "
        << (station.is_depot ? 1 : 0)
        << ")";

    runQuery(connection.get(), sql.str());
    return fetchStationById(connection.get(), static_cast<int>(mysql_insert_id(connection.get())));
}

ApiStation StationRepository::updateStation(int id, const ApiStation& station) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);

    const std::string station_name = escapeString(connection.get(), station.station_name);
    const std::string address = escapeString(connection.get(), station.address);

    std::ostringstream sql;
    sql << "UPDATE stations SET "
        << "station_name = '" << station_name << "', "
        << "address = '" << address << "', "
        << "latitude = " << station.latitude << ", "
        << "longitude = " << station.longitude << ", "
        << "demand = " << station.demand << ", "
        << "service_minutes = " << station.service_minutes << ", "
        << "time_window_start = '" << station.time_window_start << ":00', "
        << "time_window_end = '" << station.time_window_end << ":00', "
        << "is_depot = " << (station.is_depot ? 1 : 0) << " "
        << "WHERE id = " << id;

    runQuery(connection.get(), sql.str());
    return fetchStationById(connection.get(), id);
}

void StationRepository::deleteStation(int id) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(connection.get(), "START TRANSACTION");
    try {
        {
            std::ostringstream sql;
            sql << "DELETE FROM distance_matrix WHERE from_station_id = " << id
                << " OR to_station_id = " << id;
            runQuery(connection.get(), sql.str());
        }
        {
            std::ostringstream sql;
            sql << "DELETE FROM schedule WHERE station_id = " << id;
            runQuery(connection.get(), sql.str());
        }
        {
            std::ostringstream sql;
            sql << "DELETE FROM routes WHERE start_station_id = " << id
                << " OR end_station_id = " << id;
            runQuery(connection.get(), sql.str());
        }
        {
            std::ostringstream sql;
            sql << "DELETE FROM stations WHERE id = " << id;
            runQuery(connection.get(), sql.str());
        }
        runQuery(connection.get(), "COMMIT");
    } catch (...) {
        runQuery(connection.get(), "ROLLBACK");
        throw;
    }
}
