const { v4: uuidv4 } = require('uuid');
const GameEngine = require('../game/engine');
const { MAX_PLAYERS, DEFAULT_SMALL_BLIND, DEFAULT_BIG_BLIND } = require('../../../shared/constants');

class Room {
  constructor(id, name, creatorId, smallBlind, bigBlind, maxPlayers, initialChips, hostIp, hostPort) {
    this.id = id;
    this.name = name;
    this.creatorId = creatorId;
    this.smallBlind = smallBlind || DEFAULT_SMALL_BLIND;
    this.bigBlind = bigBlind || DEFAULT_BIG_BLIND;
    this.maxPlayers = maxPlayers || MAX_PLAYERS;
    this.initialChips = initialChips || DEFAULT_CHIPS;
    this.hostIp = hostIp;
    this.hostPort = hostPort;
    this.players = new Map(); // playerId -> { name, seated, seatIndex, joinedDuringHand }
    this.engine = null;       // GameEngine instance (null until game starts)
    this.inProgress = false;
    this.createdAt = Date.now();
    // 购买筹码记录：playerId -> 已购买次数（每局游戏结算时限购1次）
    this.buyChipsRecord = new Map();
    // 累计再购买记录（整个房间生命周期，不会被每局清空）：playerId -> 累计购买次数
    this.totalRebuyRecord = new Map();
    // 结算准备状态：playerId -> boolean (是否点击了准备按钮)
    this.settlementReady = new Set();
  }

  addPlayer(playerId, playerName) {
    if (this.players.size >= this.maxPlayers) return false;
    // 已在房间则不覆盖（防止重复加入时用 undefined 覆盖名字）
    if (this.players.has(playerId)) return true;
    if (!playerName) return false;
    this.players.set(playerId, {
      name: playerName,
      seated: false,
      seatIndex: -1,
      joinedDuringHand: this.inProgress, // 如果游戏进行中加入，标记为中途加入
      hasBoughtInitialChips: false,       // 中途加入玩家是否已购买本金
    });
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    // 同时从引擎中移除玩家
    if (this.engine) {
      this.engine.removePlayer(playerId);
    }
    // 如果创建者离开，转移给第一个在房间的玩家
    if (playerId === this.creatorId && this.players.size > 0) {
      this.creatorId = this.players.keys().next().value;
    }
  }

