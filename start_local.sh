#!/bin/zsh
set -e

ROOT_DIR="/Users/elizeekr/Desktop/graduation-project"
cd "$ROOT_DIR"

echo "Building station_api_server..."
c++ -std=c++17 \
  backend/station_api_server.cpp \
  backend/station_repository.cpp \
  backend/schedule_repository.cpp \
  backend/vehicle_repository.cpp \
  backend/planning_service.cpp \
  backend/mysql_reader.cpp \
  backend/result_writer.cpp \
  backend/distance_matrix_repository.cpp \
  algorithm/vrptw.cpp \
  -o station_api_server \
  $(/opt/homebrew/bin/mysql_config --cflags --libs) \
  -L/opt/homebrew/lib

echo "Starting station_api_server on http://127.0.0.1:8080 ..."
AMAP_WEB_SERVICE_KEY=60d746c635c294f73c025ef4623ae89f MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=campus_shuttle_system ./station_api_server
