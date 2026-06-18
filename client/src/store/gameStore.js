import { create } from 'zustand';
import EVENTS from '@shared/events';
const { SERVER } = EVENTS;

const useGameStore = create((set, get) => ({
  // 连接状态
  connected: false,
  playerId: null,
  playerName: '',
  localIp: '',
  serverPort: 8080,

  // 房间状态
  inRoom: false,
  roomId: null,
  roomName: '',
  roomList: [],
  seatIndex: -1, // -1 = 未坐下（旁观）
  isCreator: false, // 是否是房主

  // 游戏状态
  gameState: null,
  myCards: [], // 自己的手牌（私密）
  turnInfo: null, // 当前轮行动信息
  timeLeft: 0,

  // 购买筹码相关
  buyChipsPrompt: false,  // 是否显示购买筹码按钮（服务端推送）
  chipsBuyRecord: [],     // [{name, amount, time}] 本局内购买筹码记录（用于左上角显示）

  // 房间结算
  roomSettlement: null,        // 房间结算数据 { players: [...] }
  roomSettlementCountdown: 0,  // 房间结算倒计时秒数

  // 结算面板准备状态
  settlementReadyCount: 0,    // 已准备玩家数量
  settlementTotalPlayers: 0,  // 总玩家数量
  settlementMyReady: false,   // 我是否已准备
  settlementReadyPlayers: [], // 每个玩家的准备状态 [{ id, name, ready }]

  // 聊天
  chatMessages: [],
  lanServers: [],
  actionLog: [], // 操作历史流水
  toast: '', // 飘字提示

  // 设置方法
  setConnected: (val) => set({ connected: val }),
  setPlayerId: (id) => set({ playerId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setLocalInfo: (ip, port) => set({ localIp: ip, serverPort: port }),

  setRoomList: (rooms) => set({ roomList: rooms }),
  setInRoom: (val, roomId = null, roomName = '', isCreator = false) =>
    set({ inRoom: val, roomId, roomName, isCreator }),
  setSeatIndex: (idx) => set({ seatIndex: idx }),
  setIsCreator: (val) => set({ isCreator: val }),

  setGameState: (state) => set({ gameState: state }),
  setMyCards: (cards) => set({ myCards: cards }),
  setTurnInfo: (info) => set({ turnInfo: info }),
  setTimeLeft: (t) => set({ timeLeft: t }),

  // 结算面板准备状态
  setSettlementReadyCount: (n) => set({ settlementReadyCount: n }),
  setSettlementTotalPlayers: (n) => set({ settlementTotalPlayers: n }),
  setSettlementMyReady: (val) => set({ settlementMyReady: val }),
  setSettlementReadyPlayers: (players) => set({ settlementReadyPlayers: players }),
  resetSettlement: () => set({ settlementReadyCount: 0, settlementTotalPlayers: 0, settlementMyReady: false, settlementReadyPlayers: [] }),

  // 房间结算
  setRoomSettlement: (data) => set({ roomSettlement: data }),
  setRoomSettlementCountdown: (n) => set({ roomSettlementCountdown: n }),
  clearRoomSettlement: () => set({ roomSettlement: null, roomSettlementCountdown: 0 }),

  // 购买筹码
  setBuyChipsPrompt: (val) => set({ buyChipsPrompt: val }),

  // 购买筹码 - 按玩家名累计，同名玩家 count+1
  addChipsBuyRecord: (entry) => set((s) => {
    const existing = s.chipsBuyRecord.find(r => r.name === entry.name);
    if (existing) {
      return {
        chipsBuyRecord: s.chipsBuyRecord.map(r =>
          r.name === entry.name ? { ...r, count: r.count + 1 } : r
        ),
      };
    }
    return {
      chipsBuyRecord: [...s.chipsBuyRecord, { name: entry.name, amount: entry.amount, count: 1 }],
    };
  }),
  clearChipsBuyRecord: () => set({ chipsBuyRecord: [] }),

  addChatMessage: (msg) => set((s) => ({
    chatMessages: [...s.chatMessages, msg].slice(-50) // 保留最近50条
  })),
  setLanServers: (servers) => set({ lanServers: servers }),

  // 飘字提示
  setToast: (msg) => {
    set({ toast: msg });
    if (msg) setTimeout(() => set({ toast: '' }), 2500);
  },

  // 操作历史
  addActionLog: (entry) => set((s) => ({
    actionLog: [...s.actionLog, entry].slice(-30) // 保留最近30条
  })),
  clearActionLog: () => set({ actionLog: [] }),

  // 重置房间相关状态
  leaveRoom: () => set({
    inRoom: false,
    roomId: null,
    roomName: '',
    seatIndex: -1,
    isCreator: false,
    gameState: null,
    myCards: [],
    turnInfo: null,
    timeLeft: 0,
    actionLog: [],
    buyChipsPrompt: false,
    chipsBuyRecord: [],
  }),
}));

export default useGameStore;
