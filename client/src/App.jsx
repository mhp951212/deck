import React, { useEffect } from 'react';
import Lobby from './components/Lobby';
import Table from './components/Table';
import useGameStore from './store/gameStore';
import useSocket from './hooks/useSocket';

export default function App() {
  const { connected, inRoom, gameState } = useGameStore();
  const socket = useSocket();

  // 自动连接服务器
  useEffect(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  // 处理 Electron preload 提供的本地IP
  useEffect(() => {
    if (window.pokerAPI) {
      useGameStore.getState().setLocalInfo(
        window.pokerAPI.getLocalIp(),
        window.pokerAPI.getServerPort()
      );
    }
  }, []);

  if (!connected) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>正在连接服务器...</p>
        <p className="loading-hint">请确保服务器已启动</p>
      </div>
    );
  }

  if (!inRoom) {
    return <Lobby />;
  }

  if (gameState && gameState.stage !== 'waiting') {
    return <Table />;
  }

  // 在房间中但游戏未开始
  return <Table />;
}