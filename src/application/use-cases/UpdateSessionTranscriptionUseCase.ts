/**
 * UpdateSessionTranscriptionUseCase
 * 
 * Business logic for adding or updating transcription in a session.
 * Application layer - orchestrates session repository operations.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Transcription } from '../../domain/entities/Transcription.js';

export class UpdateSessionTranscriptionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Execute the use case to update session transcription
   * @param sessionId The ID of the session to update
   * @param transcriptionText The full transcription text
   * @param provider The transcription provider (e.g., 'simulation', 'assemblyai')
   * @returns Success status
   */
  async execute(
    sessionId: string,
    transcriptionText: string,
    provider: 'assemblyai' | 'simulation' = 'simulation'
  ): Promise<boolean> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        return false;
      }

      // Skip if transcription is empty
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        console.log('Skipping empty transcription');
        return true;
      }

      // Create a single segment for the entire transcription
      // Since we don't have timing info, use the session duration
      const segments = [{
        text: transcriptionText.trim(),
        startTime: 0,
        endTime: session.duration,
        confidence: undefined
      }];

      // Create transcription entity
      const transcription = new Transcription(
        transcriptionText.trim(),
        segments,
        'en', // Default language
        provider,
        new Date(),
        undefined // No average confidence
      );

      // Add transcription to session
      session.addTranscription(transcription);

      // Save updated session
      await this.sessionRepository.save(session);

      return true;
    } catch (error) {
      console.error('Failed to update session transcription:', error);
      return false;
    }
  }
}
