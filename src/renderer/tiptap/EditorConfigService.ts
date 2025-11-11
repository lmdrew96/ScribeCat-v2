/**
 * EditorConfigService
 *
 * Centralized configuration for TipTap editor extensions and props.
 * Provides reusable editor configurations for study mode and main editors.
 */

import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';
import { Color, BackgroundColor, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Collaboration from '@tiptap/extension-collaboration';
import { DraggableImage } from './DraggableImageExtension.js';
import type { Editor, EditorOptions } from '@tiptap/core';

export interface EditorConfig {
  extensions: any[];
  editorProps?: Partial<EditorOptions['editorProps']>;
}

export interface CollaborationConfig {
  yjsDoc: any;
  enabled: boolean;
}

export class EditorConfigService {
  /**
   * Get standard editor extensions
   */
  public static getExtensions(config?: {
    placeholder?: string;
    collaboration?: CollaborationConfig;
  }): any[] {
    const yjsDoc = config?.collaboration?.yjsDoc;
    const placeholder = config?.placeholder || 'Start typing...';

    const extensions = [
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
        // Disable History when collaborating (Yjs handles undo/redo)
        history: yjsDoc ? false : undefined,
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        },
        underline: true,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Superscript,
      Subscript,
      Typography,
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
    ];

    // Add collaboration extensions if Yjs doc is provided
    if (yjsDoc) {
      extensions.push(
        Collaboration.configure({
          document: yjsDoc,
        })
        // NOTE: CollaborationCursor not yet available in TipTap v3
        // Will add cursor visualization when v3 support is released
      );
    }

    return extensions;
  }

  /**
   * Get editor props with keyboard handling
   */
  public static getEditorProps(editor?: Editor): Partial<EditorOptions['editorProps']> {
    return {
      attributes: {
        class: 'tiptap-content',
        spellcheck: 'true',
      },
      handleKeyDown: (view, event) => {
        // Handle Tab for list indentation
        if (event.key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) {
            // Shift+Tab: outdent (lift) list item
            return editor?.commands.liftListItem('listItem') || false;
          } else {
            // Tab: indent (sink) list item
            return editor?.commands.sinkListItem('listItem') || false;
          }
        }
        return false;
      },
    };
  }

  /**
   * Get full editor configuration
   */
  public static getConfig(options?: {
    placeholder?: string;
    collaboration?: CollaborationConfig;
    editor?: Editor;
  }): EditorConfig {
    return {
      extensions: this.getExtensions({
        placeholder: options?.placeholder,
        collaboration: options?.collaboration,
      }),
      editorProps: this.getEditorProps(options?.editor),
    };
  }
}
