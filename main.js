'use strict';

const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { LedgerStore } = require('./src/ledger');

let mainWindow = null;
let store = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: '黑马记账',
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('ledger:list-records', (_event, filter) => store.listRecords(filter || {}));
  ipcMain.handle('ledger:add-record', (_event, input) => store.addRecord(input));
  ipcMain.handle('ledger:update-record', (_event, id, input) => store.updateRecord(id, input));
  ipcMain.handle('ledger:delete-record', (_event, id) => store.deleteRecord(id));
  ipcMain.handle('ledger:list-categories', () => store.listCategories());
  ipcMain.handle('ledger:add-category', (_event, input) => store.addCategory(input));
  ipcMain.handle('ledger:rename-category', (_event, input) => store.renameCategory(input));
  ipcMain.handle('ledger:set-category-enabled', (_event, input) => {
    return store.setCategoryEnabled(input);
  });
  ipcMain.handle('ledger:get-path', () => store.filePath);
}

app.setName('黑马记账');

app.whenReady().then(async () => {
  try {
    store = new LedgerStore(path.join(app.getPath('userData'), 'ledger.json'));
    await store.init();
  } catch (error) {
    dialog.showErrorBox('黑马记账', `无法读取本地账单数据：${error.message}`);
    app.quit();
    return;
  }
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
