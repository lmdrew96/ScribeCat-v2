/**
 * AIManager
 * Coordinates all AI-related functionality
 */

import type { ChatMessage } from '../../shared/types.js';
import { ChatUI } from './ChatUI.js';
import { AIClient } from './AIClient.js';
import { PolishFeature } from './features/PolishFeature.js';
import { SummaryFeature } from './features/SummaryFeature.js';

export class AIManager {
  private chatUI: ChatUI;
  private aiClient: AIClient;
  private polishFeature: PolishFeature;
  private summaryFeature: SummaryFeature;
  
  private chatHistory: ChatMessage[] = [];
  private isConfigured: boolean = false;
  private connectionTested: boolean = false;
  private isTestingConnection: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelays: number[] = [2000, 5000, 10000];
  
  // Settings elements
  private claudeApiKeyInput: HTMLInputElement | null = null;
  private claudeStatusSpan: HTMLElement | null = null;
  private testConnectionBtn: HTMLButtonElement | null = null;
  
  // Content getters
  private getTranscriptionText: () => string;
  private getNotesText: () => string;

  constructor(
    getTranscriptionText: () => string,
    getNotesText: () => string
  ) {
    this.getTranscriptionText = getTranscriptionText;
    this.getNotesText = getNotesText;
    
    // Initialize components
    this.chatUI = new ChatUI();
    this.aiClient = new AIClient();
    this.polishFeature = new PolishFeature(this.aiClient, getTranscriptionText);
    this.summaryFeature = new SummaryFeature(this.aiClient, getTranscriptionText, getNotesText);
    
    this.setupSettingsUI();
  }

  /**
   * Initialize the AI manager
   */
  async initialize(): Promise<void> {
    this.setupEventListeners();
    await this.loadApiKey();
    this.initializeConnectionInBackground();
  }

  /**
   * Set up settings UI elements
   */
  private setupSettingsUI(): void {
    this.claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
    this.claudeStatusSpan = document.getElementById('claude-status');
    this.testConnectionBtn = document.getElementById('test-claude-connection') as HTMLButtonElement;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Chat UI
    this.chatUI.setupEventListeners(
      () => this.sendMessage(),
      () => this.chatUI.open(this.isConfigured),
      () => this.chatUI.close()
    );
    
    // Features
    this.polishFeature.setupEventListeners(() => this.polishFeature.polish());
    this.summaryFeature.setupEventListeners(() => this.summaryFeature.generateSummary());
    
    // Settings
    this.testConnectionBtn?.addEventListener('click', () => this.testConnection());
  }

  /**
   * Load API key from storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const apiKey = await this.aiClient.getApiKey();
      if (apiKey && this.claudeApiKeyInput) {
        this.claudeApiKeyInput.value = apiKey;
      }
    } catch (error) {
      console.error('Failed to load Claude API key:', error);
    }
  }

  /**
   * Save API key and configure AI service
   */
  async saveApiKey(apiKey: string): Promise<boolean> {
    const success = await this.aiClient.setApiKey(apiKey);
    if (success) {
      await this.checkConfiguration();
    }
    return success;
  }

