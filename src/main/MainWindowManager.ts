/**
 * MainWindowManager
 *
 * Manages the main BrowserWindow and related window lifecycle operations
 *
 * Responsibilities:
 * - Create and configure main window
 * - Handle hot reload in development mode
 * - Request and manage system permissions (microphone, media)
 * - Window lifecycle event handling
 */

import { app, BrowserWindow, session, systemPreferences } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { watch } from 'fs';
import type { SyncManager } from '../infrastructure/services/sync/SyncManager.js';
import type { RecordingManager } from './recording-manager.js';
import type { OAuthWindowManager } from './OAuthWindowManager.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MainWindowManager {
  private mainWindow: BrowserWindow | null = null;

  /**
   * Create and configure the main application window
   */
  createWindow(
    syncManager: SyncManager | null,
    recordingManager: RecordingManager,
    oauthManager: OAuthWindowManager | null
  ): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: path.join(__dirname, '../../assets/nugget-logo.PNG'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js'),
        backgroundThrottling: false // Prevent MediaRecorder throttling when window loses focus
      },
      titleBarStyle: 'hiddenInset',
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();

      // Trigger initial sync after window is shown (with small delay to not block UI)
      if (syncManager) {
        setTimeout(async () => {
          console.log('Performing initial sync from cloud...');
          const result = await syncManager.syncAllFromCloud();
          if (result.success) {
            console.log(`✓ Initial sync complete: ${result.count} sessions downloaded`);
          } else {
            console.warn(`✗ Initial sync failed: ${result.error}`);
          }
        }, 2000); // Wait 2 seconds after app launch
      }
    });

    // Set the main window reference for the recording manager
    recordingManager.setMainWindow(this.mainWindow);

    // Set the main window reference for the OAuth manager
    if (oauthManager) {
      oauthManager.setMainWindow(this.mainWindow);
    }

    // Enable hot reload in development
    if (!app.isPackaged) {
      this.setupHotReload();
    }

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   */
  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Setup hot reload for development
   * Watches dist/ directory and reloads/restarts on changes
   */
  private setupHotReload(): void {
    console.log('🔥 Hot reload will activate in 10 seconds...');

    // Wait 10 seconds before enabling watchers
    // This prevents reload during initial TypeScript watch compilation
    setTimeout(() => {
      console.log('🔥 Hot reload enabled');

      let reloadTimeout: NodeJS.Timeout | null = null;
      let notifyTimeout: NodeJS.Timeout | null = null;

      // Helper to check if file should trigger reload (ignore declaration, map, and HTML files)
      const shouldTriggerReload = (filename: string): boolean => {
        return !filename.endsWith('.d.ts') &&
               !filename.endsWith('.js.map') &&
               !filename.endsWith('.d.ts.map') &&
               !filename.endsWith('.html'); // Ignore HTML files to prevent reload loops
      };

      // Watch renderer files - reload window on change
      watch(path.join(__dirname, '../renderer'), { recursive: true }, (eventType, filename) => {
        if (filename && shouldTriggerReload(filename)) {
          // Debounce rapid file changes
          if (reloadTimeout) clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(() => {
            // Check if window exists and is not destroyed
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              console.log(`🔄 Renderer file changed: ${filename} - Reloading window...`);
              this.mainWindow.reload();
            }
          }, 100);
        }
      });

      // Watch main and preload files - send notification instead of restarting
      const watchMainAndPreload = (dir: string, label: string) => {
        watch(path.join(__dirname, dir), { recursive: true }, (eventType, filename) => {
          if (filename && shouldTriggerReload(filename)) {
            // Debounce rapid file changes
            if (notifyTimeout) clearTimeout(notifyTimeout);
            notifyTimeout = setTimeout(() => {
              if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                console.log(`⚠️ ${label} file changed: ${filename} - Manual restart required`);
                this.mainWindow.webContents.send(
                  'dev:hot-reload-notification',
                  `${label} changed - Please restart (Ctrl+C then npm run dev)`
                );
              }
            }, 100);
          }
        });
      };

      watchMainAndPreload('.', 'Main process');
      watchMainAndPreload('../preload', 'Preload');
    }, 10000);
  }

  /**
   * Request microphone access on macOS
   *
   * On macOS, we need to explicitly request system-level microphone permission.
   * This ensures the OS knows ScribeCat (not VS Code) is requesting access.
   */
  async requestMicrophoneAccess(): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        console.log('Microphone access status:', micStatus);

        if (micStatus !== 'granted') {
          console.log('Requesting microphone access...');
          await systemPreferences.askForMediaAccess('microphone');
        }
      } catch (error) {
        console.error('Failed to request microphone access:', error);
      }
    }
  }

  /**
   * Set up media permission handler for the renderer process
   *
   * This allows the renderer process to access the microphone via getUserMedia.
   * Without this, the browser's media API won't have permission to capture audio.
   */
  setupMediaPermissions(): void {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Grant permission for media devices (microphone/camera)
      if (permission === 'media') {
        console.log('Granting media permission to renderer process');
        callback(true);
      } else {
        // Deny all other permissions by default
        callback(false);
      }
    });
  }
}
