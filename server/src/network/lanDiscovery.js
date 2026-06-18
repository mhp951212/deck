const dgram = require('dgram');
const { LAN_BROADCAST_PORT, LAN_BROADCAST_INTERVAL, SERVER_PORT } = require('../../../shared/constants');
const os = require('os');

class LanDiscovery {
  constructor(roomManagerGetter) {
    this.roomManagerGetter = roomManagerGetter; // 获取RoomManager的函数
    this.broadcastSocket = null;
    this.receiveSocket = null;
    this.localIp = this.getLocalIp();
    this.broadcasting = false;
    this.discoveredServers = [];
  }

  // 获取本机局域网IP
  getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // 跳过内部和非IPv4地址
        if (!iface.internal && iface.family === 'IPv4') {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  // 开始广播
  startBroadcast() {
    if (this.broadcasting) return;
    this.broadcasting = true;

    this.broadcastSocket = dgram.createSocket('udp4');
    this.broadcastSocket.bind(() => {
      this.broadcastSocket.setBroadcast(true);
    });

    // 定期广播服务器信息
    this.broadcastInterval = setInterval(() => {
      this.broadcast();
    }, LAN_BROADCAST_INTERVAL);

    console.log(`LAN discovery broadcasting started on port ${LAN_BROADCAST_PORT}`);
  }

  broadcast() {
    const roomManager = this.roomManagerGetter();
    const roomCount = roomManager ? roomManager.getRoomList().length : 0;

    const message = JSON.stringify({
      type: 'POKER_SERVER',
      ip: this.localIp,
      port: SERVER_PORT,
      rooms: roomCount,
      version: '1.0',
      timestamp: Date.now(),
    });

    const buffer = Buffer.from(message);

    // 向局域网广播
    this.broadcastSocket.send(buffer, 0, buffer.length, LAN_BROADCAST_PORT, '255.255.255.255', (err) => {
      if (err) console.error('Broadcast error:', err);
    });
  }

  // 开始监听LAN服务器广播（用于客户端发现）
  startListening() {
    if (this.receiveSocket) return;

    this.receiveSocket = dgram.createSocket('udp4');
    this.discoveredServers = [];

    this.receiveSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'POKER_SERVER') {
          // 更新已发现的服务器列表
          const existing = this.discoveredServers.findIndex(s => s.ip === data.ip && s.port === data.port);
          if (existing >= 0) {
            this.discoveredServers[existing] = data;
          } else {
            this.discoveredServers.push(data);
          }

          // 清除过期服务器（超过2倍广播间隔没有更新）
          const now = Date.now();
          this.discoveredServers = this.discoveredServers.filter(s =>
            now - s.timestamp < LAN_BROADCAST_INTERVAL * 3
          );
        }
      } catch (e) {
        // 忽略非JSON消息
      }
    });

    this.receiveSocket.bind(LAN_BROADCAST_PORT, () => {
      this.receiveSocket.addMembership('255.255.255.255');
    });
  }

  // 获取已发现的服务器列表
  getDiscoveredServers() {
    return this.discoveredServers;
  }

  // 停止广播
  stopBroadcast() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    if (this.broadcastSocket) {
      this.broadcastSocket.close();
      this.broadcastSocket = null;
    }
    this.broadcasting = false;
  }

  // 停止监听
  stopListening() {
    if (this.receiveSocket) {
      this.receiveSocket.close();
      this.receiveSocket = null;
    }
  }

  stop() {
    this.stopBroadcast();
    this.stopListening();
  }
}

module.exports = LanDiscovery;