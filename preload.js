'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledgerAPI', {
  listRecords: (filter) => ipcRenderer.invoke('ledger:list-records', filter),
  addRecord: (input) => ipcRenderer.invoke('ledger:add-record', input),
  updateRecord: (id, input) => ipcRenderer.invoke('ledger:update-record', id, input),
  deleteRecord: (id) => ipcRenderer.invoke('ledger:delete-record', id),
  listCategories: () => ipcRenderer.invoke('ledger:list-categories'),
  addCategory: (data) => ipcRenderer.invoke('ledger:add-category', data),
  renameCategory: (data) => ipcRenderer.invoke('ledger:rename-category', data),
  setCategoryEnabled: (data) => ipcRenderer.invoke('ledger:set-category-enabled', data),
  getDataPath: () => ipcRenderer.invoke('ledger:get-path')
});
