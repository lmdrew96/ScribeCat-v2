/**
 * AddStudyModeTimeUseCase
 *
 * Use case for adding study mode time (playback time) to a session.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class AddStudyModeTimeUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Add study mode time to a session
   */
  async execute(sessionId: string, seconds: number): Promise<boolean> {
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

    // Update study mode time using domain method
    session.addStudyModeTime(seconds);

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
