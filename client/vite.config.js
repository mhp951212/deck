import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    host: true, // 允许LAN访问
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      // shared/*.js 使用 CommonJS (module.exports)，供 server/electron 的 require 使用。
      // 默认 Vite 只对 node_modules 做 CJS 转换，这里显式包含 shared 目录，
      // 让 `import EVENTS from '@shared/events'` 能拿到 module.exports 作为 default。
      include: [/shared/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
});