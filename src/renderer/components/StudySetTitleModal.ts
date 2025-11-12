/**
 * StudySetTitleModal
 *
 * Modal for entering a title when creating a multi-session study set.
 * Provides a clean UI for combining multiple sessions into one study set.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('StudySetTitleModal');

export class StudySetTitleModal {
  /**
   * Show modal to input study set title
   * @param sessionIds - Array of session IDs to combine
   * @param onConfirm - Callback when user confirms with a title
   */
  show(sessionIds: string[], onConfirm: (title: string) => void): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'study-set-modal-dialog';
    dialog.style.cssText = `
      background: var(--bg-secondary, #2c2c2c);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Title
    const title = document.createElement('h3');
    title.style.cssText = 'margin: 0 0 16px 0; color: var(--text-primary, #fff); font-size: 18px;';
    title.textContent = 'Create Study Set';
    dialog.appendChild(title);

    // Description
    const description = document.createElement('p');
    description.style.cssText = 'margin: 0 0 16px 0; color: var(--text-secondary, #aaa); font-size: 14px;';
    description.textContent = `Combine ${sessionIds.length} sessions into a study set`;
    dialog.appendChild(description);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter study set title...';
    input.style.cssText = `
      width: 100%;
      padding: 12px;
      background: var(--bg-tertiary, #1d1d1d);
      border: 1px solid var(--border-color, #444);
      border-radius: 8px;
      color: var(--text-primary, #fff);
      font-size: 14px;
      font-family: inherit;
      margin-bottom: 20px;
      box-sizing: border-box;
    `;
    dialog.appendChild(input);

    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn modal-btn-cancel';
    cancelBtn.style.cssText = `
      padding: 10px 20px;
      background: var(--bg-tertiary, #555);
      border: none;
      border-radius: 8px;
      color: var(--text-primary, #fff);
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
    cancelBtn.addEventListener('click', () => {
      this.close(overlay);
    });
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.opacity = '0.8';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.opacity = '1';
    });
    buttons.appendChild(cancelBtn);

    // Create button
    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create';
    createBtn.className = 'modal-btn modal-btn-primary';
    createBtn.style.cssText = `
      padding: 10px 20px;
      background: var(--accent, #00bcd4);
      border: none;
      border-radius: 8px;
      color: var(--bg-primary, #1d1d1d);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    `;

    const handleCreate = () => {
      const titleValue = input.value.trim();
      if (titleValue) {
        this.close(overlay);
        onConfirm(titleValue);
      }
    };

    createBtn.addEventListener('click', handleCreate);
    createBtn.addEventListener('mouseenter', () => {
      createBtn.style.opacity = '0.8';
    });
    createBtn.addEventListener('mouseleave', () => {
      createBtn.style.opacity = '1';
    });
    buttons.appendChild(createBtn);

    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus input and handle Enter key
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleCreate();
      } else if (e.key === 'Escape') {
        this.close(overlay);
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close(overlay);
      }
    });

    logger.info('Showing study set title input modal');
  }

  /**
   * Close the modal
   */
  private close(overlay: HTMLElement): void {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
      logger.info('Study set title modal closed');
    }
  }
}
