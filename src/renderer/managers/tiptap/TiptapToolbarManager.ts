/**
 * TiptapToolbarManager
 *
 * Manages toolbar UI, event handlers, and button states.
 */

import type { TiptapEditorCore } from './TiptapEditorCore.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('TiptapToolbarManager');

export class TiptapToolbarManager {
  private editorCore: TiptapEditorCore;
  private paletteClickHandler: ((e: MouseEvent) => void) | null = null;

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

  constructor(editorCore: TiptapEditorCore) {
    this.editorCore = editorCore;

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
   * Set up toolbar button event listeners
   */
  setupToolbarListeners(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    // Text formatting
    this.boldBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleBold().run();
    });

    this.italicBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleItalic().run();
    });

    this.underlineBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleUnderline().run();
    });

    this.superscriptBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleSuperscript().run();
    });

    this.subscriptBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleSubscript().run();
    });

    this.strikeBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleStrike().run();
    });

    // Color picker
    this.colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.colorPalette.classList.toggle('show');
      this.bgColorPalette.classList.remove('show');
    });

    this.setupColorPalette();

    // Background color picker
    this.bgColorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bgColorPalette.classList.toggle('show');
      this.colorPalette.classList.remove('show');
    });

    this.setupBgColorPalette();

    // Close palettes when clicking outside
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
    }

    this.paletteClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#color-btn') &&
          !target.closest('#bg-color-btn') &&
          !target.closest('#color-palette') &&
          !target.closest('#bg-color-palette')) {
        this.colorPalette.classList.remove('show');
        this.bgColorPalette.classList.remove('show');
      }
    };
    document.addEventListener('click', this.paletteClickHandler);

    // Font size
    this.fontSizeSelect.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        this.editorCore.chain()?.focus().setFontSize(size).run();
      } else {
        this.editorCore.chain()?.focus().unsetFontSize().run();
      }
    });

    // Text align
    this.alignLeftBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().setTextAlign('left').run();
    });

    this.alignCenterBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().setTextAlign('center').run();
    });

    this.alignRightBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().setTextAlign('right').run();
    });

    this.alignJustifyBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().setTextAlign('justify').run();
    });

    // Headings
    this.heading1Btn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleHeading({ level: 1 }).run();
    });

    this.heading2Btn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleHeading({ level: 2 }).run();
    });

    // Lists
    this.bulletListBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleBulletList().run();
    });

    this.numberedListBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleOrderedList().run();
    });

    // Link
    this.linkBtn.addEventListener('click', () => {
      this.toggleLink();
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
      this.editorCore.chain()?.focus().addRowBefore().run();
    });

    this.addRowAfterBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().addRowAfter().run();
    });

    this.addColBeforeBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().addColumnBefore().run();
    });

    this.addColAfterBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().addColumnAfter().run();
    });

    this.deleteRowBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().deleteRow().run();
    });

    this.deleteColBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().deleteColumn().run();
    });

    this.deleteTableBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().deleteTable().run();
    });

    // History
    this.undoBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().undo().run();
    });

    this.redoBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().redo().run();
    });

    // Clear formatting
    this.clearFormatBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().clearNodes().unsetAllMarks().run();
    });

    logger.info('Toolbar listeners initialized');
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
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.editorCore.chain()?.focus().setColor(color).run();
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
        swatch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.editorCore.chain()?.focus().setBackgroundColor(color).run();
          this.bgColorPalette.classList.remove('show');
        });
      }
    });
  }

  /**
   * Show input prompt modal
   */
  private showInputPrompt(title: string, label: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      this.inputPromptTitle.textContent = title;
      this.inputPromptLabel.textContent = label;
      this.inputPromptField.value = defaultValue;

      this.inputPromptModal.classList.remove('hidden');

      setTimeout(() => this.inputPromptField.focus(), 100);

      const handleOk = () => {
        const value = this.inputPromptField.value.trim();
        cleanup();
        resolve(value || null);
      };

      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      const cleanup = () => {
        this.inputPromptModal.classList.add('hidden');
        this.okInputPromptBtn.removeEventListener('click', handleOk);
        this.cancelInputPromptBtn.removeEventListener('click', handleCancel);
        this.closeInputPromptBtn.removeEventListener('click', handleCancel);
        this.inputPromptField.removeEventListener('keydown', handleKeydown);
      };

      this.okInputPromptBtn.addEventListener('click', handleOk);
      this.cancelInputPromptBtn.addEventListener('click', handleCancel);
      this.closeInputPromptBtn.addEventListener('click', handleCancel);
      this.inputPromptField.addEventListener('keydown', handleKeydown);
    });
  }

  /**
   * Toggle link
   */
  private async toggleLink(): Promise<void> {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const previousUrl = this.editorCore.getAttributes('link').href;

    if (previousUrl) {
      this.editorCore.chain()?.focus().unsetLink().run();
    } else {
      const selection = this.editorCore.getSelection();
      if (selection && selection.from === selection.to) {
        window.alert('Please select some text first before adding a link.');
        return;
      }

      const url = await this.showInputPrompt('Insert Link', 'URL:', 'https://');

      if (url && url !== 'https://') {
        this.editorCore.chain()?.focus().setLink({ href: url }).run();
      }
    }
  }

  /**
   * Insert table
   */
  private async insertTable(): Promise<void> {
    const rowsStr = await this.showInputPrompt('Insert Table', 'Number of rows:', '3');
    if (!rowsStr) return;

    const colsStr = await this.showInputPrompt('Insert Table', 'Number of columns:', '3');
    if (!colsStr) return;

    const rows = parseInt(rowsStr);
    const cols = parseInt(colsStr);

    if (rows > 0 && cols > 0) {
      this.editorCore.chain()?.focus()
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

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;

      const img = new window.Image();
      img.onload = () => {
        const maxHeight = 100;
        let width = img.width;
        let height = img.height;

        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }

        this.editorCore.chain()?.focus().setImage({
          src: base64,
          width: Math.round(width)
        }).run();
      };
      img.src = base64;
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  /**
   * Update button active states
   */
  updateButtonStates(): void {
    // Text formatting
    this.updateButtonState(this.boldBtn, this.editorCore.isActive('bold'));
    this.updateButtonState(this.italicBtn, this.editorCore.isActive('italic'));
    this.updateButtonState(this.underlineBtn, this.editorCore.isActive('underline'));
    this.updateButtonState(this.strikeBtn, this.editorCore.isActive('strike'));
    this.updateButtonState(this.superscriptBtn, this.editorCore.isActive('superscript'));
    this.updateButtonState(this.subscriptBtn, this.editorCore.isActive('subscript'));

    // Text align
    this.updateButtonState(this.alignLeftBtn, this.editorCore.isActive({ textAlign: 'left' }));
    this.updateButtonState(this.alignCenterBtn, this.editorCore.isActive({ textAlign: 'center' }));
    this.updateButtonState(this.alignRightBtn, this.editorCore.isActive({ textAlign: 'right' }));
    this.updateButtonState(this.alignJustifyBtn, this.editorCore.isActive({ textAlign: 'justify' }));

    // Font size
    const currentFontSize = this.editorCore.getAttributes('textStyle').fontSize || '';
    this.fontSizeSelect.value = currentFontSize;

    // Headings
    this.updateButtonState(this.heading1Btn, this.editorCore.isActive('heading', { level: 1 }));
    this.updateButtonState(this.heading2Btn, this.editorCore.isActive('heading', { level: 2 }));

    // Lists
    this.updateButtonState(this.bulletListBtn, this.editorCore.isActive('bulletList'));
    this.updateButtonState(this.numberedListBtn, this.editorCore.isActive('orderedList'));

    // Link
    this.updateButtonState(this.linkBtn, this.editorCore.isActive('link'));

    // Table toolbar visibility
    const isInTable = this.editorCore.isActive('table');
    this.tableToolbar.style.display = isInTable ? 'flex' : 'none';

    // History buttons
    this.undoBtn.disabled = !this.editorCore.canUndo();
    this.redoBtn.disabled = !this.editorCore.canRedo();
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
   * Cleanup
   */
  destroy(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
      this.paletteClickHandler = null;
    }
    logger.info('Toolbar manager destroyed');
  }
}
