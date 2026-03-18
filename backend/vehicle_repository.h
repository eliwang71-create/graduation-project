#ifndef BACKEND_VEHICLE_REPOSITORY_H
#define BACKEND_VEHICLE_REPOSITORY_H

#include <string>
#include <vector>

#include "mysql_reader.h"

struct ApiVehicle {
    int id = 0;
    std::string vehicle_code;
    std::string plate_number;
    int capacity = 0;
    std::string driver_name;
    std::string driver_phone;
    std::string status;
    std::string start_depot;
    std::string end_depot;
    int max_run_minutes = 0;
    std::string earliest_departure_time = "06:40";
};

class VehicleRepository {
public:
    explicit VehicleRepository(MySqlConfig config);

    std::vector<ApiVehicle> listVehicles() const;
    ApiVehicle createVehicle(const ApiVehicle& vehicle) const;
    ApiVehicle updateVehicle(int id, const ApiVehicle& vehicle) const;
    void deleteVehicle(int id) const;

private:
    MySqlConfig config_;
};

#endif
