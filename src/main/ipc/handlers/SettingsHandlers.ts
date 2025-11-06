import electron from 'electron';
import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import Store from 'electron-store';

/**
 * Handles settings and store-related IPC channels
 * 
 * Manages application settings and electron-store operations.
 */
export class SettingsHandlers extends BaseHandler {
  constructor(private store: Store) {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Store: Get value
    this.handle(ipcMain, 'store:get', async (event, key: string) => {
      const value = (this.store as any).get(key);
      return value;
    });

    // Store: Set value
    this.handle(ipcMain, 'store:set', async (event, key: string, value: unknown) => {
      (this.store as any).set(key, value);
      return undefined;
    });
  }
}
