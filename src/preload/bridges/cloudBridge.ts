/**
 * Cloud & Integrations IPC Bridges
 *
 * IPC bindings for cloud sync, Google Drive, and Canvas LMS
 */

const { ipcRenderer } = require('electron');

import { SyncChannels, DriveChannels, CanvasChannels } from '../../shared/IpcChannels.js';

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
  uploadSession: (sessionId: string) => ipcRenderer.invoke(SyncChannels.UPLOAD_SESSION, sessionId),
  getStatus: (sessionId: string) => ipcRenderer.invoke(SyncChannels.GET_STATUS, sessionId),
  retrySync: (sessionId: string) => ipcRenderer.invoke(SyncChannels.RETRY_SYNC, sessionId),
  syncAllFromCloud: () => ipcRenderer.invoke(SyncChannels.SYNC_ALL_FROM_CLOUD),
};

export const driveBridge = {
  configure: (config: GoogleDriveConfig) => ipcRenderer.invoke(DriveChannels.CONFIGURE, config),
  isAuthenticated: () => ipcRenderer.invoke(DriveChannels.IS_AUTHENTICATED),
  getAuthUrl: () => ipcRenderer.invoke(DriveChannels.GET_AUTH_URL),
  exchangeCodeForTokens: (code: string) => ipcRenderer.invoke(DriveChannels.EXCHANGE_CODE_FOR_TOKENS, code),
  setCredentials: (config: GoogleDriveConfig) => ipcRenderer.invoke(DriveChannels.SET_CREDENTIALS, config),
  getUserEmail: () => ipcRenderer.invoke(DriveChannels.GET_USER_EMAIL),
  disconnect: () => ipcRenderer.invoke(DriveChannels.DISCONNECT),
  disconnectLocal: () => ipcRenderer.invoke(DriveChannels.DISCONNECT_LOCAL),
  uploadFile: (filePath: string, options: GoogleDriveUploadOptions) =>
    ipcRenderer.invoke(DriveChannels.UPLOAD_FILE, filePath, options),
  listFiles: (folderId?: string) =>
    ipcRenderer.invoke(DriveChannels.LIST_FILES, folderId),
  createFolder: (name: string, parentId?: string) =>
    ipcRenderer.invoke(DriveChannels.CREATE_FOLDER, name, parentId),
  restoreFromCloud: () => ipcRenderer.invoke(DriveChannels.RESTORE_FROM_CLOUD),
  onAutoReconnected: (callback: () => void) => {
    ipcRenderer.on(DriveChannels.AUTO_RECONNECTED, () => callback());
  },
  removeAutoReconnectedListener: () => {
    ipcRenderer.removeAllListeners(DriveChannels.AUTO_RECONNECTED);
  },
};

export const canvasBridge = {
  configure: (config: { baseUrl: string; apiToken: string }) =>
    ipcRenderer.invoke(CanvasChannels.CONFIGURE, config),
  testConnection: () => ipcRenderer.invoke(CanvasChannels.TEST_CONNECTION),
  getCourses: () => ipcRenderer.invoke(CanvasChannels.GET_COURSES),
  isConfigured: () => ipcRenderer.invoke(CanvasChannels.IS_CONFIGURED),
  getConfig: () => ipcRenderer.invoke(CanvasChannels.GET_CONFIG),
  disconnect: () => ipcRenderer.invoke(CanvasChannels.DISCONNECT),
  importCourses: (jsonData: string) => ipcRenderer.invoke(CanvasChannels.IMPORT_COURSES, jsonData),
  getImportedCourses: () => ipcRenderer.invoke(CanvasChannels.GET_IMPORTED_COURSES),
  deleteImportedCourse: (courseId: string) => ipcRenderer.invoke(CanvasChannels.DELETE_IMPORTED_COURSE, courseId),
};
