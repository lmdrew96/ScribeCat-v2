import electron from 'electron';
import type { IpcMain, BrowserWindow, SaveDialogOptions } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

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
    this.handle(ipcMain, 'dialog:showSaveDialog', async (_event, ...args: unknown[]) => {
      const options = args[0] as SaveDialogOptions;
      const mainWindow = this.getMainWindow();
      if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
      }

      const result = await electron.dialog.showSaveDialog(mainWindow, options);
      return { success: true, data: result };
    });

    // Dialog: Get temp directory path
    this.handle(ipcMain, 'dialog:getTempPath', async () => {
      return { success: true, data: os.tmpdir() };
    });

    // Dialog: Delete file
    this.handle(ipcMain, 'dialog:deleteFile', async (_event, ...args: unknown[]) => {
      const filePath = args[0] as string;
      try {
        fs.unlinkSync(filePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error deleting file'
        };
      }
    });

    // Dialog: Check if file exists
    this.handle(ipcMain, 'dialog:fileExists', async (_event, ...args: unknown[]) => {
      const filePath = args[0] as string;
      try {
        return { success: true, exists: fs.existsSync(filePath) };
      } catch (error) {
        return {
          success: false,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error checking file'
        };
      }
    });
  }
}
