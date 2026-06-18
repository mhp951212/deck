import React from 'react';
import CONSTANTS from '@shared/constants';
import '../styles/cards.css';
const { RANK_NAMES, SUIT_SYMBOLS, SUIT_COLORS } = CONSTANTS;

export default function Card({ card, hidden = false, small = false }) {
  if (!card) return null;

  // 隐藏牌（背面）
  if (hidden) {
    return (
      <div className={`card card-hidden ${small ? 'card-small' : ''}`}>
        <div className="card-back">
          <div className="card-back-pattern">🂠</div>
        </div>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];
  const rankName = RANK_NAMES[card.rank];

  return (
    <div className={`card ${small ? 'card-small' : ''}`}>
      <div className="card-face" style={{ color: suitColor }}>
        <div className="card-corner top-left">
          <span className="card-rank">{rankName}</span>
          <span className="card-suit">{suitSymbol}</span>
        </div>
        <div className="card-center">
          <span className="card-suit-large">{suitSymbol}</span>
        </div>
        <div className="card-corner bottom-right">
          <span className="card-rank">{rankName}</span>
          <span className="card-suit">{suitSymbol}</span>
        </div>
      </div>
    </div>
  );
}