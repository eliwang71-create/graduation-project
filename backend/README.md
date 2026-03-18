# backend

该目录用于存放校园通勤车系统的后端程序代码。

主要职责：

- 系统主程序入口
- 业务逻辑调度
- 与算法模块的调用集成
- 与数据库的数据交互

当前已包含：

- `main.cpp`：后端程序入口，负责串联“读库 -> 调用算法”
- `mysql_reader.h`：MySQL 数据读取模块声明
- `mysql_reader.cpp`：从 `stations`、`vehicles`、`distance_matrix` 读取算法输入数据
- `result_writer.h`：调度结果写回模块声明
- `result_writer.cpp`：将算法结果写回 `schedule` 表
- `station_repository.h/.cpp`：站点 CRUD 数据访问层
- `station_api_server.cpp`：浏览器访问的最小 HTTP API，提供 `stations` 增删改查
- `schedule_repository.h/.cpp`：前端读取调度结果的数据访问层
- `vehicle_repository.h/.cpp`：车辆 CRUD 数据访问层
- `planning_service.h/.cpp`：基于最新站点和车辆生成真实矩阵并执行蚁群调度
- `distance_matrix_repository.h/.cpp`：真实距离矩阵写库模块
- `generate_distance_matrix.cpp`：根据数据库站点生成真实路网 `distance_matrix`

## 本机验证

可先验证 `MySQL -> C++` 数据流是否打通：

```bash
c++ -std=c++17 backend/main.cpp backend/mysql_reader.cpp algorithm/vrptw.cpp -o campus_shuttle_app $(/opt/homebrew/bin/mysql_config --cflags --libs) -L/opt/homebrew/lib
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=campus_shuttle_system ./campus_shuttle_app
```

如果运行成功，程序会打印：

- 已加载的站点数量
- 已加载的车辆数量
- 终点站编号
- 最优总距离与最优总时间
- 每辆车的访问顺序、到达时间和可行性
- `schedule` 表写回成功信息

## 站点管理 API

浏览器不能直接连接 MySQL，所以地图站点管理需要单独启动一个本地 API 服务：

```bash
c++ -std=c++17 backend/station_api_server.cpp backend/station_repository.cpp -o station_api_server $(/opt/homebrew/bin/mysql_config --cflags --libs) -L/opt/homebrew/lib
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=campus_shuttle_system ./station_api_server
```

启动后提供：

- `GET /api/stations`
- `POST /api/stations`
- `PUT /api/stations/{id}`
- `DELETE /api/stations/{id}`
- `GET /api/vehicles`
- `POST /api/vehicles`
- `PUT /api/vehicles/{id}`
- `DELETE /api/vehicles/{id}`
- `POST /api/plan`
- `GET /api/schedule-results`

前端地图页面会默认请求 `http://127.0.0.1:8080/api/stations`。如果 API 没启动，则继续使用前端内置数据。

## 真实距离矩阵生成

当数据库里的站点经纬度已经是真实点位后，可以使用高德路线服务生成真实 `distance_matrix`：

```bash
c++ -std=c++17 backend/generate_distance_matrix.cpp backend/station_repository.cpp backend/distance_matrix_repository.cpp -o generate_distance_matrix $(/opt/homebrew/bin/mysql_config --cflags --libs) -L/opt/homebrew/lib
AMAP_WEB_SERVICE_KEY=你的高德Web服务Key MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_DATABASE=campus_shuttle_system ./generate_distance_matrix
```

说明：

- 工具会读取 `stations` 表中的真实经纬度
- 逐对调用高德驾车路径服务
- 生成真实道路距离与行驶时间
- 覆盖写入 `distance_matrix`

如果你的当前 Key 仅绑定 Web 端而不能访问 Web 服务接口，需要在高德开放平台额外启用或创建可用于 Web 服务请求的 Key。
