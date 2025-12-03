/**
 * FriendsModal
 *
 * Modal component for managing friends and friend requests.
 * Features three tabs: Friends list, Requests, and Find friends.
 *
 * Delegates to:
 * - FriendsListTab: Friends list rendering and actions
 * - FriendsRequestsTab: Incoming/outgoing request handling
 * - FriendsFindTab: User search and friend request sending
 */

import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { MessagesManager } from '../managers/social/MessagesManager.js';
import { MessagesView } from './MessagesView.js';
import { FriendsListTab, FriendsRequestsTab, FriendsFindTab } from './friends-modal/index.js';

type TabType = 'friends' | 'requests' | 'find' | 'messages';

export class FriendsModal {
  private modal: HTMLElement | null = null;
  private friendsManager: FriendsManager;
  private messagesManager: MessagesManager | null = null;
  private messagesView: MessagesView | null = null;
  private currentTab: TabType = 'friends';
  private currentUserId: string | null = null;

  // Delegated tab components
  private friendsListTab: FriendsListTab;
  private requestsTab: FriendsRequestsTab;
  private findTab: FriendsFindTab;

  constructor(friendsManager: FriendsManager, messagesManager?: MessagesManager) {
    this.friendsManager = friendsManager;
    this.messagesManager = messagesManager || null;

    // Initialize delegated tab components
    this.friendsListTab = new FriendsListTab(friendsManager, {
      showMessage: (msg, type) => this.showMessage(msg, type),
      switchToMessages: (friendId, friendName) => {
        if (this.messagesView) {
          this.switchTab('messages');
          this.messagesView.showCompose(friendId, friendName);
        }
      },
      updateTabBadges: () => this.updateTabBadges(),
    });

    this.requestsTab = new FriendsRequestsTab(friendsManager, {
      showMessage: (msg, type) => this.showMessage(msg, type),
      updateTabBadges: () => this.updateTabBadges(),
    });

    this.findTab = new FriendsFindTab(friendsManager, {
      showFindMessage: (msg, type) => this.showFindMessage(msg, type),
    });

    // Listen for changes
    this.friendsManager.addFriendsListener(() => this.refreshCurrentTab());
    this.friendsManager.addRequestsListener(() => this.refreshCurrentTab());

    // Listen for unread count changes
    if (this.messagesManager) {
      this.messagesManager.addUnreadCountListener((count) => this.updateMessagesBadge(count));
    }
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
            <button class="friends-tab" data-tab="messages">
              <span>Messages</span>
              <span class="friends-tab-badge" id="messages-count-badge" style="display: none;">0</span>
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
                  <label for="find-friends-email">Search by username or email</label>
                  <input
                    type="text"
                    id="find-friends-email"
                    placeholder="@username or email"
                    autocomplete="off"
                  />
                </div>
                <div id="find-friends-message" class="message" style="display: none;"></div>
              </div>

              <div id="find-friends-results" class="find-friends-results">
                <p class="empty-state">Enter a username or email to find friends</p>
              </div>
            </div>

            <!-- Messages Tab -->
            <div class="friends-tab-content" data-tab-content="messages" style="display: none;">
              <div id="messages-container" class="messages-container">
                <p class="empty-state">Loading messages...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('friends-modal');

    // Initialize MessagesView if manager is available
    if (this.messagesManager) {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        this.messagesView = new MessagesView(messagesContainer, this.messagesManager, this.friendsManager);
      }
    }

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
      this.findTab.handleSearch();
    });

    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.findTab.handleSearch();
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

    const previousTab = this.currentTab;
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

    // Initialize messages view when switching TO the messages tab
    // (but not when already on it or when called from refreshCurrentTab)
    if (tabName === 'messages' && previousTab !== 'messages' && this.messagesView) {
      this.messagesView.showInbox();
      return;
    }

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
        this.friendsListTab.render();
        break;
      case 'requests':
        this.requestsTab.render();
        break;
      case 'find':
        // Search results persist until new search
        break;
      case 'messages':
        // MessagesView handles its own state and rendering - don't reset it
        // Only initialize if not already showing content
        break;
    }
  }

  /**
   * Update tab badges with counts
   */
  private updateTabBadges(): void {
    const friendsCount = this.friendsManager.getFriendsCount();
    const requestsCount = this.friendsManager.getIncomingRequestsCount();
    const messagesCount = this.messagesManager?.getUnreadCount() || 0;

    const friendsBadge = document.getElementById('friends-count-badge');
    const requestsBadge = document.getElementById('requests-count-badge');
    const messagesBadge = document.getElementById('messages-count-badge');

    if (friendsBadge) {
      friendsBadge.textContent = friendsCount.toString();
    }

    if (requestsBadge) {
      requestsBadge.textContent = requestsCount.toString();
      requestsBadge.style.display = requestsCount > 0 ? 'inline-block' : 'none';
    }

    if (messagesBadge) {
      messagesBadge.textContent = messagesCount.toString();
      messagesBadge.style.display = messagesCount > 0 ? 'inline-block' : 'none';
    }
  }

  /**
   * Update messages badge (called by listener)
   */
  private updateMessagesBadge(count: number): void {
    const messagesBadge = document.getElementById('messages-count-badge');
    if (messagesBadge) {
      messagesBadge.textContent = count.toString();
      messagesBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

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
