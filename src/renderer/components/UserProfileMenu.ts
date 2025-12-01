/**
 * UserProfileMenu
 *
 * Dropdown menu for user profile and account actions.
 */

import { AuthManager } from '../managers/AuthManager.js';
import { AccountSettingsModal } from './AccountSettingsModal.js';
import { getIconHTML } from '../utils/iconMap.js';

export class UserProfileMenu {
  private authManager: AuthManager;
  private accountSettingsModal: AccountSettingsModal | null = null;
  private button: HTMLElement | null = null;
  private menu: HTMLElement | null = null;
  private onSignOut?: () => void;

  constructor(authManager: AuthManager, accountSettingsModal?: AccountSettingsModal) {
    this.authManager = authManager;
    this.accountSettingsModal = accountSettingsModal || null;
    this.createButton();
    this.createMenu();
    this.setupEventListeners();
    this.updateUI();

    // Listen for auth state changes
    this.authManager.onAuthStateChange(() => {
      this.updateUI();
    });
  }

  /**
   * Create the profile button in the header
   */
  private createButton(): void {
    // Find the header actions container
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
      console.error('Header actions container not found');
      return;
    }

    // Create profile button (insert before settings button)
    this.button = document.createElement('button');
    this.button.id = 'profile-btn';
    this.button.className = 'icon-btn profile-btn hidden';
    this.button.title = 'Account';

    this.button.innerHTML = `
      <div class="profile-avatar">
        <span id="profile-initials">?</span>
      </div>
    `;

