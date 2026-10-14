const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tro', {
  invoke: (ch, data) => ipcRenderer.invoke(ch, data),
  send: (ch, data) => ipcRenderer.send(ch, data),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, d) => fn(d))
});
