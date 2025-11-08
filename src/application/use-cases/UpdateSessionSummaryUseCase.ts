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
    console.log('🔵 UpdateSessionSummaryUseCase.execute() called');
    console.log('  sessionId:', sessionId);
    console.log('  summary length:', summary?.length || 0);
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

    console.log('  📝 Session found, updating summary...');
    console.log('  Session details:');
    console.log('    - id:', session.id);
    console.log('    - title:', session.title);
    console.log('    - userId:', session.userId);
    console.log('    - cloudId:', session.cloudId);
    console.log('    - current summary length:', session.summary?.length || 0);
    console.log('    - new summary length:', summary?.length || 0);

    // Determine if this is a cloud session
    // A session is a cloud session if it has a cloudId (whether found locally or in cloud)
    const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;
    console.log('  🔍 Cloud session detection:');
    console.log('    - has cloudId:', !!session.cloudId);
    console.log('    - has supabaseRepo:', !!this.supabaseSessionRepository);
    console.log('    - isCloudSession:', isCloudSession);

    // Update summary using domain method
    session.updateSummary(summary);
    console.log('  ✅ Summary updated via domain method, updatedAt:', session.updatedAt.toISOString());

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

    console.log('🟢 UpdateSessionSummaryUseCase.execute() completed successfully');
    return true;
  }
}
