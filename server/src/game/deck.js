const { SUITS, RANKS } = require('../../../shared/constants');

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  // 重置并洗牌
  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({
          suit,
          rank,
          id: `${rank}_${suit}`,
        });
      }
    }
    this.shuffle();
  }

  // Fisher-Yates 洗牌算法
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  // 发一张牌
  deal() {
    if (this.cards.length === 0) {
      throw new Error('No cards left in deck');
    }
    return this.cards.pop();
  }

  // 发多张牌
  dealMultiple(count) {
    const dealt = [];
    for (let i = 0; i < count; i++) {
      dealt.push(this.deal());
    }
    return dealt;
  }

  // 剩余牌数
  remaining() {
    return this.cards.length;
  }
}

module.exports = Deck;