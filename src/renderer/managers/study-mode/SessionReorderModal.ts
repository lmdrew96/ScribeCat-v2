/**
 * SessionReorderModal
 *
 * Modal dialog for reordering sessions before creating a multi-session study set.
 * Provides drag-and-drop interface for session ordering and title input.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { formatDuration, escapeHtml } from '../../utils/formatting.js';

export class SessionReorderModal {
  private modal: HTMLElement | null = null;
  private sessions: Session[] = [];
  private onConfirm: ((orderedSessionIds: string[], title: string) => void) | null = null;
  private draggedIndex: number | null = null;

  /**
   * Show the modal with sessions to reorder
   */
  show(sessions: Session[], onConfirm: (orderedSessionIds: string[], title: string) => void): void {
    this.sessions = [...sessions]; // Clone array for reordering
    this.onConfirm = onConfirm;
    this.createModal();
    this.attachEventListeners();
  }

  /**
   * Hide and destroy the modal
   */
  hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.onConfirm = null;
    this.sessions = [];
    this.draggedIndex = null;
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    const modalHTML = `
      <div class="modal-overlay" id="reorder-modal-overlay">
        <div class="reorder-modal">
          <div class="modal-header">
            <h2>Create Multi-Session Study Set</h2>
            <button class="modal-close-btn" id="reorder-modal-close">&times;</button>
          </div>

          <div class="modal-body">
            <div class="reorder-instructions">
              <p>📚 Drag sessions to reorder them. The combined study set will follow this order.</p>
            </div>

            <div class="title-input-group">
              <label for="study-set-title">Study Set Title:</label>
              <input
                type="text"
                id="study-set-title"
                class="study-set-title-input"
                placeholder="e.g., Week 1-3 Lectures"
                maxlength="200"
              >
            </div>

            <div class="session-reorder-list" id="session-reorder-list">
              ${this.renderSessionList()}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" id="reorder-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="reorder-modal-confirm">Create Study Set</button>
          </div>
        </div>
      </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    this.modal = modalContainer.firstElementChild as HTMLElement;
    document.body.appendChild(this.modal);
  }

  /**
   * Render the list of sessions
   */
  private renderSessionList(): string {
    return this.sessions.map((session, index) => {
      const date = new Date(session.createdAt);
      const formattedDate = date.toLocaleDateString();
      const duration = formatDuration(session.duration);

      return `
        <div class="reorder-session-item" data-index="${index}" draggable="true">
          <div class="drag-handle">☰</div>
          <div class="session-order-number">${index + 1}</div>
          <div class="session-info">
            <div class="session-title">${escapeHtml(session.title)}</div>
            <div class="session-meta">
              <span>📅 ${formattedDate}</span>
              <span>⏱️ ${duration}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Re-render the session list after reordering
   */
  private refreshSessionList(): void {
    const listContainer = document.getElementById('session-reorder-list');
    if (listContainer) {
      listContainer.innerHTML = this.renderSessionList();
      this.attachDragListeners();
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Close button
    const closeBtn = document.getElementById('reorder-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Cancel button
    const cancelBtn = document.getElementById('reorder-modal-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hide());
    }

    // Confirm button
    const confirmBtn = document.getElementById('reorder-modal-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.handleConfirm());
    }

    // Click outside to close
    const overlay = document.getElementById('reorder-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hide();
        }
      });
    }

    // Escape key to close
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Drag and drop
    this.attachDragListeners();
  }

  /**
   * Attach drag and drop listeners
   */
  private attachDragListeners(): void {
    const items = document.querySelectorAll('.reorder-session-item');

    items.forEach((item, index) => {
      // Drag start
      item.addEventListener('dragstart', () => {
        this.draggedIndex = index;
        item.classList.add('dragging');
      });

      // Drag end
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        this.draggedIndex = null;
      });

      // Drag over
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.draggedIndex === null || this.draggedIndex === index) return;

        // Swap the sessions
        const temp = this.sessions[this.draggedIndex];
        this.sessions.splice(this.draggedIndex, 1);
        this.sessions.splice(index, 0, temp);
        this.draggedIndex = index;

        // Re-render
        this.refreshSessionList();
      });
    });
  }

  /**
   * Handle confirm button click
   */
  private handleConfirm(): void {
    const titleInput = document.getElementById('study-set-title') as HTMLInputElement;
    const title = titleInput?.value.trim();

    if (!title) {
      alert('Please enter a title for the study set');
      titleInput?.focus();
      return;
    }

    if (this.onConfirm) {
      const orderedSessionIds = this.sessions.map(s => s.id);
      this.onConfirm(orderedSessionIds, title);
    }

    this.hide();
  }
}
