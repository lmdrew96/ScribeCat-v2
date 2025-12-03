/**
 * MessagesView
 *
 * UI component for Neomail-style private messaging.
 * Handles inbox, sent, compose, and read views.
 */

import { MessagesManager, type MessageData, type MessageAttachment } from '../managers/social/MessagesManager.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import { escapeHtml } from '../utils/formatting.js';

type ViewType = 'inbox' | 'sent' | 'compose' | 'read' | 'conversation';

interface ComposeState {
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  attachments: MessageAttachment[];
  replyToMessageId?: string;
}

export class MessagesView {
  private container: HTMLElement;
  private messagesManager: MessagesManager;
  private friendsManager: FriendsManager | null = null;
  private currentView: ViewType = 'inbox';
  private currentMessageId: string | null = null;
  private currentConversationFriendId: string | null = null;
  private composeState: ComposeState | null = null;

  constructor(container: HTMLElement, messagesManager: MessagesManager, friendsManager?: FriendsManager) {
    this.container = container;
    this.messagesManager = messagesManager;
    this.friendsManager = friendsManager || null;

    // Listen for changes
    this.messagesManager.addMessagesChangeListener(() => {
      if (this.currentView === 'inbox' || this.currentView === 'sent') {
        this.render();
      }
    });
  }

  /**
   * Render the current view
   */
  render(): void {
    switch (this.currentView) {
      case 'inbox':
        this.renderInbox();
        break;
      case 'sent':
        this.renderSent();
        break;
      case 'compose':
        this.renderCompose();
        break;
      case 'read':
        this.renderReadMessage();
        break;
      case 'conversation':
        this.renderConversation();
        break;
    }
  }

  /**
   * Show inbox view
   */
  async showInbox(): Promise<void> {
    this.currentView = 'inbox';
    await this.messagesManager.loadInbox();
    this.render();
  }

  /**
   * Show sent view
   */
  async showSent(): Promise<void> {
    this.currentView = 'sent';
    await this.messagesManager.loadSent();
    this.render();
  }

  /**
   * Show compose view
   */
  showCompose(recipientId?: string, recipientName?: string, replyToMessageId?: string): void {
    this.currentView = 'compose';
    this.composeState = {
      recipientId: recipientId || '',
      recipientName: recipientName || '',
      subject: '',
      content: '',
      attachments: [],
      replyToMessageId,
    };
    this.render();
  }

  /**
   * Show read message view
   */
  async showMessage(messageId: string): Promise<void> {
    this.currentView = 'read';
    this.currentMessageId = messageId;
    this.render();
  }

  /**
   * Show conversation with a friend
   */
  async showConversation(friendId: string): Promise<void> {
    this.currentView = 'conversation';
    this.currentConversationFriendId = friendId;
    await this.messagesManager.loadConversation(friendId);
    this.render();
  }

  // ============================================================================
  // Render Methods
  // ============================================================================

