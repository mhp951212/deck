// 前后端共享的 Socket.IO 事件名定义

module.exports = {
  // 客户端 → 服务端
  CLIENT: {
    JOIN_SERVER:     'join_server',
    CREATE_ROOM:     'create_room',
    JOIN_ROOM:       'join_room',
    LEAVE_ROOM:      'leave_room',
    SIT_DOWN:        'sit_down',
    STAND_UP:        'stand_up',
    ACTION:          'action',
    START_GAME:      'start_game',
    START_NEXT_HAND: 'start_next_hand',
    READY:           'ready',
    CHAT:            'chat',
    REQUEST_ROOM_LIST: 'request_room_list',
    BUY_CHIPS:       'buy_chips',      // 玩家购买筹码
    SETTLEMENT_READY: 'settlement_ready', // 结算面板点击准备
    BUY_CHIPS_SETTLEMENT: 'buy_chips_settlement', // 结算面板购买筹码
    REQUEST_ROOM_SETTLEMENT: 'request_room_settlement', // 请求房间结算
    FLIRT: 'flirt', // 发骚按钮
  },

  // 服务端 → 客户端
  SERVER: {
    SERVER_JOINED:       'server_joined',
    ROOM_LIST:           'room_list',
    ROOM_CREATED:        'room_created',
    ROOM_JOINED:         'room_joined',
    ROOM_LEFT:           'room_left',
    GAME_STATE:          'game_state',
    YOUR_CARDS:          'your_cards',
    YOUR_TURN:           'your_turn',
    ACTION_RESULT:       'action_result',
    SHOWDOWN_RESULT:     'showdown_result',
    NEXT_HAND:           'next_hand',
    PLAYER_JOINED:       'player_joined',
    PLAYER_LEFT:         'player_left',
    PLAYER_DISCONNECTED: 'player_disconnected',
    PLAYER_RECONNECTED:  'player_reconnected',
    ERROR:               'error',
    SIT_DOWN_ERROR:      'sit_down_error',
    CHAT_MESSAGE:        'chat_message',
    LAN_SERVERS:         'lan_servers',
    TIMER_TICK:          'timer_tick',
    NEED_CHIPS:          'need_chips',          // 广播某玩家筹码为0的提示
    BUY_CHIPS_PROMPT:    'buy_chips_prompt',    // 给筹码为0的玩家推送购买按钮
    CHIPS_BOUGHT:        'chips_bought',        // 广播筹码购买成功
    PLAYER_RAN:          'player_ran',           // 广播玩家跑路
    SETTLEMENT_READY_UPDATE: 'settlement_ready_update', // 广播结算准备状态更新
    NEW_HAND_STARTED:    'new_hand_started',    // 广播新一局开始
    ROOM_SETTLEMENT_RESULT: 'room_settlement_result', // 房间结算结果
    ROOM_SETTLEMENT_COUNTDOWN: 'room_settlement_countdown', // 房间结算倒计时
    ROOM_DISSOLVED:      'room_dissolved',      // 房间解散
    DEALER_QUOTE:        'dealer_quote',        // 荷官骚话（加注/全下时）
    FLIRT_QUOTE:         'flirt_quote',         // 荷官发骚话（点击发骚按钮时）
  }
};