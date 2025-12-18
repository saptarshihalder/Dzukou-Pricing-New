// Preload script for Electron
// This runs in a sandboxed environment with access to both Node.js and browser APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => process.versions.electron,
  getPlatform: () => process.platform,

  // IPC communication (for future features)
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ['app:minimize', 'app:maximize', 'app:close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['app:update-available', 'app:error'];
    if (validChannels.includes(channel)) {
      // Strip event to avoid leaking ipcRenderer
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});

// Log that preload script has run
console.log('Electron preload script loaded');
