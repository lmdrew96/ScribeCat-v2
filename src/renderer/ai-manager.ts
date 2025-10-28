/**
 * AI Manager
 * Handles all AI-related functionality in the renderer process
 */

import type { ChatMessage, ChatResponse, PolishResult, SummaryResult, TitleResult } from '../shared/types.js';
import { renderMarkdown } from './markdown-renderer.js';

declare const window: Window & {
  scribeCat: {
    ai: {
      chat: (message: string, history: ChatMessage[], options?: any) => Promise<any>;
      chatStream: (message: string, history: ChatMessage[], options: any, onChunk: (chunk: string) => void) => Promise<any>;
      removeChatStreamListener: () => void;
      polishTranscription: (text: string, options?: any) => Promise<any>;
      generateSummary: (transcription: string, notes?: string, options?: any) => Promise<any>;
      generateTitle: (transcription: string, notes?: string, options?: any) => Promise<any>;
      isConfigured: () => Promise<any>;
      testConnection: () => Promise<any>;
      setApiKey: (apiKey: string) => Promise<any>;
    };
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
    };
  };
};

export class AIManager {
  private chatHistory: ChatMessage[] = [];
  private isConfigured: boolean = false;
  private isChatOpen: boolean = false;
  
  // UI Elements
  private chatDrawer: HTMLElement | null = null;
  private drawerBackdrop: HTMLElement | null = null;
  private chatMessages: HTMLElement | null = null;
  private chatInput: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private floatingChatBtn: HTMLButtonElement | null = null;
  private closeDrawerBtn: HTMLButtonElement | null = null;
  private polishBtn: HTMLButtonElement | null = null;
  private summarizeBtn: HTMLButtonElement | null = null;
  private includeTranscriptionCheckbox: HTMLInputElement | null = null;
  private includeNotesCheckbox: HTMLInputElement | null = null;
  
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
  }
  
  /**
   * Initialize the AI manager
   */
  async initialize(): Promise<void> {
    this.setupUIElements();
    this.setupEventListeners();
    await this.loadApiKey();
    await this.checkConfiguration();
  }
  
  /**
   * Set up UI element references
   */
  private setupUIElements(): void {
    // Chat UI
    this.chatDrawer = document.getElementById('ai-chat-drawer');
    this.drawerBackdrop = this.chatDrawer?.querySelector('.drawer-backdrop') as HTMLElement;
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input') as HTMLInputElement;
    this.sendBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
    this.floatingChatBtn = document.getElementById('floating-chat-btn') as HTMLButtonElement;
    this.closeDrawerBtn = document.getElementById('close-drawer-btn') as HTMLButtonElement;
    this.polishBtn = document.getElementById('polish-btn') as HTMLButtonElement;
    this.summarizeBtn = document.getElementById('summarize-btn') as HTMLButtonElement;
    this.includeTranscriptionCheckbox = document.getElementById('include-transcription') as HTMLInputElement;
    this.includeNotesCheckbox = document.getElementById('include-notes') as HTMLInputElement;
    
    // Settings UI
    this.claudeApiKeyInput = document.getElementById('claude-api-key') as HTMLInputElement;
    this.claudeStatusSpan = document.getElementById('claude-status');
    this.testConnectionBtn = document.getElementById('test-claude-connection') as HTMLButtonElement;
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Chat toggle
    this.floatingChatBtn?.addEventListener('click', () => this.openChat());
    this.closeDrawerBtn?.addEventListener('click', () => this.closeChat());
    this.drawerBackdrop?.addEventListener('click', () => this.closeChat());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isChatOpen) {
        this.closeChat();
      }
    });
    
    // Send message
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Action buttons
    this.polishBtn?.addEventListener('click', () => this.polishTranscription());
    this.summarizeBtn?.addEventListener('click', () => this.generateSummary());
    
    // Settings
    this.testConnectionBtn?.addEventListener('click', () => this.testConnection());
  }
  
  /**
   * Load API key from storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const apiKey = await window.scribeCat.store.get('claude-api-key');
      if (apiKey && typeof apiKey === 'string' && this.claudeApiKeyInput) {
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
    try {
      // Save to store
      await window.scribeCat.store.set('claude-api-key', apiKey);
      
      // Configure AI service
      const result = await window.scribeCat.ai.setApiKey(apiKey);
      
      if (result.success) {
        await this.checkConfiguration();
        return true;
      } else {
        console.error('Failed to set API key:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      return false;
    }
  }
  
  /**
   * Check if AI is configured
   */
  async checkConfiguration(): Promise<void> {
    try {
      const result = await window.scribeCat.ai.isConfigured();
      this.isConfigured = result.success && result.data;
      
      this.updateUIState();
    } catch (error) {
      console.error('Failed to check AI configuration:', error);
      this.isConfigured = false;
      this.updateUIState();
    }
  }
  
  /**
   * Update UI based on configuration state
   */
  private updateUIState(): void {
    // Update status text
    if (this.claudeStatusSpan) {
      this.claudeStatusSpan.textContent = this.isConfigured ? 'Configured' : 'Not configured';
      this.claudeStatusSpan.className = this.isConfigured ? 'status-text configured' : 'status-text not-configured';
    }
    
    // Enable/disable chat input
    if (this.chatInput) {
      this.chatInput.disabled = !this.isConfigured;
      this.chatInput.placeholder = this.isConfigured 
        ? 'Ask about your transcription or notes...'
        : 'Configure Claude API key in settings to use AI chat';
    }
    
    if (this.sendBtn) {
      this.sendBtn.disabled = !this.isConfigured;
    }
    
    // Enable/disable action buttons
    if (this.polishBtn) {
      this.polishBtn.disabled = !this.isConfigured;
    }
    
    if (this.summarizeBtn) {
      this.summarizeBtn.disabled = !this.isConfigured;
    }
  }
  
  /**
   * Test API connection
   */
  async testConnection(): Promise<void> {
    if (!this.testConnectionBtn || !this.claudeStatusSpan) return;
    
    const originalText = this.testConnectionBtn.textContent;
    this.testConnectionBtn.disabled = true;
    this.testConnectionBtn.textContent = 'Testing...';
    this.claudeStatusSpan.textContent = 'Testing connection...';
    this.claudeStatusSpan.className = 'status-text testing';
    
    try {
      const result = await window.scribeCat.ai.testConnection();
      
      if (result.success && result.data) {
        this.claudeStatusSpan.textContent = 'Connected successfully!';
        this.claudeStatusSpan.className = 'status-text configured';
        this.isConfigured = true;
        this.updateUIState();
      } else {
        this.claudeStatusSpan.textContent = 'Connection failed';
        this.claudeStatusSpan.className = 'status-text not-configured';
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.claudeStatusSpan.textContent = 'Connection failed';
      this.claudeStatusSpan.className = 'status-text not-configured';
    } finally {
      this.testConnectionBtn.disabled = false;
      this.testConnectionBtn.textContent = originalText;
    }
  }
  
  /**
   * Open chat drawer
   */
  private openChat(): void {
    if (!this.chatDrawer) return;
    
    this.chatDrawer.classList.remove('hidden');
    this.isChatOpen = true;
    
    // Focus input if configured
    if (this.isConfigured && this.chatInput) {
      setTimeout(() => {
        this.chatInput?.focus();
      }, 300); // Wait for animation
    }
    
    // Trap focus in drawer
    this.trapFocus();
  }
  
  /**
   * Close chat drawer
   */
  private closeChat(): void {
    if (!this.chatDrawer) return;
    
    this.chatDrawer.classList.add('hidden');
    this.isChatOpen = false;
    
    // Return focus to floating button
    this.floatingChatBtn?.focus();
  }
  
  /**
   * Trap focus within the drawer for accessibility
   */
  private trapFocus(): void {
    if (!this.chatDrawer) return;
    
    const focusableElements = this.chatDrawer.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    // Remove old listener if exists
    document.removeEventListener('keydown', handleTabKey);
    
    // Add new listener only when drawer is open
    if (this.isChatOpen) {
      document.addEventListener('keydown', handleTabKey);
    }
  }
  
  /**
   * Send a chat message
   */
  private async sendMessage(): Promise<void> {
    if (!this.chatInput || !this.isConfigured) return;
    
    const message = this.chatInput.value.trim();
    if (!message) return;
    
    // Clear input
    this.chatInput.value = '';
    
    // Add user message to UI
    this.addMessageToUI('user', message);
    
    // Prepare options
    const options: any = {};
    
    if (this.includeTranscriptionCheckbox?.checked) {
      options.transcriptionContext = this.getTranscriptionText();
    }
    
    if (this.includeNotesCheckbox?.checked) {
      options.notesContext = this.getNotesText();
    }
    
    // Create assistant message placeholder
    const assistantMessageDiv = this.createMessageElement('assistant', '');
    const contentDiv = assistantMessageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.classList.add('streaming');
    }
    
    try {
      // Use streaming for real-time response
      let fullResponse = '';
      
      await window.scribeCat.ai.chatStream(
        message,
        this.chatHistory,
        options,
        (chunk: string) => {
          fullResponse += chunk;
          if (contentDiv) {
            // During streaming, show plain text
            contentDiv.textContent = fullResponse;
          }
        }
      );
      
      // Remove streaming indicator and render markdown
      if (contentDiv) {
        contentDiv.classList.remove('streaming');
        // Render the complete response as markdown
        contentDiv.innerHTML = renderMarkdown(fullResponse);
      }
      
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
      if (contentDiv) {
        contentDiv.textContent = 'Sorry, I encountered an error. Please try again.';
        contentDiv.classList.remove('streaming');
      }
    }
  }
  
  /**
   * Add a message to the UI
   */
  private addMessageToUI(role: 'user' | 'assistant', content: string): void {
    if (!this.chatMessages) return;
    
    // Remove welcome message if present
    const welcome = this.chatMessages.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }
    
    const messageDiv = this.createMessageElement(role, content);
    this.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
  
  /**
   * Create a message element
   */
  private createMessageElement(role: 'user' | 'assistant', content: string): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const roleSpan = document.createElement('span');
    roleSpan.className = 'message-role';
    roleSpan.textContent = role === 'user' ? 'You' : 'AI Assistant';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-timestamp';
    timeSpan.textContent = new Date().toLocaleTimeString();
    
    headerDiv.appendChild(roleSpan);
    headerDiv.appendChild(timeSpan);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    if (!this.chatMessages) return messageDiv;
    this.chatMessages.appendChild(messageDiv);
    
    return messageDiv;
  }
  
  /**
   * Polish the transcription
   */
  private async polishTranscription(): Promise<void> {
    const transcriptionText = this.getTranscriptionText();
    
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      alert('No transcription text to polish');
      return;
    }
    
    if (!this.polishBtn) return;
    
    const originalText = this.polishBtn.textContent;
    this.polishBtn.disabled = true;
    this.polishBtn.textContent = '✨ Polishing...';
    
    try {
      const result = await window.scribeCat.ai.polishTranscription(transcriptionText, {
        grammar: true,
        punctuation: true,
        clarity: true,
        preserveMeaning: true
      });
      
      if (result.success) {
        this.showPolishResult(result.data);
      } else {
        alert(`Failed to polish transcription: ${result.error}`);
      }
    } catch (error) {
      console.error('Polish failed:', error);
      alert('Failed to polish transcription. Please try again.');
    } finally {
      this.polishBtn.disabled = false;
      this.polishBtn.textContent = originalText;
    }
  }
  
  /**
   * Show polish result in a modal
   */
  private showPolishResult(result: PolishResult): void {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal result-modal';
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Polished Transcription</h2>
          <button class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="result-comparison">
            <div class="result-section">
              <h4>Original</h4>
              <div class="result-text">${this.escapeHtml(result.originalText)}</div>
            </div>
            <div class="result-section">
              <h4>Polished</h4>
              <div class="result-text">${this.escapeHtml(result.polishedText)}</div>
            </div>
          </div>
          ${result.changes.length > 0 ? `
            <div class="result-changes">
              <h4>Changes Made:</h4>
              <ul>
                ${result.changes.map(change => `<li>${this.escapeHtml(change)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <div class="token-usage">Tokens used: ${result.tokensUsed}</div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn cancel-btn">Cancel</button>
          <button class="primary-btn accept-btn">Accept & Replace</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const acceptBtn = modal.querySelector('.accept-btn');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => modal.remove();
    
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    
    acceptBtn?.addEventListener('click', () => {
      // Replace transcription text
      const transcriptionContainer = document.getElementById('transcription-container');
      if (transcriptionContainer) {
        transcriptionContainer.innerHTML = `<div class="flowing-transcription">${this.escapeHtml(result.polishedText)}</div>`;
      }
      closeModal();
    });
  }
  
  /**
   * Generate a summary
   */
  private async generateSummary(): Promise<void> {
    const transcriptionText = this.getTranscriptionText();
    const notesText = this.getNotesText();
    
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      alert('No transcription text to summarize');
      return;
    }
    
    if (!this.summarizeBtn) return;
    
    const originalText = this.summarizeBtn.textContent;
    this.summarizeBtn.disabled = true;
    this.summarizeBtn.textContent = '📝 Summarizing...';
    
    try {
      const result = await window.scribeCat.ai.generateSummary(
        transcriptionText,
        notesText,
        { style: 'bullet-points', maxLength: 300 }
      );
      
      if (result.success) {
        this.showSummaryResult(result.data);
      } else {
        alert(`Failed to generate summary: ${result.error}`);
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      this.summarizeBtn.disabled = false;
      this.summarizeBtn.textContent = originalText;
    }
  }
  
  /**
   * Show summary result in a modal
   */
  private showSummaryResult(result: SummaryResult): void {
    const modal = document.createElement('div');
    modal.className = 'modal result-modal';
    
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Session Summary</h2>
          <button class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="result-section">
            <h4>Summary</h4>
            <div class="result-text">${this.escapeHtml(result.summary)}</div>
          </div>
          
          <div class="result-section" style="margin-top: 20px;">
            <h4>Key Points</h4>
            <ul style="list-style: disc; padding-left: 20px; color: var(--text-primary);">
              ${result.keyPoints.map(point => `<li style="margin-bottom: 8px;">${this.escapeHtml(point)}</li>`).join('')}
            </ul>
          </div>
          
          ${result.actionItems && result.actionItems.length > 0 ? `
            <div class="result-section" style="margin-top: 20px;">
              <h4>Action Items</h4>
              <ul style="list-style: disc; padding-left: 20px; color: var(--text-primary);">
                ${result.actionItems.map(item => `<li style="margin-bottom: 8px;">${this.escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div class="token-usage">Tokens used: ${result.tokensUsed}</div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn close-modal-btn">Close</button>
          <button class="primary-btn copy-btn">Copy to Notes</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const copyBtn = modal.querySelector('.copy-btn');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => modal.remove();
    
    closeBtn?.addEventListener('click', closeModal);
    closeModalBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);
    
    copyBtn?.addEventListener('click', () => {
      // Copy summary to notes
      const notesEditor = document.getElementById('notes-editor');
      if (notesEditor) {
        let summaryText = `\n\n--- AI Summary ---\n\n${result.summary}\n\n`;
        summaryText += `Key Points:\n${result.keyPoints.map(p => `• ${p}`).join('\n')}`;
        
        if (result.actionItems && result.actionItems.length > 0) {
          summaryText += `\n\nAction Items:\n${result.actionItems.map(i => `• ${i}`).join('\n')}`;
        }
        
        notesEditor.innerHTML += summaryText.replace(/\n/g, '<br>');
      }
      closeModal();
    });
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Clear chat history
   */
  clearChatHistory(): void {
    this.chatHistory = [];
    if (this.chatMessages) {
      this.chatMessages.innerHTML = `
        <div class="chat-welcome">
          <p>👋 Hi! I'm your AI assistant. I can help you understand your transcription and notes better.</p>
          <p>Ask me anything about the content!</p>
        </div>
      `;
    }
  }
}
