import React from 'react';
import useGameStore from '../store/gameStore';
import useSocket from '../hooks/useSocket';
import EVENTS from '@shared/events';
import Card from './Card';
import '../styles/settlement.css';

/**
 * 方案B：电竞竞技场风格
 * - 深蓝紫渐变背景，霓虹边框
 * - 玩家按排名分条显示，冠军金色高亮
 * - 公共牌区域带发光效果
 */
export default function SettlementModalB() {
  const { gameState, playerId } = useGameStore();
  const socket = useSocket();

  if (!gameState || gameState.stage !== 'showdown' || !gameState.winners) {
    return null;
  }

  const isCreator = gameState.creatorId === playerId;
  const communityCards = gameState.communityCards || [];
  const pot = gameState.pot || 0;
  const handNumber = gameState.handNumber || 0;

  // 构建玩家结果列表
  const players = gameState.players || [];
  const results = players
    .filter(p => !p.folded || p.id === (gameState.winners[0]?.playerId))
    .map(player => {
      const win = gameState.winners.find(w => w.playerId === player.id);
      const profit = win ? win.amount - player.totalBet : -player.totalBet;
      const isWinner = !!win;

      return {
        player,
        isWinner,
        wonAmount: win?.amount || 0,
        profit,
        handResult: win?.handResult,
        cards: player.holeCards,
        folded: player.folded,
      };
    })
    .sort((a, b) => {
      if (a.isWinner && !b.isWinner) return -1;
      if (!a.isWinner && b.isWinner) return 1;
      return b.wonAmount - a.wonAmount;
    });

  const handleNextHand = () => {
    if (socket) {
      socket.emit(EVENTS.CLIENT.START_NEXT_HAND);
    }
  };

  const stageLabels = {
    showdown: '摊牌',
    river: '河牌',
  };

  return (
    <div className="settlement-overlay settlement-overlay-b">
      <div className="settlement-modal settlement-modal-b">
        {/* 顶部标题区 */}
        <div className="settlement-header-b">
          <div className="settlement-round-b">第 {handNumber} 局 · {stageLabels[gameState.stage] || '结算'}</div>
          <div className="settlement-pot-b">
            <span className="pot-label-b">总底池</span>
            <span className="pot-value-b">💰 {pot}</span>
          </div>
        </div>

        {/* 公共牌区域 */}
        <div className="settlement-community-b">
          <div className="community-cards-b">
            {communityCards.map((card, idx) => (
              <div key={idx} className="community-card-b">
                <Card card={card} size="small" />
              </div>
            ))}
          </div>
        </div>

        {/* 玩家结果列表 */}
        <div className="settlement-players-b">
          {results.map((result, idx) => {
            const { player, isWinner, wonAmount, profit, handResult, cards, folded } = result;
            const isMe = player.id === playerId;

            return (
              <div
                key={player.id}
                className={`settlement-player-b ${isWinner ? 'winner-b' : ''} ${isMe ? 'me-b' : ''} ${folded ? 'folded-b' : ''}`}
              >
                <div className="player-rank-b">
                  {isWinner ? '🏆' : `#${idx + 1}`}
                </div>

                <div className="player-info-b">
                  <div className="player-name-b">
                    {isMe ? '你' : player.name}
                    {isMe && <span className="me-badge-b">我</span>}
                  </div>

                  {!folded && cards && cards.length > 0 && (
                    <div className="player-cards-b">
                      {cards.map((card, cidx) => (
                        <Card key={cidx} card={card} size="small" />
                      ))}
                      {handResult && (
                        <span className="hand-name-b">{handResult.name}</span>
                      )}
                    </div>
                  )}

                  {folded && (
                    <div className="player-folded-b">已弃牌</div>
                  )}
                </div>

                <div className="player-profit-b">
                  {isWinner ? (
                    <>
                      <div className="won-amount-b">+{wonAmount}</div>
                      <div className="profit-label-b">赢得</div>
                    </>
                  ) : (
                    <>
                      <div className="lost-amount-b">{profit}</div>
                      <div className="profit-label-b">亏损</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部按钮 */}
        <div className="settlement-footer-b">
          {isCreator ? (
            <button className="next-hand-btn-b" onClick={handleNextHand}>
              开始下一局
            </button>
          ) : (
            <div className="waiting-host-b">等待房主开始下一局...</div>
          )}
        </div>
      </div>
    </div>
  );
}
