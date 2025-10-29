import { app, BrowserWindow, ipcMain, Menu, session, systemPreferences, dialog } from 'electron';
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
import { TranscriptionResult } from './services/transcription/ITranscriptionService.js';
import { ClaudeAIService } from '../infrastructure/services/ai/ClaudeAIService.js';
import { GoogleDriveService } from '../infrastructure/services/drive/GoogleDriveService.js';
import type { ChatMessage, GoogleDriveConfig } from '../shared/types.js';
import Store from 'electron-store';

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

  private setupIPC(): void {
    // Recording manager handles its own IPC setup
    
    // Dialog: Show save dialog
    ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }
        
        const result = await dialog.showSaveDialog(this.mainWindow, options);
        return { success: true, data: result };
      } catch (error) {
        console.error('Failed to show save dialog:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
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
    
    // AssemblyAI: Get temporary token
    ipcMain.handle('transcription:assemblyai:getToken', async (event, apiKey: string) => {
      try {
        const https = await import('https');
        
        return new Promise((resolve) => {
          const options = {
            hostname: 'streaming.assemblyai.com',
            path: '/v3/token?expires_in_seconds=600',
            method: 'GET',
            headers: {
              'Authorization': apiKey
            }
          };
          
          const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                if (res.statusCode === 200 && response.token) {
                  console.log('✅ AssemblyAI token generated successfully');
                  resolve({ success: true, token: response.token });
                } else {
                  console.error('❌ AssemblyAI token error:', res.statusCode, response);
                  resolve({ 
                    success: false, 
                    error: `Failed to get token: ${res.statusCode} - ${response.error || JSON.stringify(response)}` 
                  });
                }
              } catch (error) {
                console.error('❌ Failed to parse token response:', data);
                resolve({ success: false, error: `Failed to parse token response: ${data}` });
              }
            });
          });
          
          req.on('error', (error) => {
            console.error('❌ Token request error:', error);
            resolve({ success: false, error: error.message });
          });
          
          req.end();
        });
      } catch (error) {
        console.error('Failed to get AssemblyAI token:', error);
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
    
    // AI: Set API key
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
    
    // AI: Check if configured
    ipcMain.handle('ai:isConfigured', async () => {
      try {
        const isConfigured = this.aiService ? await this.aiService.isConfigured() : false;
        return { success: true, data: isConfigured };
      } catch (error) {
        console.error('Failed to check AI configuration:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Test connection
    ipcMain.handle('ai:testConnection', async () => {
      try {
        console.log('🔍 AI test connection handler called');
        
        if (!this.aiService) {
          console.log('❌ AI service not configured');
          return { success: false, error: 'AI service not configured' };
        }
        
        console.log('✅ AI service exists, calling testConnection...');
        const connected = await this.aiService.testConnection();
        console.log('📊 Test connection result:', connected);
        
        return { success: true, data: connected };
      } catch (error) {
        console.error('❌ Failed to test AI connection:', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Chat
    ipcMain.handle('ai:chat', async (event, message: string, history: ChatMessage[], options?: any) => {
      try {
        if (!this.aiService) {
          return { success: false, error: 'AI service not configured. Please set an API key.' };
        }
        
        const response = await this.aiService.chat(message, history, options);
        return { success: true, data: response };
      } catch (error) {
        console.error('AI chat failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Chat stream
    ipcMain.handle('ai:chatStream', async (event, message: string, history: ChatMessage[], options: any) => {
      try {
        if (!this.aiService) {
          return { success: false, error: 'AI service not configured. Please set an API key.' };
        }
        
        await this.aiService.chatStream(message, history, options, (chunk: string) => {
          // Send chunk to renderer via IPC
          this.mainWindow?.webContents.send('ai:chatChunk', chunk);
        });
        
        return { success: true };
      } catch (error) {
        console.error('AI chat stream failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Polish transcription
    ipcMain.handle('ai:polishTranscription', async (event, text: string, options?: any) => {
      try {
        if (!this.aiService) {
          return { success: false, error: 'AI service not configured. Please set an API key.' };
        }
        
        const result = await this.aiService.polishTranscription(text, options);
        return { success: true, data: result };
      } catch (error) {
        console.error('AI polish transcription failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Generate summary
    ipcMain.handle('ai:generateSummary', async (event, transcription: string, notes?: string, options?: any) => {
      try {
        if (!this.aiService) {
          return { success: false, error: 'AI service not configured. Please set an API key.' };
        }
        
        const result = await this.aiService.generateSummary(transcription, notes, options);
        return { success: true, data: result };
      } catch (error) {
        console.error('AI generate summary failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // AI: Generate title
    ipcMain.handle('ai:generateTitle', async (event, transcription: string, notes?: string, options?: any) => {
      try {
        if (!this.aiService) {
          return { success: false, error: 'AI service not configured. Please set an API key.' };
        }
        
        const result = await this.aiService.generateTitle(transcription, notes, options);
        return { success: true, data: result };
      } catch (error) {
        console.error('AI generate title failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Configure
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
    
    // Google Drive: Check if authenticated
    ipcMain.handle('drive:isAuthenticated', async () => {
      try {
        if (!this.googleDriveService) {
          return { success: true, data: false };
        }
        
        const isAuthenticated = await this.googleDriveService.isAuthenticated();
        return { success: true, data: isAuthenticated };
      } catch (error) {
        console.error('Failed to check Google Drive authentication:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Get auth URL
    ipcMain.handle('drive:getAuthUrl', async () => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        const authUrl = await this.googleDriveService.getAuthUrl();
        return { success: true, data: authUrl };
      } catch (error) {
        console.error('Failed to get Google Drive auth URL:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Exchange authorization code for tokens
    ipcMain.handle('drive:exchangeCodeForTokens', async (event, code: string) => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        const result = await this.googleDriveService.exchangeCodeForTokens(code);
        
        if (result.success && this.googleDriveService) {
          // Store the refresh token for persistence
          const config = { refreshToken: (this.googleDriveService as any).config.refreshToken };
          (this.store as any).set('google-drive-credentials', JSON.stringify(config));
        }
        
        return result;
      } catch (error) {
        console.error('Failed to exchange code for tokens:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Set credentials
    ipcMain.handle('drive:setCredentials', async (event, config: GoogleDriveConfig) => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        await this.googleDriveService.setCredentials(config);
        
        // Store credentials for persistence
        (this.store as any).set('google-drive-credentials', JSON.stringify(config));
        
        return { success: true };
      } catch (error) {
        console.error('Failed to set Google Drive credentials:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Upload file
    ipcMain.handle('drive:uploadFile', async (event, filePath: string, options?: any) => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        // GoogleDriveService.uploadFile already returns { success, fileId, webViewLink, error }
        // So we return it directly instead of wrapping it
        const result = await this.googleDriveService.uploadFile(filePath, options);
        return result;
      } catch (error) {
        console.error('Failed to upload file to Google Drive:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: List files
    ipcMain.handle('drive:listFiles', async (event, folderId?: string) => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        const files = await this.googleDriveService.listFiles(folderId);
        return { success: true, data: files };
      } catch (error) {
        console.error('Failed to list Google Drive files:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Create folder
    ipcMain.handle('drive:createFolder', async (event, name: string, parentId?: string) => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        const folder = await this.googleDriveService.createFolder(name, parentId);
        return { success: true, data: folder };
      } catch (error) {
        console.error('Failed to create Google Drive folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Get user email
    ipcMain.handle('drive:getUserEmail', async () => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        const email = await this.googleDriveService.getUserEmail();
        return { success: true, data: email };
      } catch (error) {
        console.error('Failed to get Google Drive user email:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    // Google Drive: Disconnect
    ipcMain.handle('drive:disconnect', async () => {
      try {
        if (!this.googleDriveService) {
          return { success: false, error: 'Google Drive not configured' };
        }
        
        await this.googleDriveService.disconnect();
        
        // Clear stored credentials
        (this.store as any).delete('google-drive-credentials');
        
        return { success: true };
      } catch (error) {
        console.error('Failed to disconnect Google Drive:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
  }
}

new ScribeCatApp();
