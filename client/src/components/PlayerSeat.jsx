import React, { useState } from 'react';
import Card from './Card';

export default function PlayerSeat({ player, isMySeat, isActive }) {
  if (!player) return <div className="player-seat empty-seat">空位</div>;
  if (!player.name) return <div className="player-seat empty-seat">空位</div>;

  const chipColor = player.chips > 500 ? '#2ecc71' :
                    player.chips > 100 ? '#f39c12' : '#e74c3c';

  // 防窥屏：每张牌独立控制翻开状态，默认全部隐藏
  const [revealedCards, setRevealedCards] = useState([false, false]);

  const toggleCard = (cardIndex) => {
    setRevealedCards(prev => {
      const next = [...prev];
      next[cardIndex] = !next[cardIndex];
      return next;
    });
  };

  // 获取其他玩家的手牌（摊牌时服务端才会下发 holeCards）
  const otherHoleCards = player.showCards ? player.holeCards : null;

  return (
    <div className={`player-seat ${isActive ? 'active' : ''} ${player.folded ? 'folded' : ''} ${isMySeat ? 'my-seat' : ''}`}>
      {/* 玩家信息 */}
      <div className="player-info">
        <div className="player-avatar">
          {player.isCreator && <span className="host-crown">👑</span>}
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="player-details">
          <span className="player-name">
            {player.name}
          </span>
          <span className="player-chips" style={{ color: chipColor }}>
            💰 {player.chips}
          </span>
        </div>
      </div>

      {/* 徽章行 */}
      <div className="player-badges">
        {player.isDealer && <span className="badge dealer">庄家</span>}
        {player.isSB && <span className="badge sb">小盲</span>}
        {player.isBB && <span className="badge bb">大盲</span>}
        {player.allIn && <span className="badge allin">全下</span>}
        {!player.connected && <span className="badge disconnected">⚡</span>}
      </div>

      {/* 当前下注 */}
      {player.currentBet > 0 && (
        <div className="player-bet">
          <span className="bet-amount">{player.currentBet}</span>
        </div>
      )}

      {/* 其他玩家手牌（摊牌时显示） */}
      {!isMySeat && otherHoleCards && (
        <div className="player-cards-showdown">
          {otherHoleCards.map((card, i) => (
            <Card key={i} card={card} />
          ))}
        </div>
      )}

      {/* 最近行动 */}
      {player.lastAction && (
        <div className="player-action-label">
          {getActionLabel(player.lastAction)}
        </div>
      )}
    </div>
  );
}

function getActionLabel(action) {
  const labels = {
    fold: '弃牌',
    check: '过牌',
    call: '跟注',
    raise: '加注',
    allin: '全下',
  };
  return labels[action] || action;
}
