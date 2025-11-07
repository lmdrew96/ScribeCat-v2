/**
 * StudyModeManager (Refactored)
 *
 * Coordinates the Study Mode view for reviewing past recording sessions.
 * Delegates functionality to specialized managers for better separation of concerns.
 */

import { Session } from '../../domain/entities/Session.js';
import { AIClient } from '../ai/AIClient.js';
import { SessionPlaybackManager } from '../services/SessionPlaybackManager.js';
import { AISummaryManager } from '../services/AISummaryManager.js';
import { ExportCoordinator } from '../services/ExportCoordinator.js';
import { ShareModal } from '../components/ShareModal.js';
import { SessionSharingManager } from './SessionSharingManager.js';
import { CollaborationManager } from './collaboration/CollaborationManager.js';
import { AuthManager } from './AuthManager.js';
import { StudyModeSessionListManager } from './study-mode/StudyModeSessionListManager.js';
import { StudyModeDetailViewManager } from './study-mode/StudyModeDetailViewManager.js';
import { StudyModeNotesEditorManager } from './study-mode/StudyModeNotesEditorManager.js';
import { StudyModeAIToolsManager } from './study-mode/StudyModeAIToolsManager.js';
import { StudyModeEventCoordinator } from './study-mode/StudyModeEventCoordinator.js';
import { StudyModeDataTransformer } from './study-mode/StudyModeDataTransformer.js';
import { SessionReorderModal } from './study-mode/SessionReorderModal.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('StudyModeManager');

export class StudyModeManager {
  // Core managers
  private sessionListManager: StudyModeSessionListManager;
  private detailViewManager: StudyModeDetailViewManager;
  private notesEditorManager: StudyModeNotesEditorManager;
  private aiToolsManager: StudyModeAIToolsManager;
  private eventCoordinator: StudyModeEventCoordinator;
  private dataTransformer: StudyModeDataTransformer;
  private reorderModal: SessionReorderModal;

  // Services
  private authManager: AuthManager;
  private aiClient: AIClient;
  private sessionPlaybackManager: SessionPlaybackManager;
  private aiSummaryManager: AISummaryManager;
  private exportCoordinator: ExportCoordinator;
  private shareModal: ShareModal;
  private sessionSharingManager: SessionSharingManager;
  private collaborationManager: CollaborationManager | null = null;

  // State
  private isActive: boolean = false;
  private sessions: Session[] = [];
  private sharedWithMeSessions: any[] = [];

  // UI Elements
  private studyModeView: HTMLElement;
  private recordModeView: HTMLElement;
  private studyModeBtn: HTMLButtonElement;
  private backToRecordBtn: HTMLButtonElement;
  private syncNowBtn: HTMLButtonElement;
  private sessionListContainer: HTMLElement;
  private sessionDetailContainer: HTMLElement;

  constructor(authManager: AuthManager) {
    // Get UI elements
    this.studyModeView = document.getElementById('study-mode-view') as HTMLElement;
    this.recordModeView = document.querySelector('.main-content') as HTMLElement;
    this.studyModeBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
    this.backToRecordBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
    this.syncNowBtn = document.getElementById('sync-now-btn') as HTMLButtonElement;
    this.sessionListContainer = document.getElementById('session-list') as HTMLElement;
    this.sessionDetailContainer = document.getElementById('session-detail') as HTMLElement;

    // Initialize services
    this.authManager = authManager;
    this.aiClient = new AIClient();
    this.sessionPlaybackManager = new SessionPlaybackManager();
    this.aiSummaryManager = new AISummaryManager();
    this.exportCoordinator = new ExportCoordinator();
    this.shareModal = new ShareModal();
    this.sessionSharingManager = new SessionSharingManager();

    // Initialize specialized managers
    this.sessionListManager = new StudyModeSessionListManager(this.sessionListContainer);
    this.detailViewManager = new StudyModeDetailViewManager(
      this.sessionDetailContainer,
      this.sessionPlaybackManager
    );
    this.notesEditorManager = new StudyModeNotesEditorManager();
    this.aiToolsManager = new StudyModeAIToolsManager(this.aiSummaryManager);
    this.eventCoordinator = new StudyModeEventCoordinator();
    this.dataTransformer = new StudyModeDataTransformer();
    this.reorderModal = new SessionReorderModal();

    this.initializeEventListeners();
    this.setupAuthListener();
  }

