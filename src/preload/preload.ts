import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface ElectronAPI {
  recording: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
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
}

// Expose the API to the renderer process
const electronAPI: ElectronAPI = {
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: () => ipcRenderer.invoke('recording:stop'),
    pause: () => ipcRenderer.invoke('recording:pause'),
    resume: () => ipcRenderer.invoke('recording:resume')
  },
  files: {
    save: (data) => ipcRenderer.invoke('files:save', data),
    load: (filename) => ipcRenderer.invoke('files:load', filename),
    list: () => ipcRenderer.invoke('files:list')
  },
  themes: {
    getAvailable: () => ipcRenderer.invoke('themes:available'),
    setActive: (themeId) => ipcRenderer.invoke('themes:set', themeId),
    getActive: () => ipcRenderer.invoke('themes:active')
  },
  ai: {
    enhanceTranscription: (text) => ipcRenderer.invoke('ai:enhance', text),
    generateSummary: (notes) => ipcRenderer.invoke('ai:summarize', notes),
    createStudyAids: (content) => ipcRenderer.invoke('ai:studyAids', content)
  },
  canvas: {
    importCourses: () => ipcRenderer.invoke('canvas:import'),
    linkToAssignment: (recordingId, assignmentId) => ipcRenderer.invoke('canvas:link', recordingId, assignmentId),
    exportToCanvas: (sessionId, assignmentId) => ipcRenderer.invoke('canvas:export', sessionId, assignmentId)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for global window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
