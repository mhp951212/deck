const { DEFAULT_CHIPS, ACTIONS } = require('../../../shared/constants');

class Player {
  constructor(id, name, initialChips = DEFAULT_CHIPS) {
    this.id = id;
    this.name = name;
    this.seatIndex = -1;      // -1 表示未坐下（旁观）
    this.chips = initialChips;
    this.holeCards = null;
    this.currentBet = 0;      // 当前下注轮的下注额
    this.totalBet = 0;        // 本局总下注额
    this.folded = false;
    this.allIn = false;
    this.isDealer = false;
    this.isSB = false;
    this.isBB = false;
    this.connected = true;
    this.lastAction = null;
    this.showCards = false;
    this.hasActed = false;    // 本轮是否已行动
    this.sittingOut = false;  // 是否坐出（下一局不参与）
    this.joinedDuringHand = false;  // 是否中途加入（游戏进行中才加入）
  }

  // 新一局开始时重置
  resetForNewHand() {
    this.holeCards = null;
    this.currentBet = 0;
    this.totalBet = 0;
    this.folded = false;
    this.allIn = false;
    this.isDealer = false;
    this.isSB = false;
    this.isBB = false;
    this.lastAction = null;
    this.showCards = false;
    this.hasActed = false;
    this.sittingOut = false;
  }

  // 新一轮下注开始时重置
  resetForNewRound() {
    this.currentBet = 0;
    this.hasActed = false;
    this.lastAction = null;
  }

  // 下注
  bet(amount) {
    const actualAmount = Math.min(amount, this.chips);
    this.chips -= actualAmount;
    this.currentBet += actualAmount;
    this.totalBet += actualAmount;

    if (this.chips === 0) {
      this.allIn = true;
    }

    return actualAmount;
  }

  // 弃牌
  fold() {
    this.folded = true;
    this.lastAction = ACTIONS.FOLD;
  }

  // 全下
  goAllIn() {
    const amount = this.chips;
    this.bet(amount);
    this.allIn = true;
    this.lastAction = ACTIONS.ALLIN;
    return amount;
  }

  // 是否活跃（未弃牌且有筹码或已all-in）
  isActive() {
    return !this.folded && (this.chips > 0 || this.allIn);
  }

  // 是否可行动（未弃牌、未全下、有筹码）
  canAct() {
    return !this.folded && !this.allIn && this.chips > 0;
  }

  // 获取公开信息（不含手牌）
  getPublicInfo() {
    return {
      id: this.id,
      name: this.name,
      seatIndex: this.seatIndex,
      chips: this.chips,
      holeCards: this.showCards ? this.holeCards : null,
      currentBet: this.currentBet,
      totalBet: this.totalBet,
      folded: this.folded,
      allIn: this.allIn,
      isDealer: this.isDealer,
      isSB: this.isSB,
      isBB: this.isBB,
      connected: this.connected,
      lastAction: this.lastAction,
      showCards: this.showCards,
      joinedDuringHand: this.joinedDuringHand || false,
    };
  }
}

module.exports = Player;