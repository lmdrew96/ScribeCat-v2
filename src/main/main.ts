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

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ScribeCatApp {
  private mainWindow: BrowserWindow | null = null;
  private recordingManager: RecordingManager;
  private directoryManager: DirectoryManager;
  
  // Repositories
  private sessionRepository: FileSessionRepository;
  private audioRepository: FileAudioRepository;
  
  // Use Cases
  private listSessionsUseCase: ListSessionsUseCase;
  private deleteSessionUseCase: DeleteSessionUseCase;
  private transcribeAudioUseCase: TranscribeAudioUseCase;
  private exportSessionUseCase: ExportSessionUseCase;

  constructor() {
    // Initialize directory manager
    this.directoryManager = new DirectoryManager();
    
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
  }
}

new ScribeCatApp();
