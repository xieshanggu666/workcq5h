# 🏠 智居 · 智能家居场景联动与设备健康看板

基于 **Vue 3 + Vite + Pinia（前端）+ Express + SQLite（后端）** 的智能家居演示看板。纯 mock 设备数据，无真实硬件接入。

## 技术栈

- 前端：Vue 3 + Vite + Pinia
- 后端：Node.js 内置 `node:sqlite` + Express，REST API
- 数据库：`server/home.db`（SQLite，首次启动自动建表 + 预置演示数据）

## 运行

```bash
npm install
npm run dev
```

前端 http://localhost:5190（Vite 已代理 `/api` 到 http://localhost:4120）。
需 Node ≥ 22.13。

## 功能

- **健康看板**：设备在线/异常统计、房间分布、设备类型、告警中心（低电量/信号弱/离线/能耗尖峰）、全屋 24h 能耗趋势
- **设备管理**：按房间/类型/状态筛选，添加/删除设备，开关切换，功率编辑、电量/信号条
- **场景联动**：可视化动作编排（设备→动作），创建/启用停用/触发场景，触发后写入日志并联动开关真实设备状态
- **能耗统计**：按房间分布、设备用电排行、实时功率、节能提示
- **日志时间线**：所有操作的实时记录

## 数据库表

`rooms` `device_types` `devices` `scenes` `scene_actions` `device_logs` `energy`

## 后续可扩展

真实协议接入占位、定时任务、告警订阅、家庭房间拓扑、多用户权限、语音指令占位、告警自动推送、能耗定额与超标预警、设备固件版本管理、复盘报表导出