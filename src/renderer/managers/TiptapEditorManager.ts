/**
 * TiptapEditorManager (Refactored)
 *
 * Manages the Tiptap editor with student-focused features.
 * Delegates functionality to specialized managers.
 */

import { TiptapEditorCore } from './tiptap/TiptapEditorCore.js';
import { TiptapToolbarManager } from './tiptap/TiptapToolbarManager.js';
import { TiptapContentManager } from './tiptap/TiptapContentManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('TiptapEditorManager');

export class TiptapEditorManager {
  private editorCore: TiptapEditorCore;
  private toolbarManager: TiptapToolbarManager;
  private contentManager: TiptapContentManager;

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

    // Initial stats update
    this.contentManager.updateStats();
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
   * Destroy the editor instance
   */
  destroy(): void {
    this.toolbarManager.destroy();
    this.editorCore.destroy();
    logger.info('TiptapEditorManager destroyed');
  }
}
