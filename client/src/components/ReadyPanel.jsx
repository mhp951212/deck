import React from 'react';
import useGameStore from '../store/gameStore';
import useSocket from '../hooks/useSocket';
import EVENTS from '@shared/events';
const { CLIENT } = EVENTS;
import '../styles/readyPanel.css';

export default function ReadyPanel() {
  const gameState = useGameStore(s => s.gameState);
  const readyPlayers = useGameStore(s => s.settlementReadyPlayers);
  const socket = useSocket();

  if (!gameState || gameState.stage !== 'showdown' || readyPlayers.length === 0) {
    return null;
  }

  const handleReady = () => {
    if (socket) socket.emit(CLIENT.SETTLEMENT_READY);
  };

  const playerId = useGameStore.getState().playerId;
  const isReady = readyPlayers.find(p => p.id === playerId)?.ready || false;

  return (
    <div className="ready-panel">
      <div className="ready-panel-header">◈ 准备状态</div>
      <div className="ready-panel-list">
        {readyPlayers.map((player) => (
          <div key={player.id} className="ready-player-item">
            <span className="ready-player-name">{player.name}:</span>
            <span className={`ready-player-status ${player.ready ? 'ready' : 'not-ready'}`}>
              {player.ready ? '已准备' : '等待中'}
            </span>
          </div>
        ))}
      </div>
      {!isReady && (
        <button className="ready-panel-btn" onClick={handleReady}>
          开始下一局
        </button>
      )}
    </div>
  );
}
