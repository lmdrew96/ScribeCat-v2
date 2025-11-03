/**
 * TranscriptionSettingsManager
 *
 * Manages transcription mode and API key settings.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('TranscriptionSettingsManager');

export class TranscriptionSettingsManager {
  private transcriptionMode: 'simulation' | 'assemblyai' = 'simulation';
  private assemblyAIApiKey: string = '';
  private claudeApiKey: string = '';

  /**
   * Load transcription settings from storage
   */
  async loadSettings(): Promise<void> {
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

      logger.info('Transcription settings loaded');
    } catch (error) {
      logger.error('Failed to load transcription settings', error);
    }
  }

  /**
   * Save transcription settings to storage
   */
  async saveSettings(
    mode: 'simulation' | 'assemblyai',
    assemblyAIKey: string,
    claudeKey: string
  ): Promise<void> {
    try {
      this.transcriptionMode = mode;
      this.assemblyAIApiKey = assemblyAIKey;
      this.claudeApiKey = claudeKey;

      // Save to storage
      await window.scribeCat.store.set('transcription-mode', this.transcriptionMode);
      await window.scribeCat.store.set('assemblyai-api-key', this.assemblyAIApiKey);
      await window.scribeCat.store.set('claude-api-key', this.claudeApiKey);

      // Update AI service with new key
      if (this.claudeApiKey) {
        await window.scribeCat.ai.setApiKey(this.claudeApiKey);
      }

      logger.info('Transcription settings saved');
    } catch (error) {
      logger.error('Failed to save transcription settings', error);
      throw error;
    }
  }

  /**
   * Update UI elements with current settings
   */
  updateUI(): void {
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

    // Update status
    this.updateAssemblyAIStatus();
  }

  /**
   * Update AssemblyAI status indicator
   */
  updateAssemblyAIStatus(): void {
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
   * Update settings sections visibility based on selected mode
   */
  updateSectionsVisibility(mode: 'simulation' | 'assemblyai'): void {
    const assemblyAISettings = document.getElementById('assemblyai-settings');

    if (assemblyAISettings) {
      if (mode === 'assemblyai') {
        assemblyAISettings.classList.add('active');
      } else {
        assemblyAISettings.classList.remove('active');
      }
    }
  }

  /**
   * Get current transcription mode
   */
  getTranscriptionMode(): 'simulation' | 'assemblyai' {
    return this.transcriptionMode;
  }

  /**
   * Get AssemblyAI API key
   */
  getAssemblyAIApiKey(): string {
    return this.assemblyAIApiKey;
  }

  /**
   * Get Claude API key
   */
  getClaudeApiKey(): string {
    return this.claudeApiKey;
  }

  /**
   * Set AssemblyAI API key (for UI binding)
   */
  setAssemblyAIApiKey(key: string): void {
    this.assemblyAIApiKey = key.trim();
    this.updateAssemblyAIStatus();
  }

  /**
   * Set Claude API key (for UI binding)
   */
  setClaudeApiKey(key: string): void {
    this.claudeApiKey = key.trim();
  }
}
