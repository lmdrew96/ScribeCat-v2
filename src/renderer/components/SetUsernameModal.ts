/**
 * SetUsernameModal
 *
 * Modal prompt for existing users to set their username
 * Cannot be dismissed - username is required
 */

import { getRandomCatFact } from '../utils/cat-facts.js';

export class SetUsernameModal {
  private modal: HTMLElement | null = null;
  private onComplete?: (username: string) => void;
  private usernameCheckTimeout: number | null = null;

  constructor() {
    this.createModal();
  }

  /**
   * Create the modal
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'set-username-modal';
    this.modal.className = 'auth-modal'; // Reuse auth modal styling

    this.modal.innerHTML = `
      <div class="auth-modal-content">
        <div class="auth-header">
          <img src="../../assets/nugget-logo.PNG" alt="ScribeCat Logo" class="auth-logo">
          <h2>Choose Your Username</h2>
          <p>Set a unique username to identify yourself in ScribeCat</p>
        </div>

        <div id="username-error" class="auth-error hidden"></div>
        <div id="username-success" class="auth-success hidden"></div>
        <div id="username-loading-cat-fact" class="auth-loading-cat-fact hidden"></div>

        <div class="auth-form">
          <form id="set-username-form" novalidate>
            <div class="form-group">
              <label for="username-input">Username</label>
              <input
                type="text"
                id="username-input"
                placeholder="username"
                required
                minlength="3"
                maxlength="20"
                pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}"
                autocomplete="off"
                autofocus
              />
              <small id="username-hint" class="form-hint">
                3-20 characters, alphanumeric, underscore, or hyphen
              </small>
              <small id="username-available" class="form-hint form-hint-success hidden">
                Username available
              </small>
              <small id="username-taken" class="form-hint form-hint-error hidden">
                Username is already taken
              </small>
            </div>

            <button type="submit" id="submit-username-btn" class="auth-btn auth-btn-primary">
              Set Username
            </button>
          </form>

          <div class="auth-footer">
            <p class="help-text">
              Your username will be visible to other users and cannot be changed later.
            </p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    const form = this.modal?.querySelector('#set-username-form') as HTMLFormElement;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    const usernameInput = this.modal?.querySelector('#username-input') as HTMLInputElement;
    const usernameHint = this.modal?.querySelector('#username-hint');
    const usernameAvailable = this.modal?.querySelector('#username-available');
    const usernameTaken = this.modal?.querySelector('#username-taken');

    usernameInput?.addEventListener('focus', () => {
      usernameHint?.classList.remove('hidden');
    });

    usernameInput?.addEventListener('input', () => {
      // Hide all feedback messages initially
      usernameAvailable?.classList.add('hidden');
      usernameTaken?.classList.add('hidden');

      const username = usernameInput?.value.trim();
      if (!username || username.length < 3) {
        return;
      }

      // Validate format first
      const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
      if (!usernameRegex.test(username)) {
        return;
      }

      // Debounced username availability check
      if (this.usernameCheckTimeout) {
        clearTimeout(this.usernameCheckTimeout);
      }

      this.usernameCheckTimeout = window.setTimeout(async () => {
        const available = await this.checkUsernameAvailability(username);
        if (available) {
          usernameAvailable?.classList.remove('hidden');
        } else {
          usernameTaken?.classList.remove('hidden');
        }
      }, 500);
    });
  }

  /**
   * Check username availability
   */
  private async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      // Use RendererSupabaseClient directly (auth session exists in renderer)
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const client = RendererSupabaseClient.getInstance().getClient();

      const { data: isAvailable, error } = await client.rpc('is_username_available', {
        check_username: username
      });

      if (error) {
        console.error('Username availability check error:', error);
        return false;
      }

      return isAvailable === true;
    } catch (error) {
      console.error('Failed to check username availability:', error);
      return false;
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    const usernameInput = this.modal?.querySelector('#username-input') as HTMLInputElement;
    const username = usernameInput?.value.trim();

    if (!username) {
      this.showError('Username is required');
      return;
    }

    // Validate format
    const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
    if (!usernameRegex.test(username)) {
      this.showError('Username must be 3-20 characters, start with alphanumeric, and contain only letters, numbers, underscores, or hyphens');
      return;
    }

    // Check availability
    this.showLoading('Checking availability...');
    const available = await this.checkUsernameAvailability(username);

    if (!available) {
      this.hideLoading();
      this.showError('Username is already taken. Please choose another.');
      return;
    }

    // Submit username
    this.showLoading('Setting username...');

    try {
      // Use RendererSupabaseClient directly (auth session exists in renderer)
      const { RendererSupabaseClient } = await import('../services/RendererSupabaseClient.js');
      const result = await RendererSupabaseClient.getInstance().setUsername(username);

      if (result.success) {
        this.showSuccess('Username set successfully!');
        setTimeout(() => {
          this.hide();
          this.onComplete?.(username);
        }, 1000);
      } else {
        this.hideLoading();
        this.showError(result.error || 'Failed to set username');
      }
    } catch (error) {
      this.hideLoading();
      this.showError(`Failed to set username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Show the modal
   */
  show(onComplete?: (username: string) => void): void {
    this.onComplete = onComplete;
    this.modal?.classList.remove('hidden');

    // Focus username input
    const usernameInput = this.modal?.querySelector('#username-input') as HTMLInputElement;
    usernameInput?.focus();

    this.clearForm();
    this.hideError();
    this.hideSuccess();
  }

  /**
   * Hide the modal
   */
  hide(): void {
    this.modal?.classList.add('hidden');
    this.clearForm();
    this.hideError();
    this.hideSuccess();
  }

  /**
   * Clear the form
   */
  private clearForm(): void {
    const usernameInput = this.modal?.querySelector('#username-input') as HTMLInputElement;
    if (usernameInput) usernameInput.value = '';

    // Hide all feedback messages
    this.modal?.querySelector('#username-available')?.classList.add('hidden');
    this.modal?.querySelector('#username-taken')?.classList.add('hidden');
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const errorDiv = this.modal?.querySelector('#username-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.remove('hidden');
    }
    this.hideSuccess();
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    const errorDiv = this.modal?.querySelector('#username-error');
    errorDiv?.classList.add('hidden');
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    const successDiv = this.modal?.querySelector('#username-success');
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.classList.remove('hidden');
    }
    this.hideError();
  }

  /**
   * Hide success message
   */
  private hideSuccess(): void {
    const successDiv = this.modal?.querySelector('#username-success');
    successDiv?.classList.add('hidden');
  }

  /**
   * Show loading state
   */
  private showLoading(message: string = 'Loading...'): void {
    const loadingDiv = this.modal?.querySelector('#username-loading-cat-fact');
    if (loadingDiv) {
      const catFact = getRandomCatFact();
      loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-message">${message}</p>
        <p class="cat-fact">${catFact}</p>
      `;
      loadingDiv.classList.remove('hidden');
    }
    this.hideError();
    this.hideSuccess();
  }

  /**
   * Hide loading state
   */
  private hideLoading(): void {
    const loadingDiv = this.modal?.querySelector('#username-loading-cat-fact');
    loadingDiv?.classList.add('hidden');
  }

  /**
   * Destroy the modal
   */
  destroy(): void {
    if (this.usernameCheckTimeout) {
      clearTimeout(this.usernameCheckTimeout);
    }
    this.modal?.remove();
    this.modal = null;
  }
}
