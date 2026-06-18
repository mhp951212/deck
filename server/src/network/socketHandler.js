const { RoomManager } = require('../rooms/roomManager');
const { ACTIONS, STAGES, SERVER_PORT, DEFAULT_CHIPS } = require('../../../shared/constants');
const { CLIENT, SERVER } = require('../../../shared/events');
const { getRandomQuote } = require('../game/dealerQuotes');
const { getRandomFlirtQuote } = require('../game/flirtQuotes');

/**
 * 归一化 IP 地址
 * - 去除 ::ffff: 前缀（IPv4-mapped IPv6）
 * - 去除端口后缀（如 192.168.1.5:12345）
 */
function normalizeIP(raw) {
  if (!raw) return 'unknown';
  let ip = raw;
  // 去掉 IPv4-mapped IPv6 前缀
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // 去掉端口后缀（某些环境 socket.handshake.address 会带端口）
  if (ip.includes(':') && !ip.includes('::')) {
    // 是 IPv4:port 格式
    ip = ip.split(':')[0];
  }
  return ip || 'unknown';
}

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.roomManager = new RoomManager();
    this.playerNames = new Map(); // socketId -> name
    this.playerIPs = new Map();   // socketId -> ip
    this.playerRooms = new Map(); // socketId -> roomId
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // ===== 加入服务器 =====
      socket.on(CLIENT.JOIN_SERVER, (data) => {
        const name = data.name || `Player_${socket.id.slice(0, 4)}`;
        const ip = normalizeIP(socket.handshake.address);
        this.playerNames.set(socket.id, name);
        this.playerIPs.set(socket.id, ip);

        socket.emit(SERVER.SERVER_JOINED, {
          playerId: socket.id,
          name: name,
        });

        // 发送房间列表
        socket.emit(SERVER.ROOM_LIST, {
          rooms: this.roomManager.getRoomList(),
        });

        console.log(`Player ${name} joined server (${socket.id}, IP: ${ip})`);
      });

      // ===== 请求房间列表 =====
      socket.on(CLIENT.REQUEST_ROOM_LIST, () => {
        socket.emit(SERVER.ROOM_LIST, {
          rooms: this.roomManager.getRoomList(),
        });
      });

      // ===== 创建房间 =====
      socket.on(CLIENT.CREATE_ROOM, (data) => {
        const name = this.playerNames.get(socket.id);
        const hostIp = normalizeIP(socket.handshake.address);

        const room = this.roomManager.createRoom(
          data.name || `${name}的房间`,
          socket.id,
          data.smallBlind || 10,
          data.bigBlind || 20,
          data.maxPlayers || 9,
          data.initialChips || 1000,
          hostIp,
          SERVER_PORT
        );

        // 自动加入房间
        this.playerRooms.set(socket.id, room.id);
        this.roomManager.joinRoom(room.id, socket.id, name);
        socket.join(room.id);

        socket.emit(SERVER.ROOM_CREATED, {
          room: room.toRoomInfo(),
          isCreator: true,
        });

        // 创建者自动坐下（座位0）
        this.roomManager.sitDown(room.id, socket.id, 0);
        this.broadcastGameState(room.id);

        // 广播房间列表更新
        this.broadcastRoomList();
      });

      // ===== 加入房间 =====
      socket.on(CLIENT.JOIN_ROOM, (data) => {
        const name = this.playerNames.get(socket.id);
        const result = this.roomManager.joinRoom(data.roomId, socket.id, name);

        if (result.error) {
          socket.emit(SERVER.ERROR, { message: result.error });
          return;
        }

        this.playerRooms.set(socket.id, data.roomId);
        socket.join(data.roomId);

        const room = result.room;
        socket.emit(SERVER.ROOM_JOINED, {
          room: room.toRoomInfo(),
          isCreator: room.creatorId === socket.id,
        });

        // 通知房间内其他玩家
        socket.to(data.roomId).emit(SERVER.PLAYER_JOINED, {
          playerId: socket.id,
          name: name,
        });

        // 广播房间列表更新
        this.broadcastRoomList();

        // 立即向新玩家推送当前游戏状态（含已坐下玩家信息）
        this.broadcastGameState(data.roomId);
      });

      // ===== 离开房间 =====
      socket.on(CLIENT.LEAVE_ROOM, () => {
        this.handleLeaveRoom(socket);
      });

      // ===== 坐下 =====
      socket.on(CLIENT.SIT_DOWN, (data) => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        const name = this.playerNames.get(socket.id);
        const ip = this.playerIPs.get(socket.id);

        // 检查座位是否已被占用
        for (const [pid, info] of room.players) {
          if (info.seated && info.seatIndex === data.seatIndex) {
            socket.emit(SERVER.SIT_DOWN_ERROR, { message: '座位已有人' });
            return;
          }
        }

        // 检查昵称是否重复（不能和已坐下的人重名）
        for (const [pid, info] of room.players) {
          if (pid !== socket.id && info.seated && info.name === name) {
            socket.emit(SERVER.SIT_DOWN_ERROR, { message: '昵称已存在' });
            return;
          }
        }

        // 检查 IP 是否重复（不能和已坐下的人同IP）
        for (const [pid, info] of room.players) {
          if (pid !== socket.id && info.seated) {
            const otherIp = this.playerIPs.get(pid);
            if (otherIp && ip && otherIp === ip) {
              socket.emit(SERVER.SIT_DOWN_ERROR, { message: '该 IP 已在游戏中' });
              return;
            }
          }
        }

        const success = this.roomManager.sitDown(roomId, socket.id, data.seatIndex);
        if (success) {
          // 广播更新
          this.broadcastGameState(roomId);
        } else {
          socket.emit(SERVER.SIT_DOWN_ERROR, { message: '无法坐下' });
        }
      });

      // ===== 站起 =====
      socket.on(CLIENT.STAND_UP, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const success = this.roomManager.standUp(roomId, socket.id);
        if (success) {
          const room = this.roomManager.getRoom(roomId);
          this.broadcastGameState(roomId);
        }
      });

      // ===== 开始游戏 =====
      socket.on(CLIENT.START_GAME, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        // 只有房主才能开始游戏
        if (room.creatorId !== socket.id) {
          socket.emit(SERVER.ERROR, { message: '只有房主才能开始游戏' });
          return;
        }

        const success = this.roomManager.startGame(roomId, socket.id);
        if (success) {
          // 发送手牌给每个玩家
          this.sendPrivateCards(roomId);
          // 广播游戏状态
          this.broadcastGameState(roomId);
          // 通知当前行动者
          this.notifyActivePlayer(roomId);
          // 广播房间列表更新（标记游戏中）
          this.broadcastRoomList();
        } else {
          socket.emit(SERVER.ERROR, { message: '无法开始游戏（需要至少2个已坐下的玩家）' });
        }
      });

      // ===== 开始下一局 =====
      socket.on(CLIENT.START_NEXT_HAND, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        // 只有房主才能开始下一局
        if (room.creatorId !== socket.id) {
          socket.emit(SERVER.ERROR, { message: '只有房主才能开始下一局' });
          return;
        }

        this.checkBrokePlayersAndStart(roomId);
      });

      // ===== 购买筹码 =====
      socket.on(CLIENT.BUY_CHIPS, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        const result = room.buyChips(socket.id);
        if (!result.success) {
          if (result.alreadyBought) {
            socket.emit(SERVER.ERROR, { message: '每次结算只能购买一次筹码' });
          }
          return;
        }

        const playerName = this.playerNames.get(socket.id);
        // 广播购买成功
        this.io.to(roomId).emit(SERVER.CHIPS_BOUGHT, {
          playerId: socket.id,
          name: playerName,
          amount: result.amount,
          newChips: result.newChips,
          buyCount: room.buyChipsRecord.get(socket.id) || 0,
          isInitialBuy: result.isInitialBuy || false,
        });
        // 通知该玩家按钮已消失（已购买）
        socket.emit(SERVER.BUY_CHIPS_PROMPT, { canBuy: false });
      });

      // ===== 结算面板准备 =====
      socket.on(CLIENT.SETTLEMENT_READY, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room || !room.engine) return;

        // 标记玩家已准备
        room.settlementReady.add(socket.id);

        // 获取所有坐下玩家的信息
        const seatedPlayers = room.engine.getSeatedPlayers();
        const readyCount = room.settlementReady.size;
        const totalPlayers = seatedPlayers.length;

        // 构建每个玩家的准备状态
        const readyPlayers = seatedPlayers.map(player => ({
          id: player.id,
          name: player.name,
          ready: room.settlementReady.has(player.id)
        }));

        // 广播准备状态更新 - 包含每个玩家的详细信息
        this.io.to(roomId).emit(SERVER.SETTLEMENT_READY_UPDATE, {
          readyCount,
          totalPlayers,
          readyPlayers,
        });

        // 检查是否所有人都准备好了
        if (readyCount === totalPlayers) {
          // 清空准备状态
          room.settlementReady.clear();

          // 开始新一局
          this.startNextHand(roomId);

          // 广播新一局开始
          this.io.to(roomId).emit(SERVER.NEW_HAND_STARTED, {});
        }
      });

      // ===== 结算面板购买筹码 =====
      socket.on(CLIENT.BUY_CHIPS_SETTLEMENT, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        const result = room.buyChips(socket.id);
        if (!result.success) {
          socket.emit(SERVER.ERROR, { message: '购买筹码失败' });
          return;
        }

        const playerName = this.playerNames.get(socket.id);
        // 广播购买成功
        this.io.to(roomId).emit(SERVER.CHIPS_BOUGHT, {
          playerId: socket.id,
          name: playerName,
          amount: result.amount,
          newChips: result.newChips,
          buyCount: room.buyChipsRecord.get(socket.id) || 0,
          isInitialBuy: result.isInitialBuy || false,
        });
        // 广播游戏状态更新，让客户端知道筹码变了
        this.broadcastGameState(roomId);
      });

      // ===== 请求房间结算 =====
      socket.on(CLIENT.REQUEST_ROOM_SETTLEMENT, () => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room) return;

        // 只有房主才能发起房间结算
        if (room.creatorId !== socket.id) {
          socket.emit(SERVER.ERROR, { message: '只有房主才能发起房间结算' });
          return;
        }

        // 获取结算数据
        const settlementData = room.getRoomSettlement();

        // 广播结算结果给所有玩家
        this.io.to(roomId).emit(SERVER.ROOM_SETTLEMENT_RESULT, {
          players: settlementData,
        });

        // 启动 30s 倒计时
        let countdown = 30;
        this.io.to(roomId).emit(SERVER.ROOM_SETTLEMENT_COUNTDOWN, { countdown });

        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            this.io.to(roomId).emit(SERVER.ROOM_SETTLEMENT_COUNTDOWN, { countdown });
          } else {
            // 倒计时结束，解散房间
            clearInterval(countdownInterval);
            this.dissolveRoom(roomId);
          }
        }, 1000);
      });

      // ===== 游戏行动 =====
      socket.on(CLIENT.ACTION, (data) => {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const room = this.roomManager.getRoom(roomId);
        if (!room || !room.engine) return;

        const result = room.engine.processAction(socket.id, data.type, data.amount);

        if (result.error) {
          socket.emit(SERVER.ERROR, { message: result.error });
          return;
        }

        // 广播行动结果
        this.io.to(roomId).emit(SERVER.ACTION_RESULT, {
          playerId: socket.id,
          action: data.type,
          amount: result.betAmount || 0,
        });

        // 如果是加注或全下，触发荷官骚话（所有玩家看到同一句话）
        if (data.type === ACTIONS.RAISE || data.type === ACTIONS.ALLIN) {
          const playerName = this.playerNames.get(socket.id);
          const quote = getRandomQuote(data.type);
          this.io.to(roomId).emit(SERVER.DEALER_QUOTE, {
            playerId: socket.id,
            playerName: playerName,
            quote: quote,
          });
        }

        // 广播游戏状态
        this.broadcastGameState(roomId);

        // 如果是showdown，发送结果
        if (room.engine.stage === STAGES.SHOWDOWN) {
          this.io.to(roomId).emit(SERVER.SHOWDOWN_RESULT, {
            winners: room.engine.winners,
          });
          // 广播初始结算准备状态（0/N 已准备）
          const seatedPlayers = room.engine.getSeatedPlayers();
          const seatedCount = seatedPlayers.length;
          room.settlementReady.clear();
          const readyPlayers = seatedPlayers.map(player => ({
            id: player.id,
            name: player.name,
            ready: false,
          }));
          this.io.to(roomId).emit(SERVER.SETTLEMENT_READY_UPDATE, {
            readyCount: 0,
            totalPlayers: seatedCount,
            readyPlayers,
          });
        } else if (room.engine.handInProgress) {
          // 通知下一个行动者
          this.notifyActivePlayer(roomId);
          // 发送私密手牌（确保所有人都收到）
          this.sendPrivateCards(roomId);
        }
      });

      // ===== 聊天 =====
      socket.on(CLIENT.CHAT, (data) => {
        const roomId = this.playerRooms.get(socket.id);
        const name = this.playerNames.get(socket.id);

        if (roomId) {
          this.io.to(roomId).emit(SERVER.CHAT_MESSAGE, {
            playerId: socket.id,
            name: name,
            message: data.message,
            timestamp: Date.now(),
          });
        }
      });

      // ===== 发骚 =====
      socket.on(CLIENT.FLIRT, () => {
        const roomId = this.playerRooms.get(socket.id);
        const playerName = this.playerNames.get(socket.id);

        if (roomId) {
          const quote = getRandomFlirtQuote();
          this.io.to(roomId).emit(SERVER.FLIRT_QUOTE, {
            playerId: socket.id,
            playerName: playerName,
            quote: quote,
            timestamp: Date.now(),
          });
        }
      });

      // ===== 断开连接 =====
      socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        this.handleDisconnect(socket);
      });
    });
  }

  // ===== 辅助方法 =====

  handleLeaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.roomManager.getRoom(roomId);
    const playerName = this.playerNames.get(socket.id);

    if (room && room.engine) {
      // 游戏进行中：标记玩家断线而不是移除
      const player = room.engine.getPlayerById(socket.id);
      if (player) {
        player.connected = false;
      }
    }

    this.roomManager.leaveRoom(roomId, socket.id);
    this.playerRooms.delete(socket.id);
    socket.leave(roomId);

    socket.emit(SERVER.ROOM_LEFT, {});

    // 广播跑路消息给房间剩余玩家
    socket.to(roomId).emit(SERVER.PLAYER_RAN, {
      name: playerName || '某玩家',
    });
    socket.to(roomId).emit(SERVER.PLAYER_LEFT, {
      playerId: socket.id,
    });

    // 如果房间还存在，广播最新游戏状态（含新的 creatorId）
    if (this.roomManager.getRoom(roomId)) {
      this.broadcastGameState(roomId);
    }

    this.broadcastRoomList();
  }

  handleDisconnect(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) {
      this.playerNames.delete(socket.id);
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (room && room.engine && room.inProgress) {
      // 游戏进行中：保留座位，标记断线
      const player = room.engine.getPlayerById(socket.id);
      if (player) {
        player.connected = false;
        // 如果是当前行动者，自动弃牌
        if (room.engine.activePlayerIndex >= 0 &&
            room.engine.players[room.engine.activePlayerIndex]?.id === socket.id) {
          room.engine.processAction(socket.id, ACTIONS.FOLD);
          this.broadcastGameState(roomId);
        }
      }
    } else {
      // 游戏未开始：直接移除
      this.roomManager.leaveRoom(roomId, socket.id);
    }

    this.io.to(roomId).emit(SERVER.PLAYER_DISCONNECTED, {
      playerId: socket.id,
    });

    this.playerNames.delete(socket.id);
    this.playerRooms.delete(socket.id);
    this.broadcastRoomList();
  }

  broadcastGameState(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.engine) {
      // 游戏未开始，从 room.players 构建已坐下玩家列表（等待界面需要显示）
      const waitingPlayers = [];
      if (room) {
        for (const [playerId, info] of room.players) {
          if (info.seated) {
            waitingPlayers.push({
              id: playerId,
              name: info.name,
              seatIndex: info.seatIndex,
              chips: room.initialChips,
              holeCards: null,
              currentBet: 0,
              totalBet: 0,
              folded: false,
              allIn: false,
              isDealer: false,
              isSB: false,
              isBB: false,
              connected: true,
              lastAction: null,
              showCards: false,
              isCreator: playerId === room.creatorId,
              joinedDuringHand: info.joinedDuringHand || false,
            });
          }
        }
      }
      this.io.to(roomId).emit(SERVER.GAME_STATE, {
        state: {
          roomId: roomId,
          creatorId: room?.creatorId || null,
          players: waitingPlayers,
          communityCards: [],
          pot: 0,
          sidePots: [],
          stage: STAGES.WAITING,
          activePlayerIndex: -1,
          dealerIndex: 0,
          smallBlind: room?.smallBlind || 10,
          bigBlind: room?.bigBlind || 20,
          minRaise: 0,
          handNumber: 0,
          timer: 0,
          winners: null,
        },
      });
      return;
    }

    const state = room.engine.getState();
    // 注入 creatorId 和每个玩家的 isCreator 标记
    state.creatorId = room.creatorId;
    if (state.players) {
      for (const p of state.players) {
        p.isCreator = p.id === room.creatorId;
      }
    }
    this.io.to(roomId).emit(SERVER.GAME_STATE, { state });
  }

  sendPrivateCards(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.engine) return;

    for (const player of room.engine.players) {
      const cards = room.engine.getPrivateCards(player.id);
      if (cards.length > 0) {
        this.io.to(player.id).emit(SERVER.YOUR_CARDS, { cards });
      }
    }
  }

  notifyActivePlayer(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.engine) return;

    const activeIdx = room.engine.activePlayerIndex;
    if (activeIdx < 0 || activeIdx >= room.engine.players.length) return;

    const activePlayer = room.engine.players[activeIdx];
    if (!activePlayer) return;

    const turnInfo = room.engine.getTurnInfo(activePlayer.id);
    if (turnInfo) {
      // 注册 timer tick 回调，每秒广播给所有玩家
      room.engine.setTimerTickCallback((timeLeft) => {
        this.io.to(roomId).emit(SERVER.TIMER_TICK, { timeLeft });
      });
      // 注册超时自动弃牌回调：广播行动结果、更新游戏状态、通知下一个玩家
      room.engine.setTimeoutFoldCallback((playerId) => {
        this.io.to(roomId).emit(SERVER.ACTION_RESULT, {
          playerId,
          action: ACTIONS.FOLD,
          amount: 0,
        });
        this.broadcastGameState(roomId);

        // 如果还没到 showdown 或结束，继续推进游戏
        if (room.engine.handInProgress) {
          this.notifyActivePlayer(roomId);
          this.sendPrivateCards(roomId);
        }
      });
      // 通知当前玩家行动
      this.io.to(activePlayer.id).emit(SERVER.YOUR_TURN, turnInfo);
    }
  }

  // 检查是否有筹码为0的玩家，有则推送提示，否则直接开始下一局
  checkBrokePlayersAndStart(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.engine) return;

    const brokePlayers = room.getBrokePlayers();
    if (brokePlayers.length > 0) {
      // 广播提示给所有人
      const names = brokePlayers.map(p => p.name).join('、');
      this.io.to(roomId).emit(SERVER.NEED_CHIPS, {
        message: `${names} 筹码为0，需要购买筹码`,
        brokePlayers: brokePlayers.map(p => p.id),
      });

      // 给筹码为0且还未购买过的玩家推送购买按钮
      for (const bp of brokePlayers) {
        const canBuy = !room.hasBoughtChips(bp.id);
        this.io.to(bp.id).emit(SERVER.BUY_CHIPS_PROMPT, { canBuy });
      }
      // 不立即开始，等玩家操作后房主再次点击，或所有人都处理完后自动开始
      // 此处直接继续开始（筹码0的玩家将无法参与本局）
      this.startNextHand(roomId);
    } else {
      this.startNextHand(roomId);
    }
  }

  startNextHand(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.engine) return;

    // 清除中途加入标记（新一局开始）、重置购买记录
    room.clearJoinedDuringHandFlags();

    // 检查是否还有足够的活跃玩家
    const seated = room.engine.getSeatedPlayers();
    const withChips = seated.filter(p => p.chips > 0);

    if (withChips.length < 2) {
      room.inProgress = false;
      this.broadcastGameState(roomId);
      this.broadcastRoomList();
      return;
    }

    // 结束当前局
    room.engine.endHand();

    // 开始新一局
    const success = room.engine.startHand();
    if (success) {
      this.sendPrivateCards(roomId);
      this.broadcastGameState(roomId);
      this.notifyActivePlayer(roomId);
    } else {
      room.inProgress = false;
      this.broadcastGameState(roomId);
      this.broadcastRoomList();
    }
  }

  broadcastRoomList() {
    this.io.emit(SERVER.ROOM_LIST, {
      rooms: this.roomManager.getRoomList(),
    });
  }

  // 解散房间：踢出所有玩家，删除房间
  dissolveRoom(roomId) {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // 广播房间解散
    this.io.to(roomId).emit(SERVER.ROOM_DISSOLVED, {});

    // 踢出所有玩家
    for (const [playerId] of room.players) {
      const socket = this.io.sockets.sockets.get(playerId);
      if (socket) {
        socket.leave(roomId);
        this.playerRooms.delete(playerId);
      }
    }

    // 删除房间
    this.roomManager.rooms.delete(roomId);

    // 广播房间列表更新
    this.broadcastRoomList();
  }
}

module.exports = SocketHandler;