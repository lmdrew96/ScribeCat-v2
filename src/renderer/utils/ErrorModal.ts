/**
 * Error Modal Utility
 *
 * Provides better UX for error messages compared to alert().
 * Shows styled modal dialogs with proper error formatting.
 */

import { getIconHTML } from './iconMap.js';

export class ErrorModal {
  /**
   * Show an error modal
   */
  public static show(title: string, message: string): void {
    // Remove existing error modal if any
    const existing = document.querySelector('.error-modal-overlay');
    if (existing) {
      existing.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'error-modal-overlay';
    overlay.innerHTML = `
      <div class="error-modal">
        <div class="error-modal-header">
          <span class="error-icon">⚠️</span>
          <h3>${this.escapeHtml(title)}</h3>
        </div>
        <div class="error-modal-body">
          <p>${this.escapeHtml(message)}</p>
        </div>
        <div class="error-modal-footer">
          <button class="error-modal-btn">OK</button>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(overlay);

    // Handle close
    const closeModal = () => {
      overlay.remove();
    };

    const btn = overlay.querySelector('.error-modal-btn');
    btn?.addEventListener('click', closeModal);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Close on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Show a loading modal (for long operations like AI generation)
   */
  public static showLoading(message: string): () => void {
    // Remove existing loading modal if any
    const existing = document.querySelector('.loading-modal-overlay');
    if (existing) {
      existing.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'loading-modal-overlay';
    overlay.innerHTML = `
      <div class="loading-modal">
        <div class="loading-spinner"></div>
        <h3>${this.escapeHtml(message)}</h3>
        <p>This may take up to a minute...</p>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(overlay);

    // Return cleanup function
    return () => {
      overlay.remove();
    };
  }

  /**
   * Show a success message (brief, auto-dismiss)
   */
  public static showSuccess(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
      <span class="success-icon">${getIconHTML('check', { size: 16 })}</span>
      <span>${this.escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
