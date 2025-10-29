import { IpcMain } from 'electron';
import { BaseHandler } from './BaseHandler.js';

/**
 * Registry for managing IPC handlers
 * 
 * Provides a centralized way to register multiple handler classes
 * with the Electron IpcMain instance.
 */
export class HandlerRegistry {
  private handlers: BaseHandler[] = [];

  /**
   * Add a handler to the registry
   * 
   * @param handler - The handler instance to add
   */
  add(handler: BaseHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Register all handlers with IpcMain
   * 
   * @param ipcMain - The Electron IpcMain instance
   */
  registerAll(ipcMain: IpcMain): void {
    for (const handler of this.handlers) {
      handler.register(ipcMain);
    }
  }
}
