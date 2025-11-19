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
    onEditorRecreated?: EditorRecreateCallback,
    initialContent?: string
  ): Promise<Editor> {
    try {
      logger.info('Enabling collaboration for session:', config.sessionId);

      // Initialize collaboration manager if not already done
      if (!this.collaborationManager) {
        this.collaborationManager = new CollaborationManager();
      }

      // Start collaboration - this will create the Yjs doc and load saved state
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

      // Determine content to use
      const currentContent = currentEditor?.getHTML() || initialContent || '';
      logger.info('Content setup:', {
        hasCurrentEditor: !!currentEditor,
        hasInitialContent: !!initialContent,
        initialContentLength: initialContent?.length || 0,
        finalContentLength: currentContent.length
      });

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

      // Check if Yjs doc is empty (no saved state)
      const yjsXmlFragment = this.yjsDoc.getXmlFragment('default');
      const isYjsDocEmpty = yjsXmlFragment.length === 0;
      logger.info('Yjs doc state:', {
        isEmpty: isYjsDocEmpty,
        fragmentLength: yjsXmlFragment.length,
        hasContent: !!currentContent,
        contentPreview: currentContent.substring(0, 100)
      });

      // If Yjs doc is empty but we have initial content, populate it
      if (isYjsDocEmpty && currentContent) {
        logger.info('Initializing empty Yjs doc with existing content');

        // Create temporary editor WITHOUT collaboration to parse HTML
        const tempContainer = document.createElement('div');
        const nonCollabConfig = EditorConfigService.getConfig({
          placeholder: 'Loading...',
          // NO collaboration config - this lets the editor accept the content parameter
        });

        const tempEditor = new Editor({
          element: tempContainer,
          extensions: nonCollabConfig.extensions,
          content: currentContent,
          editorProps: EditorConfigService.getEditorProps(),
        });

        // Verify temp editor has content
        const tempEditorHTML = tempEditor.getHTML();
        logger.info('Non-collab temp editor HTML length:', tempEditorHTML.length);
        logger.info('Non-collab temp editor HTML preview:', tempEditorHTML.substring(0, 100));

        // Get the ProseMirror document from the temp editor
        const pmDoc = tempEditor.state.doc;
        logger.info('ProseMirror doc size:', pmDoc.nodeSize);

        // Now create a second temp editor WITH collaboration to populate Yjs doc
        const collabTempContainer = document.createElement('div');
        const collabTempEditor = new Editor({
          element: collabTempContainer,
          extensions: editorConfig.extensions, // This has Collaboration extension
          editorProps: EditorConfigService.getEditorProps(),
        });

        // Wait a moment for collaboration to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set the content from the first editor
        collabTempEditor.commands.setContent(tempEditorHTML);

        // Wait for sync to Yjs doc
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if Yjs doc now has content
        const yjsXmlFragmentAfter = this.yjsDoc.getXmlFragment('default');
        logger.info('Yjs doc after populating - fragmentLength:', yjsXmlFragmentAfter.length);

        // Destroy both temp editors
        tempEditor.destroy();
        tempContainer.remove();
        collabTempEditor.destroy();
        collabTempContainer.remove();

        logger.info('Temp editors created and destroyed, Yjs doc populated');
      } else if (!isYjsDocEmpty) {
        logger.info('Yjs doc already has content, skipping initialization');
      } else if (!currentContent) {
        logger.warn('No initial content to populate Yjs doc with');
      }

      // Create the actual collaborative editor
      const newEditor = new Editor({
        element: editorElement,
        extensions: editorConfig.extensions,
        // Don't pass content - it comes from Yjs doc
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
