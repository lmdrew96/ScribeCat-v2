/**
 * UpdateSessionTranscriptionUseCase
 * 
 * Business logic for adding or updating transcription in a session.
 * Application layer - orchestrates session repository operations.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Transcription } from '../../domain/entities/Transcription.js';

export class UpdateSessionTranscriptionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Execute the use case to update session transcription
   * @param sessionId The ID of the session to update
   * @param transcriptionText The full transcription text
   * @param provider The transcription provider (AssemblyAI)
   * @param timestampedEntries Optional array of timestamped text entries from recording
   * @returns Success status
   */
  async execute(
    sessionId: string,
    transcriptionText: string,
    provider: 'assemblyai' = 'assemblyai',
    timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>
  ): Promise<boolean> {
    try {
      // Try to load from local file repository first
      let session = await this.sessionRepository.findById(sessionId);

      // If not found locally and we have Supabase repository, try cloud
      if (!session && this.supabaseSessionRepository) {
        session = await this.supabaseSessionRepository.findById(sessionId);
      }

      if (!session) {
        console.error('Session not found:', sessionId);
        return false;
      }

      // Skip if transcription is empty
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        return true;
      }

      // Create segments from timestamped entries if available, otherwise fall back to text splitting
      const segments = timestampedEntries && timestampedEntries.length > 0
        ? this.createSegmentsFromTimestampedEntries(timestampedEntries, session.duration)
        : this.createSegmentsFromText(transcriptionText.trim(), session.duration);

      // Always use current time for transcription timestamp
      // Re-transcription should create a fresh transcription with new timestamps
      const transcriptionTimestamp = new Date();

      // Create transcription entity
      const transcription = new Transcription(
        transcriptionText.trim(),
        segments,
        'en', // Default language
        provider,
        transcriptionTimestamp,
        undefined // No average confidence
      );

      // Add transcription to session using domain method
      session.addTranscription(transcription);

      // Determine if this is a cloud session
      // A session is a cloud session if it has a cloudId (whether found locally or in cloud)
      const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;

      // Persist changes to the appropriate repository
      try {
        if (isCloudSession && this.supabaseSessionRepository) {
          await this.supabaseSessionRepository.update(session);
        } else {
          await this.sessionRepository.update(session);
        }
        return true;
      } catch (error) {
        console.error('Failed to persist transcription update:', error);
        throw error;
      }
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
    timestampedEntries: Array<{ startTime: number; endTime: number; text: string }>,
    totalDuration: number
  ): Array<{ text: string; startTime: number; endTime: number; confidence?: number }> {
    return timestampedEntries.map((entry, index) => {
      // Use the real end time from the entry (provided by AssemblyAI)
      // This is accurate to when the speaker actually finished speaking
      let endTime = entry.endTime;

      // Safety check: ensure end time doesn't exceed session duration
      if (endTime > totalDuration) {
        console.warn(`Segment ${index} end time (${endTime}s) exceeds session duration (${totalDuration}s), clamping to session duration`);
        endTime = totalDuration;
      }

      // Safety check: ensure end time is after start time
      if (endTime <= entry.startTime) {
        console.warn(`Segment ${index} end time (${endTime}s) is before or equal to start time (${entry.startTime}s), using next segment's start or session duration`);
        endTime = index < timestampedEntries.length - 1
          ? timestampedEntries[index + 1].startTime
          : totalDuration;
      }

      return {
        text: entry.text.trim(),
        startTime: entry.startTime,
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
