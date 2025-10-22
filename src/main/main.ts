import { app, BrowserWindow, ipcMain, Menu, session, systemPreferences } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { RecordingManager } from './recording-manager.js';
import { DirectoryManager } from '../infrastructure/setup/DirectoryManager.js';
import { FileSessionRepository } from '../infrastructure/repositories/FileSessionRepository.js';
import { FileAudioRepository } from '../infrastructure/repositories/FileAudioRepository.js';
import { ListSessionsUseCase } from '../application/use-cases/ListSessionsUseCase.js';
import { DeleteSessionUseCase } from '../application/use-cases/DeleteSessionUseCase.js';
import { TranscribeAudioUseCase } from '../application/use-cases/TranscribeAudioUseCase.js';
import { ExportSessionUseCase } from '../application/use-cases/ExportSessionUseCase.js';
import { VoskTranscriptionService } from '../infrastructure/services/transcription/VoskTranscriptionService.js';
import { WhisperTranscriptionService } from '../infrastructure/services/transcription/WhisperTranscriptionService.js';
import { TextExportService } from '../infrastructure/services/export/TextExportService.js';
import { SimulationTranscriptionService } from './services/transcription/SimulationTranscriptionService.js';
import { WhisperTranscriptionService as WhisperTranscriptionServiceLocal } from './services/transcription/WhisperTranscriptionService.js';
import { TranscriptionResult } from './services/transcription/ITranscriptionService.js';
import { VoskModelServer } from './services/VoskModelServer.js';
import { VoskModelManager, DownloadProgress } from './services/VoskModelManager.js';
import { WhisperModelManager } from './services/WhisperModelManager.js';
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
  private transcribeAudioUseCase: TranscribeAudioUseCase;
  private exportSessionUseCase: ExportSessionUseCase;
  
  // Transcription services
  private simulationTranscriptionService: SimulationTranscriptionService;
  private voskModelServer: VoskModelServer;
  private voskModelManager: VoskModelManager;
  private whisperModelManager: WhisperModelManager;
  private activeWhisperServices: Map<string, WhisperTranscriptionServiceLocal>;

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
    
    // Initialize transcription services
    const voskService = new VoskTranscriptionService(
      path.join(app.getPath('userData'), 'models')
    );
    const whisperService = new WhisperTranscriptionService(''); // API key will be set from settings
    
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
    this.transcribeAudioUseCase = new TranscribeAudioUseCase(
      this.sessionRepository,
      voskService,
      whisperService
    );
    this.exportSessionUseCase = new ExportSessionUseCase(
      this.sessionRepository,
      exportServices
    );
    
    // Initialize simulation transcription service
    this.simulationTranscriptionService = new SimulationTranscriptionService();
    
    // Initialize Vosk model server
    this.voskModelServer = new VoskModelServer();
    
    // Initialize Vosk model manager
    this.voskModelManager = new VoskModelManager();
    
    // Initialize Whisper model manager
    this.whisperModelManager = new WhisperModelManager();
    
    // Initialize active Whisper services map
    this.activeWhisperServices = new Map();
    
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
    
    // Transcription handler
    ipcMain.handle('transcription:start', async (event, sessionId: string, options?: any) => {
      try {
        const session = await this.transcribeAudioUseCase.execute(sessionId, options);
        return { success: true, session: session.toJSON() };
      } catch (error) {
        console.error('Failed to transcribe audio:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Re-transcription handler
    ipcMain.handle('transcription:retry', async (event, sessionId: string, options?: any) => {
      try {
        const session = await this.transcribeAudioUseCase.reTranscribe(sessionId, options);
        return { success: true, session: session.toJSON() };
      } catch (error) {
        console.error('Failed to re-transcribe audio:', error);
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
    
    // Vosk Model Server: Start server
    ipcMain.handle('vosk:server:start', async (event, modelPath: string, port?: number) => {
      try {
        const serverUrl = await this.voskModelServer.start(modelPath, port);
        return { success: true, serverUrl };
      } catch (error) {
        console.error('Failed to start Vosk model server:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Server: Stop server
    ipcMain.handle('vosk:server:stop', async () => {
      try {
        await this.voskModelServer.stop();
        return { success: true };
      } catch (error) {
        console.error('Failed to stop Vosk model server:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Server: Check if running
    ipcMain.handle('vosk:server:isRunning', async () => {
      try {
        const isRunning = this.voskModelServer.isServerRunning();
        const serverUrl = isRunning ? this.voskModelServer.getServerUrl() : null;
        return { success: true, isRunning, serverUrl };
      } catch (error) {
        console.error('Failed to check Vosk server status:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Manager: Check if model is installed
    ipcMain.handle('vosk:model:isInstalled', async () => {
      try {
        const isInstalled = await this.voskModelManager.isModelInstalled();
        return { success: true, isInstalled };
      } catch (error) {
        console.error('Failed to check model installation:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Manager: Get model path
    ipcMain.handle('vosk:model:getPath', async () => {
      try {
        const modelPath = this.voskModelManager.getModelPath();
        const modelsDir = this.voskModelManager.getModelsDirectory();
        return { success: true, modelPath, modelsDir };
      } catch (error) {
        console.error('Failed to get model path:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Manager: Download model
    ipcMain.handle('vosk:model:download', async (event) => {
      try {
        // Set up progress callback
        this.voskModelManager.onProgress((progress: DownloadProgress) => {
          event.sender.send('vosk:model:downloadProgress', progress);
        });
        
        await this.voskModelManager.downloadModel();
        return { success: true };
      } catch (error) {
        console.error('Failed to download model:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Vosk Model Manager: Delete model
    ipcMain.handle('vosk:model:delete', async () => {
      try {
        await this.voskModelManager.deleteModel();
        return { success: true };
      } catch (error) {
        console.error('Failed to delete model:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Model Manager: Check if model is installed
    ipcMain.handle('whisper:model:isInstalled', async (event, modelName) => {
      try {
        const isInstalled = await this.whisperModelManager.isModelInstalled(modelName || 'base');
        return { success: true, isInstalled };
      } catch (error) {
        console.error('Failed to check Whisper model:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Model Manager: Get model path
    ipcMain.handle('whisper:model:getPath', async (event, modelName) => {
      try {
        const modelPath = this.whisperModelManager.getModelPath(modelName || 'base');
        const modelsDir = this.whisperModelManager.getModelsDirectory();
        return { success: true, modelPath, modelsDir };
      } catch (error) {
        console.error('Failed to get Whisper model path:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Model Manager: Download model
    ipcMain.handle('whisper:model:download', async (event, modelName) => {
      try {
        // Set up progress callback
        this.whisperModelManager.onProgress((progress) => {
          event.sender.send('whisper:model:downloadProgress', progress);
        });
        
        await this.whisperModelManager.downloadModel(modelName || 'base');
        return { success: true };
      } catch (error) {
        console.error('Failed to download Whisper model:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Model Manager: Delete model
    ipcMain.handle('whisper:model:delete', async (event, modelName) => {
      try {
        await this.whisperModelManager.deleteModel(modelName || 'base');
        return { success: true };
      } catch (error) {
        console.error('Failed to delete Whisper model:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Model Manager: Get available models
    ipcMain.handle('whisper:model:getAvailable', async () => {
      try {
        const models = this.whisperModelManager.getAvailableModels();
        return { success: true, models };
      } catch (error) {
        console.error('Failed to get available models:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Transcription: Start
    ipcMain.handle('transcription:whisper:start', async (event, modelPath: string) => {
      try {
        const whisperService = new WhisperTranscriptionServiceLocal();
        await whisperService.initialize({ modelPath });
        
        // Set up result callback
        whisperService.onResult((result: TranscriptionResult) => {
          event.sender.send('transcription:result', result);
        });
        
        const sessionId = await whisperService.start();
        
        // Store service for audio processing
        this.activeWhisperServices.set(sessionId, whisperService);
        
        return { success: true, sessionId };
      } catch (error) {
        console.error('Failed to start Whisper transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Transcription: Process audio chunk
    ipcMain.handle('transcription:whisper:processAudio', async (event, sessionId: string, audioData: number[]) => {
      try {
        const service = this.activeWhisperServices.get(sessionId);
        if (!service) {
          throw new Error('Session not found');
        }
        
        const buffer = Buffer.from(audioData);
        await service.processAudioChunk(buffer);
        
        return { success: true };
      } catch (error) {
        console.error('Failed to process audio:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Whisper Transcription: Stop
    ipcMain.handle('transcription:whisper:stop', async (event, sessionId: string) => {
      try {
        const service = this.activeWhisperServices.get(sessionId);
        if (service) {
          await service.stop(sessionId);
          service.dispose();
          this.activeWhisperServices.delete(sessionId);
        }
        
        return { success: true };
      } catch (error) {
        console.error('Failed to stop Whisper transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    // Clean up Vosk server on app quit
    app.on('before-quit', async () => {
      if (this.voskModelServer.isServerRunning()) {
        console.log('Stopping Vosk model server before quit...');
        await this.voskModelServer.stop();
      }
    });
  }
}

new ScribeCatApp();
