/**
 * DriveSettingsManager
 *
 * Manages Google Drive integration settings including
 * authentication, connection status, and UI updates.
 */

import { NotificationToast } from '../components/shared/NotificationToast.js';
import { ModalDialog } from '../components/shared/ModalDialog.js';
import { AuthManager } from '../managers/AuthManager.js';

export class DriveSettingsManager {
  private driveConnected: boolean = false;
  private driveUserEmail: string = '';
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Initialize Drive settings
   */
  public async initialize(): Promise<void> {
    await this.checkConnection();
    this.updateUI();
    this.attachEventListeners();
    this.setupAutoReconnectListener();
    this.setupAuthStateListener();
  }

  /**
   * Attach event listeners for Drive-related buttons
   */
  private attachEventListeners(): void {
    const connectBtn = document.getElementById('connect-drive-btn');
    connectBtn?.addEventListener('click', () => this.connect());

    const disconnectBtn = document.getElementById('disconnect-drive-btn');
    disconnectBtn?.addEventListener('click', () => this.disconnect());
  }

  /**
   * Check Google Drive connection status
   */
  public async checkConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      this.driveConnected = result.data || false;

      if (this.driveConnected) {
        // Try to get user email
        const emailResult = await window.scribeCat.drive.getUserEmail();
        this.driveUserEmail = emailResult.data || '';
      }
    } catch (error) {
      console.error('Failed to check Drive connection:', error);
      this.driveConnected = false;
      this.driveUserEmail = '';
    }
  }

  /**
   * Update Google Drive connection UI
   */
  public updateUI(): void {
    const statusEl = document.getElementById('drive-status');
    const connectBtn = document.getElementById('connect-drive-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-drive-btn') as HTMLButtonElement;

    if (!statusEl || !connectBtn || !disconnectBtn) return;

    if (this.driveConnected) {
      statusEl.textContent = this.driveUserEmail
        ? `Connected as ${this.driveUserEmail}`
        : 'Connected';
      statusEl.style.color = '#27ae60';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
    } else {
      statusEl.textContent = 'Not connected';
      statusEl.style.color = '#95a5a6';
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
    }
  }

  /**
   * Connect to Google Drive
   */
  private async connect(): Promise<void> {
    try {
      // Get auth URL
      const result = await window.scribeCat.drive.getAuthUrl();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get auth URL');
      }

      const authUrl = result.data.authUrl || result.data;

      // Open auth URL in browser
      window.open(authUrl, '_blank');

      // Show prompt dialog for authorization code
      const code = await ModalDialog.prompt(
        'Google Drive Authorization',
        'Please sign in with Google in the browser, then paste the authorization code here:',
        'Paste authorization code here'
      );

      if (!code) {
        NotificationToast.error('Connection cancelled');
        return;
      }

      // Exchange authorization code for tokens
      const exchangeResult = await window.scribeCat.drive.exchangeCodeForTokens(code);
      if (!exchangeResult.success) {
        throw new Error(exchangeResult.error || 'Failed to authenticate');
      }

      // Store user email if available
      if (exchangeResult.email) {
        this.driveUserEmail = exchangeResult.email;
      }

      this.driveConnected = true;
      this.updateUI();
      NotificationToast.success('Google Drive connected successfully!');

    } catch (error) {
      console.error('Google Drive connection failed:', error);
      NotificationToast.error(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disconnect from Google Drive
   */
  private async disconnect(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Google Drive?');
      if (!confirmed) return;

      await window.scribeCat.drive.disconnect();

      this.driveConnected = false;
      this.driveUserEmail = '';
      this.updateUI();
      NotificationToast.success('Google Drive disconnected');

    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error);
      NotificationToast.error('Failed to disconnect');
    }
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this.driveConnected;
  }

  /**
   * Get connected user email
   */
  public getUserEmail(): string {
    return this.driveUserEmail;
  }

  /**
   * Set up listener for auto-reconnection from cloud
   */
  private setupAutoReconnectListener(): void {
    window.scribeCat.drive.onAutoReconnected(async () => {
      await this.checkConnection();
      this.updateUI();
      NotificationToast.success('Google Drive auto-reconnected!');
    });
  }

  /**
   * Set up listener for auth state changes (to detect logout)
   */
  private setupAuthStateListener(): void {
    this.authManager.onAuthStateChange(async (user) => {
      // When user logs out, refresh Drive connection status
      if (!user) {
        console.log('User logged out, refreshing Drive connection status');
        await this.checkConnection();
        this.updateUI();
      }
    });
  }
}
