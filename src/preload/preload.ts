// src/preload/preload.ts
// Type declarations are in preload.d.ts

const { contextBridge, ipcRenderer } = require('electron');

import type {
  SaveDialogOptions,
  ChatMessage,
  ChatOptions,
  ExportOptions,
  GoogleDriveConfig,
  GoogleDriveUploadOptions,
  CanvasConfig
} from '../shared/types';

interface TranscriptionResult {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

// Expose the API to the renderer process
const electronAPI = {
  dialog: {
    showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('dialog:showSaveDialog', options)
  },
  recording: {
    start: () => ipcRenderer.invoke('recording:start'),
    stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }) => ipcRenderer.invoke('recording:stop', audioData, duration, courseData),
    pause: () => ipcRenderer.invoke('recording:pause'),
    resume: () => ipcRenderer.invoke('recording:resume'),
    getStatus: () => ipcRenderer.invoke('recording:getStatus')
  },
  audio: {
    saveFile: (audioData: number[], fileName: string, folderPath: string) => 
      ipcRenderer.invoke('audio:save-file', audioData, fileName, folderPath),
    getMetadata: (filePath: string) => 
      ipcRenderer.invoke('audio:get-metadata', filePath)
  },
  transcription: {
    simulation: {
      start: () => ipcRenderer.invoke('transcription:simulation:start'),
      stop: (sessionId: string) => ipcRenderer.invoke('transcription:simulation:stop', sessionId),
      pause: () => ipcRenderer.invoke('transcription:simulation:pause'),
      resume: () => ipcRenderer.invoke('transcription:simulation:resume'),
      onResult: (callback: (result: TranscriptionResult) => void) => {
        ipcRenderer.on('transcription:result', (_event: Electron.IpcRendererEvent, result: TranscriptionResult) => callback(result));
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
    chat: (message: string, history: ChatMessage[], options?: ChatOptions) =>
      ipcRenderer.invoke('ai:chat', message, history, options),
    chatStream: async (message: string, history: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void) => {
      // Remove any existing listeners first to prevent leaks
      ipcRenderer.removeAllListeners('ai:chatChunk');

      // Set up listener for chunks
      const chunkHandler = (_event: Electron.IpcRendererEvent, chunk: string) => onChunk(chunk);
      ipcRenderer.on('ai:chatChunk', chunkHandler);

      try {
        // Start the stream
        const result = await ipcRenderer.invoke('ai:chatStream', message, history, options);
        return result;
      } finally {
        // Clean up listener after stream completes
        ipcRenderer.removeListener('ai:chatChunk', chunkHandler);
      }
    },
    removeChatStreamListener: () => {
      ipcRenderer.removeAllListeners('ai:chatChunk');
    },
    polishTranscription: (text: string, options?: Partial<{ grammar: boolean; punctuation: boolean; clarity: boolean; preserveMeaning: boolean }>) =>
      ipcRenderer.invoke('ai:polishTranscription', text, options),
    generateSummary: (transcription: string, notes?: string, options?: Partial<{ style: string; maxLength: number }>) =>
      ipcRenderer.invoke('ai:generateSummary', transcription, notes, options),
    generateTitle: (transcription: string, notes?: string, options?: Partial<{ maxLength: number; format: string }>) =>
      ipcRenderer.invoke('ai:generateTitle', transcription, notes, options),
    isConfigured: () => ipcRenderer.invoke('ai:isConfigured'),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    setApiKey: (apiKey: string) => ipcRenderer.invoke('ai:setApiKey', apiKey)
  },
    session: {
      list: (sortOrder?: 'asc' | 'desc') =>
        ipcRenderer.invoke('sessions:list', sortOrder),
      listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') =>
        ipcRenderer.invoke('sessions:listWithTags', tags, sortOrder),
      delete: (sessionId: string) =>
        ipcRenderer.invoke('sessions:delete', sessionId),
      deleteMultiple: (sessionIds: string[]) =>
        ipcRenderer.invoke('sessions:deleteMultiple', sessionIds),
      update: (sessionId: string, updates: { title?: string; notes?: string; tags?: string[] }) =>
        ipcRenderer.invoke('sessions:update', sessionId, updates),
      export: (sessionId: string, format: string, outputPath: string, options?: ExportOptions) =>
        ipcRenderer.invoke('session:export', sessionId, format, outputPath, options),
      exportWithDefaults: (sessionId: string, format: string, outputPath: string) =>
        ipcRenderer.invoke('session:exportWithDefaults', sessionId, format, outputPath),
      updateTranscription: (sessionId: string, transcriptionText: string, provider?: string) =>
        ipcRenderer.invoke('session:updateTranscription', sessionId, transcriptionText, provider),
      updateNotes: (sessionId: string, notes: string) =>
        ipcRenderer.invoke('session:updateNotes', sessionId, notes),
      createDraft: () =>
        ipcRenderer.invoke('session:createDraft'),
      getAvailableFormats: () =>
        ipcRenderer.invoke('export:getAvailableFormats')
    },
  drive: {
    configure: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:configure', config),
    isAuthenticated: () => ipcRenderer.invoke('drive:isAuthenticated'),
    getAuthUrl: () => ipcRenderer.invoke('drive:getAuthUrl'),
    exchangeCodeForTokens: (code: string) => ipcRenderer.invoke('drive:exchangeCodeForTokens', code),
    setCredentials: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:setCredentials', config),
    getUserEmail: () => ipcRenderer.invoke('drive:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    uploadFile: (filePath: string, options: GoogleDriveUploadOptions) =>
      ipcRenderer.invoke('drive:uploadFile', filePath, options),
    listFiles: (folderId?: string) => 
      ipcRenderer.invoke('drive:listFiles', folderId),
    createFolder: (name: string, parentId?: string) => 
      ipcRenderer.invoke('drive:createFolder', name, parentId)
  },
  canvas: {
    configure: (config: { baseUrl: string; apiToken: string }) =>
      ipcRenderer.invoke('canvas:configure', config),
    testConnection: () => ipcRenderer.invoke('canvas:test-connection'),
    getCourses: () => ipcRenderer.invoke('canvas:get-courses'),
    isConfigured: () => ipcRenderer.invoke('canvas:is-configured'),
    getConfig: () => ipcRenderer.invoke('canvas:get-config'),
    disconnect: () => ipcRenderer.invoke('canvas:disconnect'),
    importCourses: (jsonData: string) => ipcRenderer.invoke('canvas:import-courses', jsonData),
    getImportedCourses: () => ipcRenderer.invoke('canvas:get-imported-courses'),
    deleteImportedCourse: (courseId: string) => ipcRenderer.invoke('canvas:delete-imported-course', courseId)
  },
  dev: {
    onHotReloadNotification: (callback: (message: string) => void) => {
      ipcRenderer.on('dev:hot-reload-notification', (_event: Electron.IpcRendererEvent, message: string) => callback(message));
    },
    removeHotReloadListener: () => {
      ipcRenderer.removeAllListeners('dev:hot-reload-notification');
    }
  },
  // TODO: Implement these features in future phases
  // files: { ... }
  // themes: { ... }
};

contextBridge.exposeInMainWorld('scribeCat', electronAPI);
