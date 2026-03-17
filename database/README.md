# database

该目录用于存放校园通勤车系统的 MySQL 数据库设计与初始化脚本。

## 目录用途

- 定义系统核心业务表结构
- 提供数据库初始化脚本
- 为后续算法测试、调度结果存储和业务管理提供数据基础

## 当前文件

- `schema.sql`：校园通勤车系统数据库初始化脚本
- `seed.sql`：测试数据脚本
- `schedule_migration.sql`：为 `schedule` 表补充结果写回字段的迁移脚本

## 核心数据表

- `users`：系统用户与角色信息
- `vehicles`：通勤车辆信息
- `stations`：站点、需求和硬时间窗信息
- `routes`：线路主数据
- `schedule`：调度计划与求解结果
- `distance_matrix`：站点间距离和行驶时间矩阵

## 初始化方式

如果本机通过 Homebrew 安装 MySQL，可使用以下命令：

```bash
/opt/homebrew/bin/brew services start mysql
/opt/homebrew/bin/mysql -u root < database/schema.sql
/opt/homebrew/bin/mysql -u root < database/schedule_migration.sql
/opt/homebrew/bin/mysql -u root < database/seed.sql
```

如果 root 账户启用了密码，也可以使用：

```bash
/opt/homebrew/bin/mysql -u root -p < database/schema.sql
```

## 设计说明

该数据库设计面向带硬时间窗的车辆路径问题（VRPTW）场景：

- `stations` 中保存每个站点的服务时间窗和需求量
- `vehicles` 中保存车辆容量和运行时长限制
- `distance_matrix` 为算法模块提供站点间距离与时间成本
- `schedule` 用于保存调度方案、目标函数值、站点访问顺序与可行性结果
