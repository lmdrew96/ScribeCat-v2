import electron from 'electron';
import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import Store from 'electron-store';
import { StoreChannels } from '../../../shared/IpcChannels.js';

/** Typed interface for electron-store methods */
interface ElectronStoreTyped {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

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
    this.handle(ipcMain, StoreChannels.GET, async (event, key: string) => {
      const value = (this.store as ElectronStoreTyped).get(key);
      return value;
    });

    // Store: Set value
    this.handle(ipcMain, StoreChannels.SET, async (event, key: string, value: unknown) => {
      (this.store as ElectronStoreTyped).set(key, value);
      return undefined;
    });
  }
}
