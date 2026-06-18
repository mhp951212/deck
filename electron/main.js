const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { SERVER_PORT } = require("../shared/constants");

let mainWindow = null;
let serverStarted = false;

async function startServer() {
  try {
    const { startServer } = require("../server/src/app");
    startServer();
    serverStarted = true;
  } catch (err) {
    console.error("Failed to start server:", err);
    // 如果require方式失败，用fork方式
    const { fork } = require("child_process");
    const serverPath = path.join(__dirname, "../server/src/app.js");
    const child = fork(serverPath);
    serverStarted = true;

    child.on("error", (err) => {
      console.error("Server process error:", err);
    });

    child.on("exit", (code) => {
      console.log(`Server process exited with code ${code}`);
      serverStarted = false;
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "逍遥情缘",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../client/public/poker-icon.svg"),
  });

  // 加载客户端页面
  if (serverStarted) {
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  } else {
    // 如果服务器还没启动，等一下再加载
    setTimeout(() => {
      mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    }, 2000);
  }

  // 开发时打开DevTools
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const menuTemplate = [
    {
      label: "游戏",
      submenu: [
        {
          label: "新建房间",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("menu-new-room");
            }
          },
        },
        { type: "separator" },
        {
          label: "退出",
          accelerator: "CmdOrCtrl+Q",
          role: "quit",
        },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于逍遥情缘",
          click: () => {
            const { dialog } = require("electron");
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "关于逍遥情缘",
              message:
                "逍遥情缘 v1.0\n逍遥情缘\n\n其他玩家可通过浏览器访问本机IP加入游戏",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// Electron 生命周期
app.whenReady().then(async () => {
  // 先启动服务器
  await startServer();

  // 等待服务器就绪
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 创建窗口
  createWindow();
  buildMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // 停止服务器
  try {
    const { stopServer } = require("../server/src/app");
    stopServer();
  } catch (e) {
    // ignore
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    const { stopServer } = require("../server/src/app");
    stopServer();
  } catch (e) {
    // ignore
  }
});