  private renderInbox(): void {
    const messages = this.messagesManager.getInboxMessages();

    this.container.innerHTML = `
      <div class="messages-view">
        <div class="messages-header">
          <div class="messages-tabs">
            <button class="messages-view-tab active" data-view="inbox">Inbox</button>
            <button class="messages-view-tab" data-view="sent">Sent</button>
          </div>
          <button class="btn btn-primary btn-sm messages-compose-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Compose
          </button>
        </div>
        <div class="messages-list">
          ${messages.length === 0 ? this.renderEmptyState('inbox') : messages.map(m => this.renderMessageItem(m, 'inbox')).join('')}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private renderSent(): void {
    const messages = this.messagesManager.getSentMessages();

    this.container.innerHTML = `
      <div class="messages-view">
        <div class="messages-header">
          <div class="messages-tabs">
            <button class="messages-view-tab" data-view="inbox">Inbox</button>
            <button class="messages-view-tab active" data-view="sent">Sent</button>
          </div>
          <button class="btn btn-primary btn-sm messages-compose-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Compose
          </button>
        </div>
        <div class="messages-list">
          ${messages.length === 0 ? this.renderEmptyState('sent') : messages.map(m => this.renderMessageItem(m, 'sent')).join('')}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private renderCompose(): void {
    const state = this.composeState!;
    const friends = this.friendsManager?.getFriends() || [];

    this.container.innerHTML = `
      <div class="messages-view">
        <div class="messages-header">
          <button class="btn btn-ghost btn-sm messages-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back
          </button>
          <h3>New Message</h3>
        </div>
        <form class="messages-compose-form">
          <div class="form-group">
            <label for="message-recipient">To</label>
            <select id="message-recipient" class="form-control" required>
              <option value="">Select a friend...</option>
              ${friends.map(f => {
                const displayName = f.friendUsername ? `@${f.friendUsername}` : f.friendEmail.split('@')[0];
                const isSelected = f.friendId === state.recipientId;
                return `<option value="${f.friendId}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
              }).join('')}
            </select>
            ${friends.length === 0 ? '<p class="form-hint">Add friends to send them messages!</p>' : ''}
          </div>
          <div class="form-group">
            <label for="message-subject">Subject <span class="optional">(optional)</span></label>
            <input
              type="text"
              id="message-subject"
              value="${escapeHtml(state.subject)}"
              placeholder="Enter subject..."
              maxlength="200"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label for="message-content">Message</label>
            <textarea
              id="message-content"
              placeholder="Write your message..."
              maxlength="5000"
              rows="6"
              class="form-control"
              required
            >${escapeHtml(state.content)}</textarea>
            <p class="form-hint char-count"><span id="content-char-count">0</span>/5000</p>
          </div>
          <div class="form-group">
            <label>Attachments <span class="optional">(optional)</span></label>
            <div class="messages-attachments-list" id="attachments-list">
              ${state.attachments.map(a => this.renderAttachmentPreview(a)).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm messages-add-attachment-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
              Add Attachment
            </button>
            <input type="file" id="attachment-input" style="display: none;" accept="image/*,.pdf" />
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost messages-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="message-send-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Send
            </button>
          </div>
        </form>
      </div>
    `;

    this.attachComposeListeners();
  }

  private async renderReadMessage(): Promise<void> {
    if (!this.currentMessageId) {
      this.showInbox();
      return;
    }

    const message = await this.messagesManager.getMessage(this.currentMessageId);
    if (!message) {
      this.showInbox();
      return;
    }

    // Mark as read if unread
    if (!message.readAt) {
      await this.messagesManager.markAsRead(message.id);
    }

    const senderName = MessagesManager.getSenderDisplayName(message);
    const recipientName = MessagesManager.getRecipientDisplayName(message);
    const formattedDate = new Date(message.createdAt).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    this.container.innerHTML = `
      <div class="messages-view">
        <div class="messages-header">
          <button class="btn btn-ghost btn-sm messages-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back
          </button>
          <div class="messages-header-actions">
            <button class="btn btn-ghost btn-sm messages-reply-btn" data-sender-id="${message.senderId}" data-sender-name="${escapeHtml(senderName)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 17 4 12 9 7"></polyline>
                <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
              </svg>
              Reply
            </button>
            <button class="btn btn-ghost btn-sm messages-delete-btn" data-message-id="${message.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
        <div class="message-detail">
          <div class="message-detail-header">
            ${message.subject ? `<h3 class="message-subject">${escapeHtml(message.subject)}</h3>` : ''}
            <div class="message-meta">
              <div class="message-meta-row">
                <span class="message-label">From:</span>
                <span class="message-value">${escapeHtml(senderName)}</span>
              </div>
              <div class="message-meta-row">
                <span class="message-label">To:</span>
                <span class="message-value">${escapeHtml(recipientName)}</span>
              </div>
              <div class="message-meta-row">
                <span class="message-label">Date:</span>
                <span class="message-value">${formattedDate}</span>
              </div>
            </div>
          </div>
          <div class="message-content">
            ${escapeHtml(message.content).replace(/\n/g, '<br>')}
          </div>
          ${message.attachments.length > 0 ? `
            <div class="message-attachments">
              <h4>Attachments</h4>
              <div class="attachments-grid">
                ${message.attachments.map(a => this.renderAttachmentItem(a)).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.attachReadListeners();
  }

  private async renderConversation(): Promise<void> {
    if (!this.currentConversationFriendId) {
      this.showInbox();
      return;
    }

    const messages = this.messagesManager.getCachedConversation(this.currentConversationFriendId) || [];
    const friendName = messages.length > 0
      ? (messages[0].senderId === this.currentConversationFriendId
          ? MessagesManager.getSenderDisplayName(messages[0])
          : MessagesManager.getRecipientDisplayName(messages[0]))
      : 'Conversation';

    this.container.innerHTML = `
      <div class="messages-view">
        <div class="messages-header">
          <button class="btn btn-ghost btn-sm messages-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
            Back
          </button>
          <h3>Conversation with ${escapeHtml(friendName)}</h3>
        </div>
        <div class="messages-conversation">
          ${messages.length === 0
            ? '<p class="empty-state">No messages yet. Start the conversation!</p>'
            : messages.map(m => this.renderConversationMessage(m)).join('')
          }
        </div>
        <div class="messages-compose-inline">
          <textarea
            id="quick-reply-content"
            placeholder="Type a message..."
            rows="2"
            class="form-control"
          ></textarea>
          <button class="btn btn-primary messages-quick-reply-btn" data-friend-id="${this.currentConversationFriendId}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.attachConversationListeners();
  }

  // ============================================================================
  // Render Helpers
  // ============================================================================

  private renderEmptyState(type: 'inbox' | 'sent'): string {
    const messages = {
      inbox: 'No messages in your inbox',
      sent: 'No sent messages',
    };

    return `
      <div class="messages-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <p>${messages[type]}</p>
      </div>
    `;
  }

  private renderMessageItem(message: MessageData, view: 'inbox' | 'sent'): string {
    const isUnread = view === 'inbox' && !message.readAt;
    const displayName = view === 'inbox'
      ? MessagesManager.getSenderDisplayName(message)
      : MessagesManager.getRecipientDisplayName(message);
    const preview = MessagesManager.getContentPreview(message.content, 80);
    const time = MessagesManager.getRelativeTime(message.createdAt);
    const hasAttachments = message.attachments.length > 0;

    return `
      <div class="message-item ${isUnread ? 'unread' : ''}" data-message-id="${message.id}">
        <div class="message-item-avatar">
          ${this.renderAvatar(message, view)}
        </div>
        <div class="message-item-content">
          <div class="message-item-header">
            <span class="message-item-sender">${escapeHtml(displayName)}</span>
            <span class="message-item-time">${time}</span>
          </div>
          ${message.subject ? `<div class="message-item-subject">${escapeHtml(message.subject)}</div>` : ''}
          <div class="message-item-preview">
            ${hasAttachments ? '<svg class="attachment-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>' : ''}
            ${escapeHtml(preview)}
          </div>
        </div>
        ${isUnread ? '<div class="message-item-unread-dot"></div>' : ''}
      </div>
    `;
  }

  private renderAvatar(message: MessageData, view: 'inbox' | 'sent'): string {
    const avatarUrl = view === 'inbox' ? message.senderAvatarUrl : message.recipientAvatarUrl;
    const name = view === 'inbox'
      ? (message.senderFullName || message.senderUsername || message.senderEmail)
      : (message.recipientFullName || message.recipientUsername || message.recipientEmail);

    if (avatarUrl) {
      return `<img src="${avatarUrl}" alt="" class="avatar" />`;
    }

    const initials = name
      ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
      : '??';

    return `<div class="avatar-initials">${initials}</div>`;
  }

  private renderConversationMessage(message: MessageData): string {
    const isSent = message.senderId !== this.currentConversationFriendId;
    const time = MessagesManager.getRelativeTime(message.createdAt);

    return `
      <div class="conversation-message ${isSent ? 'sent' : 'received'}">
        <div class="conversation-message-content">
          ${escapeHtml(message.content).replace(/\n/g, '<br>')}
        </div>
        <div class="conversation-message-time">${time}</div>
      </div>
    `;
  }

  private renderAttachmentPreview(attachment: MessageAttachment): string {
    return `
      <div class="attachment-preview" data-url="${attachment.url}">
        ${attachment.type === 'image'
          ? `<img src="${attachment.url}" alt="${escapeHtml(attachment.name)}" />`
          : `<div class="attachment-file-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>`
        }
        <span class="attachment-name">${escapeHtml(attachment.name)}</span>
        <button type="button" class="attachment-remove" data-url="${attachment.url}">×</button>
      </div>
    `;
  }

  private renderAttachmentItem(attachment: MessageAttachment): string {
    if (attachment.type === 'image') {
      return `
        <a href="${attachment.url}" target="_blank" class="attachment-item attachment-image">
          <img src="${attachment.url}" alt="${escapeHtml(attachment.name)}" />
          <span class="attachment-name">${escapeHtml(attachment.name)}</span>
        </a>
      `;
    }

    if (attachment.type === 'session_link') {
      return `
        <a href="#" class="attachment-item attachment-session" data-session-id="${attachment.url}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="attachment-name">${escapeHtml(attachment.name)}</span>
        </a>
      `;
    }

    return `
      <a href="${attachment.url}" target="_blank" class="attachment-item attachment-file">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span class="attachment-name">${escapeHtml(attachment.name)}</span>
      </a>
    `;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  private attachListeners(): void {
    // View tabs
    this.container.querySelectorAll('.messages-view-tab').forEach(tab => {
      tab.addEventListener('click', async (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.view as 'inbox' | 'sent';
        if (view === 'inbox') {
          await this.showInbox();
        } else {
          await this.showSent();
        }
      });
    });

    // Compose button
    this.container.querySelector('.messages-compose-btn')?.addEventListener('click', () => {
      this.showCompose();
    });

    // Message items
    this.container.querySelectorAll('.message-item').forEach(item => {
      item.addEventListener('click', async () => {
        const messageId = (item as HTMLElement).dataset.messageId;
        if (messageId) {
          await this.showMessage(messageId);
        }
      });
    });
  }

  private attachComposeListeners(): void {
    // Back button
    this.container.querySelector('.messages-back-btn')?.addEventListener('click', () => {
      this.showInbox();
    });

    // Cancel button
    this.container.querySelector('.messages-cancel-btn')?.addEventListener('click', () => {
      this.showInbox();
    });

    // Content character count
    const contentInput = this.container.querySelector('#message-content') as HTMLTextAreaElement;
    const charCount = this.container.querySelector('#content-char-count');
    contentInput?.addEventListener('input', () => {
      if (charCount) {
        charCount.textContent = String(contentInput.value.length);
      }
      if (this.composeState) {
        this.composeState.content = contentInput.value;
      }
    });

    // Subject input
    const subjectInput = this.container.querySelector('#message-subject') as HTMLInputElement;
    subjectInput?.addEventListener('input', () => {
      if (this.composeState) {
        this.composeState.subject = subjectInput.value;
      }
    });

    // Recipient select
    const recipientSelect = this.container.querySelector('#message-recipient') as HTMLSelectElement;
    recipientSelect?.addEventListener('change', () => {
      if (this.composeState) {
        this.composeState.recipientId = recipientSelect.value;
        const selectedOption = recipientSelect.options[recipientSelect.selectedIndex];
        this.composeState.recipientName = selectedOption?.text || '';
      }
    });

    // Add attachment button
    const addAttachmentBtn = this.container.querySelector('.messages-add-attachment-btn');
    const attachmentInput = this.container.querySelector('#attachment-input') as HTMLInputElement;
    addAttachmentBtn?.addEventListener('click', () => {
      attachmentInput?.click();
    });

    attachmentInput?.addEventListener('change', async () => {
      if (attachmentInput.files && attachmentInput.files.length > 0) {
        const file = attachmentInput.files[0];
        try {
          const attachment = await this.messagesManager.uploadAttachment(file);
          if (this.composeState) {
            this.composeState.attachments.push(attachment);
            this.render();
          }
        } catch (err) {
          console.error('Failed to upload attachment:', err);
          alert('Failed to upload attachment. Please try again.');
        }
        attachmentInput.value = '';
      }
    });

    // Remove attachment
    this.container.querySelectorAll('.attachment-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (e.currentTarget as HTMLElement).dataset.url;
        if (this.composeState && url) {
          this.composeState.attachments = this.composeState.attachments.filter(a => a.url !== url);
          this.render();
        }
      });
    });

    // Form submission
    const form = this.container.querySelector('.messages-compose-form') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get recipient from select if not already in state
      const recipientId = this.composeState?.recipientId || recipientSelect?.value;
      const content = this.composeState?.content || contentInput?.value;

      if (!recipientId || !content?.trim()) {
        return;
      }

      // Update state with current values
      if (this.composeState) {
        this.composeState.recipientId = recipientId;
        this.composeState.content = content;
      }

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending...';

      try {
        await this.messagesManager.sendMessage(
          this.composeState.recipientId,
          this.composeState.content,
          this.composeState.subject || undefined,
          this.composeState.attachments.length > 0 ? this.composeState.attachments : undefined
        );
        this.showSent();
      } catch (err) {
        console.error('Failed to send message:', err);
        alert('Failed to send message. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send';
      }
    });
  }

  private attachReadListeners(): void {
    // Back button
    this.container.querySelector('.messages-back-btn')?.addEventListener('click', () => {
      this.showInbox();
    });

    // Reply button
    this.container.querySelector('.messages-reply-btn')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const senderId = btn.dataset.senderId;
      const senderName = btn.dataset.senderName;
      if (senderId) {
        this.showCompose(senderId, senderName, this.currentMessageId || undefined);
      }
    });

    // Delete button
    this.container.querySelector('.messages-delete-btn')?.addEventListener('click', async (e) => {
      const messageId = (e.currentTarget as HTMLElement).dataset.messageId;
      if (messageId && confirm('Are you sure you want to delete this message?')) {
        try {
          await this.messagesManager.deleteMessage(messageId);
          this.showInbox();
        } catch (err) {
          console.error('Failed to delete message:', err);
          alert('Failed to delete message. Please try again.');
        }
      }
    });
  }

  private attachConversationListeners(): void {
    // Back button
    this.container.querySelector('.messages-back-btn')?.addEventListener('click', () => {
      this.showInbox();
    });

    // Quick reply
    const replyBtn = this.container.querySelector('.messages-quick-reply-btn');
    const replyInput = this.container.querySelector('#quick-reply-content') as HTMLTextAreaElement;

    replyBtn?.addEventListener('click', async () => {
      const content = replyInput?.value.trim();
      const friendId = (replyBtn as HTMLElement).dataset.friendId;

      if (!content || !friendId) return;

      (replyBtn as HTMLButtonElement).disabled = true;

      try {
        await this.messagesManager.sendMessage(friendId, content);
        replyInput.value = '';
        await this.showConversation(friendId);
      } catch (err) {
        console.error('Failed to send reply:', err);
        alert('Failed to send message. Please try again.');
      } finally {
        (replyBtn as HTMLButtonElement).disabled = false;
      }
    });

    // Enter to send
    replyInput?.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (replyBtn as HTMLButtonElement)?.click();
      }
    });
  }
}
