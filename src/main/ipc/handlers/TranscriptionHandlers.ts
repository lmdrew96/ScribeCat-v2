import { IpcMain, BrowserWindow } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SimulationTranscriptionService } from '../../services/transcription/SimulationTranscriptionService.js';
import { TranscriptionResult } from '../../services/transcription/ITranscriptionService.js';

/**
 * Handles transcription-related IPC channels
 * 
 * Manages simulation transcription and AssemblyAI token generation.
 */
export class TranscriptionHandlers extends BaseHandler {
  constructor(
    private simulationTranscriptionService: SimulationTranscriptionService,
    private getMainWindow: () => BrowserWindow | null
  ) {
    super();
  }

  register(ipcMain: IpcMain): void {
    // Transcription: Start simulation transcription
    this.handle(ipcMain, 'transcription:simulation:start', async () => {
      // Initialize if not already initialized
      if (!this.simulationTranscriptionService.isActive()) {
        await this.simulationTranscriptionService.initialize();
      }
      
      // Set up result callback to send to renderer
      this.simulationTranscriptionService.onResult((result: TranscriptionResult) => {
        const mainWindow = this.getMainWindow();
        mainWindow?.webContents.send('transcription:result', result);
      });
      
      // Start transcription
      const sessionId = await this.simulationTranscriptionService.start();
      
      return { success: true, sessionId };
    });

    // Transcription: Stop simulation transcription
    this.handle(ipcMain, 'transcription:simulation:stop', async (event, sessionId: string) => {
      await this.simulationTranscriptionService.stop(sessionId);
      return { success: true };
    });

    // Transcription: Pause simulation transcription
    this.handle(ipcMain, 'transcription:simulation:pause', async () => {
      this.simulationTranscriptionService.pause();
      return { success: true };
    });

    // Transcription: Resume simulation transcription
    this.handle(ipcMain, 'transcription:simulation:resume', async () => {
      this.simulationTranscriptionService.resume();
      return { success: true };
    });

    // AssemblyAI: Get temporary token
    this.handle(ipcMain, 'transcription:assemblyai:getToken', async (event, apiKey: string) => {
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
    });
  }
}
