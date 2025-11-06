import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';

/**
 * Handles transcription-related IPC channels
 *
 * Manages AssemblyAI token generation.
 */
export class TranscriptionHandlers extends BaseHandler {
  constructor() {
    super();
  }

  register(ipcMain: IpcMain): void {
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
