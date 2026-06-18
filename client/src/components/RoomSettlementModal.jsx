import React from 'react';
import useGameStore from '../store/gameStore';
import '../styles/room-settlement.css';

function RoomSettlementModal() {
  const { roomSettlement, roomSettlementCountdown, playerId } = useGameStore();

  if (!roomSettlement) return null;

  const { players } = roomSettlement;
  const isMe = (id) => id === playerId;

  return (
    <div className="room-settlement-overlay">
      <div className="room-settlement-modal">
        <div className="room-settlement-header">
          <h2>🏆 房间结算</h2>
          <div className="room-settlement-countdown">
            倒计时: {roomSettlementCountdown}s 后解散房间
          </div>
        </div>

        <div className="room-settlement-content">
          <table className="room-settlement-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>玩家</th>
                <th>总筹码</th>
                <th>盈亏</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => {
                const rank = index + 1;
                const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                const profitClass = player.profit > 0 ? 'profit-positive' : player.profit < 0 ? 'profit-negative' : 'profit-zero';
                const profitText = player.profit > 0 ? `+${player.profit}` : player.profit;

                return (
                  <tr key={player.id} className={isMe(player.id) ? 'me' : ''}>
                    <td className="rank-cell">{rankIcon}</td>
                    <td className="name-cell">
                      {player.name}
                      {isMe(player.id) && <span className="me-badge">我</span>}
                    </td>
                    <td className="chips-cell">
                      💰{player.currentChips}
                      <span className="investment-detail">(总投入{player.totalInvestment})</span>
                    </td>
                    <td className={`profit-cell ${profitClass}`}>
                      {profitText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="room-settlement-footer">
          <p>等待房间解散...</p>
        </div>
      </div>
    </div>
  );
}

export default RoomSettlementModal;
