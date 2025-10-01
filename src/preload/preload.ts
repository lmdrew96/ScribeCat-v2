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
        onAudioLevel: (callback: (level: number) => void) => void;
      };
      files: {
        save: (data: any) => Promise<void>;
        load: (filename: string) => Promise<any>;
        list: () => Promise<string[]>;
      };
      themes: {
        getAvailable: () => Promise<string[]>;
        setActive: (themeId: string) => Promise<void>;
        getActive: () => Promise<string>;
      };
      ai: {
        enhanceTranscription: (text: string) => Promise<string>;
        generateSummary: (notes: string) => Promise<string>;
        createStudyAids: (content: string) => Promise<any[]>;
      };
      canvas: {
        importCourses: () => Promise<any[]>;
        linkToAssignment: (recordingId: string, assignmentId: string) => Promise<void>;
        exportToCanvas: (sessionId: string, assignmentId: string) => Promise<void>;
      };
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
    getStatus: () => ipcRenderer.invoke('recording:getStatus'),
    onAudioLevel: (callback: (level: number) => void) => {
      ipcRenderer.on('recording:audioLevel', (_: any, level: number) => callback(level));
    }
  },
  files: {
    save: (data: any) => ipcRenderer.invoke('files:save', data),
    load: (filename: string) => ipcRenderer.invoke('files:load', filename),
    list: () => ipcRenderer.invoke('files:list')
  },
  themes: {
    getAvailable: () => ipcRenderer.invoke('themes:available'),
    setActive: (themeId: string) => ipcRenderer.invoke('themes:set', themeId),
    getActive: () => ipcRenderer.invoke('themes:active')
  },
  ai: {
    enhanceTranscription: (text: string) => ipcRenderer.invoke('ai:enhance', text),
    generateSummary: (notes: string) => ipcRenderer.invoke('ai:summarize', notes),
    createStudyAids: (content: string) => ipcRenderer.invoke('ai:studyAids', content)
  },
  canvas: {
    importCourses: () => ipcRenderer.invoke('canvas:import'),
    linkToAssignment: (recordingId: string, assignmentId: string) => ipcRenderer.invoke('canvas:link', recordingId, assignmentId),
    exportToCanvas: (sessionId: string, assignmentId: string) => ipcRenderer.invoke('canvas:export', sessionId, assignmentId)
  }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);

// Export to make this a module
export {};
