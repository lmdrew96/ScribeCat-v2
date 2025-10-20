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
    },
    vosk: {
      startServer: (modelPath: string, port?: number) => ipcRenderer.invoke('vosk:server:start', modelPath, port),
      stopServer: () => ipcRenderer.invoke('vosk:server:stop'),
      isServerRunning: () => ipcRenderer.invoke('vosk:server:isRunning'),
      model: {
        isInstalled: () => ipcRenderer.invoke('vosk:model:isInstalled'),
        getPath: () => ipcRenderer.invoke('vosk:model:getPath'),
        download: () => ipcRenderer.invoke('vosk:model:download'),
        delete: () => ipcRenderer.invoke('vosk:model:delete'),
        onDownloadProgress: (callback: (progress: any) => void) => {
          ipcRenderer.on('vosk:model:downloadProgress', (_event: any, progress: any) => callback(progress));
        },
        removeDownloadProgressListener: () => {
          ipcRenderer.removeAllListeners('vosk:model:downloadProgress');
        }
      }
    }
  },
  settings: {
    getSimulationMode: () => ipcRenderer.invoke('settings:get-simulation-mode'),
    setSimulationMode: (enabled: boolean) => ipcRenderer.invoke('settings:set-simulation-mode', enabled)
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value)
  }
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
  // ai: { ... }
  // canvas: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
