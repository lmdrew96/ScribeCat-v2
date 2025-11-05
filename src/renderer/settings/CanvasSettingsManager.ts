/**
 * CanvasSettingsManager
 *
 * Manages Canvas LMS integration settings including
 * connection, course imports, and extension help.
 */

import { NotificationToast } from '../components/shared/NotificationToast.js';
import { ModalDialog } from '../components/shared/ModalDialog.js';

export class CanvasSettingsManager {
  private canvasUrl: string = '';
  private canvasToken: string = '';
  private canvasConfigured: boolean = false;

  /**
   * Initialize Canvas settings
   */
  public async initialize(): Promise<void> {
    await this.checkConnection();
    this.updateUI();
    this.attachEventListeners();
  }

  /**
   * Attach event listeners for Canvas-related buttons
   */
  private attachEventListeners(): void {
    // Canvas URL input
    const canvasUrlInput = document.getElementById('canvas-url') as HTMLInputElement;
    canvasUrlInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.canvasUrl = target.value.trim();
    });

    // Canvas token input
    const canvasTokenInput = document.getElementById('canvas-token') as HTMLInputElement;
    canvasTokenInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.canvasToken = target.value.trim();
    });

    // Test connection button
    const testCanvasBtn = document.getElementById('test-canvas-btn');
    testCanvasBtn?.addEventListener('click', () => this.testConnection());

    // Disconnect button
    const disconnectCanvasBtn = document.getElementById('disconnect-canvas-btn');
    disconnectCanvasBtn?.addEventListener('click', () => this.disconnect());

    // Import courses button
    const importCoursesBtn = document.getElementById('import-canvas-courses-btn');
    importCoursesBtn?.addEventListener('click', () => this.importCourses());

    // Extension help link
    const extensionHelpLink = document.getElementById('extension-help-link');
    extensionHelpLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showExtensionHelp();
    });
  }

  /**
   * Check Canvas connection status
   */
  public async checkConnection(): Promise<void> {
    try {
      const result = await window.scribeCat.canvas.isConfigured();
      this.canvasConfigured = result.data?.configured || false;

      if (this.canvasConfigured) {
        // Get Canvas config to populate URL field
        const configResult = await window.scribeCat.canvas.getConfig();
        if (configResult.success && configResult.data) {
          this.canvasUrl = configResult.data.baseUrl || '';
          // Don't populate token for security
        }
      }
    } catch (error) {
      console.error('Failed to check Canvas connection:', error);
      this.canvasConfigured = false;
    }
  }

  /**
   * Test Canvas connection
   */
  private async testConnection(): Promise<void> {
    try {
      if (!this.canvasUrl || !this.canvasToken) {
        NotificationToast.error('Please enter Canvas URL and API token');
        return;
      }

      // Configure Canvas with the provided credentials
      const configResult = await window.scribeCat.canvas.configure({
        baseUrl: this.canvasUrl,
        apiToken: this.canvasToken
      });

      if (!configResult.success) {
        throw new Error(configResult.error || 'Failed to configure Canvas');
      }

      this.canvasConfigured = true;
      this.updateUI();
      NotificationToast.success('Canvas connected successfully!');

    } catch (error) {
      console.error('Canvas connection failed:', error);
      NotificationToast.error(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disconnect from Canvas
   */
  private async disconnect(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to disconnect Canvas?');
      if (!confirmed) return;

      await window.scribeCat.canvas.disconnect();

      this.canvasConfigured = false;
      this.canvasUrl = '';
      this.canvasToken = '';

      // Clear input fields
      const urlInput = document.getElementById('canvas-url') as HTMLInputElement;
      const tokenInput = document.getElementById('canvas-token') as HTMLInputElement;
      if (urlInput) urlInput.value = '';
      if (tokenInput) tokenInput.value = '';

      this.updateUI();
      NotificationToast.success('Canvas disconnected');

    } catch (error) {
      console.error('Failed to disconnect Canvas:', error);
      NotificationToast.error('Failed to disconnect');
    }
  }

  /**
   * Update Canvas connection UI
   */
  public updateUI(): void {
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

      // Populate URL field
      if (urlInput && this.canvasUrl) {
        urlInput.value = this.canvasUrl;
      }
    } else {
      statusEl.textContent = 'Not configured';
      statusEl.style.color = '#95a5a6';
      testBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
    }

    // Load and display imported courses
    this.loadImportedCourses();
  }

  /**
   * Import Canvas courses from JSON
   */
  private async importCourses(): Promise<void> {
    try {
      const jsonTextarea = document.getElementById('canvas-import-json') as HTMLTextAreaElement;
      if (!jsonTextarea) return;

      const jsonData = jsonTextarea.value.trim();
      if (!jsonData) {
        NotificationToast.error('Please paste JSON data from the browser extension');
        return;
      }

      // Import courses via IPC
      const result = await window.scribeCat.canvas.importCourses(jsonData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to import courses');
      }

      // Clear textarea
      jsonTextarea.value = '';

      // Reload imported courses list
      await this.loadImportedCourses();

      // Trigger course manager refresh if it exists
      if (window.courseManager) {
        await window.courseManager.refresh();
      }

      NotificationToast.success(
        `Successfully imported ${result.data?.imported || 0} courses`
      );

    } catch (error) {
      console.error('Failed to import courses:', error);
      NotificationToast.error(
        `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

      // Build courses list HTML
      listEl.innerHTML = courses.map((course: any) => `
        <div class="course-item" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          margin-bottom: 8px;
          background: #1e1e1e;
          border-radius: 4px;
          border: 1px solid #444;
        ">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">
              ${course.code || course.courseNumber || 'Unknown Code'}
            </div>
            <div style="font-size: 12px; color: #999;">
              ${course.title || course.courseTitle || 'Untitled Course'}
            </div>
          </div>
          <button
            class="delete-course-btn"
            data-course-id="${course.id}"
            style="
              padding: 6px 12px;
              background: #e74c3c;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            "
            title="Delete course"
          >
            Delete
          </button>
        </div>
      `).join('');

      // Add delete button listeners
      listEl.querySelectorAll('.delete-course-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const courseId = (e.target as HTMLElement).getAttribute('data-course-id');
          if (courseId) {
            await this.deleteImportedCourse(courseId);
          }
        });
      });

    } catch (error) {
      console.error('Failed to load imported courses:', error);
    }
  }

  /**
   * Delete an imported course
   */
  private async deleteImportedCourse(courseId: string): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to delete this course?');
      if (!confirmed) return;

      await window.scribeCat.canvas.deleteImportedCourse(courseId);
      await this.loadImportedCourses();
      NotificationToast.success('Course deleted');

    } catch (error) {
      console.error('Failed to delete course:', error);
      NotificationToast.error('Failed to delete course');
    }
  }

  /**
   * Show extension help information
   */
  private showExtensionHelp(): void {
    const helpContent = this.getExtensionHelpHTML();

    const modal = new ModalDialog({
      title: 'Browser Extension Setup & Usage',
      content: helpContent,
      buttons: [
        {
          text: 'Got it!',
          type: 'primary',
          onClick: () => {}
        }
      ]
    });

    modal.show();
  }

  /**
   * Get extension help HTML content
   */
  private getExtensionHelpHTML(): string {
    return `
      <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">

        <!-- Installation Section -->
        <h4 style="color: #3498db; margin-top: 20px;">📦 Installation</h4>
        <div style="margin-bottom: 20px;">
          <strong style="color: #fff;">For Chrome/Edge:</strong>
          <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
            <li>Locate the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder in ScribeCat</li>
            <li>Open Chrome and navigate to <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">chrome://extensions/</code></li>
            <li>Enable <strong>"Developer mode"</strong> (toggle in top-right corner)</li>
            <li>Click <strong>"Load unpacked"</strong> button</li>
            <li>Select the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>The extension icon will appear in your toolbar! 🎉</li>
          </ol>

          <strong style="color: #fff;">For Firefox:</strong>
          <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
            <li>Locate the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder in ScribeCat</li>
            <li>Open Firefox and navigate to <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">about:debugging</code></li>
            <li>Click <strong>"This Firefox"</strong> in the sidebar</li>
            <li>Click <strong>"Load Temporary Add-on"</strong></li>
            <li>Navigate to the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>Select <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">manifest.json</code> file</li>
          </ol>
          <p style="margin: 10px 0; padding: 10px; background: #2c3e50; border-radius: 4px; font-size: 13px;">
            <strong>💡 Tip:</strong> In Firefox, the extension loads temporarily and will be removed when you close the browser.
            You'll need to reload it each time you restart Firefox.
          </p>
        </div>

        <!-- Usage Section -->
        <h4 style="color: #27ae60; margin-top: 20px;">🚀 Using the Extension</h4>
        <ol style="text-align: left; padding-left: 20px; margin: 10px 0; line-height: 1.6;">
          <li>Navigate to your <strong>Canvas dashboard</strong> (main page after login)</li>
          <li>Click the <strong>ScribeCat extension icon</strong> in your browser toolbar</li>
          <li>Click <strong>"Collect Courses"</strong> button in the popup</li>
          <li>Review the detected courses</li>
          <li>Click <strong>"Copy for ScribeCat"</strong> to copy the JSON data</li>
          <li>Return to <strong>ScribeCat Settings</strong> (this window)</li>
          <li>Paste the JSON into the textarea above</li>
          <li>Click <strong>"Import Courses"</strong></li>
        </ol>

        <!-- Why Section -->
        <h4 style="color: #f39c12; margin-top: 20px;">❓ Why Use the Extension?</h4>
        <p style="margin: 10px 0; line-height: 1.6;">
          Some universities (like <strong>University of Delaware</strong>) block Canvas API access for security reasons.
          The browser extension works around this by reading course information directly from your Canvas dashboard HTML -
          no API access needed! This means it works at <em>any</em> university, regardless of their API policies.
        </p>

        <!-- Troubleshooting Section -->
        <h4 style="color: #e74c3c; margin-top: 20px;">🔧 Troubleshooting</h4>
        <div style="text-align: left; margin: 10px 0; line-height: 1.6;">
          <strong style="color: #fff;">No courses detected?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Ensure you're on the Canvas <strong>dashboard</strong> (main page with course cards)</li>
            <li>Try <strong>refreshing</strong> the Canvas page and collecting again</li>
            <li>Verify you're <strong>logged into Canvas</strong></li>
            <li>Check that courses are visible on the dashboard</li>
          </ul>

          <strong style="color: #fff; display: block; margin-top: 10px;">Extension not appearing in toolbar?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Check that <strong>Developer mode</strong> is enabled (Chrome)</li>
            <li>Try <strong>reloading the extension</strong> in browser settings</li>
            <li>Ensure you selected the correct <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension</code> folder</li>
            <li>Look for the extension in the extensions menu (puzzle piece icon)</li>
          </ul>

          <strong style="color: #fff; display: block; margin-top: 10px;">Import failed in ScribeCat?</strong>
          <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Ensure you copied the <strong>complete JSON</strong> (no truncation)</li>
            <li>Use <strong>"Copy for ScribeCat"</strong> button, not raw export</li>
            <li>Check for any error messages in the notification</li>
            <li>Try collecting courses again if data seems corrupted</li>
          </ul>
        </div>

        <!-- Additional Help -->
        <div style="margin-top: 20px; padding: 15px; background: #34495e; border-radius: 4px; border-left: 4px solid #3498db;">
          <strong style="color: #fff;">Need More Help?</strong>
          <p style="margin: 5px 0; font-size: 13px;">
            Check the <code style="background: #1e1e1e; padding: 2px 6px; border-radius: 3px;">browser-extension/README.md</code>
            file for detailed documentation, or open an issue on GitHub if you encounter problems.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Get configuration status
   */
  public isConfigured(): boolean {
    return this.canvasConfigured;
  }

  /**
   * Get Canvas URL
   */
  public getCanvasUrl(): string {
    return this.canvasUrl;
  }
}
