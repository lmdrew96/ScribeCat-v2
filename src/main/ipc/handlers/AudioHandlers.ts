import { IpcMain } from 'electron';
import * as path from 'path';
import { BaseHandler } from '../BaseHandler.js';

/**
 * Handles audio-related IPC channels
 * 
 * Manages audio file saving operations.
 */
export class AudioHandlers extends BaseHandler {
  register(ipcMain: IpcMain): void {
    // Audio: Save audio file handler
    this.handle(ipcMain, 'audio:save-file', async (event, audioData: number[], fileName: string, folderPath: string) => {
      const fs = await import('fs');
      const buffer = Buffer.from(audioData);
      const outPath = path.join(folderPath, `${fileName}.webm`);
      
      // Ensure directory exists
      await fs.promises.mkdir(folderPath, { recursive: true });
      
      // Write file
      await fs.promises.writeFile(outPath, buffer);
      
      return { success: true, path: outPath };
    });
  }
}
