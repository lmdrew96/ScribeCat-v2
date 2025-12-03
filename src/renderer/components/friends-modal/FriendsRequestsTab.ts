/**
 * FriendsRequestsTab
 *
 * Renders the friend requests tab with incoming and outgoing requests.
 */

import type { FriendsManager } from '../../managers/social/FriendsManager.js';
import type { FriendRequestData } from '../../../domain/entities/FriendRequest.js';
import { escapeHtml } from '../../utils/formatting.js';

export interface RequestsTabCallbacks {
  showMessage: (message: string, type: 'success' | 'error') => void;
  updateTabBadges: () => void;
}

export class FriendsRequestsTab {
  private friendsManager: FriendsManager;
  private callbacks: RequestsTabCallbacks;

  constructor(friendsManager: FriendsManager, callbacks: RequestsTabCallbacks) {
    this.friendsManager = friendsManager;
    this.callbacks = callbacks;
  }

  /**
   * Render friend requests (incoming and outgoing)
   */
  render(): void {
    this.renderIncomingRequests();
    this.renderOutgoingRequests();
    this.callbacks.updateTabBadges();
  }

  /**
   * Render incoming friend requests
   */
  private renderIncomingRequests(): void {
    const container = document.getElementById('incoming-requests-container');
    if (!container) return;

    const incoming = this.friendsManager.getIncomingRequests();

    if (incoming.length === 0) {
      container.innerHTML = '<p class="empty-state">No incoming friend requests</p>';
      return;
    }

    container.innerHTML = incoming.map(req => this.renderIncomingRequest(req)).join('');

    // Attach handlers
    container.querySelectorAll('.request-accept-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const requestId = (e.currentTarget as HTMLElement).dataset.requestId;
        if (requestId) {
          await this.handleAcceptRequest(requestId);
        }
      });
    });

    container.querySelectorAll('.request-reject-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const requestId = (e.currentTarget as HTMLElement).dataset.requestId;
        if (requestId) {
          await this.handleRejectRequest(requestId);
        }
      });
    });
  }

  /**
   * Render a single incoming request
   */
  private renderIncomingRequest(request: FriendRequestData): string {
    const displayName = request.senderFullName || request.senderEmail || 'Unknown';
    const initials = this.getInitials(displayName);

    return `
      <div class="request-item incoming-request" data-request-id="${request.id}">
        <div class="request-avatar">
          ${request.senderAvatarUrl ?
            `<img src="${escapeHtml(request.senderAvatarUrl)}" alt="${escapeHtml(displayName)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
        </div>
        <div class="request-info">
          <div class="request-name">${escapeHtml(displayName)}</div>
          <div class="request-email">${escapeHtml(request.senderEmail || '')}</div>
          <div class="request-time">${this.getTimeSince(request.createdAt)}</div>
        </div>
        <div class="request-actions">
          <button class="request-accept-btn btn btn-primary btn-sm" data-request-id="${request.id}">
            Accept
          </button>
          <button class="request-reject-btn btn btn-secondary btn-sm" data-request-id="${request.id}">
            Reject
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render outgoing friend requests
   */
  private renderOutgoingRequests(): void {
    const container = document.getElementById('outgoing-requests-container');
    if (!container) return;

    const outgoing = this.friendsManager.getOutgoingRequests();

    if (outgoing.length === 0) {
      container.innerHTML = '<p class="empty-state">No outgoing friend requests</p>';
      return;
    }

    container.innerHTML = outgoing.map(req => this.renderOutgoingRequest(req)).join('');

    // Attach handlers
    container.querySelectorAll('.request-cancel-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const requestId = (e.currentTarget as HTMLElement).dataset.requestId;
        if (requestId) {
          await this.handleCancelRequest(requestId);
        }
      });
    });
  }

  /**
   * Render a single outgoing request
   */
  private renderOutgoingRequest(request: FriendRequestData): string {
    const displayName = request.recipientFullName || request.recipientEmail || 'Unknown';
    const initials = this.getInitials(displayName);

    return `
      <div class="request-item outgoing-request" data-request-id="${request.id}">
        <div class="request-avatar">
          ${request.recipientAvatarUrl ?
            `<img src="${escapeHtml(request.recipientAvatarUrl)}" alt="${escapeHtml(displayName)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
        </div>
        <div class="request-info">
          <div class="request-name">${escapeHtml(displayName)}</div>
          <div class="request-email">${escapeHtml(request.recipientEmail || '')}</div>
          <div class="request-time">Sent ${this.getTimeSince(request.createdAt)}</div>
        </div>
        <div class="request-actions">
          <button class="request-cancel-btn btn btn-secondary btn-sm" data-request-id="${request.id}">
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Handle accepting a friend request
   */
  private async handleAcceptRequest(requestId: string): Promise<void> {
    try {
      await this.friendsManager.acceptFriendRequest(requestId);
      this.callbacks.showMessage('Friend request accepted!', 'success');
    } catch (error) {
      this.callbacks.showMessage(`Failed to accept request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Handle rejecting a friend request
   */
  private async handleRejectRequest(requestId: string): Promise<void> {
    try {
      await this.friendsManager.rejectFriendRequest(requestId);
      this.callbacks.showMessage('Friend request rejected', 'success');
    } catch (error) {
      this.callbacks.showMessage(`Failed to reject request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Handle cancelling an outgoing friend request
   */
  private async handleCancelRequest(requestId: string): Promise<void> {
    try {
      await this.friendsManager.cancelFriendRequest(requestId);
      this.callbacks.showMessage('Friend request cancelled', 'success');
    } catch (error) {
      this.callbacks.showMessage(`Failed to cancel request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Get initials from name or email
   */
  private getInitials(name: string): string {
    const parts = name.split(/[\s@]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get human-readable time since date
   */
  private getTimeSince(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = Date.now();
    const diff = now - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return dateObj.toLocaleDateString();
  }
}
