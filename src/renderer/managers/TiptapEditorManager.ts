/**
 * TiptapEditorManager (Refactored)
 *
 * Manages the Tiptap editor with student-focused features.
 * Delegates functionality to specialized managers.
 */

import { TiptapEditorCore } from './tiptap/TiptapEditorCore.js';
import { TiptapToolbarManager } from './tiptap/TiptapToolbarManager.js';
import { TiptapContentManager } from './tiptap/TiptapContentManager.js';
import { FloatingToolbar } from '../components/FloatingToolbar.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('TiptapEditorManager');

export class TiptapEditorManager {
  private editorCore: TiptapEditorCore;
  private toolbarManager: TiptapToolbarManager;
  private contentManager: TiptapContentManager;
  private floatingToolbar: FloatingToolbar;

  constructor() {
    // Get UI elements
    const editorElement = document.getElementById('tiptap-editor') as HTMLElement;
    const charCount = document.getElementById('char-count') as HTMLElement;
    const wordCount = document.getElementById('word-count') as HTMLElement;

    // Initialize core editor
    this.editorCore = new TiptapEditorCore(editorElement);

    // Initialize managers
    this.toolbarManager = new TiptapToolbarManager(this.editorCore);
    this.contentManager = new TiptapContentManager(this.editorCore, charCount, wordCount);
    this.floatingToolbar = new FloatingToolbar();
  }

  /**
   * Initialize the Tiptap editor
   */
  initialize(): void {
    this.editorCore.initialize();

    // Set up callbacks
    this.editorCore.setOnUpdateCallback(() => {
      this.contentManager.updateStats();
      this.toolbarManager.updateButtonStates();
    });

    this.editorCore.setOnSelectionUpdateCallback(() => {
      this.toolbarManager.updateButtonStates();
    });

    // Set up toolbar
    this.toolbarManager.setupToolbarListeners();

    // Floating toolbar disabled - regular toolbar is always visible
    // const editor = this.editorCore.getEditor();
    // if (editor) {
    //   this.floatingToolbar.initialize(editor);
    //   this.setupFloatingToolbarActions();
    //
    //   // Set callback to check if floating toolbar should show
    //   // Don't show if full toolbar is visible
    //   this.floatingToolbar.setShouldShowCallback(() => {
    //     const fullToolbar = document.querySelector('.formatting-toolbar');
    //     return !fullToolbar?.classList.contains('visible');
    //   });
    // }

    // Initial stats update
    this.contentManager.updateStats();
  }

  /**
   * Setup floating toolbar actions
   */
  private setupFloatingToolbarActions(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    this.floatingToolbar.registerActions([
      {
        id: 'bold',
        icon: 'B',
        title: 'Bold',
        shortcut: 'Cmd+B',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold')
      },
      {
        id: 'italic',
        icon: 'I',
        title: 'Italic',
        shortcut: 'Cmd+I',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic')
      },
      {
        id: 'underline',
        icon: 'U',
        title: 'Underline',
        shortcut: 'Cmd+U',
        action: () => editor.chain().focus().toggleUnderline().run(),
        isActive: () => editor.isActive('underline')
      },
      {
        id: 'strike',
        icon: 'S',
        title: 'Strikethrough',
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike')
      },
      {
        id: 'heading1',
        icon: 'H1',
        title: 'Heading 1',
        shortcut: 'Cmd+Shift+H',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 })
      },
      {
        id: 'heading2',
        icon: 'H2',
        title: 'Heading 2',
        shortcut: 'Cmd+Alt+H',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 })
      },
      {
        id: 'bulletList',
        icon: '•',
        title: 'Bullet List',
        shortcut: 'Cmd+Shift+8',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList')
      },
      {
        id: 'numberedList',
        icon: '1.',
        title: 'Numbered List',
        shortcut: 'Cmd+Shift+7',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList')
      },
      {
        id: 'link',
        icon: '🔗',
        title: 'Add Link',
        action: () => {
          // Trigger the link button in the main toolbar
          const linkBtn = document.getElementById('link-btn') as HTMLButtonElement;
          linkBtn?.click();
        },
        isActive: () => editor.isActive('link')
      }
    ]);
  }

  /**
   * Set callback for content changes (for auto-save)
   */
  setOnContentChangeCallback(callback: () => void): void {
    this.editorCore.setOnContentChangeCallback(callback);
  }

  /**
   * Get current notes as HTML
   */
  getNotesHTML(): string {
    return this.editorCore.getNotesHTML();
  }

  /**
   * Get current notes as plain text
   */
  getNotesText(): string {
    return this.editorCore.getNotesText();
  }

  /**
   * Set notes content (HTML)
   */
  setNotesHTML(html: string): void {
    this.editorCore.setNotesHTML(html);
    this.contentManager.updateStats();
  }

  /**
   * Append HTML content to notes
   */
  appendToNotes(html: string): void {
    this.editorCore.appendToNotes(html);
    this.contentManager.updateStats();
  }

  /**
   * Clear all notes
   */
  clearNotes(): void {
    this.editorCore.clearNotes();
    this.contentManager.updateStats();
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.editorCore.focus();
  }

  /**
   * Get the underlying editor instance
   * Useful for advanced operations like inserting content at cursor
   */
  getEditor() {
    return this.editorCore.getEditor();
  }

  /**
   * Destroy the editor instance
   */
  destroy(): void {
    this.toolbarManager.destroy();
    this.editorCore.destroy();
    logger.info('TiptapEditorManager destroyed');
  }
}
