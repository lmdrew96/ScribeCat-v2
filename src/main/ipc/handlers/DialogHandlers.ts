import electron from 'electron';
import type { IpcMain, BrowserWindow } from 'electron';
import { BaseHandler } from '../BaseHandler.js';

/**
 * Handles dialog-related IPC channels
 *
 * Manages native dialog operations like save dialogs.
 */
export class DialogHandlers extends BaseHandler {
  constructor(private getMainWindow: () => BrowserWindow | null) {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Dialog: Show save dialog
    this.handle(ipcMain, 'dialog:showSaveDialog', async (event, options) => {
      const mainWindow = this.getMainWindow();
      if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
      }

      const result = await electron.dialog.showSaveDialog(mainWindow, options);
      return { success: true, data: result };
    });
  }
}
