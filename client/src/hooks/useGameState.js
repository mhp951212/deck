import { useCallback } from 'react';
import useGameStore from '../store/gameStore';
import useSocket from './useSocket';
import EVENTS from '@shared/events';
const { CLIENT } = EVENTS;

function useGameState() {
  const gameState = useGameStore((s) => s.gameState);
  const myCards = useGameStore((s) => s.myCards);
  const turnInfo = useGameStore((s) => s.turnInfo);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const playerId = useGameStore((s) => s.playerId);

  // 在 hook 顶层获取 socket（useSocket 返回模块级单例），
  // 不能在下面的回调内部调用 useSocket，否则违反 React Hooks 规则。
  const socket = useSocket();

  // 发送行动
  const sendAction = useCallback((actionType, amount = 0) => {
    if (!socket) return;
    socket.emit(CLIENT.ACTION, {
      type: actionType,
      amount: amount
    });
  }, [socket]);

  // 检查是否是自己的回合
  const isMyTurn = useCallback(() => {
    if (!gameState || !playerId) return false;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    return activePlayer && activePlayer.id === playerId;
  }, [gameState, playerId]);

  // 获取自己的座位信息
  const mySeat = useCallback(() => {
    if (!gameState || !playerId) return null;
    return gameState.players.find(p => p.id === playerId);
  }, [gameState, playerId]);

  return {
    gameState,
    myCards,
    turnInfo,
    timeLeft,
    sendAction,
    isMyTurn,
    mySeat,
  };
}

export default useGameState;