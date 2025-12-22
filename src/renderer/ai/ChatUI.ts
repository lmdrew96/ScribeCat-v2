/**
 * ChatUI
 * Handles chat interface rendering and interactions
 */

import { ChatMessage } from '../../shared/types.js';
import { renderMarkdown } from '../utils/markdown-renderer.js';
import { getRandomCatFact } from '../utils/cat-facts.js';
import { NuggetNotesOrchestrator } from './NuggetNotesOrchestrator.js';
import type { NuggetNote } from './NuggetNotesService.js';

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
  private nuggetNotesPanel: HTMLElement | null = null;

  // Tab elements
  private chatTabBtn: HTMLButtonElement | null = null;
  private notesTabBtn: HTMLButtonElement | null = null;
  private chatTabContent: HTMLElement | null = null;
  private notesTabContent: HTMLElement | null = null;

  private isChatOpen: boolean = false;
  private notesOrchestrator: NuggetNotesOrchestrator;
  private currentTab: 'chat' | 'notes' = 'chat';

  constructor(notesOrchestrator: NuggetNotesOrchestrator) {
    this.notesOrchestrator = notesOrchestrator;
    this.setupUIElements();
    this.initializeNuggetNotesPanel();
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
    this.nuggetNotesPanel = document.getElementById('nugget-notes-panel');

    // Tab elements
    this.chatTabBtn = document.getElementById('chat-tab-btn') as HTMLButtonElement;
    this.notesTabBtn = document.getElementById('notes-tab-btn') as HTMLButtonElement;
    this.chatTabContent = document.getElementById('chat-tab-content');
    this.notesTabContent = document.getElementById('notes-tab-content');
  }

  /**
   * Set up tab switching listeners
   */
  private setupTabListeners(): void {
    this.chatTabBtn?.addEventListener('click', () => this.switchTab('chat'));
    this.notesTabBtn?.addEventListener('click', () => this.switchTab('notes'));
  }

  /**
   * Switch between chat and notes tabs
   */
  private switchTab(tab: 'chat' | 'notes'): void {
    this.currentTab = tab;

    // Update tab buttons
    if (tab === 'chat') {
      this.chatTabBtn?.classList.add('active');
      this.notesTabBtn?.classList.remove('active');
      this.chatTabContent?.classList.add('active');
      this.notesTabContent?.classList.remove('active');
    } else {
      this.chatTabBtn?.classList.remove('active');
      this.notesTabBtn?.classList.add('active');
      this.chatTabContent?.classList.remove('active');
      this.notesTabContent?.classList.add('active');
    }
  }

  /**
   * Initialize Nugget's Notes panel
   */
  private initializeNuggetNotesPanel(): void {
    if (this.nuggetNotesPanel) {
      this.notesOrchestrator.initializePanel(this.nuggetNotesPanel);
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

  // ===== Nugget's Notes Methods =====

  /**
   * Start recording mode for Nugget's Notes
   */
  public startRecording(): void {
    this.notesOrchestrator.startRecording();

    // Auto-switch to notes tab when recording starts
    this.switchTab('notes');
  }

  /**
   * Stop recording mode for Nugget's Notes
   * @param finalTranscript Optional final transcript to process before stopping
   */
  public async stopRecording(finalTranscript?: string): Promise<void> {
    await this.notesOrchestrator.stopRecording(finalTranscript);
  }

  /**
   * Update notes with transcript chunk
   */
  public async updateNotes(transcription: string, durationMinutes: number): Promise<void> {
    await this.notesOrchestrator.processTranscriptChunk(transcription, durationMinutes);
  }

  /**
   * Get all generated notes
   */
  public getAllNotes(): NuggetNote[] {
    return this.notesOrchestrator.getAllNotes();
  }

  /**
   * Clear all notes (for session reset)
   */
  public clearNotes(): void {
    this.notesOrchestrator.reset();
  }

  /**
   * Get the notes orchestrator instance
   */
  public getNotesOrchestrator(): NuggetNotesOrchestrator {
    return this.notesOrchestrator;
  }
}
