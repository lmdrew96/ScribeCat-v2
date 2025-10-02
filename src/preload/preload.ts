// src/preload/preload.ts
// Type declarations are in preload.d.ts

const { contextBridge, ipcRenderer } = require('electron');

// Expose the API to the renderer process
const electronAPI = {
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: (audioData: ArrayBuffer, duration: number) => ipcRenderer.invoke('recording:stop', audioData, duration),
    pause: () => ipcRenderer.invoke('recording:pause'),
    resume: () => ipcRenderer.invoke('recording:resume'),
    getStatus: () => ipcRenderer.invoke('recording:getStatus')
  }
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
  // ai: { ... }
  // canvas: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
