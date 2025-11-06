/**
 * UpdateSessionNotesUseCase
 *
 * Use case for updating session notes.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class UpdateSessionNotesUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Update session notes
   */
  async execute(sessionId: string, notes: string): Promise<boolean> {
    // Try to load from local file repository first
    let session = await this.sessionRepository.findById(sessionId);
    let isCloudSession = false;

    // If not found locally and we have Supabase repository, try cloud
    if (!session && this.supabaseSessionRepository) {
      session = await this.supabaseSessionRepository.findById(sessionId);
      isCloudSession = !!session;
    }

    if (!session) {
      return false;
    }

    // Update notes using domain method
    session.updateNotes(notes);

    // Persist changes to the appropriate repository
    if (isCloudSession && this.supabaseSessionRepository) {
      await this.supabaseSessionRepository.update(session);
    } else {
      await this.sessionRepository.update(session);
    }

    return true;
  }
}
