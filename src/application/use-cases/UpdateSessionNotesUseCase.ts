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
    console.log('🔵 UpdateSessionNotesUseCase.execute() called');
    console.log('  sessionId:', sessionId);
    console.log('  notes length:', notes?.length || 0);
    console.log('  has supabaseSessionRepository:', !!this.supabaseSessionRepository);

    // Try to load from local file repository first
    let session = await this.sessionRepository.findById(sessionId);
    console.log('  ✅ Local repository search result:', session ? 'Found' : 'Not found');
    let isCloudSession = false;

    // If not found locally and we have Supabase repository, try cloud
    if (!session && this.supabaseSessionRepository) {
      console.log('  🔍 Session not found locally, searching cloud...');
      session = await this.supabaseSessionRepository.findById(sessionId);
      isCloudSession = !!session;
      console.log('  ✅ Cloud repository search result:', session ? 'Found (isCloudSession=true)' : 'Not found');
    }

    if (!session) {
      console.error('  ❌ Session not found in any repository');
      return false;
    }

    console.log('  📝 Session found, updating notes...');
    console.log('  Session details:');
    console.log('    - id:', session.id);
    console.log('    - title:', session.title);
    console.log('    - userId:', session.userId);
    console.log('    - cloudId:', session.cloudId);
    console.log('    - permissionLevel:', session.permissionLevel);
    console.log('    - current notes length:', session.notes?.length || 0);
    console.log('    - new notes length:', notes?.length || 0);

    // Update notes using domain method
    session.updateNotes(notes);
    console.log('  ✅ Notes updated via domain method, updatedAt:', session.updatedAt.toISOString());

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

    console.log('🟢 UpdateSessionNotesUseCase.execute() completed successfully');
    return true;
  }
}
