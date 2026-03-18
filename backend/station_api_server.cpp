#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <iostream>
#include <map>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "schedule_repository.h"
#include "station_repository.h"
#include "vehicle_repository.h"
#include "planning_service.h"

namespace {

std::string readEnvOrDefault(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : std::string(value);
}

unsigned int readPortOrDefault(const char* name, unsigned int fallback) {
    const char* value = std::getenv(name);
    return value == nullptr ? fallback : static_cast<unsigned int>(std::stoul(value));
}

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
};

struct RoutePoint {
    double lng = 0.0;
    double lat = 0.0;
};

struct ApiRoutePolyline {
    int vehicle_id = 0;
    std::vector<RoutePoint> polyline;
};

std::string jsonEscape(const std::string& input) {
    std::ostringstream output;
    for (char ch : input) {
        switch (ch) {
            case '\\': output << "\\\\"; break;
            case '"': output << "\\\""; break;
            case '\n': output << "\\n"; break;
            case '\r': output << "\\r"; break;
            case '\t': output << "\\t"; break;
            default: output << ch; break;
        }
    }
    return output.str();
}

std::string stationToJson(const ApiStation& station) {
    std::ostringstream json;
    json << "{"
         << "\"id\":" << station.id << ","
         << "\"station_code\":\"" << jsonEscape(station.station_code) << "\","
         << "\"station_name\":\"" << jsonEscape(station.station_name) << "\","
         << "\"address\":\"" << jsonEscape(station.address) << "\","
         << "\"lng\":" << station.longitude << ","
         << "\"lat\":" << station.latitude << ","
         << "\"demand\":" << station.demand << ","
         << "\"service_time\":" << station.service_minutes << ","
         << "\"time_window_start\":\"" << jsonEscape(station.time_window_start) << "\","
         << "\"time_window_end\":\"" << jsonEscape(station.time_window_end) << "\","
         << "\"is_depot\":" << (station.is_depot ? "true" : "false")
         << "}";
    return json.str();
}

std::string stationsToJson(const std::vector<ApiStation>& stations) {
    std::ostringstream json;
    json << "{\"stations\":[";
    for (std::size_t i = 0; i < stations.size(); ++i) {
        if (i > 0) {
            json << ",";
        }
        json << stationToJson(stations[i]);
    }
    json << "]}";
    return json.str();
}

std::string scheduleStopsToJson(const std::vector<ApiScheduleStop>& stops) {
    std::ostringstream json;
    json << "{\"schedule_stops\":[";
    for (std::size_t i = 0; i < stops.size(); ++i) {
        if (i > 0) {
            json << ",";
        }
        json << "{"
             << "\"vehicle_id\":" << stops[i].vehicle_id << ","
             << "\"vehicle_code\":\"" << jsonEscape(stops[i].vehicle_code) << "\","
             << "\"plate_number\":\"" << jsonEscape(stops[i].plate_number) << "\","
             << "\"station_id\":" << stops[i].station_id << ","
             << "\"station_name\":\"" << jsonEscape(stops[i].station_name) << "\","
             << "\"lng\":" << stops[i].lng << ","
             << "\"lat\":" << stops[i].lat << ","
             << "\"is_depot\":" << (stops[i].is_depot ? "true" : "false") << ","
             << "\"visit_order\":" << stops[i].visit_order << ","
             << "\"arrival_time\":\"" << jsonEscape(stops[i].arrival_time) << "\","
             << "\"departure_time\":\"" << jsonEscape(stops[i].departure_time) << "\","
             << "\"feasible_flag\":" << stops[i].feasible_flag
             << "}";
    }
    json << "]}";
    return json.str();
}

std::string routePolylinesToJson(const std::vector<ApiRoutePolyline>& routes) {
    std::ostringstream json;
    json << "{\"routes\":[";
    for (std::size_t i = 0; i < routes.size(); ++i) {
        if (i > 0) {
            json << ",";
        }
        json << "{"
             << "\"vehicle_id\":" << routes[i].vehicle_id << ","
             << "\"polyline\":[";
        for (std::size_t j = 0; j < routes[i].polyline.size(); ++j) {
            if (j > 0) {
                json << ",";
            }
            json << "{"
                 << "\"lng\":" << routes[i].polyline[j].lng << ","
                 << "\"lat\":" << routes[i].polyline[j].lat
                 << "}";
        }
        json << "]}";
    }
    json << "]}";
    return json.str();
}

