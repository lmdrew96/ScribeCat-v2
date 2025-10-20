/// <reference path="../../shared/window.d.ts" />

/**
 * Extract DownloadProgress type from the window API
 */
type DownloadProgress = Parameters<Parameters<typeof window.scribeCat.transcription.vosk.model.onDownloadProgress>[0]>[0];

/**
 * Vosk model management section for settings page
 * Allows users to download, re-download, or delete the model
 */

export class VoskSettingsSection {
  private container: HTMLElement;
  private progressListener: ((progress: DownloadProgress) => void) | null = null;
  private isDownloading = false;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = container;
    this.render();
  }

  /**
   * Render the settings section based on model status
   */
  private async render(): Promise<void> {
    const check = await window.scribeCat.transcription.vosk.model.isInstalled();

    if (check.isInstalled) {
      this.renderInstalled(check.path || 'Unknown');
    } else {
      this.renderNotInstalled();
    }
  }

  /**
   * Render UI when model is NOT installed
   */
  private renderNotInstalled(): void {
    this.container.innerHTML = `
      <section class="settings-section vosk-settings">
        <h3>Transcription Model</h3>
        
        <div class="model-status not-installed">
          <span class="status-icon">❌</span>
          <span class="status-text">Not Installed</span>
        </div>
        
        <p class="model-info">Model: vosk-model-en-us-0.22 (~1.8GB)</p>
        
        <div class="progress-container" style="display: none;">
          <progress value="0" max="100"></progress>
          <p class="progress-text">Preparing download...</p>
        </div>
        
        <button class="btn-primary" id="download-model-btn">Download Model</button>
      </section>
    `;

    const downloadBtn = this.container.querySelector('#download-model-btn') as HTMLButtonElement;
    downloadBtn.addEventListener('click', () => this.handleDownload());
  }

  /**
   * Render UI when model IS installed
   */
  private renderInstalled(modelPath: string): void {
    this.container.innerHTML = `
      <section class="settings-section vosk-settings">
        <h3>Transcription Model</h3>
        
        <div class="model-status installed">
          <span class="status-icon">✅</span>
          <span class="status-text">Installed</span>
        </div>
        
        <p class="model-info">
          <strong>Model:</strong> vosk-model-en-us-0.22<br>
          <strong>Size:</strong> ~1.8GB<br>
          <strong>Location:</strong> <span class="model-path" title="${modelPath}">${this.truncatePath(modelPath)}</span>
        </p>
        
        <div class="progress-container" style="display: none;">
          <progress value="0" max="100"></progress>
          <p class="progress-text">Preparing download...</p>
        </div>
        
        <div class="button-group">
          <button class="btn-secondary" id="redownload-model-btn">Re-download Model</button>
          <button class="btn-danger" id="delete-model-btn">Delete Model</button>
        </div>
      </section>
    `;

    const redownloadBtn = this.container.querySelector('#redownload-model-btn') as HTMLButtonElement;
    const deleteBtn = this.container.querySelector('#delete-model-btn') as HTMLButtonElement;

    redownloadBtn.addEventListener('click', () => this.handleRedownload());
    deleteBtn.addEventListener('click', () => this.handleDelete());
  }

  /**
   * Truncate long file paths for display
   */
  private truncatePath(path: string): string {
    if (path.length <= 50) return path;
    return '...' + path.slice(-47);
  }

  /**
   * Handle download button click
   */
  private async handleDownload(): Promise<void> {
    if (this.isDownloading) return;

    this.isDownloading = true;
    const downloadBtn = this.container.querySelector('#download-model-btn') as HTMLButtonElement;
    const progressContainer = this.container.querySelector('.progress-container') as HTMLElement;
    const progressBar = this.container.querySelector('progress') as HTMLProgressElement;
    const progressText = this.container.querySelector('.progress-text') as HTMLElement;

    downloadBtn.disabled = true;
    progressContainer.style.display = 'block';

    // Set up progress listener
    this.progressListener = (progress) => {
      const percent = Math.round(progress.percent);
      progressBar.value = percent;

      if (progress.stage === 'downloading') {
        const downloadedMB = ((progress.downloaded || 0) / (1024 * 1024)).toFixed(1);
        const totalMB = ((progress.total || 0) / (1024 * 1024)).toFixed(1);
        progressText.textContent = `Downloading: ${downloadedMB}MB / ${totalMB}MB (${percent}%)`;
      } else if (progress.stage === 'extracting') {
        progressText.textContent = `Extracting files... (${percent}%)`;
      } else if (progress.stage === 'validating') {
        progressText.textContent = 'Validating model...';
      }
    };
    window.scribeCat.transcription.vosk.model.onDownloadProgress(this.progressListener);

    try {
      const result = await window.scribeCat.transcription.vosk.model.download();

      if (result.success) {
        progressText.textContent = '✅ Download complete!';
        
        // Auto-configure model URL after successful download
        try {
          const paths = await window.scribeCat.transcription.vosk.model.getPath();
          
          if (paths.path) {
            const modelUrl = `http://localhost:8765/vosk-model-en-us-0.22`;
            
            // Save both URL and path to settings
            await window.scribeCat.store.set('transcription.vosk.modelUrl', modelUrl);
            await window.scribeCat.store.set('transcription.vosk.modelPath', paths.path);
            
            // Start the server with the model path
            await window.scribeCat.transcription.vosk.startServer(paths.path);
            
            console.log('Vosk model configured:', { modelUrl, modelPath: paths.path });
          }
        } catch (configError) {
          console.error('Failed to auto-configure model URL:', configError);
          // Don't fail the download, just log the error
        }
        
        setTimeout(() => {
          this.render(); // Re-render to show installed state
        }, 1500);
      } else {
        this.showError(progressText, result.error || 'Download failed. Please try again.');
        downloadBtn.disabled = false;
      }
    } catch (error) {
      console.error('Download error:', error);
      this.showError(progressText, this.getErrorMessage(error));
      downloadBtn.disabled = false;
    } finally {
      this.isDownloading = false;
      if (this.progressListener) {
        window.scribeCat.transcription.vosk.model.removeDownloadProgressListener(this.progressListener);
        this.progressListener = null;
      }
    }
  }

  /**
   * Handle re-download button click
   */
  private async handleRedownload(): Promise<void> {
    const confirmed = confirm(
      'This will delete the existing model and download it again. Continue?'
    );

    if (!confirmed) return;

    // Delete first, then download
    try {
      const deleteResult = await window.scribeCat.transcription.vosk.model.delete();
      if (deleteResult.success) {
        await this.render(); // Re-render to show not-installed state
        // Trigger download
        setTimeout(() => {
          const downloadBtn = this.container.querySelector('#download-model-btn') as HTMLButtonElement;
          if (downloadBtn) {
            downloadBtn.click();
          }
        }, 100);
      } else {
        alert('Failed to delete model: ' + (deleteResult.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Re-download error:', error);
      alert('Failed to delete model: ' + error);
    }
  }

  /**
   * Handle delete button click
   */
  private async handleDelete(): Promise<void> {
    const confirmed = confirm(
      'Are you sure you want to delete the Vosk model? You will need to download it again to use offline transcription.'
    );

    if (!confirmed) return;

    try {
      const result = await window.scribeCat.transcription.vosk.model.delete();

      if (result.success) {
        await this.render(); // Re-render to show not-installed state
      } else {
        alert('Failed to delete model: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete model: ' + error);
    }
  }

  /**
   * Show error message
   */
  private showError(element: HTMLElement, message: string): void {
    element.textContent = `❌ ${message}`;
    element.style.color = '#e74c3c';
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    const errorStr = error?.toString() || '';

    if (errorStr.includes('ENOTFOUND') || errorStr.includes('network')) {
      return 'Unable to download. Check your internet connection and try again.';
    } else if (errorStr.includes('ENOSPC') || errorStr.includes('space')) {
      return 'Not enough disk space. 1.8GB required.';
    } else {
      return 'Download failed. Please try again.';
    }
  }

  /**
   * Refresh the section (re-render based on current state)
   */
  async refresh(): Promise<void> {
    await this.render();
  }
}
