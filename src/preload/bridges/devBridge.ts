/**
 * Dev Tools IPC Bridge
 *
 * IPC bindings for development tools like hot reload notifications
 */

const { ipcRenderer } = require('electron');

export const devBridge = {
  onHotReloadNotification: (callback: (message: string) => void) => {
    ipcRenderer.on('dev:hot-reload-notification', (_event: Electron.IpcRendererEvent, message: string) =>
      callback(message)
    );
  },
  removeHotReloadListener: () => {
    ipcRenderer.removeAllListeners('dev:hot-reload-notification');
  },
};
