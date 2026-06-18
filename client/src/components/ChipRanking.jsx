import React from 'react';
import useGameStore from '../store/gameStore';

export default function ChipRanking() {
  const gameState = useGameStore(s => s.gameState);
  const playerId = useGameStore(s => s.playerId);

  if (!gameState) {
    return null;
  }

  const seatedPlayers = (gameState.players || [])
    .filter(p => p.seatIndex >= 0)
    .sort((a, b) => b.chips - a.chips);

  if (seatedPlayers.length === 0) {
    return null;
  }

  return (
    <div className="chip-ranking">
      <div className="chip-ranking-title">💰 筹码排名</div>
      <div className="chip-ranking-list">
        {seatedPlayers.map((player, index) => {
          const isMe = player.id === playerId;
          const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

          return (
            <div
              key={player.id}
              className={`chip-ranking-item ${isMe ? 'me' : ''}`}
            >
              <div className="rank-number">
                {rankIcon || `#${index + 1}`}
              </div>
              <div className="player-name">
                {isMe ? '你' : player.name}
                {player.isCreator && ' 👑'}
              </div>
              <div className="player-chips">
                💰{player.chips}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
