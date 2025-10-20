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
  },
  transcription: {
    simulation: {
      start: () => ipcRenderer.invoke('transcription:simulation:start'),
      stop: (sessionId: string) => ipcRenderer.invoke('transcription:simulation:stop', sessionId),
      onResult: (callback: (result: any) => void) => {
        ipcRenderer.on('transcription:result', (_event: any, result: any) => callback(result));
      },
      removeResultListener: () => {
        ipcRenderer.removeAllListeners('transcription:result');
      }
    }
  },
  settings: {
    getSimulationMode: () => ipcRenderer.invoke('settings:get-simulation-mode'),
    setSimulationMode: (enabled: boolean) => ipcRenderer.invoke('settings:set-simulation-mode', enabled)
  }
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
  // ai: { ... }
  // canvas: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
