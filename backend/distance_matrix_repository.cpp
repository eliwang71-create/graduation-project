#include "distance_matrix_repository.h"

#include <mysql.h>

#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {

using MySqlHandle = std::unique_ptr<MYSQL, decltype(&mysql_close)>;

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

}  // namespace

DistanceMatrixRepository::DistanceMatrixRepository(MySqlConfig config) : config_(std::move(config)) {}

void DistanceMatrixRepository::replaceAll(const std::vector<DistanceMatrixEntry>& entries) const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(connection.get(), "START TRANSACTION");

    try {
        runQuery(connection.get(), "DELETE FROM distance_matrix");

        for (const auto& entry : entries) {
            std::ostringstream sql;
            sql << "INSERT INTO distance_matrix ("
                << "from_station_id, to_station_id, distance_km, travel_minutes, traffic_factor"
                << ") VALUES ("
                << entry.from_station_id << ", "
                << entry.to_station_id << ", "
                << entry.distance_km << ", "
                << entry.travel_minutes << ", "
                << entry.traffic_factor
                << ")";
            runQuery(connection.get(), sql.str());
        }

        runQuery(connection.get(), "COMMIT");
    } catch (...) {
        runQuery(connection.get(), "ROLLBACK");
        throw;
    }
}
