/**
 * HeaderActionsMenu
 *
 * A single hamburger button in the top-right that opens a dropdown menu
 * with organized sections for all header actions.
 *
 * Sections:
 * - Account header with avatar (when signed in)
 * - Main actions: StudyQuest RPG, Friends, Study Rooms, Study Mode
 * - Settings & Help section
 * - Sign In (when signed out)
 */

import { AuthManager } from '../managers/AuthManager.js';
import { getIconHTML } from '../utils/iconMap.js';

export interface HeaderActionsMenuDependencies {
  authManager: AuthManager;
  onStudyQuest: () => void;
  onFriends: () => void;
  onStudyRooms: () => void;
  onStudyMode: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onSignIn: () => void;
}

export class HeaderActionsMenu {
  private authManager: AuthManager;
  private dependencies: HeaderActionsMenuDependencies;
  private menuButton: HTMLButtonElement | null = null;
  private dropdownMenu: HTMLElement | null = null;
  private isOpen = false;

  // Badge counts
  private friendsCount = 0;
  private roomsCount = 0;

  constructor(deps: HeaderActionsMenuDependencies) {
    this.authManager = deps.authManager;
    this.dependencies = deps;
    this.initialize();
  }

  /**
   * Initialize the menu
   */
  private initialize(): void {
    this.createMenuButton();
    this.createDropdownMenu();
    this.setupEventListeners();
    this.updateAuthState();

    // Listen for auth state changes
    this.authManager.onAuthStateChange(() => {
      this.updateAuthState();
    });
  }

  /**
   * Create the hamburger menu button
   */
  private createMenuButton(): void {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
      console.error('[HeaderActionsMenu] Header actions container not found');
      return;
    }

    // Clear existing buttons except profile-btn (which may be handled separately)
    const existingButtons = headerActions.querySelectorAll(
      '#studyquest-btn, #signin-btn, #friends-btn, #study-rooms-btn, #study-mode-btn, #settings-btn, #help-btn'
    );
    existingButtons.forEach((btn) => btn.remove());

    // Create menu button
    this.menuButton = document.createElement('button');
    this.menuButton.id = 'header-menu-btn';
    this.menuButton.className = 'icon-btn header-menu-btn';
    this.menuButton.title = 'Menu';
    this.menuButton.setAttribute('aria-label', 'Open menu');
    this.menuButton.setAttribute('aria-expanded', 'false');
    this.menuButton.setAttribute('aria-haspopup', 'true');

    // Hamburger menu icon (three horizontal lines)
    this.menuButton.innerHTML = `
      <span class="menu-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5h16"/>
          <path d="M4 12h16"/>
          <path d="M4 19h16"/>
        </svg>
      </span>
    `;

