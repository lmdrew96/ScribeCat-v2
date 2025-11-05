import { app, BrowserWindow, ipcMain, session, systemPreferences } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as http from 'http';
import * as fs from 'fs';
import { RecordingManager } from './recording-manager.js';
import { DirectoryManager } from '../infrastructure/setup/DirectoryManager.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { ListSessionsUseCase } from '../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../application/use-cases/ExportSessionUseCase.js';
import { UpdateSessionUseCase } from '../application/use-cases/UpdateSessionUseCase.js';
import { TextExportService } from '../infrastructure/services/export/TextExportService.js';
import { DocxExportService } from '../infrastructure/services/export/DocxExportService.js';
import { PdfExportService } from '../infrastructure/services/export/PdfExportService.js';
import { HtmlExportService } from '../infrastructure/services/export/HtmlExportService.js';
import { SimulationTranscriptionService } from './services/transcription/SimulationTranscriptionService.js';
import { ClaudeAIService } from '../infrastructure/services/ai/ClaudeAIService.js';
import { GoogleDriveService } from '../infrastructure/services/drive/GoogleDriveService.js';
import type { GoogleDriveConfig, SupabaseConfig } from '../shared/types.js';
import Store from 'electron-store';
import { HandlerRegistry } from './ipc/HandlerRegistry.js';
import { SessionHandlers } from './ipc/handlers/SessionHandlers.js';
import { AudioHandlers } from './ipc/handlers/AudioHandlers.js';
import { TranscriptionHandlers } from './ipc/handlers/TranscriptionHandlers.js';
import { AIHandlers } from './ipc/handlers/AIHandlers.js';
import { DriveHandlers } from './ipc/handlers/DriveHandlers.js';
import { SettingsHandlers } from './ipc/handlers/SettingsHandlers.js';
import { DialogHandlers } from './ipc/handlers/DialogHandlers.js';
import { CanvasHandlers } from './ipc/handlers/CanvasHandlers.js';
import { ShareHandlers } from './ipc/handlers/ShareHandlers.js';
import { SharingHandlers } from './ipc/handlers/SharingHandlers.js';
import { SupabaseStorageService } from '../infrastructure/services/supabase/SupabaseStorageService.js';
import { SupabaseSessionRepository } from '../infrastructure/repositories/SupabaseSessionRepository.js';
import { SupabaseShareRepository } from '../infrastructure/repositories/SupabaseShareRepository.js';
import { SupabaseClient } from '../infrastructure/services/supabase/SupabaseClient.js';
import { SyncManager } from '../infrastructure/services/sync/SyncManager.js';
import { DeletedSessionsTracker } from '../infrastructure/services/DeletedSessionsTracker.js';
import {
  ShareSessionUseCase,
  RemoveShareUseCase,
  UpdateSharePermissionUseCase,
  GetSessionSharesUseCase,
  GetSharedSessionsUseCase,
  AcceptShareInvitationUseCase
} from '../application/use-cases/sharing/index.js';
import { watch } from 'fs';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define store schema
interface StoreSchema {
  'simulation-mode': boolean;
  'google-drive-credentials'?: string;
}

class ScribeCatApp {
  private mainWindow: BrowserWindow | null = null;
  private recordingManager!: RecordingManager;
  private directoryManager!: DirectoryManager;
  private store: Store<StoreSchema>;

  // Repositories
  private sessionRepository!: FileSessionRepository;
  private audioRepository!: FileAudioRepository;

  // Use Cases
  private listSessionsUseCase!: ListSessionsUseCase;
  private deleteSessionUseCase!: DeleteSessionUseCase;
  private exportSessionUseCase!: ExportSessionUseCase;
  private updateSessionUseCase!: UpdateSessionUseCase;

  // Export services
  private exportServices!: Map<string, any>;

  // Transcription services
  private simulationTranscriptionService!: SimulationTranscriptionService;

  // AI service
  private aiService: ClaudeAIService | null = null;

  // Google Drive service
  private googleDriveService: GoogleDriveService | null = null;

  // Supabase cloud sync services
  // NOTE: Auth happens in renderer process where localStorage exists
  private supabaseClient: SupabaseClient | null = null;
  private supabaseStorageService: SupabaseStorageService | null = null;
  private supabaseSessionRepository: SupabaseSessionRepository | null = null;
  private supabaseShareRepository: SupabaseShareRepository | null = null;
  private syncManager: SyncManager | null = null;
  private deletedSessionsTracker!: DeletedSessionsTracker;

