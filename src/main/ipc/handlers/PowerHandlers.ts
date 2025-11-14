import type { IpcMain } from 'electron';
import { powerSaveBlocker } from 'electron';
import { BaseHandler } from '../BaseHandler.js';

/**
 * Handles power management IPC channels
 *
 * Manages sleep prevention during recording/transcription sessions.
 */
export class PowerHandlers extends BaseHandler {
  private powerSaveBlockerId: number | null = null;

  constructor() {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Prevent system sleep
    this.handle(ipcMain, 'power:preventSleep', async () => {
      if (this.powerSaveBlockerId !== null) {
        console.log('Sleep prevention already active:', this.powerSaveBlockerId);
        return { success: true, blockerId: this.powerSaveBlockerId };
      }

      // Use 'prevent-display-sleep' for stronger protection against throttling
      // This prevents both system sleep and display sleep during recording
      // Ensures MediaRecorder and audio capture continue running in background
      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
      console.log('✅ Sleep prevention enabled:', this.powerSaveBlockerId);

      return { success: true, blockerId: this.powerSaveBlockerId };
    });

    // Allow system sleep
    this.handle(ipcMain, 'power:allowSleep', async () => {
      if (this.powerSaveBlockerId === null) {
        console.log('Sleep prevention not active');
        return { success: true };
      }

      powerSaveBlocker.stop(this.powerSaveBlockerId);
      console.log('✅ Sleep prevention disabled');
      this.powerSaveBlockerId = null;

      return { success: true };
    });

    // Check if sleep is currently being prevented
    this.handle(ipcMain, 'power:isPreventingSleep', async () => {
      const isPreventing = this.powerSaveBlockerId !== null &&
                          powerSaveBlocker.isStarted(this.powerSaveBlockerId);
      return { isPreventing, blockerId: this.powerSaveBlockerId };
    });
  }
}
