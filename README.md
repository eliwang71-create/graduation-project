# 校园通勤车系统

基于 `C++ + MySQL + VS Code` 的校园通勤车调度系统项目骨架，面向带硬时间窗的车辆路径问题（VRPTW）场景，后续将围绕车辆调度、路径规划、运行计划管理和基础数据管理逐步完善。

## 目录结构

- `backend/`：后端程序入口与业务调度逻辑
- `algorithm/`：VRPTW 建模与路径规划算法实现
- `database/`：MySQL 数据库脚本与表结构设计
- `frontend/`：前端界面或展示层相关资源
- `docs/`：需求分析、概要设计、算法设计等文档

## 当前初始化内容

- `backend/main.cpp`：系统后端主程序入口
- `backend/mysql_reader.cpp`：MySQL 数据读取模块
- `algorithm/vrptw.h`：VRPTW 与蚁群算法接口定义
- `algorithm/vrptw.cpp`：蚁群算法求解器骨架
- `database/schema.sql`：数据库初始化脚本
- `database/seed.sql`：测试数据脚本
- 各模块目录下的 `README.md`：目录用途说明

## 项目目标

本项目旨在实现一个校园通勤车调度系统，通过建立带硬时间窗的车辆路径问题模型，对车辆、站点、时间窗和运行计划进行统一管理与优化，提升通勤车调度的准时性与运行效率。

## 当前开发进展

当前代码已经形成基础的数据流：

- MySQL 存储车辆、站点和距离矩阵
- C++ 后端通过 `mysql_reader` 读取数据
- 算法模块通过 `AcoVrptwSolver` 接收 `VRPTWInstance`
- 后续可继续补充完整蚁群算法求解、结果回写和前端展示
