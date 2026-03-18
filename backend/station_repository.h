#ifndef BACKEND_STATION_REPOSITORY_H
#define BACKEND_STATION_REPOSITORY_H

#include <string>
#include <vector>

#include "mysql_reader.h"

struct ApiStation {
    int id = 0;
    std::string station_code;
    std::string station_name;
    std::string address;
    double longitude = 0.0;
    double latitude = 0.0;
    int demand = 0;
    int service_minutes = 0;
    std::string time_window_start;
    std::string time_window_end;
    bool is_depot = false;
};

class StationRepository {
public:
    explicit StationRepository(MySqlConfig config);

    std::vector<ApiStation> listStations() const;
    ApiStation createStation(const ApiStation& station) const;
    ApiStation updateStation(int id, const ApiStation& station) const;
    void deleteStation(int id) const;

private:
    MySqlConfig config_;
};

#endif
