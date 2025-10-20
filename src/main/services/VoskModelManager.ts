/**
 * VoskModelManager
 * 
 * Manages downloading and installation of Vosk models.
 * Downloads models from alphacephei.com and extracts them to userData directory.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { app } from 'electron';
import { createWriteStream, createReadStream } from 'fs';
import { Extract } from 'unzipper';

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;
}

export class VoskModelManager {
  private readonly MODEL_NAME = 'vosk-model-en-us-0.22';
  private readonly MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip';
  private readonly MODELS_DIR: string;
  private readonly MODEL_PATH: string;
  private downloadInProgress: boolean = false;
  private progressCallback: ((progress: DownloadProgress) => void) | null = null;

  constructor() {
    // Store models in userData/vosk-models/
    this.MODELS_DIR = path.join(app.getPath('userData'), 'vosk-models');
    this.MODEL_PATH = path.join(this.MODELS_DIR, this.MODEL_NAME);
  }

  /**
   * Check if the model is installed
   */
  async isModelInstalled(): Promise<boolean> {
    try {
      // Check if model directory exists and has required files
      const modelExists = fs.existsSync(this.MODEL_PATH);
      if (!modelExists) {
        return false;
      }

      // Verify it's a valid model by checking for required subdirectories
      const requiredDirs = ['am', 'graph', 'conf'];
      const hasRequiredDirs = requiredDirs.every(dir => 
        fs.existsSync(path.join(this.MODEL_PATH, dir))
      );

      return hasRequiredDirs;
    } catch (error) {
      console.error('Error checking model installation:', error);
      return false;
    }
  }

  /**
   * Get the path to the installed model
   */
  getModelPath(): string {
    return this.MODEL_PATH;
  }

  /**
   * Get the models directory path
   */
  getModelsDirectory(): string {
    return this.MODELS_DIR;
  }

  /**
   * Set progress callback for download updates
   */
  onProgress(callback: (progress: DownloadProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Download and extract the Vosk model
   */
  async downloadModel(): Promise<void> {
    if (this.downloadInProgress) {
      throw new Error('Download already in progress');
    }

    this.downloadInProgress = true;

    try {
      // Ensure models directory exists
      await fs.promises.mkdir(this.MODELS_DIR, { recursive: true });

      // Download the model
      const zipPath = path.join(this.MODELS_DIR, `${this.MODEL_NAME}.zip`);
      await this.downloadFile(this.MODEL_URL, zipPath);

      // Extract the model
      this.emitProgress({
        bytesDownloaded: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'extracting',
        message: 'Extracting model files...'
      });

      await this.extractZip(zipPath, this.MODELS_DIR);

      // Clean up zip file
      await fs.promises.unlink(zipPath);

      // Verify installation
      const installed = await this.isModelInstalled();
      if (!installed) {
        throw new Error('Model extraction failed - model files not found');
      }

      this.emitProgress({
        bytesDownloaded: 0,
        totalBytes: 0,
        percentage: 100,
        status: 'complete',
        message: 'Model installed successfully'
      });

      console.log('Vosk model downloaded and installed successfully');
    } catch (error) {
      // Clean up on error
      await this.cleanupFailedDownload();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress({
        bytesDownloaded: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'error',
        message: `Download failed: ${errorMessage}`
      });

      throw error;
    } finally {
      this.downloadInProgress = false;
    }
  }

  /**
   * Download a file with progress tracking
   */
  private async downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log('Following redirect to:', redirectUrl);
            this.downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        const fileStream = createWriteStream(outputPath);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percentage = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

          this.emitProgress({
            bytesDownloaded: downloadedBytes,
            totalBytes,
            percentage,
            status: 'downloading',
            message: `Downloading: ${this.formatBytes(downloadedBytes)} / ${this.formatBytes(totalBytes)}`
          });
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (error) => {
          fs.unlink(outputPath, () => {}); // Clean up partial file
          reject(error);
        });

        response.on('error', (error: Error) => {
          fs.unlink(outputPath, () => {}); // Clean up partial file
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Extract a zip file
   */
  private async extractZip(zipPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(Extract({ path: outputDir }))
        .on('close', () => {
          console.log('Extraction complete');
          resolve();
        })
        .on('error', (error) => {
          console.error('Extraction error:', error);
          reject(error);
        });
    });
  }

  /**
   * Clean up failed download
   */
  private async cleanupFailedDownload(): Promise<void> {
    try {
      const zipPath = path.join(this.MODELS_DIR, `${this.MODEL_NAME}.zip`);
      
      // Remove zip file if exists
      if (fs.existsSync(zipPath)) {
        await fs.promises.unlink(zipPath);
      }

      // Remove partial model directory if exists
      if (fs.existsSync(this.MODEL_PATH)) {
        await fs.promises.rm(this.MODEL_PATH, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Error cleaning up failed download:', error);
    }
  }

  /**
   * Emit progress update
   */
  private emitProgress(progress: DownloadProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Delete the installed model
   */
  async deleteModel(): Promise<void> {
    try {
      if (fs.existsSync(this.MODEL_PATH)) {
        await fs.promises.rm(this.MODEL_PATH, { recursive: true, force: true });
        console.log('Model deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }
}
