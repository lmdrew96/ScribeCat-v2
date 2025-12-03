/**
 * QuickActionsMenu Component
 *
 * Context menu for quick actions on sessions.
 * Triggered by right-click or clicking the "⋯" button on session cards.
 */

import type { Session } from '../../domain/entities/Session.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('QuickActionsMenu');

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: (session: Session) => void;
  divider?: boolean; // Show divider after this action
}

export interface QuickActionsConfig {
  actions: QuickAction[];
  getSessionById?: (sessionId: string) => Session | undefined;
}

export class QuickActionsMenu {
  private menu: HTMLElement | null = null;
  private currentSession: Session | null = null;
  private actions: QuickAction[] = [];
  private getSessionById?: (sessionId: string) => Session | undefined;

  /**
   * Initialize quick actions menu
   */
  initialize(actionsOrConfig: QuickAction[] | QuickActionsConfig): void {
    if (Array.isArray(actionsOrConfig)) {
      // Legacy: just actions array
      this.actions = actionsOrConfig;
    } else {
      // New: config object with actions and getSessionById
      this.actions = actionsOrConfig.actions;
      this.getSessionById = actionsOrConfig.getSessionById;
    }
    this.createMenu();
    this.setupGlobalListeners();
  }

  /**
   * Create menu element
   */
  private createMenu(): void {
    this.menu = document.createElement('div');
    this.menu.id = 'quick-actions-menu';
    this.menu.className = 'quick-actions-menu';
    this.menu.style.display = 'none';
    document.body.appendChild(this.menu);
  }

  /**
   * Show menu at position
   */
  show(session: Session, x: number, y: number): void {
    if (!this.menu) return;

    this.currentSession = session;
    this.renderMenu();

    // Position menu
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.display = 'block';

    // Adjust position if menu would go off-screen
    requestAnimationFrame(() => {
      if (!this.menu) return;

      const menuRect = this.menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position
      if (menuRect.right > viewportWidth) {
        this.menu.style.left = `${viewportWidth - menuRect.width - 8}px`;
      }

      // Adjust vertical position
      if (menuRect.bottom > viewportHeight) {
        this.menu.style.top = `${viewportHeight - menuRect.height - 8}px`;
      }
    });

    logger.info(`Quick actions menu shown for session: ${session.id}`);
  }

  /**
   * Hide menu
   */
  hide(): void {
    if (this.menu) {
      this.menu.style.display = 'none';
      this.currentSession = null;
    }
  }

  /**
   * Render menu content
   */
  private renderMenu(): void {
    if (!this.menu || !this.currentSession) return;

    this.menu.innerHTML = `
      <div class="quick-actions-menu-header">
        <span class="quick-actions-menu-title">Quick Actions</span>
      </div>
      <div class="quick-actions-menu-items">
        ${this.actions.map((action, index) => `
          <div
            class="quick-action-item"
            data-action-id="${action.id}"
            data-index="${index}"
          >
            <span class="quick-action-icon">${action.icon}</span>
            <span class="quick-action-label">${action.label}</span>
            ${action.shortcut ? `
              <span class="quick-action-shortcut">${action.shortcut}</span>
            ` : ''}
          </div>
          ${action.divider ? '<div class="quick-action-divider"></div>' : ''}
        `).join('')}
      </div>
    `;

    // Add click handlers
    this.menu.querySelectorAll('.quick-action-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0', 10);
        this.executeAction(index);
      });
    });
  }

  /**
   * Execute action
   */
  private executeAction(index: number): void {
    if (!this.currentSession) return;

    const action = this.actions[index];
    if (action) {
      logger.info(`Executing action: ${action.id}`);
      action.action(this.currentSession);
      this.hide();
    }
  }

  /**
   * Set up global listeners
   */
  private setupGlobalListeners(): void {
    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Context menu event (right-click)
    document.addEventListener('contextmenu', (e) => {
      // Check if right-click was on a session card
      const sessionCard = (e.target as HTMLElement).closest('[data-session-id]');
      if (sessionCard) {
        e.preventDefault();
        const sessionId = sessionCard.getAttribute('data-session-id');

        if (sessionId && this.getSessionById) {
          const session = this.getSessionById(sessionId);
          if (session) {
            this.show(session, e.clientX, e.clientY);
          } else {
            logger.warn(`Session not found for context menu: ${sessionId}`);
          }
        } else if (this.currentSession) {
          // Fallback to current session if no getSessionById callback
          this.show(this.currentSession, e.clientX, e.clientY);
        }
      }
    });
  }

  /**
   * Check if menu is visible
   */
  isVisible(): boolean {
    return this.menu?.style.display === 'block';
  }
}
