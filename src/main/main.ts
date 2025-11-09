// Load environment variables FIRST before any other imports
import './env-loader.js';

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { SharingHandlers } from './ipc/handlers/SharingHandlers.js';
import { OAuthWindowManager } from './OAuthWindowManager.js';
import { ServiceBootstrapper, type Services } from './ServiceBootstrapper.js';
import { MainWindowManager } from './MainWindowManager.js';
import { IPCCoordinator } from './IPCCoordinator.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define store schema
interface StoreSchema {
  'google-drive-credentials'?: string;
}

class ScribeCatApp {
  private mainWindow: BrowserWindow | null = null;
  private store: Store<StoreSchema>;
  private bootstrapper: ServiceBootstrapper;
  private services!: Services;
  private windowManager: MainWindowManager;
  private ipcCoordinator!: IPCCoordinator;

  // OAuth window manager
  private oauthManager: OAuthWindowManager | null = null;

  // Real-time sharing handlers (permission-based access control)
  private sharingHandlers: SharingHandlers | null = null;

  constructor() {
    // Initialize electron-store for settings (doesn't need app to be ready)
    this.store = new Store<StoreSchema>({
      projectName: 'scribecat-v2',
      defaults: {}
    });

    // Initialize service bootstrapper and early services
    this.bootstrapper = new ServiceBootstrapper(this.store);
    this.bootstrapper.initializeEarlyServices();

    // Initialize window manager
    this.windowManager = new MainWindowManager();

    // Initialize real-time sharing handlers
    this.sharingHandlers = new SharingHandlers();

    // Initialize OAuth window manager
    this.oauthManager = new OAuthWindowManager();

    this.initializeApp();
  }

  private initializeApp(): void {
    // Enable WebAuthn/FIDO support before app is ready
    app.commandLine.appendSwitch('enable-features', 'WebAuthenticationGetAssertionFeature,WebAuthenticationTouchId');

    // Enable experimental web platform features
    app.commandLine.appendSwitch('enable-experimental-web-platform-features');

    app.whenReady().then(async () => {
      // Initialize all services using the bootstrapper
      this.services = await this.bootstrapper.initializeServices();

      // Request microphone access and set up permissions
      await this.windowManager.requestMicrophoneAccess();
      this.windowManager.setupMediaPermissions();

      // Create main window
      this.mainWindow = this.windowManager.createWindow(
        this.services.syncManager,
        this.services.recordingManager,
        this.oauthManager
      );

      // Set up IPC handlers
      this.ipcCoordinator = new IPCCoordinator({
        services: this.services,
        store: this.store,
        getMainWindow: () => this.mainWindow
      });
      this.ipcCoordinator.setupHandlers(this.sharingHandlers);

      this.setupSecurity();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Clean up OAuth resources on quit
    app.on('quit', () => {
      if (this.oauthManager) {
        this.oauthManager.cleanup();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.mainWindow = this.windowManager.createWindow(
          this.services.syncManager,
          this.services.recordingManager,
          this.oauthManager
        );
      }
    });
  }

  private setupSecurity(): void {
    // Security is now handled by CSP meta tag in index.html
    // This method can be used for additional security measures in the future
  }
}

new ScribeCatApp();
