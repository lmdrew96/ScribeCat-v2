/**
 * ChatUI
 * Handles chat interface rendering and interactions
 */

import { ChatMessage } from '../../shared/types.js';
import { renderMarkdown } from '../utils/markdown-renderer.js';
import { getRandomCatFact } from '../utils/cat-facts.js';
import { LiveSuggestionsPanel } from '../components/LiveSuggestionsPanel.js';
import { ContentAnalyzer } from './ContentAnalyzer.js';

export class ChatUI {
  private chatDrawer: HTMLElement | null = null;
  private drawerBackdrop: HTMLElement | null = null;
  private chatMessages: HTMLElement | null = null;
  private chatInput: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private floatingChatBtn: HTMLButtonElement | null = null;
  private closeDrawerBtn: HTMLButtonElement | null = null;
  private includeTranscriptionCheckbox: HTMLInputElement | null = null;
  private includeNotesCheckbox: HTMLInputElement | null = null;
  private chatBadge: HTMLElement | null = null;
  private liveSuggestionsPanel: HTMLElement | null = null;

  // Tab elements
  private chatTabBtn: HTMLButtonElement | null = null;
  private suggestionsTabBtn: HTMLButtonElement | null = null;
  private chatTabContent: HTMLElement | null = null;
  private suggestionsTabContent: HTMLElement | null = null;
  private suggestionsBadge: HTMLElement | null = null;

  private isChatOpen: boolean = false;
  private liveSuggestions: LiveSuggestionsPanel | null = null;
  private contentAnalyzer: ContentAnalyzer;
  private currentTab: 'chat' | 'suggestions' = 'chat';

  constructor(contentAnalyzer: ContentAnalyzer) {
    this.contentAnalyzer = contentAnalyzer;
    this.setupUIElements();
    this.initializeLiveSuggestions();
    this.setupTabListeners();
  }

  /**
   * Set up UI element references
   */
  private setupUIElements(): void {
    this.chatDrawer = document.getElementById('ai-chat-drawer');
    this.drawerBackdrop = this.chatDrawer?.querySelector('.drawer-backdrop') as HTMLElement;
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input') as HTMLInputElement;
    this.sendBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
    this.floatingChatBtn = document.getElementById('floating-chat-btn') as HTMLButtonElement;
    this.closeDrawerBtn = document.getElementById('close-drawer-btn') as HTMLButtonElement;
    this.includeTranscriptionCheckbox = document.getElementById('include-transcription') as HTMLInputElement;
    this.includeNotesCheckbox = document.getElementById('include-notes') as HTMLInputElement;
    this.chatBadge = document.getElementById('chat-badge');
    this.liveSuggestionsPanel = document.getElementById('live-suggestions-panel');

    // Tab elements
    this.chatTabBtn = document.getElementById('chat-tab-btn') as HTMLButtonElement;
    this.suggestionsTabBtn = document.getElementById('suggestions-tab-btn') as HTMLButtonElement;
    this.chatTabContent = document.getElementById('chat-tab-content');
    this.suggestionsTabContent = document.getElementById('suggestions-tab-content');
    this.suggestionsBadge = document.getElementById('suggestions-badge');
  }

  /**
   * Set up tab switching listeners
   */
  private setupTabListeners(): void {
    this.chatTabBtn?.addEventListener('click', () => this.switchTab('chat'));
    this.suggestionsTabBtn?.addEventListener('click', () => this.switchTab('suggestions'));
  }

  /**
   * Switch between chat and suggestions tabs
   */
  private switchTab(tab: 'chat' | 'suggestions'): void {
    this.currentTab = tab;

    // Update tab buttons
    if (tab === 'chat') {
      this.chatTabBtn?.classList.add('active');
      this.suggestionsTabBtn?.classList.remove('active');
      this.chatTabContent?.classList.add('active');
      this.suggestionsTabContent?.classList.remove('active');
    } else {
      this.chatTabBtn?.classList.remove('active');
      this.suggestionsTabBtn?.classList.add('active');
      this.chatTabContent?.classList.remove('active');
      this.suggestionsTabContent?.classList.add('active');
    }
  }

