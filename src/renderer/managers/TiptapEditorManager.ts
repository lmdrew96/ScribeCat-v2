/**
 * TiptapEditorManager
 * Manages the Tiptap editor instance with student-focused features
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

export class TiptapEditorManager {
  private editor: Editor | null = null;
  private editorElement: HTMLElement;
  private charCount: HTMLElement;
  private wordCount: HTMLElement;
  private onContentChangeCallback?: () => void;

  // Toolbar buttons
  private boldBtn: HTMLButtonElement;
  private italicBtn: HTMLButtonElement;
  private underlineBtn: HTMLButtonElement;
  private heading1Btn: HTMLButtonElement;
  private heading2Btn: HTMLButtonElement;
  private bulletListBtn: HTMLButtonElement;
  private numberedListBtn: HTMLButtonElement;
  private linkBtn: HTMLButtonElement;
  private highlightBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private clearFormatBtn: HTMLButtonElement;

  constructor() {
    // Get editor container
    this.editorElement = document.getElementById('tiptap-editor') as HTMLElement;
    this.charCount = document.getElementById('char-count') as HTMLElement;
    this.wordCount = document.getElementById('word-count') as HTMLElement;

    // Get toolbar buttons
    this.boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
    this.italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
    this.underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
    this.heading1Btn = document.getElementById('heading1-btn') as HTMLButtonElement;
    this.heading2Btn = document.getElementById('heading2-btn') as HTMLButtonElement;
    this.bulletListBtn = document.getElementById('bullet-list-btn') as HTMLButtonElement;
    this.numberedListBtn = document.getElementById('numbered-list-btn') as HTMLButtonElement;
    this.linkBtn = document.getElementById('link-btn') as HTMLButtonElement;
    this.highlightBtn = document.getElementById('highlight-btn') as HTMLButtonElement;
    this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
    this.clearFormatBtn = document.getElementById('clear-format-btn') as HTMLButtonElement;
  }

  /**
   * Set callback for content changes (for auto-save)
   */
  setOnContentChangeCallback(callback: () => void): void {
    this.onContentChangeCallback = callback;
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
        }),
        Highlight.extend({
          addKeyboardShortcuts() {
            return {}; // Disable default Mod-Shift-h shortcut
          }
        }).configure({
          multicolor: false,
        }),
        Link.extend({
          addKeyboardShortcuts() {
            return {}; // Disable default Mod-k shortcut
          }
        }).configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
          },
        }),
        Placeholder.configure({
          placeholder: 'Start taking notes here...',
        }),
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap-content',
          spellcheck: 'true',
        },
      },
      onUpdate: () => {
        this.updateStats();
        this.updateButtonStates();
        // Call auto-save callback if registered
        if (this.onContentChangeCallback) {
          this.onContentChangeCallback();
        }
      },
      onSelectionUpdate: () => {
        this.updateButtonStates();
      },
    });

    this.setupToolbarListeners();
    this.updateStats();
  }

  /**
   * Set up toolbar button event listeners
   */
  private setupToolbarListeners(): void {
    if (!this.editor) return;

    // Text formatting
    this.boldBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleBold().run();
    });

    this.italicBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleItalic().run();
    });

    this.underlineBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleUnderline().run();
    });

    // Headings
    this.heading1Btn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHeading({ level: 1 }).run();
    });

    this.heading2Btn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHeading({ level: 2 }).run();
    });

    // Lists
    this.bulletListBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleBulletList().run();
    });

    this.numberedListBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleOrderedList().run();
    });

    // Link
    this.linkBtn.addEventListener('click', () => {
      this.toggleLink();
    });

    // Highlight
    this.highlightBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHighlight().run();
    });

    // History
    this.undoBtn.addEventListener('click', () => {
      this.editor?.chain().focus().undo().run();
    });

    this.redoBtn.addEventListener('click', () => {
      this.editor?.chain().focus().redo().run();
    });

    // Clear formatting
    this.clearFormatBtn.addEventListener('click', () => {
      this.editor?.chain().focus().clearNodes().unsetAllMarks().run();
    });
  }

  /**
   * Toggle link - prompt for URL if not already a link
   */
  private toggleLink(): void {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('link').href;
    
    if (previousUrl) {
      // Remove link
      this.editor.chain().focus().unsetLink().run();
    } else {
      // Add link
      const url = window.prompt('Enter URL:', 'https://');
      
      if (url && url !== 'https://') {
        this.editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }
    }
  }

  /**
   * Update button active states based on current selection
   */
  private updateButtonStates(): void {
    if (!this.editor) return;

    // Text formatting
    this.updateButtonState(this.boldBtn, this.editor.isActive('bold'));
    this.updateButtonState(this.italicBtn, this.editor.isActive('italic'));
    this.updateButtonState(this.underlineBtn, this.editor.isActive('underline'));

    // Headings
    this.updateButtonState(this.heading1Btn, this.editor.isActive('heading', { level: 1 }));
    this.updateButtonState(this.heading2Btn, this.editor.isActive('heading', { level: 2 }));

    // Lists
    this.updateButtonState(this.bulletListBtn, this.editor.isActive('bulletList'));
    this.updateButtonState(this.numberedListBtn, this.editor.isActive('orderedList'));

    // Link & Highlight
    this.updateButtonState(this.linkBtn, this.editor.isActive('link'));
    this.updateButtonState(this.highlightBtn, this.editor.isActive('highlight'));

    // History buttons
    this.undoBtn.disabled = !this.editor.can().undo();
    this.redoBtn.disabled = !this.editor.can().redo();
  }

  /**
   * Update individual button state
   */
  private updateButtonState(button: HTMLButtonElement, isActive: boolean): void {
    if (isActive) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }

  /**
   * Update character and word count
   */
  private updateStats(): void {
    if (!this.editor) return;

    const text = this.editor.getText();
    
    // Character count
    const chars = text.length;
    this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
    
    // Word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
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
    this.updateStats();
  }

  /**
   * Append HTML content to notes
   */
  appendToNotes(html: string): void {
    if (!this.editor) return;
    
    const currentContent = this.editor.getHTML();
    this.editor.commands.setContent(currentContent + html);
    this.updateStats();
  }

  /**
   * Clear all notes
   */
  clearNotes(): void {
    this.editor?.commands.clearContent();
    this.updateStats();
  }

  /**
   * Focus the editor
   */
  focus(): void {
    this.editor?.commands.focus();
  }

  /**
   * Destroy the editor instance
   */
  destroy(): void {
    this.editor?.destroy();
  }
}
