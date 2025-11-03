import electron from 'electron';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Abstract base class for IPC handlers
 * 
 * Provides common functionality for registering IPC handlers with consistent
 * error handling and type safety.
 */
export abstract class BaseHandler {
  /**
   * Register all IPC handlers for this handler class
   * 
   * @param ipcMain - The Electron IpcMain instance
   */
  abstract register(ipcMain: IpcMain): void;

  /**
   * Helper method to register an IPC handler with consistent error handling
   * 
   * @param ipcMain - The Electron IpcMain instance
   * @param channel - The IPC channel name
   * @param handler - The handler function
   */
  protected handle<T = any>(
    ipcMain: IpcMain,
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
  ): void {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        console.error(`Error in IPC handler '${channel}':`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}
