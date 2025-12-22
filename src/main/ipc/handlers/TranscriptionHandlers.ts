import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { TranscriptionChannels } from '../../../shared/IpcChannels.js';

/** AssemblyAI transcription response */
interface AssemblyAITranscriptResult {
  text?: string;
  words?: Array<{ text: string; start: number; end: number; confidence: number }>;
  utterances?: Array<{ text: string; start: number; end: number; speaker: string }>;
  confidence?: number;
  audio_duration?: number;
  status: string;
  error?: string;
}

/** AssemblyAI sentence response */
interface AssemblyAISentence {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

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
    this.handle(ipcMain, TranscriptionChannels.ASSEMBLYAI_GET_TOKEN, async (event, apiKey: string) => {
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
                resolve({ success: true, token: response.token });
              } else {
                console.error('AssemblyAI token error:', res.statusCode, response);
                resolve({
                  success: false,
                  error: `Failed to get token: ${res.statusCode} - ${response.error || JSON.stringify(response)}`
                });
              }
            } catch (error) {
              console.error('Failed to parse token response:', data);
              resolve({ success: false, error: `Failed to parse token response: ${data}` });
            }
          });
        });
        
        req.on('error', (error) => {
          console.error('Token request error:', error);
          resolve({ success: false, error: error.message });
        });
        
        req.end();
      });
    });

    // AssemblyAI: Batch transcription
    this.handle(ipcMain, 'transcription:assemblyai:batch', async (event, apiKey: string, audioSource: string) => {
      const https = await import('https');
      const fs = await import('fs');

      try {
        let audioUrl: string;

        // Determine if audioSource is a URL or file path
        if (audioSource.startsWith('http://') || audioSource.startsWith('https://')) {
          // It's already a URL (e.g., Supabase signed URL)
          audioUrl = audioSource;
        } else {
          // It's a local file path - upload to AssemblyAI

          const fileBuffer = fs.readFileSync(audioSource);
          audioUrl = await new Promise<string>((resolve, reject) => {
            const options = {
              hostname: 'api.assemblyai.com',
              path: '/v2/upload',
              method: 'POST',
              headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileBuffer.length
              }
            };

            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                try {
                  const response = JSON.parse(data);
                  if (res.statusCode === 200 && response.upload_url) {
                    resolve(response.upload_url);
                  } else {
                    reject(new Error(`Upload failed: ${res.statusCode} - ${JSON.stringify(response)}`));
                  }
                } catch (error) {
                  reject(new Error(`Failed to parse upload response: ${data}`));
                }
              });
            });

            req.on('error', reject);
            req.write(fileBuffer);
            req.end();
          });
        }

        // Step 2: Submit transcription request
        const transcriptId = await new Promise<string>((resolve, reject) => {
          const postData = JSON.stringify({
            audio_url: audioUrl,
            language_code: 'en_us',
            punctuate: true,
            format_text: true
          });

          const options = {
            hostname: 'api.assemblyai.com',
            path: '/v2/transcript',
            method: 'POST',
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                if (res.statusCode === 200 && response.id) {
                  resolve(response.id);
                } else {
                  reject(new Error(`Transcription request failed: ${res.statusCode} - ${JSON.stringify(response)}`));
                }
              } catch (error) {
                reject(new Error(`Failed to parse transcription response: ${data}`));
              }
            });
          });

          req.on('error', reject);
          req.write(postData);
          req.end();
        });

        // Step 3: Poll for completion
        const result = await new Promise<AssemblyAITranscriptResult>((resolve, reject) => {
          const pollInterval = 3000; // Poll every 3 seconds
          const maxAttempts = 600; // 30 minutes max
          let attempts = 0;

          const poll = () => {
            attempts++;
            if (attempts > maxAttempts) {
              reject(new Error('Transcription timeout: exceeded 30 minutes'));
              return;
            }

            const options = {
              hostname: 'api.assemblyai.com',
              path: `/v2/transcript/${transcriptId}`,
              method: 'GET',
              headers: {
                'Authorization': apiKey
              }
            };

            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                try {
                  const response = JSON.parse(data);

                  if (response.status === 'completed') {
                    resolve(response);
                  } else if (response.status === 'error') {
                    reject(new Error(`Transcription error: ${response.error}`));
                  } else {
                    // Still processing, poll again
                    setTimeout(poll, pollInterval);
                  }
                } catch (error) {
                  reject(new Error(`Failed to parse polling response: ${data}`));
                }
              });
            });

            req.on('error', reject);
            req.end();
          };

          poll();
        });

        // Step 4: Fetch sentence-level timestamps
        const sentences = await new Promise<AssemblyAISentence[]>((resolve, reject) => {
          const options = {
            hostname: 'api.assemblyai.com',
            path: `/v2/transcript/${transcriptId}/sentences`,
            method: 'GET',
            headers: {
              'Authorization': apiKey
            }
          };

          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              try {
                const response = JSON.parse(data);
                resolve(response.sentences || []);
              } catch (error) {
                console.warn('Failed to parse sentences, will use word-level fallback');
                resolve([]);
              }
            });
          });

          req.on('error', (error) => {
            console.warn('Failed to fetch sentences, will use word-level fallback:', error);
            resolve([]);
          });
          req.end();
        });

        // Step 5: Format and return transcription
        return {
          success: true,
          transcription: {
            text: result.text || '',
            words: result.words || [],
            sentences: sentences,
            utterances: result.utterances || [],
            confidence: result.confidence,
            audio_duration: result.audio_duration
          }
        };

      } catch (error) {
        console.error('Batch transcription failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}
