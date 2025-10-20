/**
 * ITranscriptionService Interface
 * 
 * Contract for transcription service implementations.
 * Allows for multiple providers (Vosk, Whisper, etc.)
 */

import { Transcription } from '../entities/Transcription.js';

export interface TranscriptionOptions {
  language?: string;
  modelPath?: string;
}

export interface ITranscriptionService {
  /**
   * Check if the service is available and properly configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Transcribe audio file to text
   * @param audioPath Path to the audio file
   * @param options Optional transcription settings
   * @returns Transcription object with segments and metadata
   */
  transcribe(audioPath: string, options?: TranscriptionOptions): Promise<Transcription>;

  /**
   * Get the name of the transcription provider
   */
  getProviderName(): 'vosk' | 'whisper';
}
