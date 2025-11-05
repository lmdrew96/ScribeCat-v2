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
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeNotesEditorManager');

export class StudyModeNotesEditorManager {
  private notesEditor: Editor | null = null;
  private isEditingNotes: boolean = false;
  private currentEditingSessionId: string | null = null;
  private collaborationAdapter: CollaborationAdapter;
  private toolbar: StudyModeEditorToolbar;

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

    // Create editor container if needed
    const notesEditContent = document.querySelector('.notes-edit-content') as HTMLElement;
    if (notesEditContent && !notesEditContent.querySelector('.study-editor-container')) {
      notesEditContent.innerHTML = this.toolbar.getHTML();
    }

    // Initialize editor if needed
    const editorElement = document.getElementById('study-notes-editor');
    if (editorElement && !this.notesEditor) {
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
    } else if (this.notesEditor) {
      // Update existing editor content
      this.notesEditor.commands.setContent(currentNotes || '');
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
   * Exit notes edit mode and update UI
   */
  private exitNotesEditMode(notesContent: string): void {
    this.isEditingNotes = false;
    this.currentEditingSessionId = null;
    this.toggleEditMode(false);
    this.toolbar.cleanup();

    // Update notes display
    const notesDisplay = document.querySelector('.notes-display');
    if (notesDisplay) {
      notesDisplay.innerHTML = notesContent || '<p style="color: #999;">No notes yet.</p>';
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
   * Destroy editor and cleanup
   */
  destroy(): void {
    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }
    this.toolbar.cleanup();
    this.isEditingNotes = false;
    this.currentEditingSessionId = null;
  }
}
