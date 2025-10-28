/**
 * Settings Manager
 * 
 * Handles the settings modal UI and persistence of user preferences.
 */

declare const window: Window & {
  scribeCat: {
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
    };
    ai: {
      setApiKey: (apiKey: string) => Promise<any>;
    };
  };
};

export class SettingsManager {
  private settingsModal: HTMLElement;
  private transcriptionMode: 'simulation' | 'assemblyai' = 'simulation';
  private assemblyAIApiKey: string = '';
  private claudeApiKey: string = '';

  constructor() {
    this.settingsModal = document.getElementById('settings-modal')!;
    
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

    // Close modals on overlay click
    this.settingsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeSettings();
    });

    // Transcription mode change
    const modeRadios = document.querySelectorAll('input[name="transcription-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.updateSettingsSectionsVisibility(target.value as 'simulation' | 'assemblyai');
      });
    });
    
    // AssemblyAI API key input
    const assemblyAIApiKeyInput = document.getElementById('assemblyai-api-key') as HTMLInputElement;
    assemblyAIApiKeyInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.assemblyAIApiKey = target.value.trim();
      this.updateAssemblyAIStatus();
    });
    
    // Claude API key input
    const claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
    claudeApiKeyInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.claudeApiKey = target.value.trim();
    });
  }

  /**
   * Load settings from electron-store
   */
  private async loadSettings(): Promise<void> {
    try {
      // Load transcription mode
      const mode = await window.scribeCat.store.get('transcription-mode');
      this.transcriptionMode = (mode as 'simulation' | 'assemblyai') || 'simulation';

      // Load AssemblyAI API key
      const apiKey = await window.scribeCat.store.get('assemblyai-api-key');
      this.assemblyAIApiKey = (apiKey as string) || '';
      
      // Load Claude API key
      const claudeKey = await window.scribeCat.store.get('claude-api-key');
      this.claudeApiKey = (claudeKey as string) || '';
      
      // Initialize AI service with stored key if it exists
      if (this.claudeApiKey) {
        await window.scribeCat.ai.setApiKey(this.claudeApiKey);
      }

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

    // Set AssemblyAI API key
    const assemblyAIApiKeyInput = document.getElementById('assemblyai-api-key') as HTMLInputElement;
    if (assemblyAIApiKeyInput) {
      assemblyAIApiKeyInput.value = this.assemblyAIApiKey;
    }
    
    // Set Claude API key
    const claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
    if (claudeApiKeyInput) {
      claudeApiKeyInput.value = this.claudeApiKey;
    }

    // Update settings sections visibility
    this.updateSettingsSectionsVisibility(this.transcriptionMode);

    // Update AssemblyAI status
    this.updateAssemblyAIStatus();
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

      // Validate AssemblyAI API key if that mode is selected
      if (mode === 'assemblyai' && !this.assemblyAIApiKey) {
        this.showNotification('Please enter an AssemblyAI API key', 'error');
        return;
      }

      // Save to store
      await window.scribeCat.store.set('transcription-mode', mode);
      await window.scribeCat.store.set('assemblyai-api-key', this.assemblyAIApiKey);
      
      // Save Claude API key if provided
      if (this.claudeApiKey) {
        await window.scribeCat.store.set('claude-api-key', this.claudeApiKey);
        // Configure AI service with the new key
        await window.scribeCat.ai.setApiKey(this.claudeApiKey);
      }

      this.transcriptionMode = mode as 'simulation' | 'assemblyai';

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
   * Update settings sections visibility based on selected mode
   */
  private updateSettingsSectionsVisibility(mode: 'simulation' | 'assemblyai'): void {
    const assemblyAISettings = document.getElementById('assemblyai-settings');
    
    // Update AssemblyAI settings visibility
    if (assemblyAISettings) {
      if (mode === 'assemblyai') {
        assemblyAISettings.classList.add('active');
      } else {
        assemblyAISettings.classList.remove('active');
      }
    }
  }
  
  /**
   * Update AssemblyAI status indicator
   */
  private updateAssemblyAIStatus(): void {
    const statusEl = document.getElementById('assemblyai-status');
    if (!statusEl) return;
    
    if (this.assemblyAIApiKey) {
      statusEl.textContent = '✅ API key configured';
      statusEl.style.color = '#27ae60';
    } else {
      statusEl.textContent = '❌ Not configured';
      statusEl.style.color = '#e74c3c';
    }
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
  public getTranscriptionMode(): 'simulation' | 'assemblyai' {
    return this.transcriptionMode;
  }

  /**
   * Get AssemblyAI API key
   */
  public getAssemblyAIApiKey(): string {
    return this.assemblyAIApiKey;
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
