/**
 * Audio IPC Handlers
 * 
 * Handles audio-related IPC communication between renderer and main process.
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import * as mm from 'music-metadata';

export class AudioHandlers extends BaseHandler {
  /**
   * Register all audio-related IPC handlers
   */
  register(ipcMain: IpcMain): void {
    this.handle(ipcMain, 'audio:get-metadata', this.getAudioMetadata.bind(this));
  }

  /**
   * Get audio file metadata including duration
   */
  private async getAudioMetadata(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('Getting audio metadata for:', filePath);
      
      // Parse audio metadata
      const metadata = await mm.parseFile(filePath);
      
      const result = {
        duration: metadata.format.duration || 0,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        numberOfChannels: metadata.format.numberOfChannels,
        codec: metadata.format.codec
      };
      
      console.log('Audio metadata:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting audio metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audio metadata'
      };
    }
  }
}
