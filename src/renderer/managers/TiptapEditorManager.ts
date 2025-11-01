/**
 * TiptapEditorManager
 * Manages the Tiptap editor instance with student-focused features
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';
import { TextStyle, Color, BackgroundColor, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';

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
  private strikeBtn: HTMLButtonElement;
  private superscriptBtn: HTMLButtonElement;
  private subscriptBtn: HTMLButtonElement;
  private colorBtn: HTMLButtonElement;
  private colorPalette: HTMLElement;
  private bgColorBtn: HTMLButtonElement;
  private bgColorPalette: HTMLElement;
  private fontSizeSelect: HTMLSelectElement;
  private alignLeftBtn: HTMLButtonElement;
  private alignCenterBtn: HTMLButtonElement;
  private alignRightBtn: HTMLButtonElement;
  private alignJustifyBtn: HTMLButtonElement;
  private heading1Btn: HTMLButtonElement;
  private heading2Btn: HTMLButtonElement;
  private bulletListBtn: HTMLButtonElement;
  private numberedListBtn: HTMLButtonElement;
  private linkBtn: HTMLButtonElement;
  private highlightBtn: HTMLButtonElement;
  private imageBtn: HTMLButtonElement;
  private imageInput: HTMLInputElement;
  private insertTableBtn: HTMLButtonElement;
  private tableToolbar: HTMLElement;
  private addRowBeforeBtn: HTMLButtonElement;
  private addRowAfterBtn: HTMLButtonElement;
  private addColBeforeBtn: HTMLButtonElement;
  private addColAfterBtn: HTMLButtonElement;
  private deleteRowBtn: HTMLButtonElement;
  private deleteColBtn: HTMLButtonElement;
  private deleteTableBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private clearFormatBtn: HTMLButtonElement;

  // Input prompt modal elements
  private inputPromptModal: HTMLElement;
  private inputPromptTitle: HTMLElement;
  private inputPromptLabel: HTMLElement;
  private inputPromptField: HTMLInputElement;
  private okInputPromptBtn: HTMLButtonElement;
  private cancelInputPromptBtn: HTMLButtonElement;
  private closeInputPromptBtn: HTMLButtonElement;

  constructor() {
    // Get editor container
    this.editorElement = document.getElementById('tiptap-editor') as HTMLElement;
    this.charCount = document.getElementById('char-count') as HTMLElement;
    this.wordCount = document.getElementById('word-count') as HTMLElement;

    // Get toolbar buttons
    this.boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
    this.italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
    this.underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
    this.strikeBtn = document.getElementById('strike-btn') as HTMLButtonElement;
    this.superscriptBtn = document.getElementById('superscript-btn') as HTMLButtonElement;
    this.subscriptBtn = document.getElementById('subscript-btn') as HTMLButtonElement;
    this.colorBtn = document.getElementById('color-btn') as HTMLButtonElement;
    this.colorPalette = document.getElementById('color-palette') as HTMLElement;
    this.bgColorBtn = document.getElementById('bg-color-btn') as HTMLButtonElement;
    this.bgColorPalette = document.getElementById('bg-color-palette') as HTMLElement;
    this.fontSizeSelect = document.getElementById('font-size-select') as HTMLSelectElement;
    this.alignLeftBtn = document.getElementById('align-left-btn') as HTMLButtonElement;
    this.alignCenterBtn = document.getElementById('align-center-btn') as HTMLButtonElement;
    this.alignRightBtn = document.getElementById('align-right-btn') as HTMLButtonElement;
    this.alignJustifyBtn = document.getElementById('align-justify-btn') as HTMLButtonElement;
    this.heading1Btn = document.getElementById('heading1-btn') as HTMLButtonElement;
    this.heading2Btn = document.getElementById('heading2-btn') as HTMLButtonElement;
    this.bulletListBtn = document.getElementById('bullet-list-btn') as HTMLButtonElement;
    this.numberedListBtn = document.getElementById('numbered-list-btn') as HTMLButtonElement;
    this.linkBtn = document.getElementById('link-btn') as HTMLButtonElement;
    this.highlightBtn = document.getElementById('highlight-btn') as HTMLButtonElement;
    this.imageBtn = document.getElementById('image-btn') as HTMLButtonElement;
    this.imageInput = document.getElementById('image-input') as HTMLInputElement;
    this.insertTableBtn = document.getElementById('insert-table-btn') as HTMLButtonElement;
    this.tableToolbar = document.getElementById('table-toolbar') as HTMLElement;
    this.addRowBeforeBtn = document.getElementById('add-row-before-btn') as HTMLButtonElement;
    this.addRowAfterBtn = document.getElementById('add-row-after-btn') as HTMLButtonElement;
    this.addColBeforeBtn = document.getElementById('add-col-before-btn') as HTMLButtonElement;
    this.addColAfterBtn = document.getElementById('add-col-after-btn') as HTMLButtonElement;
    this.deleteRowBtn = document.getElementById('delete-row-btn') as HTMLButtonElement;
    this.deleteColBtn = document.getElementById('delete-col-btn') as HTMLButtonElement;
    this.deleteTableBtn = document.getElementById('delete-table-btn') as HTMLButtonElement;
    this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
    this.clearFormatBtn = document.getElementById('clear-format-btn') as HTMLButtonElement;

    // Get input prompt modal elements
    this.inputPromptModal = document.getElementById('input-prompt-modal') as HTMLElement;
    this.inputPromptTitle = document.getElementById('input-prompt-title') as HTMLElement;
    this.inputPromptLabel = document.getElementById('input-prompt-label') as HTMLElement;
    this.inputPromptField = document.getElementById('input-prompt-field') as HTMLInputElement;
    this.okInputPromptBtn = document.getElementById('ok-input-prompt-btn') as HTMLButtonElement;
    this.cancelInputPromptBtn = document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement;
    this.closeInputPromptBtn = document.getElementById('close-input-prompt-btn') as HTMLButtonElement;
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
        Superscript,
        Subscript,
        Typography,
        TextStyle,
        Color,
        BackgroundColor,
        FontSize,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
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
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: {
            class: 'tiptap-image',
          },
          resize: {
            enabled: true,
            directions: ['top', 'right', 'bottom', 'left', 'top-right', 'top-left', 'bottom-right', 'bottom-left'],
            minWidth: 50,
            minHeight: 50,
            alwaysPreserveAspectRatio: true,
          },
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

    this.superscriptBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleSuperscript().run();
    });

    this.subscriptBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleSubscript().run();
    });

    this.strikeBtn.addEventListener('click', () => {
      this.editor?.chain().focus().toggleStrike().run();
    });

    // Color picker
    this.colorBtn.addEventListener('click', () => {
      this.colorPalette.classList.toggle('show');
    });

    // Color palette swatches (will be set up after HTML is created)
    this.setupColorPalette();

    // Background color picker
    this.bgColorBtn.addEventListener('click', () => {
      this.bgColorPalette.classList.toggle('show');
    });

    // Background color palette swatches (will be set up after HTML is created)
    this.setupBgColorPalette();

    // Font size
    this.fontSizeSelect.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        this.editor?.chain().focus().setFontSize(size).run();
      } else {
        this.editor?.chain().focus().unsetFontSize().run();
      }
    });

    // Text align
    this.alignLeftBtn.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('left').run();
    });

    this.alignCenterBtn.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('center').run();
    });

    this.alignRightBtn.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('right').run();
    });

    this.alignJustifyBtn.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('justify').run();
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

    // Image
    this.imageBtn.addEventListener('click', () => {
      this.imageInput.click();
    });

    this.imageInput.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    // Table
    this.insertTableBtn.addEventListener('click', () => {
      this.insertTable();
    });

    // Table toolbar
    this.addRowBeforeBtn.addEventListener('click', () => {
      this.editor?.chain().focus().addRowBefore().run();
    });

    this.addRowAfterBtn.addEventListener('click', () => {
      this.editor?.chain().focus().addRowAfter().run();
    });

    this.addColBeforeBtn.addEventListener('click', () => {
      this.editor?.chain().focus().addColumnBefore().run();
    });

    this.addColAfterBtn.addEventListener('click', () => {
      this.editor?.chain().focus().addColumnAfter().run();
    });

    this.deleteRowBtn.addEventListener('click', () => {
      this.editor?.chain().focus().deleteRow().run();
    });

    this.deleteColBtn.addEventListener('click', () => {
      this.editor?.chain().focus().deleteColumn().run();
    });

    this.deleteTableBtn.addEventListener('click', () => {
      this.editor?.chain().focus().deleteTable().run();
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
   * Show input prompt modal and return a promise that resolves with the input value
   */
  private showInputPrompt(title: string, label: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      // Set modal content
      this.inputPromptTitle.textContent = title;
      this.inputPromptLabel.textContent = label;
      this.inputPromptField.value = defaultValue;

      // Show modal
      this.inputPromptModal.classList.remove('hidden');

      // Focus the input field
      setTimeout(() => this.inputPromptField.focus(), 100);

      // Handle OK button
      const handleOk = () => {
        const value = this.inputPromptField.value.trim();
        cleanup();
        resolve(value || null);
      };

      // Handle Cancel button
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      // Handle Enter key
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      // Cleanup function
      const cleanup = () => {
        this.inputPromptModal.classList.add('hidden');
        this.okInputPromptBtn.removeEventListener('click', handleOk);
        this.cancelInputPromptBtn.removeEventListener('click', handleCancel);
        this.closeInputPromptBtn.removeEventListener('click', handleCancel);
        this.inputPromptField.removeEventListener('keydown', handleKeydown);
      };

      // Add event listeners
      this.okInputPromptBtn.addEventListener('click', handleOk);
      this.cancelInputPromptBtn.addEventListener('click', handleCancel);
      this.closeInputPromptBtn.addEventListener('click', handleCancel);
      this.inputPromptField.addEventListener('keydown', handleKeydown);
    });
  }

  /**
   * Toggle link - prompt for URL if not already a link
   */
  private async toggleLink(): Promise<void> {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('link').href;

    if (previousUrl) {
      // Remove link
      this.editor.chain().focus().unsetLink().run();
    } else {
      // Check if there's a selection
      const { from, to } = this.editor.state.selection;
      if (from === to) {
        // No text selected
        window.alert('Please select some text first before adding a link.');
        return;
      }

      // Add link
      const url = await this.showInputPrompt('Insert Link', 'URL:', 'https://');

      if (url && url !== 'https://') {
        this.editor
          .chain()
          .focus()
          .setLink({ href: url })
          .run();
      }
    }
  }

  /**
   * Set up color palette swatches
   */
  private setupColorPalette(): void {
    const colors = [
      '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
      '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000'
    ];

    colors.forEach(color => {
      const swatch = this.colorPalette.querySelector(`[data-color="${color}"]`) as HTMLElement;
      if (swatch) {
        swatch.addEventListener('click', () => {
          this.editor?.chain().focus().setColor(color).run();
          this.colorPalette.classList.remove('show');
        });
      }
    });
  }

  /**
   * Set up background color palette swatches
   */
  private setupBgColorPalette(): void {
    const colors = [
      '#FFFFFF', '#FFEB3B', '#FFCDD2', '#B3E5FC', '#C8E6C9',
      '#F8BBD0', '#FFE0B2', '#E1BEE7', '#D1C4E9', '#DCEDC8'
    ];

    colors.forEach(color => {
      const swatch = this.bgColorPalette.querySelector(`[data-color="${color}"]`) as HTMLElement;
      if (swatch) {
        swatch.addEventListener('click', () => {
          this.editor?.chain().focus().setBackgroundColor(color).run();
          this.bgColorPalette.classList.remove('show');
        });
      }
    });
  }

  /**
   * Insert table with user-specified dimensions
   */
  private async insertTable(): Promise<void> {
    const rowsStr = await this.showInputPrompt('Insert Table', 'Number of rows:', '3');
    if (!rowsStr) return;

    const colsStr = await this.showInputPrompt('Insert Table', 'Number of columns:', '3');
    if (!colsStr) return;

    const rows = parseInt(rowsStr);
    const cols = parseInt(colsStr);

    if (rows > 0 && cols > 0) {
      this.editor?.chain().focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    }
  }

  /**
   * Handle image upload
   */
  private async handleImageUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // For now, use base64 encoding
    // TODO: Implement server upload when endpoint is available
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      this.editor?.chain().focus().setImage({ src: base64 }).run();
    };

    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
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
    this.updateButtonState(this.strikeBtn, this.editor.isActive('strike'));
    this.updateButtonState(this.superscriptBtn, this.editor.isActive('superscript'));
    this.updateButtonState(this.subscriptBtn, this.editor.isActive('subscript'));

    // Text align
    this.updateButtonState(this.alignLeftBtn, this.editor.isActive({ textAlign: 'left' }));
    this.updateButtonState(this.alignCenterBtn, this.editor.isActive({ textAlign: 'center' }));
    this.updateButtonState(this.alignRightBtn, this.editor.isActive({ textAlign: 'right' }));
    this.updateButtonState(this.alignJustifyBtn, this.editor.isActive({ textAlign: 'justify' }));

    // Font size - update select value
    const currentFontSize = this.editor.getAttributes('textStyle').fontSize || '';
    this.fontSizeSelect.value = currentFontSize;

    // Headings
    this.updateButtonState(this.heading1Btn, this.editor.isActive('heading', { level: 1 }));
    this.updateButtonState(this.heading2Btn, this.editor.isActive('heading', { level: 2 }));

    // Lists
    this.updateButtonState(this.bulletListBtn, this.editor.isActive('bulletList'));
    this.updateButtonState(this.numberedListBtn, this.editor.isActive('orderedList'));

    // Link & Highlight
    this.updateButtonState(this.linkBtn, this.editor.isActive('link'));
    this.updateButtonState(this.highlightBtn, this.editor.isActive('highlight'));

    // Table toolbar visibility
    const isInTable = this.editor.isActive('table');
    this.tableToolbar.style.display = isInTable ? 'flex' : 'none';

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
