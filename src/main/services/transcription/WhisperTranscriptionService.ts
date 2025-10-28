/**
 * Whisper Transcription Service
 * 
 * Uses whisper.cpp to transcribe audio offline.
 * Processes audio in chunks and emits results via callback.
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TranscriptionResult, ITranscriptionService, TranscriptionConfig } from './ITranscriptionService.js';

const execAsync = promisify(exec);

/**
 * Whisper Transcription Service
 * 
 * Implements ITranscriptionService using whisper-node for offline transcription.
 * Unlike Vosk, Whisper processes larger audio chunks (5-10 seconds) for better accuracy.
 */
export class WhisperTranscriptionService implements ITranscriptionService {
  private modelPath: string = '';
  private sessionId: string | null = null;
  private isInitialized: boolean = false;
  private resultCallback: ((result: TranscriptionResult) => void) | null = null;
  private tempAudioPath: string | null = null;
  private audioChunks: Buffer[] = [];
  private whisperProcess: ChildProcess | null = null;
  private startTime: number = 0;

  /**
   * Initialize the Whisper service
   * @param config Configuration including model path
   */
  async initialize(config?: TranscriptionConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('WhisperTranscriptionService already initialized');
      return;
    }

    if (!config?.modelPath) {
      throw new Error('Model path is required for Whisper transcription');
    }

    this.modelPath = config.modelPath;

    // Verify model exists
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Whisper model not found at: ${this.modelPath}`);
    }
    
    console.log('Whisper service initialized with model:', this.modelPath);
    this.isInitialized = true;
  }

  /**
   * Start a new transcription session
   * @returns Session ID
   */
  async start(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (this.sessionId) {
      throw new Error('A transcription session is already active. Stop it before starting a new one.');
    }

    this.sessionId = `whisper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.audioChunks = [];
    this.startTime = Date.now();

