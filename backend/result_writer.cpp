#include "result_writer.h"

#include <mysql.h>

#include <cstdio>
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

const Station* findStationById(const VRPTWInstance& instance, int station_id) {
    for (const auto& station : instance.stations) {
        if (station.id == station_id) {
            return &station;
        }
    }
    return nullptr;
}

std::string toDateTimeString(const std::string& date, int minutes) {
    const int hours = minutes / 60;
    const int mins = minutes % 60;
    char buffer[20];
    std::snprintf(buffer, sizeof(buffer), "%s %02d:%02d:00", date.c_str(), hours, mins);
    return std::string(buffer);
}

std::string buildScheduleCode(const std::string& date, int vehicle_id, int visit_order) {
    std::string compact_date;
    for (char ch : date) {
        if (ch != '-') {
            compact_date.push_back(ch);
        }
    }

    char buffer[31];
    std::snprintf(buffer, sizeof(buffer), "ACO%sV%dO%d", compact_date.c_str(), vehicle_id, visit_order);
    return std::string(buffer);
}

}  // namespace

ResultWriter::ResultWriter(MySqlConfig config) : config_(std::move(config)) {}

void ResultWriter::clearSchedule() const {
    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(connection.get(), "DELETE FROM schedule");
}

int ResultWriter::writeScheduleResult(
    const VRPTWInstance& instance,
    const ACOResult& result,
    const std::string& schedule_date) const {
    if (!result.feasible || result.routes.empty()) {
        return 0;
    }

    MySqlHandle connection(connectDatabase(config_), mysql_close);
    runQuery(connection.get(), "START TRANSACTION");

    int inserted_rows = 0;

    try {
        for (const auto& route : result.routes) {
            for (std::size_t i = 0; i < route.station_ids.size(); ++i) {
                const int station_id = route.station_ids[i];
                const Station* station = findStationById(instance, station_id);
                if (station == nullptr || i >= route.arrival_times_minutes.size()) {
                    continue;
                }

                const int arrival_minutes = route.arrival_times_minutes[i];
                const int departure_minutes = arrival_minutes + station->service_minutes;

                const std::string schedule_code = buildScheduleCode(schedule_date, route.vehicle_id, static_cast<int>(i + 1));
                const std::string arrival_time = toDateTimeString(schedule_date, arrival_minutes);
                const std::string departure_time = toDateTimeString(schedule_date, departure_minutes);
                const std::string planned_end_time =
                    route.arrival_times_minutes.empty()
                        ? departure_time
                        : toDateTimeString(schedule_date, route.arrival_times_minutes.back());

                std::ostringstream sql;
                sql << "INSERT INTO schedule ("
                    << "schedule_code, route_id, vehicle_id, station_id, visit_order, "
                    << "departure_date, arrival_time, departure_time, planned_end_time, actual_end_time, "
                    << "total_distance_km, total_duration_minutes, objective_value, is_feasible, feasible_flag, status, remarks"
                    << ") VALUES ("
                    << "'" << schedule_code << "', "
                    << "NULL, "
                    << route.vehicle_id << ", "
                    << station_id << ", "
                    << (i + 1) << ", "
                    << "'" << schedule_date << "', "
                    << "'" << arrival_time << "', "
                    << "'" << departure_time << "', "
                    << "'" << planned_end_time << "', "
                    << "NULL, "
                    << route.total_distance_km << ", "
                    << route.total_runtime_minutes << ", "
                    << result.objective_value << ", "
                    << (route.feasible ? 1 : 0) << ", "
                    << (route.feasible ? 1 : 0) << ", "
                    << "'planned', "
                    << "'ACO generated schedule result')";

                runQuery(connection.get(), sql.str());
                ++inserted_rows;
            }
        }

        runQuery(connection.get(), "COMMIT");
    } catch (...) {
        runQuery(connection.get(), "ROLLBACK");
        throw;
    }

    return inserted_rows;
}
