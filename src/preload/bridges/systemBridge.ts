/**
 * App & System IPC Bridges
 *
 * IPC bindings for core app functionality: version, shell, dialogs, store, power
 */

const { ipcRenderer } = require('electron');

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export const appBridge = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
};

export const shellBridge = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
};

export const dialogBridge = {
  showSaveDialog: (options: SaveDialogOptions) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  getTempPath: () => ipcRenderer.invoke('dialog:getTempPath'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('dialog:deleteFile', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('dialog:fileExists', filePath),
};

export const storeBridge = {
  get: (key: string) => ipcRenderer.invoke('store:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
};

export const powerBridge = {
  preventSleep: () => ipcRenderer.invoke('power:preventSleep'),
  allowSleep: () => ipcRenderer.invoke('power:allowSleep'),
  isPreventingSleep: () => ipcRenderer.invoke('power:isPreventingSleep'),
};
