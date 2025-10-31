/**
 * Settings Manager
 * 
 * Handles the settings modal UI and persistence of user preferences.
 */

import { ThemeManager } from './themes/ThemeManager.js';
import type { Theme } from './themes/types.js';

export class SettingsManager {
  private settingsModal: HTMLElement;
  private transcriptionMode: 'simulation' | 'assemblyai' = 'simulation';
  private assemblyAIApiKey: string = '';
  private claudeApiKey: string = '';
  private driveConnected: boolean = false;
  private driveUserEmail: string = '';
  private canvasUrl: string = '';
  private canvasToken: string = '';
  private canvasConfigured: boolean = false;
  
  // Auto-polish settings
  private autoPolishEnabled: boolean = false;
  private autoPolishInterval: number = 30;
  private autoPolishJitter: number = 5;
  private autoPolishMinWords: number = 50;
  private autoPolishFullInterval: number = 5;
  
  // Theme manager
  private themeManager: ThemeManager;
  private selectedThemeId: string = '';

  // Theme filter state
  private currentCategoryFilter: string = 'all';
  private currentVariantFilter: string = 'all';

  // Collapsible groups state
  private collapsedGroups: Set<string> = new Set();

  constructor(themeManager: ThemeManager) {
    this.themeManager = themeManager;
    this.settingsModal = document.getElementById('settings-modal')!;

    this.initializeEventListeners();
    this.initializeCollapsibleGroups();
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
    
    // Canvas URL input
    const canvasUrlInput = document.getElementById('canvas-url') as HTMLInputElement;
    canvasUrlInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.canvasUrl = target.value.trim();
    });
    
    // Canvas token input
    const canvasTokenInput = document.getElementById('canvas-token') as HTMLInputElement;
    canvasTokenInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.canvasToken = target.value.trim();
    });
    
    // Canvas test connection button
    const testCanvasBtn = document.getElementById('test-canvas-btn');
    testCanvasBtn?.addEventListener('click', () => this.testCanvasConnection());
    
    // Canvas disconnect button
    const disconnectCanvasBtn = document.getElementById('disconnect-canvas-btn');
    disconnectCanvasBtn?.addEventListener('click', () => this.disconnectCanvas());
    
    // Canvas import courses button
    const importCoursesBtn = document.getElementById('import-canvas-courses-btn');
    importCoursesBtn?.addEventListener('click', () => this.importCanvasCourses());
    
    // Extension help link
    const extensionHelpLink = document.getElementById('extension-help-link');
    extensionHelpLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showExtensionHelp();
    });
    
    // Auto-polish enabled toggle
    const autoPolishEnabledCheckbox = document.getElementById('auto-polish-enabled') as HTMLInputElement;
    autoPolishEnabledCheckbox?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.autoPolishEnabled = target.checked;
      this.updateAutoPolishOptionsVisibility();
    });
    
    // Auto-polish interval input
    const autoPolishIntervalInput = document.getElementById('auto-polish-interval') as HTMLInputElement;
    autoPolishIntervalInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.autoPolishInterval = parseInt(target.value, 10);
    });
    
    // Auto-polish jitter input
    const autoPolishJitterInput = document.getElementById('auto-polish-jitter') as HTMLInputElement;
    autoPolishJitterInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.autoPolishJitter = parseInt(target.value, 10);
    });
    
    // Auto-polish min words input
    const autoPolishMinWordsInput = document.getElementById('auto-polish-min-words') as HTMLInputElement;
    autoPolishMinWordsInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.autoPolishMinWords = parseInt(target.value, 10);
    });
    
    // Auto-polish full interval input
    const autoPolishFullIntervalInput = document.getElementById('auto-polish-full-interval') as HTMLInputElement;
    autoPolishFullIntervalInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.autoPolishFullInterval = parseInt(target.value, 10);
    });
    
    // Theme category filter
    const themeCategoryFilter = document.getElementById('theme-category-filter') as HTMLSelectElement;
    themeCategoryFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentCategoryFilter = target.value;
      this.filterThemes();
    });

    // Theme variant filter
    const themeVariantFilter = document.getElementById('theme-variant-filter') as HTMLSelectElement;
    themeVariantFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentVariantFilter = target.value;
      this.filterThemes();
    });
  }

  /**
   * Initialize collapsible groups functionality
   */
  private initializeCollapsibleGroups(): void {
    const groupHeaders = document.querySelectorAll('.settings-group-header');

    groupHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.settings-group') as HTMLElement;
        if (group) {
          const groupId = group.dataset.group;
          if (groupId) {
            this.toggleGroup(groupId);
          }
        }
      });
    });
  }

  /**
   * Toggle collapse state of a settings group
   */
  private toggleGroup(groupId: string): void {
    const group = document.querySelector(`.settings-group[data-group="${groupId}"]`);
    if (!group) return;

    if (this.collapsedGroups.has(groupId)) {
      // Expand the group
      this.collapsedGroups.delete(groupId);
      group.classList.remove('collapsed');
    } else {
      // Collapse the group
      this.collapsedGroups.add(groupId);
      group.classList.add('collapsed');
    }

    // Save collapsed state
    this.saveCollapsedState();
  }

  /**
   * Save collapsed groups state to electron-store
   */
  private async saveCollapsedState(): Promise<void> {
    try {
      const collapsedArray = Array.from(this.collapsedGroups);
      await window.scribeCat.store.set('settings-collapsed-groups', collapsedArray);
    } catch (error) {
      console.error('Failed to save collapsed state:', error);
    }
  }

  /**
   * Load collapsed groups state from electron-store
   */
  private async loadCollapsedState(): Promise<void> {
    try {
      const collapsedArray = await window.scribeCat.store.get('settings-collapsed-groups') as string[];
      if (Array.isArray(collapsedArray)) {
        this.collapsedGroups = new Set(collapsedArray);

        // Apply collapsed state to UI
        collapsedArray.forEach(groupId => {
          const group = document.querySelector(`.settings-group[data-group="${groupId}"]`);
          if (group) {
            group.classList.add('collapsed');
          }
        });
      }
    } catch (error) {
      console.error('Failed to load collapsed state:', error);
    }
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
      
      // Check Canvas connection status
      await this.checkCanvasConnection();
      
      // Load auto-polish settings
      this.autoPolishEnabled = await window.scribeCat.store.get('auto-polish-enabled') as boolean || false;
      this.autoPolishInterval = await window.scribeCat.store.get('auto-polish-interval') as number || 30;
      this.autoPolishJitter = await window.scribeCat.store.get('auto-polish-jitter') as number || 5;
      this.autoPolishMinWords = await window.scribeCat.store.get('auto-polish-min-words') as number || 50;
      this.autoPolishFullInterval = await window.scribeCat.store.get('auto-polish-full-interval') as number || 5;

      // Load collapsed groups state
      await this.loadCollapsedState();

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
    
    // Update Canvas status
    this.updateCanvasConnectionUI();
    
    // Update auto-polish settings
    const autoPolishEnabledCheckbox = document.getElementById('auto-polish-enabled') as HTMLInputElement;
    if (autoPolishEnabledCheckbox) {
      autoPolishEnabledCheckbox.checked = this.autoPolishEnabled;
    }
    
    const autoPolishIntervalInput = document.getElementById('auto-polish-interval') as HTMLInputElement;
    if (autoPolishIntervalInput) {
      autoPolishIntervalInput.value = this.autoPolishInterval.toString();
    }
    
    const autoPolishJitterInput = document.getElementById('auto-polish-jitter') as HTMLInputElement;
    if (autoPolishJitterInput) {
      autoPolishJitterInput.value = this.autoPolishJitter.toString();
    }
    
    const autoPolishMinWordsInput = document.getElementById('auto-polish-min-words') as HTMLInputElement;
    if (autoPolishMinWordsInput) {
      autoPolishMinWordsInput.value = this.autoPolishMinWords.toString();
    }
    
    const autoPolishFullIntervalInput = document.getElementById('auto-polish-full-interval') as HTMLInputElement;
    if (autoPolishFullIntervalInput) {
      autoPolishFullIntervalInput.value = this.autoPolishFullInterval.toString();
    }
    
    this.updateAutoPolishOptionsVisibility();
  }

  /**
   * Open settings modal
   */
  private openSettings(): void {
    this.settingsModal.classList.remove('hidden');
    // Reload settings to ensure UI is up to date
    this.updateUIFromSettings();
    // Populate themes
    this.populateThemes();
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
      
      // Save auto-polish settings
      await window.scribeCat.store.set('auto-polish-enabled', this.autoPolishEnabled);
      await window.scribeCat.store.set('auto-polish-interval', this.autoPolishInterval);
      await window.scribeCat.store.set('auto-polish-jitter', this.autoPolishJitter);
      await window.scribeCat.store.set('auto-polish-min-words', this.autoPolishMinWords);
      await window.scribeCat.store.set('auto-polish-full-interval', this.autoPolishFullInterval);

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
   * Update auto-polish options visibility
   */
  private updateAutoPolishOptionsVisibility(): void {
    const optionsContainer = document.getElementById('auto-polish-options');
    if (optionsContainer) {
      optionsContainer.style.display = this.autoPolishEnabled ? 'block' : 'none';
    }
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
  
  /**
   * Test Canvas connection
   */
  private async testCanvasConnection(): Promise<void> {
    try {
      if (!this.canvasUrl || !this.canvasToken) {
        this.showNotification('Please enter Canvas URL and API token', 'error');
        return;
      }
      
      // Configure Canvas with the provided credentials
      const configResult = await window.scribeCat.canvas.configure({
        baseUrl: this.canvasUrl,
        apiToken: this.canvasToken
      });
      
      if (!configResult.success) {
        throw new Error(configResult.error || 'Failed to configure Canvas');
      }
      
      this.canvasConfigured = true;
      this.updateCanvasConnectionUI();
      this.showNotification('Canvas connected successfully!', 'success');
      
    } catch (error) {
      console.error('Canvas connection failed:', error);
      this.showNotification(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }
  
  /**
   * Disconnect from Canvas
   */
  private async disconnectCanvas(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Canvas?');
      if (!confirmed) return;

      await window.scribeCat.canvas.disconnect();
      
      this.canvasConfigured = false;
      this.canvasUrl = '';
      this.canvasToken = '';
      
      // Clear input fields
      const urlInput = document.getElementById('canvas-url') as HTMLInputElement;
      const tokenInput = document.getElementById('canvas-token') as HTMLInputElement;
      if (urlInput) urlInput.value = '';
      if (tokenInput) tokenInput.value = '';
      
      this.updateCanvasConnectionUI();
      this.showNotification('Canvas disconnected', 'success');
      
    } catch (error) {
      console.error('Failed to disconnect Canvas:', error);
      this.showNotification('Failed to disconnect', 'error');
    }
  }
  
  /**
   * Check Canvas connection status
   */
  private async checkCanvasConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.canvas.isConfigured();
      this.canvasConfigured = result.data?.configured || false;

      if (this.canvasConfigured) {
        // Get Canvas config to populate URL field
        const configResult = await window.scribeCat.canvas.getConfig();
        if (configResult.success && configResult.data) {
          this.canvasUrl = configResult.data.baseUrl || '';
          // Don't populate token for security
        }
      }
    } catch (error) {
      console.error('Failed to check Canvas connection:', error);
      this.canvasConfigured = false;
    }
  }
  
  /**
   * Update Canvas connection UI
   */
  private updateCanvasConnectionUI(): void {
    const statusEl = document.getElementById('canvas-status');
    const testBtn = document.getElementById('test-canvas-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-canvas-btn') as HTMLButtonElement;
    const urlInput = document.getElementById('canvas-url') as HTMLInputElement;
    const tokenInput = document.getElementById('canvas-token') as HTMLInputElement;
    
    if (!statusEl || !testBtn || !disconnectBtn) return;
    
    if (this.canvasConfigured) {
      statusEl.textContent = `Connected to ${this.canvasUrl}`;
      statusEl.style.color = '#27ae60';
      testBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      
      // Populate URL field
      if (urlInput && this.canvasUrl) {
        urlInput.value = this.canvasUrl;
      }
    } else {
      statusEl.textContent = 'Not configured';
      statusEl.style.color = '#95a5a6';
      testBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
    }
    
    // Load and display imported courses
    this.loadImportedCourses();
  }
  
  /**
   * Import Canvas courses from JSON
   */
  private async importCanvasCourses(): Promise<void> {
    try {
      const jsonTextarea = document.getElementById('canvas-import-json') as HTMLTextAreaElement;
      if (!jsonTextarea) return;
      
      const jsonData = jsonTextarea.value.trim();
      if (!jsonData) {
        this.showNotification('Please paste JSON data from the browser extension', 'error');
        return;
      }
      
      // Import courses via IPC
      const result = await window.scribeCat.canvas.importCourses(jsonData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to import courses');
      }
      
      // Clear textarea
      jsonTextarea.value = '';
      
      // Reload imported courses list
      await this.loadImportedCourses();
      
      // Trigger course manager refresh if it exists
      if (window.courseManager) {
        await window.courseManager.refresh();
      }
      
      this.showNotification(
        `Successfully imported ${result.data?.count ?? 0} course(s)!`,
        'success'
      );
      
    } catch (error) {
      console.error('Failed to import courses:', error);
      this.showNotification(
        `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }
  
  /**
   * Load and display imported courses
   */
  private async loadImportedCourses(): Promise<void> {
    try {
      const result = await window.scribeCat.canvas.getImportedCourses();
      const courses = result.data || [];
      
      const container = document.getElementById('imported-courses-container');
      const countEl = document.getElementById('imported-courses-count');
      const listEl = document.getElementById('imported-courses-list');
      
      if (!container || !countEl || !listEl) return;
      
      if (courses.length === 0) {
        container.style.display = 'none';
        return;
      }
      
      container.style.display = 'block';
      countEl.textContent = courses.length.toString();
      
      // Build courses list HTML
      listEl.innerHTML = courses.map((course: any) => `
        <div class="course-item" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          margin-bottom: 8px;
          background: #1e1e1e;
          border-radius: 4px;
          border: 1px solid #444;
        ">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">
              ${course.code || course.courseNumber || 'Unknown Code'}
            </div>
            <div style="font-size: 12px; color: #999;">
              ${course.title || course.courseTitle || 'Untitled Course'}
            </div>
          </div>
          <button 
            class="delete-course-btn" 
            data-course-id="${course.id}"
            style="
              padding: 6px 12px;
              background: #e74c3c;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            "
            title="Delete course"
          >
            Delete
          </button>
        </div>
      `).join('');
      
      // Add delete button listeners
      listEl.querySelectorAll('.delete-course-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const courseId = (e.target as HTMLElement).getAttribute('data-course-id');
          if (courseId) {
            await this.deleteImportedCourse(courseId);
          }
        });
      });
      
    } catch (error) {
      console.error('Failed to load imported courses:', error);
    }
  }
  
  /**
   * Delete an imported course
   */
  private async deleteImportedCourse(courseId: string): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to delete this course?');
      if (!confirmed) return;

      await window.scribeCat.canvas.deleteImportedCourse(courseId);
      await this.loadImportedCourses();
      this.showNotification('Course deleted', 'success');
      
    } catch (error) {
      console.error('Failed to delete course:', error);
      this.showNotification('Failed to delete course', 'error');
    }
  }
  
  /**
   * Show extension help information
   */
  private showExtensionHelp(): void {
    const helpMessage = `
      <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
        <h3 style="margin-top: 0;">Browser Extension Setup & Usage</h3>
        
        <!-- Installation Section -->
        <h4 style="color: #3498db; margin-top: 20px;">📦 Installation</h4>
        <div style="margin-bottom: 20px;">
          <strong style="color: #fff;">For Chrome/Edge:</strong>
          <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
            <li>Locate the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder in ScribeCat</li>
            <li>Open Chrome and navigate to <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">chrome://extensions/</code></li>
            <li>Enable <strong>"Developer mode"</strong> (toggle in top-right corner)</li>
            <li>Click <strong>"Load unpacked"</strong> button</li>
            <li>Select the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>The extension icon will appear in your toolbar! 🎉</li>
          </ol>
          
          <strong style="color: #fff;">For Firefox:</strong>
          <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
            <li>Locate the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder in ScribeCat</li>
            <li>Open Firefox and navigate to <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">about:debugging</code></li>
            <li>Click <strong>"This Firefox"</strong> in the sidebar</li>
            <li>Click <strong>"Load Temporary Add-on"</strong></li>
            <li>Navigate to the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>Select <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">manifest.json</code> file</li>
          </ol>
          <p style="margin: 10px 0; padding: 10px; background: #2c3e50; border-radius: 4px; font-size: 13px;">
            <strong>💡 Tip:</strong> In Firefox, the extension loads temporarily and will be removed when you close the browser. 
            You'll need to reload it each time you restart Firefox.
          </p>
        </div>
        
        <!-- Usage Section -->
        <h4 style="color: #27ae60; margin-top: 20px;">🚀 Using the Extension</h4>
        <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
          <li>Navigate to your <strong>Canvas dashboard</strong> (main page after login)</li>
          <li>Click the <strong>ScribeCat extension icon</strong> in your browser toolbar</li>
          <li>Click <strong>"Collect Courses"</strong> button in the popup</li>
          <li>Review the detected courses</li>
          <li>Click <strong>"Copy for ScribeCat"</strong> to copy the JSON data</li>
          <li>Return to <strong>ScribeCat Settings</strong> (this window)</li>
          <li>Paste the JSON into the textarea above</li>
          <li>Click <strong>"Import Courses"</strong></li>
        </ol>
        
        <!-- Why Section -->
        <h4 style="color: #f39c12; margin-top: 20px;">❓ Why Use the Extension?</h4>
        <p style="margin: 10px 0; line-height: 1.6;">
          Some universities (like <strong>University of Delaware</strong>) block Canvas API access for security reasons. 
          The browser extension works around this by reading course information directly from your Canvas dashboard HTML - 
          no API access needed! This means it works at <em>any</em> university, regardless of their API policies.
        </p>
        
        <!-- Troubleshooting Section -->
        <h4 style="color: #e74c3c; margin-top: 20px;">🔧 Troubleshooting</h4>
        <div style="text-align: left; margin: 10px 0; line-height: 1.6;">
          <strong style="color: #fff;">No courses detected?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Ensure you're on the Canvas <strong>dashboard</strong> (main page with course cards)</li>
            <li>Try <strong>refreshing</strong> the Canvas page and collecting again</li>
            <li>Verify you're <strong>logged into Canvas</strong></li>
            <li>Check that courses are visible on the dashboard</li>
          </ul>
          
          <strong style="color: #fff; display: block; margin-top: 10px;">Extension not appearing in toolbar?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Check that <strong>Developer mode</strong> is enabled (Chrome)</li>
            <li>Try <strong>reloading the extension</strong> in browser settings</li>
            <li>Ensure you selected the correct <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>Look for the extension in the extensions menu (puzzle piece icon)</li>
          </ul>
          
          <strong style="color: #fff; display: block; margin-top: 10px;">Import failed in ScribeCat?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Ensure you copied the <strong>complete JSON</strong> (no truncation)</li>
            <li>Use <strong>"Copy for ScribeCat"</strong> button, not raw export</li>
            <li>Check for any error messages in the notification</li>
            <li>Try collecting courses again if data seems corrupted</li>
          </ul>
        </div>
        
        <!-- Additional Help -->
        <div style="margin-top: 20px; padding: 15px; background: #34495e; border-radius: 4px; border-left: 4px solid #3498db;">
          <strong style="color: #fff;">Need More Help?</strong>
          <p style="margin: 5px 0; font-size: 13px;">
            Check the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension/README.md</code> 
            file for detailed documentation, or open an issue on GitHub if you encounter problems.
          </p>
        </div>
      </div>
    `;
    
    // Create help modal
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
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #2c2c2c;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      color: #fff;
    `;
    
    dialog.innerHTML = `
      ${helpMessage}
      <div style="text-align: right; margin-top: 20px;">
        <button id="help-close-btn" style="
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: #3498db;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
        ">Got it!</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const closeBtn = document.getElementById('help-close-btn');
    const handleClose = () => document.body.removeChild(overlay);
    
    closeBtn?.addEventListener('click', handleClose);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleClose();
    });
  }
  
  /**
   * Populate themes in the settings modal
   */
  private populateThemes(): void {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;
    
    const currentTheme = this.themeManager.getCurrentTheme();
    this.selectedThemeId = currentTheme.id;
    
    // Get all themes
    const themes = this.themeManager.getThemes();
    
    // Build theme cards HTML
    themeGrid.innerHTML = themes.map(theme => {
      const metadata = this.themeManager.getThemeMetadata(theme);
      const isSelected = theme.id === this.selectedThemeId;
      const variantLabel = theme.variant === 'light' ? 'Light' : 'Dark';
      const variantClass = theme.variant === 'light' ? 'variant-light' : 'variant-dark';

      return `
        <div class="theme-card ${isSelected ? 'selected' : ''}" data-theme-id="${theme.id}" data-category="${theme.category}" data-variant="${theme.variant}">
          <div class="theme-preview">
            ${metadata.previewColors.map(color => `
              <div class="theme-preview-color" style="background-color: ${color};"></div>
            `).join('')}
          </div>
          <div class="theme-info">
            <h4 class="theme-name">${theme.name}</h4>
            <div class="theme-badges">
              <span class="theme-category ${theme.category}">${theme.category}</span>
              <span class="theme-variant ${variantClass}">${variantLabel}</span>
            </div>
            <p class="theme-description">${theme.description}</p>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to theme cards
    themeGrid.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.getAttribute('data-theme-id');
        if (themeId) {
          this.selectTheme(themeId);
        }
      });
    });
  }
  
  /**
   * Filter themes by category and variant
   */
  private filterThemes(): void {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;

    const themeCards = themeGrid.querySelectorAll('.theme-card');

    themeCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardVariant = card.getAttribute('data-variant');

      const categoryMatch = this.currentCategoryFilter === 'all' || cardCategory === this.currentCategoryFilter;
      const variantMatch = this.currentVariantFilter === 'all' || cardVariant === this.currentVariantFilter;

      if (categoryMatch && variantMatch) {
        (card as HTMLElement).style.display = 'block';
      } else {
        (card as HTMLElement).style.display = 'none';
      }
    });
  }
  
  /**
   * Select a theme
   */
  private async selectTheme(themeId: string): Promise<void> {
    try {
      // Load the theme
      const success = await this.themeManager.loadTheme(themeId);
      
      if (!success) {
        this.showNotification('Failed to load theme', 'error');
        return;
      }
      
      // Update selected theme ID
      this.selectedThemeId = themeId;
      
      // Update UI to show selected state
      const themeGrid = document.getElementById('theme-grid');
      if (themeGrid) {
        themeGrid.querySelectorAll('.theme-card').forEach(card => {
          if (card.getAttribute('data-theme-id') === themeId) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        });
      }
      
      this.showNotification('Theme applied successfully!', 'success');
    } catch (error) {
      console.error('Failed to select theme:', error);
      this.showNotification('Failed to apply theme', 'error');
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
