/**
 * FileAudioRepository
 * 
 * File system implementation of IAudioRepository.
 * Handles actual audio file storage operations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import electron from 'electron';
import { IAudioRepository } from '../../domain/repositories/IAudioRepository.js';

export class FileAudioRepository implements IAudioRepository {
  private recordingsDir: string;
  private directoryInitialized: boolean = false;

  constructor() {
    const userDataPath = electron.app.getPath('userData');
    this.recordingsDir = path.join(userDataPath, 'recordings');
  }

  /**
   * Ensure recordings directory exists (lazy initialization)
   */
  private async ensureDirectory(): Promise<void> {
    if (this.directoryInitialized) {
      return;
    }
    
    try {
      await fs.access(this.recordingsDir);
      this.directoryInitialized = true;
    } catch {
      await fs.mkdir(this.recordingsDir, { recursive: true });
      this.directoryInitialized = true;
    }
  }

  /**
   * Save audio data to file system
   */
  async saveAudio(audioData: ArrayBuffer, filename: string): Promise<string> {
    await this.ensureDirectory();
    
    const filePath = path.join(this.recordingsDir, filename);
    const buffer = Buffer.from(audioData);
    
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  }

  /**
   * Load audio data from file system
   */
  async loadAudio(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  /**
   * Delete audio file from file system
   */
  async deleteAudio(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, consider it deleted
    }
  }

  /**
   * Check if audio file exists
   */
  async audioExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the recordings directory path
   */
  getRecordingsDirectory(): string {
    return this.recordingsDir;
  }
}
