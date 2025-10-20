/**
 * Settings Manager
 * 
 * Handles the settings modal UI and persistence of user preferences.
 */

export class SettingsManager {
  private settingsModal: HTMLElement;
  private modelUrlModal: HTMLElement;
  private transcriptionMode: 'simulation' | 'vosk' = 'simulation';
  private modelUrl: string = '';

  constructor() {
    this.settingsModal = document.getElementById('settings-modal')!;
    this.modelUrlModal = document.getElementById('model-url-modal')!;
    
    this.initializeEventListeners();
    this.loadSettings();
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    // Settings button - open modal
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn?.addEventListener('click', () => this.openSettings());

    // Close settings modal
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    closeSettingsBtn?.addEventListener('click', () => this.closeSettings());

    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    cancelSettingsBtn?.addEventListener('click', () => this.closeSettings());

    // Save settings
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    saveSettingsBtn?.addEventListener('click', () => this.saveSettings());

    // Model URL edit modal
    const chooseModelBtn = document.getElementById('choose-model-btn');
    chooseModelBtn?.addEventListener('click', () => this.openModelUrlModal());

    const closeModelUrlBtn = document.getElementById('close-model-url-btn');
    closeModelUrlBtn?.addEventListener('click', () => this.closeModelUrlModal());

    const cancelModelUrlBtn = document.getElementById('cancel-model-url-btn');
    cancelModelUrlBtn?.addEventListener('click', () => this.closeModelUrlModal());

    const saveModelUrlBtn = document.getElementById('save-model-url-btn');
    saveModelUrlBtn?.addEventListener('click', () => this.saveModelUrl());

    // Model help link
    const modelHelpLink = document.getElementById('model-help-link');
    modelHelpLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showModelHelp();
    });

    // Close modals on overlay click
    this.settingsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeSettings();
    });

    this.modelUrlModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeModelUrlModal();
    });

    // Transcription mode change
    const modeRadios = document.querySelectorAll('input[name="transcription-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.updateVoskSettingsVisibility(target.value as 'simulation' | 'vosk');
      });
    });
  }

  /**
   * Load settings from electron-store
   */
  private async loadSettings(): Promise<void> {
    try {
      // Load transcription mode
      const mode = await window.scribeCat.store.get('transcription-mode');
      this.transcriptionMode = (mode as 'simulation' | 'vosk') || 'simulation';

      // Load model URL
      const url = await window.scribeCat.store.get('vosk-model-url');
      this.modelUrl = (url as string) || '';

      // Update UI
      this.updateUIFromSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Update UI elements from loaded settings
   */
  private updateUIFromSettings(): void {
    // Set transcription mode radio
    const modeRadio = document.getElementById(
      `mode-${this.transcriptionMode}`
    ) as HTMLInputElement;
    if (modeRadio) {
      modeRadio.checked = true;
    }

    // Set model URL
    const modelPathDisplay = document.getElementById('model-path-display') as HTMLInputElement;
    if (modelPathDisplay) {
      modelPathDisplay.value = this.modelUrl;
    }

    // Update Vosk settings visibility
    this.updateVoskSettingsVisibility(this.transcriptionMode);

    // Validate model if URL is set
    if (this.modelUrl) {
      this.validateModel(this.modelUrl);
    }
  }

  /**
   * Open settings modal
   */
  private openSettings(): void {
    this.settingsModal.classList.remove('hidden');
    // Reload settings to ensure UI is up to date
    this.updateUIFromSettings();
  }

  /**
   * Close settings modal
   */
  private closeSettings(): void {
    this.settingsModal.classList.add('hidden');
  }

  /**
   * Save settings to electron-store
   */
  private async saveSettings(): Promise<void> {
    try {
      // Get selected transcription mode
      const modeRadio = document.querySelector(
        'input[name="transcription-mode"]:checked'
      ) as HTMLInputElement;
      const mode = modeRadio?.value || 'simulation';

      // Save to store
      await window.scribeCat.store.set('transcription-mode', mode);
      await window.scribeCat.store.set('vosk-model-url', this.modelUrl);

      this.transcriptionMode = mode as 'simulation' | 'vosk';

      // Show confirmation
      this.showNotification('Settings saved successfully!', 'success');

      // Close modal
      this.closeSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  /**
   * Open model URL edit modal
   */
  private openModelUrlModal(): void {
    const modelUrlInput = document.getElementById('model-url-input') as HTMLInputElement;
    if (modelUrlInput) {
      modelUrlInput.value = this.modelUrl;
    }
    this.modelUrlModal.classList.remove('hidden');
  }

  /**
   * Close model URL edit modal
   */
  private closeModelUrlModal(): void {
    this.modelUrlModal.classList.add('hidden');
  }

  /**
   * Save model URL from edit modal
   */
  private async saveModelUrl(): Promise<void> {
    const modelUrlInput = document.getElementById('model-url-input') as HTMLInputElement;
    const url = modelUrlInput?.value.trim() || '';

    if (!url) {
      this.showNotification('Please enter a model URL', 'error');
      return;
    }

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      this.showNotification('Model URL must start with http:// or https://', 'error');
      return;
    }

    this.modelUrl = url;

    // Update display
    const modelPathDisplay = document.getElementById('model-path-display') as HTMLInputElement;
    if (modelPathDisplay) {
      modelPathDisplay.value = url;
    }

    // Validate model
    await this.validateModel(url);

    this.closeModelUrlModal();
  }

  /**
   * Validate model URL
   */
  private async validateModel(url: string): Promise<void> {
    const statusIndicator = document.getElementById('model-status-indicator');
    if (!statusIndicator) return;

    // Show loading state
    statusIndicator.className = 'status-indicator status-unknown';
    statusIndicator.innerHTML = `
      <span class="status-icon">⏳</span>
      <span class="status-text">Validating...</span>
    `;

    try {
      // Try to fetch the model URL to check if it's accessible
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        statusIndicator.className = 'status-indicator status-valid';
        statusIndicator.innerHTML = `
          <span class="status-icon">✅</span>
          <span class="status-text">Model accessible</span>
        `;
      } else {
        statusIndicator.className = 'status-indicator status-invalid';
        statusIndicator.innerHTML = `
          <span class="status-icon">❌</span>
          <span class="status-text">Model not accessible (${response.status})</span>
        `;
      }
    } catch (error) {
      statusIndicator.className = 'status-indicator status-invalid';
      statusIndicator.innerHTML = `
        <span class="status-icon">❌</span>
        <span class="status-text">Cannot reach model URL</span>
      `;
    }
  }

  /**
   * Update Vosk settings section visibility
   */
  private updateVoskSettingsVisibility(mode: 'simulation' | 'vosk'): void {
    const voskSettings = document.getElementById('vosk-settings');
    if (voskSettings) {
      if (mode === 'vosk') {
        voskSettings.style.opacity = '1';
        voskSettings.style.pointerEvents = 'auto';
      } else {
        voskSettings.style.opacity = '0.5';
        voskSettings.style.pointerEvents = 'none';
      }
    }
  }

  /**
   * Show model setup help
   */
  private showModelHelp(): void {
    const helpMessage = `
To set up Vosk transcription:

1. Download a Vosk model from:
   https://alphacephei.com/vosk/models

2. Extract the model files to a folder

3. Serve the model via HTTP:
   
   Using Python:
   cd /path/to/model-folder
   python3 -m http.server 8000
   
   Using Node.js:
   npx http-server -p 8000 --cors

4. Enter the model URL:
   http://localhost:8000/vosk-model-small-en-us-0.15

For more details, see the documentation.
    `.trim();

    alert(helpMessage);
  }

  /**
   * Show notification message
   */
  private showNotification(message: string, type: 'success' | 'error'): void {
    // Simple notification - could be enhanced with a toast component
    const color = type === 'success' ? '#27ae60' : '#e74c3c';
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background-color: ${color};
      color: white;
      padding: 15px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2000;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  /**
   * Get current transcription mode
   */
  public getTranscriptionMode(): 'simulation' | 'vosk' {
    return this.transcriptionMode;
  }

  /**
   * Get current model URL
   */
  public getModelUrl(): string {
    return this.modelUrl;
  }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);
