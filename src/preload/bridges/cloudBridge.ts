/**
 * Cloud & Integrations IPC Bridges
 *
 * IPC bindings for cloud sync, Google Drive, and Canvas LMS
 */

const { ipcRenderer } = require('electron');

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

export const syncBridge = {
  uploadSession: (sessionId: string) => ipcRenderer.invoke('sync:uploadSession', sessionId),
  getStatus: (sessionId: string) => ipcRenderer.invoke('sync:getStatus', sessionId),
  retrySync: (sessionId: string) => ipcRenderer.invoke('sync:retrySync', sessionId),
  syncAllFromCloud: () => ipcRenderer.invoke('sync:syncAllFromCloud'),
};

export const driveBridge = {
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
  },
};

export const canvasBridge = {
  configure: (config: { baseUrl: string; apiToken: string }) =>
    ipcRenderer.invoke('canvas:configure', config),
  testConnection: () => ipcRenderer.invoke('canvas:test-connection'),
  getCourses: () => ipcRenderer.invoke('canvas:get-courses'),
  isConfigured: () => ipcRenderer.invoke('canvas:is-configured'),
  getConfig: () => ipcRenderer.invoke('canvas:get-config'),
  disconnect: () => ipcRenderer.invoke('canvas:disconnect'),
  importCourses: (jsonData: string) => ipcRenderer.invoke('canvas:import-courses', jsonData),
  getImportedCourses: () => ipcRenderer.invoke('canvas:get-imported-courses'),
  deleteImportedCourse: (courseId: string) => ipcRenderer.invoke('canvas:delete-imported-course', courseId),
};
