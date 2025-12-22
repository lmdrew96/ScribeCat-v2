/**
 * AuthScreen
 *
 * Modal screen for user authentication (sign in / sign up).
 */

import { AuthManager } from '../managers/AuthManager.js';
import { getRandomCatFact } from '../utils/cat-facts.js';

export class AuthScreen {
  private authManager: AuthManager;
  private modal: HTMLElement | null = null;
  private isSignUpMode: boolean = false;
  private onAuthSuccess?: () => void;
  private readonly originalFormSectionHTML: string;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.originalFormSectionHTML = this.getOriginalFormHTML();
    this.createModal();
  }
  /** Get the original form section HTML */
  private getOriginalFormHTML(): string {
    return `
      <!-- Google Sign In Button -->
      <button id="google-signin-btn" class="auth-btn auth-btn-google">
        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
        Continue with Google
      </button>

      <div class="auth-divider">
        <span>or</span>
      </div>

      <!-- Email/Password Form -->
      <form id="auth-form" novalidate>
        <div class="form-group">
          <label for="auth-email">Email</label>
          <input
            type="email"
            id="auth-email"
            placeholder="your@email.com"
            required
          />
        </div>

        <div id="username-field" class="form-group hidden">
          <label for="auth-username">Username</label>
          <input
            type="text"
            id="auth-username"
            placeholder="username"
            minlength="3"
            maxlength="20"
            pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}"
          />
          <small id="username-hint" class="form-hint hidden">
            3-20 characters, alphanumeric, underscore, or hyphen
          </small>
          <small id="username-available" class="form-hint form-hint-success hidden">
            Username available
          </small>
          <small id="username-taken" class="form-hint form-hint-error hidden">
            Username is already taken
          </small>
        </div>

        <div id="name-field" class="form-group hidden">
          <label for="auth-name">Full Name (Optional)</label>
          <input
            type="text"
            id="auth-name"
            placeholder="Your name"
          />
        </div>

        <div class="form-group">
          <label for="auth-password">Password</label>
          <input
            type="password"
            id="auth-password"
            placeholder="••••••••"
            required
            minlength="8"
          />
          <small id="password-hint" class="form-hint hidden">
            Password must be at least 8 characters
          </small>
        </div>

        <button type="submit" id="submit-btn" class="auth-btn auth-btn-primary">
          Sign In
        </button>
      </form>

      <div class="auth-toggle">
        <span id="toggle-text">Don't have an account?</span>
        <button id="toggle-mode-btn" class="auth-link">Sign Up</button>
      </div>
    `;
  }
  /** Create the authentication modal */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'auth-modal';
    this.modal.className = 'auth-modal hidden';

    this.modal.innerHTML = `
      <div class="auth-modal-content">
        <button class="auth-close-btn" title="Close">×</button>

        <div class="auth-header">
          <img src="../../assets/nugget-logo.PNG" alt="ScribeCat Logo" class="auth-logo">
          <h2 id="auth-title">Sign In to ScribeCat</h2>
          <p id="auth-subtitle">Access cloud features and share your notes</p>
        </div>

        <div id="auth-error" class="auth-error hidden"></div>
        <div id="auth-success" class="auth-success hidden"></div>
        <div id="auth-loading-cat-fact" class="auth-loading-cat-fact hidden"></div>

        <div class="auth-form">
          <!-- Sign In / Sign Up Form -->
          <div id="auth-form-section" class="auth-section">
            ${this.originalFormSectionHTML}
          </div>

          <!-- Continue Offline Option -->
          <div class="auth-footer">
            <button id="continue-offline-btn" class="auth-link-secondary">
              Continue without signing in
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.setupEventListeners();
  }
  /** Reset the form section to its original state */
  private resetFormSection(): void {
    const formSection = this.modal?.querySelector('#auth-form-section');
    if (!formSection) return;

    formSection.innerHTML = this.originalFormSectionHTML;

    this.attachFormEventListeners();

    this.isSignUpMode = false;
  }
  /** Attach event listeners specifically for the form section elements */
  private attachFormEventListeners(): void {
    const googleBtn = this.modal?.querySelector('#google-signin-btn');
    googleBtn?.addEventListener('click', () => this.handleGoogleSignIn());

    const form = this.modal?.querySelector('#auth-form') as HTMLFormElement;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    const toggleBtn = this.modal?.querySelector('#toggle-mode-btn');
    toggleBtn?.addEventListener('click', () => this.toggleMode());

    const passwordInput = this.modal?.querySelector('#auth-password');
    const passwordHint = this.modal?.querySelector('#password-hint');
    passwordInput?.addEventListener('focus', () => {
      if (this.isSignUpMode) {
        passwordHint?.classList.remove('hidden');
      }
    });

    // Username validation
    const usernameInput = this.modal?.querySelector('#auth-username') as HTMLInputElement;
    const usernameHint = this.modal?.querySelector('#username-hint');
    const usernameAvailable = this.modal?.querySelector('#username-available');
    const usernameTaken = this.modal?.querySelector('#username-taken');

    let usernameCheckTimeout: number | null = null;

    usernameInput?.addEventListener('focus', () => {
      if (this.isSignUpMode) {
        usernameHint?.classList.remove('hidden');
      }
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
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }

      usernameCheckTimeout = window.setTimeout(async () => {
        const available = await this.checkUsernameAvailability(username);
        if (available) {
          usernameAvailable?.classList.remove('hidden');
        } else {
          usernameTaken?.classList.remove('hidden');
        }
      }, 500);
    });
  }
  /** Set up event listeners */
  private setupEventListeners(): void {
    const closeBtn = this.modal?.querySelector('.auth-close-btn');
    closeBtn?.addEventListener('click', () => this.hide());

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    const offlineBtn = this.modal?.querySelector('#continue-offline-btn');
    offlineBtn?.addEventListener('click', () => this.hide());

    this.attachFormEventListeners();
  }
  
  private oauthInProgress = false;
  
  /** Handle Google sign in */
  private async handleGoogleSignIn(): Promise<void> {
    // Prevent duplicate OAuth attempts
    if (this.oauthInProgress) {
      console.log('OAuth already in progress, ignoring duplicate request');
      return;
    }
    this.oauthInProgress = true;
    
    this.showLoading('Opening Google Sign In...');

    // when flowType is 'pkce' in the RendererSupabaseClient configuration
    const result = await this.authManager.signInWithGoogle();

    if (result.success && result.authUrl) {
      const projectRef = 'djlvwxmakxaffdqbuwkv';
      const storageKey = `sb-${projectRef}-auth-token-code-verifier`;
      const codeVerifier = localStorage.getItem(storageKey);
      console.log('🔍 PKCE Code Verifier in localStorage:', codeVerifier ? '✓ Found' : '✗ Not found');
      if (codeVerifier) {
        console.log('🔍 Verifier length:', codeVerifier.length);
      }

      // Set up listeners BEFORE opening the browser to avoid race conditions
      // Listen for the OAuth code to be received automatically from the callback server
      window.scribeCat.auth.onOAuthCodeReceived(async (code: string) => {
        console.log('✓ OAuth code received automatically from callback server');

        this.showLoading('Completing sign in...');

        const sessionResult = await this.authManager.handleOAuthCallback(code);

        this.hideLoading();
        this.oauthInProgress = false;

        if (sessionResult.success) {
          this.showSuccess('Signed in successfully!');
          setTimeout(() => {
            this.hide();
            this.onAuthSuccess?.();
          }, 1500);
        } else {
          this.showError(sessionResult.error || 'Failed to complete sign in');
        }

        window.scribeCat.auth.removeOAuthListeners();
      });

      // Listen for OAuth errors
      window.scribeCat.auth.onOAuthCancelled(() => {
        console.log('OAuth flow cancelled');
        this.hideLoading();
        this.oauthInProgress = false;
        this.showError('Sign in was cancelled');
        window.scribeCat.auth.removeOAuthListeners();
      });

      // Open browser for Google OAuth - the callback server will automatically
      // extract the code and send it back via IPC
      await window.scribeCat.shell.openExternal(result.authUrl);

      // Show waiting message while user completes OAuth in browser
      this.showLoading('Waiting for Google sign in...');
    } else {
      this.hideLoading();
      this.oauthInProgress = false;;
      this.showError(result.error || 'Failed to initiate Google sign in');
    }
  }
  /** Show OAuth instructions */
  private showOAuthInstructions(): void {
    const formSection = this.modal?.querySelector('#auth-form-section');
    if (!formSection) return;

    formSection.innerHTML = `
      <div class="oauth-instructions">
        <h3>Complete Sign In</h3>
        <p>Your browser has opened for Google sign-in. ✨ <strong>Passkeys work there!</strong></p>
        <p>After signing in, your authorization code will be automatically copied.</p>
        <p style="font-size: 14px; color: #718096; margin-top: 8px;">Just paste it below (Cmd+V) and click Complete Sign In.</p>

        <div class="form-group">
          <label for="oauth-code">Authorization Code</label>
          <input
            type="text"
            id="oauth-code"
            placeholder="Paste your authorization code here (Cmd+V)"
            autofocus
          />
        </div>

        <button id="submit-oauth-code-btn" class="auth-btn auth-btn-primary">
          Complete Sign In
        </button>

        <button id="cancel-oauth-btn" class="auth-link-secondary">
          Cancel
        </button>
      </div>
    `;

    const submitBtn = this.modal?.querySelector('#submit-oauth-code-btn');
    submitBtn?.addEventListener('click', () => this.handleOAuthCallback());

    const cancelBtn = this.modal?.querySelector('#cancel-oauth-btn');
    cancelBtn?.addEventListener('click', () => {
      this.resetFormSection(); // Reset to original form
      this.hideError();
      this.hideSuccess();
    });
  }
  /**
   * Handle OAuth callback
   * Code verifier is retrieved from localStorage by RendererSupabaseClient
   */
  private async handleOAuthCallback(): Promise<void> {
    const codeInput = this.modal?.querySelector('#oauth-code') as HTMLInputElement;
    const code = codeInput?.value.trim();

    if (!code) {
      this.showError('Please enter the authorization code');
      return;
    }

    this.showLoading('Completing sign in...');

    const result = await this.authManager.handleOAuthCallback(code);

    this.hideLoading();

    if (result.success) {
      this.showSuccess('Signed in successfully!');
      setTimeout(() => {
        this.hide();
        this.onAuthSuccess?.();
      }, 1500);
    } else {
      this.showError(result.error || 'Failed to complete sign in');
    }
  }
  /** Handle form submission */
  private async handleFormSubmit(): Promise<void> {
    const emailInput = this.modal?.querySelector('#auth-email') as HTMLInputElement;
    const passwordInput = this.modal?.querySelector('#auth-password') as HTMLInputElement;
    const usernameInput = this.modal?.querySelector('#auth-username') as HTMLInputElement;
    const nameInput = this.modal?.querySelector('#auth-name') as HTMLInputElement;

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const username = usernameInput?.value.trim();
    const name = nameInput?.value.trim();

    if (!email || !password) {
      this.showError('Please fill in all required fields');
      return;
    }

    if (this.isSignUpMode) {
      if (!username) {
        this.showError('Username is required');
        return;
      }

      if (password.length < 8) {
        this.showError('Password must be at least 8 characters');
        return;
      }

      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
      if (!usernameRegex.test(username)) {
        this.showError('Username must be 3-20 characters, start with alphanumeric, and contain only letters, numbers, underscores, or hyphens');
        return;
      }
    }

    this.showLoading(this.isSignUpMode ? 'Creating account...' : 'Signing in...');

    let result;
    if (this.isSignUpMode) {
      result = await this.authManager.signUpWithEmail(email, password, username, name);
    } else {
      result = await this.authManager.signInWithEmail(email, password);
    }

    this.hideLoading();

    if (result.success) {
      this.showSuccess(
        this.isSignUpMode ? 'Account created successfully!' : 'Signed in successfully!'
      );
      setTimeout(() => {
        this.hide();
        this.onAuthSuccess?.();
      }, 1500);
    } else {
      this.showError(result.error || 'Authentication failed');
    }
  }
  /** Toggle between sign in and sign up modes */
  private toggleMode(): void {
    this.isSignUpMode = !this.isSignUpMode;

    const title = this.modal?.querySelector('#auth-title');
    const subtitle = this.modal?.querySelector('#auth-subtitle');
    const usernameField = this.modal?.querySelector('#username-field');
    const nameField = this.modal?.querySelector('#name-field');
    const submitBtn = this.modal?.querySelector('#submit-btn');
    const toggleText = this.modal?.querySelector('#toggle-text');
    const toggleModeBtn = this.modal?.querySelector('#toggle-mode-btn');

    if (this.isSignUpMode) {
      if (title) title.textContent = 'Create Account';
      if (subtitle) subtitle.textContent = 'Join ScribeCat and sync your notes';
      usernameField?.classList.remove('hidden');
      nameField?.classList.remove('hidden');
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleText) toggleText.textContent = 'Already have an account?';
      if (toggleModeBtn) toggleModeBtn.textContent = 'Sign In';
    } else {
      if (title) title.textContent = 'Sign In to ScribeCat';
      if (subtitle) subtitle.textContent = 'Access cloud features and share your notes';
      usernameField?.classList.add('hidden');
      nameField?.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleText) toggleText.textContent = "Don't have an account?";
      if (toggleModeBtn) toggleModeBtn.textContent = 'Sign Up';
    }

    this.clearForm();
    this.hideError();
    this.hideSuccess();
  }
  /** Show the authentication modal */
  show(onSuccess?: () => void): void {
    this.onAuthSuccess = onSuccess;

    this.resetFormSection();

    this.modal?.classList.remove('hidden');
    this.clearForm();
    this.hideError();
    this.hideSuccess();
  }
  /** Hide the authentication modal */
  hide(): void {
    this.modal?.classList.add('hidden');
    this.clearForm();
    this.hideError();
    this.hideSuccess();
  }
  /** Clear the form */
  private clearForm(): void {
    const emailInput = this.modal?.querySelector('#auth-email') as HTMLInputElement;
    const passwordInput = this.modal?.querySelector('#auth-password') as HTMLInputElement;
    const usernameInput = this.modal?.querySelector('#auth-username') as HTMLInputElement;
    const nameInput = this.modal?.querySelector('#auth-name') as HTMLInputElement;

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (usernameInput) usernameInput.value = '';
    if (nameInput) nameInput.value = '';

    // Hide all username feedback messages
    this.modal?.querySelector('#username-available')?.classList.add('hidden');
    this.modal?.querySelector('#username-taken')?.classList.add('hidden');
  }

  /** Check username availability */
  private async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const result = await window.scribeCat.auth.checkUsernameAvailability(username);
      return result.available || false;
    } catch (error) {
      console.error('Failed to check username availability:', error);
      return false;
    }
  }
  /** Show error message */
  private showError(message: string): void {
    const errorDiv = this.modal?.querySelector('#auth-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.remove('hidden');
    }
    this.hideSuccess();
  }
  /** Hide error message */
  private hideError(): void {
    const errorDiv = this.modal?.querySelector('#auth-error');
    errorDiv?.classList.add('hidden');
  }
  /** Show success message */
  private showSuccess(message: string): void {
    const successDiv = this.modal?.querySelector('#auth-success');
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.classList.remove('hidden');
    }
    this.hideError();
  }
  /** Hide success message */
  private hideSuccess(): void {
    const successDiv = this.modal?.querySelector('#auth-success');
    successDiv?.classList.add('hidden');
  }
  /** Show loading state */
  private showLoading(message: string): void {
    const submitBtn = this.modal?.querySelector('#submit-btn') as HTMLButtonElement;
    const googleBtn = this.modal?.querySelector('#google-signin-btn') as HTMLButtonElement;
    const configureBtn = this.modal?.querySelector('#configure-btn') as HTMLButtonElement;
    const catFactDiv = this.modal?.querySelector('#auth-loading-cat-fact') as HTMLElement;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = message;
    }
    if (googleBtn) googleBtn.disabled = true;
    if (configureBtn) configureBtn.disabled = true;

    // Show a random cat fact during loading
    if (catFactDiv) {
      catFactDiv.textContent = getRandomCatFact();
      catFactDiv.classList.remove('hidden');
    }
  }
  /** Hide loading state */
  private hideLoading(): void {
    const submitBtn = this.modal?.querySelector('#submit-btn') as HTMLButtonElement;
    const googleBtn = this.modal?.querySelector('#google-signin-btn') as HTMLButtonElement;
    const configureBtn = this.modal?.querySelector('#configure-btn') as HTMLButtonElement;
    const catFactDiv = this.modal?.querySelector('#auth-loading-cat-fact') as HTMLElement;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = this.isSignUpMode ? 'Sign Up' : 'Sign In';
    }
    if (googleBtn) googleBtn.disabled = false;
    if (configureBtn) configureBtn.disabled = false;

    // Hide the cat fact
    if (catFactDiv) {
      catFactDiv.classList.add('hidden');
    }
  }

}
