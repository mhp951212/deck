/**
 * 侧池计算模块
 * 处理多人 All-in 时的奖池分配
 */

/**
 * 计算侧池
 * @param {Player[]} players - 所有参与本局的玩家（包含已弃牌但仍有下注的）
 * @returns {SidePot[]} 侧池数组，索引0为主池
 */
function calculatePots(players) {
  // 收集所有活跃玩家的totalBet（弃牌玩家的下注也归入池中）
  const activePlayers = players.filter(p => !p.folded);

  // 如果只剩1个活跃玩家，所有池归他
  if (activePlayers.length <= 1) {
    const totalBet = players.reduce((sum, p) => sum + p.totalBet, 0);
    return [{
      amount: totalBet,
      eligiblePlayerIds: activePlayers.map(p => p.id),
    }];
  }

  // 获取所有不同的all-in金额级别（包含0为未all-in的玩家）
  const betLevels = [];
  const seen = new Set();

  // 按totalBet升序排列活跃玩家
  const sortedBets = activePlayers
    .map(p => p.totalBet)
    .sort((a, b) => a - b);

  for (const bet of sortedBets) {
    if (!seen.has(bet)) {
      seen.add(bet);
      betLevels.push(bet);
    }
  }

  // 计算每个级别的侧池
  const pots = [];
  let prevLevel = 0;

  for (const level of betLevels) {
    if (level === 0) continue; // 0级别的玩家没有下注

    // 此级别的池：每个玩家在prevLevel到level之间的贡献
    let potAmount = 0;
    const eligibleIds = [];

    for (const player of players) {
      // 所有玩家（含弃牌）都可能向此池贡献
      const contribution = Math.min(player.totalBet, level) - Math.min(player.totalBet, prevLevel);
      potAmount += contribution;

      // 只有totalBet >= level且未弃牌的玩家有资格赢此池
      if (!player.folded && player.totalBet >= level) {
        eligibleIds.push(player.id);
      }
    }

    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayerIds: eligibleIds,
      });
    }

    prevLevel = level;
  }

  // 如果有玩家下注超过最高all-in级别（未all-in的玩家多余下注）
  const maxAllInLevel = sortedBets[sortedBets.length - 1];
  const remainingPlayers = activePlayers.filter(p => p.totalBet > maxAllInLevel || !p.allIn);

  if (remainingPlayers.length > 0 && prevLevel < maxAllInLevel) {
    // 已经在最后一个级别处理了
  }

  // 确保至少有一个池
  if (pots.length === 0) {
    const totalBet = players.reduce((sum, p) => sum + p.totalBet, 0);
    return [{
      amount: totalBet,
      eligiblePlayerIds: activePlayers.map(p => p.id),
    }];
  }

  return pots;
}

/**
 * 根据侧池计算赢家分配
 * @param {SidePot[]} pots - 侧池数组
 * @param {Player[]} players - 所有玩家
 * @param {Object} handResults - 每个玩家的手牌评估结果 { playerId: handResult }
 * @returns {Winner[]} 赢家分配数组
 */
function distributePots(pots, players, handResults) {
  const winners = [];

  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];
    const eligible = players.filter(p => pot.eligiblePlayerIds.includes(p.id));

    if (eligible.length === 1) {
      // 只有一个有资格的玩家，直接赢得此池
      winners.push({
        playerId: eligible[0].id,
        amount: pot.amount,
        potIndex,
        handResult: handResults[eligible[0].id] || null,
      });
      continue;
    }

    // 多人有资格，比较手牌
    let bestHand = null;
    let bestPlayers = [];

    for (const player of eligible) {
      const hand = handResults[player.id];
      if (!hand) continue;

      if (!bestHand) {
        bestHand = hand;
        bestPlayers = [player];
      } else {
        const cmp = compareHandValues(hand, bestHand);
        if (cmp > 0) {
          bestHand = hand;
          bestPlayers = [player];
        } else if (cmp === 0) {
          bestPlayers.push(player);
        }
      }
    }

    // 如果平局，均分
    if (bestPlayers.length > 0) {
      const share = Math.floor(pot.amount / bestPlayers.length);
      const remainder = pot.amount - share * bestPlayers.length;

      bestPlayers.forEach((player, i) => {
        winners.push({
          playerId: player.id,
          amount: share + (i === 0 ? remainder : 0), // 余数给第一个赢家
          potIndex,
          handResult: handResults[player.id] || null,
        });
      });
    }
  }

  return winners;
}

function compareHandValues(hand1, hand2) {
  if (hand1.rank !== hand2.rank) return hand1.rank - hand2.rank;
  for (let i = 0; i < Math.min(hand1.values.length, hand2.values.length); i++) {
    if (hand1.values[i] !== hand2.values[i]) return hand1.values[i] - hand2.values[i];
  }
  return 0;
}

module.exports = {
  calculatePots,
  distributePots,
};