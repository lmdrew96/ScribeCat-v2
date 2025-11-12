/**
 * StudyModeNotesEditorManager (Refactored)
 *
 * Manages the Tiptap notes editor in study mode.
 * Uses extracted components for configuration, toolbar, and collaboration.
 */

import { Editor } from '@tiptap/core';
import { EditorConfigService } from '../../tiptap/EditorConfigService.js';
import { CollaborationAdapter } from '../../tiptap/CollaborationAdapter.js';
import { StudyModeEditorToolbar } from '../../tiptap/StudyModeEditorToolbar.js';
import { CollaboratorsPanel } from '../../components/CollaboratorsPanel.js';
import { CursorOverlay } from '../../components/CursorOverlay.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeNotesEditorManager');

export class StudyModeNotesEditorManager {
  private notesEditor: Editor | null = null;
  private isEditingNotes: boolean = false;
  private currentEditingSessionId: string | null = null;
  private collaborationAdapter: CollaborationAdapter;
  private toolbar: StudyModeEditorToolbar;
  private collaboratorsPanel: CollaboratorsPanel | null = null;
  private cursorOverlay: CursorOverlay | null = null;
  private collaborationStateUnsubscribe: (() => void) | null = null;

  constructor() {
    this.collaborationAdapter = new CollaborationAdapter();
    this.toolbar = new StudyModeEditorToolbar();
  }

  /**
   * Start editing notes
   */
  startNotesEdit(sessionId: string, currentNotes: string): void {
    this.isEditingNotes = true;
    this.currentEditingSessionId = sessionId;

    // Show/hide appropriate UI elements
    this.toggleEditMode(true);

    // Always recreate the editor container to ensure clean state
    const notesEditContent = document.querySelector('.notes-edit-content') as HTMLElement;
    if (notesEditContent) {
      notesEditContent.innerHTML = this.toolbar.getHTML();
    }

    // Initialize editor
    const editorElement = document.getElementById('study-notes-editor');
    if (editorElement) {
      const config = EditorConfigService.getConfig({
        placeholder: 'Edit your notes here...',
      });

      this.notesEditor = new Editor({
        element: editorElement,
        extensions: config.extensions,
        content: currentNotes || '',
        editorProps: config.editorProps,
      });

      // Setup toolbar
      this.toolbar.setup(this.notesEditor);
    }
  }

  /**
   * Toggle edit mode UI
   */
  private toggleEditMode(editing: boolean): void {
    const notesViewContent = document.querySelector('.notes-view-content') as HTMLElement;
    const notesEditContent = document.querySelector('.notes-edit-content') as HTMLElement;
    const editNotesBtn = document.querySelector('.edit-notes-btn') as HTMLElement;
    const editActions = document.querySelector('.notes-edit-actions') as HTMLElement;

    if (editing) {
      notesViewContent?.classList.add('hidden');
      notesEditContent?.classList.remove('hidden');
      editNotesBtn?.classList.add('hidden');
      editActions?.classList.remove('hidden');
    } else {
      notesViewContent?.classList.remove('hidden');
      notesEditContent?.classList.add('hidden');
      editNotesBtn?.classList.remove('hidden');
      editActions?.classList.add('hidden');
    }
  }

  /**
   * Get notes HTML
   */
  getNotesHTML(): string {
    return this.notesEditor?.getHTML() || '';
  }

  /**
   * Cancel notes editing
   */
  cancelNotesEdit(): void {
    this.exitNotesEditMode('');
  }

  /**
   * Update notes view after save
   */
  updateNotesView(notesContent: string): void {
    this.exitNotesEditMode(notesContent);
  }

  /**
   * Exit notes edit mode and update UI
   */
  private exitNotesEditMode(notesContent: string): void {
    this.isEditingNotes = false;
    this.currentEditingSessionId = null;
    this.toggleEditMode(false);
    this.toolbar.cleanup();

    // Destroy the editor instance to allow clean recreation
    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }

