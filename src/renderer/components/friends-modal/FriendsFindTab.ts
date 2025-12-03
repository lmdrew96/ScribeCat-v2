/**
 * FriendsFindTab
 *
 * Renders the find friends tab with search and add friend functionality.
 */

import type { FriendsManager } from '../../managers/social/FriendsManager.js';
import type { SearchUserResult } from '../../../infrastructure/services/supabase/SupabaseFriendsRepository.js';
import { escapeHtml } from '../../utils/formatting.js';

export interface FindTabCallbacks {
  showFindMessage: (message: string, type: 'success' | 'error') => void;
}

export class FriendsFindTab {
  private friendsManager: FriendsManager;
  private callbacks: FindTabCallbacks;
  private searchTimeout: number | null = null;

  constructor(friendsManager: FriendsManager, callbacks: FindTabCallbacks) {
    this.friendsManager = friendsManager;
    this.callbacks = callbacks;
  }

  /**
   * Handle search input
   */
  handleSearch(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(() => {
      this.performSearch();
    }, 500); // Debounce 500ms
  }

  /**
   * Perform the search
   */
  async performSearch(): Promise<void> {
    const searchInput = document.getElementById('find-friends-email') as HTMLInputElement;
    if (!searchInput) return;

    const searchEmail = searchInput.value.trim();

    if (!searchEmail) {
      this.renderSearchResults([]);
      return;
    }

    // Show loading
    const resultsContainer = document.getElementById('find-friends-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    }

    try {
      const users = await this.friendsManager.searchUsers(searchEmail, 20);
      this.renderSearchResults(users);
    } catch (error) {
      this.callbacks.showFindMessage(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      this.renderSearchResults([]);
    }
  }

  /**
   * Render search results
   */
  private renderSearchResults(users: SearchUserResult[]): void {
    const container = document.getElementById('find-friends-results');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<p class="empty-state">No users found</p>';
      return;
    }

    container.innerHTML = users.map(user => this.renderSearchResult(user)).join('');

    // Attach handlers
    container.querySelectorAll('.add-friend-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = (e.currentTarget as HTMLElement).dataset.userId;
        if (userId) {
          await this.handleSendRequest(userId);
        }
      });
    });
  }

  /**
   * Render a single search result
   */
  private renderSearchResult(user: SearchUserResult): string {
    // Primary display: @username (or email if no username for existing users)
    const primaryDisplay = user.username ? `@${user.username}` : user.email.split('@')[0];
    // Secondary display: Full name if available
    const secondaryDisplay = user.fullName || '';

    // For initials, use full name if available, otherwise username or email
    const initialsSource = user.fullName || user.username || user.email;
    const initials = this.getInitials(initialsSource);

    let actionButton = '';

    if (user.isFriend) {
      actionButton = '<span class="already-friends">Already friends</span>';
    } else if (user.hasPendingRequest) {
      actionButton = '<span class="request-pending">Request pending</span>';
    } else {
      actionButton = `<button class="add-friend-btn btn btn-primary btn-sm" data-user-id="${user.id}">Add Friend</button>`;
    }

    return `
      <div class="search-result-item" data-user-id="${user.id}">
        <div class="search-result-avatar">
          ${user.avatarUrl ?
            `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(primaryDisplay)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
        </div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(primaryDisplay)}</div>
          ${secondaryDisplay ? `<div class="search-result-email">${escapeHtml(secondaryDisplay)}</div>` : ''}
        </div>
        <div class="search-result-actions">
          ${actionButton}
        </div>
      </div>
    `;
  }

  /**
   * Handle sending a friend request
   */
  private async handleSendRequest(recipientId: string): Promise<void> {
    try {
      await this.friendsManager.sendFriendRequest(recipientId);
      this.callbacks.showFindMessage('Friend request sent!', 'success');
      // Refresh search to update button state
      await this.performSearch();
    } catch (error) {
      this.callbacks.showFindMessage(`Failed to send request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
