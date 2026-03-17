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
