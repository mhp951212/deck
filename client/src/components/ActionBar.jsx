import React, { useState, useRef, useEffect } from 'react';
import useGameStore from '../store/gameStore';
import useGameState from '../hooks/useGameState';
import CONSTANTS from '@shared/constants';
const { ACTIONS } = CONSTANTS;
import '../styles/actions.css';

export default function ActionBar() {
  const { turnInfo, timeLeft, sendAction, isMyTurn } = useGameState();
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAllInConfirm, setShowAllInConfirm] = useState(false);

  const totalChips = useGameStore((s) => {
    const state = s.gameState;
    if (!state) return 0;
    const me = state.players.find(p => p.id === s.playerId);
    return me ? me.chips : 0;
  });

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  useEffect(() => {
    if (turnInfo && turnInfo.raiseMin) {
      setRaiseAmount(turnInfo.raiseMin);
      setInputText(String(turnInfo.raiseMin));
      setIsEditing(false);
    }
  }, [turnInfo]);

  useEffect(() => {
    if (!isEditing && turnInfo?.raiseMin) {
      setInputText(String(raiseAmount));
    }
  }, [raiseAmount, isEditing, turnInfo?.raiseMin]);

  if (!isMyTurn() || !turnInfo) return null;

  const handleFold = () => sendAction(ACTIONS.FOLD);
  const handleCheck = () => sendAction(ACTIONS.CHECK);
  const handleCall = () => sendAction(ACTIONS.CALL, turnInfo.callAmount);

  const handleRaise = () => {
    const finalAmount = isEditing
      ? clamp(Number(inputText), turnInfo.raiseMin, turnInfo.raiseMax)
      : raiseAmount;
    sendAction(ACTIONS.RAISE, finalAmount);
  };

  const handleAllIn = () => setShowAllInConfirm(true);
  const confirmAllIn = () => { setShowAllInConfirm(false); sendAction(ACTIONS.ALLIN); };
  const cancelAllIn = () => setShowAllInConfirm(false);

  const handleInputFocus = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const clamped = clamp(Number(inputText), turnInfo.raiseMin, turnInfo.raiseMax);
    setInputText(String(clamped));
    setRaiseAmount(clamped);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') inputRef.current?.blur();
  };

  return (
    <div className="action-bar">
      <div className="action-timer">
        <div className="timer-bar" style={{ width: `${(timeLeft / CONSTANTS.ACTION_TIMEOUT) * 100}%` }}></div>
        <span className="timer-text">⏱ {timeLeft}s</span>
      </div>

      <div className="action-buttons">
        <button className="action-btn fold" onClick={handleFold}>
          弃牌
        </button>

        {turnInfo.canCheck && (
          <button className="action-btn check" onClick={handleCheck}>
            过牌
          </button>
        )}

        {turnInfo.canCall && (
          <button className="action-btn call" onClick={handleCall}>
            跟注 {turnInfo.callAmount}
          </button>
        )}

        {turnInfo.raiseMin > 0 && totalChips > turnInfo.callAmount && (
          <div className="raise-group">
            <input
              type="range"
              min={turnInfo.raiseMin}
              max={turnInfo.raiseMax}
              value={isEditing ? clamp(Number(inputText), turnInfo.raiseMin, turnInfo.raiseMax) : raiseAmount}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRaiseAmount(v);
                setInputText(String(v));
                setIsEditing(false);
              }}
              className="raise-slider"
            />
            <input
              ref={inputRef}
              type="number"
              min={turnInfo.raiseMin}
              max={turnInfo.raiseMax}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="raise-input"
            />
            <button className="action-btn raise" onClick={handleRaise}>
              加注 {isEditing ? clamp(Number(inputText), turnInfo.raiseMin, turnInfo.raiseMax) : raiseAmount}
            </button>
          </div>
        )}

        {totalChips > 0 && (
          <button className="action-btn allin" onClick={handleAllIn}>
            全下 {totalChips}
          </button>
        )}
      </div>

      {showAllInConfirm && (
        <div className="allin-confirm-overlay">
          <div className="allin-confirm-modal">
            <div className="allin-confirm-text">◆ 全下确认 ◆</div>
            <div className="allin-confirm-buttons">
              <button className="allin-btn-cancel" onClick={cancelAllIn}>
                取消
              </button>
              <button className="allin-btn-confirm" onClick={confirmAllIn}>
                全下!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