    // Insert before settings button
    const settingsBtn = headerActions.querySelector('#settings-btn');
    if (settingsBtn) {
      headerActions.insertBefore(this.button, settingsBtn);
    } else {
      headerActions.appendChild(this.button);
    }
  }

  /**
   * Create the profile dropdown menu
   */
  private createMenu(): void {
    this.menu = document.createElement('div');
    this.menu.id = 'profile-menu';
    this.menu.className = 'profile-menu hidden';

    this.menu.innerHTML = `
      <div class="profile-menu-header">
        <div class="profile-menu-avatar">
          <span id="profile-menu-initials">?</span>
        </div>
        <div class="profile-menu-info">
          <div id="profile-menu-name" class="profile-menu-name">Guest</div>
          <div id="profile-menu-email" class="profile-menu-email"></div>
        </div>
      </div>

      <div class="profile-menu-divider"></div>

      <div class="profile-menu-items">
        <button id="profile-menu-account" class="profile-menu-item">
          <span class="profile-menu-icon">${getIconHTML('settings', { size: 16 })}</span>
          <span>Account Settings</span>
        </button>

        <button id="profile-menu-sync" class="profile-menu-item">
          <span class="profile-menu-icon">${getIconHTML('sync', { size: 16 })}</span>
          <span>Sync Status</span>
          <span id="sync-status-badge" class="status-badge">Synced</span>
        </button>

        <button id="profile-menu-shared" class="profile-menu-item">
          <span class="profile-menu-icon">${getIconHTML('users', { size: 16 })}</span>
          <span>Shared Sessions</span>
        </button>
      </div>

      <div class="profile-menu-divider"></div>

      <div class="profile-menu-items">
        <button id="profile-menu-signout" class="profile-menu-item profile-menu-item-danger">
          <span class="profile-menu-icon">${getIconHTML('arrowRight', { size: 16 })}</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    document.body.appendChild(this.menu);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Toggle menu on button click
    this.button?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node) && e.target !== this.button) {
        this.hideMenu();
      }
    });

    // Sign out button
    const signOutBtn = this.menu?.querySelector('#profile-menu-signout');
    signOutBtn?.addEventListener('click', () => {
      this.handleSignOut();
    });

    // Account settings
    const accountBtn = this.menu?.querySelector('#profile-menu-account');
    accountBtn?.addEventListener('click', () => {
      this.hideMenu();
      this.openAccountSettings();
    });

    // Sync status (placeholder for now)
    const syncBtn = this.menu?.querySelector('#profile-menu-sync');
    syncBtn?.addEventListener('click', () => {
      console.log('Sync status clicked (not implemented yet)');
      this.hideMenu();
    });

    // Shared sessions - open study mode filtered to shared sessions
    const sharedBtn = this.menu?.querySelector('#profile-menu-shared');
    sharedBtn?.addEventListener('click', () => {
      this.hideMenu();
      // Emit event to open study mode with shared sessions filter
      document.dispatchEvent(new CustomEvent('openSharedSessions'));
    });
  }

  /**
   * Update UI based on auth state
   */
  private updateUI(): void {
    const isAuthenticated = this.authManager.isAuthenticated();

    if (isAuthenticated) {
      // Show profile button
      this.button?.classList.remove('hidden');

      // Update profile info
      const displayName = this.authManager.getUserDisplayName();
      const initials = this.authManager.getUserInitials();
      const user = this.authManager.getCurrentUser();

      // Update button avatar
      const profileAvatar = this.button?.querySelector('.profile-avatar');
      if (profileAvatar) {
        if (user?.avatarUrl) {
          profileAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="Profile" class="profile-avatar-img">`;
        } else {
          profileAvatar.innerHTML = `<span id="profile-initials">${initials}</span>`;
        }
      }

      // Update menu header avatar
      const menuAvatar = this.menu?.querySelector('.profile-menu-avatar');
      if (menuAvatar) {
        if (user?.avatarUrl) {
          menuAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="Profile" class="profile-avatar-img">`;
        } else {
          menuAvatar.innerHTML = `<span id="profile-menu-initials">${initials}</span>`;
        }
      }

      // Update menu text info
      const menuName = this.menu?.querySelector('#profile-menu-name');
      const menuEmail = this.menu?.querySelector('#profile-menu-email');

      if (menuName) menuName.textContent = displayName;
      if (menuEmail && user) menuEmail.textContent = user.email;
    } else {
      // Hide profile button
      this.button?.classList.add('hidden');
      this.hideMenu();
    }
  }

  /**
   * Toggle the profile menu
   */
  private toggleMenu(): void {
    if (this.menu?.classList.contains('hidden')) {
      this.showMenu();
    } else {
      this.hideMenu();
    }
  }

  /**
   * Show the profile menu
   */
  private showMenu(): void {
    if (!this.button || !this.menu) return;

    // Position menu below button
    const rect = this.button.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom + 8}px`;
    this.menu.style.right = `${window.innerWidth - rect.right}px`;

    this.menu.classList.remove('hidden');
  }

  /**
   * Hide the profile menu
   */
  private hideMenu(): void {
    this.menu?.classList.add('hidden');
  }

  /**
   * Handle sign out
   */
  private async handleSignOut(): Promise<void> {
    this.hideMenu();

    // Show confirmation
    const confirmed = confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    // Disconnect Google Drive locally (preserve cloud credentials for auto-reconnect)
    try {
      const driveAuthResult = await window.scribeCat.drive.isAuthenticated();
      if (driveAuthResult.data) {
        await window.scribeCat.drive.disconnectLocal();
        console.log('Google Drive disconnected locally on logout (cloud credentials preserved)');
      }
    } catch (error) {
      console.error('Error disconnecting Google Drive on logout:', error);
      // Continue with logout even if Drive disconnect fails
    }

    // Sign out
    const result = await this.authManager.signOut();

    if (result.success) {
      console.log('Signed out successfully');
      this.onSignOut?.();
    } else {
      alert(`Failed to sign out: ${result.error}`);
    }
  }

  /**
   * Set callback for when user signs out
   */
  setOnSignOut(callback: () => void): void {
    this.onSignOut = callback;
  }

  /**
   * Update sync status badge
   */
  updateSyncStatus(status: 'synced' | 'syncing' | 'offline' | 'error'): void {
    const badge = this.menu?.querySelector('#sync-status-badge');
    if (!badge) return;

    badge.className = 'status-badge';

    switch (status) {
      case 'synced':
        badge.textContent = 'Synced';
        badge.classList.add('status-badge-success');
        break;
      case 'syncing':
        badge.textContent = 'Syncing...';
        badge.classList.add('status-badge-warning');
        break;
      case 'offline':
        badge.textContent = 'Offline';
        badge.classList.add('status-badge-secondary');
        break;
      case 'error':
        badge.textContent = 'Error';
        badge.classList.add('status-badge-danger');
        break;
    }
  }

  /**
   * Open account settings modal
   */
  private openAccountSettings(): void {
    if (this.accountSettingsModal) {
      this.accountSettingsModal.show();
    } else {
      console.error('Account settings modal not available');
      alert('Account settings is not available');
    }
  }

  /**
   * Set the account settings modal
   */
  setAccountSettingsModal(modal: AccountSettingsModal): void {
    this.accountSettingsModal = modal;
  }
}
