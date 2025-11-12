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
      console.log('🔵 UpdateSessionTranscriptionUseCase.execute() called');
      console.log('  sessionId:', sessionId);
      console.log('  transcription length:', transcriptionText?.length || 0);
      console.log('  has supabaseSessionRepository:', !!this.supabaseSessionRepository);

      // Try to load from local file repository first
      let session = await this.sessionRepository.findById(sessionId);
      console.log('  ✅ Local repository search result:', session ? 'Found' : 'Not found');

      // If not found locally and we have Supabase repository, try cloud
      if (!session && this.supabaseSessionRepository) {
        console.log('  🔍 Session not found locally, searching cloud...');
        session = await this.supabaseSessionRepository.findById(sessionId);
        console.log('  ✅ Cloud repository search result:', session ? 'Found' : 'Not found');
      }

      if (!session) {
        console.error('  ❌ Session not found in any repository');
        return false;
      }

      console.log('  📝 Session found, updating transcription...');
      console.log('  Session details:');
      console.log('    - id:', session.id);
      console.log('    - title:', session.title);
      console.log('    - userId:', session.userId);
      console.log('    - cloudId:', session.cloudId);
      console.log('    - duration:', session.duration);

      // Skip if transcription is empty
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        console.log('  ⚠️ Skipping empty transcription');
        return true;
      }

      // Create segments from timestamped entries if available, otherwise fall back to text splitting
      const segments = timestampedEntries && timestampedEntries.length > 0
        ? this.createSegmentsFromTimestampedEntries(timestampedEntries, session.duration)
        : this.createSegmentsFromText(transcriptionText.trim(), session.duration);

      console.log('  🎯 Created segments:', {
        method: timestampedEntries && timestampedEntries.length > 0 ? 'timestamped' : 'text-splitting',
        sessionDuration: session.duration,
        segmentCount: segments.length,
        segments: segments.map(s => ({ start: s.startTime, end: s.endTime, text: s.text.substring(0, 30) }))
      });

      // Preserve original transcription timestamp if re-transcribing, otherwise use current time
      // This is critical for audio playback fallback logic which uses transcription.createdAt
      const transcriptionTimestamp = session.transcription?.createdAt || new Date();

      // Create transcription entity
      const transcription = new Transcription(
        transcriptionText.trim(),
        segments,
        'en', // Default language
        provider,
        transcriptionTimestamp,
        undefined // No average confidence
      );

      console.log('  📝 Created transcription entity:', {
        fullTextLength: transcription.fullText.length,
        segmentCount: transcription.segments.length,
        provider: transcription.provider
      });

      // Add transcription to session using domain method
      session.addTranscription(transcription);

      console.log('  ✅ Transcription added to session via domain method, updatedAt:', session.updatedAt.toISOString());
      console.log('  Session state before save:', {
        sessionId: session.id,
        hasTranscription: !!session.transcription,
        transcriptionSegmentCount: session.transcription?.segments.length,
        transcriptionFullTextLength: session.transcription?.fullText.length
      });

      // Determine if this is a cloud session
      // A session is a cloud session if it has a cloudId (whether found locally or in cloud)
      const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;
      console.log('  🔍 Cloud session detection:');
      console.log('    - has cloudId:', !!session.cloudId);
      console.log('    - has supabaseRepo:', !!this.supabaseSessionRepository);
      console.log('    - isCloudSession:', isCloudSession);

      // Persist changes to the appropriate repository
      if (isCloudSession && this.supabaseSessionRepository) {
        console.log('  💾 Persisting to CLOUD repository (Supabase)...');
        try {
          await this.supabaseSessionRepository.update(session);
          console.log('  ✅ Successfully persisted to cloud repository');
        } catch (error) {
          console.error('  ❌ Failed to persist to cloud repository:', error);
          throw error;
        }
      } else {
        console.log('  💾 Persisting to LOCAL repository (file system)...');
        try {
          await this.sessionRepository.update(session);
          console.log('  ✅ Successfully persisted to local repository');
        } catch (error) {
          console.error('  ❌ Failed to persist to local repository:', error);
          throw error;
        }
      }

      console.log('  💾 Session saved. Verifying by reloading...');

      // Verify the save worked by reloading from the appropriate repository
      const reloadedSession = isCloudSession && this.supabaseSessionRepository
        ? await this.supabaseSessionRepository.findById(sessionId)
        : await this.sessionRepository.findById(sessionId);

      console.log('  🔍 Reloaded session verification:', {
        sessionId: reloadedSession?.id,
        hasTranscription: !!reloadedSession?.transcription,
        transcriptionSegmentCount: reloadedSession?.transcription?.segments.length,
        transcriptionFullTextLength: reloadedSession?.transcription?.fullText.length
      });

      console.log('🟢 UpdateSessionTranscriptionUseCase.execute() completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to update session transcription:', error);
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
