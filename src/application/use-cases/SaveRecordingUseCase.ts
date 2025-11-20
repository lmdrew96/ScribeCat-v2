/**
 * SaveRecordingUseCase
 * 
 * Use case for saving a recording and creating a session.
 * Orchestrates audio storage and session metadata creation.
 */

import { IAudioRepository } from '../../domain/repositories/IAudioRepository.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Session } from '../../domain/entities/Session.js';

export interface SaveRecordingInput {
  audioData: ArrayBuffer;
  duration: number;
  title?: string;
  courseId?: string;
  courseTitle?: string;
  courseNumber?: string;
  userId?: string;
  transcription?: string;
}

export interface SaveRecordingOutput {
  sessionId: string;
  filePath: string;
}

export class SaveRecordingUseCase {
  constructor(
    private audioRepository: IAudioRepository,
    private sessionRepository: ISessionRepository
  ) {}

  /**
   * Execute the use case
   */
  async execute(input: SaveRecordingInput): Promise<SaveRecordingOutput> {
    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `recording-${timestamp}.webm`;

    // Save audio file
    const filePath = await this.audioRepository.saveAudio(input.audioData, filename);

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create session entity
    const now = new Date();
    const finalTitle = input.title || `Recording ${now.toLocaleDateString()}`;

    console.log('📝 SaveRecordingUseCase - Creating session:', {
      sessionId,
      providedTitle: input.title,
      finalTitle,
      courseId: input.courseId,
      courseTitle: input.courseTitle,
      userId: input.userId
    });

    const session = new Session(
      sessionId,
      finalTitle,
      filePath,
      '', // Empty notes initially
      now,
      now,
      input.duration,
      input.transcription, // Include transcription if provided
      [], // tags
      [], // exportHistory
      input.courseId,
      input.courseTitle,
      input.courseNumber,
      // Cloud sync fields
      input.userId // Set userId if user is authenticated (or undefined if logged out)
    );

    // Save session metadata
    await this.sessionRepository.save(session);

    console.log('✅ SaveRecordingUseCase - Session saved with title:', session.title);

    return {
      sessionId,
      filePath
    };
  }

  /**
   * Generate a unique session ID (UUID format for Supabase compatibility)
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }
}
