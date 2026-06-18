// 前后端共享的类型定义（JSDoc 格式，供参考）

/**
 * @typedef {Object} Card
 * @property {string} suit  - 'hearts'|'diamonds'|'clubs'|'spades'
 * @property {number} rank  - 2~14 (2=2...10=10, 11=J, 12=Q, 13=K, 14=A)
 * @property {string} id    - `${rank}_${suit}` e.g. "14_hearts"
 */

/**
 * @typedef {Object} Player
 * @property {string} id            - socket.id
 * @property {string} name          - 显示名
 * @property {number} seatIndex     - 座位号 0~8
 * @property {number} chips         - 当前筹码
 * @property {Card[]|null} holeCards - 手牌（仅自己可见，其他人为null）
 * @property {number} currentBet    - 当前轮下注额
 * @property {number} totalBet      - 本局总下注额
 * @property {boolean} folded       - 已弃牌
 * @property {boolean} allIn        - 已全下
 * @property {boolean} isDealer     - 是庄家
 * @property {boolean} isSB         - 是小盲
 * @property {boolean} isBB         - 是大盲
 * @property {boolean} connected    - 是否在线
 * @property {string|null} lastAction - 最近行动
 * @property {boolean} showCards    - 是否亮牌（showdown时）
 */

/**
 * @typedef {Object} SidePot
 * @property {number} amount           - 侧池金额
 * @property {string[]} eligiblePlayerIds - 有资格赢此池的玩家ID列表
 */

/**
 * @typedef {Object} Winner
 * @property {string} playerId   - 赢家ID
 * @property {number} amount     - 赢得金额
 * @property {number} potIndex   - 对应的池索引（主池=0）
 * @property {{rank:number,values:number[],name:string}|null} handResult - 手牌结果
 */

/**
 * @typedef {Object} GameState
 * @property {string} roomId
 * @property {Player[]} players
 * @property {Card[]} communityCards   - 公共牌 0~5张
 * @property {number} pot              - 主池金额
 * @property {SidePot[]} sidePots
 * @property {string} stage            - 'waiting'|'preflop'|'flop'|'turn'|'river'|'showdown'
 * @property {number} activePlayerIndex - 当前行动玩家索引
 * @property {number} dealerIndex
 * @property {number} smallBlind
 * @property {number} bigBlind
 * @property {number} minRaise
 * @property {number} handNumber
 * @property {number} timer            - 倒计时秒数
 * @property {Winner[]|null} winners
 */

/**
 * @typedef {Object} RoomInfo
 * @property {string} roomId
 * @property {string} name
 * @property {number} playerCount
 * @property {number} maxPlayers
 * @property {number} smallBlind
 * @property {number} bigBlind
 * @property {string} creatorId
 * @property {boolean} inProgress
 * @property {string} hostIp
 * @property {number} hostPort
 */

/**
 * @typedef {Object} TurnInfo
 * @property {number} timeLeft     - 剩余秒数
 * @property {number} minRaise     - 最小加注额
 * @property {boolean} canCheck    - 是否可过牌
 * @property {boolean} canCall     - 是否可跟注
 * @property {number} callAmount   - 跟注金额
 * @property {number} raiseMin     - 最小加注额
 * @property {number} raiseMax     - 最大加注额（=玩家剩余筹码）
 */

module.exports = {};