/**
 * VoskTranscriptionService (Renderer Process)
 * 
 * Handles real-time speech-to-text transcription using Vosk in the renderer process.
 * Uses vosk-browser package which loads models from a local HTTP server.
 * 
 * The local HTTP server is managed by the main process and serves model files
 * from the user-configured model directory.
 */

import { createModel } from 'vosk-browser';
import type { RecognizerMessage } from 'vosk-browser/dist/interfaces';

// Using any for Model and KaldiRecognizer as they're not properly exported
type Model = any;
type KaldiRecognizer = any;

export interface VoskResult {
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface VoskConfig {
  modelUrl: string; // URL to the model (e.g., http://localhost:8765/model-name)
  sampleRate?: number;
  onResult?: (result: VoskResult) => void;
  onError?: (error: Error) => void;
}

export class VoskTranscriptionService {
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private sessionActive: boolean = false;
  private startTime: number = 0;
  private sampleRate: number = 16000;
  private onResultCallback: ((result: VoskResult) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  /**
   * Initialize Vosk with a model from the local HTTP server
   * 
   * @param config Configuration including model URL
   */
  async initialize(config: VoskConfig): Promise<void> {
    console.log('Initializing Vosk with model URL:', config.modelUrl);
    
    this.sampleRate = config.sampleRate || 16000;
    this.onResultCallback = config.onResult || null;
    this.onErrorCallback = config.onError || null;
    
    try {
      // Load model from local HTTP server
      this.model = await createModel(config.modelUrl);
      console.log('Vosk model loaded successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to load Vosk model:', errorMessage);
      
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(`Failed to load Vosk model: ${errorMessage}`));
      }
      
      throw new Error(`Failed to load Vosk model: ${errorMessage}`);
    }
  }

  /**
   * Start transcription with an audio stream
   * 
   * @param stream MediaStream from getUserMedia
   * @returns Session ID
   */
  async start(stream: MediaStream): Promise<string> {
    if (!this.model) {
      throw new Error('Vosk model not initialized. Call initialize() first.');
    }

    if (this.sessionActive) {
      throw new Error('Transcription session already active');
    }

    try {
      console.log('Starting Vosk transcription session');

      // Create recognizer with event-based API
      this.recognizer = new this.model.KaldiRecognizer(this.sampleRate);
      
      // Set up event listeners for results
      this.recognizer.on('result', (message: RecognizerMessage) => {
        // Type guard for result messages with text
        if ('result' in message && message.result && 'text' in message.result) {
          const text = message.result.text;
          if (text && typeof text === 'string' && text.trim().length > 0) {
            this.emitResult({
              text: text.trim(),
              timestamp: (Date.now() - this.startTime) / 1000,
              isFinal: true
            });
          }
        }
      });

      this.recognizer.on('partialresult', (message: RecognizerMessage) => {
        // Type guard for partial result messages
        if ('result' in message && message.result && 'partial' in message.result) {
          const partial = message.result.partial;
          if (partial && typeof partial === 'string' && partial.trim().length > 0) {
            this.emitResult({
              text: partial.trim(),
              timestamp: (Date.now() - this.startTime) / 1000,
              isFinal: false
            });
          }
        }
      });

      this.recognizer.on('error', (message: RecognizerMessage) => {
        console.error('Vosk recognizer error:', message);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error('Vosk recognizer error'));
        }
      });
      
      // Set up audio context
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

      // Create script processor for audio processing
      // Buffer size of 4096 provides good balance between latency and performance
      const bufferSize = 4096;
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      // Process audio chunks
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this.recognizer || !this.sessionActive) return;

        // Get audio buffer and send to recognizer
        const audioBuffer = event.inputBuffer;
        this.recognizer.acceptWaveform(audioBuffer);
      };

      // Connect audio nodes
      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      this.sessionActive = true;
      this.startTime = Date.now();

      const sessionId = `vosk-${Date.now()}`;
      console.log('Vosk transcription started:', sessionId);
      
      return sessionId;
    } catch (error) {
      this.cleanup();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start Vosk transcription:', errorMessage);
      
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(`Failed to start transcription: ${errorMessage}`));
      }
      
      throw new Error(`Failed to start transcription: ${errorMessage}`);
    }
  }

  /**
   * Stop transcription session
   */
  async stop(): Promise<void> {
    if (!this.sessionActive) {
      console.warn('No active transcription session to stop');
      return;
    }

    console.log('Stopping Vosk transcription');

    try {
      // Recognizer will emit final results via events
      // Just clean up resources
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }

    this.cleanup();
    console.log('Vosk transcription stopped');
  }

  /**
   * Check if transcription is active
   */
  isActive(): boolean {
    return this.sessionActive;
  }

  /**
   * Register callback for transcription results
   */
  onResult(callback: (result: VoskResult) => void): void {
    this.onResultCallback = callback;
  }

  /**
   * Register callback for errors
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Disconnect audio nodes
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.error('Error closing audio context:', err);
      });
      this.audioContext = null;
    }

    // Remove recognizer (vosk-browser handles cleanup internally)
    this.recognizer = null;

    this.sessionActive = false;
  }

  /**
   * Emit transcription result
   */
  private emitResult(result: VoskResult): void {
    if (this.onResultCallback) {
      this.onResultCallback(result);
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.cleanup();
    
    // Terminate model (vosk-browser handles cleanup internally)
    if (this.model) {
      this.model.terminate();
      this.model = null;
    }

    this.onResultCallback = null;
    this.onErrorCallback = null;
  }
}