  // Sharing use cases
  private shareSessionUseCase!: ShareSessionUseCase;
  private removeShareUseCase!: RemoveShareUseCase;
  private updateSharePermissionUseCase!: UpdateSharePermissionUseCase;
  private getSessionSharesUseCase!: GetSessionSharesUseCase;
  private getSharedSessionsUseCase!: GetSharedSessionsUseCase;
  private acceptShareInvitationUseCase!: AcceptShareInvitationUseCase;

  // OAuth callback server
  private oauthCallbackServer: http.Server | null = null;

  // Real-time sharing handlers (permission-based access control)
  private sharingHandlers: SharingHandlers | null = null;

  constructor() {
    // Initialize electron-store for settings (doesn't need app to be ready)
    this.store = new Store<StoreSchema>({
      projectName: 'scribecat-v2',
      defaults: {
        'simulation-mode': true // Default to simulation mode
      }
    });

    // Initialize Google Drive service with pre-configured credentials
    this.initializeGoogleDrive();

    // Initialize Supabase auth service
    this.initializeSupabase();

    // Initialize real-time sharing handlers
    this.sharingHandlers = new SharingHandlers();

    // Start OAuth callback server
    this.startOAuthCallbackServer();

    this.initializeApp();
  }

  /**
   * Initialize Google Drive service with stored credentials
   */
  private initializeGoogleDrive(): void {
    try {
      // Load stored credentials if they exist
      const storedCreds = (this.store as any).get('google-drive-credentials');
      const config: GoogleDriveConfig = storedCreds ? JSON.parse(storedCreds) : {};

      // Initialize service (it will work with or without stored credentials)
      this.googleDriveService = new GoogleDriveService(config);

      console.log('Google Drive service initialized');
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      // Initialize with empty config as fallback
      this.googleDriveService = new GoogleDriveService();
    }
  }

  /**
   * Initialize Supabase auth service with production configuration
   */
  private initializeSupabase(): void {
    try {
      // NOTE: SupabaseAuthService is NOT initialized in main process
      // Auth happens in renderer process where localStorage exists
      // Renderer will send auth state updates via IPC

      // Initialize Supabase client (session will be set from renderer)
      this.supabaseClient = SupabaseClient.getInstance();

      // Initialize storage service for cloud uploads
      this.supabaseStorageService = new SupabaseStorageService();

      // Initialize session repository for cloud session storage
      this.supabaseSessionRepository = new SupabaseSessionRepository();

      // Initialize share repository for session sharing
      this.supabaseShareRepository = new SupabaseShareRepository();

      console.log('Supabase cloud services initialized (auth handled in renderer)');
    } catch (error) {
      console.error('Failed to initialize Supabase services:', error);
      throw error; // Re-throw since this is critical for the app
    }
  }

