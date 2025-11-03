/**
 * IntegrationSettingsManager
 *
 * Manages Google Drive and Canvas integration settings.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('IntegrationSettingsManager');

export class IntegrationSettingsManager {
  private driveConnected: boolean = false;
  private driveUserEmail: string = '';
  private canvasUrl: string = '';
  private canvasToken: string = '';
  private canvasConfigured: boolean = false;

  /**
   * Load integration settings
   */
  async loadSettings(): Promise<void> {
    try {
      // Check Google Drive connection status
      await this.checkDriveConnection();

      // Check Canvas connection status
      await this.checkCanvasConnection();

      logger.info('Integration settings loaded');
    } catch (error) {
      logger.error('Failed to load integration settings', error);
    }
  }

  /**
   * Update UI with current settings
   */
  updateUI(): void {
    this.updateDriveConnectionUI();
    this.updateCanvasConnectionUI();
  }

  // ===== Google Drive Methods =====

  /**
   * Check Google Drive connection status
   */
  private async checkDriveConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      this.driveConnected = result.data || false;

      if (this.driveConnected) {
        // Try to get user email
        const emailResult = await window.scribeCat.drive.getUserEmail();
        this.driveUserEmail = emailResult.data || '';
      }
    } catch (error) {
      logger.error('Failed to check Drive connection', error);
      this.driveConnected = false;
      this.driveUserEmail = '';
    }
  }

  /**
   * Update Google Drive connection UI
   */
  private updateDriveConnectionUI(): void {
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
   * Show a custom input dialog
   */
  private showInputDialog(title: string, message: string): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #2c2c2c; border-radius: 8px; padding: 24px;
        max-width: 500px; width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      `;

      dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">${title}</h3>
        <p style="margin: 0 0 16px 0; color: #ccc; font-size: 14px;">${message}</p>
        <input type="text" id="custom-input-field" style="
          width: 100%; padding: 10px; border: 1px solid #555;
          border-radius: 4px; background: #1e1e1e; color: #fff;
          font-size: 14px; box-sizing: border-box; margin-bottom: 16px;
        " placeholder="Paste authorization code here">
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="custom-input-cancel" style="
            padding: 8px 16px; border: none; border-radius: 4px;
            background: #555; color: #fff; cursor: pointer; font-size: 14px;
          ">Cancel</button>
          <button id="custom-input-ok" style="
            padding: 8px 16px; border: none; border-radius: 4px;
            background: #27ae60; color: #fff; cursor: pointer; font-size: 14px;
          ">OK</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const inputField = document.getElementById('custom-input-field') as HTMLInputElement;
      const cancelBtn = document.getElementById('custom-input-cancel');
      const okBtn = document.getElementById('custom-input-ok');

      setTimeout(() => inputField?.focus(), 100);

      const handleCancel = () => {
        document.body.removeChild(overlay);
        resolve(null);
      };

      const handleOk = () => {
        const value = inputField?.value.trim() || '';
        document.body.removeChild(overlay);
        resolve(value || null);
      };

      cancelBtn?.addEventListener('click', handleCancel);
      okBtn?.addEventListener('click', handleOk);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleCancel();
      });
      inputField?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleOk();
        if (e.key === 'Escape') handleCancel();
      });
    });
  }

  /**
   * Connect to Google Drive
   */
  async connectGoogleDrive(): Promise<{ success: boolean; message: string }> {
    try {
      // Get auth URL
      const result = await window.scribeCat.drive.getAuthUrl();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get auth URL');
      }

      const authUrl = result.data.authUrl || result.data;

      // Open auth URL in browser
      window.open(authUrl, '_blank');

      // Show custom input dialog
      const code = await this.showInputDialog(
        'Google Drive Authorization',
        'Please sign in with Google in the browser, then paste the authorization code here:'
      );

      if (!code) {
        return { success: false, message: 'Connection cancelled' };
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
      this.updateDriveConnectionUI();

      logger.info('Google Drive connected successfully');
      return { success: true, message: 'Google Drive connected successfully!' };
    } catch (error) {
      logger.error('Google Drive connection failed', error);
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Disconnect from Google Drive
   */
  async disconnectGoogleDrive(): Promise<{ success: boolean; message: string }> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Google Drive?');
      if (!confirmed) {
        return { success: false, message: 'Cancelled' };
      }

      await window.scribeCat.drive.disconnect();

      this.driveConnected = false;
      this.driveUserEmail = '';
      this.updateDriveConnectionUI();

      logger.info('Google Drive disconnected');
      return { success: true, message: 'Google Drive disconnected' };
    } catch (error) {
      logger.error('Failed to disconnect Google Drive', error);
      return { success: false, message: 'Failed to disconnect' };
    }
  }

  // ===== Canvas Methods =====

  /**
   * Check Canvas connection status
   */
  private async checkCanvasConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.canvas.isConfigured();
      this.canvasConfigured = result.data?.configured || false;

      if (this.canvasConfigured) {
        const configResult = await window.scribeCat.canvas.getConfig();
        if (configResult.success && configResult.data) {
          this.canvasUrl = configResult.data.baseUrl || '';
        }
      }
    } catch (error) {
      logger.error('Failed to check Canvas connection', error);
      this.canvasConfigured = false;
    }
  }

  /**
   * Update Canvas connection UI
   */
  private updateCanvasConnectionUI(): void {
    const statusEl = document.getElementById('canvas-status');
    const testBtn = document.getElementById('test-canvas-btn') as HTMLButtonElement;
    const disconnectBtn = document.getElementById('disconnect-canvas-btn') as HTMLButtonElement;
    const urlInput = document.getElementById('canvas-url') as HTMLInputElement;

    if (!statusEl || !testBtn || !disconnectBtn) return;

    if (this.canvasConfigured) {
      statusEl.textContent = `Connected to ${this.canvasUrl}`;
      statusEl.style.color = '#27ae60';
      testBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';

      if (urlInput && this.canvasUrl) {
        urlInput.value = this.canvasUrl;
      }
    } else {
      statusEl.textContent = 'Not configured';
      statusEl.style.color = '#95a5a6';
      testBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
    }

    this.loadImportedCourses();
  }

  /**
   * Test Canvas connection
   */
  async testCanvasConnection(url: string, token: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!url || !token) {
        return { success: false, message: 'Please enter Canvas URL and API token' };
      }

      this.canvasUrl = url;
      this.canvasToken = token;

      const configResult = await window.scribeCat.canvas.configure({
        baseUrl: this.canvasUrl,
        apiToken: this.canvasToken
      });

      if (!configResult.success) {
        throw new Error(configResult.error || 'Failed to configure Canvas');
      }

      this.canvasConfigured = true;
      this.updateCanvasConnectionUI();

      logger.info('Canvas connected successfully');
      return { success: true, message: 'Canvas connected successfully!' };
    } catch (error) {
      logger.error('Canvas connection failed', error);
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Disconnect from Canvas
   */
  async disconnectCanvas(): Promise<{ success: boolean; message: string }> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Canvas?');
      if (!confirmed) {
        return { success: false, message: 'Cancelled' };
      }

      await window.scribeCat.canvas.disconnect();

      this.canvasConfigured = false;
      this.canvasUrl = '';
      this.canvasToken = '';

      const urlInput = document.getElementById('canvas-url') as HTMLInputElement;
      const tokenInput = document.getElementById('canvas-token') as HTMLInputElement;
      if (urlInput) urlInput.value = '';
      if (tokenInput) tokenInput.value = '';

      this.updateCanvasConnectionUI();

      logger.info('Canvas disconnected');
      return { success: true, message: 'Canvas disconnected' };
    } catch (error) {
      logger.error('Failed to disconnect Canvas', error);
      return { success: false, message: 'Failed to disconnect' };
    }
  }

  /**
   * Import Canvas courses from JSON
   */
  async importCanvasCourses(jsonData: string): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      if (!jsonData) {
        return { success: false, message: 'Please paste JSON data from the browser extension' };
      }

      const result = await window.scribeCat.canvas.importCourses(jsonData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to import courses');
      }

      await this.loadImportedCourses();

      if (window.courseManager) {
        await window.courseManager.refresh();
      }

      logger.info(`Successfully imported ${result.data?.count ?? 0} courses`);
      return {
        success: true,
        message: `Successfully imported ${result.data?.count ?? 0} course(s)!`,
        count: result.data?.count
      };
    } catch (error) {
      logger.error('Failed to import courses', error);
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Load and display imported courses
   */
  private async loadImportedCourses(): Promise<void> {
    try {
      const result = await window.scribeCat.canvas.getImportedCourses();
      const courses = result.data || [];

      const container = document.getElementById('imported-courses-container');
      const countEl = document.getElementById('imported-courses-count');
      const listEl = document.getElementById('imported-courses-list');

      if (!container || !countEl || !listEl) return;

      if (courses.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      countEl.textContent = courses.length.toString();

      listEl.innerHTML = courses.map((course: any) => `
        <div class="course-item" style="
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px; margin-bottom: 8px; background: #1e1e1e;
          border-radius: 4px; border: 1px solid #444;
        ">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">
              ${course.code || course.courseNumber || 'Unknown Code'}
            </div>
            <div style="font-size: 12px; color: #999;">
              ${course.title || course.courseTitle || 'Untitled Course'}
            </div>
          </div>
          <button class="delete-course-btn" data-course-id="${course.id}" style="
            padding: 6px 12px; background: #e74c3c; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
          " title="Delete course">Delete</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.delete-course-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const courseId = (e.target as HTMLElement).getAttribute('data-course-id');
          if (courseId) {
            await this.deleteImportedCourse(courseId);
          }
        });
      });
    } catch (error) {
      logger.error('Failed to load imported courses', error);
    }
  }

  /**
   * Delete an imported course
   */
  async deleteImportedCourse(courseId: string): Promise<{ success: boolean; message: string }> {
    try {
      const confirmed = confirm('Are you sure you want to delete this course?');
      if (!confirmed) {
        return { success: false, message: 'Cancelled' };
      }

      await window.scribeCat.canvas.deleteImportedCourse(courseId);
      await this.loadImportedCourses();

      logger.info('Course deleted');
      return { success: true, message: 'Course deleted' };
    } catch (error) {
      logger.error('Failed to delete course', error);
      return { success: false, message: 'Failed to delete course' };
    }
  }

  /**
   * Set Canvas URL (for UI binding)
   */
  setCanvasUrl(url: string): void {
    this.canvasUrl = url.trim();
  }

  /**
   * Set Canvas token (for UI binding)
   */
  setCanvasToken(token: string): void {
    this.canvasToken = token.trim();
  }

  /**
   * Get Canvas URL
   */
  getCanvasUrl(): string {
    return this.canvasUrl;
  }

  /**
   * Get Canvas token
   */
  getCanvasToken(): string {
    return this.canvasToken;
  }
}
