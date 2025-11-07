import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { startTaskServer } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';

let mainWindow;
let serverContext;

async function ensureServerStarted() {
  if (serverContext) {
    return serverContext;
  }

  const dataDir = app.getPath('userData');
  serverContext = await startTaskServer({ dataDir, port: 0 });
  const apiBaseUrl = `http://localhost:${serverContext.port}/api`;
  serverContext.apiBaseUrl = apiBaseUrl;
  process.env.VITE_API_BASE_URL = apiBaseUrl;
  return serverContext;
}

async function createMainWindow() {
  await ensureServerStarted();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    await mainWindow.loadFile(indexHtml);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady()
  .then(createMainWindow)
  .catch((error) => {
    console.error('Failed to create main window', error);
    app.quit();
  });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      console.error('Failed to recreate main window', error);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverContext?.server) {
    serverContext.server.close();
  }
});
