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
  }

  /**
   * Create chat UI structure
   */
  private createChatUI(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="chat-header">
        <h3>Chat</h3>
        <span class="chat-badge">Phase 3</span>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="chat-loading">Loading messages...</div>
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
    if (!this.currentRoomId) return;

    this.chatManager.subscribeToRoom(this.currentRoomId, (message) => {
      console.log('New message received:', message);
      this.addMessageToUI(message);
      this.scrollToBottom();
    });
  }

  /**
   * Render messages
   */
  private renderMessages(messages: ChatMessage[]): void {
    const messagesContainer = document.getElementById('chat-messages');
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
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    // Remove empty state if it exists
    const emptyState = messagesContainer.querySelector('.chat-empty-state');
    if (emptyState) {
      emptyState.remove();
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
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (input) {
      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
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
    const messagesContainer = document.getElementById('chat-messages');
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
  }

  /**
   * Send a message
   */
  private async sendMessage(): Promise<void> {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input || !this.currentRoomId) return;

    const message = input.value.trim();
    if (!message) return;

    const sendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement;
    if (sendBtn) sendBtn.disabled = true;

    try {
      await this.chatManager.sendMessage(this.currentRoomId, message);

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
    if (!confirm('Delete this message?')) return;

    try {
      await this.chatManager.deleteMessage(messageId);

      // Remove from UI
      const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageEl) {
        messageEl.remove();
      }

      // Check if messages is empty now
      const messagesContainer = document.getElementById('chat-messages');
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
    const messagesContainer = document.getElementById('chat-messages');
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
    const messagesContainer = document.getElementById('chat-messages');
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
