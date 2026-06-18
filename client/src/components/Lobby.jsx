import React, { useState, useEffect } from "react";
import useGameStore from "../store/gameStore";
import useSocket from "../hooks/useSocket";
import EVENTS from "@shared/events";
const { CLIENT } = EVENTS;
import "../styles/lobby.css";

export default function Lobby() {
  const { playerName, roomList, lanServers, localIp, serverPort } =
    useGameStore();
  const socket = useSocket();
  const [nameInput, setNameInput] = useState(playerName || "");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [initialChips, setInitialChips] = useState(1000);
  const [error, setError] = useState("");

  // 大厅修改昵称相关状态
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifyInput, setModifyInput] = useState("");

  // 从服务器读取已保存的昵称（根据本机IP），自动填充输入框
  useEffect(() => {
    // 当回到注册界面时（playerName 为空），重新从服务器读取
    if (playerName) return;

    const fetchSavedName = async () => {
      try {
        const nameRes = await fetch('/api/nickname');
        const { nickname } = await nameRes.json();
        if (nickname) {
          setNameInput(nickname);
        }
      } catch (e) {
        // 忽略错误
      }
    };
    fetchSavedName();
  }, [playerName]);

  // 注册到服务器
  const handleJoinServer = async () => {
    if (!nameInput.trim()) {
      setError("请输入昵称");
      return;
    }
    const name = nameInput.trim();
    socket.emit(CLIENT.JOIN_SERVER, { name });
    useGameStore.getState().setPlayerName(name);

    // 同时保存到服务器（服务端会自动从请求中获取客户端IP）
    try {
      await fetch('/api/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: name }),
      });
    } catch (e) {
      // 忽略错误
    }

    setError("");
  };

  // 创建房间
  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      setError("请输入房间名");
      return;
    }
    socket.emit(CLIENT.CREATE_ROOM, {
      name: roomName.trim(),
      smallBlind,
      bigBlind,
      maxPlayers,
      initialChips,
    });
    setCreatingRoom(false);
    setError("");
  };

  // 加入房间
  const handleJoinRoom = (roomId) => {
    socket.emit(CLIENT.JOIN_ROOM, { roomId });
  };

  // 刷新房间列表
  const handleRefresh = () => {
    socket.emit(CLIENT.REQUEST_ROOM_LIST);
  };

  // 保存修改的昵称
  const handleSaveNickname = async () => {
    if (!modifyInput.trim()) {
      setError("昵称不能为空");
      return;
    }
    const name = modifyInput.trim();

    // 保存到服务器（服务端会自动从请求中获取客户端IP）
    try {
      await fetch('/api/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: name }),
      });

      // 更新 store 中的 playerName
      useGameStore.getState().setPlayerName(name);

      // 重新向服务器注册
      socket.emit(CLIENT.JOIN_SERVER, { name });

      setShowModifyInput(false);
      setModifyInput("");
      setError("");
    } catch (e) {
      setError("保存失败，请重试");
    }
  };

  // 如果还没注册名字，显示注册界面
  if (!playerName) {
    return (
      <div className="lobby-container lobby-center">
        <div className="lobby-card">
          <h1 className="lobby-title">🃏 LAN Poker</h1>
          <p className="lobby-subtitle">人人四条A</p>
          <div className="lobby-form">
            <label>输入你的昵称(不超过6个字符)</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="昵称"
              maxLength={6}
              className="lobby-input"
            />
            {error && <p className="lobby-error">{error}</p>}
            <button className="lobby-btn primary" onClick={handleJoinServer}>
              进入大厅
            </button>
          </div>
          <p className="lobby-info">
            服务器地址: {localIp || "localhost"}:{serverPort}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container lobby-top">
      <div className="lobby-inner">
        <div className="lobby-header">
          <h1>🃏 LAN Poker 大厅</h1>
          <div className="lobby-user-info">
            <span>昵称: {playerName}</span>
            {!showModifyInput && (
              <button className="lobby-btn secondary" onClick={() => setShowModifyInput(true)}>
                修改昵称
              </button>
            )}
            {showModifyInput && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={modifyInput}
                  onChange={(e) => setModifyInput(e.target.value)}
                  placeholder="新昵称"
                  maxLength={6}
                  style={{ width: '150px' }}
                />
                <button className="lobby-btn primary" onClick={handleSaveNickname}>
                  保存
                </button>
                <button className="lobby-btn secondary" onClick={() => {
                  setShowModifyInput(false);
                  setModifyInput("");
                }}>
                  取消
                </button>
              </div>
            )}
            <span>
              服务器: {localIp || "localhost"}:{serverPort}
            </span>
          </div>
        </div>

        {/* LAN发现的其它服务器 */}
        {lanServers.length > 0 && (
          <div className="lan-servers">
            <h3>局域网服务器</h3>
            {lanServers.map((server, i) => (
              <div key={i} className="lan-server-item">
                <span>
                  {server.ip}:{server.port}
                </span>
                <span>{server.rooms} 个房间</span>
              </div>
            ))}
          </div>
        )}

        {/* 房间列表 */}
        <div className="room-list">
          <div className="room-list-header">
            <h2>房间列表</h2>
            <div className="room-list-actions">
              <button className="lobby-btn" onClick={handleRefresh}>
                刷新
              </button>
              <button
                className="lobby-btn primary"
                onClick={() => setCreatingRoom(true)}
              >
                创建房间
              </button>
            </div>
          </div>

          {roomList.length === 0 ? (
            <p className="room-empty">暂无房间，创建一个吧！</p>
          ) : (
            <div className="room-grid">
              {roomList.map((room) => (
                <div key={room.roomId} className="room-card">
                  <div className="room-card-header">
                    <h3>{room.name}</h3>
                    {room.inProgress && (
                      <span className="room-badge playing">游戏中</span>
                    )}
                    {!room.inProgress && (
                      <span className="room-badge waiting">等待中</span>
                    )}
                  </div>
                  <div className="room-card-body">
                    <p>
                      玩家: {room.playerCount}/{room.maxPlayers}
                    </p>
                    <p>
                      盲注: {room.smallBlind}/{room.bigBlind}
                    </p>
                  </div>
                  <button
                    className="lobby-btn primary"
                    onClick={() => handleJoinRoom(room.roomId)}
                    disabled={room.playerCount >= room.maxPlayers}
                  >
                    {room.playerCount >= room.maxPlayers ? "已满" : "加入"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 创建房间弹窗 */}
        {creatingRoom && (
          <div className="modal-overlay" onClick={() => setCreatingRoom(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>创建新房间</h2>
              <div className="lobby-form">
                <label>房间名称</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="房间名"
                  maxLength={20}
                  className="lobby-input"
                />
                <label>小盲注</label>
                <input
                  type="number"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(Number(e.target.value))}
                  className="lobby-input"
                  min={1}
                />
                <label>大盲注</label>
                <input
                  type="number"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  className="lobby-input"
                  min={smallBlind}
                />
                <label>最大玩家数</label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="lobby-input"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <label>初始筹码</label>
                <input
                  type="number"
                  value={initialChips}
                  onChange={(e) =>
                    setInitialChips(Math.max(1, Number(e.target.value)))
                  }
                  className="lobby-input"
                  min={1}
                  step={100}
                />
                {error && <p className="lobby-error">{error}</p>}
                <button
                  className="lobby-btn primary"
                  onClick={handleCreateRoom}
                >
                  创建
                </button>
                <button
                  className="lobby-btn"
                  onClick={() => setCreatingRoom(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