    // Update notes display
    const notesDisplay = document.querySelector('.notes-view-content');
    if (notesDisplay) {
      notesDisplay.innerHTML = notesContent || '<div class="empty-content">No notes available for this session.</div>';
    }
  }

  /**
   * Enable real-time collaboration
   */
  async enableCollaboration(config: {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    avatarUrl?: string;
  }): Promise<void> {
    try {
      logger.info('Enabling collaboration for session:', config.sessionId);

      const editorElement = document.getElementById('study-notes-editor');
      if (!editorElement) {
        throw new Error('Editor element not found');
      }

      // Use collaboration adapter to enable collaboration
      this.notesEditor = await this.collaborationAdapter.enable(
        config,
        this.notesEditor,
        editorElement,
        (newEditor) => {
          // Re-setup toolbar with new editor instance
          this.toolbar.setup(newEditor);
        }
      );

      // Initialize CollaboratorsPanel
      this.setupCollaboratorsPanel();

      // Initialize CursorOverlay
      this.setupCursorOverlay();

      logger.info('Collaboration enabled successfully');
    } catch (error) {
      logger.error('Failed to enable collaboration:', error);
      throw error;
    }
  }

  /**
   * Disable real-time collaboration
   */
  async disableCollaboration(): Promise<void> {
    try {
      logger.info('Disabling collaboration');

      const editorElement = document.getElementById('study-notes-editor');
      if (!editorElement) {
        throw new Error('Editor element not found');
      }

      // Use collaboration adapter to disable collaboration
      this.notesEditor = await this.collaborationAdapter.disable(
        this.notesEditor,
        editorElement,
        (newEditor) => {
          // Re-setup toolbar with new editor instance
          this.toolbar.setup(newEditor);
        }
      );

      // Cleanup CollaboratorsPanel
      this.cleanupCollaboratorsPanel();

      // Cleanup CursorOverlay
      this.cleanupCursorOverlay();

      logger.info('Collaboration disabled successfully');
    } catch (error) {
      logger.error('Failed to disable collaboration:', error);
      throw error;
    }
  }

  /**
   * Check if collaboration is currently active
   */
  isCollaborationActive(): boolean {
    return this.collaborationAdapter.isActive();
  }

  /**
   * Get collaboration manager
   */
  getCollaborationManager() {
    return this.collaborationAdapter.getManager();
  }

  /**
   * Check if currently editing notes
   */
  isEditing(): boolean {
    return this.isEditingNotes;
  }

  /**
   * Get current editing session ID
   */
  getCurrentEditingSessionId(): string | null {
    return this.currentEditingSessionId;
  }

  /**
   * Setup CollaboratorsPanel and wire to CollaborationManager
   */
  private setupCollaboratorsPanel(): void {
    try {
      const container = document.getElementById('collaborators-panel-container');
      if (!container) {
        logger.warn('Collaborators panel container not found');
        return;
      }

      // Create CollaboratorsPanel
      this.collaboratorsPanel = new CollaboratorsPanel('collaborators-panel-container');

      // Get CollaborationManager and subscribe to state changes
      const collaborationManager = this.collaborationAdapter.getManager();
      if (collaborationManager) {
        this.collaborationStateUnsubscribe = collaborationManager.onStateChange((state) => {
          if (this.collaboratorsPanel) {
            // Update collaborators list
            this.collaboratorsPanel.updateCollaborators(state.activeUsers);
            // Update connection state
            this.collaboratorsPanel.updateConnectionState(state.connectionState);
          }
        });

        // Show the panel
        this.collaboratorsPanel.show();
        logger.info('CollaboratorsPanel initialized and shown');
      } else {
        logger.warn('CollaborationManager not available');
      }
    } catch (error) {
      logger.error('Failed to setup CollaboratorsPanel:', error);
    }
  }

  /**
   * Cleanup CollaboratorsPanel
   */
  private cleanupCollaboratorsPanel(): void {
    // Unsubscribe from state changes
    if (this.collaborationStateUnsubscribe) {
      this.collaborationStateUnsubscribe();
      this.collaborationStateUnsubscribe = null;
    }

    // Hide and cleanup panel
    if (this.collaboratorsPanel) {
      this.collaboratorsPanel.hide();
      this.collaboratorsPanel = null;
    }

    logger.info('CollaboratorsPanel cleaned up');
  }

  /**
   * Setup CursorOverlay for real-time cursor tracking
   */
  private setupCursorOverlay(): void {
    try {
      // Get the Yjs provider's awareness for cursor tracking
      const collaborationManager = this.collaborationAdapter.getManager();
      const yjsDoc = this.collaborationAdapter.getYjsDoc();

      if (!collaborationManager || !yjsDoc) {
        logger.warn('Cannot setup cursor overlay: Collaboration not active');
        return;
      }

      // Get awareness from the Yjs provider
      const provider = collaborationManager.getState().provider;
      if (!provider) {
        logger.warn('Cannot setup cursor overlay: Provider not available');
        return;
      }

      const awareness = (provider as any).getAwareness?.();
      if (!awareness) {
        logger.warn('Cannot setup cursor overlay: Awareness not available');
        return;
      }

      // Create CursorOverlay instance
      this.cursorOverlay = new CursorOverlay('study-cursor-overlay', 'study-notes-editor');

      // Store reference to editor in DOM (required by CursorOverlay)
      const editorElement = document.getElementById('study-notes-editor') as any;
      if (editorElement && this.notesEditor) {
        editorElement.__tiptapEditor = this.notesEditor;
      }

      // Start tracking cursors
      this.cursorOverlay.start(awareness);

      logger.info('CursorOverlay initialized and started');
    } catch (error) {
      logger.error('Failed to setup CursorOverlay:', error);
    }
  }

  /**
   * Cleanup CursorOverlay
   */
  private cleanupCursorOverlay(): void {
    if (this.cursorOverlay) {
      this.cursorOverlay.stop();
      this.cursorOverlay = null;
      logger.info('CursorOverlay cleaned up');
    }
  }

  /**
   * Destroy editor and cleanup
   */
  destroy(): void {
    this.cleanupCollaboratorsPanel();
    this.cleanupCursorOverlay();

    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }
    this.toolbar.cleanup();
    this.isEditingNotes = false;
    this.currentEditingSessionId = null;
  }
}
