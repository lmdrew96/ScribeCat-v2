/// <reference path="../../shared/window.d.ts" />

/**
 * First-run setup dialog for Vosk model download
 * Shows on first launch if model is not installed
 */

export class VoskSetupDialog {
  private dialog: HTMLDialogElement;
  private progressContainer: HTMLElement;
  private progressBar: HTMLProgressElement;
  private progressText: HTMLElement;
  private downloadBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private progressListener: ((progress: any) => void) | null = null;
  private isDownloading = false;

  constructor() {
    this.dialog = this.createDialog();
    document.body.appendChild(this.dialog);

    // Get references to elements
    this.progressContainer = this.dialog.querySelector('.progress-container')!;
    this.progressBar = this.dialog.querySelector('progress')!;
    this.progressText = this.dialog.querySelector('.progress-text')!;
    this.downloadBtn = this.dialog.querySelector('.download-btn')!;
    this.skipBtn = this.dialog.querySelector('.skip-btn')!;

    // Set up event listeners
    this.downloadBtn.addEventListener('click', () => this.startDownload());
    this.skipBtn.addEventListener('click', () => this.handleSkip());

    // Prevent closing dialog with ESC during download
    this.dialog.addEventListener('cancel', (e) => {
      if (this.isDownloading) {
        e.preventDefault();
      }
    });
  }

  private createDialog(): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.className = 'vosk-setup-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h2>Welcome to ScribeCat!</h2>
        <p>ScribeCat uses offline speech recognition. To get started, we need to download a language model.</p>
        <div class="warning">⚠️ One-time download: ~1.8GB required</div>
        
        <div class="progress-container" style="display: none;">
          <progress value="0" max="100"></progress>
          <p class="progress-text">Preparing download...</p>
        </div>
        
        <div class="dialog-actions">
          <button class="btn-secondary skip-btn">Skip for Now</button>
          <button class="btn-primary download-btn">Download Now</button>
        </div>
      </div>
    `;
    return dialog;
  }

  /**
   * Show the dialog if model is not installed
   */
  async show(): Promise<void> {
    const check = await window.scribeCat.transcription.vosk.model.isInstalled();
    
    if (!check.isInstalled) {
      this.dialog.showModal();
    }
  }

  /**
   * Start downloading the model
   */
  private async startDownload(): Promise<void> {
    if (this.isDownloading) return;

    this.isDownloading = true;
    this.downloadBtn.disabled = true;
    this.skipBtn.disabled = true;
    this.progressContainer.style.display = 'block';

    // Set up progress listener
    this.progressListener = (progress) => {
      this.updateProgress(progress);
    };
    window.scribeCat.transcription.vosk.model.onDownloadProgress(this.progressListener);

    try {
      const result = await window.scribeCat.transcription.vosk.model.download();

      if (result.success) {
        this.progressText.textContent = '✅ Download complete!';
        
        // Auto-configure model URL after successful download
        try {
          const paths = await window.scribeCat.transcription.vosk.model.getPath();
          console.log('Model paths received:', paths);
          
          // Extract the actual model path string
          const modelPath = paths.modelPath;
          
          if (!modelPath || typeof modelPath !== 'string') {
            throw new Error('Invalid model path received from server');
          }
          
          const modelUrl = `http://localhost:8765/vosk-model-en-us-0.22`;
          
          // Save both URL and path to settings
          await window.scribeCat.store.set('transcription.vosk.modelUrl', modelUrl);
          await window.scribeCat.store.set('transcription.vosk.modelPath', modelPath);
          
          // Start the server with the model path
          await window.scribeCat.transcription.vosk.startServer(modelPath);
          
          console.log('Vosk model configured:', { modelUrl, modelPath });
        } catch (configError) {
          console.error('Failed to auto-configure model URL:', configError);
          // Don't fail the download, just log the error
        }
        
        setTimeout(() => {
          this.hide();
        }, 1500);
      } else {
        this.showError(result.error || 'Download failed. Please try again.');
      }
    } catch (error) {
      console.error('Download error:', error);
      this.showError(this.getErrorMessage(error));
    }
  }

  /**
   * Update progress bar and text
   */
  private updateProgress(progress: any): void {
    const percent = Math.round(progress.percent);
    this.progressBar.value = percent;

    if (progress.stage === 'downloading') {
      const downloadedMB = (progress.downloaded / (1024 * 1024)).toFixed(1);
      const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
      this.progressText.textContent = `Downloading: ${downloadedMB}MB / ${totalMB}MB (${percent}%)`;
    } else if (progress.stage === 'extracting') {
      this.progressText.textContent = `Extracting files... (${percent}%)`;
    } else if (progress.stage === 'validating') {
      this.progressText.textContent = 'Validating model...';
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.progressText.textContent = `❌ ${message}`;
    this.progressText.style.color = '#e74c3c';
    this.downloadBtn.disabled = false;
    this.downloadBtn.textContent = 'Retry Download';
    this.skipBtn.disabled = false;
    this.isDownloading = false;
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
   * Handle skip button click
   */
  private handleSkip(): void {
    // Store flag in localStorage so we don't show again this session
    localStorage.setItem('vosk-setup-skipped', 'true');
    this.hide();
  }

  /**
   * Hide and clean up the dialog
   */
  hide(): void {
    // Remove progress listener
    if (this.progressListener) {
      window.scribeCat.transcription.vosk.model.removeDownloadProgressListener(this.progressListener);
      this.progressListener = null;
    }

    this.dialog.close();
    this.isDownloading = false;
  }

  /**
   * Clean up and remove dialog from DOM
   */
  destroy(): void {
    this.hide();
    this.dialog.remove();
  }
}
