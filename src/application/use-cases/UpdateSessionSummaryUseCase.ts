/**
 * UpdateSessionSummaryUseCase
 *
 * Use case for updating session summary.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class UpdateSessionSummaryUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Update session summary
   */
  async execute(sessionId: string, summary: string): Promise<boolean> {
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

    // Determine if this is a cloud session
    // A session is a cloud session if it has a cloudId (whether found locally or in cloud)
    const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;

    // Update summary using domain method
    session.updateSummary(summary);

    // Persist changes to the appropriate repository
    try {
      if (isCloudSession && this.supabaseSessionRepository) {
        await this.supabaseSessionRepository.update(session);
      } else {
        await this.sessionRepository.update(session);
      }
      return true;
    } catch (error) {
      console.error('Failed to persist summary update:', error);
      throw error;
    }
  }
}