    console.log('Whisper transcription session started:', this.sessionId);
    return this.sessionId;
  }

  /**
   * Stop an active transcription session
   * @param sessionId The session to stop
   */
  async stop(sessionId: string): Promise<void> {
    if (!this.sessionId) {
      console.warn('No active transcription session to stop');
      return;
    }

    if (this.sessionId !== sessionId) {
      throw new Error(`Session ID mismatch. Active: ${this.sessionId}, Requested: ${sessionId}`);
    }

    console.log(`Stopping Whisper transcription session: ${sessionId}`);

    // Process any remaining audio
    if (this.audioChunks.length > 0) {
      await this.processAudioChunks();
    }

    // Cleanup
    if (this.tempAudioPath && fs.existsSync(this.tempAudioPath)) {
      fs.unlinkSync(this.tempAudioPath);
      this.tempAudioPath = null;
    }

    this.audioChunks = [];
    this.sessionId = null;
  }

  /**
   * Register callback for transcription results
   * @param callback Function to call when results are available
   */
  onResult(callback: (result: TranscriptionResult) => void): void {
    this.resultCallback = callback;
  }

  /**
   * Check if service is currently active
   */
  isActive(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.sessionId) {
      this.stop(this.sessionId).catch(err => {
        console.error('Error stopping session during dispose:', err);
      });
    }

    if (this.tempAudioPath && fs.existsSync(this.tempAudioPath)) {
      fs.unlinkSync(this.tempAudioPath);
      this.tempAudioPath = null;
    }

    this.audioChunks = [];
    this.resultCallback = null;
    this.isInitialized = false;
    console.log('WhisperTranscriptionService disposed');
  }

  /**
   * Accept audio data chunk for transcription
   * Note: Whisper works better with larger chunks (5-10 seconds)
   * @param audioData PCM audio data buffer
   */
  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.isActive()) {
      return;
    }

    this.audioChunks.push(audioData);

    // Process every ~2 seconds of audio for near real-time results
    const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const estimatedSeconds = totalSize / (16000 * 2); // 16kHz, 16-bit

    if (estimatedSeconds >= 2) {
      await this.processAudioChunks();
      this.audioChunks = []; // Clear processed chunks
    }
  }

  /**
   * Process accumulated audio chunks
   */
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) {
      return;
    }

    try {
      // Combine all chunks
      const combinedAudio = Buffer.concat(this.audioChunks);

      // Save to temp file (Whisper needs file input)
      this.tempAudioPath = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
      
      // Write WAV file
      await this.writeWavFile(this.tempAudioPath, combinedAudio);
      console.log('[Whisper] WAV file written');

      // DEBUG: Save a copy for inspection
      const debugPath = path.join(os.homedir(), 'Desktop', 'whisper-debug.wav');
      await fs.promises.copyFile(this.tempAudioPath, debugPath);
      console.log('[Whisper] DEBUG: Saved copy to:', debugPath);

      console.log('[Whisper] Starting transcription...');

      // Transcribe using whisper-node
      const transcription = await this.transcribeFile(this.tempAudioPath);

      // Emit result
      if (transcription && this.resultCallback) {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        this.resultCallback({
          text: transcription,
          timestamp: elapsedSeconds,
          isFinal: true
        });
      }

      // Cleanup temp file
      if (fs.existsSync(this.tempAudioPath)) {
        fs.unlinkSync(this.tempAudioPath);
      }
    } catch (error) {
      console.error('Error processing audio chunks:', error);
    }
  }

  /**
   * Transcribe an audio file using whisper-cli
   * @param audioPath Path to audio file
   * @returns Transcribed text
   */
  private async transcribeFile(audioPath: string): Promise<string> {
    console.log('[Whisper] transcribeFile() called for:', audioPath);
    
    return new Promise((resolve, reject) => {
      // Try multiple possible paths for whisper-cli binary
      const possibleCommands = [
        '/opt/homebrew/bin/whisper-cli',  // Homebrew on Apple Silicon
        '/opt/homebrew/Cellar/whisper-cpp/1.8.2/bin/whisper-cli',  // Specific version
        '/usr/local/bin/whisper-cli',  // Homebrew on Intel Mac
        'whisper-cli',  // If in PATH
      ];
      
      let whisperBinary: string | null = null;
      for (const cmd of possibleCommands) {
        try {
          if (fs.existsSync(cmd)) {
            whisperBinary = cmd;
            console.log('[Whisper] Found binary at:', whisperBinary);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback to 'whisper-cli' if file checks failed (might still be in PATH)
      if (!whisperBinary) {
        whisperBinary = 'whisper-cli';
        console.log('[Whisper] Using binary from PATH: whisper-cli');
      }
      
      // Build command - whisper-cli uses different flags than whisper-cpp
      const outputBase = audioPath.replace('.wav', '');
      const command = `${whisperBinary} -m "${this.modelPath}" -f "${audioPath}" --output-txt --output-file "${outputBase}"`;
      
      console.log('[Whisper] Executing:', command);
      
      exec(command, { 
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000 // 60 second timeout
      }, (error, stdout, stderr) => {
        console.log('[Whisper] Command completed');
        console.log('[Whisper] stdout:', stdout);
        if (stderr) console.log('[Whisper] stderr:', stderr);
        
        if (error) {
          console.error('[Whisper] Command failed:', error.message);
          
          // Check if it's a "not found" error
          if (error.message.includes('not found') || error.message.includes('ENOENT') || error.code === 127) {
            reject(new Error('whisper-cli not found. Install: brew install whisper-cpp'));
          } else {
            reject(new Error(`Whisper failed: ${error.message}`));
          }
          return;
        }
        
        // Whisper outputs to a .txt file
        const txtFile = audioPath.replace('.wav', '.txt');
        
        console.log('[Whisper] Looking for output file:', txtFile);
        
        if (fs.existsSync(txtFile)) {
          try {
            const transcription = fs.readFileSync(txtFile, 'utf-8').trim();
            
            // Clean up temp files
            fs.unlinkSync(txtFile);
            
            console.log('[Whisper] Transcription result:', transcription);
            
            if (transcription && transcription.length > 0) {
              resolve(transcription);
            } else {
              reject(new Error('Empty transcription result'));
            }
          } catch (e) {
            console.error('[Whisper] Error reading transcription file:', e);
            reject(e as Error);
          }
        } else {
          // Try parsing from stdout
          console.log('[Whisper] Output file not found, parsing stdout');
          
          // whisper-cli outputs the transcription in stdout
          // Filter out the progress/info lines that start with [
          const lines = stdout.split('\n');
          const transcription = lines
            .filter(line => !line.trim().startsWith('[') && line.trim().length > 0)
            .join(' ')
            .trim();
          
          console.log('[Whisper] Transcription from stdout:', transcription);
          
          if (transcription && transcription.length > 0) {
            resolve(transcription);
          } else {
            reject(new Error('No transcription output found. Check that audio file has speech.'));
          }
        }
      });
    });
  }

  /**
   * Fallback method using whisper-node package
   */
  private async tryWhisperNode(audioPath: string): Promise<string> {
    console.log('[Whisper] Trying whisper-node package...');
    
    try {
      // Dynamic import for ES modules
      // @ts-ignore - whisper-node doesn't have type definitions
      const whisperModule = await import('whisper-node');
      const whisper = (whisperModule as any).default || whisperModule;
      
      console.log('[Whisper] whisper-node loaded');
      
      if (!whisper || typeof whisper !== 'function') {
        throw new Error('whisper-node not properly exported');
      }
      
      const result = await whisper(audioPath, {
        modelPath: this.modelPath,
        language: 'en',
        whisperOptions: {
          outputFormat: ['txt']
        }
      });
      
      console.log('[Whisper] whisper-node result:', result);
      
      // Result format varies by version
      if (typeof result === 'string') {
        return result.trim();
      } else if (result && result.transcription) {
        return result.transcription.trim();
      } else if (Array.isArray(result) && result.length > 0) {
        return result.map((r: any) => r.text || r).join(' ').trim();
      }
      
      throw new Error('Unexpected result format from whisper-node');
      
    } catch (error) {
      console.error('[Whisper] whisper-node failed:', error);
      throw new Error(`Both whisper-cpp and whisper-node failed. Please install whisper.cpp: brew install whisper-cpp`);
    }
  }

  /**
   * Write PCM audio data as WAV file
   * @param filePath Output file path
   * @param pcmData PCM audio data
   */
  private async writeWavFile(filePath: string, pcmData: Buffer): Promise<void> {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;

    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Chunk size
    header.writeUInt16LE(1, 20); // Audio format (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // Byte rate
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // Block align
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    // Write file
    await fs.promises.writeFile(filePath, Buffer.concat([header, pcmData]));
  }
}