  sitDown(playerId, seatIndex) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) return false;

    // 检查座位是否已被占用
    for (const [id, info] of this.players) {
      if (info.seated && info.seatIndex === seatIndex) {
        return false; // 座位已占
      }
    }

    playerInfo.seated = true;
    playerInfo.seatIndex = seatIndex;

    // 如果引擎存在，也添加到引擎
    if (this.engine) {
      const existingPlayer = this.engine.getPlayerById(playerId);
      if (!existingPlayer) {
        this.engine.addPlayer(playerId, playerInfo.name, seatIndex);
      }
    }

    return true;
  }

  // 新一局开始时，清除中途加入标记，同时重置购买筹码记录
  clearJoinedDuringHandFlags() {
    for (const [playerId, info] of this.players) {
      info.joinedDuringHand = false;
      info.hasBoughtInitialChips = false;
    }
    this.buyChipsRecord.clear();
  }

  // 玩家购买筹码（每次结算限购一次）
  // 中途加入的玩家第一次购买算本金，不记录再购买
  // 返回：{ success, alreadyBought, amount, isInitialBuy }
  buyChips(playerId) {
    const playerInfo = this.players.get(playerId);

    // 中途加入且尚未购买本金的玩家：第一次购买算本金，不记录再购买
    if (playerInfo && playerInfo.joinedDuringHand && !playerInfo.hasBoughtInitialChips) {
      if (!this.engine) return { success: false };

      let player = this.engine.getPlayerById(playerId);

      if (!player && playerInfo) {
        this.engine.addPlayer(playerId, playerInfo.name, playerInfo.seatIndex);
        player = this.engine.getPlayerById(playerId);
      }

      if (!player) return { success: false };

      const amount = this.initialChips;
      player.chips += amount;
      playerInfo.hasBoughtInitialChips = true; // 标记已购买本金
      return { success: true, amount, newChips: player.chips, isInitialBuy: true };
    }

    // 非中途加入玩家 或 中途加入已购本金的玩家：正常再购买流程
    const alreadyBought = this.buyChipsRecord.get(playerId) || 0;
    if (alreadyBought > 0) return { success: false, alreadyBought: true };

    if (!this.engine) return { success: false };

    let player = this.engine.getPlayerById(playerId);

    if (!player && playerInfo) {
      this.engine.addPlayer(playerId, playerInfo.name, playerInfo.seatIndex);
      player = this.engine.getPlayerById(playerId);
    }

    if (!player) return { success: false };

    const amount = this.initialChips;
    player.chips += amount;
    const rebuyCount = (this.buyChipsRecord.get(playerId) || 0) + 1;
    this.buyChipsRecord.set(playerId, rebuyCount);
    this.totalRebuyRecord.set(playerId, (this.totalRebuyRecord.get(playerId) || 0) + 1);
    return { success: true, amount, newChips: player.chips, isInitialBuy: false };
  }

  // 检查筹码为0的玩家（返回 [{id, name}]）
  getBrokePlayers() {
    if (!this.engine) return [];
    return this.engine.getSeatedPlayers()
      .filter(p => p.chips <= 0)
      .map(p => ({ id: p.id, name: p.name }));
  }

  // 某玩家是否已购买过筹码（本轮结算周期内）
  hasBoughtChips(playerId) {
    return (this.buyChipsRecord.get(playerId) || 0) > 0;
  }

  // 获取房间结算数据：计算每个玩家的总投入和盈亏
  // 总投入 = 本金次数 × initialChips
  // 盈亏 = 当前筹码 - 总投入
  getRoomSettlement() {
    const players = [];

    for (const [playerId, info] of this.players) {
      if (!info.seated) continue; // 只统计坐下的玩家

      let currentChips = 0;
      if (this.engine) {
        const enginePlayer = this.engine.getPlayerById(playerId);
        if (enginePlayer) {
          currentChips = enginePlayer.chips;
        }
      }

      // 计算总投入：本金 + 累计再购买
      let totalInvestment = this.initialChips; // 本金

      // 累计再购买记录（整个房间生命周期）
      const totalRebuyCount = this.totalRebuyRecord.get(playerId) || 0;
      totalInvestment += totalRebuyCount * this.initialChips;

      // 中途加入玩家买了本金
      if (info.hasBoughtInitialChips) {
        totalInvestment += this.initialChips;
      }

      const profit = currentChips - totalInvestment;

      players.push({
        id: playerId,
        name: info.name,
        currentChips,
        totalInvestment,
        profit,
      });
    }

    // 按盈亏从大到小排序
    players.sort((a, b) => b.profit - a.profit);

    return players;
  }

  standUp(playerId) {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo || !playerInfo.seated) return false;

    // 游戏进行中不能站起
    if (this.inProgress) return false;

    playerInfo.seated = false;
    playerInfo.seatIndex = -1;

    if (this.engine) {
      this.engine.removePlayer(playerId);
    }

    return true;
  }

  startGame(creatorId) {
    if (creatorId !== this.creatorId) return false;

    const seatedPlayers = [...this.players.values()].filter(p => p.seated);
    if (seatedPlayers.length < 2) return false;

    // 创建游戏引擎，传入初始筹码
    this.engine = new GameEngine(this.id, this.smallBlind, this.bigBlind, this.initialChips);

    // 添加所有已坐下的玩家到引擎
    for (const [playerId, info] of this.players) {
      if (info.seated) {
        this.engine.addPlayer(playerId, info.name);
      }
    }

    // 排序玩家按座位索引
    this.engine.players.sort((a, b) => a.seatIndex - b.seatIndex);

    // 开始第一局
    this.engine.startHand();
    this.inProgress = true;

    return true;
  }

  getSeatedPlayerCount() {
    let count = 0;
    for (const info of this.players.values()) {
      if (info.seated) count++;
    }
    return count;
  }

  getPlayerCount() {
    return this.players.size;
  }

  toRoomInfo() {
    return {
      roomId: this.id,
      name: this.name,
      playerCount: this.getSeatedPlayerCount(),
      maxPlayers: this.maxPlayers,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      initialChips: this.initialChips,
      creatorId: this.creatorId,
      inProgress: this.inProgress,
      hostIp: this.hostIp,
      hostPort: this.hostPort,
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  createRoom(name, creatorId, smallBlind, bigBlind, maxPlayers, initialChips, hostIp, hostPort) {
    const roomId = uuidv4();
    const room = new Room(roomId, name, creatorId, smallBlind, bigBlind, maxPlayers, initialChips, hostIp, hostPort);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    if (!room.addPlayer(playerId, playerName)) {
      return { error: 'Room is full' };
    }

    return { success: true, room };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(playerId);

    // 如果房间空了，删除房间
    if (room.getPlayerCount() === 0) {
      this.rooms.delete(roomId);
    }
  }

  getRoomList() {
    return [...this.rooms.values()].map(room => room.toRoomInfo());
  }

  sitDown(roomId, playerId, seatIndex) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.sitDown(playerId, seatIndex);
  }

  standUp(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.standUp(playerId);
  }

  startGame(roomId, creatorId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return room.startGame(creatorId);
  }
}

module.exports = { Room, RoomManager };