  /**
   * Initialize the study mode manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize ShareModal
      this.shareModal.initialize();

      await this.loadSessions();
      logger.info('StudyModeManager initialized');
    } catch (error) {
      logger.error('Failed to initialize StudyModeManager', error);
    }
  }

  /**
   * Set up auth state change listener to reload sessions when user logs in/out
   */
  private setupAuthListener(): void {
    this.authManager.onAuthStateChange((user) => {
      logger.info('Auth state changed in StudyModeManager', user ? `User ${user.id}` : 'No user');

      // Clear current sessions
      this.sessions = [];
      this.sharedWithMeSessions = [];

      // Clear detail view
      if (this.sessionDetailContainer) {
        this.sessionDetailContainer.innerHTML = '';
      }

      // Stop any active collaboration
      if (this.collaborationManager) {
        this.collaborationManager.disconnect();
        this.collaborationManager = null;
      }

      // Reload sessions if study mode is active
      if (this.isActive) {
        this.loadSessions().then(() => {
          this.sessionListManager.render();
        });
      }
    });
  }

  /**
   * Initialize event listeners using EventCoordinator
   */
  private initializeEventListeners(): void {
    this.eventCoordinator.setup({
      // Button click events
      buttons: [
        { element: this.studyModeBtn, handler: () => this.show() },
        { element: this.backToRecordBtn, handler: () => this.hide() },
        { element: this.syncNowBtn, handler: () => this.handleSyncNow() }
      ],

      // Document-level custom events
      documentEvents: [
        { eventName: 'openSharedSessions', handler: () => this.showSharedSessionsOnly() }
      ],

      // Session list custom events
      customEvents: [
        { element: this.sessionListContainer, eventName: 'hideStudyMode', handler: () => this.hide() },
        { element: this.sessionListContainer, eventName: 'openSessionDetail', handler: (detail) => this.openSessionDetail(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'exportSession', handler: (detail) => this.exportSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'deleteSession', handler: (detail) => this.deleteSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'leaveSession', handler: (detail) => this.leaveSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'startTitleEdit', handler: (detail) => this.startTitleEdit(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'shareSession', handler: (detail) => this.openShareModal(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'openReorderModal', handler: (detail) => this.handleOpenReorderModal(detail.sessions) },
        // Detail view custom events
        { element: this.sessionDetailContainer, eventName: 'backToList', handler: () => this.backToSessionList() },
        { element: this.sessionDetailContainer, eventName: 'exportSession', handler: (detail) => this.exportSession(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'deleteSession', handler: (detail) => this.deleteSession(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'startTitleEdit', handler: (detail) => this.startDetailTitleEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'startCourseEdit', handler: (detail) => this.startCourseEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'shareSession', handler: (detail) => this.openShareModal(detail.sessionId) },
        // Notes editing custom events
        { element: this.sessionDetailContainer, eventName: 'startNotesEdit', handler: (detail) => this.startNotesEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'saveNotesEdit', handler: (detail) => this.saveNotesEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'cancelNotesEdit', handler: () => this.cancelNotesEdit() }
      ],

      // Callback-based events
      callbacks: [
        { register: (handler) => this.sessionListManager.onBulkExport(handler), handler: (sessionIds) => this.handleBulkExport(sessionIds) },
        { register: (handler) => this.sessionListManager.onBulkDelete(handler), handler: (sessionIds) => this.handleBulkDelete(sessionIds) }
      ]
    });
  }

  /**
   * Load all sessions from storage
   */
  private async loadSessions(): Promise<void> {
    try {
      const result = await window.scribeCat.session.list();

      if (result.success) {
        // Handle both 'data' and 'sessions' response formats
        const sessionsData = result.data || result.sessions || [];
        // Convert JSON data to Session instances with methods
        this.sessions = sessionsData.map((data: any) => Session.fromJSON(data));
        this.sessionListManager.setSessions(this.sessions);
        logger.info(`Loaded ${this.sessions.length} sessions`);
      } else {
        logger.error('Failed to load sessions', result.error);
        this.sessions = [];
        this.sessionListManager.setSessions([]);
      }

      // Load shared sessions
      await this.loadSharedWithMeSessions();
    } catch (error) {
      logger.error('Error loading sessions', error);
      this.sessions = [];
      this.sessionListManager.setSessions([]);
    }
  }

  /**
   * Show study mode view
   */
  public async show(): Promise<void> {
    // Reload sessions to get latest data
    await this.loadSessions();

    // Hide record mode, show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');

    // Update button state
    this.studyModeBtn.classList.add('active');

    // Reset title to "Study Mode"
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.textContent = '📚 Study Mode';
    }

    // Populate course filter
    this.sessionListManager.populateCourseFilter();

    // Render session list
    this.sessionListManager.render();

    this.isActive = true;
    logger.info('Study mode activated');
  }

  /**
   * Hide study mode view
   */
  public hide(): void {
    // Clear AI Chat study mode context
    const aiManager = window.aiManager;
    if (aiManager) {
      aiManager.clearStudyModeContext();
    }

    // Show record mode, hide study mode
    this.studyModeView.classList.add('hidden');
    this.recordModeView.classList.remove('hidden');

    // Update button state
    this.studyModeBtn.classList.remove('active');

    this.isActive = false;
    logger.info('Study mode deactivated');
  }

  /**
   * Open session detail view
   */
  private async openSessionDetail(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      // Show user-friendly message
      alert('This session is no longer available. It may have been deleted by its owner.');
      // Reload sessions to remove stale entries
      await this.loadSessions();
      return;
    }

    // Set AI Chat context to this session's data
    const aiManager = window.aiManager;
    if (aiManager) {
      // Check if this is a multi-session study set
      const isMultiSession = session.isMultiSessionStudySet && session.isMultiSessionStudySet();

      let transcriptionText: string;
      const notesText = session.notes || '';

      if (isMultiSession) {
        // Load child sessions dynamically
        const childSessionIds = session.getChildSessionIds();
        const result = await (window as any).scribeCat.session.list();
        const allSessions = result.sessions.map((s: any) => Session.fromJSON(s));
        const childSessions = childSessionIds
          .map(id => allSessions.find(s => s.id === id))
          .filter(s => s !== null && s !== undefined);

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

        transcriptionText = transcriptionParts.join('\n');

        // Create session metadata array
        const sessionMetadata = childSessions.map((childSession, index) => ({
          id: childSession.id,
          title: childSession.title,
          index: index + 1
        }));

        aiManager.setStudyModeContext(transcriptionText, notesText, true, sessionMetadata);
      } else {
        // Single session - use existing transcription
        transcriptionText = session.transcription?.fullText || '';
        aiManager.setStudyModeContext(transcriptionText, notesText);
      }
    }

    // Hide session list, show detail view
    this.sessionListContainer.classList.add('hidden');
    this.sessionDetailContainer.classList.remove('hidden');

    // Check if session is editable (owned by current user)
    const isEditable = this.isSessionEditable(session);
    await this.detailViewManager.render(session, isEditable);

    // Initialize AI tools (after render completes so DOM is ready)
    this.aiToolsManager.initialize(session);

    logger.info(`Opened session detail: ${sessionId}`);
  }

  /**
   * Check if a session is editable by the current user
   */
  private isSessionEditable(session: Session): boolean {
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
   * Back to session list
   */
  private backToSessionList(): void {
    // Clear AI Chat context when going back to list
    const aiManager = window.aiManager;
    if (aiManager) {
      aiManager.clearStudyModeContext();
    }

    // Hide detail view, show list view
    this.sessionDetailContainer.classList.add('hidden');
    this.sessionListContainer.classList.remove('hidden');
  }

  /**
   * Start editing a session title
   */
  private startTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const titleElement = document.querySelector(`.session-title[data-session-id="${sessionId}"]`) as HTMLElement;
    if (!titleElement) return;

    const currentTitle = session.title;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input';
    input.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      font-size: 18px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;

    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();

      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });

          if (result.success) {
            // Update local session
            session.title = newTitle;
            logger.info('Title updated successfully');
          } else {
            logger.error('Failed to update title', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error updating title', error);
          alert('An error occurred while updating the title.');
        }
      }

      // Re-render the session list
      this.sessionListManager.render();
    };

    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.sessionListManager.render();
      }
    });
  }

  /**
   * Start editing title in detail view
   */
  private startDetailTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const titleElement = document.querySelector('.session-detail-title') as HTMLElement;
    if (!titleElement) return;

    const currentTitle = session.title;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input-detail';
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      font-size: 28px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;

    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();

      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });

          if (result.success) {
            // Update local session
            session.title = newTitle;
            logger.info('Title updated successfully');

            // Update the session list to show the change immediately
            this.sessionListManager.render();
          } else {
            logger.error('Failed to update title', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error updating title', error);
          alert('An error occurred while updating the title.');
        }
      }

      // Re-render the detail view
      const isEditable = this.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);
    };

    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const isEditable = this.isSessionEditable(session);
        this.detailViewManager.render(session, isEditable);
      }
    });
  }

  /**
   * Start course editing for detail view
   */
  private async startCourseEdit(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    // Access the global course manager
    const courseManager = (window as any).courseManager;
    if (!courseManager) {
      logger.error('CourseManager not available');
      return;
    }

    // Get modal elements
    const modal = document.getElementById('course-select-modal') as HTMLElement;
    const dropdown = document.getElementById('course-select-dropdown') as HTMLSelectElement;
    const okBtn = document.getElementById('ok-course-select-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-course-select-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('close-course-select-btn') as HTMLButtonElement;

    if (!modal || !dropdown || !okBtn || !cancelBtn || !closeBtn) {
      logger.error('Course selection modal elements not found');
      return;
    }

    // Load courses and populate dropdown
    await courseManager.loadCourses();
    const courses = courseManager.getCourses();

    // Clear existing options
    dropdown.innerHTML = '';

    // Add "No Course Selected" option
    const noCourseOption = document.createElement('option');
    noCourseOption.value = '';
    noCourseOption.textContent = 'No Course Selected';
    dropdown.appendChild(noCourseOption);

    // Add available courses
    courses.forEach((course: any) => {
      const option = document.createElement('option');
      option.value = course.id;

      // Handle both API format and extension format
      const code = course.code || course.courseNumber;
      const title = course.title || course.courseTitle;
      const displayText = code ? `${code} - ${title || 'Untitled'}` : title || 'Untitled Course';

      option.textContent = displayText;
      option.dataset.courseTitle = title;
      option.dataset.courseNumber = code;
      dropdown.appendChild(option);
    });

    // Add "Other..." option
    const otherOption = document.createElement('option');
    otherOption.value = 'custom-other';
    otherOption.textContent = 'Other...';
    dropdown.appendChild(otherOption);

    // Set current selection
    if (session.courseId) {
      dropdown.value = session.courseId;
    } else {
      dropdown.value = '';
    }

    // Show modal
    modal.classList.remove('hidden');
    dropdown.focus();

    // Handle dropdown change for custom option
    const handleDropdownChange = async () => {
      if (dropdown.value === 'custom-other') {
        // Show custom course prompt
        const customValue = await showCustomCoursePrompt();

        if (customValue !== null) {
          // Create a temporary custom course option
          const customId = `custom-${Date.now()}`;
          const customOption = document.createElement('option');
          customOption.value = customId;
          customOption.textContent = customValue || 'Other';
          customOption.dataset.courseTitle = customValue || 'Other';
          customOption.dataset.courseNumber = '';
          customOption.dataset.custom = 'true';

          // Insert before "Other..." option
          dropdown.insertBefore(customOption, otherOption);
          dropdown.value = customId;
        } else {
          // User cancelled, reset to previous value
          dropdown.value = session.courseId || '';
        }
      }
    };

    // Custom course prompt helper
    const showCustomCoursePrompt = (): Promise<string | null> => {
      return new Promise((resolve) => {
        const inputModal = document.getElementById('input-prompt-modal') as HTMLElement;
        const inputTitle = document.getElementById('input-prompt-title') as HTMLElement;
        const inputLabel = document.getElementById('input-prompt-label') as HTMLElement;
        const inputField = document.getElementById('input-prompt-field') as HTMLInputElement;
        const inputOkBtn = document.getElementById('ok-input-prompt-btn') as HTMLButtonElement;
        const inputCancelBtn = document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement;
        const inputCloseBtn = document.getElementById('close-input-prompt-btn') as HTMLButtonElement;

        inputTitle.textContent = 'Custom Course';
        inputLabel.textContent = 'Course title or category (optional):';
        inputField.value = '';
        inputField.placeholder = 'e.g., Study Session, Personal Notes, Research...';

        inputModal.classList.remove('hidden');
        inputField.focus();

        const handleInputOk = () => {
          const value = inputField.value.trim();
          inputCleanup();
          resolve(value);
        };

        const handleInputCancel = () => {
          inputCleanup();
          resolve(null);
        };

        const handleInputKeydown = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleInputOk();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            handleInputCancel();
          }
        };

        const inputCleanup = () => {
          inputModal.classList.add('hidden');
          inputOkBtn.removeEventListener('click', handleInputOk);
          inputCancelBtn.removeEventListener('click', handleInputCancel);
          inputCloseBtn.removeEventListener('click', handleInputCancel);
          inputField.removeEventListener('keydown', handleInputKeydown);
        };

        inputOkBtn.addEventListener('click', handleInputOk);
        inputCancelBtn.addEventListener('click', handleInputCancel);
        inputCloseBtn.addEventListener('click', handleInputCancel);
        inputField.addEventListener('keydown', handleInputKeydown);
      });
    };

    // Handle OK button
    const handleOk = async () => {
      const selectedValue = dropdown.value;
      const selectedOption = dropdown.options[dropdown.selectedIndex];

      let courseId: string | undefined;
      let courseTitle: string | undefined;
      let courseNumber: string | undefined;

      if (selectedValue && selectedValue !== '') {
        courseId = selectedValue;
        courseTitle = selectedOption.dataset.courseTitle || selectedOption.textContent || undefined;
        courseNumber = selectedOption.dataset.courseNumber || undefined;
      }

      try {
        // Update session course via IPC
        const result = await window.scribeCat.session.update(sessionId, {
          courseId,
          courseTitle,
          courseNumber
        });

        if (result.success) {
          // Update local session
          session.courseId = courseId;
          session.courseTitle = courseTitle;
          session.courseNumber = courseNumber;
          logger.info('Course updated successfully');

          // Re-render the detail view
          const isEditable = this.isSessionEditable(session);
          this.detailViewManager.render(session, isEditable);

          // Update the session list to show the change immediately
          this.sessionListManager.render();
        } else {
          logger.error('Failed to update course', result.error);
          alert(`Failed to update course: ${result.error}`);
        }
      } catch (error) {
        logger.error('Error updating course', error);
        alert('An error occurred while updating the course.');
      }

      cleanup();
    };

    // Handle cancel
    const handleCancel = () => {
      cleanup();
    };

    // Cleanup function
    const cleanup = () => {
      modal.classList.add('hidden');
      dropdown.removeEventListener('change', handleDropdownChange);
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      closeBtn.removeEventListener('click', handleCancel);
    };

    // Add event listeners
    dropdown.addEventListener('change', handleDropdownChange);
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
  }

  /**
   * Start editing notes
   */
  private startNotesEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.notesEditorManager.startNotesEdit(sessionId, session.notes || '');
    }
  }

  /**
   * Save edited notes
   */
  private async saveNotesEdit(sessionId: string): Promise<void> {
    if (!this.notesEditorManager.isEditing()) {
      return;
    }

    const updatedNotes = this.notesEditorManager.getNotesHTML();

    try {
      // Update session notes via IPC
      const result = await window.scribeCat.session.update(sessionId, { notes: updatedNotes });

      if (result.success) {
        // Update local session
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
          session.notes = updatedNotes;
        }

        logger.info('Notes updated successfully');

        // Exit edit mode and update view
        this.notesEditorManager.updateNotesView(updatedNotes);
      } else {
        logger.error('Failed to update notes', result.error);
        alert(`Failed to save notes: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error updating notes', error);
      alert('An error occurred while saving notes.');
    }
  }

  /**
   * Cancel notes editing
   */
  private cancelNotesEdit(): void {
    if (confirm('Discard your changes?')) {
      const session = this.sessions.find(s => s.id === this.notesEditorManager.getCurrentEditingSessionId()!);
      if (session) {
        this.notesEditorManager.updateNotesView(session.notes || '');
      }
    }
  }

  /**
   * Export a session
   */
  private exportSession(sessionId: string): void {
    this.exportCoordinator.exportSession(sessionId, this.sessions);
  }

  /**
   * Delete a session with confirmation
   */
  private async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Delete "${session.title}"?\n\n` +
      `This will move the session to trash where it will be kept for 30 days.\n` +
      `You can restore it from trash before it's permanently deleted.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Delete via IPC
      const result = await window.scribeCat.session.delete(sessionId);

      if (result.success) {
        logger.info('Session deleted successfully');
        // Refresh the session list
        await this.loadSessions();
        this.sessionListManager.render();
      } else {
        logger.error('Failed to delete session', result.error);
        alert(`Failed to delete session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error deleting session', error);
      alert('An error occurred while deleting the session.');
    }
  }

  /**
   * Leave a shared session (remove yourself as recipient)
   */
  private async leaveSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    // Find the share ID for this session
    const share = this.sharedWithMeSessions.find((s: any) => s.sessions?.id === sessionId);
    if (!share) {
      logger.error('Share not found for session', sessionId);
      alert('Could not find share information for this session.');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Leave "${session.title}"?\n\n` +
      `This session will be removed from your list. The owner can share it with you again later.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Revoke access via IPC
      const result = await this.sessionSharingManager.revokeAccess(share.id);

      if (result.success) {
        logger.info('Left shared session successfully');
        // Refresh the session list
        await this.loadSessions();
        this.sessionListManager.render();
      } else {
        logger.error('Failed to leave session', result.error);
        alert(`Failed to leave session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error leaving session', error);
      alert('An error occurred while leaving the session.');
    }
  }

  /**
   * Handle bulk export
   */
  private handleBulkExport(sessionIds: Set<string>): void {
    const bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.exportCoordinator.handleBulkExport(
      sessionIds,
      this.sessions,
      bulkExportBtn,
      {
        onBulkExportComplete: () => {
          this.sessionListManager.clearSelection();
        }
      }
    );
  }

  /**
   * Handle bulk delete
   */
  private async handleBulkDelete(sessionIds: Set<string>): Promise<void> {
    const sessionIdsArray = Array.from(sessionIds);

    if (sessionIdsArray.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Delete ${sessionIdsArray.length} session${sessionIdsArray.length > 1 ? 's' : ''}?\n\n` +
      `This will move the sessions to trash where they will be kept for 30 days.\n` +
      `You can restore them from trash before they're permanently deleted.`
    );

    if (!confirmed) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      // Delete each session
      for (const sessionId of sessionIdsArray) {
        try {
          const result = await window.scribeCat.session.delete(sessionId);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.error(`Failed to delete session ${sessionId}`, result.error);
          }
        } catch (error) {
          failCount++;
          logger.error(`Error deleting session ${sessionId}`, error);
        }
      }

      // Show result
      if (failCount === 0) {
        logger.info(`Successfully deleted ${successCount} session(s)`);
      } else {
        alert(`Deleted ${successCount} session(s).\nFailed to delete ${failCount} session(s).`);
      }

      // Clear selection and refresh
      this.sessionListManager.clearSelection();
      await this.loadSessions();
      this.sessionListManager.render();

    } catch (error) {
      logger.error('Error during bulk delete', error);
      alert('An error occurred during bulk delete.');
    }
  }

  /**
   * Load sessions shared with the current user
   */
  private async loadSharedWithMeSessions(): Promise<void> {
    try {
      const result = await this.sessionSharingManager.getSharedWithMe();
      logger.info('getSharedWithMe result:', {
        success: result.success,
        hasData: !!result.sessions,
        sessionCount: result.sessions?.length || 0,
        firstShare: result.sessions?.[0]
      });

      if (result.success && result.sessions) {
        this.sharedWithMeSessions = result.sessions;
        logger.info(`Loaded ${this.sharedWithMeSessions.length} shared sessions`);

        // Transform shared session data using DataTransformer
        const sharedSessionsData = this.dataTransformer.transformSharedSessions(this.sharedWithMeSessions);

        // Merge with owned sessions
        const allSessions = this.dataTransformer.mergeSessions(this.sessions, sharedSessionsData);
        this.sessions = allSessions;
        this.sessionListManager.setSessions(allSessions);
      } else {
        logger.warn('No shared sessions data or unsuccessful result:', {
          success: result.success,
          error: result.error,
          sessionsLength: result.sessions?.length
        });
        this.sharedWithMeSessions = [];
      }
    } catch (error) {
      logger.error('Error loading shared sessions:', error);
      this.sharedWithMeSessions = [];
    }
  }

  /**
   * Open share modal for a session
   */
  private openShareModal(sessionId: string): void {
    if (this.shareModal) {
      this.shareModal.open(sessionId);
    } else {
      logger.error('ShareModal not available');
      alert('Share feature is not available');
    }
  }

  /**
   * Handle opening the reorder modal for creating a multi-session study set
   */
  private handleOpenReorderModal(sessions: Session[]): void {
    this.reorderModal.show(sessions, (orderedSessionIds, title) => {
      this.createMultiSessionStudySet(orderedSessionIds, title);
    });
  }

  /**
   * Create a multi-session study set
   */
  private async createMultiSessionStudySet(sessionIds: string[], title: string): Promise<void> {
    try {
      logger.info('Creating multi-session study set', { sessionIds, title });

      // Call IPC to create the study set
      const result = await (window as any).scribeCat.session.createMultiSessionStudySet(sessionIds, title);

      if (result.success) {
        logger.info('Multi-session study set created successfully', result.session);

        // Refresh the session list to show the new study set
        await this.loadSessions();
        this.sessionListManager.render();

        // Show success notification
        alert(`Study set "${title}" created successfully! 📚`);

        // Optionally, open the newly created study set
        if (result.session?.id) {
          await this.openSessionDetail(result.session.id);
        }
      } else {
        const errorMsg = (result as any).error || 'Unknown error';
        logger.error('Failed to create multi-session study set:', errorMsg);
        alert(`Failed to create study set: ${errorMsg}`);
      }
    } catch (error) {
      logger.error('Error creating multi-session study set', error);
      alert('An error occurred while creating the study set.');
    }
  }

  /**
   * Check if study mode is active
   */
  public isStudyModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Refresh session list
   */
  public async refresh(): Promise<void> {
    await this.loadSessions();
    if (this.isActive) {
      this.sessionListManager.render();
    }
  }

  /**
   * Handle sync now button click
   */
  private async handleSyncNow(): Promise<void> {
    // Check if user is authenticated
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) {
      alert('Please sign in to sync your sessions');
      return;
    }

    // Disable button and show syncing state
    this.syncNowBtn.disabled = true;
    this.syncNowBtn.classList.add('syncing');

    try {
      logger.info('Starting manual cloud sync...');

      // Call sync API
      const result = await window.scribeCat.sync.syncAllFromCloud();

      if (result.success) {
        logger.info(`Sync completed: ${result.count} sessions downloaded`);

        // Show success feedback
        if (result.count > 0) {
          this.showSyncFeedback(`Synced ${result.count} session${result.count === 1 ? '' : 's'} from cloud`, 'success');
        } else {
          this.showSyncFeedback('Already up to date', 'success');
        }

        // Refresh the session list
        await this.refresh();
      } else {
        logger.error('Sync failed:', result.error);
        this.showSyncFeedback(`Sync failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      logger.error('Error during sync:', error);
      this.showSyncFeedback(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      // Re-enable button and remove syncing state
      this.syncNowBtn.disabled = false;
      this.syncNowBtn.classList.remove('syncing');
    }
  }

  /**
   * Show sync feedback notification
   */
  private showSyncFeedback(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      font-size: 14px;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  /**
   * Show only shared sessions
   */
  private async showSharedSessionsOnly(): Promise<void> {
    // Load sessions first
    await this.loadSessions();

    // Filter to show only shared sessions using DataTransformer
    const sharedOnly = this.dataTransformer.filterSharedOnly(this.sessions);

    // Show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');
    this.studyModeBtn.classList.add('active');

    // Update title to "Shared Sessions"
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.textContent = '👥 Shared Sessions';
    }

    // Set filtered sessions
    this.sessionListManager.setSessions(sharedOnly);
    this.sessionListManager.populateCourseFilter();
    this.sessionListManager.render();

    this.isActive = true;
    logger.info('Study mode activated with shared sessions filter');
  }
}
