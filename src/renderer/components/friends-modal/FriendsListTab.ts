/**
 * FriendsListTab
 *
 * Renders the friends list tab with online status, actions, and message integration.
 */

import type { FriendsManager } from '../../managers/social/FriendsManager.js';
import type { FriendData } from '../../../domain/entities/Friend.js';
import { escapeHtml } from '../../utils/formatting.js';

export interface FriendsListCallbacks {
  showMessage: (message: string, type: 'success' | 'error') => void;
  switchToMessages: (friendId: string, friendName: string | undefined) => void;
  updateTabBadges: () => void;
}

export class FriendsListTab {
  private friendsManager: FriendsManager;
  private callbacks: FriendsListCallbacks;

  constructor(friendsManager: FriendsManager, callbacks: FriendsListCallbacks) {
    this.friendsManager = friendsManager;
    this.callbacks = callbacks;
  }

  /**
   * Render friends list
   */
  render(): void {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    const friends = this.friendsManager.getFriends();

    if (friends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No friends yet</p>
          <p class="empty-state-hint">Use the "Find Friends" tab to add friends!</p>
        </div>
      `;
      return;
    }

    // Sort friends: online first, then alphabetically
    const sortedFriends = [...friends].sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      // Sort by username, fallback to email if no username
      const nameA = a.friendUsername || a.friendEmail.split('@')[0];
      const nameB = b.friendUsername || b.friendEmail.split('@')[0];
      return nameA.localeCompare(nameB);
    });

    container.innerHTML = sortedFriends.map(friend => this.renderFriendItem(friend)).join('');

    // Attach message handlers
    container.querySelectorAll('.friend-message-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const friendId = target.dataset.friendId;
        const friendName = target.dataset.friendName;
        if (friendId) {
          this.callbacks.switchToMessages(friendId, friendName);
        }
      });
    });

    // Attach remove handlers
    container.querySelectorAll('.friend-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const friendId = (e.currentTarget as HTMLElement).dataset.friendId;
        if (friendId) {
          this.handleRemoveFriend(friendId);
        }
      });
    });

    this.callbacks.updateTabBadges();
  }

  /**
   * Render a single friend item
   */
  private renderFriendItem(friend: FriendData): string {
    // Primary display: @username (or email if no username for existing users)
    const primaryDisplay = friend.friendUsername ? `@${friend.friendUsername}` : friend.friendEmail.split('@')[0];
    // Secondary display in status line if full name available
    const fullName = friend.friendFullName || '';

    // For initials, use full name if available, otherwise username or email
    const initialsSource = friend.friendFullName || friend.friendUsername || friend.friendEmail;
    const initials = this.getInitials(initialsSource);

    // Determine online status indicator
    const statusIndicator = this.getStatusIndicator(friend);

    // Get status text (uses Friend entity logic if available, or fallback)
    const statusText = this.getStatusText(friend);

    return `
      <div class="friend-item" data-friend-id="${friend.friendId}">
        <div class="friend-avatar">
          ${friend.friendAvatarUrl ?
            `<img src="${escapeHtml(friend.friendAvatarUrl)}" alt="${escapeHtml(primaryDisplay)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
          ${statusIndicator}
        </div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(primaryDisplay)}${fullName ? ` <span class="friend-fullname">(${escapeHtml(fullName)})</span>` : ''}</div>
          <div class="friend-status ${friend.isOnline ? 'status-online' : 'status-offline'}">${escapeHtml(statusText)}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-message-btn btn-icon" data-friend-id="${friend.friendId}" data-friend-name="${escapeHtml(primaryDisplay)}" title="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </button>
          <button class="friend-remove-btn btn-text" data-friend-id="${friend.friendId}" title="Remove friend">
            Remove
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get status indicator HTML for a friend
   */
  private getStatusIndicator(friend: FriendData): string {
    if (friend.isOnline) {
      return '<span class="status-indicator online" title="Online"></span>';
    }

    // Check if recently online (within last 10 minutes)
    if (friend.lastSeen) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const lastSeen = new Date(friend.lastSeen);
      if (lastSeen > tenMinutesAgo) {
        return '<span class="status-indicator away" title="Recently online"></span>';
      }
    }

    return '<span class="status-indicator offline" title="Offline"></span>';
  }

  /**
   * Get status text for a friend
   */
  private getStatusText(friend: FriendData): string {
    // If online and has activity, show the activity
    if (friend.isOnline && friend.currentActivity) {
      return friend.currentActivity;
    }

    if (friend.isOnline) {
      return 'Online';
    }

    // Check if recently online
    if (friend.lastSeen) {
      const lastSeen = new Date(friend.lastSeen);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      if (lastSeen > tenMinutesAgo) {
        return 'Recently online';
      }

      // Format last seen time
      return this.formatLastSeen(lastSeen);
    }

    return 'Offline';
  }

  /**
   * Format last seen time as human-readable string
   */
  private formatLastSeen(lastSeen: Date): string {
    const now = Date.now();
    const diff = now - lastSeen.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return lastSeen.toLocaleDateString();
    }
  }

  /**
   * Handle removing a friend
   */
  private async handleRemoveFriend(friendId: string): Promise<void> {
    const friend = this.friendsManager.getFriendById(friendId);
    if (!friend) return;

    const displayName = friend.friendFullName || friend.friendEmail;
    const confirmed = confirm(`Remove ${displayName} from your friends?`);

    if (confirmed) {
      try {
        await this.friendsManager.removeFriend(friendId);
        this.callbacks.showMessage('Friend removed', 'success');
      } catch (error) {
        this.callbacks.showMessage(`Failed to remove friend: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
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
}
