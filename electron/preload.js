'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (canal, ...args) => ipcRenderer.invoke(canal, ...args),
  on: (canal, cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on(canal, handler)
    return () => ipcRenderer.removeListener(canal, handler)
  },
});