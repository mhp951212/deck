const Deck = require('./deck');
const Player = require('./player');
const { evaluateBestHand } = require('./handEval');
const { calculatePots, distributePots } = require('./potCalc');
const {
  STAGES, ACTIONS, DEFAULT_CHIPS, DEFAULT_SMALL_BLIND, DEFAULT_BIG_BLIND,
  MIN_PLAYERS, MAX_PLAYERS, ACTION_TIMEOUT, HAND_RANKS, HAND_RANK_NAMES,
} = require('../../../shared/constants');

class GameEngine {
  constructor(roomId, smallBlind = DEFAULT_SMALL_BLIND, bigBlind = DEFAULT_BIG_BLIND, initialChips = DEFAULT_CHIPS) {
    this.roomId = roomId;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.initialChips = initialChips;
    this.players = [];          // 所有入座玩家
    this.deck = new Deck();
    this.communityCards = [];   // 公共牌
    this.stage = STAGES.WAITING;
    this.activePlayerIndex = -1;
    this.dealerIndex = 0;
    this.handNumber = 0;
    this.pot = 0;
    this.sidePots = [];
    this.winners = null;
    this.lastRaiseAmount = bigBlind; // 最小加注量 = 上一次加注量
    this.timer = 0;
    this.timerInterval = null;
    this.handInProgress = false;
  }

  // ===== 玩家管理 =====

