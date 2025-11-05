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
   * @param timestampedEntries Optional array of timestamped text entries from recording
   * @returns Success status
   */
  async execute(
    sessionId: string,
    transcriptionText: string,
    provider: 'assemblyai' | 'simulation' = 'simulation',
    timestampedEntries?: Array<{ timestamp: number; text: string }>
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

      // Create segments from timestamped entries if available, otherwise fall back to text splitting
      const segments = timestampedEntries && timestampedEntries.length > 0
        ? this.createSegmentsFromTimestampedEntries(timestampedEntries, session.duration)
        : this.createSegmentsFromText(transcriptionText.trim(), session.duration);

      console.log('🎯 Created segments:', {
        method: timestampedEntries && timestampedEntries.length > 0 ? 'timestamped' : 'text-splitting',
        sessionDuration: session.duration,
        segmentCount: segments.length,
        segments: segments.map(s => ({ start: s.startTime, end: s.endTime, text: s.text.substring(0, 30) }))
      });

      // Create transcription entity
      const transcription = new Transcription(
        transcriptionText.trim(),
        segments,
        'en', // Default language
        provider,
        new Date(),
        undefined // No average confidence
      );

      console.log('📝 Created transcription entity:', {
        fullTextLength: transcription.fullText.length,
        segmentCount: transcription.segments.length,
        provider: transcription.provider
      });

      // Add transcription to session
      session.addTranscription(transcription);

      console.log('✅ Added transcription to session. Session state before save:', {
        sessionId: session.id,
        hasTranscription: !!session.transcription,
        transcriptionSegmentCount: session.transcription?.segments.length,
        transcriptionFullTextLength: session.transcription?.fullText.length
      });

      // Save updated session
      await this.sessionRepository.save(session);

      console.log('💾 Session saved. Verifying by reloading...');

      // Verify the save worked by reloading
      const reloadedSession = await this.sessionRepository.findById(sessionId);
      console.log('🔍 Reloaded session verification:', {
        sessionId: reloadedSession?.id,
        hasTranscription: !!reloadedSession?.transcription,
        transcriptionSegmentCount: reloadedSession?.transcription?.segments.length,
        transcriptionFullTextLength: reloadedSession?.transcription?.fullText.length
      });

      return true;
    } catch (error) {
      console.error('Failed to update session transcription:', error);
      return false;
    }
  }

  /**
   * Create segments from timestamped entries captured during recording
   * Uses real timestamps from the transcription service
   */
  private createSegmentsFromTimestampedEntries(
    timestampedEntries: Array<{ timestamp: number; text: string }>,
    totalDuration: number
  ): Array<{ text: string; startTime: number; endTime: number; confidence?: number }> {
    return timestampedEntries.map((entry, index) => {
      const startTime = entry.timestamp;
      // Calculate end time as the start of the next entry, or session duration for the last entry
      const endTime = index < timestampedEntries.length - 1
        ? timestampedEntries[index + 1].timestamp
        : totalDuration;

      return {
        text: entry.text.trim(),
        startTime: startTime,
        endTime: endTime,
        confidence: undefined
      };
    });
  }

  /**
   * Create segments from transcription text
   * Splits text into sentences and distributes timing evenly
   * Used as fallback when real timestamps are not available
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
