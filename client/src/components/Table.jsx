import React, { useState, useEffect, useRef } from 'react';
import PlayerSeat from './PlayerSeat';
import Card from './Card';
import ActionBar from './ActionBar';
import SettlementModal from './SettlementModal';
import RoomSettlementModal from './RoomSettlementModal';
import ChipRanking from './ChipRanking';
import Dealer from './Dealer';
import ReadyPanel from './ReadyPanel';
import useGameStore from '../store/gameStore';
import useGameState from '../hooks/useGameState';
import useSocket from '../hooks/useSocket';
import EVENTS from '@shared/events';
const { CLIENT } = EVENTS;
import '../styles/table.css';

export default function Table() {
  const {
    gameState, myCards, playerId, roomName, actionLog,
    playerName, localIp, toast, chatMessages,
    isCreator, buyChipsPrompt, chipsBuyRecord,
  } = useGameStore();
  const socket = useSocket();
  const { isMyTurn } = useGameState();
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [settlementConfirm, setSettlementConfirm] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [myCardsRevealed, setMyCardsRevealed] = useState([false, false]);
  const [flirtCooldown, setFlirtCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState('field');
  const prevHandNumberRef = useRef(null);
  const flirtTimerRef = useRef(null);

  const FLIRT_COOLDOWN = 5;

  useEffect(() => {
    return () => {
      if (flirtTimerRef.current) clearInterval(flirtTimerRef.current);
    };
  }, []);

  const toggleMyCard = (index) => {
    setMyCardsRevealed(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  useEffect(() => {
    const handNumber = gameState?.handNumber;
    if (handNumber && handNumber !== prevHandNumberRef.current) {
      prevHandNumberRef.current = handNumber;
      setMyCardsRevealed([false, false]);
    }
  }, [gameState?.handNumber]);

  const handleSitDown = (seatIndex) => {
    const players = gameState?.players || [];
    const showToast = useGameStore.getState().setToast;

    const seatOccupied = players.find(p => p.seatIndex === seatIndex);
    if (seatOccupied) {
      showToast('座位已被占用');
      return;
    }

    const nameExists = players.find(p => p.name === playerName);
    if (nameExists) {
      showToast('昵称已存在');
      return;
    }

    const ipExists = players.find(p => p.ip === localIp);
    if (ipExists) {
      showToast('该IP已在游戏中');
      return;
    }

    if (socket) {
      socket.emit(CLIENT.SIT_DOWN, { seatIndex });
    }
  };

  const handleFlirt = () => {
    if (flirtCooldown > 0) return;
    if (socket) {
      socket.emit(CLIENT.FLIRT);
    }
    setFlirtCooldown(FLIRT_COOLDOWN);
    flirtTimerRef.current = setInterval(() => {
      setFlirtCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(flirtTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 等待中
  if (!gameState || gameState.stage === 'waiting') {
    const players = gameState?.players || [];
    const seatedCount = players.filter(p => p.seatIndex >= 0).length;
    return (
      <div className="table-container">
        <div className="table-waiting">
          <h2>◈ 房间: {roomName}</h2>
          {isCreator && <span className="host-badge-header">★ 房主</span>}
          <p>等待玩家加入...</p>

          {chipsBuyRecord.length > 0 && (
            <div className="chips-buy-record">
              <div className="chips-buy-record-title">⚡ 购买筹码记录</div>
              {chipsBuyRecord.map((r, i) => (
                <div key={i} className="chips-buy-record-item">
                  {r.name}
                  {r.count > 1
                    ? <span className="chips-buy-count"> ×{r.count}</span>
                    : <span className="chips-buy-amount"> +{r.amount}</span>
                  }
                </div>
              ))}
            </div>
          )}

          <div className="seat-grid waiting-grid">
            {[0,1,2,3,4,5,6,7,8].map(i => {
              const player = players.find(p => p.seatIndex === i);
              return (
                <div key={i} className="waiting-seat" onClick={() => {
                  if (!player && socket) handleSitDown(i);
                }}>
                  {player ? (
                    <div className="waiting-player">
                      {player.isCreator && <span className="host-icon" title="房主">★</span>}
                      <span>{player.name}</span>
                      <span>⚡{player.chips}</span>
                    </div>
                  ) : (
                    <div className="empty-seat-label">空位</div>
                  )}
                </div>
              );
            })}
          </div>

          {isCreator && seatedCount >= 2 && (
            <button className="start-btn" onClick={() => {
              if (socket) socket.emit(CLIENT.START_GAME);
            }}>
              开始游戏
            </button>
          )}
          {!isCreator && seatedCount >= 2 && (
            <p className="waiting-for-host">等待房主开始...</p>
          )}
          {seatedCount < 2 && (
            <p className="waiting-for-players">需要至少2名玩家</p>
          )}
          {isCreator && seatedCount > 0 && (
            <div className="waiting-actions">
              <button className="leave-btn leave-btn-waiting" onClick={() => setLeaveConfirm(true)}>退出房间</button>
            </div>
          )}
          {!isCreator && (
            <button className="leave-btn leave-btn-waiting" onClick={() => setLeaveConfirm(true)}>退出房间</button>
          )}
        </div>
        {toast && <div className="toast-message">{toast}</div>}
        {leaveConfirm && (
          <div className="leave-confirm-overlay">
            <div className="leave-confirm-box">
              <p className="leave-confirm-text">确认退出房间？</p>
              <div className="leave-confirm-btns">
                <button className="leave-confirm-stay" onClick={() => setLeaveConfirm(false)}>继续</button>
                <button className="leave-confirm-go" onClick={() => {
                  setLeaveConfirm(false);
                  if (socket) socket.emit(CLIENT.LEAVE_ROOM);
                }}>退出</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 游戏进行中
  const players = gameState.players || [];
  const communityCards = gameState.communityCards || [];
  const activeIdx = gameState.activePlayerIndex;
  const maxPlayers = 9;

  const me = players.find(p => p.id === playerId);
  const mySeatIndex = me ? me.seatIndex : 0;
  const myTurn = isMyTurn();

  const orderedPlayers = Array.from({ length: maxPlayers }).map((_, displayIdx) => {
    const seatIndex = (mySeatIndex + displayIdx) % maxPlayers;
    return { displayIdx, player: players.find(p => p.seatIndex === seatIndex), seatIndex };
  });

  const topRow = orderedPlayers.slice(0, 3);
  const midRow = orderedPlayers.slice(3, 6);
  const bottomRow = orderedPlayers.slice(6, 9);

  return (
    <div className="table-container">
      <Dealer />

      <div className="status-bar">
        <span className="room-name">◈ {roomName}{isCreator && <span className="host-badge-header"> ★</span>}</span>
        <span className="hand-number">第 {gameState.handNumber} 局</span>
        <span className="pot-info">⚡ {gameState.pot}</span>
        {isCreator && (
          <button className="room-settlement-btn" onClick={() => setSettlementConfirm(true)}>
            房间结算
          </button>
        )}
        <button className="leave-btn" onClick={() => setLeaveConfirm(true)}>退出</button>
      </div>

      <div className="battlefield">
        <div className="tactical-panel">
          <div className="seats-vertical">
            <div className="seats-row">
              {topRow.map(({ displayIdx, player, seatIndex }) => {
                const isMySeat = player && player.id === playerId;
                const isActive = player && seatIndex === activeIdx;
                return (
                  <PlayerSeat
                    key={displayIdx}
                    player={player}
                    isMySeat={isMySeat}
                    isActive={isActive}
                    myCards={isMySeat ? myCards : null}
                    seatIndex={seatIndex}
                  />
                );
              })}
            </div>

            <div className="seats-row">
              {midRow.map(({ displayIdx, player, seatIndex }) => {
                const isMySeat = player && player.id === playerId;
                const isActive = player && seatIndex === activeIdx;
                return (
                  <PlayerSeat
                    key={displayIdx}
                    player={player}
                    isMySeat={isMySeat}
                    isActive={isActive}
                    myCards={isMySeat ? myCards : null}
                    seatIndex={seatIndex}
                  />
                );
              })}
            </div>

            <div className="data-nodes">
              {communityCards.map((card, i) => (
                <Card key={i} card={card} />
              ))}
              {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                <div key={`empty-${i}`} className="card card-placeholder"></div>
              ))}
            </div>

            <div className="pot-display">
              <span className="pot-label">底池</span>
              <span className="pot-total">⚡ {gameState.pot}</span>
              {gameState.sidePots && gameState.sidePots.length > 0 && (
                <div className="side-pots">
                  {gameState.sidePots.map((sp, i) => (
                    <span key={i} className="side-pot">
                      {i === 0 ? '主池' : `边池${i}`}: ⚡{sp.amount}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="seats-row">
              {bottomRow.map(({ displayIdx, player, seatIndex }) => {
                const isMySeat = player && player.id === playerId;
                const isActive = player && seatIndex === activeIdx;
                return (
                  <PlayerSeat
                    key={displayIdx}
                    player={player}
                    isMySeat={isMySeat}
                    isActive={isActive}
                    myCards={isMySeat ? myCards : null}
                    seatIndex={seatIndex}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {me && (
        <div className={`my-hand-area ${myTurn ? 'my-turn' : ''}`}>
          {me.joinedDuringHand ? (
            <div className="my-hand-waiting-next">等待下一局</div>
          ) : (
            <div className="my-hand-cards">
              {myCards && myCards.length === 2 ? (
                <>
                  <div className="card-peek-wrapper" onClick={() => toggleMyCard(0)}>
                    <Card card={myCards[0]} hidden={!myCardsRevealed[0]} />
                  </div>
                  <div className="card-peek-wrapper" onClick={() => toggleMyCard(1)}>
                    <Card card={myCards[1]} hidden={!myCardsRevealed[1]} />
                  </div>
                </>
              ) : (
                <span className="my-hand-waiting">等待发牌...</span>
              )}
            </div>
          )}
          <div className="my-hand-info">
            <span className="my-hand-name">{playerName}</span>
            <span className="my-hand-chips">⚡ {me.chips}</span>
            {me.currentBet > 0 && (
              <span className="my-hand-bet">下注: ⚡ {me.currentBet}</span>
            )}
            {myTurn && (
              <span className="my-hand-turn-tip">◆ 你的回合 ◆</span>
            )}
          </div>
        </div>
      )}

      {myTurn && <ActionBar />}

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'rank' ? 'active-tab' : ''}`} onClick={() => setActiveTab('rank')}>
          <span className="tab-icon">📊</span>排名
        </button>
        <button className={`tab-btn ${activeTab === 'field' ? 'active-tab' : ''}`} onClick={() => setActiveTab('field')}>
          <span className="tab-icon">⚡</span>牌桌
        </button>
        <button className={`tab-btn ${activeTab === 'comms' ? 'active-tab' : ''}`} onClick={() => setActiveTab('comms')}>
          <span className="tab-icon">💬</span>聊天
        </button>
        <button className={`tab-btn ${activeTab === 'log' ? 'active-tab' : ''}`} onClick={() => setActiveTab('log')}>
          <span className="tab-icon">📋</span>记录
        </button>
      </div>

      {activeTab === 'rank' && (
        <div style={{ padding: '4px 8px', flexShrink: 0 }}>
          {chipsBuyRecord.length > 0 && (
            <div className="chips-buy-record" style={{ marginBottom: '6px' }}>
              <div className="chips-buy-record-title">⚡ 购买筹码记录</div>
              {chipsBuyRecord.map((r, i) => (
                <div key={i} className="chips-buy-record-item">
                  {r.name}
                  {r.count > 1 ? <span className="chips-buy-count"> ×{r.count}</span> : <span className="chips-buy-amount"> +{r.amount}</span>}
                </div>
              ))}
            </div>
          )}
          <ChipRanking />
        </div>
      )}

      {activeTab === 'comms' && (
        <div style={{ padding: '4px 8px', flexShrink: 0 }}>
          <div className="chat-panel">
            <div className="chat-panel-title">◈ 聊天</div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">暂无消息</div>
              ) : (
                chatMessages.slice(-10).map((msg, i) => (
                  <div key={i} className="chat-msg">
                    <span className="chat-msg-name">{msg.name}:</span>
                    <span className="chat-msg-text">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
            <div className="chat-input-row">
              <input
                className="chat-input"
                maxLength={20}
                placeholder="发送消息... (最多20字)"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    if (socket) socket.emit(CLIENT.CHAT, { message: chatInput.trim() });
                    setChatInput('');
                  }
                }}
              />
              <button className="flirt-btn" onClick={handleFlirt} disabled={flirtCooldown > 0}>
                {flirtCooldown > 0 ? `${flirtCooldown}s` : '⚡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div style={{ padding: '4px 8px', flexShrink: 0 }}>
          <div className="action-log-panel">
            <div className="action-log-title">◈ 操作记录</div>
            <div className="action-log-list">
              {actionLog.length === 0 ? (
                <div className="action-log-empty">暂无记录</div>
              ) : (
                actionLog.map((entry, i) => (
                  <div
                    key={i}
                    className={`action-log-item ${entry.type === 'stage' ? 'stage' : ''} ${entry.isMe ? 'me' : ''} ${entry.action ? 'action-' + entry.action : ''}`}
                  >
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {buyChipsPrompt && (
        <div className="buy-chips-overlay">
          <div className="buy-chips-box">
            <p>筹码为0，可购买筹码</p>
            <button className="buy-chips-btn" onClick={() => {
              if (socket) socket.emit(CLIENT.BUY_CHIPS);
            }}>
              购买筹码（补充至初始值）
            </button>
          </div>
        </div>
      )}

      <SettlementModal />
      <ReadyPanel />
      <RoomSettlementModal />

      <div className="phase-label">
        ◆ {getStageLabel(gameState.stage)} ◆
      </div>

      {toast && <div className="toast-message">{toast}</div>}

      {leaveConfirm && (
        <div className="leave-confirm-overlay">
          <div className="leave-confirm-box">
            <p className="leave-confirm-text">确认退出房间？</p>
            <div className="leave-confirm-btns">
              <button className="leave-confirm-stay" onClick={() => setLeaveConfirm(false)}>继续</button>
              <button className="leave-confirm-go" onClick={() => {
                setLeaveConfirm(false);
                if (socket) socket.emit(CLIENT.LEAVE_ROOM);
              }}>退出</button>
            </div>
          </div>
        </div>
      )}

      {settlementConfirm && (
        <div className="leave-confirm-overlay">
          <div className="leave-confirm-box">
            <p className="leave-confirm-text">是否结算本房间？</p>
            <div className="leave-confirm-btns">
              <button className="leave-confirm-stay" onClick={() => setSettlementConfirm(false)}>否</button>
              <button className="leave-confirm-go" onClick={() => {
                setSettlementConfirm(false);
                if (socket) socket.emit(CLIENT.REQUEST_ROOM_SETTLEMENT);
              }}>是</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStageLabel(stage) {
  const labels = {
    waiting: '等待中',
    preflop: '翻牌前',
    flop: '翻牌',
    turn: '转牌',
    river: '河牌',
    showdown: '摊牌',
  };
  return labels[stage] || stage;
}
