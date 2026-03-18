#ifndef BACKEND_DISTANCE_MATRIX_REPOSITORY_H
#define BACKEND_DISTANCE_MATRIX_REPOSITORY_H

#include <vector>

#include "mysql_reader.h"
#include "station_repository.h"

struct DistanceMatrixEntry {
    int from_station_id = 0;
    int to_station_id = 0;
    double distance_km = 0.0;
    int travel_minutes = 0;
    double traffic_factor = 1.0;
};

class DistanceMatrixRepository {
public:
    explicit DistanceMatrixRepository(MySqlConfig config);

    void replaceAll(const std::vector<DistanceMatrixEntry>& entries) const;

private:
    MySqlConfig config_;
};

#endif
