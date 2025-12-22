/**
 * App & System IPC Bridges
 *
 * IPC bindings for core app functionality: version, shell, dialogs, store, power
 */

const { ipcRenderer } = require('electron');

import {
  AppChannels,
  ShellChannels,
  DialogChannels,
  StoreChannels,
  PowerChannels,
} from '../../shared/IpcChannels.js';

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export const appBridge = {
  getVersion: () => ipcRenderer.invoke(AppChannels.GET_VERSION),
};

export const shellBridge = {
  openExternal: (url: string) => ipcRenderer.invoke(ShellChannels.OPEN_EXTERNAL, url),
};

export const dialogBridge = {
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke(DialogChannels.SHOW_SAVE_DIALOG, options),
  getTempPath: () => ipcRenderer.invoke(DialogChannels.GET_TEMP_PATH),
  deleteFile: (filePath: string) => ipcRenderer.invoke(DialogChannels.DELETE_FILE, filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke(DialogChannels.FILE_EXISTS, filePath),
};

export const storeBridge = {
  get: (key: string) => ipcRenderer.invoke(StoreChannels.GET, key),
  set: (key: string, value: unknown) => ipcRenderer.invoke(StoreChannels.SET, key, value),
};

export const powerBridge = {
  preventSleep: () => ipcRenderer.invoke(PowerChannels.PREVENT_SLEEP),
  allowSleep: () => ipcRenderer.invoke(PowerChannels.ALLOW_SLEEP),
  isPreventingSleep: () => ipcRenderer.invoke(PowerChannels.IS_PREVENTING_SLEEP),
};
