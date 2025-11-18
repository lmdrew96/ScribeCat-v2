/**
 * ShareModal
 *
 * Modal component for sharing sessions with other users.
 * Allows inviting users by email and managing existing shares.
 */

import { SessionSharingManager } from '../managers/SessionSharingManager.js';
import { escapeHtml } from '../utils/formatting.js';

export class ShareModal {
  private modal: HTMLElement | null = null;
  private sessionId: string | null = null;
  private shares: any[] = [];
  private invitations: any[] = [];
  private sessionSharingManager: SessionSharingManager;

  constructor() {
    // Modal will be created in initialize()
    this.sessionSharingManager = new SessionSharingManager();
  }

  /**
   * Initialize the share modal
   */
  public initialize(): void {
    this.createModal();
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="share-modal" class="modal" style="display: none;">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content share-modal-content">
          <div class="modal-header">
            <h2>Share Session</h2>
            <button class="modal-close" data-close-modal aria-label="Close">×</button>
          </div>

          <div class="modal-body">
            <!-- Share Form -->
            <div class="share-form">
              <h3>Invite someone</h3>
              <div class="form-group">
                <label for="share-email">Email address</label>
                <input
                  type="email"
                  id="share-email"
                  placeholder="colleague@example.com"
                  autocomplete="email"
                />
              </div>
              <div class="form-group">
                <label for="share-permission">Permission level</label>
                <select id="share-permission">
                  <option value="viewer">Can view</option>
                  <option value="editor">Can edit</option>
                </select>
              </div>
              <button id="share-submit-btn" class="btn btn-primary">
                Send invitation
              </button>
              <div id="share-message" class="message" style="display: none;"></div>
            </div>

            <!-- Current Shares -->
            <div class="share-list">
              <h3>People with access</h3>
              <div id="shares-container" class="shares-container">
                <div class="loading">Loading shares...</div>
              </div>
            </div>

            <!-- Pending Invitations -->
            <div class="invitations-list" id="invitations-section" style="display: none;">
              <h3>Pending invitations</h3>
              <div id="share-invitations-container" class="invitations-container"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('share-modal');

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

    // Submit share form
    const submitBtn = document.getElementById('share-submit-btn');
    submitBtn?.addEventListener('click', () => this.handleShare());

    // Enter key in email input
    const emailInput = document.getElementById('share-email') as HTMLInputElement;
    emailInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleShare();
      }
    });
  }

  /**
   * Open the modal for a specific session
   */
  async open(sessionId: string): Promise<void> {
    this.sessionId = sessionId;

    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Clear previous data
      this.clearForm();

      // Load shares
      await this.loadShares();
    }
  }

  /**
   * Close the modal
   */
  close(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      this.sessionId = null;
      this.clearForm();
    }
  }

  /**
   * Load existing shares and invitations
   */
  private async loadShares(): Promise<void> {
    if (!this.sessionId) return;

    const sharesContainer = document.getElementById('shares-container');
    const invitationsContainer = document.getElementById('share-invitations-container');
    const invitationsSection = document.getElementById('invitations-section');

    if (!sharesContainer) return;

    try {
      const result = await this.sessionSharingManager.getSessionShares(this.sessionId);

      if (result.success) {
        this.shares = result.shares || [];
        this.invitations = []; // Not supported yet in new API

        // Render shares
        if (this.shares.length === 0) {
          sharesContainer.innerHTML = '<p class="empty-state">Not shared with anyone yet</p>';
        } else {
          sharesContainer.innerHTML = this.shares.map(share => this.renderShare(share)).join('');
        }

        // Hide invitations section (not supported yet)
        if (invitationsSection) {
          invitationsSection.style.display = 'none';
        }

        // Attach remove handlers
        this.attachRemoveHandlers();
      } else {
        sharesContainer.innerHTML = `<p class="error">Failed to load shares: ${result.error}</p>`;
      }
    } catch (error) {
      console.error('Error loading shares:', error);
      sharesContainer.innerHTML = '<p class="error">Failed to load shares</p>';
    }
  }

  /**
   * Render a share item
   */
  private renderShare(share: any): string {
    const email = share.sharedWith?.email || 'Unknown';
    const userName = share.sharedWith?.fullName || email;
    const permissionLabel = share.permissionLevel === 'editor' ? 'Can edit' : 'Can view';

    return `
      <div class="share-item" data-share-id="${share.id}">
        <div class="share-user">
          <div class="share-avatar-placeholder">${email.charAt(0).toUpperCase()}</div>
          <div class="share-info">
            <div class="share-name">${escapeHtml(userName)}</div>
            <div class="share-email">${escapeHtml(email)} • ${permissionLabel}</div>
          </div>
        </div>
        <div class="share-actions">
          <select class="share-permission-select" data-share-id="${share.id}">
            <option value="viewer" ${share.permissionLevel === 'viewer' ? 'selected' : ''}>Can view</option>
            <option value="editor" ${share.permissionLevel === 'editor' ? 'selected' : ''}>Can edit</option>
          </select>
          <button class="btn btn-danger btn-sm remove-share-btn" data-share-id="${share.id}">Remove</button>
        </div>
      </div>
    `;
  }


  /**
   * Render an invitation item
   */
  private renderInvitation(invitation: any): string {
    const expiresAt = new Date(invitation.expiresAt);
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const permissionLabel = invitation.permissionLevel === 'editor' ? 'Can edit' : 'Can view';

    return `
      <div class="invitation-item" data-invitation-id="${invitation.id}">
        <div class="invitation-info">
          <div class="invitation-email">${invitation.email}</div>
          <div class="invitation-meta">
            <span class="invitation-permission">${permissionLabel}</span>
            <span class="invitation-expiry">Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm remove-invitation-btn" data-invitation-id="${invitation.id}">Cancel</button>
      </div>
    `;
  }

  /**
   * Attach handlers for remove/permission change
   */
  private attachRemoveHandlers(): void {
    // Remove share buttons
    document.querySelectorAll('.remove-share-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const shareId = (e.target as HTMLElement).dataset.shareId;
        if (shareId) {
          await this.removeShare(shareId);
        }
      });
    });

    // Remove invitation buttons
    document.querySelectorAll('.remove-invitation-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const invitationId = (e.target as HTMLElement).dataset.invitationId;
        if (invitationId) {
          await this.removeInvitation(invitationId);
        }
      });
    });

    // Permission change dropdowns
    document.querySelectorAll('.share-permission-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const shareId = (e.target as HTMLSelectElement).dataset.shareId;
        const newPermission = (e.target as HTMLSelectElement).value as 'viewer' | 'editor';
        if (shareId) {
          await this.updatePermission(shareId, newPermission);
        }
      });
    });
  }

  /**
   * Handle sharing form submission
   */
  private async handleShare(): Promise<void> {
    if (!this.sessionId) return;

    const emailInput = document.getElementById('share-email') as HTMLInputElement;
    const permissionSelect = document.getElementById('share-permission') as HTMLSelectElement;
    const submitBtn = document.getElementById('share-submit-btn') as HTMLButtonElement;
    const messageDiv = document.getElementById('share-message');

    const email = emailInput?.value.trim();
    const permission = permissionSelect?.value as 'viewer' | 'editor';

    if (!email) {
      this.showMessage('Please enter an email address', 'error');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showMessage('Please enter a valid email address', 'error');
      return;
    }

    // Disable button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const result = await this.sessionSharingManager.shareSession({
        sessionId: this.sessionId,
        email: email,
        permissionLevel: permission
      });

      if (result.success) {
        this.showMessage('Session shared successfully!', 'success');

        // Clear form
        this.clearForm();

        // Reload shares
        await this.loadShares();
      } else {
        this.showMessage(result.error || 'Failed to share session', 'error');
      }
    } catch (error) {
      console.error('Error sharing session:', error);
      this.showMessage('An error occurred while sharing', 'error');
    } finally {
      // Re-enable button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send invitation';
      }
    }
  }

  /**
   * Remove a share
   */
  private async removeShare(shareId: string): Promise<void> {
    if (!confirm('Remove this person\'s access to the session?')) {
      return;
    }

    try {
      const result = await this.sessionSharingManager.revokeAccess(shareId);

      if (result.success) {
        this.showMessage('Access removed', 'success');
        await this.loadShares();
      } else {
        this.showMessage(result.error || 'Failed to remove access', 'error');
      }
    } catch (error) {
      console.error('Error removing share:', error);
      this.showMessage('An error occurred', 'error');
    }
  }

  /**
   * Remove an invitation (not supported yet in new API)
   */
  private async removeInvitation(invitationId: string): Promise<void> {
    // Not supported yet
    this.showMessage('Invitation removal not supported yet', 'error');
  }

  /**
   * Update share permission
   */
  private async updatePermission(shareId: string, permissionLevel: 'viewer' | 'editor'): Promise<void> {
    try {
      const result = await this.sessionSharingManager.updateSharePermission(shareId, permissionLevel);

      if (result.success) {
        this.showMessage('Permission updated', 'success');
      } else {
        this.showMessage(result.error || 'Failed to update permission', 'error');
        // Reload to reset the dropdown
        await this.loadShares();
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      this.showMessage('An error occurred', 'error');
      await this.loadShares();
    }
  }

  /**
   * Show a message to the user
   */
  private showMessage(text: string, type: 'success' | 'error'): void {
    // Use ticker notifications for better UX
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      if (type === 'success') {
        notificationTicker.success(text);
      } else {
        notificationTicker.error(text);
      }
    }
  }

  /**
   * Clear the form
   */
  private clearForm(): void {
    const emailInput = document.getElementById('share-email') as HTMLInputElement;
    const permissionSelect = document.getElementById('share-permission') as HTMLSelectElement;
    const messageDiv = document.getElementById('share-message');

    if (emailInput) emailInput.value = '';
    if (permissionSelect) permissionSelect.value = 'viewer';
    if (messageDiv) messageDiv.style.display = 'none';
  }

  /**
   * Destroy the modal
   */
  destroy(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
