#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <iostream>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "station_repository.h"

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

std::string handleRequest(const HttpRequest& request, StationRepository& repository) {
    if (request.method == "OPTIONS") {
        return buildHttpResponse(204, "No Content", "");
    }

    if (request.method == "GET" && request.path == "/api/stations") {
        return buildHttpResponse(200, "OK", stationsToJson(repository.listStations()));
    }

    if (request.method == "POST" && request.path == "/api/stations") {
        const ApiStation created = repository.createStation(parseStationPayload(request.body));
        return buildHttpResponse(201, "Created", stationToJson(created));
    }

    const int station_id = parseStationIdFromPath(request.path);
    if (station_id > 0 && request.method == "PUT") {
        const ApiStation updated = repository.updateStation(station_id, parseStationPayload(request.body));
        return buildHttpResponse(200, "OK", stationToJson(updated));
    }

    if (station_id > 0 && request.method == "DELETE") {
        repository.deleteStation(station_id);
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

        StationRepository repository(config);

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
        std::cout << "Available endpoints: GET/POST /api/stations, PUT/DELETE /api/stations/{id}" << std::endl;

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
                const std::string response = handleRequest(request, repository);
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
