/**
 * CreateDraftSessionUseCase
 *
 * Use case for creating a draft session for note-taking without recording.
 * Draft sessions allow users to take notes before or without starting a recording.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Session } from '../../domain/entities/Session.js';

export interface CreateDraftSessionOutput {
  sessionId: string;
}

export class CreateDraftSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository
  ) {}

  /**
   * Execute the use case
   */
  async execute(): Promise<CreateDraftSessionOutput> {
    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create draft session entity
    const now = new Date();
    const session = new Session(
      sessionId,
      `Draft Notes ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      '', // Empty recording path for draft
      '', // Empty notes initially
      now,
      now,
      0, // No duration for draft
      undefined, // No transcription
      ['draft'], // Tag as draft
      [], // No export history
      undefined, // No course ID
      undefined, // No course title
      undefined  // No course number
    );

    // Save session metadata
    await this.sessionRepository.save(session);

    return {
      sessionId
    };
  }

  /**
   * Generate a unique session ID (UUID format for Supabase compatibility)
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }
}
