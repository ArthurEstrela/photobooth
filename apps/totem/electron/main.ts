// apps/totem/electron/main.ts

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import Store from 'electron-store';
import { initDatabase, savePhotoOffline, IOfflinePhoto } from './database';
import { startSyncEngine } from './sync-engine';

let mainWindow: BrowserWindow | null = null;

interface BoothStore {
  boothId: string;
  boothToken: string;
}
const store = new Store<BoothStore>();

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load production or dev build
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 1. Initialize SQLite on app ready
app.whenReady().then(() => {
  initDatabase();
  startSyncEngine();
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 2. IPC Handlers: Offline Save
ipcMain.on('save-offline-photo', (event, data: { sessionId: string; photoBase64: string }) => {
  try {
    const record: IOfflinePhoto = {
      sessionId: data.sessionId,
      photoBase64: data.photoBase64,
      status: 'PENDING',
    };
    savePhotoOffline(record);
    console.log(`Photo saved offline for session: ${data.sessionId}`);
  } catch (error) {
    console.error('Failed to save offline photo:', error);
  }
});

// 3. IPC Handlers: Silent Print
ipcMain.on('print-photo', (_event, _photoUrl: string) => {
  if (mainWindow) {
    mainWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: '',
    }, (success, errorType) => {
      if (!success) console.error('Printing failed:', errorType);
    });
  }
});

// 4. IPC Handlers: List Printers
ipcMain.handle('get-printers', () => {
  return mainWindow ? mainWindow.webContents.getPrinters() : [];
});

// IPC Handlers: Booth credentials (electron-store)
ipcMain.handle('store-get-credentials', () => {
  const boothId = store.get('boothId');
  const boothToken = store.get('boothToken');
  if (!boothId || !boothToken) return null;
  return { boothId, boothToken };
});

ipcMain.handle('store-set-credentials', (_event, data: BoothStore) => {
  if (!data?.boothId || !data?.boothToken) return;
  store.set('boothId', data.boothId);
  store.set('boothToken', data.boothToken);
});

ipcMain.handle('store-clear-credentials', () => {
  store.delete('boothId');
  store.delete('boothToken');
});
