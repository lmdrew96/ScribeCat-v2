/**
 * AIManager
 * Coordinates all AI-related functionality
 */

import type { ChatMessage } from '../../shared/types.js';
import { ChatUI } from './ChatUI.js';
import { AIClient } from './AIClient.js';
import { ContentAnalyzer } from './ContentAnalyzer.js';
import { SmartSuggestionEngine } from './SmartSuggestionEngine.js';
import { config } from '../../config.js';

export class AIManager {
  private chatUI: ChatUI;
  private aiClient: AIClient;
  private contentAnalyzer: ContentAnalyzer;
  private suggestionEngine: SmartSuggestionEngine;

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

  // Study mode context
  private studyModeContext: {
    transcription: string;
    notes: string;
    isMultiSession?: boolean;
    sessionMetadata?: Array<{
      id: string;
      title: string;
      index: number;
    }>;
  } | null = null;

  constructor(
    getTranscriptionText: () => string,
    getNotesText: () => string
  ) {
    this.getTranscriptionText = getTranscriptionText;
    this.getNotesText = getNotesText;

    // Initialize components
    // Create ContentAnalyzer first so it can be shared with ChatUI
    this.contentAnalyzer = new ContentAnalyzer();
    this.chatUI = new ChatUI(this.contentAnalyzer);
    this.aiClient = new AIClient();
    this.suggestionEngine = new SmartSuggestionEngine(this.contentAnalyzer);

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
   * Set up settings UI elements (deprecated - API keys now configured via environment)
   */
  private setupSettingsUI(): void {
    // API key input no longer exists in UI
    this.claudeApiKeyInput = null;
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

    // Settings
    this.testConnectionBtn?.addEventListener('click', () => this.testConnection());
  }

  /**
   * Load API key from storage (deprecated - API keys now configured via environment)
   */
  private async loadApiKey(): Promise<void> {
    // No-op: API keys are now configured via environment variables
    // and embedded at build time. No UI for user configuration.
  }

  /**
   * Save API key and configure AI service (deprecated - API keys now configured via environment)
   */
  async saveApiKey(apiKey: string): Promise<boolean> {
    console.warn('⚠️ saveApiKey is deprecated - API keys are now configured via environment');
    return true;
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
      // Check if API key is configured via environment
      const apiKey = config.claude.apiKey;

      if (!apiKey) {
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
          this.isTestingConnection = false;
          this.updateUIState();
          this.updateConnectionStatus('connected', 'Connected');
          return;
        } else {
          console.warn(`⚠️ AI connection attempt ${attemptNum} failed:`, result.error);

          if (attempt === this.maxRetries) {
            this.isConfigured = false;
            this.connectionTested = true;
            this.retryCount = 0;
            this.isTestingConnection = false;
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
          this.isTestingConnection = false;
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
  }

  /**
   * Set study mode context (called when viewing a session in study mode)
   */
  public setStudyModeContext(
    transcription: string,
    notes: string,
    isMultiSession?: boolean,
    sessionMetadata?: Array<{ id: string; title: string; index: number }>
  ): void {
    this.studyModeContext = {
      transcription,
      notes,
      isMultiSession,
      sessionMetadata
    };

    if (isMultiSession && sessionMetadata) {
      console.log(`Nugget: Multi-session study mode context set with ${sessionMetadata.length} sessions`);
    } else {
      console.log('Nugget: Study mode context set');
    }
  }

  /**
   * Clear study mode context (called when exiting study mode)
   */
  public clearStudyModeContext(): void {
    this.studyModeContext = null;
    console.log('Nugget: Study mode context cleared');
  }

  /**
   * Check if in study mode
   */
  public isInStudyMode(): boolean {
    return this.studyModeContext !== null;
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
      // Use study mode context if available, otherwise use live transcription
      options.transcriptionContext = this.studyModeContext
        ? this.studyModeContext.transcription
        : this.getTranscriptionText();
    }

    if (contextOptions.includeNotes) {
      // Use study mode context if available, otherwise use live notes
      options.notesContext = this.studyModeContext
        ? this.studyModeContext.notes
        : this.getNotesText();
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

  /**
   * Start a new content analysis session
   */
  public startContentAnalysis(): void {
    this.contentAnalyzer.startSession();
    this.suggestionEngine.reset();
    console.log('🧠 AI Content analysis started');
  }

  /**
   * Update content and get analysis
   */
  public updateContentAnalysis(): void {
    const transcription = this.getTranscriptionText();
    const notes = this.getNotesText();

    this.contentAnalyzer.updateContent(transcription, notes);
  }

  /**
   * Get current smart suggestion
   */
  public getSmartSuggestion(mode: 'recording' | 'study' = 'study') {
    return this.suggestionEngine.getTopSuggestion(mode);
  }

  /**
   * Get all smart suggestions
   */
  public getAllSmartSuggestions(mode: 'recording' | 'study' = 'study') {
    return this.suggestionEngine.getSuggestions(mode);
  }

  /**
   * Mark suggestion as shown
   */
  public markSuggestionShown(suggestionId: string): void {
    this.suggestionEngine.markShown(suggestionId);
  }

  /**
   * Mark suggestion as dismissed
   */
  public markSuggestionDismissed(suggestionId: string): void {
    this.suggestionEngine.markDismissed(suggestionId);
  }

  /**
   * Mark suggestion as accepted
   */
  public markSuggestionAccepted(suggestionId: string): void {
    this.suggestionEngine.markAccepted(suggestionId);
  }

  /**
   * Parse natural language command
   */
  public parseNaturalLanguageCommand(command: string) {
    return this.suggestionEngine.parseNaturalLanguageCommand(command);
  }

  /**
   * Get content analysis insights
   */
  public getContentInsights() {
    return this.contentAnalyzer.getLastAnalysis();
  }

  /**
   * Get ContentAnalyzer instance (for FloatingAIChip integration)
   */
  public getContentAnalyzer(): ContentAnalyzer {
    return this.contentAnalyzer;
  }

  /**
   * Get ChatUI instance (for RecordingManager integration)
   */
  public getChatUI(): ChatUI {
    return this.chatUI;
  }

  /**
   * Get suggestion statistics
   */
  public getSuggestionStats() {
    return this.suggestionEngine.getStats();
  }

  /**
   * Reset content analysis
   */
  public resetContentAnalysis(): void {
    this.contentAnalyzer.reset();
    this.suggestionEngine.reset();
  }
}