  /**
   * Check if AI is configured (manual refresh)
   */
  async checkConfiguration(): Promise<void> {
    this.connectionTested = false;
    await this.initializeConnectionInBackground();
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<void> {
    if (!this.testConnectionBtn || !this.claudeStatusSpan) return;

    const originalText = this.testConnectionBtn.textContent;
    this.testConnectionBtn.disabled = true;
    this.testConnectionBtn.textContent = 'Testing...';
    this.updateConnectionStatus('testing', 'Testing connection...');

    try {
      const result = await this.aiClient.testConnection();

      if (result.success) {
        this.updateConnectionStatus('connected', 'Connected successfully!');
        this.isConfigured = true;
        this.updateUIState();
      } else {
        this.updateConnectionStatus('error', 'Connection failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.updateConnectionStatus('error', 'Connection failed');
    } finally {
      this.testConnectionBtn.disabled = false;
      this.testConnectionBtn.textContent = originalText;
    }
  }

  /**
   * Clear chat history
   */
  clearChatHistory(): void {
    this.chatHistory = [];
    this.chatUI.clearHistory();
  }

  // ===== Private Methods =====

  /**
   * Initialize AI connection in background with retry logic
   */
  private async initializeConnectionInBackground(): Promise<void> {
    try {
      const apiKey = await this.aiClient.getApiKey();

      if (!apiKey) {
        console.log('🔑 No Claude API key found - AI features disabled');
        this.isConfigured = false;
        this.connectionTested = true;
        this.retryCount = 0;
        this.updateUIState();
        this.updateConnectionStatus('not-configured', 'No API key configured');
        return;
      }

      await this.attemptConnectionWithRetry();
    } catch (error) {
      console.error('❌ Fatal error during AI initialization:', error);
      this.isConfigured = false;
      this.connectionTested = true;
      this.updateUIState();
      this.updateConnectionStatus('error', 'Initialization error');
    } finally {
      this.isTestingConnection = false;
    }
  }

  /**
   * Attempt connection with exponential backoff retry
   */
  private async attemptConnectionWithRetry(): Promise<void> {
    this.isTestingConnection = true;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const attemptNum = attempt + 1;
        console.log(`🔄 AI connection attempt ${attemptNum}/${this.maxRetries + 1}...`);

        if (attempt > 0) {
          this.updateConnectionStatus('testing', `Retrying... (${attemptNum}/${this.maxRetries + 1})`);
        } else {
          this.updateConnectionStatus('testing', 'Testing connection...');
        }

        const result = await this.aiClient.testConnection();

        if (result.success) {
          this.isConfigured = true;
          this.connectionTested = true;
          this.retryCount = 0;
          this.updateUIState();
          this.updateConnectionStatus('connected', 'Connected');
          console.log(`✅ AI connection established on attempt ${attemptNum}`);
          return;
        } else {
          console.warn(`⚠️ AI connection attempt ${attemptNum} failed:`, result.error);

          if (attempt === this.maxRetries) {
            this.isConfigured = false;
            this.connectionTested = true;
            this.retryCount = 0;
            this.updateUIState();
            this.updateConnectionStatus('error', `Failed after ${this.maxRetries + 1} attempts`);
            console.error(`❌ AI connection failed after ${this.maxRetries + 1} attempts`);
            return;
          }

          const delay = this.retryDelays[attempt];
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      } catch (error) {
        console.error(`❌ Exception during AI connection attempt ${attempt + 1}:`, error);

        if (attempt === this.maxRetries) {
          this.isConfigured = false;
          this.connectionTested = true;
          this.retryCount = 0;
          this.updateUIState();
          this.updateConnectionStatus('error', 'Connection error');
          return;
        }

        const delay = this.retryDelays[attempt];
        await this.sleep(delay);
      }
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure AI is connected (lazy load fallback)
   */
  private async ensureConnected(): Promise<boolean> {
    if (this.connectionTested && this.isConfigured) {
      return true;
    }

    if (this.connectionTested && !this.isConfigured) {
      return false;
    }

    if (!this.connectionTested && !this.isTestingConnection) {
      console.log('Lazy loading AI connection...');
      await this.initializeConnectionInBackground();
    }

    return this.isConfigured;
  }

  /**
   * Update connection status in UI
   */
  private updateConnectionStatus(
    status: 'connected' | 'not-configured' | 'error' | 'testing',
    message: string
  ): void {
    if (!this.claudeStatusSpan) return;

    this.claudeStatusSpan.textContent = message;

    switch (status) {
      case 'connected':
        this.claudeStatusSpan.className = 'status-text configured';
        break;
      case 'not-configured':
        this.claudeStatusSpan.className = 'status-text not-configured';
        break;
      case 'error':
        this.claudeStatusSpan.className = 'status-text not-configured';
        break;
      case 'testing':
        this.claudeStatusSpan.className = 'status-text testing';
        break;
    }
  }

  /**
   * Update UI state based on configuration
   */
  private updateUIState(): void {
    const isAvailable = this.isConfigured && this.connectionTested;

    // Update chat UI
    this.chatUI.updateUIState(isAvailable, this.isTestingConnection);

    // Update features
    this.polishFeature.updateButtonState(isAvailable);
    this.summaryFeature.updateButtonState(isAvailable);
  }

  /**
   * Send a chat message
   */
  private async sendMessage(): Promise<void> {
    const connected = await this.ensureConnected();
    if (!connected) {
      alert('AI is not available. Please configure your Claude API key in Settings.');
      return;
    }

    const message = this.chatUI.getInputValue();
    if (!message) return;

    this.chatUI.clearInput();
    this.chatUI.addUserMessage(message);

    // Prepare options
    const contextOptions = this.chatUI.getContextOptions();
    const options: any = {};

    if (contextOptions.includeTranscription) {
      options.transcriptionContext = this.getTranscriptionText();
    }

    if (contextOptions.includeNotes) {
      options.notesContext = this.getNotesText();
    }

    // Create assistant message placeholder
    const assistantMessageDiv = this.chatUI.createAssistantMessagePlaceholder();

    try {
      let fullResponse = '';

      await this.aiClient.chatStream(
        message,
        this.chatHistory,
        options,
        (chunk: string) => {
          fullResponse += chunk;
          this.chatUI.updateStreamingMessage(assistantMessageDiv, fullResponse);
        }
      );

      this.chatUI.finalizeStreamingMessage(assistantMessageDiv, fullResponse);

      // Add to history
      this.chatHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      this.chatHistory.push({
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Chat failed:', error);
      this.chatUI.showMessageError(
        assistantMessageDiv,
        'Sorry, I encountered an error. Please try again.'
      );
    }
  }
}
