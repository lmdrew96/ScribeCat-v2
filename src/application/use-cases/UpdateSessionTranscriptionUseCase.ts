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

      // Split transcription into segments
      // Since we don't have word-level timestamps, split by sentences
      // and distribute evenly across the recording duration
      const segments = this.createSegmentsFromText(
        transcriptionText.trim(),
        session.duration
      );

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

  /**
   * Create segments from transcription text
   * Splits text into sentences and distributes timing evenly
   */
  private createSegmentsFromText(
    text: string,
    totalDuration: number
  ): Array<{ text: string; startTime: number; endTime: number; confidence?: number }> {
    // Split by sentence endings (., !, ?)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    // If only one sentence or very short, create chunks by word count
    if (sentences.length === 1 || text.length < 100) {
      return this.createChunkSegments(text, totalDuration);
    }

    // Calculate time per segment
    const timePerSegment = totalDuration / sentences.length;
    
    // Create segments with evenly distributed timing
    return sentences.map((sentence, index) => ({
      text: sentence.trim(),
      startTime: index * timePerSegment,
      endTime: (index + 1) * timePerSegment,
      confidence: undefined
    }));
  }

  /**
   * Create segments by splitting text into word chunks
   * Used when sentence splitting doesn't work well
   */
  private createChunkSegments(
    text: string,
    totalDuration: number
  ): Array<{ text: string; startTime: number; endTime: number; confidence?: number }> {
    const words = text.split(/\s+/);
    const wordsPerChunk = Math.max(10, Math.floor(words.length / 10)); // ~10 chunks
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }
    
    const timePerChunk = totalDuration / chunks.length;
    
    return chunks.map((chunk, index) => ({
      text: chunk.trim(),
      startTime: index * timePerChunk,
      endTime: (index + 1) * timePerChunk,
      confidence: undefined
    }));
  }
}
