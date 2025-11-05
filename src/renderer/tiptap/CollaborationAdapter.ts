/**
 * CollaborationAdapter
 *
 * Manages real-time collaboration for TipTap editors using Yjs.
 * Handles editor recreation when enabling/disabling collaboration.
 */

import { Editor } from '@tiptap/core';
import { CollaborationManager } from '../managers/collaboration/CollaborationManager.js';
import { EditorConfigService } from './EditorConfigService.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('CollaborationAdapter');

export interface CollaborationUserConfig {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
}

export interface EditorRecreateCallback {
  (editor: Editor): void;
}

export class CollaborationAdapter {
  private collaborationManager: CollaborationManager | null = null;
  private isCollaborating: boolean = false;
  private yjsDoc: any = null;

  /**
   * Enable collaboration
   */
  public async enable(
    config: CollaborationUserConfig,
    currentEditor: Editor | null,
    editorElement: HTMLElement,
    onEditorRecreated?: EditorRecreateCallback
  ): Promise<Editor> {
    try {
      logger.info('Enabling collaboration for session:', config.sessionId);

      // Initialize collaboration manager if not already done
      if (!this.collaborationManager) {
        this.collaborationManager = new CollaborationManager();
      }

      // Start collaboration - this will create the Yjs doc
      this.yjsDoc = await this.collaborationManager.startCollaboration({
        sessionId: config.sessionId,
        userId: config.userId,
        userName: config.userName,
        userEmail: config.userEmail,
        avatarUrl: config.avatarUrl,
        isSharedSession: true,
        hasEditorPermission: true
      });

      this.isCollaborating = true;

      // Save current content if editor exists
      const currentContent = currentEditor?.getHTML() || '';

      // Recreate editor with collaboration extensions
      if (currentEditor) {
        currentEditor.destroy();
      }

      const editorConfig = EditorConfigService.getConfig({
        placeholder: 'Edit your notes here...',
        collaboration: {
          yjsDoc: this.yjsDoc,
          enabled: true,
        },
      });

      const newEditor = new Editor({
        element: editorElement,
        extensions: editorConfig.extensions,
        content: currentContent,
        editorProps: EditorConfigService.getEditorProps(),
      });

      // Call callback if provided (for toolbar setup, etc.)
      if (onEditorRecreated) {
        onEditorRecreated(newEditor);
      }

      logger.info('Collaboration enabled successfully');
      return newEditor;
    } catch (error) {
      logger.error('Failed to enable collaboration:', error);
      this.isCollaborating = false;
      throw error;
    }
  }

  /**
   * Disable collaboration
   */
  public async disable(
    currentEditor: Editor | null,
    editorElement: HTMLElement,
    onEditorRecreated?: EditorRecreateCallback
  ): Promise<Editor> {
    try {
      logger.info('Disabling collaboration');

      if (this.collaborationManager) {
        await this.collaborationManager.stopCollaboration();
        this.collaborationManager = null;
      }

      this.isCollaborating = false;
      this.yjsDoc = null;

      // Save current content
      const currentContent = currentEditor?.getHTML() || '';

      // Recreate editor without collaboration extensions
      if (currentEditor) {
        currentEditor.destroy();
      }

      const editorConfig = EditorConfigService.getConfig({
        placeholder: 'Edit your notes here...',
      });

      const newEditor = new Editor({
        element: editorElement,
        extensions: editorConfig.extensions,
        content: currentContent,
        editorProps: EditorConfigService.getEditorProps(),
      });

      // Call callback if provided (for toolbar setup, etc.)
      if (onEditorRecreated) {
        onEditorRecreated(newEditor);
      }

      logger.info('Collaboration disabled successfully');
      return newEditor;
    } catch (error) {
      logger.error('Failed to disable collaboration:', error);
      throw error;
    }
  }

  /**
   * Check if collaboration is currently active
   */
  public isActive(): boolean {
    return this.isCollaborating;
  }

  /**
   * Get collaboration manager
   */
  public getManager(): CollaborationManager | null {
    return this.collaborationManager;
  }

  /**
   * Get Yjs document
   */
  public getYjsDoc(): any {
    return this.yjsDoc;
  }
}
