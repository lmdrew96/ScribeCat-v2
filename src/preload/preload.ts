import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface ElectronAPI {
  recording: {
    start: () => Promise<{ success: boolean; sessionId: string }>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    getStatus: () => Promise<any>;
    saveAudio: (audioData: ArrayBuffer, sessionId: string) => Promise<string>;
  };
  files: {
    save: (data: any) => Promise<void>;
    load: (filename: string) => Promise<any>;
    list: () => Promise<any[]>;
    delete: (sessionId: string) => Promise<void>;
    export: (sessionId: string, format: string) => Promise<string>;
  };
  transcription: {
    transcribe: (audioPath: string) => Promise<string>;
    enhance: (text: string) => Promise<string>;
    getStatus: () => Promise<any>;
  };
  on: (channel: string, callback: (data: any) => void) => void;
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
    resume: () => ipcRenderer.invoke('recording:resume'),
    getStatus: () => ipcRenderer.invoke('recording:getStatus'),
    saveAudio: (audioData, sessionId) => ipcRenderer.invoke('recording:saveAudio', audioData, sessionId)
  },
  files: {
    save: (data) => ipcRenderer.invoke('files:save', data),
    load: (filename) => ipcRenderer.invoke('files:load', filename),
    list: () => ipcRenderer.invoke('files:list'),
    delete: (sessionId) => ipcRenderer.invoke('files:delete', sessionId),
    export: (sessionId, format) => ipcRenderer.invoke('files:export', sessionId, format)
  },
  transcription: {
    transcribe: (audioPath) => ipcRenderer.invoke('transcription:transcribe', audioPath),
    enhance: (text) => ipcRenderer.invoke('transcription:enhance', text),
    getStatus: () => ipcRenderer.invoke('transcription:getStatus')
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
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