std::string vehicleToJson(const ApiVehicle& vehicle) {
    std::ostringstream json;
    json << "{"
         << "\"id\":" << vehicle.id << ","
         << "\"vehicle_code\":\"" << jsonEscape(vehicle.vehicle_code) << "\","
         << "\"plate_number\":\"" << jsonEscape(vehicle.plate_number) << "\","
         << "\"capacity\":" << vehicle.capacity << ","
         << "\"driver_name\":\"" << jsonEscape(vehicle.driver_name) << "\","
         << "\"driver_phone\":\"" << jsonEscape(vehicle.driver_phone) << "\","
         << "\"status\":\"" << jsonEscape(vehicle.status) << "\","
         << "\"start_depot\":\"" << jsonEscape(vehicle.start_depot) << "\","
         << "\"end_depot\":\"" << jsonEscape(vehicle.end_depot) << "\","
         << "\"max_run_minutes\":" << vehicle.max_run_minutes << ","
         << "\"earliest_departure_time\":\"" << jsonEscape(vehicle.earliest_departure_time) << "\""
         << "}";
    return json.str();
}

std::string vehiclesToJson(const std::vector<ApiVehicle>& vehicles) {
    std::ostringstream json;
    json << "{\"vehicles\":[";
    for (std::size_t i = 0; i < vehicles.size(); ++i) {
        if (i > 0) {
            json << ",";
        }
        json << vehicleToJson(vehicles[i]);
    }
    json << "]}";
    return json.str();
}

std::string planningSummaryToJson(const PlanningSummary& summary) {
    std::ostringstream json;
    json << "{"
         << "\"success\":" << (summary.success ? "true" : "false") << ","
        << "\"station_count\":" << summary.station_count << ","
        << "\"vehicle_count\":" << summary.vehicle_count << ","
        << "\"schedule_rows\":" << summary.schedule_rows << ","
        << "\"objective_value\":" << summary.objective_value << ","
        << "\"total_runtime_minutes\":" << summary.total_runtime_minutes << ","
         << "\"feasible\":" << (summary.feasible ? "true" : "false") << ","
         << "\"message\":\"" << jsonEscape(summary.message) << "\""
         << "}";
    return json.str();
}

