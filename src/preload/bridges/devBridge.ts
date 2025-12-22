/**
 * Dev Tools IPC Bridge
 *
 * IPC bindings for development tools like hot reload notifications
 */

const { ipcRenderer } = require('electron');

import { DevChannels } from '../../shared/IpcChannels.js';

export const devBridge = {
  onHotReloadNotification: (callback: (message: string) => void) => {
    ipcRenderer.on(DevChannels.HOT_RELOAD_NOTIFICATION, (_event: Electron.IpcRendererEvent, message: string) =>
      callback(message)
    );
  },
  removeHotReloadListener: () => {
    ipcRenderer.removeAllListeners(DevChannels.HOT_RELOAD_NOTIFICATION);
  },
};
