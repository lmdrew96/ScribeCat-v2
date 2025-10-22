import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { app } from 'electron';

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;
}

export class WhisperModelManager {
  private modelsDir: string;
  private progressCallback: ((progress: DownloadProgress) => void) | null = null;

  // Available models (smaller = faster, less accurate)
  private readonly MODELS = {
    'tiny': {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      size: 75 * 1024 * 1024, // ~75MB
      description: 'Fastest, good for testing'
    },
    'base': {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      size: 142 * 1024 * 1024, // ~142MB
      description: 'Good balance of speed and accuracy'
    },
    'small': {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
      size: 466 * 1024 * 1024, // ~466MB
      description: 'Better accuracy, slower'
    }
  };

  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'whisper-models');
    
    // Ensure models directory exists
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  /**
   * Check if a model is installed
   */
  async isModelInstalled(modelName: keyof typeof this.MODELS = 'base'): Promise<boolean> {
    const modelPath = this.getModelPath(modelName);
    return fs.existsSync(modelPath);
  }

  /**
   * Get the path to a model file
   */
  getModelPath(modelName: keyof typeof this.MODELS = 'base'): string {
    return path.join(this.modelsDir, `ggml-${modelName}.bin`);
  }

  /**
   * Get the models directory
   */
  getModelsDirectory(): string {
    return this.modelsDir;
  }

  /**
   * Download a Whisper model
   */
  async downloadModel(modelName: keyof typeof this.MODELS = 'base'): Promise<void> {
    const model = this.MODELS[modelName];
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const modelPath = this.getModelPath(modelName);

    // Check if already downloaded
    if (fs.existsSync(modelPath)) {
      const stats = fs.statSync(modelPath);
      if (stats.size === model.size) {
        console.log(`Model ${modelName} already downloaded`);
        this.emitProgress({
          downloadedBytes: model.size,
          totalBytes: model.size,
          percentage: 100,
          status: 'complete',
          message: 'Model already installed'
        });
        return;
      }
    }

    console.log(`Downloading ${modelName} model from ${model.url}...`);

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(modelPath);
      let downloadedBytes = 0;

      https.get(model.url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          if (response.headers.location) {
            https.get(response.headers.location, handleResponse.bind(this)).on('error', reject);
          }
          return;
        }

        handleResponse.call(this, response);
      }).on('error', (error) => {
        fs.unlinkSync(modelPath);
        reject(error);
      });

      function handleResponse(this: WhisperModelManager, response: any) {
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          file.write(chunk);

          this.emitProgress({
            downloadedBytes,
            totalBytes,
            percentage: (downloadedBytes / totalBytes) * 100,
            status: 'downloading',
            message: `Downloading ${modelName} model...`
          });
        });

        response.on('end', () => {
          file.end();
          this.emitProgress({
            downloadedBytes: totalBytes,
            totalBytes,
            percentage: 100,
            status: 'complete',
            message: 'Download complete'
          });
          
          resolve();
        });

        response.on('error', (error: Error) => {
          file.end();
          fs.unlinkSync(modelPath);
          reject(error);
        });
      }
    });
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: keyof typeof this.MODELS = 'base'): Promise<void> {
    const modelPath = this.getModelPath(modelName);
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
      console.log(`Deleted model: ${modelName}`);
    }
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): Array<{ name: string; description: string; size: number }> {
    return Object.entries(this.MODELS).map(([name, info]) => ({
      name,
      description: info.description,
      size: info.size
    }));
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: DownloadProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Emit progress update
   */
  private emitProgress(progress: DownloadProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}
