// src/preload/preload.ts

const { contextBridge, ipcRenderer } = require('electron');

// Type declaration for global window object
declare global {
  interface Window {
    scribeCat: {
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: (audioData: ArrayBuffer, duration: number) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
        pause: () => Promise<{ success: boolean; error?: string }>;
        resume: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
      };
      // TODO: Add type declarations when features are implemented
      // files?: { ... };
      // themes?: { ... };
      // ai?: { ... };
      // canvas?: { ... };
    };
  }
}

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

// Export to make this a module
export {};
