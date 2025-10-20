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
  },
  audio: {
    saveFile: (audioData: number[], fileName: string, folderPath: string) => 
      ipcRenderer.invoke('audio:save-file', audioData, fileName, folderPath)
  }
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
  // ai: { ... }
  // canvas: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
