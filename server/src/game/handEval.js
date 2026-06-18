const { HAND_RANKS, HAND_RANK_NAMES } = require('../../../shared/constants');

/**
 * 从7张牌中选出最佳5张手牌
 * 生成所有 C(7,5) = 21 种组合，评估每种，返回最好的
 */
function evaluateBestHand(cards) {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }

  // 如果恰好5张，直接评估
  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  // 生成所有5张牌的组合
  const combos = generateCombinations(cards, 5);
  let bestResult = null;

  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (!bestResult || compareHands(result, bestResult) > 0) {
      bestResult = result;
    }
  }

  return bestResult;
}

/**
 * 生成从n个元素中选k个的所有组合
 */
function generateCombinations(arr, k) {
  const results = [];
  const n = arr.length;

  function backtrack(start, current) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return results;
}

/**
 * 评估5张牌的手牌等级
 * 返回 { rank: number, values: number[], name: string }
 * rank: 1-10 (高牌到皇家同花顺)
 * values: 用于同等级比较的数值数组（降序）
 */
function evaluateFiveCards(cards) {
  // 按rank降序排列
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  // 统计每个rank出现的次数
  const rankCounts = {};
  for (const r of ranks) {
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  // 检查是否为同花（所有牌花色相同）
  const isFlush = suits.every(s => s === suits[0]);

  // 检查是否为顺子
  let isStraight = false;
  let straightHigh = 0;

  // 正常顺子: 5张连续
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }

  // 特殊顺子: A-2-3-4-5 (Wheel)
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5; // Wheel的最高牌是5
  }

  // 分类rank频次
  const quads = [];  // 四条
  const trips = [];  // 三条
  const pairs = [];  // 对子
  const singles = []; // 单牌

  for (const [rank, count] of Object.entries(rankCounts)) {
    const r = Number(rank);
    if (count === 4) quads.push(r);
    else if (count === 3) trips.push(r);
    else if (count === 2) pairs.push(r);
    else singles.push(r);
  }

  // 降序排列
  quads.sort((a, b) => b - a);
  trips.sort((a, b) => b - a);
  pairs.sort((a, b) => b - a);
  singles.sort((a, b) => b - a);

  // 判断手牌类型
  // 皇家同花顺 / 同花顺
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: HAND_RANKS.ROYAL_FLUSH, values: [14], name: HAND_RANK_NAMES[HAND_RANKS.ROYAL_FLUSH] };
    }
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, values: [straightHigh], name: HAND_RANK_NAMES[HAND_RANKS.STRAIGHT_FLUSH] };
  }

  // 四条
  if (quads.length === 1) {
    return {
      rank: HAND_RANKS.FOUR_OF_A_KIND,
      values: [quads[0], ...singles],
      name: HAND_RANK_NAMES[HAND_RANKS.FOUR_OF_A_KIND],
    };
  }

  // 满堂红 (三条 + 对子)
  if (trips.length === 1 && pairs.length === 1) {
    return {
      rank: HAND_RANKS.FULL_HOUSE,
      values: [trips[0], pairs[0]],
      name: HAND_RANK_NAMES[HAND_RANKS.FULL_HOUSE],
    };
  }

  // 同花
  if (isFlush) {
    return {
      rank: HAND_RANKS.FLUSH,
      values: ranks,
      name: HAND_RANK_NAMES[HAND_RANKS.FLUSH],
    };
  }

  // 顺子
  if (isStraight) {
    return {
      rank: HAND_RANKS.STRAIGHT,
      values: [straightHigh],
      name: HAND_RANK_NAMES[HAND_RANKS.STRAIGHT],
    };
  }

  // 三条
  if (trips.length === 1) {
    return {
      rank: HAND_RANKS.THREE_OF_A_KIND,
      values: [trips[0], ...singles],
      name: HAND_RANK_NAMES[HAND_RANKS.THREE_OF_A_KIND],
    };
  }

  // 两对
  if (pairs.length === 2) {
    return {
      rank: HAND_RANKS.TWO_PAIR,
      values: [pairs[0], pairs[1], ...singles],
      name: HAND_RANK_NAMES[HAND_RANKS.TWO_PAIR],
    };
  }

  // 一对
  if (pairs.length === 1) {
    return {
      rank: HAND_RANKS.ONE_PAIR,
      values: [pairs[0], ...singles],
      name: HAND_RANK_NAMES[HAND_RANKS.ONE_PAIR],
    };
  }

  // 高牌
  return {
    rank: HAND_RANKS.HIGH_CARD,
    values: ranks,
    name: HAND_RANK_NAMES[HAND_RANKS.HIGH_CARD],
  };
}

/**
 * 比较两个手牌结果
 * 返回: 1 = hand1胜, -1 = hand2胜, 0 = 平局
 */
function compareHands(hand1, hand2) {
  // 先比较等级
  if (hand1.rank !== hand2.rank) {
    return hand1.rank - hand2.rank;
  }

  // 同等级，逐项比较values
  for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
    if (hand1.values[i] !== hand2.values[i]) {
      return hand1.values[i] - hand2.values[i];
    }
  }

  return 0; // 完全平局
}

module.exports = {
  evaluateBestHand,
  evaluateFiveCards,
  compareHands,
};