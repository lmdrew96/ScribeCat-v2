/**
 * TrashModal
 *
 * Modal for managing deleted sessions in trash.
 * Users can view deleted sessions, restore them, or permanently delete them.
 * Shows countdown to auto-deletion (30 days).
 */

import { SessionData } from '../../domain/entities/Session.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('TrashModal');

export class TrashModal {
  private modal: HTMLElement | null = null;
  private deletedSessions: SessionData[] = [];
  private onRestoreCallback?: (sessionId: string) => void;
  private onPermanentDeleteCallback?: (sessionId: string) => void;
  private onEmptyTrashCallback?: () => void;

  constructor() {
    this.createModal();
  }

  /**
   * Create the trash modal
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'trash-modal';
    this.modal.className = 'auth-modal hidden';

    this.modal.innerHTML = `
      <div class="auth-modal-content trash-modal-content">
        <button class="auth-close-btn" title="Close">×</button>

        <div class="auth-header">
          <h2>🗑️ Trash</h2>
          <p>Deleted sessions are automatically removed after 30 days</p>
        </div>

        <div id="trash-error" class="auth-error hidden"></div>
        <div id="trash-success" class="auth-success hidden"></div>

        <div class="trash-actions-bar">
          <button id="empty-trash-btn" class="auth-btn auth-btn-danger" disabled>
            Empty Trash
          </button>
          <span id="trash-count" class="trash-count">0 items in trash</span>
        </div>

        <div id="trash-sessions-container" class="trash-sessions-container">
          <div id="trash-empty-state" class="trash-empty-state">
            <span class="empty-icon">🗑️</span>
            <h3>Trash is empty</h3>
            <p>Deleted sessions will appear here</p>
          </div>
          <div id="trash-sessions-list" class="trash-sessions-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Close button
    const closeBtn = this.modal?.querySelector('.auth-close-btn');
    closeBtn?.addEventListener('click', () => this.hide());

    // Close on overlay click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Empty trash button
    const emptyTrashBtn = this.modal?.querySelector('#empty-trash-btn');
    emptyTrashBtn?.addEventListener('click', () => this.handleEmptyTrash());
  }

  /**
   * Show the modal
   */
  public async show(): Promise<void> {
    if (!this.modal) return;

    // Show modal
    this.modal.classList.remove('hidden');

    // Clear any previous messages
    this.hideError();
    this.hideSuccess();

    // Load deleted sessions
    await this.loadDeletedSessions();
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    this.modal?.classList.add('hidden');
  }

  /**
   * Load deleted sessions from backend
   */
  private async loadDeletedSessions(): Promise<void> {
    try {
      const response = await (window as any).scribeCat.session.getDeleted();

      if (!response.success) {
        this.showError('Failed to load deleted sessions');
        return;
      }

      this.deletedSessions = response.sessions;
      this.renderDeletedSessions();
    } catch (error) {
      logger.error('Failed to load deleted sessions:', error);
      this.showError('Failed to load deleted sessions');
    }
  }