  /**
   * Initialize live suggestions panel
   */
  private initializeLiveSuggestions(): void {
    // Use the shared ContentAnalyzer instance passed in constructor
    // This ensures we analyze the same data that AIManager is tracking
    this.liveSuggestions = new LiveSuggestionsPanel(this.contentAnalyzer, {
      onBadgeUpdate: (count: number) => {
        this.updateBadge(count);
      },
      onSuggestionClick: (suggestion) => {
        // Delegate to RecordingManager which has access to all necessary managers
        const recordingManager = (window as any).recordingManager;
        if (recordingManager?.handleSuggestionAction) {
          recordingManager.handleSuggestionAction(suggestion);
        } else {
          console.warn('RecordingManager not available for suggestion action');
        }
      }
    });

    // Render initial placeholder state
    if (this.liveSuggestions && this.liveSuggestionsPanel) {
      const html = this.liveSuggestions.renderPanelHTML();
      this.liveSuggestionsPanel.innerHTML = html;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners(
    onSend: () => void,
    onOpen: () => void,
    onClose: () => void
  ): void {
    this.floatingChatBtn?.addEventListener('click', onOpen);
    this.closeDrawerBtn?.addEventListener('click', onClose);
    this.drawerBackdrop?.addEventListener('click', onClose);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isChatOpen) {
        onClose();
      }
    });
    