std::string extractJsonString(const std::string& body, const std::string& key, const std::string& fallback = "") {
    const std::regex pattern("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
    std::smatch match;
    if (std::regex_search(body, match, pattern)) {
        return match[1].str();
    }
    return fallback;
}

double extractJsonDouble(const std::string& body, const std::string& key, double fallback = 0.0) {
    const std::regex pattern("\"" + key + "\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
    std::smatch match;
    if (std::regex_search(body, match, pattern)) {
        return std::stod(match[1].str());
    }
    return fallback;
}

int extractJsonInt(const std::string& body, const std::string& key, int fallback = 0) {
    const std::regex pattern("\"" + key + "\"\\s*:\\s*(-?[0-9]+)");
    std::smatch match;
    if (std::regex_search(body, match, pattern)) {
        return std::stoi(match[1].str());
    }
    return fallback;
}

bool extractJsonBool(const std::string& body, const std::string& key, bool fallback = false) {
    const std::regex pattern("\"" + key + "\"\\s*:\\s*(true|false)");
    std::smatch match;
    if (std::regex_search(body, match, pattern)) {
        return match[1].str() == "true";
    }
    return fallback;
}

ApiStation parseStationPayload(const std::string& body) {
    ApiStation station;
    station.station_name = extractJsonString(body, "station_name");
    station.address = extractJsonString(body, "address");
    station.longitude = extractJsonDouble(body, "lng");
    station.latitude = extractJsonDouble(body, "lat");
    station.demand = extractJsonInt(body, "demand");
    station.service_minutes = extractJsonInt(body, "service_time", 2);
    station.time_window_start = extractJsonString(body, "time_window_start", "07:00");
    station.time_window_end = extractJsonString(body, "time_window_end", "08:00");
    station.is_depot = extractJsonBool(body, "is_depot", false);
    return station;
}

ApiVehicle parseVehiclePayload(const std::string& body) {
    ApiVehicle vehicle;
    vehicle.plate_number = extractJsonString(body, "plate_number");
    vehicle.capacity = extractJsonInt(body, "capacity", 20);
    vehicle.driver_name = extractJsonString(body, "driver_name");
    vehicle.driver_phone = extractJsonString(body, "driver_phone");
    vehicle.status = extractJsonString(body, "status", "idle");
    vehicle.start_depot = extractJsonString(body, "start_depot");
    vehicle.end_depot = extractJsonString(body, "end_depot");
    vehicle.max_run_minutes = extractJsonInt(body, "max_run_minutes", 120);
    vehicle.earliest_departure_time = extractJsonString(body, "earliest_departure_time", "06:40");
    return vehicle;
}

std::string buildHttpResponse(
    int status_code,
    const std::string& status_text,
    const std::string& body,
    const std::string& content_type = "application/json; charset=utf-8") {
    std::ostringstream response;
    response << "HTTP/1.1 " << status_code << " " << status_text << "\r\n"
             << "Content-Type: " << content_type << "\r\n"
             << "Content-Length: " << body.size() << "\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Connection: close\r\n\r\n"
             << body;
    return response.str();
}

HttpRequest parseRequest(const std::string& raw_request) {
    std::istringstream input(raw_request);
    HttpRequest request;
    std::string request_line;
    std::getline(input, request_line);
    if (!request_line.empty() && request_line.back() == '\r') {
        request_line.pop_back();
    }

    std::istringstream line_input(request_line);
    std::string version;
    line_input >> request.method >> request.path >> version;

    const std::size_t header_end = raw_request.find("\r\n\r\n");
    if (header_end != std::string::npos) {
        request.body = raw_request.substr(header_end + 4);
    }
    return request;
}

int parseStationIdFromPath(const std::string& path) {
    const std::regex pattern("^/api/stations/([0-9]+)$");
    std::smatch match;
    if (!std::regex_match(path, match, pattern)) {
        return 0;
    }
    return std::stoi(match[1].str());
}

int parseVehicleIdFromPath(const std::string& path) {
    const std::regex pattern("^/api/vehicles/([0-9]+)$");
    std::smatch match;
    if (!std::regex_match(path, match, pattern)) {
        return 0;
    }
    return std::stoi(match[1].str());
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

std::vector<RoutePoint> parsePolylineSegments(const std::string& response) {
    const std::regex polyline_pattern("\"polyline\"\\s*:\\s*\"([^\"]+)\"");
    std::sregex_iterator begin(response.begin(), response.end(), polyline_pattern);
    std::sregex_iterator end;
    std::vector<RoutePoint> points;

    for (auto it = begin; it != end; ++it) {
        std::stringstream segment_stream((*it)[1].str());
        std::string point_text;
        while (std::getline(segment_stream, point_text, ';')) {
            const std::size_t comma = point_text.find(',');
            if (comma == std::string::npos) {
                continue;
            }
            RoutePoint point;
            point.lng = std::stod(point_text.substr(0, comma));
            point.lat = std::stod(point_text.substr(comma + 1));
            if (!points.empty()) {
                const RoutePoint& last = points.back();
                if (std::abs(last.lng - point.lng) < 1e-9 && std::abs(last.lat - point.lat) < 1e-9) {
                    continue;
                }
            }
            points.push_back(point);
        }
    }

    return points;
}

std::vector<RoutePoint> requestDrivingPolyline(
    const ApiStation& origin,
    const ApiStation& destination,
    const std::string& amap_web_service_key) {
    std::ostringstream url;
    url << "https://restapi.amap.com/v3/direction/driving"
        << "?origin=" << origin.longitude << "," << origin.latitude
        << "&destination=" << destination.longitude << "," << destination.latitude
        << "&extensions=all"
        << "&output=json"
        << "&strategy=0"
        << "&key=" << amap_web_service_key;

    const std::string response = runCommand("/usr/bin/curl -sS \"" + url.str() + "\"");
    if (response.find("\"status\":\"1\"") == std::string::npos &&
        response.find("\"status\": \"1\"") == std::string::npos) {
        throw std::runtime_error("AMap route polyline request failed: " + response);
    }

    return parsePolylineSegments(response);
}

std::vector<ApiRoutePolyline> buildRoutePolylines(
    const std::vector<ApiScheduleStop>& schedule_stops,
    const std::vector<ApiStation>& stations,
    const std::string& amap_web_service_key) {
    std::vector<ApiRoutePolyline> routes;
    if (amap_web_service_key.empty()) {
        return routes;
    }

    std::map<int, std::vector<int>> vehicle_station_ids;
    for (const auto& stop : schedule_stops) {
        vehicle_station_ids[stop.vehicle_id].push_back(stop.station_id);
    }

    auto findStation = [&](int station_id) -> const ApiStation* {
        for (const auto& station : stations) {
            if (station.id == station_id) {
                return &station;
            }
        }
        return nullptr;
    };

    for (const auto& item : vehicle_station_ids) {
        if (item.second.size() < 2) {
            continue;
        }

        ApiRoutePolyline route;
        route.vehicle_id = item.first;

        for (std::size_t i = 0; i + 1 < item.second.size(); ++i) {
            const ApiStation* origin = findStation(item.second[i]);
            const ApiStation* destination = findStation(item.second[i + 1]);
            if (origin == nullptr || destination == nullptr) {
                continue;
            }

            const std::vector<RoutePoint> segment_points =
                requestDrivingPolyline(*origin, *destination, amap_web_service_key);

            for (const auto& point : segment_points) {
                if (!route.polyline.empty()) {
                    const RoutePoint& last = route.polyline.back();
                    if (std::abs(last.lng - point.lng) < 1e-9 &&
                        std::abs(last.lat - point.lat) < 1e-9) {
                        continue;
                    }
                }
                route.polyline.push_back(point);
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(180));
        }

        routes.push_back(route);
    }

    return routes;
}

std::string handleRequest(
    const HttpRequest& request,
    StationRepository& station_repository,
    ScheduleRepository& schedule_repository,
    VehicleRepository& vehicle_repository,
    const std::string& amap_web_service_key) {
    if (request.method == "OPTIONS") {
        return buildHttpResponse(204, "No Content", "");
    }

    if (request.method == "GET" && request.path == "/api/stations") {
        return buildHttpResponse(200, "OK", stationsToJson(station_repository.listStations()));
    }

    if (request.method == "GET" && request.path == "/api/schedule-results") {
        return buildHttpResponse(200, "OK", scheduleStopsToJson(schedule_repository.listScheduleStops()));
    }

    if (request.method == "GET" && request.path == "/api/route-polylines") {
        const std::vector<ApiScheduleStop> schedule_stops = schedule_repository.listScheduleStops();
        const std::vector<ApiStation> stations = station_repository.listStations();
        return buildHttpResponse(
            200,
            "OK",
            routePolylinesToJson(buildRoutePolylines(schedule_stops, stations, amap_web_service_key)));
    }

    if (request.method == "POST" && request.path == "/api/stations") {
        const ApiStation created = station_repository.createStation(parseStationPayload(request.body));
        return buildHttpResponse(201, "Created", stationToJson(created));
    }

    if (request.method == "GET" && request.path == "/api/vehicles") {
        return buildHttpResponse(200, "OK", vehiclesToJson(vehicle_repository.listVehicles()));
    }

    if (request.method == "POST" && request.path == "/api/vehicles") {
        const ApiVehicle created = vehicle_repository.createVehicle(parseVehiclePayload(request.body));
        return buildHttpResponse(201, "Created", vehicleToJson(created));
    }

    if (request.method == "POST" && request.path == "/api/plan") {
        PlanningService planning_service(
            MySqlConfig {
                readEnvOrDefault("MYSQL_HOST", "127.0.0.1"),
                readPortOrDefault("MYSQL_PORT", 3306),
                readEnvOrDefault("MYSQL_USER", "root"),
                readEnvOrDefault("MYSQL_PASSWORD", ""),
                readEnvOrDefault("MYSQL_DATABASE", "campus_shuttle_system")
            },
            amap_web_service_key);
        const PlanningSummary summary = planning_service.runPlan(readEnvOrDefault("SCHEDULE_DATE", "2026-03-19"));
        return buildHttpResponse(200, "OK", planningSummaryToJson(summary));
    }

    const int station_id = parseStationIdFromPath(request.path);
    if (station_id > 0 && request.method == "PUT") {
        const ApiStation updated = station_repository.updateStation(station_id, parseStationPayload(request.body));
        return buildHttpResponse(200, "OK", stationToJson(updated));
    }

    if (station_id > 0 && request.method == "DELETE") {
        station_repository.deleteStation(station_id);
        return buildHttpResponse(200, "OK", "{\"message\":\"deleted\"}");
    }

    const int vehicle_id = parseVehicleIdFromPath(request.path);
    if (vehicle_id > 0 && request.method == "PUT") {
        const ApiVehicle updated = vehicle_repository.updateVehicle(vehicle_id, parseVehiclePayload(request.body));
        return buildHttpResponse(200, "OK", vehicleToJson(updated));
    }

    if (vehicle_id > 0 && request.method == "DELETE") {
        vehicle_repository.deleteVehicle(vehicle_id);
        return buildHttpResponse(200, "OK", "{\"message\":\"deleted\"}");
    }

    return buildHttpResponse(404, "Not Found", "{\"message\":\"endpoint not found\"}");
}

std::string readRequestFromSocket(int client_socket) {
    std::string request;
    char buffer[4096];
    ssize_t bytes_read = 0;

    while ((bytes_read = recv(client_socket, buffer, sizeof(buffer), 0)) > 0) {
        request.append(buffer, static_cast<std::size_t>(bytes_read));
        const std::size_t header_end = request.find("\r\n\r\n");
        if (header_end != std::string::npos) {
            const std::string headers = request.substr(0, header_end);
            std::size_t content_length = 0;
            const std::regex pattern("Content-Length:\\s*([0-9]+)", std::regex::icase);
            std::smatch match;
            if (std::regex_search(headers, match, pattern)) {
                content_length = static_cast<std::size_t>(std::stoul(match[1].str()));
            }
            if (request.size() >= header_end + 4 + content_length) {
                break;
            }
        }
    }

    return request;
}

}  // namespace

int main() {
    try {
        MySqlConfig config;
        config.host = readEnvOrDefault("MYSQL_HOST", "127.0.0.1");
        config.port = readPortOrDefault("MYSQL_PORT", 3306);
        config.user = readEnvOrDefault("MYSQL_USER", "root");
        config.password = readEnvOrDefault("MYSQL_PASSWORD", "");
        config.database = readEnvOrDefault("MYSQL_DATABASE", "campus_shuttle_system");
        const unsigned int api_port = readPortOrDefault("API_PORT", 8080);
        const std::string amap_web_service_key = readEnvOrDefault("AMAP_WEB_SERVICE_KEY", "");

        StationRepository station_repository(config);
        ScheduleRepository schedule_repository(config);
        VehicleRepository vehicle_repository(config);

        const int server_fd = socket(AF_INET, SOCK_STREAM, 0);
        if (server_fd < 0) {
            throw std::runtime_error("Failed to create API socket.");
        }

        int reuse = 1;
        setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

        sockaddr_in address {};
        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(static_cast<uint16_t>(api_port));

        if (bind(server_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
            const std::string message = std::strerror(errno);
            close(server_fd);
            throw std::runtime_error("Failed to bind API server: " + message);
        }

        if (listen(server_fd, 16) < 0) {
            const std::string message = std::strerror(errno);
            close(server_fd);
            throw std::runtime_error("Failed to listen on API server: " + message);
        }

        std::cout << "Station API server running on http://127.0.0.1:" << api_port << std::endl;
        std::cout << "Available endpoints: GET/POST /api/stations, PUT/DELETE /api/stations/{id}, GET/POST /api/vehicles, PUT/DELETE /api/vehicles/{id}, POST /api/plan, GET /api/schedule-results, GET /api/route-polylines" << std::endl;

        while (true) {
            sockaddr_in client_address {};
            socklen_t client_len = sizeof(client_address);
            const int client_socket = accept(server_fd, reinterpret_cast<sockaddr*>(&client_address), &client_len);
            if (client_socket < 0) {
                continue;
            }

            try {
                const std::string raw_request = readRequestFromSocket(client_socket);
                const HttpRequest request = parseRequest(raw_request);
                const std::string response = handleRequest(
                    request,
                    station_repository,
                    schedule_repository,
                    vehicle_repository,
                    amap_web_service_key);
                send(client_socket, response.c_str(), response.size(), 0);
            } catch (const std::exception& ex) {
                const std::string response = buildHttpResponse(
                    500,
                    "Internal Server Error",
                    std::string("{\"message\":\"") + jsonEscape(ex.what()) + "\"}");
                send(client_socket, response.c_str(), response.size(), 0);
            }

            close(client_socket);
        }
    } catch (const std::exception& ex) {
        std::cerr << "Station API server failed: " << ex.what() << std::endl;
        return 1;
    }

    return 0;
}
