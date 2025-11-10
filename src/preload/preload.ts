// src/preload/preload.ts
// Type declarations are in preload.d.ts

const { contextBridge, ipcRenderer } = require('electron');

// Type definitions (inline to avoid ES module import in CommonJS context)
interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

interface ExportOptions {
  includeAudio?: boolean;
  includeTranscription?: boolean;
  includeNotes?: boolean;
  includeSummary?: boolean;
  format?: string;
}

interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface GoogleDriveUploadOptions {
  folderId?: string;
  mimeType?: string;
  description?: string;
}

interface CanvasConfig {
  baseUrl: string;
  apiToken: string;
}

interface TranscriptionResult {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface SignInWithEmailParams {
  email: string;
  password: string;
}

interface SignUpWithEmailParams {
  email: string;
  password: string;
  fullName?: string;
}

// Expose the API to the renderer process
const electronAPI = {
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  dialog: {
    showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    getTempPath: () => ipcRenderer.invoke('dialog:getTempPath'),
    deleteFile: (filePath: string) => ipcRenderer.invoke('dialog:deleteFile', filePath),
    fileExists: (filePath: string) => ipcRenderer.invoke('dialog:fileExists', filePath)
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
    assemblyai: {
      getToken: (apiKey: string) => ipcRenderer.invoke('transcription:assemblyai:getToken', apiKey)
    }
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
      updateTranscription: (sessionId: string, transcriptionText: string, provider?: string, timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>) =>
        ipcRenderer.invoke('session:updateTranscription', sessionId, transcriptionText, provider, timestampedEntries),
      updateNotes: (sessionId: string, notes: string) =>
        ipcRenderer.invoke('session:updateNotes', sessionId, notes),
      updateSummary: (sessionId: string, summary: string) =>
        ipcRenderer.invoke('session:updateSummary', sessionId, summary),
      createDraft: () =>
        ipcRenderer.invoke('session:createDraft'),
      getAvailableFormats: () =>
        ipcRenderer.invoke('export:getAvailableFormats'),
      // Trash-related methods
      getDeleted: (userId?: string) =>
        ipcRenderer.invoke('sessions:getDeleted', userId),
      restore: (sessionId: string) =>
        ipcRenderer.invoke('sessions:restore', sessionId),
      restoreMultiple: (sessionIds: string[]) =>
        ipcRenderer.invoke('sessions:restoreMultiple', sessionIds),
      permanentlyDelete: (sessionId: string) =>
        ipcRenderer.invoke('sessions:permanentlyDelete', sessionId),
      permanentlyDeleteMultiple: (sessionIds: string[]) =>
        ipcRenderer.invoke('sessions:permanentlyDeleteMultiple', sessionIds),
      createMultiSessionStudySet: (sessionIds: string[], title: string) =>
        ipcRenderer.invoke('sessions:createMultiSessionStudySet', sessionIds, title)
    },
  drive: {
    configure: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:configure', config),
    isAuthenticated: () => ipcRenderer.invoke('drive:isAuthenticated'),
    getAuthUrl: () => ipcRenderer.invoke('drive:getAuthUrl'),
    exchangeCodeForTokens: (code: string) => ipcRenderer.invoke('drive:exchangeCodeForTokens', code),
    setCredentials: (config: GoogleDriveConfig) => ipcRenderer.invoke('drive:setCredentials', config),
    getUserEmail: () => ipcRenderer.invoke('drive:getUserEmail'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    disconnectLocal: () => ipcRenderer.invoke('drive:disconnectLocal'),
    uploadFile: (filePath: string, options: GoogleDriveUploadOptions) =>
      ipcRenderer.invoke('drive:uploadFile', filePath, options),
    listFiles: (folderId?: string) =>
      ipcRenderer.invoke('drive:listFiles', folderId),
    createFolder: (name: string, parentId?: string) =>
      ipcRenderer.invoke('drive:createFolder', name, parentId),
    restoreFromCloud: () => ipcRenderer.invoke('drive:restoreFromCloud'),
    onAutoReconnected: (callback: () => void) => {
      ipcRenderer.on('drive:auto-reconnected', () => callback());
    },
    removeAutoReconnectedListener: () => {
      ipcRenderer.removeAllListeners('drive:auto-reconnected');
    }
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
  auth: {
    signInWithEmail: (params: SignInWithEmailParams) => ipcRenderer.invoke('auth:signInWithEmail', params),
    signUpWithEmail: (params: SignUpWithEmailParams) => ipcRenderer.invoke('auth:signUpWithEmail', params),
    signInWithGoogle: (codeChallenge: string) => ipcRenderer.invoke('auth:signInWithGoogle', codeChallenge),
    // Open OAuth in Electron window with WebAuthn/passkey support
    openOAuthWindow: (authUrl: string) => ipcRenderer.invoke('auth:openOAuthWindow', authUrl),
    // NOTE: OAuth callback is now handled in renderer process using RendererSupabaseClient
    // No IPC method needed - renderer exchanges code directly where localStorage works
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    updateProfile: (updates: { fullName?: string }) => ipcRenderer.invoke('auth:updateProfile', updates),
    resetPassword: (email: string) => ipcRenderer.invoke('auth:resetPassword', email),
    deleteAccount: () => ipcRenderer.invoke('auth:deleteAccount'),
    // Send auth state changes to main process for cloud sync
    sessionChanged: (data: { userId: string | null; accessToken?: string; refreshToken?: string }) =>
      ipcRenderer.invoke('auth:sessionChanged', data),
    // OAuth waiting window
    showOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:showWaitingWindow'),
    closeOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:closeWaitingWindow'),
    onOAuthCodeReceived: (callback: (code: string) => void) => {
      ipcRenderer.on('oauth:code-received', (_event: Electron.IpcRendererEvent, code: string) => callback(code));
    },
    onOAuthCancelled: (callback: () => void) => {
      ipcRenderer.on('oauth:cancelled', () => callback());
    },
    removeOAuthListeners: () => {
      ipcRenderer.removeAllListeners('oauth:code-received');
      ipcRenderer.removeAllListeners('oauth:cancelled');
    }
  },
  sync: {
    uploadSession: (sessionId: string) => ipcRenderer.invoke('sync:uploadSession', sessionId),
    getStatus: (sessionId: string) => ipcRenderer.invoke('sync:getStatus', sessionId),
    retrySync: (sessionId: string) => ipcRenderer.invoke('sync:retrySync', sessionId),
    syncAllFromCloud: () => ipcRenderer.invoke('sync:syncAllFromCloud')
  },
  share: {
    checkAccess: (sessionId: string) =>
      ipcRenderer.invoke('share:checkAccess', sessionId),
    create: (params: { sessionId: string; email: string; permissionLevel: 'viewer' | 'editor' }) =>
      ipcRenderer.invoke('share:create', params),
    remove: (params: { shareId?: string; invitationId?: string }) =>
      ipcRenderer.invoke('share:remove', params),
    updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) =>
      ipcRenderer.invoke('share:updatePermission', params),
    getSessionShares: (sessionId: string) =>
      ipcRenderer.invoke('share:getSessionShares', sessionId),
    getSharedWithMe: () =>
      ipcRenderer.invoke('share:getSharedWithMe'),
    acceptInvitation: (token: string) =>
      ipcRenderer.invoke('share:acceptInvitation', token)
  },
  power: {
    preventSleep: () => ipcRenderer.invoke('power:preventSleep'),
    allowSleep: () => ipcRenderer.invoke('power:allowSleep'),
    isPreventingSleep: () => ipcRenderer.invoke('power:isPreventingSleep')
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
