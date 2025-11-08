/**
 * Transcription Service Interface
 *
 * Defines the contract for transcription services.
 * Services implementing this interface handle real-time speech-to-text conversion.
 */

/**
 * Result from transcription service
 */
export interface TranscriptionResult {
  /** The transcribed text */
  text: string;
  
  /** Timestamp in seconds from start of transcription */
  timestamp: number;
  
  /** Whether this is a final result (true) or partial/interim (false) */
  isFinal: boolean;
}

/**
 * Configuration for transcription service initialization
 */
export interface TranscriptionConfig {
  /** Language code (e.g., 'en-US', 'es-ES') */
  language?: string;
  
  /** Model path for transcription service (if applicable) */
  modelPath?: string;
  
  /** Sample rate for audio processing */
  sampleRate?: number;
  
  /** Additional service-specific options */
  [key: string]: unknown;
}

/**
 * Transcription Service Interface
 *
 * All transcription services must implement this interface.
 */
export interface ITranscriptionService {
  /**
   * Initialize the transcription service
   * @param config Configuration options
   */
  initialize(config?: TranscriptionConfig): Promise<void>;
  
  /**
   * Start a new transcription session
   * @returns Session ID for tracking this transcription
   */
  start(): Promise<string>;
  
  /**
   * Stop an active transcription session
   * @param sessionId The session to stop
   */
  stop(sessionId: string): Promise<void>;
  
  /**
   * Register callback for transcription results
   * @param callback Function to call when results are available
   */
  onResult(callback: (result: TranscriptionResult) => void): void;
  
  /**
   * Check if service is currently active
   */
  isActive(): boolean;
  
  /**
   * Clean up resources
   */
  dispose(): void;
}
