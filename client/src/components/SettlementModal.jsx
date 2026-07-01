import React from 'react';
import Card from './Card';
import useGameStore from '../store/gameStore';
import useSocket from '../hooks/useSocket';
import EVENTS from '@shared/events';
const { CLIENT } = EVENTS;
import '../styles/settlement.css';

export default function SettlementModal() {
  const gameState   = useGameStore(s => s.gameState);
  const playerId    = useGameStore(s => s.playerId);
  const readyCount  = useGameStore(s => s.settlementReadyCount);
  const totalPlayers = useGameStore(s => s.settlementTotalPlayers);
  const myReady     = useGameStore(s => s.settlementMyReady);
  const socket      = useSocket();

  if (!gameState || gameState.stage !== 'showdown' || !gameState.winners || gameState.winners.length === 0) {
    return null;
  }

  const players        = gameState.players || [];
  const communityCards = gameState.communityCards || [];
  const bigBlind       = gameState.bigBlind || 20;
  const me             = players.find(p => p.id === playerId);
  const myChips        = me ? me.chips : 0;
  const needBuyChips   = myChips < bigBlind;

  const sidePots = gameState.sidePots || [];
  const hasSidePots = sidePots.length > 1;
  const winnerIds = new Set(gameState.winners.map(w => w.playerId));

  const playerResults = players
    .filter(p => p.seatIndex >= 0)
    .map(player => {
      const isWinner = winnerIds.has(player.id);
      const wonTotal = gameState.winners
        .filter(w => w.playerId === player.id)
        .reduce((sum, w) => sum + w.amount, 0);
      const profit = isWinner ? wonTotal - player.totalBet : -player.totalBet;

      const potWins = gameState.winners
        .filter(w => w.playerId === player.id)
        .map(w => ({
          potIndex: w.potIndex,
          amount: w.amount,
          isMain: w.potIndex === 0,
          potLabel: w.potIndex === 0 ? '主池' : `边池${w.potIndex}`,
        }));

      const isTieWinner = gameState.winners
        .filter(w => w.potIndex !== undefined)
        .some(w => {
          const samePotWinners = gameState.winners.filter(ww => ww.potIndex === w.potIndex);
          return samePotWinners.length > 1 && w.playerId === player.id;
        });

      return {
        player,
        isWinner,
        profit,
        handResult: gameState.winners.find(w => w.playerId === player.id)?.handResult || null,
        wonAmount: wonTotal,
        potWins,
        isTieWinner,
      };
    })
    .sort((a, b) => {
      if (a.player.id === playerId) return -1;
      if (b.player.id === playerId) return 1;
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      return b.profit - a.profit;
    });

  const totalPot   = gameState.pot || 0;
  const handNumber = gameState.handNumber || 1;

  const handleReady = () => {
    if (socket && !myReady) {
      socket.emit(CLIENT.SETTLEMENT_READY);
      useGameStore.getState().setSettlementMyReady(true);
    }
  };

  const handleBuyChips = () => {
    if (socket) socket.emit(CLIENT.BUY_CHIPS_SETTLEMENT);
  };

  const renderFooterButton = () => {
    if (needBuyChips) {
      return (
        <button className="settlement-buy-btn" onClick={handleBuyChips}>
          购买筹码（补充至初始值）
        </button>
      );
    }
    if (myReady) {
      return (
        <button className="settlement-ready-btn ready" disabled>
          ✓ 已准备
        </button>
      );
    }
    return (
      <button className="settlement-ready-btn" onClick={handleReady}>
        开始下一局
      </button>
    );
  };

  return (
    <div className="settlement-overlay">
      <div className="settlement-modal">
        <div className="settlement-header">
          <div className="settlement-title">
            第 {handNumber} 局结算
          </div>
          <div className="settlement-pot">
            <span className="pot-label">总底池</span>
            <span className="pot-value">⚡ {totalPot}</span>
          </div>
        </div>

        {sidePots.length > 0 && (
          <div className="side-pots-bar">
            {sidePots.map((pot, idx) => (
              <div key={idx} className={`side-pot-chip${idx === 0 ? ' main' : ' side'}`}>
                <span className="sp-dot"></span>
                {idx === 0 ? '主池' : `边池${idx}`} ⚡{pot.amount}
              </div>
            ))}
          </div>
        )}

        <div className="settlement-community">
          <div className="community-cards">
            {communityCards.length > 0 ? (
              communityCards.map((card, idx) => (
                <Card key={idx} card={card} small />
              ))
            ) : (
              <span className="no-community">无公共牌</span>
            )}
          </div>
        </div>

        <div className="settlement-players">
          {playerResults.map((result, idx) => {
            const { player, isWinner, profit, handResult, potWins, isTieWinner } = result;
            const isMe = player.id === playerId;
            const name = isMe ? '你' : player.name;
            const folded = player.folded;
            const showCards = player.showCards && player.holeCards && !folded;

            return (
              <div
                key={player.id}
                className={`settlement-player-row${isWinner ? ' winner' : ''}${isMe ? ' me' : ''}`}
              >
                <div className="player-rank">
                  {isWinner ? '🏆' : `#${idx + 1}`}
                </div>

                <div className="player-info">
                  <div className="player-name-row">
                    <span className="player-name">{name}</span>
                    {isMe && <span className="me-tag">我</span>}
                    {isWinner && isTieWinner && <span className="winner-tag">平局</span>}
                    {isWinner && !isTieWinner && <span className="winner-tag">赢家</span>}
                  </div>

                  {showCards ? (
                    <div className="player-hand-info">
                      <div className="hole-cards">
                        {player.holeCards.map((card, cardIdx) => (
                          <Card key={cardIdx} card={card} small />
                        ))}
                      </div>
                      {handResult && (
                        <span className="hand-rank-name">{handResult.name}</span>
                      )}
                    </div>
                  ) : folded ? (
                    <span className="player-folded-label">已弃牌</span>
                  ) : (
                    <span className="player-folded-label">未摊牌</span>
                  )}

                  {potWins && potWins.length > 0 && hasSidePots && (
                    <div className="pot-wins-detail">
                      {potWins.map((pw, pwIdx) => (
                        <div key={pwIdx} className="pot-win-line">
                          <span className={`pot-win-dot${pw.isMain ? ' main' : ' side'}`}></span>
                          <span className="pot-win-label">
                            {pw.potLabel}
                            {(() => {
                              const samePotWinners = gameState.winners.filter(w => w.potIndex === pw.potIndex);
                              if (samePotWinners.length > 1) return '（平局均分）';
                              return '';
                            })()}
                          </span>
                          <span className="pot-win-amount">+{pw.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="player-profit">
                  {profit > 0 ? (
                    <span className="profit-positive">+{profit}</span>
                  ) : profit < 0 ? (
                    <span className="profit-negative">{profit}</span>
                  ) : (
                    <span className="profit-zero">0</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="settlement-footer">
          <div className="my-chips-display">
            我的筹码：<span className="my-chips-value">{myChips}</span>
          </div>
          <div className="settlement-footer-btn">
            {renderFooterButton()}
          </div>
          <div className="settlement-ready-count">
            已准备玩家 {readyCount}/{totalPlayers}
          </div>
        </div>
      </div>
    </div>
  );
}
