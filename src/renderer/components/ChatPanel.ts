/**
 * ChatPanel Component
 * Real-time chat interface for study rooms
 */

import { ChatManager } from '../managers/social/ChatManager.js';
import { ChatMessage } from '../../domain/entities/ChatMessage.js';

export class ChatPanel {
  private container: HTMLElement | null = null;
  private chatManager: ChatManager;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private userNames: Map<string, string> = new Map();
  private isCollapsed: boolean = false;
  private typingUsers: Set<string> = new Set();
  private typingTimer: number | null = null;

  constructor(chatManager: ChatManager) {
    this.chatManager = chatManager;
  }

  /**
   * Initialize chat panel for a room
   */
  public async init(
    container: HTMLElement,
    roomId: string,
    userId: string,
    participants: Array<{ userId: string; userName: string }>
  ): Promise<void> {
    this.container = container;
    this.currentRoomId = roomId;
    this.currentUserId = userId;

    // Build user names map
    participants.forEach((p) => {
      this.userNames.set(p.userId, p.userName);
    });

    // Create chat UI
    this.createChatUI();

    // Load existing messages
    await this.loadMessages();

    // Subscribe to new messages
    this.subscribeToMessages();

    // Attach event listeners
    this.attachEventListeners();

    // Restore saved collapse state
    const savedState = localStorage.getItem('chat-collapsed');
    if (savedState === 'true') {
      this.toggleCollapse();
    }
  }

  /**
   * Create chat UI structure
   */
  private createChatUI(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="chat-header">
        <button class="chat-toggle-btn" id="chat-toggle-btn" title="Collapse Chat">
          <span class="toggle-icon">◀</span>
        </button>
        <h3>Chat</h3>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="chat-loading">Loading messages...</div>
      </div>

      <div class="chat-typing-indicator" id="chat-typing-indicator" style="display: none;">
        <div class="typing-indicator-content">
          <span class="typing-dots">
            <span></span><span></span><span></span>
          </span>
          <span class="typing-text" id="typing-users-text"></span>
        </div>
      </div>

      <div class="chat-input-container">
        <textarea
          id="chat-input"
          class="chat-input"
          placeholder="Type a message..."
          rows="1"
          maxlength="2000"
        ></textarea>
        <button id="chat-send-btn" class="chat-send-btn" title="Send message">
          ➤
        </button>
      </div>
    `;
  }

  /**
   * Load existing messages
   */
  private async loadMessages(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const messages = await this.chatManager.loadMessages(this.currentRoomId, 50);
      this.renderMessages(messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Failed to load messages');
    }
  }

  /**
   * Subscribe to new messages
   */
  private subscribeToMessages(): void {
    if (!this.currentRoomId) {
      console.warn('[ChatPanel] Cannot subscribe - no current room ID');
      return;
    }

    console.log('[ChatPanel] Subscribing to chat for room:', this.currentRoomId);
    this.chatManager.subscribeToRoom(
      this.currentRoomId,
      (message) => {
        console.log('[ChatPanel] New message received:', message);
        this.addMessageToUI(message);
        this.scrollToBottom();
      },
      (userId, userName, isTyping) => {
        this.updateTypingStatus(userId, userName, isTyping);
      }
    );
  }

  /**
   * Render messages
   */
  private renderMessages(messages: ChatMessage[]): void {
    if (!this.container) return;

    const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <p>No messages yet.</p>
          <p>Be the first to say something!</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = '';
    messages.forEach((message) => {
      this.addMessageToUI(message);
    });

    this.scrollToBottom();
  }

  /**
   * Add message to UI
   */
  private addMessageToUI(message: ChatMessage): void {
    if (!this.container) return;

    const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    // Check if message already exists (prevent duplicates)
    const existingMessage = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
      console.log('Message already in UI, skipping:', message.id);
      return;
    }

    // Remove empty state if it exists
    const emptyState = messagesContainer.querySelector('.chat-empty-state');
    if (emptyState) {
      emptyState.remove();
    }

    // Remove loading state if it exists
    const loadingState = messagesContainer.querySelector('.chat-loading');
    if (loadingState) {
      loadingState.remove();
    }

    const userName = this.userNames.get(message.userId) || 'Unknown User';
    const isOwnMessage = message.userId === this.currentUserId;
    const initials = this.getInitials(userName);

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
    messageEl.dataset.messageId = message.id;

    messageEl.innerHTML = `
      <div class="message-avatar">${initials}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-author">${this.escapeHtml(userName)}</span>
          <span class="message-time">${message.getRelativeTime()}</span>
        </div>
        <div class="message-text">${this.formatMessage(message.message)}</div>
      </div>
      ${isOwnMessage ? `
        <button class="message-delete-btn" data-message-id="${message.id}" title="Delete message">
          ×
        </button>
      ` : ''}
    `;

    messagesContainer.appendChild(messageEl);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Scope queries to this.container to avoid ID collisions with AI chat
    const sendBtn = this.container.querySelector('#chat-send-btn') as HTMLButtonElement;
    const input = this.container.querySelector('#chat-input') as HTMLTextAreaElement;
    const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (input) {
      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';

        // Broadcast typing status (debounced)
        if (input.value.trim().length > 0) {
          this.broadcastTyping();
        }
      });

      // Send on Enter (but allow Shift+Enter for new line)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Delete message handler
    if (messagesContainer) {
      messagesContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('message-delete-btn')) {
          const messageId = target.dataset.messageId;
          if (messageId) {
            this.deleteMessage(messageId);
          }
        }
      });
    }

    // Toggle collapse handler
    const toggleBtn = this.container.querySelector('#chat-toggle-btn') as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleCollapse());
    }
  }

  /**
   * Send a message
   */
  private async sendMessage(): Promise<void> {
    if (!this.container || !this.currentRoomId) return;

    const input = this.container.querySelector('#chat-input') as HTMLTextAreaElement;
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    const sendBtn = this.container.querySelector('#chat-send-btn') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    try {
      await this.chatManager.sendMessage(this.currentRoomId, message);

      // Immediately display the sent message (optimistic UI update)
      // The message will be in the cache after sendMessage completes
      const messages = this.chatManager.getMessages(this.currentRoomId);
      const sentMessage = messages[messages.length - 1]; // Get the last message (just sent)
      if (sentMessage) {
        this.addMessageToUI(sentMessage);
        this.scrollToBottom();
      }

      // Clear input
      input.value = '';
      input.style.height = 'auto';

      // Re-enable button
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to send message');

      // Re-enable button
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /**
   * Delete a message
   */
  private async deleteMessage(messageId: string): Promise<void> {
    if (!this.container || !confirm('Delete this message?')) return;

    try {
      await this.chatManager.deleteMessage(messageId);

      // Remove from UI
      const messageEl = this.container.querySelector(`[data-message-id="${messageId}"]`);
      if (messageEl) {
        messageEl.remove();
      }

      // Check if messages is empty now
      const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
      if (messagesContainer && messagesContainer.children.length === 0) {
        messagesContainer.innerHTML = `
          <div class="chat-empty-state">
            <p>No messages yet.</p>
            <p>Be the first to say something!</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      this.showError('Failed to delete message');
    }
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    if (!this.container) return;

