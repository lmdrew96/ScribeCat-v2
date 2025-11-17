/**
 * FriendsModal
 *
 * Modal component for managing friends and friend requests.
 * Features three tabs: Friends list, Requests, and Find friends.
 */

import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { FriendData } from '../../domain/entities/Friend.js';
import type { FriendRequestData } from '../../domain/entities/FriendRequest.js';
import type { SearchUserResult } from '../../infrastructure/services/supabase/SupabaseFriendsRepository.js';
import { escapeHtml } from '../utils/formatting.js';

type TabType = 'friends' | 'requests' | 'find';

export class FriendsModal {
  private modal: HTMLElement | null = null;
  private friendsManager: FriendsManager;
  private currentTab: TabType = 'friends';
  private currentUserId: string | null = null;
  private searchTimeout: number | null = null;

  constructor(friendsManager: FriendsManager) {
    this.friendsManager = friendsManager;

    // Listen for changes
    this.friendsManager.addFriendsListener(() => this.refreshCurrentTab());
    this.friendsManager.addRequestsListener(() => this.refreshCurrentTab());
  }

  /**
   * Initialize the friends modal
   */
  public initialize(): void {
    this.createModal();
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="friends-modal" class="modal" style="display: none;">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content friends-modal-content">
          <div class="modal-header">
            <h2>Friends</h2>
            <button class="modal-close" data-close-modal aria-label="Close">×</button>
          </div>

          <!-- Tabs -->
          <div class="friends-tabs">
            <button class="friends-tab active" data-tab="friends">
              <span>Friends</span>
              <span class="friends-tab-badge" id="friends-count-badge">0</span>
            </button>
            <button class="friends-tab" data-tab="requests">
              <span>Requests</span>
              <span class="friends-tab-badge" id="requests-count-badge" style="display: none;">0</span>
            </button>
            <button class="friends-tab" data-tab="find">
              <span>Find Friends</span>
            </button>
          </div>

          <div class="modal-body">
            <!-- Friends Tab -->
            <div class="friends-tab-content" data-tab-content="friends">
              <div id="friends-list-container" class="friends-list-container">
                <div class="loading">Loading friends...</div>
              </div>
            </div>

            <!-- Requests Tab -->
            <div class="friends-tab-content" data-tab-content="requests" style="display: none;">
              <div class="requests-section">
                <h3>Incoming Requests</h3>
                <div id="incoming-requests-container" class="requests-container">
                  <p class="empty-state">No incoming friend requests</p>
                </div>
              </div>

              <div class="requests-section">
                <h3>Outgoing Requests</h3>
                <div id="outgoing-requests-container" class="requests-container">
                  <p class="empty-state">No outgoing friend requests</p>
                </div>
              </div>
            </div>

            <!-- Find Friends Tab -->
            <div class="friends-tab-content" data-tab-content="find" style="display: none;">
              <div class="find-friends-search">
                <div class="form-group">
                  <label for="find-friends-email">Search by email</label>
                  <input
                    type="email"
                    id="find-friends-email"
                    placeholder="friend@example.com"
                    autocomplete="off"
                  />
                </div>
                <div id="find-friends-message" class="message" style="display: none;"></div>
              </div>

              <div id="find-friends-results" class="find-friends-results">
                <p class="empty-state">Enter an email to find friends</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('friends-modal');

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close modal
    this.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // Tab switching
    this.modal.querySelectorAll('.friends-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab as TabType;
        this.switchTab(tabName);
      });
    });

    // Find friends search
    const searchInput = document.getElementById('find-friends-email') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.handleSearch();
    });

    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });
  }

  /**
   * Open the modal
   */
  async open(userId: string): Promise<void> {
    this.currentUserId = userId;

    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Switch to friends tab and load data
      this.switchTab('friends');
      await this.refreshAllTabs();
    }
  }

  /**
   * Close the modal
   */
  close(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      this.currentUserId = null;
    }
  }

  /**
   * Switch to a different tab
   */
  private switchTab(tabName: TabType): void {
    if (!this.modal) return;

    this.currentTab = tabName;

    // Update tab buttons
    this.modal.querySelectorAll('.friends-tab').forEach(tab => {
      const isActive = tab.getAttribute('data-tab') === tabName;
      tab.classList.toggle('active', isActive);
    });

    // Update tab content
    this.modal.querySelectorAll('.friends-tab-content').forEach(content => {
      const isActive = content.getAttribute('data-tab-content') === tabName;
      (content as HTMLElement).style.display = isActive ? 'block' : 'none';
    });

    // Refresh content for the active tab
    this.refreshCurrentTab();
  }

  /**
   * Refresh all tabs
   */
  private async refreshAllTabs(): Promise<void> {
    await this.friendsManager.refresh();
    this.updateTabBadges();
    this.refreshCurrentTab();
  }

  /**
   * Refresh current tab content
   */
  private refreshCurrentTab(): void {
    switch (this.currentTab) {
      case 'friends':
        this.renderFriendsList();
        break;
      case 'requests':
        this.renderRequests();
        break;
      case 'find':
        // Search results persist until new search
        break;
    }
  }

  /**
   * Update tab badges with counts
   */
  private updateTabBadges(): void {
    const friendsCount = this.friendsManager.getFriendsCount();
    const requestsCount = this.friendsManager.getIncomingRequestsCount();

    const friendsBadge = document.getElementById('friends-count-badge');
    const requestsBadge = document.getElementById('requests-count-badge');

    if (friendsBadge) {
      friendsBadge.textContent = friendsCount.toString();
    }

    if (requestsBadge) {
      requestsBadge.textContent = requestsCount.toString();
      requestsBadge.style.display = requestsCount > 0 ? 'inline-block' : 'none';
    }
  }

  // ============================================================================
  // Friends Tab
  // ============================================================================

  /**
   * Render friends list
   */
  private renderFriendsList(): void {
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
      const nameA = a.friendFullName || a.friendEmail;
      const nameB = b.friendFullName || b.friendEmail;
      return nameA.localeCompare(nameB);
    });

    container.innerHTML = sortedFriends.map(friend => this.renderFriendItem(friend)).join('');

    // Attach remove handlers
    container.querySelectorAll('.friend-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const friendId = (e.currentTarget as HTMLElement).dataset.friendId;
        if (friendId) {
          this.handleRemoveFriend(friendId);
        }
      });
    });

    this.updateTabBadges();
  }

  /**
   * Render a single friend item
   */
  private renderFriendItem(friend: FriendData): string {
    const displayName = friend.friendFullName || friend.friendEmail;
    const initials = this.getInitials(displayName);
    const onlineStatus = friend.isOnline ? '<span class="status-indicator online"></span>' : '';
    const statusText = friend.currentActivity || (friend.isOnline ? 'Online' : 'Offline');

    return `
      <div class="friend-item" data-friend-id="${friend.friendId}">
        <div class="friend-avatar">
          ${friend.friendAvatarUrl ?
            `<img src="${escapeHtml(friend.friendAvatarUrl)}" alt="${escapeHtml(displayName)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
          ${onlineStatus}
        </div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(displayName)}</div>
          <div class="friend-status">${escapeHtml(statusText)}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-remove-btn btn-text" data-friend-id="${friend.friendId}" title="Remove friend">
            Remove
          </button>
        </div>
      </div>
    `;
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
        this.showMessage('Friend removed', 'success');
      } catch (error) {
        this.showMessage(`Failed to remove friend: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      }
    }
  }

  // ============================================================================
  // Requests Tab
  // ============================================================================

  /**
   * Render friend requests (incoming and outgoing)
   */
  private renderRequests(): void {
    this.renderIncomingRequests();
    this.renderOutgoingRequests();
    this.updateTabBadges();
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
      this.showMessage('Friend request accepted!', 'success');
    } catch (error) {
      this.showMessage(`Failed to accept request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Handle rejecting a friend request
   */
  private async handleRejectRequest(requestId: string): Promise<void> {
    try {
      await this.friendsManager.rejectFriendRequest(requestId);
      this.showMessage('Friend request rejected', 'success');
    } catch (error) {
      this.showMessage(`Failed to reject request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Handle cancelling an outgoing friend request
   */
  private async handleCancelRequest(requestId: string): Promise<void> {
    try {
      await this.friendsManager.cancelFriendRequest(requestId);
      this.showMessage('Friend request cancelled', 'success');
    } catch (error) {
      this.showMessage(`Failed to cancel request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  // ============================================================================
  // Find Friends Tab
  // ============================================================================

  /**
   * Handle search input
   */
  private handleSearch(): void {
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
  private async performSearch(): Promise<void> {
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
      this.showFindMessage(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
    const displayName = user.fullName || user.email;
    const initials = this.getInitials(displayName);
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
            `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(displayName)}" />` :
            `<div class="avatar-placeholder">${escapeHtml(initials)}</div>`
          }
        </div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(displayName)}</div>
          <div class="search-result-email">${escapeHtml(user.email)}</div>
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
      this.showFindMessage('Friend request sent!', 'success');
      // Refresh search to update button state
      await this.performSearch();
    } catch (error) {
      this.showFindMessage(`Failed to send request: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

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

  /**
   * Show general message (for friends/requests tabs)
   */
  private showMessage(message: string, type: 'success' | 'error'): void {
    // For now, just use console and alert
    // TODO: Add a proper message display area in the modal
    console.log(`[${type}] ${message}`);
    if (type === 'error') {
      alert(message);
    }
  }

  /**
   * Show message in find friends tab
   */
  private showFindMessage(message: string, type: 'success' | 'error'): void {
    const messageEl = document.getElementById('find-friends-message');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = `message ${type === 'error' ? 'error' : 'success'}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  }
}
