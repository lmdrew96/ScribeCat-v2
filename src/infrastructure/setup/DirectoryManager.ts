/**
 * DirectoryManager
 * 
 * Utility for creating and managing application directory structure.
 * Infrastructure layer - handles file system operations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import electron from 'electron';

export class DirectoryManager {
  private readonly baseDir: string;
  private readonly sessionsDir: string;
  private readonly recordingsDir: string;
  private readonly exportsDir: string;
  private readonly modelsDir: string;

  constructor(baseDir?: string) {
    // Use provided base directory or default to app's user data directory
    this.baseDir = baseDir || electron.app.getPath('userData');
    this.sessionsDir = path.join(this.baseDir, 'sessions');
    this.recordingsDir = path.join(this.baseDir, 'recordings');
    this.exportsDir = path.join(this.baseDir, 'exports');
    this.modelsDir = path.join(this.baseDir, 'models');
  }

  /**
   * Initialize all required directories
   * Creates directories if they don't exist
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.sessionsDir);
      await this.ensureDirectoryExists(this.recordingsDir);
      await this.ensureDirectoryExists(this.exportsDir);
      await this.ensureDirectoryExists(this.modelsDir);
      
      console.log('Directory structure initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize directories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure a directory exists, create it if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Get the sessions directory path
   */
  getSessionsDirectory(): string {
    return this.sessionsDir;
  }

  /**
   * Get the recordings directory path
   */
  getRecordingsDirectory(): string {
    return this.recordingsDir;
  }

  /**
   * Get the exports directory path
   */
  getExportsDirectory(): string {
    return this.exportsDir;
  }

  /**
   * Get the models directory path
   */
  getModelsDirectory(): string {
    return this.modelsDir;
  }

  /**
   * Get the base directory path
   */
  getBaseDirectory(): string {
    return this.baseDir;
  }

  /**
   * Check disk space available in base directory
   * @returns Available space in bytes
   */
  async getAvailableSpace(): Promise<number> {
    try {
      const stats = await fs.statfs(this.baseDir);
      return stats.bavail * stats.bsize;
    } catch (error) {
      console.warn(`Failed to check disk space: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  /**
   * Check if there's enough disk space for an operation
   * @param requiredBytes Minimum required bytes
   * @returns True if enough space is available
   */
  async hasEnoughSpace(requiredBytes: number): Promise<boolean> {
    const available = await this.getAvailableSpace();
    return available >= requiredBytes;
  }

  /**
   * Clean up old export files (optional maintenance)
   * @param daysOld Delete exports older than this many days
   */
  async cleanupOldExports(daysOld: number = 30): Promise<number> {
    try {
      const files = await fs.readdir(this.exportsDir);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.exportsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old export files`);
      return deletedCount;
    } catch (error) {
      console.warn(`Failed to cleanup old exports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }
}
