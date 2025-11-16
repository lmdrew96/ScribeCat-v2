/**
 * IncrementAIToolUsageUseCase
 *
 * Use case for incrementing AI tool usage count for a session.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class IncrementAIToolUsageUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Increment AI tool usage count for a session
   */
  async execute(sessionId: string): Promise<boolean> {
    // Try to load from local file repository first
    let session = await this.sessionRepository.findById(sessionId);

    // If not found locally and we have Supabase repository, try cloud
    if (!session && this.supabaseSessionRepository) {
      session = await this.supabaseSessionRepository.findById(sessionId);
    }

    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      return false;
    }

    // Increment AI tool usage using domain method
    session.incrementAIToolUsage();

    // Determine if this is a cloud session
    const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;

    // Persist changes to the appropriate repository
    if (isCloudSession && this.supabaseSessionRepository) {
      await this.supabaseSessionRepository.update(session);
    } else {
      await this.sessionRepository.update(session);
    }

    return true;
  }
}
