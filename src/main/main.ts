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
import { SimulationTranscriptionService } from './services/transcription/SimulationTranscriptionService.js';
import { AssemblyAITranscriptionService } from './services/transcription/AssemblyAITranscriptionService.js';
import { TranscriptionResult } from './services/transcription/ITranscriptionService.js';
import Store from 'electron-store';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define store schema
interface StoreSchema {
  'simulation-mode': boolean;
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
  private activeAssemblyAIServices: Map<string, AssemblyAITranscriptionService>;

  constructor() {
    // Initialize directory manager
    this.directoryManager = new DirectoryManager();
    
    // Initialize electron-store for settings
    this.store = new Store<StoreSchema>({
      defaults: {
        'simulation-mode': true // Default to simulation mode
      }
    });
    
    // Initialize repositories
    this.sessionRepository = new FileSessionRepository();
    this.audioRepository = new FileAudioRepository();
    
    // Initialize export services
    const exportServices = new Map();
    exportServices.set('txt', new TextExportService());
    // Future: Add PDF, DOCX, HTML export services
    
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
    
    // Initialize active AssemblyAI services map
    this.activeAssemblyAIServices = new Map();
    
    this.recordingManager = new RecordingManager();
    this.initializeApp();
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

  private setupIPC(): void {
    // Recording manager handles its own IPC setup
    
    // Session list handler
    ipcMain.handle('sessions:list', async (event, sortOrder?: 'asc' | 'desc') => {
      try {
        const sessions = await this.listSessionsUseCase.execute(sortOrder);
        return { success: true, sessions: sessions.map(s => s.toJSON()) };
      } catch (error) {
        console.error('Failed to list sessions:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Session list with tags handler
    ipcMain.handle('sessions:listWithTags', async (event, tags: string[], sortOrder?: 'asc' | 'desc') => {
      try {
        const sessions = await this.listSessionsUseCase.executeWithTags(tags, sortOrder);
        return { success: true, sessions: sessions.map(s => s.toJSON()) };
      } catch (error) {
        console.error('Failed to list sessions with tags:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Session delete handler
    ipcMain.handle('sessions:delete', async (event, sessionId: string) => {
      try {
        await this.deleteSessionUseCase.execute(sessionId);
        return { success: true };
      } catch (error) {
        console.error('Failed to delete session:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Session delete multiple handler
    ipcMain.handle('sessions:deleteMultiple', async (event, sessionIds: string[]) => {
      try {
        const result = await this.deleteSessionUseCase.executeMultiple(sessionIds);
        return { success: true, result };
      } catch (error) {
        console.error('Failed to delete multiple sessions:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Export handler
    ipcMain.handle('session:export', async (event, sessionId: string, format: string, outputPath: string, options?: any) => {
      try {
        const result = await this.exportSessionUseCase.execute(
          sessionId,
          format as 'txt' | 'pdf' | 'docx' | 'html',
          outputPath,
          options
        );
        return result;
      } catch (error) {
        console.error('Failed to export session:', error);
        return { 
          success: false, 
          filePath: outputPath,
          format,
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Export with defaults handler
    ipcMain.handle('session:exportWithDefaults', async (event, sessionId: string, format: string, outputPath: string) => {
      try {
        const result = await this.exportSessionUseCase.executeWithDefaults(
          sessionId,
          format as 'txt' | 'pdf' | 'docx' | 'html',
          outputPath
        );
        return result;
      } catch (error) {
        console.error('Failed to export session with defaults:', error);
        return { 
          success: false, 
          filePath: outputPath,
          format,
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Get available export formats handler
    ipcMain.handle('export:getAvailableFormats', async () => {
      try {
        const formats = await this.exportSessionUseCase.getAvailableFormats();
        return { success: true, formats };
      } catch (error) {
        console.error('Failed to get available export formats:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Audio: Save audio file handler
    ipcMain.handle('audio:save-file', async (event, audioData: number[], fileName: string, folderPath: string) => {
      try {
        const fs = await import('fs');
        const buffer = Buffer.from(audioData);
        const outPath = path.join(folderPath, `${fileName}.webm`);
        
        // Ensure directory exists
        await fs.promises.mkdir(folderPath, { recursive: true });
        
        // Write file
        await fs.promises.writeFile(outPath, buffer);
        
        return { success: true, path: outPath };
      } catch (error) {
        console.error('Failed to save audio file:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Transcription: Start simulation transcription
    ipcMain.handle('transcription:simulation:start', async () => {
      try {
        // Initialize if not already initialized
        if (!this.simulationTranscriptionService.isActive()) {
          await this.simulationTranscriptionService.initialize();
        }
        
        // Set up result callback to send to renderer
        this.simulationTranscriptionService.onResult((result: TranscriptionResult) => {
          this.mainWindow?.webContents.send('transcription:result', result);
        });
        
        // Start transcription
        const sessionId = await this.simulationTranscriptionService.start();
        
        return { success: true, sessionId };
      } catch (error) {
        console.error('Failed to start simulation transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Transcription: Stop simulation transcription
    ipcMain.handle('transcription:simulation:stop', async (event, sessionId: string) => {
      try {
        await this.simulationTranscriptionService.stop(sessionId);
        return { success: true };
      } catch (error) {
        console.error('Failed to stop simulation transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // AssemblyAI: Start
    ipcMain.handle('transcription:assemblyai:start', async (event, apiKey: string) => {
      try {
        const service = new AssemblyAITranscriptionService();
        await service.initialize({ apiKey });
        
        service.onResult((result: TranscriptionResult) => {
          event.sender.send('transcription:result', result);
        });
        
        const sessionId = await service.start();
        this.activeAssemblyAIServices.set(sessionId, service);
        
        return { success: true, sessionId };
      } catch (error) {
        console.error('Failed to start AssemblyAI:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // AssemblyAI: Process audio
    ipcMain.handle('transcription:assemblyai:processAudio', async (event, sessionId: string, audioData: number[]) => {
      try {
        const service = this.activeAssemblyAIServices.get(sessionId);
        if (!service) throw new Error('Session not found');
        
        const buffer = Buffer.allocUnsafe(audioData.length * 2);
        for (let i = 0; i < audioData.length; i++) {
          buffer.writeInt16LE(audioData[i], i * 2);
        }
        
        await service.processAudioChunk(buffer);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // AssemblyAI: Stop
    ipcMain.handle('transcription:assemblyai:stop', async (event, sessionId: string) => {
      try {
        const service = this.activeAssemblyAIServices.get(sessionId);
        if (service) {
          await service.stop(sessionId);
          service.dispose();
          this.activeAssemblyAIServices.delete(sessionId);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    
    // Settings: Get simulation mode
    ipcMain.handle('settings:get-simulation-mode', async () => {
      try {
        const simulationMode = (this.store as any).get('simulation-mode', true) as boolean;
        return { success: true, simulationMode };
      } catch (error) {
        console.error('Failed to get simulation mode:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Settings: Set simulation mode
    ipcMain.handle('settings:set-simulation-mode', async (event, enabled: boolean) => {
      try {
        (this.store as any).set('simulation-mode', enabled);
        return { success: true };
      } catch (error) {
        console.error('Failed to set simulation mode:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Store: Get value
    ipcMain.handle('store:get', async (event, key: string) => {
      try {
        const value = (this.store as any).get(key);
        return value;
      } catch (error) {
        console.error(`Failed to get store value for key "${key}":`, error);
        return undefined;
      }
    });
    
    // Store: Set value
    ipcMain.handle('store:set', async (event, key: string, value: unknown) => {
      try {
        (this.store as any).set(key, value);
      } catch (error) {
        console.error(`Failed to set store value for key "${key}":`, error);
        throw error;
      }
    });
  }
}

new ScribeCatApp();
