// 游戏常量配置

module.exports = {
  // 牌桌配置
  MIN_PLAYERS: 2, // 最少玩家数开始一局
  MAX_PLAYERS: 9, // 最多玩家数
  DEFAULT_CHIPS: 1000, // 默认初始筹码

  // 盲注默认值
  DEFAULT_SMALL_BLIND: 10,
  DEFAULT_BIG_BLIND: 20,

  // 计时器
  ACTION_TIMEOUT: 60, // 行动限时（秒）
  TIMEOUT_WARNING: 10, // 剩余10秒时警告

  // 网络配置
  SERVER_PORT: 8080, // 服务端端口
  LAN_BROADCAST_PORT: 3001, // LAN广播端口
  LAN_BROADCAST_INTERVAL: 5000, // 广播间隔(ms)

  // 牌面定义
  SUITS: ["hearts", "diamonds", "clubs", "spades"],
  SUIT_SYMBOLS: {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  },
  SUIT_COLORS: {
    hearts: "#ff4466",
    diamonds: "#ff4466",
    clubs: "#00f0ff",
    spades: "#e0e8f0",
  },
  RANKS: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  RANK_NAMES: {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
  },

  // 游戏阶段
  STAGES: {
    WAITING: "waiting",
    PREFLOP: "preflop",
    FLOP: "flop",
    TURN: "turn",
    RIVER: "river",
    SHOWDOWN: "showdown",
  },

  // 玩家行动
  ACTIONS: {
    FOLD: "fold",
    CHECK: "check",
    CALL: "call",
    RAISE: "raise",
    ALLIN: "allin",
  },

  // 手牌等级
  HAND_RANKS: {
    HIGH_CARD: 1,
    ONE_PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10,
  },

  HAND_RANK_NAMES: {
    1: "高牌",
    2: "一对",
    3: "两对",
    4: "三条",
    5: "顺子",
    6: "同花",
    7: "葫芦",
    8: "四条",
    9: "同花顺",
    10: "皇家同花顺",
  },
};
