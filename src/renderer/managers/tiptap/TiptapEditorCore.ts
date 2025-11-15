/**
 * TiptapEditorCore
 *
 * Core editor initialization and configuration.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';
import { TextStyle, Color, BackgroundColor, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { DraggableImage } from '../../tiptap/DraggableImageExtension.js';
import { DraggableTextBox } from '../../tiptap/DraggableTextBoxExtension.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('TiptapEditorCore');

export class TiptapEditorCore {
  private editor: Editor | null = null;
  private editorElement: HTMLElement;
  private onContentChangeCallback?: () => void;
  private onUpdateCallback?: () => void;
  private onSelectionUpdateCallback?: () => void;

  constructor(editorElement: HTMLElement) {
    this.editorElement = editorElement;
  }

  /**
   * Initialize the Tiptap editor
   */
  initialize(): void {
    this.editor = new Editor({
      element: this.editorElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2],
          },
          bulletList: {
            keepMarks: true,
            keepAttributes: false,
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false,
          },
          listItem: {
            HTMLAttributes: {
              class: 'tiptap-list-item',
            },
          },
          link: {
            openOnClick: false,
            HTMLAttributes: {
              class: 'editor-link',
            },
          },
          underline: true,
        }),
        Placeholder.configure({
          placeholder: 'Start taking notes here...',
        }),
        Superscript,
        Subscript,
        Typography,
        TextStyle,
        Color,
        BackgroundColor,
        FontSize,
        TextAlign.configure({
          types: ['heading', 'paragraph', 'image', 'table'],
          alignments: ['left', 'center', 'right', 'justify'],
          defaultAlignment: 'left',
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: 'tiptap-table',
          },
        }),
        TableRow,
        TableCell,
        TableHeader,
        DraggableImage.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'tiptap-image',
          },
        }),
        DraggableTextBox,
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap-content',
          spellcheck: 'true',
        },
        handleKeyDown: (view, event) => {
          // Handle Tab key
          if (event.key === 'Tab') {
            event.preventDefault();

            // Check if we're in a list item
            const { state } = view;
            const { $from } = state.selection;
            const isInList = $from.node(-1)?.type.name === 'listItem';

            if (isInList) {
              // In lists: use list-specific indentation
              if (event.shiftKey) {
                return this.editor?.commands.liftListItem('listItem') || false;
              } else {
                return this.editor?.commands.sinkListItem('listItem') || false;
              }
            } else {
              // In regular text: insert tab spaces
              if (!event.shiftKey) {
                this.editor?.commands.insertContent('    '); // 4 spaces
                return true;
              }
            }
          }
          return false;
        },
      },
      onUpdate: () => {
        if (this.onUpdateCallback) {
          this.onUpdateCallback();
        }
        if (this.onContentChangeCallback) {
          this.onContentChangeCallback();
        }
      },
      onSelectionUpdate: () => {
        if (this.onSelectionUpdateCallback) {
          this.onSelectionUpdateCallback();
        }
      },
    });
  }

  /**
   * Set callback for content changes (for auto-save)
   */
  setOnContentChangeCallback(callback: () => void): void {
    this.onContentChangeCallback = callback;
  }

  /**
   * Set callback for update events
   */
  setOnUpdateCallback(callback: () => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * Set callback for selection update events
   */
  setOnSelectionUpdateCallback(callback: () => void): void {
    this.onSelectionUpdateCallback = callback;
  }

  /**
   * Get editor instance
   */
  getEditor(): Editor | null {
    return this.editor;
  }

  /**
   * Get current notes as HTML
   */
  getNotesHTML(): string {
    return this.editor?.getHTML() || '';
  }

  /**
   * Get current notes as plain text
   */
  getNotesText(): string {
    return this.editor?.getText() || '';
  }

  /**
   * Set notes content (HTML)
   */
  setNotesHTML(html: string): void {
    this.editor?.commands.setContent(html);
  }

  /**
   * Append HTML content to notes
   */
  appendToNotes(html: string): void {
    if (!this.editor) return;

    const currentContent = this.editor.getHTML();
    this.editor.commands.setContent(currentContent + html);
  }

  /**
   * Clear all notes
   */
  clearNotes(): void {
    this.editor?.commands.clearContent();
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.editor?.commands.focus();
  }

  /**
   * Check if editor can undo
   */
  canUndo(): boolean {
    return this.editor?.can().undo() || false;
  }

  /**
   * Check if editor can redo
   */
  canRedo(): boolean {
    return this.editor?.can().redo() || false;
  }

  /**
   * Check if format is active
   */
  isActive(name: string, attributes?: Record<string, any>): boolean {
    return this.editor?.isActive(name, attributes) || false;
  }

  /**
   * Get attributes for a mark/node
   */
  getAttributes(name: string): Record<string, any> {
    return this.editor?.getAttributes(name) || {};
  }

  /**
   * Get current selection
   */
  getSelection(): { from: number; to: number } | null {
    if (!this.editor) return null;
    return this.editor.state.selection;
  }

  /**
   * Execute editor command
   */
  chain() {
    return this.editor?.chain();
  }

  /**
   * Destroy the editor instance
   */
  destroy(): void {
    this.editor?.destroy();
    this.editor = null;
    logger.info('Tiptap editor destroyed');
  }
}