  /**
   * Start OAuth callback server for Google OAuth flow
   */
  private startOAuthCallbackServer(): void {
    try {
      const callbackHtmlPath = path.join(__dirname, '..', '..', 'oauth-callback.html');

      this.oauthCallbackServer = http.createServer((req, res) => {
        // Only handle /auth/callback requests
        if (req.url && req.url.startsWith('/auth/callback')) {
          // Read and serve the callback HTML file
          fs.readFile(callbackHtmlPath, 'utf8', (err, data) => {
            if (err) {
              console.error('Error reading OAuth callback file:', err);
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.oauthCallbackServer.listen(3000, () => {
        console.log('OAuth callback server listening on http://localhost:3000');
      });

      // Handle server errors
      this.oauthCallbackServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn('Port 3000 is already in use. OAuth callback server not started.');
          console.warn('Make sure no other application is using port 3000.');
        } else {
          console.error('OAuth callback server error:', err);
        }
      });
    } catch (error) {
      console.error('Failed to start OAuth callback server:', error);
      // Don't throw - OAuth can still work manually
    }
  }

  private initializeApp(): void {
    app.whenReady().then(async () => {
      // Initialize components that need app to be ready
      this.directoryManager = new DirectoryManager();
      this.sessionRepository = new FileSessionRepository();
      this.audioRepository = new FileAudioRepository();

      // Initialize export services
      this.exportServices = new Map();
      this.exportServices.set('txt', new TextExportService());
      this.exportServices.set('docx', new DocxExportService());
      this.exportServices.set('pdf', new PdfExportService());
      this.exportServices.set('html', new HtmlExportService());

      // Initialize DeletedSessionsTracker
      this.deletedSessionsTracker = new DeletedSessionsTracker();
      await this.deletedSessionsTracker.initialize();

      // Initialize use cases
      this.listSessionsUseCase = new ListSessionsUseCase(this.sessionRepository);
      this.deleteSessionUseCase = new DeleteSessionUseCase(
        this.sessionRepository,
        this.audioRepository,
        this.supabaseSessionRepository || undefined, // Pass remote repository for cloud deletion
        this.deletedSessionsTracker // Pass deleted tracker
      );
      this.exportSessionUseCase = new ExportSessionUseCase(
        this.sessionRepository,
        this.exportServices
      );
      this.updateSessionUseCase = new UpdateSessionUseCase(this.sessionRepository);

      // Initialize SyncManager for cloud sync (user ID will be set when renderer sends auth state)
      if (this.supabaseStorageService && this.supabaseSessionRepository) {
        this.syncManager = new SyncManager(
          this.sessionRepository,           // local repository
          this.supabaseSessionRepository,   // remote repository
          this.supabaseStorageService,      // storage service
          null,                             // no user ID yet - set when renderer sends auth state
          this.deletedSessionsTracker       // deleted sessions tracker
        );
        console.log('SyncManager initialized (waiting for user auth from renderer)');
      }

      // Initialize sharing use cases
      if (this.supabaseShareRepository) {
        this.shareSessionUseCase = new ShareSessionUseCase(this.supabaseShareRepository);
        this.removeShareUseCase = new RemoveShareUseCase(this.supabaseShareRepository);
        this.updateSharePermissionUseCase = new UpdateSharePermissionUseCase(this.supabaseShareRepository);
        this.getSessionSharesUseCase = new GetSessionSharesUseCase(this.supabaseShareRepository);
        this.getSharedSessionsUseCase = new GetSharedSessionsUseCase(this.supabaseShareRepository);
        this.acceptShareInvitationUseCase = new AcceptShareInvitationUseCase(this.supabaseShareRepository);
        console.log('Sharing use cases initialized');
      }

      // Initialize simulation transcription service
      this.simulationTranscriptionService = new SimulationTranscriptionService();

      // Initialize recording manager with auto-sync callback
      this.recordingManager = new RecordingManager(async (sessionId: string) => {
        // Auto-sync after recording completes (if user is authenticated)
        if (this.syncManager) {
          const session = await this.sessionRepository.findById(sessionId);
          if (session) {
            console.log(`Auto-syncing session ${sessionId} after recording...`);
            const result = await this.syncManager.uploadSession(session);
            if (result.success) {
              console.log(`✓ Session ${sessionId} auto-synced successfully`);
            } else {
              console.warn(`✗ Auto-sync failed: ${result.error}`);
            }
          }
        }
      });

      // Initialize directory structure
      try {
        await this.directoryManager.initialize();
        console.log('Directory structure initialized');
      } catch (error) {
        console.error('Failed to initialize directories:', error);
      }

      // Request microphone access on macOS
      await this.requestMicrophoneAccess();

      // Set up media permission handler
      this.setupMediaPermissions();

      this.createWindow();
      this.setupSecurity();
      this.setupIPC();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Clean up OAuth callback server on quit
    app.on('quit', () => {
      if (this.oauthCallbackServer) {
        this.oauthCallbackServer.close();
        console.log('OAuth callback server closed');
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js')
      },
      titleBarStyle: 'hiddenInset',
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();

      // Trigger initial sync after window is shown (with small delay to not block UI)
      if (this.syncManager) {
        const syncManager = this.syncManager; // Capture for async callback
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
    this.recordingManager.setMainWindow(this.mainWindow);

    // Enable hot reload in development
    if (!app.isPackaged) {
      this.setupHotReload();
    }
  }

  /**
   * Setup hot reload for development
   * Watches dist/ directory and reloads/restarts on changes
   */
  private setupHotReload(): void {
    console.log('🔥 Hot reload will activate in 5 seconds...');

    // Wait 5 seconds before enabling watchers
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
    }, 5000);
  }

  /**
   * Request microphone access on macOS
   * 
   * On macOS, we need to explicitly request system-level microphone permission.
   * This ensures the OS knows ScribeCat (not VS Code) is requesting access.
   */
  private async requestMicrophoneAccess(): Promise<void> {
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
  private setupMediaPermissions(): void {
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

  private setupSecurity(): void {
    // Security is now handled by CSP meta tag in index.html
    // This method can be used for additional security measures in the future
  }

  /**
   * Set up IPC handlers using modular handler classes
   */
  private setupIPC(): void {
    // Create handler registry
    const registry = new HandlerRegistry();
    
    // Register all modular handlers
    registry.add(new SessionHandlers(
      this.listSessionsUseCase,
      this.deleteSessionUseCase,
      this.exportSessionUseCase,
      this.updateSessionUseCase
    ));
    
    registry.add(new AudioHandlers());
    
    registry.add(new TranscriptionHandlers(
      this.simulationTranscriptionService,
      () => this.mainWindow
    ));
    
    registry.add(new AIHandlers(
      () => this.aiService,
      () => this.mainWindow
    ));
    
    registry.add(new DriveHandlers(
      () => this.googleDriveService,
      this.store
    ));
    
    registry.add(new SettingsHandlers(this.store));
    
    registry.add(new DialogHandlers(() => this.mainWindow));

    registry.add(new CanvasHandlers());

    // Add sharing handlers if Supabase is configured
    if (this.shareSessionUseCase) {
      registry.add(new ShareHandlers(
        this.shareSessionUseCase,
        this.removeShareUseCase,
        this.updateSharePermissionUseCase,
        this.getSessionSharesUseCase,
        this.getSharedSessionsUseCase,
        this.acceptShareInvitationUseCase
      ));
    }

    // Register all handlers with ipcMain
    registry.registerAll(ipcMain);
    
    // Special handlers that need direct access to modify class properties
    // These cannot be in handler classes because they need to set this.aiService and this.googleDriveService
    
    ipcMain.handle('ai:setApiKey', async (event, apiKey: string) => {
      try {
        if (!apiKey || apiKey.trim().length === 0) {
          this.aiService = null;
          return { success: true };
        }
        
        this.aiService = new ClaudeAIService({ apiKey });
        return { success: true };
      } catch (error) {
        console.error('Failed to set AI API key:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    ipcMain.handle('drive:configure', async (event, config: GoogleDriveConfig) => {
      try {
        this.googleDriveService = new GoogleDriveService(config);
        return { success: true };
      } catch (error) {
        console.error('Failed to configure Google Drive:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Auth state handler - receives user session from renderer when auth state changes
    ipcMain.handle('auth:sessionChanged', async (event, data: { userId: string | null; accessToken?: string; refreshToken?: string }) => {
      try {
        console.log('Received auth state change from renderer:', data.userId ? `User ID: ${data.userId}` : 'No user');

        // Update local repository (FileSessionRepository) to filter by user ID
        if ('setUserId' in this.sessionRepository) {
          (this.sessionRepository as any).setUserId(data.userId);
          console.log('Updated FileSessionRepository with user ID');
        }

        // Update SyncManager with user ID (which also updates SupabaseSessionRepository)
        if (this.syncManager) {
          this.syncManager.setCurrentUserId(data.userId);
          console.log('Updated SyncManager with user ID');
        }

        // Update SharingHandlers with user ID
        if (this.sharingHandlers) {
          this.sharingHandlers.setCurrentUserId(data.userId);
          console.log('Updated SharingHandlers with user ID');
        }

        // Set session on SupabaseClient for authenticated requests
        if (data.userId && data.accessToken && data.refreshToken && this.supabaseClient) {
          await this.supabaseClient.setSession(data.accessToken, data.refreshToken);
          console.log('Set Supabase session in main process');
        } else if (!data.userId && this.supabaseClient) {
          await this.supabaseClient.clearSession();
          console.log('Cleared Supabase session in main process');
        }

        return { success: true };
      } catch (error) {
        console.error('Failed to handle auth state change:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Sync handlers
    ipcMain.handle('sync:uploadSession', async (event, sessionId: string) => {
      try {
        if (!this.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        // Find the session
        const session = await this.sessionRepository.findById(sessionId);
        if (!session) {
          return { success: false, error: 'Session not found' };
        }

        // Upload it
        const result = await this.syncManager.uploadSession(session);
        return result;
      } catch (error) {
        console.error('Failed to upload session:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('sync:getStatus', async (event, sessionId: string) => {
      try {
        if (!this.syncManager) {
          return { status: 'not_synced' };
        }

        const status = this.syncManager.getSyncStatus(sessionId);
        return { status };
      } catch (error) {
        console.error('Failed to get sync status:', error);
        return { status: 'not_synced' };
      }
    });

    ipcMain.handle('sync:retrySync', async (event, sessionId: string) => {
      try {
        if (!this.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        const result = await this.syncManager.retrySync(sessionId);
        return result;
      } catch (error) {
        console.error('Failed to retry sync:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('sync:syncAllFromCloud', async () => {
      try {
        if (!this.syncManager) {
          return { success: false, error: 'Sync not initialized' };
        }

        const result = await this.syncManager.syncAllFromCloud();
        return result;
      } catch (error) {
        console.error('Failed to sync from cloud:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}

new ScribeCatApp();
