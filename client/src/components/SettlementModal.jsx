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

  // 只有 showdown 且有赢家时才显示
  if (!gameState || gameState.stage !== 'showdown' || !gameState.winners || gameState.winners.length === 0) {
    return null;
  }

  const players        = gameState.players || [];
  const communityCards = gameState.communityCards || [];
  const bigBlind       = gameState.bigBlind || 20;
  const me             = players.find(p => p.id === playerId);
  // 结算后筹码（engine 已经在 showdown 里把赢得的筹码加进去了）
  const myChips        = me ? me.chips : 0;
  const needBuyChips   = myChips < bigBlind;
  const joinedDuringHand = me?.joinedDuringHand || false;

  // ===== 边池信息 =====
  const sidePots = gameState.sidePots || [];
  // 是否有边池（多于一个池才有边池展示意义）
  const hasSidePots = sidePots.length > 1;

  // ===== 排序玩家结果 =====
  const winnerIds = new Set(gameState.winners.map(w => w.playerId));

  const playerResults = players
    .filter(p => p.seatIndex >= 0) // 只显示坐下的玩家
    .map(player => {
      const isWinner = winnerIds.has(player.id);
      const winInfo  = gameState.winners.find(w => w.playerId === player.id);
      // 赢得的总金额（可能赢多个池）
      const wonTotal = gameState.winners
        .filter(w => w.playerId === player.id)
        .reduce((sum, w) => sum + w.amount, 0);
      const profit = isWinner ? wonTotal - player.totalBet : -player.totalBet;

      // 该玩家在每个池中赢得的明细
      const potWins = gameState.winners
        .filter(w => w.playerId === player.id)
        .map(w => ({
          potIndex: w.potIndex,
          amount: w.amount,
          isMain: w.potIndex === 0,
          potLabel: w.potIndex === 0 ? '主池' : `边池${w.potIndex}`,
        }));

      // 检查是否是平局均分（同一个池有多个赢家）
      const isTieWinner = gameState.winners
        .filter(w => w.potIndex !== undefined)
        .some(w => {
          // 同池中是否有其他人也赢了
          const samePotWinners = gameState.winners.filter(ww => ww.potIndex === w.potIndex);
          return samePotWinners.length > 1 && w.playerId === player.id;
        });

      return {
        player,
        isWinner,
        profit,
        handResult: winInfo?.handResult || null,
        wonAmount: wonTotal,
        potWins,
        isTieWinner,
      };
    })
    .sort((a, b) => {
      const aIsMe = a.player.id === playerId;
      const bIsMe = b.player.id === playerId;
      // 自己永远排最前面
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      // 赢家在前，输家在后
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      // 同类按利润排序
      return b.profit - a.profit;
    });

  const totalPot   = gameState.pot || 0;
  const handNumber = gameState.handNumber || 1;

  // ===== 点击"开始下一局" =====
  const handleReady = () => {
    if (socket && !myReady) {
      socket.emit(CLIENT.SETTLEMENT_READY);
      useGameStore.getState().setSettlementMyReady(true);
    }
  };

  // ===== 点击"购买筹码" =====
  const handleBuyChips = () => {
    if (socket) {
      socket.emit(CLIENT.BUY_CHIPS_SETTLEMENT);
    }
  };

  // ===== 底部按钮 =====
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
        {/* 顶部：局数和总底池 */}
        <div className="settlement-header">
          <div className="settlement-title">
            第 {handNumber} 局结算
          </div>
          <div className="settlement-pot">
            <span className="pot-label">总底池</span>
            <span className="pot-value">💰 {totalPot}</span>
          </div>
        </div>

        {/* 边池摘要条 */}
        {sidePots.length > 0 && (
          <div className="side-pots-bar">
            {sidePots.map((pot, idx) => (
              <div key={idx} className={`side-pot-chip${idx === 0 ? ' main' : ' side'}`}>
                <span className="sp-dot"></span>
                {idx === 0 ? '主池' : `边池${idx}`} 💰{pot.amount}
              </div>
            ))}
          </div>
        )}

        {/* 公共牌 */}
        <div className="settlement-community">
          <div className="community-cards">
            {communityCards.length > 0 ? (
              communityCards.map((card, idx) => (
                <Card key={idx} card={card} size="small" />
              ))
            ) : (
              <span className="no-community">无公共牌</span>
            )}
          </div>
        </div>

        {/* 玩家结果列表 */}
        <div className="settlement-players">
          {playerResults.map((result, idx) => {
            const { player, isWinner, profit, handResult, potWins, isTieWinner } = result;
            const isMe      = player.id === playerId;
            const name      = isMe ? '你' : player.name;
            const folded    = player.folded;
            const showCards = player.showCards && player.holeCards && !folded;

            return (
              <div
                key={player.id}
                className={`settlement-player-row${isWinner ? ' winner' : ''}${isMe ? ' me' : ''}`}
              >
                {/* 排名 */}
                <div className="player-rank">
                  {isWinner ? '🏆' : `#${idx + 1}`}
                </div>

                {/* 玩家信息 */}
                <div className="player-info">
                  <div className="player-name-row">
                    <span className="player-name">{name}</span>
                    {isMe && <span className="me-tag">我</span>}
                    {isWinner && isTieWinner && <span className="winner-tag">平局</span>}
                    {isWinner && !isTieWinner && <span className="winner-tag">赢家</span>}
                  </div>

                  {/* 手牌和牌型（摊牌时显示） */}
                  {showCards ? (
                    <div className="player-hand-info">
                      <div className="hole-cards">
                        {player.holeCards.map((card, cardIdx) => (
                          <Card key={cardIdx} card={card} size="small" />
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

                  {/* 边池赢得明细 */}
                  {potWins && potWins.length > 0 && hasSidePots && (
                    <div className="pot-wins-detail">
                      {potWins.map((pw, pwIdx) => (
                        <div key={pwIdx} className="pot-win-line">
                          <span className={`pot-win-dot${pw.isMain ? ' main' : ' side'}`}></span>
                          <span className="pot-win-label">
                            {pw.potLabel}
                            {/* 平局均分提示：同池多人赢 */}
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

                {/* 输赢金额 */}
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

        {/* 底部：按钮 + 准备计数 */}
        <div className="settlement-footer">
          {/* 显示自己的筹码数 */}
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
