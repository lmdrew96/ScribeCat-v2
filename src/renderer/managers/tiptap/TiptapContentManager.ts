/**
 * TiptapContentManager
 *
 * Manages character/word count statistics for the editor.
 */

import type { TiptapEditorCore } from './TiptapEditorCore.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('TiptapContentManager');

export class TiptapContentManager {
  private editorCore: TiptapEditorCore;
  private charCount: HTMLElement;
  private wordCount: HTMLElement;

  constructor(editorCore: TiptapEditorCore, charCount: HTMLElement, wordCount: HTMLElement) {
    this.editorCore = editorCore;
    this.charCount = charCount;
    this.wordCount = wordCount;
  }

  /**
   * Update character and word count
   */
  updateStats(): void {
    const text = this.editorCore.getNotesText();

    // Character count
    const chars = text.length;
    this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;

    // Word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;

    logger.debug(`Stats updated: ${chars} chars, ${words} words`);
  }
}
