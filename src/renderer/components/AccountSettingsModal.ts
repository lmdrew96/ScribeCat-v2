/**
 * AccountSettingsModal
 *
 * Modal for managing user account settings including profile updates
 * and account management.
 */

import { AuthManager } from '../managers/AuthManager.js';
import { RendererSupabaseClient } from '../services/RendererSupabaseClient.js';
import { createLogger } from '../../shared/logger.js';
import { compressAvatarImage, isSupportedImageType } from '../utils/imageCompression.js';

const logger = createLogger('AccountSettingsModal');

export class AccountSettingsModal {
  private authManager: AuthManager;
  private modal: HTMLElement | null = null;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.createModal();
  }

  /**
   * Create the account settings modal
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'account-settings-modal';
    this.modal.className = 'auth-modal hidden';

    this.modal.innerHTML = `
      <div class="auth-modal-content">
        <button class="auth-close-btn" title="Close">×</button>

        <div class="auth-header">
          <h2>Account Settings</h2>
          <p>Manage your account information and preferences</p>
        </div>

        <div id="account-error" class="auth-error hidden"></div>
        <div id="account-success" class="auth-success hidden"></div>

        <div class="auth-form">
          <!-- Account Information Section -->
          <div class="account-section">
            <h3 class="account-section-title">Account Information</h3>

            <div class="account-info-grid">
              <div class="account-info-item">
                <label>Email</label>
                <div id="account-email" class="account-info-value">-</div>
              </div>

              <div class="account-info-item">
                <label>Member Since</label>
                <div id="account-created" class="account-info-value">-</div>
              </div>
            </div>
          </div>

          <!-- Profile Section -->
          <div class="account-section">
            <h3 class="account-section-title">Profile</h3>

            <!-- Avatar Upload -->
            <div class="avatar-upload-container">
              <div class="avatar-preview" id="avatar-preview">
                <span id="avatar-initials"></span>
              </div>
              <div class="avatar-upload-content">
                <div class="avatar-actions">
                  <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                  <button type="button" id="upload-avatar-btn" class="auth-btn auth-btn-secondary">
                    Upload Photo
                  </button>
                  <button type="button" id="remove-avatar-btn" class="auth-btn auth-btn-secondary hidden">
                    Remove
                  </button>
                </div>
                <p class="avatar-hint">Square image recommended, max 5MB</p>
              </div>
            </div>

            <form id="profile-form">
              <div class="form-group">
                <label for="account-fullname">Full Name</label>
                <input
                  type="text"
                  id="account-fullname"
                  placeholder="Your name"
                />
              </div>

              <button type="submit" id="update-profile-btn" class="auth-btn auth-btn-primary">
                Update Profile
              </button>
            </form>
          </div>

          <!-- Security Section -->
          <div class="account-section">
            <h3 class="account-section-title">Security</h3>

            <button id="reset-password-btn" class="auth-btn auth-btn-secondary">
              Send Password Reset Email
            </button>
            <p class="form-hint" style="margin-top: 8px;">
              You'll receive an email with instructions to reset your password
            </p>
          </div>

          <!-- Danger Zone -->
          <div class="account-section account-danger-zone">
            <h3 class="account-section-title">Danger Zone</h3>

            <button id="delete-account-btn" class="auth-btn auth-btn-danger">
              Delete Account
            </button>
            <p class="form-hint" style="margin-top: 8px;">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
          </div>
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

    // Profile form
    const profileForm = this.modal?.querySelector('#profile-form') as HTMLFormElement;
    profileForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpdateProfile();
    });

    // Reset password button
    const resetPasswordBtn = this.modal?.querySelector('#reset-password-btn');
    resetPasswordBtn?.addEventListener('click', () => this.handleResetPassword());

    // Delete account button
    const deleteAccountBtn = this.modal?.querySelector('#delete-account-btn');
    deleteAccountBtn?.addEventListener('click', () => this.handleDeleteAccount());

    // Avatar upload button
    const uploadAvatarBtn = this.modal?.querySelector('#upload-avatar-btn');
    const avatarInput = this.modal?.querySelector('#avatar-input') as HTMLInputElement;
    uploadAvatarBtn?.addEventListener('click', () => avatarInput?.click());
    avatarInput?.addEventListener('change', () => this.handleAvatarUpload());

    // Avatar remove button
    const removeAvatarBtn = this.modal?.querySelector('#remove-avatar-btn');
    removeAvatarBtn?.addEventListener('click', () => this.handleAvatarRemove());
  }

  /**
   * Show the modal
   */
  public show(): void {
    if (!this.modal) return;

    // Load current user data
    this.loadUserData();

    // Show modal
    this.modal.classList.remove('hidden');

    // Clear any previous messages
    this.hideError();
    this.hideSuccess();
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    this.modal?.classList.add('hidden');
  }

  /**
   * Load user data into the form
   */
  private loadUserData(): void {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      logger.error('No user found');
      return;
    }

    // Update email display
    const emailElement = this.modal?.querySelector('#account-email');
    if (emailElement) {
      emailElement.textContent = user.email;
    }

    // Update creation date
    const createdElement = this.modal?.querySelector('#account-created');
    if (createdElement && user.createdAt) {
      const date = new Date(user.createdAt);
      createdElement.textContent = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Update full name input
    const fullNameInput = this.modal?.querySelector('#account-fullname') as HTMLInputElement;
    if (fullNameInput) {
      fullNameInput.value = user.fullName || '';
    }

    // Update avatar preview
    this.updateAvatarPreview(user.avatarUrl, user.fullName, user.email);
  }

  /**
   * Update avatar preview display
   */
  private updateAvatarPreview(avatarUrl?: string, fullName?: string, email?: string): void {
    const avatarPreview = this.modal?.querySelector('#avatar-preview') as HTMLElement;
    const avatarInitials = this.modal?.querySelector('#avatar-initials') as HTMLElement;
    const removeBtn = this.modal?.querySelector('#remove-avatar-btn') as HTMLElement;

    if (!avatarPreview || !avatarInitials) return;

    if (avatarUrl) {
      // Show avatar image
      avatarPreview.innerHTML = `<img src="${avatarUrl}" alt="Profile avatar">`;
      removeBtn?.classList.remove('hidden');
    } else {
      // Show initials
      const initials = this.getInitials(fullName, email);
      avatarPreview.innerHTML = `<span id="avatar-initials">${initials}</span>`;
      removeBtn?.classList.add('hidden');
    }
  }

  /**
   * Get initials from name or email
   */
  private getInitials(fullName?: string, email?: string): string {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return '?';
  }

  /**
   * Handle profile update
   */
  private async handleUpdateProfile(): Promise<void> {
    const fullNameInput = this.modal?.querySelector('#account-fullname') as HTMLInputElement;
    const updateBtn = this.modal?.querySelector('#update-profile-btn') as HTMLButtonElement;

    if (!fullNameInput || !updateBtn) return;

    const fullName = fullNameInput.value.trim();

    // Disable button
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    this.hideError();
    this.hideSuccess();

    try {
      // Update profile directly in renderer (where auth session lives)
      const supabaseClient = RendererSupabaseClient.getInstance();
      const result = await supabaseClient.updateProfile(fullName);

      if (result.success) {
        this.showSuccess('Profile updated successfully');
        logger.info('Profile updated successfully');
      } else {
        this.showError(result.error || 'Failed to update profile');
        logger.error('Failed to update profile:', result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.showError(`Error updating profile: ${message}`);
      logger.error('Error updating profile:', error);
    } finally {
      // Re-enable button
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Profile';
    }
  }

  /**
   * Handle avatar upload
   */
  private async handleAvatarUpload(): Promise<void> {
    const avatarInput = this.modal?.querySelector('#avatar-input') as HTMLInputElement;
    const avatarPreview = this.modal?.querySelector('#avatar-preview') as HTMLElement;
    const uploadBtn = this.modal?.querySelector('#upload-avatar-btn') as HTMLButtonElement;

    if (!avatarInput?.files?.length) return;

    const file = avatarInput.files[0];

    // Validate file type
    if (!isSupportedImageType(file)) {
      this.showError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      avatarInput.value = '';
      return;
    }

    // Validate file size (max 5MB before compression)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      this.showError('Image is too large. Please select an image under 5MB.');
      avatarInput.value = '';
      return;
    }

    // Show loading state
    avatarPreview?.classList.add('avatar-uploading');
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
    }

    this.hideError();
    this.hideSuccess();

    try {
      // Compress the image
      logger.info('Compressing avatar image...');
      const compressed = await compressAvatarImage(file);
      logger.info(`Avatar compressed to ${compressed.size} bytes`);

      // Upload to Supabase
      logger.info('Uploading avatar to storage...');
      const supabaseClient = RendererSupabaseClient.getInstance();
      const result = await supabaseClient.uploadAvatar(compressed.blob, 'image/jpeg');

      if (result.success && result.avatarUrl) {
        this.showSuccess('Profile photo updated');
        logger.info('Avatar uploaded successfully');

        // Update preview
        const user = this.authManager.getCurrentUser();
        this.updateAvatarPreview(result.avatarUrl, user?.fullName, user?.email);

        // Refresh auth state to propagate change
        await this.authManager.checkAuthStatus();
      } else {
        this.showError(result.error || 'Failed to upload avatar');
        logger.error('Failed to upload avatar:', result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.showError(`Error uploading photo: ${message}`);
      logger.error('Error uploading avatar:', error);
    } finally {
      // Reset state
      avatarPreview?.classList.remove('avatar-uploading');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Photo';
      }
      avatarInput.value = '';
    }
  }

  /**
   * Handle avatar removal
   */
  private async handleAvatarRemove(): Promise<void> {
    const avatarPreview = this.modal?.querySelector('#avatar-preview') as HTMLElement;
    const removeBtn = this.modal?.querySelector('#remove-avatar-btn') as HTMLButtonElement;

    const confirmed = confirm('Remove your profile photo?');
    if (!confirmed) return;

    // Show loading state
    avatarPreview?.classList.add('avatar-uploading');
    if (removeBtn) {
      removeBtn.disabled = true;
      removeBtn.textContent = 'Removing...';
    }

    this.hideError();
    this.hideSuccess();

    try {
      const supabaseClient = RendererSupabaseClient.getInstance();
      const result = await supabaseClient.removeAvatar();

      if (result.success) {
        this.showSuccess('Profile photo removed');
        logger.info('Avatar removed successfully');

        // Update preview to show initials
        const user = this.authManager.getCurrentUser();
        this.updateAvatarPreview(undefined, user?.fullName, user?.email);

        // Refresh auth state to propagate change
        await this.authManager.checkAuthStatus();
      } else {
        this.showError(result.error || 'Failed to remove avatar');
        logger.error('Failed to remove avatar:', result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.showError(`Error removing photo: ${message}`);
      logger.error('Error removing avatar:', error);
    } finally {
      // Reset state
      avatarPreview?.classList.remove('avatar-uploading');
      if (removeBtn) {
        removeBtn.disabled = false;
        removeBtn.textContent = 'Remove';
      }
    }
  }

  /**
   * Handle password reset
   */
  private async handleResetPassword(): Promise<void> {
    const resetBtn = this.modal?.querySelector('#reset-password-btn') as HTMLButtonElement;
    if (!resetBtn) return;

    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.showError('No user found');
      return;
    }

    const confirmed = confirm(
      `Send a password reset email to ${user.email}?\n\n` +
      `You'll receive an email with a link to reset your password.`
    );

    if (!confirmed) return;

    // Disable button
    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';

    this.hideError();
    this.hideSuccess();

    try {
      // Send password reset email directly in renderer (where auth session lives)
      const supabaseClient = RendererSupabaseClient.getInstance();
      const result = await supabaseClient.resetPassword(user.email);

      if (result.success) {
        this.showSuccess(`Password reset email sent to ${user.email}`);
        logger.info('Password reset email sent');
      } else {
        this.showError(result.error || 'Failed to send password reset email');
        logger.error('Failed to send password reset email:', result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.showError(`Error sending reset email: ${message}`);
      logger.error('Error sending reset email:', error);
    } finally {
      // Re-enable button
      resetBtn.disabled = false;
      resetBtn.textContent = 'Send Password Reset Email';
    }
  }

  /**
   * Handle account deletion
   */
  private async handleDeleteAccount(): Promise<void> {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.showError('No user found');
      return;
    }

    // First confirmation
    const confirmed1 = confirm(
      `⚠️ WARNING: Delete Account?\n\n` +
      `This will permanently delete:\n` +
      `• Your account (${user.email})\n` +
      `• All your cloud sessions\n` +
      `• All your shared sessions\n\n` +
      `Local files will remain on your device.\n\n` +
      `This action CANNOT be undone.\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed1) return;

    // Second confirmation
    const confirmed2 = confirm(
      `⚠️ FINAL WARNING\n\n` +
      `Type your email address to confirm deletion:\n` +
      `${user.email}\n\n` +
      `Click OK to proceed with account deletion.`
    );

    if (!confirmed2) return;

    const deleteBtn = this.modal?.querySelector('#delete-account-btn') as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';
    }

    this.hideError();
    this.hideSuccess();

    try {
      // Delete account directly in renderer (where auth session lives)
      const supabaseClient = RendererSupabaseClient.getInstance();
      const result = await supabaseClient.deleteAccount();

      if (result.success) {
        // Show the message from the result if provided
        const message = result.message || 'Account deleted successfully. Signing you out...';
        this.showSuccess(message);
        logger.info('Account deletion initiated:', result.message);

        // User is already signed out by deleteAccount(), just hide the modal
        setTimeout(() => {
          this.hide();
        }, 3000);
      } else {
        this.showError(result.error || 'Failed to delete account');
        logger.error('Failed to delete account:', result.error);

        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Delete Account';
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.showError(`Error deleting account: ${message}`);
      logger.error('Error deleting account:', error);

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Account';
      }
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorElement = this.modal?.querySelector('#account-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    const errorElement = this.modal?.querySelector('#account-error');
    if (errorElement) {
      errorElement.classList.add('hidden');
      errorElement.textContent = '';
    }
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    const successElement = this.modal?.querySelector('#account-success');
    if (successElement) {
      successElement.textContent = message;
      successElement.classList.remove('hidden');
    }
  }

  /**
   * Hide success message
   */
  private hideSuccess(): void {
    const successElement = this.modal?.querySelector('#account-success');
    if (successElement) {
      successElement.classList.add('hidden');
      successElement.textContent = '';
    }
  }
}
