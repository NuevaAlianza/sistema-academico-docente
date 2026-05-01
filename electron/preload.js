'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (canal, ...args) => ipcRenderer.invoke(canal, ...args)
});