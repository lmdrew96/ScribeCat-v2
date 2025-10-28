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
    assemblyai: {
      getToken: (apiKey: string) => ipcRenderer.invoke('transcription:assemblyai:getToken', apiKey)
    }
  },
  settings: {
    getSimulationMode: () => ipcRenderer.invoke('settings:get-simulation-mode'),
    setSimulationMode: (enabled: boolean) => ipcRenderer.invoke('settings:set-simulation-mode', enabled)
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value)
  },
  ai: {
    chat: (message: string, history: any[], options?: any) => 
      ipcRenderer.invoke('ai:chat', message, history, options),
    chatStream: (message: string, history: any[], options: any, onChunk: (chunk: string) => void) => {
      // Set up listener for chunks
      ipcRenderer.on('ai:chatChunk', (_event: any, chunk: string) => onChunk(chunk));
      // Start the stream
      return ipcRenderer.invoke('ai:chatStream', message, history, options);
    },
    removeChatStreamListener: () => {
      ipcRenderer.removeAllListeners('ai:chatChunk');
    },
    polishTranscription: (text: string, options?: any) => 
      ipcRenderer.invoke('ai:polishTranscription', text, options),
    generateSummary: (transcription: string, notes?: string, options?: any) => 
      ipcRenderer.invoke('ai:generateSummary', transcription, notes, options),
    generateTitle: (transcription: string, notes?: string, options?: any) => 
      ipcRenderer.invoke('ai:generateTitle', transcription, notes, options),
    isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    setApiKey: (apiKey: string) => ipcRenderer.invoke('ai:setApiKey', apiKey)
  }
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
  // canvas: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
