const { app, BrowserWindow, screen, globalShortcut } = require('electron');
const path = require('node:path');

// 원래 창(380x560)의 절반 정도 넓이 - 진짜 윈도우 알림 패널처럼 작고 눈에 안 띄게.
const WINDOW_WIDTH = 280;
const WINDOW_HEIGHT = 400;
const MARGIN = 12;
const PANIC_SHORTCUT = 'CommandOrControl+Shift+H';
const QUIT_SHORTCUT = 'CommandOrControl+Shift+Q';

let mainWindow = null;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WINDOW_WIDTH - MARGIN;
  const y = workArea.y + workArea.height - WINDOW_HEIGHT - MARGIN;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // 패닉 키: 상사가 지나갈 때 한 번에 숨기고, 다시 눌러 돌아온다.
  globalShortcut.register(PANIC_SHORTCUT, () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // 완전 종료 키 - 창이 frameless/taskbar 없음이라 닫을 방법이 단축키/우측 상단 × 뿐이다.
  globalShortcut.register(QUIT_SHORTCUT, () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
