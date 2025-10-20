/**
 * UpdateSessionNotesUseCase
 * 
 * Use case for updating session notes.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class UpdateSessionNotesUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Update session notes
   */
  async execute(sessionId: string, notes: string): Promise<boolean> {
    const session = await this.sessionRepository.findById(sessionId);
    
    if (!session) {
      return false;
    }

    // Update notes using domain method
    session.updateNotes(notes);

    // Persist changes
    await this.sessionRepository.update(session);

    return true;
  }
}