    const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (!this.container) return;

    const messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
    if (!messagesContainer) return;

    const errorEl = document.createElement('div');
    errorEl.className = 'chat-error';
    errorEl.textContent = message;
    messagesContainer.appendChild(errorEl);

    setTimeout(() => errorEl.remove(), 5000);
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format message text (preserve line breaks, escape HTML)
   */
  private formatMessage(text: string): string {
    return this.escapeHtml(text).replace(/\n/g, '<br>');
  }

  /**
   * Add a participant to the user names map
   */
  public addParticipant(userId: string, userName: string): void {
    this.userNames.set(userId, userName);
  }

  /**
   * Remove a participant from the user names map
   */
  public removeParticipant(userId: string): void {
    this.userNames.delete(userId);
  }

  /**
   * Handle typing status update from another user
   */
  public updateTypingStatus(userId: string, userName: string, isTyping: boolean): void {
    if (isTyping) {
      this.typingUsers.add(userName);
    } else {
      this.typingUsers.delete(userName);
    }
    this.updateTypingIndicator();
  }

  /**
   * Update the typing indicator display
   */
  private updateTypingIndicator(): void {
    if (!this.container) return;

    const indicator = this.container.querySelector('#chat-typing-indicator') as HTMLElement;
    const textEl = this.container.querySelector('#typing-users-text') as HTMLElement;

    if (!indicator || !textEl) return;

    if (this.typingUsers.size === 0) {
      indicator.style.display = 'none';
    } else {
      const userArray = Array.from(this.typingUsers);
      let text = '';

      if (userArray.length === 1) {
        text = `${userArray[0]} is typing...`;
      } else if (userArray.length === 2) {
        text = `${userArray[0]} and ${userArray[1]} are typing...`;
      } else {
        text = `${userArray.length} people are typing...`;
      }

      textEl.textContent = text;
      indicator.style.display = 'flex';
    }
  }

  /**
   * Broadcast typing status to other users
   */
  private broadcastTyping(): void {
    if (!this.currentRoomId) return;

    // Clear existing timer
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
    }

    // Broadcast that user is typing
    this.chatManager.broadcastTyping(this.currentRoomId, true);

    // Set timer to stop typing after 1.5 seconds of inactivity
    this.typingTimer = window.setTimeout(() => {
      this.chatManager.broadcastTyping(this.currentRoomId!, false);
      this.typingTimer = null;
    }, 1500);
  }

  /**
   * Toggle chat panel collapse state
   */
  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;

    // Find the parent study-room-chat container
    const chatContainer = this.container?.closest('.study-room-chat');
    if (chatContainer) {
      chatContainer.classList.toggle('collapsed', this.isCollapsed);
    }

    // Update toggle button icon
    const toggleBtn = this.container?.querySelector('#chat-toggle-btn .toggle-icon');
    if (toggleBtn) {
      toggleBtn.textContent = this.isCollapsed ? '▶' : '◀';
    }

    // Save preference to localStorage
    localStorage.setItem('chat-collapsed', this.isCollapsed.toString());
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.chatManager.unsubscribe();
    if (this.currentRoomId) {
      this.chatManager.clearMessages(this.currentRoomId);
    }
    this.container = null;
    this.currentRoomId = null;
    this.currentUserId = null;
    this.userNames.clear();
  }
}
