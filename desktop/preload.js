const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("balanceApp", {
  restartAgent: () => ipcRenderer.invoke("agent:restart")
});
