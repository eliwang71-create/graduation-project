#include "vehicle_repository.h"

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

ApiVehicle mapVehicleRow(MYSQL_ROW row, unsigned long* lengths) {
    ApiVehicle vehicle;
    vehicle.id = parseInt(columnValue(row, lengths, 0));
    vehicle.vehicle_code = columnValue(row, lengths, 1);
    vehicle.plate_number = columnValue(row, lengths, 2);
    vehicle.capacity = parseInt(columnValue(row, lengths, 3));
    vehicle.driver_name = columnValue(row, lengths, 4);
    vehicle.driver_phone = columnValue(row, lengths, 5);
    vehicle.status = columnValue(row, lengths, 6);
    vehicle.start_depot = columnValue(row, lengths, 7);
    vehicle.end_depot = columnValue(row, lengths, 8);
    vehicle.max_run_minutes = parseInt(columnValue(row, lengths, 9));
    vehicle.earliest_departure_time = columnValue(row, lengths, 10);
    return vehicle;
}

std::string buildVehicleCode() {
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    const auto millis = std::chrono::duration_cast<std::chrono::milliseconds>(now).count();
    return "BUS" + std::to_string(millis);
}

ApiVehicle fetchVehicleById(MYSQL* connection, int id) {
    std::ostringstream sql;
    sql << "SELECT id, vehicle_code, plate_number, capacity, driver_name, driver_phone, status, "
           "start_depot, end_depot, max_run_minutes, TIME_FORMAT(earliest_departure_time, '%H:%i') "
           "FROM vehicles WHERE id = " << id;
    runQuery(connection, sql.str());

    MYSQL_RES* raw_result = mysql_store_result(connection);
    if (raw_result == nullptr) {
        throw std::runtime_error(mysql_error(connection));
    }

    ResultHandle result(raw_result, mysql_free_result);
    MYSQL_ROW row = mysql_fetch_row(result.get());
    if (row == nullptr) {
        throw std::runtime_error("Vehicle record was not found.");
    }

    unsigned long* lengths = mysql_fetch_lengths(result.get());
    return mapVehicleRow(row, lengths);
}

}  // namespace

VehicleRepository::VehicleRepository(MySqlConfig config) : config_(std::move(config)) {}

std::vector<ApiVehicle> VehicleRepository::listVehicles() const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(
        connection.get(),
        "SELECT id, vehicle_code, plate_number, capacity, driver_name, driver_phone, status, "
        "start_depot, end_depot, max_run_minutes, TIME_FORMAT(earliest_departure_time, '%H:%i') "
        "FROM vehicles ORDER BY id");

    MYSQL_RES* raw_result = mysql_store_result(connection.get());
    if (raw_result == nullptr) {
        throw std::runtime_error(mysql_error(connection.get()));
    }

    ResultHandle result(raw_result, mysql_free_result);
    std::vector<ApiVehicle> vehicles;
    MYSQL_ROW row = nullptr;
    while ((row = mysql_fetch_row(result.get())) != nullptr) {
        unsigned long* lengths = mysql_fetch_lengths(result.get());
        vehicles.push_back(mapVehicleRow(row, lengths));
    }
    return vehicles;
}

ApiVehicle VehicleRepository::createVehicle(const ApiVehicle& vehicle) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    const std::string vehicle_code = vehicle.vehicle_code.empty() ? buildVehicleCode() : vehicle.vehicle_code;
    const std::string plate_number = escapeString(connection.get(), vehicle.plate_number);
    const std::string driver_name = escapeString(connection.get(), vehicle.driver_name);
    const std::string driver_phone = escapeString(connection.get(), vehicle.driver_phone);
    const std::string status = escapeString(connection.get(), vehicle.status.empty() ? "idle" : vehicle.status);
    const std::string start_depot = escapeString(connection.get(), vehicle.start_depot);
    const std::string end_depot = escapeString(connection.get(), vehicle.end_depot);
    const std::string earliest_departure_time =
        escapeString(connection.get(), vehicle.earliest_departure_time.empty() ? "06:40" : vehicle.earliest_departure_time);

    std::ostringstream sql;
    sql << "INSERT INTO vehicles (vehicle_code, plate_number, capacity, driver_name, driver_phone, status, "
        << "start_depot, end_depot, max_run_minutes, earliest_departure_time) VALUES ("
        << "'" << vehicle_code << "', "
        << "'" << plate_number << "', "
        << vehicle.capacity << ", "
        << "'" << driver_name << "', "
        << "'" << driver_phone << "', "
        << "'" << status << "', "
        << "'" << start_depot << "', "
        << "'" << end_depot << "', "
        << vehicle.max_run_minutes << ", "
        << "'" << earliest_departure_time << ":00')";
    runQuery(connection.get(), sql.str());
    return fetchVehicleById(connection.get(), static_cast<int>(mysql_insert_id(connection.get())));
}

ApiVehicle VehicleRepository::updateVehicle(int id, const ApiVehicle& vehicle) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    const std::string plate_number = escapeString(connection.get(), vehicle.plate_number);
    const std::string driver_name = escapeString(connection.get(), vehicle.driver_name);
    const std::string driver_phone = escapeString(connection.get(), vehicle.driver_phone);
    const std::string status = escapeString(connection.get(), vehicle.status.empty() ? "idle" : vehicle.status);
    const std::string start_depot = escapeString(connection.get(), vehicle.start_depot);
    const std::string end_depot = escapeString(connection.get(), vehicle.end_depot);
    const std::string earliest_departure_time =
        escapeString(connection.get(), vehicle.earliest_departure_time.empty() ? "06:40" : vehicle.earliest_departure_time);

    std::ostringstream sql;
    sql << "UPDATE vehicles SET "
        << "plate_number = '" << plate_number << "', "
        << "capacity = " << vehicle.capacity << ", "
        << "driver_name = '" << driver_name << "', "
        << "driver_phone = '" << driver_phone << "', "
        << "status = '" << status << "', "
        << "start_depot = '" << start_depot << "', "
        << "end_depot = '" << end_depot << "', "
        << "max_run_minutes = " << vehicle.max_run_minutes << ", "
        << "earliest_departure_time = '" << earliest_departure_time << ":00' "
        << "WHERE id = " << id;
    runQuery(connection.get(), sql.str());
    return fetchVehicleById(connection.get(), id);
}

void VehicleRepository::deleteVehicle(int id) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(connection.get(), "START TRANSACTION");
    try {
        {
            std::ostringstream sql;
            sql << "DELETE FROM schedule WHERE vehicle_id = " << id;
            runQuery(connection.get(), sql.str());
        }
        {
            std::ostringstream sql;
            sql << "DELETE FROM vehicles WHERE id = " << id;
            runQuery(connection.get(), sql.str());
        }
        runQuery(connection.get(), "COMMIT");
    } catch (...) {
        runQuery(connection.get(), "ROLLBACK");
        throw;
    }
}
