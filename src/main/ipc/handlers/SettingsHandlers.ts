import { IpcMain } from 'electron';
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
    // Settings: Get simulation mode
    this.handle(ipcMain, 'settings:get-simulation-mode', async () => {
      const simulationMode = (this.store as any).get('simulation-mode', true) as boolean;
      return { success: true, simulationMode };
    });

    // Settings: Set simulation mode
    this.handle(ipcMain, 'settings:set-simulation-mode', async (event, enabled: boolean) => {
      (this.store as any).set('simulation-mode', enabled);
      return { success: true };
    });

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
