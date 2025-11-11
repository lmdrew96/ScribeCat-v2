/**
 * SessionNavigationManager
 *
 * Handles navigation between session list and detail views:
 * - Opening session detail (single and multi-session study sets)
 * - AI context management for current session
 * - Returning to session list
 * - Session permission checking
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { AuthManager } from '../AuthManager.js';
import { StudyModeDetailViewManager } from './StudyModeDetailViewManager.js';
import { StudyModeAIToolsManager } from './StudyModeAIToolsManager.js';
import { SessionSharingManager } from '../SessionSharingManager.js';
import { StudyModeNotesEditorManager } from './StudyModeNotesEditorManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SessionNavigationManager');

export class SessionNavigationManager {
  constructor(
    private authManager: AuthManager,
    private detailViewManager: StudyModeDetailViewManager,
    private aiToolsManager: StudyModeAIToolsManager,
    private sessionListContainer: HTMLElement,
    private sessionDetailContainer: HTMLElement,
    private sessionSharingManager: SessionSharingManager,
    private notesEditorManager: StudyModeNotesEditorManager
  ) {}

  /**
   * Open session detail view
   *
   * @param session - Session to open
   * @param allSessions - All available sessions (for multi-session sets)
   * @param onSessionNotFound - Callback if session is no longer available
   */
  public async openSessionDetail(
    session: Session | undefined,
    allSessions: Session[],
    onSessionNotFound?: () => Promise<void>
  ): Promise<void> {
    if (!session) {
      logger.error('Session not found');
      alert('This session is no longer available. It may have been deleted by its owner.');
      if (onSessionNotFound) {
        await onSessionNotFound();
      }
      return;
    }

    // Set AI Chat context to this session's data
    const aiManager = window.aiManager;
    if (aiManager) {
      await this.setupAIContext(session, allSessions, aiManager);
    }

    // Hide session list, show detail view
    this.sessionListContainer.classList.add('hidden');
    this.sessionDetailContainer.classList.remove('hidden');

    // Hide study mode controls bar in detail view
    const controlsBar = document.querySelector('.study-mode-controls') as HTMLElement;
    if (controlsBar) {
      controlsBar.classList.add('hidden');
    }

    // Check if session is editable (owned by current user)
    const isEditable = this.isSessionEditable(session);
    await this.detailViewManager.render(session, isEditable);

    // Initialize AI tools (after render completes so DOM is ready)
    this.aiToolsManager.initialize(session);

    // Auto-enable collaboration for editors
    await this.autoEnableCollaborationIfNeeded(session);

    logger.info(`Opened session detail: ${session.id}`);
  }

  /**
   * Set up AI context for the current session
   * Handles both single sessions and multi-session study sets
   */
  private async setupAIContext(
    session: Session,
    allSessions: Session[],
    aiManager: any
  ): Promise<void> {
    const isMultiSession = session.isMultiSessionStudySet && session.isMultiSessionStudySet();
    const notesText = session.notes || '';

    if (isMultiSession) {
      const transcriptionText = await this.loadMultiSessionTranscription(session, allSessions);

      // Create session metadata array
      const childSessionIds = session.getChildSessionIds();
      const childSessions = childSessionIds
        .map(id => allSessions.find(s => s.id === id))
        .filter((s): s is Session => s !== null && s !== undefined);

      const sessionMetadata = childSessions.map((childSession, index) => ({
        id: childSession.id,
        title: childSession.title,
        index: index + 1
      }));

      aiManager.setStudyModeContext(transcriptionText, notesText, true, sessionMetadata);
    } else {
      // Single session - use existing transcription
      const transcriptionText = session.transcription?.fullText || '';
      aiManager.setStudyModeContext(transcriptionText, notesText);
    }
  }

  /**
   * Load and merge transcriptions from all child sessions in a multi-session study set
   */
  private async loadMultiSessionTranscription(
    session: Session,
    allSessions: Session[]
  ): Promise<string> {
    // Load child sessions dynamically
    const childSessionIds = session.getChildSessionIds();
    const childSessions = childSessionIds
      .map(id => allSessions.find(s => s.id === id))
      .filter((s): s is Session => s !== null && s !== undefined);

    // Merge transcriptions from all child sessions
    const transcriptionParts: string[] = [];
    childSessions.forEach((childSession, index) => {
      // Add session header
      transcriptionParts.push(
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `SESSION ${index + 1}: ${childSession.title}\n` +
        `Date: ${childSession.createdAt.toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      );

      // Add transcription content
      if (childSession.transcription && childSession.transcription.fullText) {
        transcriptionParts.push(childSession.transcription.fullText);
      } else {
        transcriptionParts.push('(No transcription available for this session)');
      }
    });

    return transcriptionParts.join('\n');
  }

  /**
   * Check if a session is editable by the current user
   */
  public isSessionEditable(session: Session): boolean {
    const currentUser = this.authManager.getCurrentUser();

    // If no user is logged in, session is editable (local sessions)
    if (!currentUser) {
      return true;
    }

    // If session has no userId, it's a local session and editable
    if (!session.userId) {
      return true;
    }

    // Check if this is a shared session with edit permission
    if (session.permissionLevel === 'editor') {
      return true;
    }

    // Session is editable if owned by current user
    return session.userId === currentUser.id;
  }

  /**
   * Navigate back to session list view
   */
  public backToSessionList(): void {
    // Clear AI Chat context when going back to list
    const aiManager = window.aiManager;
    if (aiManager) {
      aiManager.clearStudyModeContext();
    }

    // Hide detail view, show list view
    this.sessionDetailContainer.classList.add('hidden');
    this.sessionListContainer.classList.remove('hidden');

    // Show study mode controls bar when back to list
    const controlsBar = document.querySelector('.study-mode-controls') as HTMLElement;
    if (controlsBar) {
      controlsBar.classList.remove('hidden');
    }
  }

  /**
   * Auto-enable collaboration if the user has editor permission
   */
  private async autoEnableCollaborationIfNeeded(session: Session): Promise<void> {
    try {
      const currentUser = this.authManager.getCurrentUser();

      // Only enable collaboration if user is logged in
      if (!currentUser) {
        logger.info('Skipping collaboration: no user logged in');
        return;
      }

      // Check session access permissions
      const accessInfo = this.sessionSharingManager.checkSessionAccess(session.id);

      logger.info('Session access check:', {
        sessionId: session.id,
        hasAccess: accessInfo.hasAccess,
        permission: accessInfo.permission,
        isShared: accessInfo.isShared
      });

      // Enable collaboration if user is owner or has editor permission
      if (accessInfo.permission === 'owner' || accessInfo.permission === 'editor') {
        logger.info('Auto-enabling collaboration for session:', session.id);

        await this.notesEditorManager.enableCollaboration({
          sessionId: session.id,
          userId: currentUser.id,
          userName: currentUser.fullName || currentUser.email,
          userEmail: currentUser.email,
          avatarUrl: currentUser.avatarUrl
        });

        logger.info('Collaboration enabled successfully');
      } else {
        logger.info('Skipping collaboration: user does not have edit permission');
      }
    } catch (error) {
      logger.error('Failed to auto-enable collaboration:', error);
      // Don't throw - collaboration failure shouldn't prevent viewing the session
    }
  }
}
