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
    drive: {
      configure: (config: any) => Promise<any>;
      isAuthenticated: () => Promise<any>;
      getAuthUrl: () => Promise<any>;
      setCredentials: (config: any) => Promise<any>;
      disconnect: () => Promise<any>;
      getUserEmail: () => Promise<any>;
    };
  };
};

export class SettingsManager {
  private settingsModal: HTMLElement;
  private transcriptionMode: 'simulation' | 'assemblyai' = 'simulation';
  private assemblyAIApiKey: string = '';
  private claudeApiKey: string = '';
  private driveConnected: boolean = false;
  private driveUserEmail: string = '';

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
    
    // Google Drive connect button
    const connectDriveBtn = document.getElementById('connect-drive-btn');
    connectDriveBtn?.addEventListener('click', () => this.connectGoogleDrive());
    
    // Google Drive disconnect button
    const disconnectDriveBtn = document.getElementById('disconnect-drive-btn');
    disconnectDriveBtn?.addEventListener('click', () => this.disconnectGoogleDrive());
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
      
      // Check Google Drive connection status
      await this.checkDriveConnection();

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
    
    // Update Google Drive status
    this.updateDriveConnectionUI();
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
      // Save transcription mode
      const modeRadio = document.querySelector(
        'input[name="transcription-mode"]:checked'
      ) as HTMLInputElement;
      if (modeRadio) {
        this.transcriptionMode = modeRadio.value as 'simulation' | 'assemblyai';
        await window.scribeCat.store.set('transcription-mode', this.transcriptionMode);
      }

      // Save AssemblyAI API key
      await window.scribeCat.store.set('assemblyai-api-key', this.assemblyAIApiKey);
      
      // Save Claude API key
      await window.scribeCat.store.set('claude-api-key', this.claudeApiKey);
      
      // Update AI service with new key
      if (this.claudeApiKey) {
        await window.scribeCat.ai.setApiKey(this.claudeApiKey);
      }

      this.showNotification('Settings saved successfully!', 'success');
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
  
  /**
   * Check Google Drive connection status
   */
  private async checkDriveConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      this.driveConnected = result.data || false;
      
      if (this.driveConnected) {
        // Try to get user email
        const emailResult = await window.scribeCat.drive.getUserEmail();
        this.driveUserEmail = emailResult.data || '';
      }
    } catch (error) {
      console.error('Failed to check Drive connection:', error);
      this.driveConnected = false;
      this.driveUserEmail = '';
    }
  }
  
  /**
   * Update Google Drive connection UI
   */
  private updateDriveConnectionUI(): void {
    const statusEl = document.getElementById('drive-status');
    const connectBtn = document.getElementById('connect-drive-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-drive-btn') as HTMLButtonElement;
    
    if (!statusEl || !connectBtn || !disconnectBtn) return;
    
    if (this.driveConnected) {
      statusEl.textContent = this.driveUserEmail 
        ? `Connected as ${this.driveUserEmail}` 
        : 'Connected';
      statusEl.style.color = '#27ae60';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
    } else {
      statusEl.textContent = 'Not connected';
      statusEl.style.color = '#95a5a6';
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
    }
  }
  
  /**
   * Show a custom input dialog (replacement for prompt())
   */
  private showInputDialog(title: string, message: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      // Create dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #2c2c2c;
        border-radius: 8px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      `;
      
      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">${title}</h3>
        <p style="margin: 0 0 16px 0; color: #ccc; font-size: 14px;">${message}</p>
        <input type="text" id="custom-input-field" style="
          width: 100%;
          padding: 10px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #1e1e1e;
          color: #fff;
          font-size: 14px;
          box-sizing: border-box;
          margin-bottom: 16px;
        " placeholder="Paste authorization code here">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="custom-input-cancel" style="
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #555;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
          ">Cancel</button>
          <button id="custom-input-ok" style="
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #27ae60;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
          ">OK</button>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      
      const inputField = document.getElementById('custom-input-field') as HTMLInputElement;
      const cancelBtn = document.getElementById('custom-input-cancel');
      const okBtn = document.getElementById('custom-input-ok');
      
      // Focus input field
      setTimeout(() => inputField?.focus(), 100);
      
      // Handle cancel
      const handleCancel = () => {
        document.body.removeChild(overlay);
        resolve(null);
      };
      
      // Handle OK
      const handleOk = () => {
        const value = inputField?.value.trim() || '';
        document.body.removeChild(overlay);
        resolve(value || null);
      };
      
      // Event listeners
      cancelBtn?.addEventListener('click', handleCancel);
      okBtn?.addEventListener('click', handleOk);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleCancel();
      });
      inputField?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleOk();
        if (e.key === 'Escape') handleCancel();
      });
    });
  }
  
  /**
   * Connect to Google Drive
   */
  private async connectGoogleDrive(): Promise<void> {
    try {
      // Get auth URL
      const result = await window.scribeCat.drive.getAuthUrl();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get auth URL');
      }
      
      const authUrl = result.data.authUrl || result.data;
      
      // Open auth URL in browser
      window.open(authUrl, '_blank');
      
      // Show custom input dialog
      const code = await this.showInputDialog(
        'Google Drive Authorization',
        'Please sign in with Google in the browser, then paste the authorization code here:'
      );
      
      if (!code) {
        this.showNotification('Connection cancelled', 'error');
        return;
      }
      
      // Exchange authorization code for tokens (this calls Google's API)
      const exchangeResult = await window.scribeCat.drive.exchangeCodeForTokens(code);
      if (!exchangeResult.success) {
        throw new Error(exchangeResult.error || 'Failed to authenticate');
      }
      
      // Store user email if available
      if (exchangeResult.email) {
        this.driveUserEmail = exchangeResult.email;
      }
      
      this.driveConnected = true;
      this.updateDriveConnectionUI();
      this.showNotification('Google Drive connected successfully!', 'success');
      
    } catch (error) {
      console.error('Google Drive connection failed:', error);
      this.showNotification(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }
  
  /**
   * Disconnect from Google Drive
   */
  private async disconnectGoogleDrive(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Google Drive?');
      if (!confirmed) return;
      
      await window.scribeCat.drive.disconnect();
      
      this.driveConnected = false;
      this.driveUserEmail = '';
      this.updateDriveConnectionUI();
      this.showNotification('Google Drive disconnected', 'success');
      
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error);
      this.showNotification('Failed to disconnect', 'error');
    }
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
