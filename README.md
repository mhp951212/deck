# LAN Poker - 局域网德州扑克

## 项目简介
基于 Electron 的局域网德州扑克游戏，一人启动即可在局域网内多人联机。

## 快速开始

### 安装依赖
```bash
# 根目录
npm install

# 服务端
cd server && npm install

# 客户端
cd client && npm install
```

### 开发模式
```bash
# 方式1：分别启动（推荐开发调试）
npm run dev:server   # 启动服务端 (端口 3000)
npm run dev:client   # 启动客户端开发服务器 (端口 5173，带HMR)

# 方式2：同时启动
npm run dev
```

开发模式下，浏览器访问 http://localhost:5173 即可调试。

### 生产模式（Electron 打包）
```bash
# 构建客户端 + 启动 Electron
npm run start

# 打包成安装程序
npm run dist
```

## 局域网联机
1. 一台电脑启动 Electron 应用（自动启动服务端）
2. 局域网内其他电脑浏览器访问 `http://<主机IP>:3000`
3. 也可通过 LAN 发现自动找到服务器

## 项目结构
```
mygame/
├── electron/         # Electron 主进程
├── server/src/       # 游戏服务端 (Express + Socket.IO)
│   ├── game/         # 游戏引擎核心逻辑
│   ├── rooms/        # 房间管理
│   └ network/        # 网络通信和 LAN 发现
├── client/src/       # React 客户端 UI
│   ├── components/   # UI 组件
│   ├── hooks/        # React Hooks
│   ├── store/        # Zustand 状态管理
│   └ styles/         # CSS 样式
├── shared/           # 前后端共享定义
```

## 游戏功能
- ✅ 标准 Texas Hold'em 规则
- ✅ 2-9 人牌桌
- ✅ 小盲/大盲自动轮转
- ✅ All-in 侧池计算
- ✅ 30秒行动计时器
- ✅ 局域网自动发现服务器
- ✅ 断线自动保留座位