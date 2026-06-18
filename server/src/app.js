const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { SERVER_PORT } = require('../../shared/constants');
const SocketHandler = require('./network/socketHandler');
const LanDiscovery = require('./network/lanDiscovery');

// 用于导出给 Electron 调用
let httpServer = null;
let ioInstance = null;
let socketHandler = null;
let lanDiscovery = null;

function startServer() {
  const app = express();
  httpServer = http.createServer(app);

  // Socket.IO 配置 - 允许局域网访问
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // 静态文件 - 生产环境服务客户端
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // API: 获取房间列表（供浏览器客户端查询）
  app.get('/api/rooms', (req, res) => {
    if (socketHandler) {
      res.json(socketHandler.roomManager.getRoomList());
    } else {
      res.json([]);
    }
  });

  // API: 获取服务器信息
  app.get('/api/info', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          localIp = iface.address;
        }
      }
    }

    res.json({
      ip: localIp,
      port: SERVER_PORT,
      version: '1.0',
      rooms: socketHandler ? socketHandler.roomManager.getRoomList().length : 0,
    });
  });

  // ===== 昵称持久化 =====
  const NICKNAME_FILE = path.join(__dirname, '../nicknames.json');
  const fs = require('fs');

  const readNicknames = () => {
    try {
      if (fs.existsSync(NICKNAME_FILE)) {
        return JSON.parse(fs.readFileSync(NICKNAME_FILE, 'utf-8'));
      }
    } catch (e) { /* ignore */ }
    return {};
  };

  const writeNicknames = (data) => {
    fs.writeFileSync(NICKNAME_FILE, JSON.stringify(data, null, 2), 'utf-8');
  };

  // 获取客户端真实 IP 的辅助函数
  const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.connection?.remoteAddress ||
           req.ip ||
           'unknown';
  };

  // 读取昵称
  app.get('/api/nickname', (req, res) => {
    const ip = getClientIP(req);
    if (!ip || ip === 'unknown') return res.json({ nickname: null });
    const nicknames = readNicknames();
    res.json({ nickname: nicknames[ip] || null });
    console.log(`[API] GET /api/nickname - IP: ${ip}, nickname: ${nicknames[ip] || null}`);
  });

  // 保存昵称
  app.post('/api/nickname', express.json(), (req, res) => {
    const ip = getClientIP(req);
    const nickname = req.body.nickname;
    if (!ip || ip === 'unknown' || !nickname) return res.status(400).json({ error: 'missing ip or nickname' });
    const nicknames = readNicknames();
    nicknames[ip] = nickname;
    writeNicknames(nicknames);
    console.log(`[API] POST /api/nickname - IP: ${ip}, nickname: ${nickname}`);
    res.json({ success: true });
  });

  // 所有其他路由返回客户端（SPA支持）
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  // 初始化 Socket.IO 处理器
  socketHandler = new SocketHandler(ioInstance);

  // 初始化 LAN 发现
  lanDiscovery = new LanDiscovery(() => socketHandler.roomManager);
  lanDiscovery.startBroadcast();

  // 启动服务器
  httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          localIp = iface.address;
        }
      }
    }

    console.log('='.repeat(50));
    console.log('  LAN Poker Server Started!');
    console.log('='.repeat(50));
    console.log(`  Local:   http://localhost:${SERVER_PORT}`);
    console.log(`  LAN:     http://${localIp}:${SERVER_PORT}`);
    console.log(`  Port:    ${SERVER_PORT}`);
    console.log(`  LAN Discovery: Broadcasting on port 3001`);
    console.log('='.repeat(50));
  });

  return { httpServer, ioInstance, socketHandler, lanDiscovery };
}

function stopServer() {
  if (lanDiscovery) lanDiscovery.stop();
  if (ioInstance) ioInstance.close();
  if (httpServer) httpServer.close();
  console.log('LAN Poker Server stopped.');
}

// 直接运行时自动启动
if (require.main === module) {
  startServer();
}

module.exports = { startServer, stopServer };