    headerActions.appendChild(this.menuButton);
  }

  /**
   * Create the dropdown menu
   */
  private createDropdownMenu(): void {
    this.dropdownMenu = document.createElement('div');
    this.dropdownMenu.id = 'header-dropdown-menu';
    this.dropdownMenu.className = 'header-dropdown-menu hidden';
    this.dropdownMenu.setAttribute('role', 'menu');
    this.dropdownMenu.setAttribute('aria-labelledby', 'header-menu-btn');

    this.renderMenuContent();

    document.body.appendChild(this.dropdownMenu);
  }

  /**
   * Render the menu content based on auth state
   */
  private renderMenuContent(): void {
    if (!this.dropdownMenu) return;

    const isSignedIn = this.authManager.isAuthenticated();
    const user = this.authManager.getCurrentUser();
    const displayName = this.authManager.getUserDisplayName();
    const initials = this.authManager.getUserInitials();

    this.dropdownMenu.innerHTML = `
      ${
        isSignedIn
          ? `
        <!-- Account Section -->
        <div class="header-menu-section header-menu-account">
          <div class="header-menu-avatar">
            ${
              user?.avatarUrl
                ? `<img src="${user.avatarUrl}" alt="Profile" class="header-menu-avatar-img">`
                : `<span class="header-menu-initials">${initials}</span>`
            }
          </div>
          <span class="header-menu-account-name">${displayName}</span>
        </div>
        <div class="header-menu-divider"></div>
      `
          : ''
      }

      <!-- Main Actions -->
      <div class="header-menu-section">
        ${
          isSignedIn
            ? `
          <button class="header-menu-item" data-action="studyquest" role="menuitem">
            ${getIconHTML('gamepad', { size: 18 })}
            <span>StudyQuest RPG</span>
          </button>
        `
            : ''
        }

        ${
          !isSignedIn
            ? `
          <button class="header-menu-item" data-action="signin" role="menuitem">
            ${getIconHTML('user', { size: 18 })}
            <span>Sign In</span>
          </button>
        `
            : ''
        }

        ${
          isSignedIn
            ? `
          <button class="header-menu-item" data-action="friends" role="menuitem">
            ${getIconHTML('users', { size: 18 })}
            <span>Friends</span>
            ${this.friendsCount > 0 ? `<span class="header-menu-badge">${this.friendsCount}</span>` : ''}
          </button>

          <button class="header-menu-item" data-action="studyrooms" role="menuitem">
            ${getIconHTML('studyRooms', { size: 18 })}
            <span>Study Rooms</span>
            ${this.roomsCount > 0 ? `<span class="header-menu-badge">${this.roomsCount}</span>` : ''}
          </button>
        `
            : ''
        }

        <button class="header-menu-item" data-action="studymode" role="menuitem">
          ${getIconHTML('studyMode', { size: 18 })}
          <span>Study Mode</span>
        </button>
      </div>

      <div class="header-menu-divider"></div>

      <!-- Settings & Help -->
      <div class="header-menu-section">
        <button class="header-menu-item" data-action="settings" role="menuitem">
          ${getIconHTML('settings', { size: 18 })}
          <span>Settings</span>
        </button>

        <button class="header-menu-item" data-action="help" role="menuitem">
          ${getIconHTML('help', { size: 18 })}
          <span>Help &amp; Legal</span>
        </button>
      </div>
    `;

    // Re-attach action listeners after re-render
    this.attachMenuItemListeners();
  }

  /**
   * Attach click listeners to menu items
   */
  private attachMenuItemListeners(): void {
    if (!this.dropdownMenu) return;

    const items = this.dropdownMenu.querySelectorAll('.header-menu-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const action = (item as HTMLElement).dataset.action;
        this.handleAction(action);
        e.stopPropagation();
      });
    });
  }

  /**
   * Handle menu item action
   */
  private handleAction(action: string | undefined): void {
    this.close();

    switch (action) {
      case 'studyquest':
        this.dependencies.onStudyQuest();
        break;
      case 'signin':
        this.dependencies.onSignIn();
        break;
      case 'friends':
        this.dependencies.onFriends();
        break;
      case 'studyrooms':
        this.dependencies.onStudyRooms();
        break;
      case 'studymode':
        this.dependencies.onStudyMode();
        break;
      case 'settings':
        this.dependencies.onSettings();
        break;
      case 'help':
        this.dependencies.onHelp();
        break;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Toggle on button click
    this.menuButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (
        this.isOpen &&
        this.dropdownMenu &&
        !this.dropdownMenu.contains(e.target as Node) &&
        e.target !== this.menuButton
      ) {
        this.close();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.menuButton?.focus();
      }
    });
  }

  /**
   * Toggle the dropdown menu
   */
  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open the dropdown menu
   */
  private open(): void {
    if (!this.menuButton || !this.dropdownMenu) return;

    // Position the menu below the button, aligned to the right
    const rect = this.menuButton.getBoundingClientRect();
    this.dropdownMenu.style.top = `${rect.bottom + 8}px`;
    this.dropdownMenu.style.right = `${window.innerWidth - rect.right}px`;

    this.dropdownMenu.classList.remove('hidden');
    this.dropdownMenu.classList.add('visible');
    this.menuButton.setAttribute('aria-expanded', 'true');
    this.isOpen = true;

    // Focus first menu item
    const firstItem = this.dropdownMenu.querySelector('.header-menu-item') as HTMLElement;
    firstItem?.focus();
  }

  /**
   * Close the dropdown menu
   */
  private close(): void {
    if (!this.dropdownMenu) return;

    this.dropdownMenu.classList.remove('visible');
    this.dropdownMenu.classList.add('hidden');
    this.menuButton?.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  /**
   * Update UI based on auth state
   */
  private updateAuthState(): void {
    this.renderMenuContent();
  }

  /**
   * Update friends badge count
   */
  updateFriendsCount(count: number): void {
    this.friendsCount = count;
    this.renderMenuContent();
  }

  /**
   * Update rooms badge count
   */
  updateRoomsCount(count: number): void {
    this.roomsCount = count;
    this.renderMenuContent();
  }

  /**
   * Destroy the menu
   */
  destroy(): void {
    this.dropdownMenu?.remove();
    this.menuButton?.remove();
  }
}