  /**
   * Render the list of deleted sessions
   */
  private renderDeletedSessions(): void {
    const container = this.modal?.querySelector('#trash-sessions-list');
    const emptyState = this.modal?.querySelector('#trash-empty-state');
    const trashCount = this.modal?.querySelector('#trash-count');
    const emptyTrashBtn = this.modal?.querySelector('#empty-trash-btn') as HTMLButtonElement;

    if (!container) return;

    // Update count and empty trash button
    if (trashCount) {
      trashCount.textContent = `${this.deletedSessions.length} item${this.deletedSessions.length !== 1 ? 's' : ''} in trash`;
    }
    if (emptyTrashBtn) {
      emptyTrashBtn.disabled = this.deletedSessions.length === 0;
    }

    // Show empty state if no sessions
    if (this.deletedSessions.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      container.innerHTML = '';
      return;
    }

    // Hide empty state
    if (emptyState) emptyState.classList.add('hidden');

    // Render session cards
    container.innerHTML = this.deletedSessions.map(session => {
      const deletedAt = session.deletedAt ? new Date(session.deletedAt) : new Date();
      const now = new Date();
      const daysSinceDeletion = Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 30 - daysSinceDeletion);

      const isExpiringSoon = daysRemaining <= 7;
      const expiryClass = isExpiringSoon ? 'trash-warning' : '';

      return `
        <div class="trash-session-card ${expiryClass}" data-session-id="${session.id}">
          <div class="trash-session-header">
            <h4 class="trash-session-title">${this.escapeHtml(session.title)}</h4>
            <div class="trash-session-expiry">
              ${isExpiringSoon ? '⚠️ ' : ''}Deletes in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}
            </div>
          </div>
          <div class="trash-session-meta">
            <span class="trash-session-date">Deleted: ${deletedAt.toLocaleDateString()}</span>
            <span class="trash-session-duration">${this.formatDuration(session.duration)}</span>
          </div>
          <div class="trash-session-actions">
            <button class="auth-btn auth-btn-secondary trash-restore-btn" data-session-id="${session.id}">
              ↩️ Restore
            </button>
            <button class="auth-btn auth-btn-danger trash-delete-btn" data-session-id="${session.id}">
              🗑️ Delete Forever
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners to restore and delete buttons
    container.querySelectorAll('.trash-restore-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = (e.target as HTMLElement).dataset.sessionId;
        if (sessionId) this.handleRestore(sessionId);
      });
    });

    container.querySelectorAll('.trash-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = (e.target as HTMLElement).dataset.sessionId;
        if (sessionId) this.handlePermanentDelete(sessionId);
      });
    });
  }

  /**
   * Handle restoring a session
   */
  private async handleRestore(sessionId: string): Promise<void> {
    try {
      const session = this.deletedSessions.find(s => s.id === sessionId);
      if (!session) return;

      // Confirm restoration
      const confirmed = confirm(`Restore "${session.title}"?`);
      if (!confirmed) return;

      // Call backend to restore
      const response = await (window as any).scribeCat.session.restore(sessionId);

      if (!response.success) {
        this.showError('Failed to restore session');
        return;
      }

      this.showSuccess(`Restored "${session.title}"`);

      // Remove from list
      this.deletedSessions = this.deletedSessions.filter(s => s.id !== sessionId);
      this.renderDeletedSessions();

      // Call callback if provided
      if (this.onRestoreCallback) {
        this.onRestoreCallback(sessionId);
      }

      // Auto-hide success message after 3 seconds
      setTimeout(() => this.hideSuccess(), 3000);
    } catch (error) {
      logger.error('Failed to restore session:', error);
      this.showError('Failed to restore session');
    }
  }

  /**
   * Handle permanently deleting a session
   */
  private async handlePermanentDelete(sessionId: string): Promise<void> {
    try {
      const session = this.deletedSessions.find(s => s.id === sessionId);
      if (!session) return;

      // Confirm permanent deletion
      const confirmed = confirm(
        `Permanently delete "${session.title}"?\n\nThis action cannot be undone. The session will be deleted forever.`
      );
      if (!confirmed) return;

      // Call backend to permanently delete
      const response = await (window as any).scribeCat.session.permanentlyDelete(sessionId);

      if (!response.success) {
        this.showError('Failed to permanently delete session');
        return;
      }

      this.showSuccess(`Permanently deleted "${session.title}"`);

      // Remove from list
      this.deletedSessions = this.deletedSessions.filter(s => s.id !== sessionId);
      this.renderDeletedSessions();

      // Call callback if provided
      if (this.onPermanentDeleteCallback) {
        this.onPermanentDeleteCallback(sessionId);
      }

      // Auto-hide success message after 3 seconds
      setTimeout(() => this.hideSuccess(), 3000);
    } catch (error) {
      logger.error('Failed to permanently delete session:', error);
      this.showError('Failed to permanently delete session');
    }
  }

  /**
   * Handle emptying trash (delete all)
   */
  private async handleEmptyTrash(): Promise<void> {
    try {
      if (this.deletedSessions.length === 0) return;

      // Confirm emptying trash
      const confirmed = confirm(
        `Empty trash and permanently delete ${this.deletedSessions.length} session${this.deletedSessions.length !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`
      );
      if (!confirmed) return;

      // Get all session IDs
      const sessionIds = this.deletedSessions.map(s => s.id);

      // Call backend to permanently delete all
      const response = await (window as any).scribeCat.session.permanentlyDeleteMultiple(sessionIds);

      if (!response.success) {
        this.showError('Failed to empty trash');
        return;
      }

      const { result } = response;
      const successCount = result.successful.length;
      const failCount = result.failed.length;

      if (failCount > 0) {
        this.showError(`Deleted ${successCount} sessions, but ${failCount} failed`);
      } else {
        this.showSuccess(`Emptied trash (${successCount} sessions deleted)`);
      }

      // Clear the list
      this.deletedSessions = [];
      this.renderDeletedSessions();

      // Call callback if provided
      if (this.onEmptyTrashCallback) {
        this.onEmptyTrashCallback();
      }

      // Auto-hide message after 3 seconds
      setTimeout(() => {
        this.hideSuccess();
        this.hideError();
      }, 3000);
    } catch (error) {
      logger.error('Failed to empty trash:', error);
      this.showError('Failed to empty trash');
    }
  }

  /**
   * Set callback for when a session is restored
   */
  public onRestore(callback: (sessionId: string) => void): void {
    this.onRestoreCallback = callback;
  }

  /**
   * Set callback for when a session is permanently deleted
   */
  public onPermanentDelete(callback: (sessionId: string) => void): void {
    this.onPermanentDeleteCallback = callback;
  }

  /**
   * Set callback for when trash is emptied
   */
  public onEmptyTrash(callback: () => void): void {
    this.onEmptyTrashCallback = callback;
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorEl = this.modal?.querySelector('#trash-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    const errorEl = this.modal?.querySelector('#trash-error');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    const successEl = this.modal?.querySelector('#trash-success');
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.remove('hidden');
    }
  }

  /**
   * Hide success message
   */
  private hideSuccess(): void {
    const successEl = this.modal?.querySelector('#trash-success');
    if (successEl) {
      successEl.classList.add('hidden');
    }
  }

  /**
   * Format duration in seconds to human-readable string
   */
  private formatDuration(durationSeconds: number): string {
    const seconds = Math.floor(durationSeconds);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
