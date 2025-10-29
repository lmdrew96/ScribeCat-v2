import { app, BrowserWindow, ipcMain, Menu, session, systemPreferences } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { RecordingManager } from './recording-manager.js';
import { DirectoryManager } from '../infrastructure/setup/DirectoryManager.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { ListSessionsUseCase } from '../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../application/use-cases/DeleteSessionUseCase.js';
import { ExportSessionUseCase } from '../application/use-cases/ExportSessionUseCase.js';
import { TextExportService } from '../infrastructure/services/export/TextExportService.js';
import { DocxExportService } from '../infrastructure/services/export/DocxExportService.js';
import { PdfExportService } from '../infrastructure/services/export/PdfExportService.js';
import { HtmlExportService } from '../infrastructure/services/export/HtmlExportService.js';
import { SimulationTranscriptionService } from './services/transcription/SimulationTranscriptionService.js';
import { ClaudeAIService } from '../infrastructure/services/ai/ClaudeAIService.js';
import { GoogleDriveService } from '../infrastructure/services/drive/GoogleDriveService.js';
import type { GoogleDriveConfig } from '../shared/types.js';
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
  private recordingManager: RecordingManager;
  private directoryManager: DirectoryManager;
  private store: Store<StoreSchema>;
  
  // Repositories
  private sessionRepository: FileSessionRepository;
  private audioRepository: FileAudioRepository;
  
  // Use Cases
  private listSessionsUseCase: ListSessionsUseCase;
  private deleteSessionUseCase: DeleteSessionUseCase;
  private exportSessionUseCase: ExportSessionUseCase;
  
  // Transcription services
  private simulationTranscriptionService: SimulationTranscriptionService;
  
  // AI service
  private aiService: ClaudeAIService | null = null;
  
  // Google Drive service
  private googleDriveService: GoogleDriveService | null = null;

  constructor() {
    // Initialize directory manager
    this.directoryManager = new DirectoryManager();
    
    // Initialize electron-store for settings
    this.store = new Store<StoreSchema>({
      defaults: {
        'simulation-mode': true // Default to simulation mode
      }
    });
    
    // Initialize Google Drive service with pre-configured credentials
    this.initializeGoogleDrive();
    
    // Initialize repositories
    this.sessionRepository = new FileSessionRepository();
    this.audioRepository = new FileAudioRepository();
    
    // Initialize export services
    const exportServices = new Map();
    exportServices.set('txt', new TextExportService());
    exportServices.set('docx', new DocxExportService());
    exportServices.set('pdf', new PdfExportService());
    exportServices.set('html', new HtmlExportService());
    
    // Initialize use cases
    this.listSessionsUseCase = new ListSessionsUseCase(this.sessionRepository);
    this.deleteSessionUseCase = new DeleteSessionUseCase(
      this.sessionRepository,
      this.audioRepository
    );
    this.exportSessionUseCase = new ExportSessionUseCase(
      this.sessionRepository,
      exportServices
    );
    
    // Initialize simulation transcription service
    this.simulationTranscriptionService = new SimulationTranscriptionService();
    
    this.recordingManager = new RecordingManager();
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

  private initializeApp(): void {
    app.whenReady().then(async () => {
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
    });

    // Set the main window reference for the recording manager
    this.recordingManager.setMainWindow(this.mainWindow);
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
      this.exportSessionUseCase
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
  }
}

new ScribeCatApp();
