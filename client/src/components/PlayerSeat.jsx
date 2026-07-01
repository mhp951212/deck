import React, { useState } from 'react';
import Card from './Card';

const ACTION_LABELS = {
  fold: '弃牌',
  check: '过牌',
  call: '跟注',
  raise: '加注',
  allin: '全下',
};

export default function PlayerSeat({ player, isMySeat, isActive }) {
  if (!player) return <div className="player-seat empty-seat">空位</div>;
  if (!player.name) return <div className="player-seat empty-seat">空位</div>;

  const chipColor = player.chips > 500 ? 'var(--neon-green)' :
                    player.chips > 100 ? 'var(--neon-yellow)' : 'var(--neon-red)';

  const [revealedCards, setRevealedCards] = useState([false, false]);

  const toggleCard = (cardIndex) => {
    setRevealedCards(prev => {
      const next = [...prev];
      next[cardIndex] = !next[cardIndex];
      return next;
    });
  };

  const otherHoleCards = player.showCards ? player.holeCards : null;

  return (
    <div className={`player-seat ${isActive ? 'active' : ''} ${player.folded ? 'folded' : ''} ${isMySeat ? 'my-seat' : ''}`}>
      <div className="player-info">
        <div className="player-avatar">
          {player.isCreator && <span className="host-crown">★</span>}
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="player-details">
          <span className="player-name">{player.name}</span>
          <span className="player-chips" style={{ color: chipColor }}>
            ⚡ {player.chips}
          </span>
        </div>
      </div>

      <div className="player-badges">
        {player.isDealer && <span className="badge dealer">庄</span>}
        {player.isSB && <span className="badge sb">小盲</span>}
        {player.isBB && <span className="badge bb">大盲</span>}
        {player.allIn && <span className="badge allin">全下</span>}
        {!player.connected && <span className="badge disconnected">断线</span>}
      </div>

      {player.currentBet > 0 && (
        <div className="player-bet">
          <span className="bet-amount">{player.currentBet}</span>
        </div>
      )}

      {!isMySeat && otherHoleCards && (
        <div className="player-cards-showdown">
          {otherHoleCards.map((card, i) => (
            <Card key={i} card={card} />
          ))}
        </div>
      )}

      {player.lastAction && (
        <div className="player-action-label">
          {ACTION_LABELS[player.lastAction] || player.lastAction}
        </div>
      )}
    </div>
  );
}
