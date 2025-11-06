import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

/**
 * UpdateSessionUseCase
 *
 * Updates session properties like title, notes, tags, and course information.
 */
export class UpdateSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private supabaseSessionRepository?: ISessionRepository
  ) {}

  /**
   * Update session properties
   * @param sessionId - The session ID to update
   * @param updates - Object containing properties to update
   * @param currentUserId - Current user ID for auto-claiming orphaned sessions
   * @returns true if successful, false otherwise
   */
  async execute(
    sessionId: string,
    updates: {
      title?: string;
      notes?: string;
      tags?: string[];
      courseId?: string;
      courseTitle?: string;
      courseNumber?: string;
    },
    currentUserId?: string | null
  ): Promise<boolean> {
    console.log('🔵 UpdateSessionUseCase.execute() called');
    console.log('  sessionId:', sessionId);
    console.log('  updates:', {
      hasTitle: updates.title !== undefined,
      hasNotes: updates.notes !== undefined,
      notesLength: updates.notes?.length || 0,
      hasTags: updates.tags !== undefined,
      hasCourse: updates.courseId !== undefined || updates.courseTitle !== undefined || updates.courseNumber !== undefined
    });
    console.log('  currentUserId:', currentUserId);
    console.log('  has supabaseSessionRepository:', !!this.supabaseSessionRepository);

    try {
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
        console.error(`  ❌ Session not found: ${sessionId}`);
        return false;
      }

      console.log('  📝 Session found, applying updates...');
      console.log('  Session details:');
      console.log('    - id:', session.id);
      console.log('    - userId:', session.userId);
      console.log('    - cloudId:', session.cloudId);
      console.log('    - permissionLevel:', session.permissionLevel);

      // Auto-claim orphaned sessions
      // If the session has no userId (orphaned) and we have a current user, claim it
      if (!session.userId && currentUserId) {
        console.log(`  🏷️ Auto-claiming orphaned session ${sessionId} for user ${currentUserId}`);
        session.userId = currentUserId;
      }

      // Apply updates using entity methods to ensure updatedAt is set
      if (updates.title !== undefined) {
        console.log('  ✏️ Updating title...');
        session.updateTitle(updates.title);
      }

      if (updates.notes !== undefined) {
        console.log('  ✏️ Updating notes (length:', updates.notes.length, ')...');
        session.updateNotes(updates.notes);
      }

      if (updates.tags !== undefined) {
        console.log('  ✏️ Updating tags...');
        session.tags = updates.tags;
        session.updatedAt = new Date();
      }

      // Update course information if any course field is provided
      if (updates.courseId !== undefined || updates.courseTitle !== undefined || updates.courseNumber !== undefined) {
        console.log('  ✏️ Updating course information...');
        session.updateCourse(
          updates.courseId !== undefined ? updates.courseId : session.courseId,
          updates.courseTitle !== undefined ? updates.courseTitle : session.courseTitle,
          updates.courseNumber !== undefined ? updates.courseNumber : session.courseNumber
        );
      }

      console.log('  ✅ All updates applied, updatedAt:', session.updatedAt.toISOString());

      // Determine if this is a cloud session
      // A session is a cloud session if it has a cloudId (whether found locally or in cloud)
      const isCloudSession = !!session.cloudId && !!this.supabaseSessionRepository;
      console.log('  🔍 Cloud session detection:');
      console.log('    - has cloudId:', !!session.cloudId);
      console.log('    - has supabaseRepo:', !!this.supabaseSessionRepository);
      console.log('    - isCloudSession:', isCloudSession);

      // Save the updated session to the appropriate repository
      if (isCloudSession && this.supabaseSessionRepository) {
        console.log('  💾 Persisting to CLOUD repository (Supabase)...');
        // Use update() instead of save() to preserve user_id and respect RLS policies
        await this.supabaseSessionRepository.update(session);
        console.log('  ✅ Successfully persisted to cloud repository');
      } else {
        console.log('  💾 Persisting to LOCAL repository (file system)...');
        await this.sessionRepository.save(session);
        console.log('  ✅ Successfully persisted to local repository');
      }

      console.log(`🟢 UpdateSessionUseCase completed successfully: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('  ❌ Error updating session:', error);
      return false;
    }
  }
}
