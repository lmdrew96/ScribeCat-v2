/**
 * TranscribeAudioUseCase
 * 
 * Business logic for transcribing audio files with fallback support.
 * Application layer - orchestrates transcription services and session updates.
 */

import { Session } from '../../domain/entities/Session.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { ITranscriptionService } from '../../domain/services/ITranscriptionService.js';

export interface TranscribeAudioOptions {
  language?: string;
  modelPath?: string;
}

export class TranscribeAudioUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private primaryTranscriptionService: ITranscriptionService,
    private fallbackTranscriptionService?: ITranscriptionService
  ) {}

  /**
   * Execute the use case to transcribe audio for a session
   * @param sessionId The ID of the session to transcribe
   * @param options Optional transcription settings
   * @returns The updated session with transcription
   */
  async execute(sessionId: string, options?: TranscribeAudioOptions): Promise<Session> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Check if session already has transcription
      if (session.hasTranscription()) {
        console.log(`Session ${sessionId} already has transcription`);
        return session;
      }

      // Try primary transcription service
      let transcription;
      try {
        const isPrimaryAvailable = await this.primaryTranscriptionService.isAvailable();
        
        if (isPrimaryAvailable) {
          console.log(`Using ${this.primaryTranscriptionService.getProviderName()} for transcription`);
          transcription = await this.primaryTranscriptionService.transcribe(
            session.recordingPath,
            options
          );
        } else {
          throw new Error('Primary transcription service not available');
        }
      } catch (primaryError) {
        console.warn(`Primary transcription failed: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
        
        // Try fallback service
        if (this.fallbackTranscriptionService) {
          try {
            const isFallbackAvailable = await this.fallbackTranscriptionService.isAvailable();
            
            if (isFallbackAvailable) {
              console.log(`Using fallback ${this.fallbackTranscriptionService.getProviderName()} for transcription`);
              transcription = await this.fallbackTranscriptionService.transcribe(
                session.recordingPath,
                options
              );
            } else {
              throw new Error('Fallback transcription service not available');
            }
          } catch (fallbackError) {
            throw new Error(
              `Both transcription services failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown'}, ` +
              `Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
            );
          }
        } else {
          throw new Error(`Transcription failed and no fallback service configured: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
        }
      }

      // Add transcription to session
      session.addTranscription(transcription);

      // Save updated session
      await this.sessionRepository.save(session);

      return session;
    } catch (error) {
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Re-transcribe a session (overwrites existing transcription)
   * @param sessionId The ID of the session to re-transcribe
   * @param options Optional transcription settings
   * @returns The updated session with new transcription
   */
  async reTranscribe(sessionId: string, options?: TranscribeAudioOptions): Promise<Session> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Clear existing transcription by creating a new session without it
      // (Since transcription is readonly, we need to work around this)
      // For now, we'll just proceed with transcription which will overwrite
      
      // Transcribe using primary service
      const isPrimaryAvailable = await this.primaryTranscriptionService.isAvailable();
      let transcription;

      if (isPrimaryAvailable) {
        transcription = await this.primaryTranscriptionService.transcribe(
          session.recordingPath,
          options
        );
      } else if (this.fallbackTranscriptionService) {
        const isFallbackAvailable = await this.fallbackTranscriptionService.isAvailable();
        if (isFallbackAvailable) {
          transcription = await this.fallbackTranscriptionService.transcribe(
            session.recordingPath,
            options
          );
        } else {
          throw new Error('No transcription service available');
        }
      } else {
        throw new Error('No transcription service available');
      }

      // Update session with new transcription
      session.addTranscription(transcription);
      await this.sessionRepository.save(session);

      return session;
    } catch (error) {
      throw new Error(`Failed to re-transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