  addPlayer(id, name, seatIndex = -1) {
    if (this.players.length >= MAX_PLAYERS) return false;
    const player = new Player(id, name, this.initialChips);
    // 如果游戏已经开始，标记为中途加入，并设置筹码为0
    if (this.handInProgress) {
      player.joinedDuringHand = true;
      player.chips = 0;
    }

    // 如果指定了座位号，使用指定的座位号
    if (seatIndex >= 0) {
      player.seatIndex = seatIndex;
    } else {
      // 找空座位
      for (let i = 0; i < MAX_PLAYERS; i++) {
        if (!this.players.find(p => p.seatIndex === i)) {
          player.seatIndex = i;
          break;
        }
      }
    }
    this.players.push(player);
    return true;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    // 重新排序座位索引
    this.players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === id);
  }

  getSeatedPlayers() {
    return this.players.filter(p => p.seatIndex >= 0);
  }

  getActivePlayers() {
    return this.players.filter(p => !p.folded && p.seatIndex >= 0);
  }

  getCanActPlayers() {
    return this.players.filter(p => p.canAct() && p.seatIndex >= 0);
  }

  // 重置中途加入标记（新一局开始时调用）
  resetJoinedFlags() {
    this.players.forEach(p => {
      p.joinedDuringHand = false;
    });
  }

  // ===== 开始新一局 =====

  startHand() {
    const seated = this.getSeatedPlayers();
    if (seated.length < MIN_PLAYERS) return false;

    // 只移除中途加入且未购买筹码（筹码仍为0）的玩家
    // 中途加入但已购买筹码的玩家保留参与本局
    const playersToRemove = this.players.filter(p => p.joinedDuringHand && p.chips <= 0);
    for (const player of playersToRemove) {
      this.removePlayer(player.id);
    }

    this.handNumber++;
    this.handInProgress = true;

    // 重置所有玩家
    for (const player of this.players) {
      player.resetForNewHand();
      // 筹码为0的玩家自动坐出
      if (player.chips <= 0) {
        player.sittingOut = true;
      }
    }

    // 洗牌
    this.deck.reset();

    // 轮转庄家位
    this.dealerIndex = this.findNextActiveDealer();
    this.players[this.dealerIndex].isDealer = true;

    // 设置小盲和大盲
    const sbIndex = this.findNextActiveFrom(this.dealerIndex);
    const bbIndex = this.findNextActiveFrom(sbIndex);

    this.players[sbIndex].isSB = true;
    this.players[bbIndex].isBB = true;

    // 收盲注
    this.collectBlinds(sbIndex, bbIndex);

    // 发手牌
    for (const player of this.getActivePlayers()) {
      player.holeCards = this.deck.dealMultiple(2);
    }

    // 设置阶段为preflop
    this.stage = STAGES.PREFLOP;
    this.communityCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.winners = null;
    this.lastRaiseAmount = this.bigBlind;

    // 计算总池（包含盲注）
    this.recalcPot();

    // preflop 第一个行动者: BB之后的人 (UTG)
    this.activePlayerIndex = this.findNextCanActFrom(bbIndex);

    // 如果只有2人: preflop时SB先行动(实际是BB后,但2人特殊)
    if (this.getActivePlayers().length === 2) {
      // heads-up: SB在preflop先行动
      this.activePlayerIndex = sbIndex;
    }

    // 启动计时器
    this.startTimer();

    return true;
  }

  // ===== 盲注 =====

  collectBlinds(sbIndex, bbIndex) {
    const sbPlayer = this.players[sbIndex];
    const bbPlayer = this.players[bbIndex];

    // 小盲
    const sbAmount = sbPlayer.bet(this.smallBlind);
    sbPlayer.hasActed = false; // 盲注不算"行动"

    // 大盲
    const bbAmount = bbPlayer.bet(this.bigBlind);
    bbPlayer.hasActed = false;
  }

  // ===== 找到下一个活跃/可行动的玩家（按座位号顺时针） =====

  findNextActiveFrom(index) {
    const seatedPlayers = this.getSeatedPlayers();
    if (seatedPlayers.length === 0) return -1;

    // 按座位号排序
    seatedPlayers.sort((a, b) => a.seatIndex - b.seatIndex);

    // 找到当前玩家的位置
    const currentIndex = seatedPlayers.findIndex(p => p.seatIndex === index);
    if (currentIndex === -1) return -1;

    // 从下一个位置开始顺时针查找
    for (let i = 1; i <= seatedPlayers.length; i++) {
      const nextIndex = (currentIndex + i) % seatedPlayers.length;
      const player = seatedPlayers[nextIndex];
      if (player && !player.folded && !player.sittingOut) {
        return player.seatIndex;
      }
    }
    return -1;
  }

  findNextCanActFrom(index) {
    const seatedPlayers = this.getSeatedPlayers();
    if (seatedPlayers.length === 0) return -1;

    // 按座位号排序
    seatedPlayers.sort((a, b) => a.seatIndex - b.seatIndex);

    // 找到当前玩家的位置
    const currentIndex = seatedPlayers.findIndex(p => p.seatIndex === index);
    if (currentIndex === -1) return -1;

    // 从下一个位置开始顺时针查找能行动的玩家
    for (let i = 1; i <= seatedPlayers.length; i++) {
      const nextIndex = (currentIndex + i) % seatedPlayers.length;
      const player = seatedPlayers[nextIndex];
      if (player && player.canAct()) {
        return player.seatIndex;
      }
    }
    return -1;
  }

  findNextActiveDealer() {
    // 从上一个庄家位置开始找下一个有筹码的玩家（按座位号顺时针）
    const seatedPlayers = this.getSeatedPlayers();
    if (seatedPlayers.length === 0) return 0;

    seatedPlayers.sort((a, b) => a.seatIndex - b.seatIndex);

    const currentIndex = seatedPlayers.findIndex(p => p.seatIndex === this.dealerIndex);

    for (let i = 1; i <= seatedPlayers.length; i++) {
      const nextIndex = (currentIndex + i) % seatedPlayers.length;
      const player = seatedPlayers[nextIndex];
      if (player && player.chips > 0 && !player.sittingOut) {
        return player.seatIndex;
      }
    }
    return 0;
  }

  // ===== 处理玩家行动 =====

  processAction(playerId, actionType, amount = 0) {
    const player = this.getPlayerById(playerId);
    if (!player) return { error: 'Player not found' };

    if (this.players[this.activePlayerIndex]?.id !== playerId) {
      return { error: 'Not your turn' };
    }

    if (player.folded || player.allIn) {
      return { error: 'Cannot act: folded or all-in' };
    }

    let betAmount = 0; // 记录本次行动的实际下注额（用于广播）

    switch (actionType) {
      case ACTIONS.FOLD:
        player.fold();
        break;

      case ACTIONS.CHECK:
        if (player.currentBet < this.getCurrentMaxBet()) {
          return { error: 'Cannot check: need to call or raise' };
        }
        player.lastAction = ACTIONS.CHECK;
        player.hasActed = true;
        break;

      case ACTIONS.CALL:
        const callAmount = this.getCurrentMaxBet() - player.currentBet;
        if (callAmount <= 0) {
          return { error: 'Nothing to call' };
        }
        player.bet(callAmount);
        player.lastAction = ACTIONS.CALL;
        player.hasActed = true;
        betAmount = callAmount;
        break;

      case ACTIONS.RAISE:
        const raiseTotal = amount; // 加注到的总额
        const currentMaxBet = this.getCurrentMaxBet();
        const raiseIncrement = raiseTotal - currentMaxBet;

        if (raiseIncrement < this.lastRaiseAmount && player.chips > raiseIncrement) {
          return { error: `Minimum raise is ${this.lastRaiseAmount}` };
        }

        const needed = raiseTotal - player.currentBet;
        if (needed > player.chips) {
          // 如果不够加注，就全下
          const allInAmt = player.goAllIn();
          betAmount = allInAmt;
        } else {
          player.bet(needed);
          player.lastAction = ACTIONS.RAISE;
          this.lastRaiseAmount = raiseIncrement;
          // 加注后，其他人的hasActed需要重置（他们需要重新行动）
          this.resetHasActedForOthers(playerId);
          betAmount = needed;
        }
        player.hasActed = true;
        break;

      case ACTIONS.ALLIN:
        const allInAmount = player.goAllIn();
        // 如果全下金额 >= 当前最高下注 + 上次加注量，视为加注
        if (player.currentBet >= this.getCurrentMaxBet() + this.lastRaiseAmount) {
          this.lastRaiseAmount = player.currentBet - this.getCurrentMaxBet();
          this.resetHasActedForOthers(playerId);
        }
        player.hasActed = true;
        betAmount = allInAmount;
        break;

      default:
        return { error: 'Unknown action' };
    }

    this.recalcPot();

    // 检查是否只剩一个活跃玩家（其他人全弃牌）
    if (this.getActivePlayers().length === 1) {
      this.endHandFoldWin();
      return { success: true, action: actionType, betAmount };
    }

    // 检查本轮是否结束
    if (this.isBettingRoundComplete()) {
      const prevStage = this.stage;
      this.advanceToNextStage();
      if (this.stage !== prevStage) {
        return { success: true, action: actionType, newStage: true, betAmount };
      }
    } else {
      // 移到下一个可行动的玩家
      this.activePlayerIndex = this.findNextCanActFrom(this.activePlayerIndex);
      // 启动计时器
      this.startTimer();
    }

    return { success: true, action: actionType, betAmount };
  }

  // ===== 下注轮逻辑 =====

  getCurrentMaxBet() {
    return Math.max(...this.getActivePlayers().map(p => p.currentBet), 0);
  }

  resetHasActedForOthers(exceptId) {
    for (const p of this.players) {
      if (p.id !== exceptId && p.canAct()) {
        p.hasActed = false;
      }
    }
  }

  isBettingRoundComplete() {
    const canActPlayers = this.getCanActPlayers();

    // 如果没人能行动了（全all-in或全弃牌），轮结束
    if (canActPlayers.length === 0) return true;

    // 所有可行动的玩家都行动过了，且下注额一致
    const allActed = canActPlayers.every(p => p.hasActed);
    const allEqualBet = canActPlayers.every(p => p.currentBet === this.getCurrentMaxBet());

    return allActed && allEqualBet;
  }

  // ===== 阶段推进 =====

  advanceToNextStage() {
    // 清除计时器
    this.stopTimer();

    // 重置本轮下注
    for (const p of this.players) {
      p.resetForNewRound();
    }

    switch (this.stage) {
      case STAGES.PREFLOP:
        this.stage = STAGES.FLOP;
        this.communityCards.push(...this.deck.dealMultiple(3));
        break;
      case STAGES.FLOP:
        this.stage = STAGES.TURN;
        this.communityCards.push(this.deck.deal());
        break;
      case STAGES.TURN:
        this.stage = STAGES.RIVER;
        this.communityCards.push(this.deck.deal());
        break;
      case STAGES.RIVER:
        this.stage = STAGES.SHOWDOWN;
        this.showdown();
        return; // showdown后不再分配行动者
    }

    this.lastRaiseAmount = this.bigBlind;

    // 检查是否只剩1个能行动的玩家且其他全all-in
    const canActPlayers = this.getCanActPlayers();
    if (canActPlayers.length <= 1 && this.getActivePlayers().length > 1) {
      // 只剩一人能行动，其他人全all-in
      // 直接发完所有公共牌进入showdown
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.deck.deal());
      }
      this.stage = STAGES.SHOWDOWN;
      this.showdown();
      return;
    }

    // flop/turn/river: 第一个行动者从庄家后第一个能行动的玩家开始
    this.activePlayerIndex = this.findNextCanActFrom(this.dealerIndex);

    // 如果没人能行动（全all-in），直接推到下一个阶段
    if (this.activePlayerIndex === -1 || canActPlayers.length === 0) {
      // 快速推进到showdown
      this.advanceToNextStage();
      return;
    }

    this.startTimer();
  }

  // ===== Showdown =====

  showdown() {
    this.stopTimer();
    this.handInProgress = false;

    const activePlayers = this.getActivePlayers();

    // 让所有活跃玩家亮牌
    for (const p of activePlayers) {
      p.showCards = true;
    }

    // 评估手牌
    const handResults = {};
    for (const player of activePlayers) {
      if (player.holeCards && this.communityCards.length >= 3) {
        const allCards = [...player.holeCards, ...this.communityCards];
        handResults[player.id] = evaluateBestHand(allCards);
      }
    }

    // 计算侧池
    this.sidePots = calculatePots(this.players);

    // 分配奖池
    this.winners = distributePots(this.sidePots, this.players, handResults);

    // 给赢家加筹码
    for (const w of this.winners) {
      const player = this.getPlayerById(w.playerId);
      if (player) {
        player.chips += w.amount;
      }
    }

    // 更新总池
    this.recalcPot();
  }

  // ===== 只剩一人未弃牌 =====

  endHandFoldWin() {
    this.stopTimer();
    this.handInProgress = false;

    const winner = this.getActivePlayers()[0];
    const totalPot = this.players.reduce((sum, p) => sum + p.totalBet, 0);

    // 设置所有未弃牌玩家的 showCards 为 true，让他们的手牌可见
    for (const p of this.getActivePlayers()) {
      p.showCards = true;
    }

    this.winners = [{
      playerId: winner.id,
      amount: totalPot,
      potIndex: 0,
      handResult: null,
    }];

    winner.chips += totalPot;
    winner.showCards = true; // 确保赢家也显示手牌

    this.stage = STAGES.SHOWDOWN;
  }

  // ===== 奖池计算 =====

  recalcPot() {
    this.pot = this.players.reduce((sum, p) => sum + p.totalBet, 0);
  }

  // ===== 计时器 =====

  // 注册计时器 tick 回调：每当倒计时 -1s 时调用（用于服务端广播 TIMER_TICK）
  setTimerTickCallback(cb) {
    this.timerTickCallback = cb;
  }

  // 注册超时弃牌回调：倒计时归零自动弃牌时调用（用于服务端广播 ACTION_RESULT）
  setTimeoutFoldCallback(cb) {
    this.timeoutFoldCallback = cb;
  }

  startTimer() {
    this.stopTimer();
    this.timer = ACTION_TIMEOUT;

    this.timerInterval = setInterval(() => {
      this.timer--;
      if (typeof this.timerTickCallback === 'function') {
        this.timerTickCallback(this.timer);
      }
      if (this.timer <= 0) {
        this.stopTimer();
        // 自动弃牌（超时）
        const player = this.players[this.activePlayerIndex];
        if (player && player.canAct()) {
          this.processAction(player.id, ACTIONS.FOLD);
          // 通知上层广播超时弃牌事件
          if (typeof this.timeoutFoldCallback === 'function') {
            this.timeoutFoldCallback(player.id);
          }
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timer = 0;
  }

  // ===== 获取行动信息 =====

  getTurnInfo(playerId) {
    const player = this.getPlayerById(playerId);
    if (!player || !player.canAct()) return null;

    const currentMaxBet = this.getCurrentMaxBet();
    const callAmount = currentMaxBet - player.currentBet;
    const canCheck = callAmount === 0;
    const canCall = callAmount > 0 && player.chips >= callAmount;
    const raiseMin = currentMaxBet + this.lastRaiseAmount;
    const raiseMax = player.currentBet + player.chips;

    return {
      timeLeft: this.timer,
      minRaise: this.lastRaiseAmount,
      canCheck,
      canCall,
      callAmount,
      raiseMin: raiseMin <= raiseMax ? raiseMin : 0,
      raiseMax: raiseMax > currentMaxBet ? raiseMax : 0,
    };
  }

  // ===== 获取游戏状态（广播给所有客户端） =====

  getState() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => p.getPublicInfo()),
      communityCards: this.communityCards,
      pot: this.pot,
      sidePots: this.sidePots,
      stage: this.stage,
      activePlayerIndex: this.activePlayerIndex,
      dealerIndex: this.dealerIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      minRaise: this.lastRaiseAmount,
      handNumber: this.handNumber,
      timer: this.timer,
      winners: this.winners,
    };
  }

  // ===== 获取私密信息（只发给特定玩家） =====

  getPrivateCards(playerId) {
    const player = this.getPlayerById(playerId);
    if (!player || !player.holeCards) return [];
    return player.holeCards;
  }

  // ===== 手局结束清理 =====

  endHand() {
    this.stopTimer();
    this.handInProgress = false;
  }
}

module.exports = GameEngine;