const { contextBridge } = require('electron');
const os = require('os');
const { SERVER_PORT } = require('../shared/constants');

// 获取本机局域网IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// 安全地暴露给渲染进程
contextBridge.exposeInMainWorld('pokerAPI', {
  getLocalIp: getLocalIp,
  getServerPort: () => SERVER_PORT,
  platform: process.platform,
});