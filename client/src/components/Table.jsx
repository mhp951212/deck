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
  const prevHandNumberRef = useRef(null);
  const flirtTimerRef = useRef(null);

  const FLIRT_COOLDOWN = 5; // 发骚冷却时间（秒）

  // 清理发骚定时器
  useEffect(() => {
    return () => {
      if (flirtTimerRef.current) clearInterval(flirtTimerRef.current);
    };
  }, []);

  // 点击底部手牌切换显示
  const toggleMyCard = (index) => {
    setMyCardsRevealed(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  // 新一局开始时重置手牌状态为隐藏
  useEffect(() => {
    const handNumber = gameState?.handNumber;
    if (handNumber && handNumber !== prevHandNumberRef.current) {
      prevHandNumberRef.current = handNumber;
      setMyCardsRevealed([false, false]);
    }
  }, [gameState?.handNumber]);

  // 坐下时检查
  const handleSitDown = (seatIndex) => {
    const players = gameState?.players || [];
    const showToast = useGameStore.getState().setToast;

    // 检查座位是否已有人
    const seatOccupied = players.find(p => p.seatIndex === seatIndex);
    if (seatOccupied) {
      showToast('座位已有人');
      return;
    }

    // 检查昵称是否重复
    const nameExists = players.find(p => p.name === playerName);
    if (nameExists) {
      showToast('昵称已存在');
      return;
    }

    // 检查 IP 是否重复
    const ipExists = players.find(p => p.ip === localIp);
    if (ipExists) {
      showToast('该 IP 已在游戏中');
      return;
    }

    // 通过检查，发送坐下请求
    if (socket) {
      socket.emit(CLIENT.SIT_DOWN, { seatIndex });
    }
  };

  // 发骚按钮点击
  const handleFlirt = () => {
    if (flirtCooldown > 0) return;

    // 发送发骚事件
    if (socket) {
      socket.emit(CLIENT.FLIRT);
    }

    // 开始冷却
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

  // 等待中 / 刚进入房间
  if (!gameState || gameState.stage === 'waiting') {
    const players = gameState?.players || [];
    const seatedCount = players.filter(p => p.seatIndex >= 0).length;
    return (
      <div className="table-container">
        <div className="table-waiting">
          <h2>房间: {roomName}</h2>
          {isCreator && <span className="host-badge-header">👑 你是房主</span>}
          <p>等待开始游戏...</p>

          {/* 购买筹码记录（左上角） */}
          {chipsBuyRecord.length > 0 && (
            <div className="chips-buy-record">
              <div className="chips-buy-record-title">购买记录</div>
              {chipsBuyRecord.map((r, i) => (
                <div key={i} className="chips-buy-record-item">
                  {r.name} +{r.amount}
                </div>
              ))}
            </div>
          )}

          {/* 玩家列表（等待模式） */}
          <div className="seat-grid waiting-grid">
            {[0,1,2,3,4,5,6,7,8].map(i => {
              const player = players.find(p => p.seatIndex === i);
              return (
                <div key={i} className="waiting-seat" onClick={() => {
                  if (!player && socket) {
                    handleSitDown(i);
                  }
                }}>
                  {player ? (
                    <div className="waiting-player">
                      {player.isCreator && <span className="host-icon" title="房主">👑</span>}
                      <span>{player.name}</span>
                      <span>💰{player.chips}</span>
                    </div>
                  ) : (
                    <div className="empty-seat-label">坐下</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 开始按钮 - 只有房主才显示 */}
          {isCreator && seatedCount >= 2 && (
            <button className="start-btn" onClick={() => {
              if (socket) socket.emit(CLIENT.START_GAME);
            }}>
              开始游戏
            </button>
          )}
          {!isCreator && seatedCount >= 2 && (
            <p className="waiting-for-host">等待房主开始游戏...</p>
          )}
          {seatedCount < 2 && (
            <p className="waiting-for-players">需要至少2名玩家坐下才能开始</p>
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
        {/* 飘字提示 */}
        {toast && <div className="toast-message">{toast}</div>}
        {/* 退出确认弹窗 */}
        {leaveConfirm && (
          <div className="leave-confirm-overlay">
            <div className="leave-confirm-box">
              <p className="leave-confirm-text">是否要退出房间小菜比！！</p>
              <div className="leave-confirm-btns">
                <button className="leave-confirm-stay" onClick={() => setLeaveConfirm(false)}>继续战！</button>
                <button className="leave-confirm-go" onClick={() => {
                  setLeaveConfirm(false);
                  if (socket) socket.emit(CLIENT.LEAVE_ROOM);
                }}>我认输！</button>
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

  // 找到自己，用于底部手牌区
  const me = players.find(p => p.id === playerId);
  const mySeatIndex = me ? me.seatIndex : 0;
  const myTurn = isMyTurn();

  // 按我的位置为基准重新排列座位：我始终在底部中间（displayIndex=0）
  // 其他玩家逆时针排列（即 seatIndex 顺时针递增）
  const orderedPlayers = Array.from({ length: maxPlayers }).map((_, displayIdx) => {
    const seatIndex = (mySeatIndex + displayIdx) % maxPlayers;
    return { displayIdx, player: players.find(p => p.seatIndex === seatIndex), seatIndex };
  });

  return (
    <div className="table-container">
      {/* 荷官弹窗 */}
      <Dealer />

      {/* 顶部信息 */}
      <div className="table-header">
        <span className="room-name">
          房间: {roomName}
          {isCreator && <span className="host-badge-header"> 👑</span>}
        </span>
        <span className="hand-number">第 {gameState.handNumber} 局</span>
        <span className="pot-info">奖池: 💰{gameState.pot}</span>
        {isCreator && (
          <button className="room-settlement-btn" onClick={() => setSettlementConfirm(true)}>
            房间结算
          </button>
        )}
        <button className="leave-btn" onClick={() => setLeaveConfirm(true)}>退出房间</button>
      </div>

      {/* 牌桌舞台区（居中容器） */}
      <div className="table-stage">
        {/* 左侧浮层：购买记录 + 筹码排名 */}
        <div className="left-panels">
          {chipsBuyRecord.length > 0 && (
            <div className="chips-buy-record">
              <div className="chips-buy-record-title">💳 购买记录</div>
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
          <ChipRanking />
        </div>

        {/* 牌桌（外层边框） */}
        <div className="poker-table">
          {/* 绿色桌面（内层） */}
          <div className="table-inner">
            {/* 公共牌区域 */}
            <div className="community-area">
              {communityCards.map((card, i) => (
                <Card key={i} card={card} />
              ))}
              {/* 未翻的牌位 */}
              {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                <div key={`empty-${i}`} className="card card-placeholder"></div>
              ))}
            </div>

            {/* 底池显示 */}
            <div className="pot-display">
              <span className="pot-label">底池</span>
              <span className="pot-total">💰 {gameState.pot}</span>
              {gameState.sidePots && gameState.sidePots.length > 0 && (
                <div className="side-pots">
                  {gameState.sidePots.map((sp, i) => (
                    <span key={i} className="side-pot">
                      侧池{i + 1}: 💰{sp.amount}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 玩家座位 - 椭圆形排列（以我为基准逆时针排列） */}
          <div className="seat-layout">
            {orderedPlayers.map(({ displayIdx, player, seatIndex }) => {
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

        {/* 聊天区域 */}
        <div className="chat-area">
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
              placeholder="说点什么...（最多20字）"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  if (socket) {
                    socket.emit(CLIENT.CHAT, { message: chatInput.trim() });
                  }
                  setChatInput('');
                }
              }}
            />
            {/* 发骚按钮 */}
            <button
              className="flirt-btn"
              onClick={handleFlirt}
              disabled={flirtCooldown > 0}
            >
              💋
            </button>
          </div>
        </div>

        {/* 操作历史流水（屏幕右侧浮层） */}
        <div className="action-log">
          <div className="action-log-title">操作记录</div>
          <div className="action-log-list">
            {actionLog.length === 0 ? (
              <div className="action-log-empty">暂无操作</div>
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

      {/* 我的手牌区（底部固定，放大显示） */}
      {me && (
        <div className={`my-hand-area ${myTurn ? 'my-turn' : ''}`}>
          {/* 中途加入的玩家，显示"等待下一局加入" */}
          {me.joinedDuringHand ? (
            <div className="my-hand-waiting-next">等待下一局加入</div>
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
        </div>
      )}

      {/* 操作栏 */}
      {myTurn && <ActionBar />}

      {/* 购买筹码按钮（只对筹码为0的玩家显示） */}
      {buyChipsPrompt && (
        <div className="buy-chips-overlay">
          <div className="buy-chips-box">
            <p>你的筹码为0，可以购买一次筹码</p>
            <button className="buy-chips-btn" onClick={() => {
              if (socket) socket.emit(CLIENT.BUY_CHIPS);
            }}>
              购买筹码（补充至初始值）
            </button>
          </div>
        </div>
      )}

      {/* 结算面板 */}
      <SettlementModal />

      {/* 准备状态面板 */}
      <ReadyPanel />

      {/* 房间结算面板（房主专属） */}
      <RoomSettlementModal />

      {/* 游戏阶段指示 */}
      <div className="stage-indicator">
        {getStageLabel(gameState.stage)}
      </div>

      {/* 飘字提示 */}
      {toast && <div className="toast-message">{toast}</div>}

      {/* 退出确认弹窗 */}
      {leaveConfirm && (
        <div className="leave-confirm-overlay">
          <div className="leave-confirm-box">
            <p className="leave-confirm-text">是否要退出房间小菜比！！</p>
            <div className="leave-confirm-btns">
              <button className="leave-confirm-stay" onClick={() => setLeaveConfirm(false)}>继续战！</button>
              <button className="leave-confirm-go" onClick={() => {
                setLeaveConfirm(false);
                if (socket) socket.emit(CLIENT.LEAVE_ROOM);
              }}>我认输！</button>
            </div>
          </div>
        </div>
      )}

      {/* 房间结算确认弹窗 */}
      {settlementConfirm && (
        <div className="leave-confirm-overlay">
          <div className="leave-confirm-box">
            <p className="leave-confirm-text">是否要结算本房间？</p>
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
    waiting: '等待开始',
    preflop: '翻牌前',
    flop: '翻牌',
    turn: '转牌',
    river: '河牌',
    showdown: '摊牌',
  };
  return labels[stage] || stage;
}
