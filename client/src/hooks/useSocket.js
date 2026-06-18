import { io } from 'socket.io-client';
import useGameStore from '../store/gameStore';
import EVENTS from '@shared/events';
const { CLIENT, SERVER } = EVENTS;

let socketInstance = null;

function useSocket() {
  if (socketInstance) return socketInstance;

  // 自动检测服务器地址：
  // 页面由服务器自身托管，直接连同源地址，端口/IP 永远正确，
  // 避免与 store 默认端口不一致导致连不上。
  // 开发模式(vite 5173)下回退到 store 中配置的服务器端口。
  let serverUrl;
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    const devPort = useGameStore.getState().serverPort || 8080;
    // vite 开发服务器端口通常是 5173，此时显式指向后端端口
    if (window.location.port === '5173') {
      serverUrl = `http://${window.location.hostname}:${devPort}`;
    } else {
      // 生产/Electron：同源（服务器既托管页面也提供 socket）
      serverUrl = window.location.origin;
    }
  } else {
    const port = useGameStore.getState().serverPort || 8080;
    serverUrl = `http://localhost:${port}`;
  }

  socketInstance = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  // 连接成功
  socketInstance.on('connect', () => {
    console.log('Connected to server:', socketInstance.id);
    useGameStore.getState().setConnected(true);
  });

  // 断开连接
  socketInstance.on('disconnect', () => {
    console.log('Disconnected from server');
    useGameStore.getState().setConnected(false);
  });

  // 注册 Socket.IO 事件监听
  socketInstance.on(SERVER.SERVER_JOINED, (data) => {
    useGameStore.getState().setPlayerId(data.playerId);
  });

  socketInstance.on(SERVER.ROOM_LIST, (data) => {
    useGameStore.getState().setRoomList(data.rooms);
  });

  socketInstance.on(SERVER.ROOM_CREATED, (data) => {
    useGameStore.getState().setInRoom(true, data.room.roomId, data.room.name, !!data.isCreator);
    // 设置初始 gameState 为等待状态
    useGameStore.getState().setGameState({
      roomId: data.room.roomId,
      name: data.room.name,
      creatorId: data.room.creatorId,
      players: [],
      communityCards: [],
      pot: 0,
      sidePots: [],
      stage: 'waiting',
      activePlayerIndex: -1,
      handNumber: 0,
      smallBlind: data.room.smallBlind,
      bigBlind: data.room.bigBlind,
      maxPlayers: data.room.maxPlayers,
      winners: null,
    });
    // 服务端创建房间时已自动加入，无需再发 JOIN_ROOM
  });

  socketInstance.on(SERVER.ROOM_JOINED, (data) => {
    useGameStore.getState().setInRoom(true, data.room.roomId, data.room.name, !!data.isCreator);
    useGameStore.getState().setGameState({
      roomId: data.room.roomId,
      name: data.room.name,
      creatorId: data.room.creatorId,
      players: [],
      communityCards: [],
      pot: 0,
      sidePots: [],
      stage: 'waiting',
      activePlayerIndex: -1,
      handNumber: 0,
      smallBlind: data.room.smallBlind,
      bigBlind: data.room.bigBlind,
      maxPlayers: data.room.maxPlayers,
      winners: null,
    });
  });

  socketInstance.on(SERVER.ROOM_LEFT, () => {
    useGameStore.getState().leaveRoom();
  });

  socketInstance.on(SERVER.GAME_STATE, (data) => {
    const prev = useGameStore.getState().gameState;
    const next = data.state;

    // 新一局开始（handNumber 增加）时清空操作历史
    if (next && prev && next.handNumber > prev.handNumber) {
      useGameStore.getState().clearActionLog();
    }

    // 阶段推进时记录（翻牌/转牌/河牌）
    if (next && prev && next.stage !== prev.stage && next.stage !== 'waiting') {
      const stageLabels = { flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌', preflop: '翻牌前' };
      const label = stageLabels[next.stage];
      if (label && next.stage !== 'preflop') {
        useGameStore.getState().addActionLog({
          type: 'stage',
          text: `—— ${label} ——`,
        });
      }
    }

    // 同步 isCreator（房主可能因离开而转移）
    const myId = useGameStore.getState().playerId;
    if (next && myId) {
      useGameStore.getState().setIsCreator(next.creatorId === myId);
    }

    useGameStore.getState().setGameState(next);
  });

  // 玩家行动结果 → 操作历史
  socketInstance.on(SERVER.ACTION_RESULT, (data) => {
    const state = useGameStore.getState().gameState;
    const myId = useGameStore.getState().playerId;
    const player = state?.players?.find(p => p.id === data.playerId);
    const name = data.playerId === myId ? '你' : (player?.name || '玩家');
    const actionLabels = {
      fold: '弃牌', check: '过牌', call: '跟注', raise: '加注', allin: '全下',
    };
    const actionText = actionLabels[data.action] || data.action;
    let text;
    if (data.action === 'raise') {
      text = `${name} 加注到 ${data.amount}`;
    } else if (data.action === 'call') {
      text = `${name} 跟注 ${data.amount}`;
    } else if (data.action === 'allin') {
      text = `${name} 全下 ${data.amount}`;
    } else {
      text = `${name} ${actionText}`;
    }
    useGameStore.getState().addActionLog({
      type: 'action',
      action: data.action,
      isMe: data.playerId === myId,
      text,
    });
  });

  socketInstance.on(SERVER.YOUR_CARDS, (data) => {
    useGameStore.getState().setMyCards(data.cards);
  });

  socketInstance.on(SERVER.YOUR_TURN, (data) => {
    useGameStore.getState().setTurnInfo(data);
    useGameStore.getState().setTimeLeft(data.timeLeft);
  });

  socketInstance.on(SERVER.TIMER_TICK, (data) => {
    useGameStore.getState().setTimeLeft(data.timeLeft);
  });

  socketInstance.on(SERVER.SHOWDOWN_RESULT, (data) => {
    // showdown 结果会在 game_state 中体现
  });

  socketInstance.on(SERVER.SIT_DOWN_ERROR, (data) => {
    useGameStore.getState().setToast(data.message);
  });

  socketInstance.on(SERVER.ERROR, (data) => {
    console.error('Server error:', data.message);
    useGameStore.getState().setToast(data.message);
  });

  socketInstance.on(SERVER.CHAT_MESSAGE, (data) => {
    useGameStore.getState().addChatMessage(data);
  });

  socketInstance.on(SERVER.LAN_SERVERS, (data) => {
    useGameStore.getState().setLanServers(data.servers);
  });

  // 筹码为0提示（广播给所有人）
  socketInstance.on(SERVER.NEED_CHIPS, (data) => {
    useGameStore.getState().setToast(data.message);
  });

  // 结算面板准备状态更新
  socketInstance.on(SERVER.SETTLEMENT_READY_UPDATE, (data) => {
    useGameStore.getState().setSettlementReadyCount(data.readyCount);
    useGameStore.getState().setSettlementTotalPlayers(data.totalPlayers);
    if (data.readyPlayers) {
      useGameStore.getState().setSettlementReadyPlayers(data.readyPlayers);
    }
  });

  // 新一局开始
  socketInstance.on(SERVER.NEW_HAND_STARTED, () => {
    useGameStore.getState().setToast('新一局已开始！');
    useGameStore.getState().resetSettlement();
  });

  // 购买筹码按钮（只给筹码为0的玩家）
  socketInstance.on(SERVER.BUY_CHIPS_PROMPT, (data) => {
    useGameStore.getState().setBuyChipsPrompt(data.canBuy);
  });

  // 玩家跑路广播
  socketInstance.on(SERVER.PLAYER_RAN, (data) => {
    useGameStore.getState().setToast(`${data.name}彩笔输不起跑路了！！`);
  });

  // 购买筹码成功广播
  socketInstance.on(SERVER.CHIPS_BOUGHT, (data) => {
    const myId = useGameStore.getState().playerId;
    const isSelf = data.playerId === myId;
    const name = isSelf ? '你' : data.name;

    if (data.isInitialBuy) {
      // 中途加入玩家的本金购买，不记录为再购买
      useGameStore.getState().setToast(`${name} 入场（本金 ${data.amount}）`);
    } else {
      // 正常再购买，记录到再购买列表
      useGameStore.getState().addChipsBuyRecord({
        name: data.name,
        amount: data.amount,
        time: Date.now(),
      });
      useGameStore.getState().setToast(`${name} 购买了 ${data.amount} 筹码`);
    }

    if (isSelf) {
      // 自己购买成功后隐藏按钮
      useGameStore.getState().setBuyChipsPrompt(false);
    }
  });

  // 房间结算结果
  socketInstance.on(SERVER.ROOM_SETTLEMENT_RESULT, (data) => {
    useGameStore.getState().setRoomSettlement(data);
  });

  // 房间结算倒计时
  socketInstance.on(SERVER.ROOM_SETTLEMENT_COUNTDOWN, (data) => {
    useGameStore.getState().setRoomSettlementCountdown(data.countdown);
  });

  // 房间解散
  socketInstance.on(SERVER.ROOM_DISSOLVED, () => {
    useGameStore.getState().clearRoomSettlement();
    useGameStore.getState().leaveRoom();
    useGameStore.getState().setToast('房间已解散');
  });

  // 荷官骚话（加注/全下时）
  socketInstance.on(SERVER.DEALER_QUOTE, (data) => {
    // 触发全局自定义事件，让 Dealer 组件显示
    const event = new CustomEvent('dealerMessage', {
      detail: {
        quote: data.quote,
        playerName: data.playerName,
      }
    });
    window.dispatchEvent(event);
  });

  // 发骚话（点击发骚按钮时）
  socketInstance.on(SERVER.FLIRT_QUOTE, (data) => {
    const event = new CustomEvent('dealerMessage', {
      detail: {
        quote: data.quote,
        playerName: data.playerName,
      }
    });
    window.dispatchEvent(event);
  });

  return socketInstance;
}

export default useSocket;