    // Send message
    this.sendBtn?.addEventListener('click', onSend);
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    });
  }

  /**
   * Open chat drawer
   */
  open(isConfigured: boolean): void {
    if (!this.chatDrawer) return;

    this.chatDrawer.classList.remove('hidden');
    this.isChatOpen = true;

    // Focus input if configured
    if (isConfigured && this.chatInput) {
      setTimeout(() => {
        this.chatInput?.focus();
      }, 300);
    }

    // Ensure Live AI panel has initial content (in case DOM wasn't ready during init)
    if (this.liveSuggestions && this.liveSuggestionsPanel && !this.liveSuggestionsPanel.innerHTML) {
      const html = this.liveSuggestions.renderPanelHTML();
      this.liveSuggestionsPanel.innerHTML = html;
    }

    this.trapFocus();
  }

  /**
   * Close chat drawer
   */
  close(): void {
    if (!this.chatDrawer) return;
    
    this.chatDrawer.classList.add('hidden');
    this.isChatOpen = false;
    
    // Return focus to floating button
    this.floatingChatBtn?.focus();
  }

  /**
   * Get chat input value
   */
  getInputValue(): string {
    return this.chatInput?.value.trim() || '';
  }

  /**
   * Clear chat input
   */
  clearInput(): void {
    if (this.chatInput) {
      this.chatInput.value = '';
    }
  }

  /**
   * Get context options
   */
  getContextOptions(): { includeTranscription: boolean; includeNotes: boolean } {
    return {
      includeTranscription: this.includeTranscriptionCheckbox?.checked || false,
      includeNotes: this.includeNotesCheckbox?.checked || false
    };
  }

  /**
   * Add user message to UI
   */
  addUserMessage(content: string): void {
    this.removeWelcomeMessage();
    const messageDiv = this.createMessageElement('user', content);
    this.chatMessages?.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * Create assistant message placeholder for streaming
   */
  createAssistantMessagePlaceholder(): HTMLElement {
    this.removeWelcomeMessage();
    const messageDiv = this.createMessageElement('assistant', '');
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.classList.add('streaming');
    }
    this.chatMessages?.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv;
  }

  /**
   * Update streaming message content
   */
  updateStreamingMessage(messageDiv: HTMLElement, content: string): void {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.textContent = content;
    }
    this.scrollToBottom();
  }

  /**
   * Finalize streaming message with markdown
   */
  finalizeStreamingMessage(messageDiv: HTMLElement, content: string): void {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.classList.remove('streaming');
      contentDiv.innerHTML = renderMarkdown(content);
    }
    this.scrollToBottom();
  }

  /**
   * Show error in message
   */
  showMessageError(messageDiv: HTMLElement, error: string): void {
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.textContent = error;
      contentDiv.classList.remove('streaming');
    }
  }

  /**
   * Update UI state based on configuration
   */
  updateUIState(isConfigured: boolean, isTesting: boolean): void {
    if (this.chatInput) {
      this.chatInput.disabled = !isConfigured;

      if (isTesting) {
        this.chatInput.placeholder = getRandomCatFact();
      } else if (isConfigured) {
        this.chatInput.placeholder = 'Type your message here...';
      } else {
        this.chatInput.placeholder = 'Configure Claude API key in settings to use Nugget';
      }
    }

    if (this.sendBtn) {
      this.sendBtn.disabled = !isConfigured;
    }
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    if (this.chatMessages) {
      this.chatMessages.innerHTML = `
        <div class="chat-welcome">
          <p>👋 Hi! I'm Nugget, your AI study companion. I can help you understand your transcription and notes better.</p>
          <p>Ask me anything about the content!</p>
        </div>
      `;
    }
  }

  /**
   * Check if chat is open
   */
  isOpen(): boolean {
    return this.isChatOpen;
  }

  // ===== Private Methods =====

  /**
   * Remove welcome message
   */
  private removeWelcomeMessage(): void {
    const welcome = this.chatMessages?.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }
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
    roleSpan.textContent = role === 'user' ? 'You' : 'Nugget';
    
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
    
    return messageDiv;
  }

  /**
   * Scroll to bottom of chat
   */
  private scrollToBottom(): void {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
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
    
    document.removeEventListener('keydown', handleTabKey);

    if (this.isChatOpen) {
      document.addEventListener('keydown', handleTabKey);
    }
  }

  // ===== Live Suggestions Methods =====

  /**
   * Update badge count and visibility
   */
  private updateBadge(count: number): void {
    // Update main chat badge (on floating button)
    if (this.chatBadge) {
      if (count > 0) {
        this.chatBadge.textContent = count.toString();
        this.chatBadge.hidden = false;
        this.chatBadge.classList.add('pulse');
      } else {
        this.chatBadge.hidden = true;
        this.chatBadge.classList.remove('pulse');
      }
    }

    // Update suggestions tab badge
    if (this.suggestionsBadge) {
      if (count > 0) {
        this.suggestionsBadge.textContent = count.toString();
        this.suggestionsBadge.hidden = false;
      } else {
        this.suggestionsBadge.hidden = true;
      }
    }
  }

  /**
   * Start recording mode for live suggestions
   */
  public startRecording(): void {
    this.liveSuggestions?.startRecording();

    // Render initial empty state
    if (this.liveSuggestions && this.liveSuggestionsPanel) {
      const html = this.liveSuggestions.renderPanelHTML();
      this.liveSuggestionsPanel.innerHTML = html;
    }

    // Auto-switch to suggestions tab when recording starts
    this.switchTab('suggestions');
  }

  /**
   * Stop recording mode for live suggestions
   */
  public stopRecording(): void {
    this.liveSuggestions?.stopRecording();

    // Keep suggestions visible - they remain accessible in the tab
    // Just update the panel with final state
    if (this.liveSuggestions && this.liveSuggestionsPanel) {
      const html = this.liveSuggestions.renderPanelHTML();
      this.liveSuggestionsPanel.innerHTML = html;
    }
  }

  /**
   * Update live suggestions with latest content
   */
  public updateLiveSuggestions(transcription: string, notes: string, durationMinutes: number): void {
    if (!this.liveSuggestions || !this.liveSuggestionsPanel) return;

    // Update suggestions
    this.liveSuggestions.updateSuggestions(transcription, notes, durationMinutes);

    // Render panel HTML
    const html = this.liveSuggestions.renderPanelHTML();
    this.liveSuggestionsPanel.innerHTML = html;

    // Attach event listeners
    this.liveSuggestions.attachSuggestionListeners(this.liveSuggestionsPanel);
  }

  /**
   * Get live suggestions panel instance
   */
  public getLiveSuggestionsPanel(): LiveSuggestionsPanel | null {
    return this.liveSuggestions;
  }
}
