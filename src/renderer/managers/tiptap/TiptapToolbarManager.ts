/**
 * TiptapToolbarManager
 *
 * Orchestrates toolbar UI, event handlers, and button states.
 * Delegates to specialized modules for specific functionality.
 */

import type { TiptapEditorCore } from './TiptapEditorCore.js';
import { createLogger } from '../../../shared/logger.js';
import {
  ToolbarFormattingButtons,
  ToolbarColorPickers,
  ToolbarInsertButtons,
  ToolbarImageOptions,
  ToolbarTableButtons,
  type FormattingButtonElements,
  type ColorPickerElements,
  type InsertButtonElements,
  type InputPromptModal,
  type ImageOptionElements,
  type TableButtonElements,
} from './toolbar/index.js';

const logger = createLogger('TiptapToolbarManager');

export class TiptapToolbarManager {
  private editorCore: TiptapEditorCore;
  private paletteClickHandler: ((e: MouseEvent) => void) | null = null;

  // Formatting elements
  private formattingElements: FormattingButtonElements;

  // Color picker elements
  private colorPickerElements: ColorPickerElements;
  private colorPickers: ToolbarColorPickers | null = null;

  // Insert button elements
  private insertElements: InsertButtonElements;
  private promptModal: InputPromptModal;
  private insertButtons: ToolbarInsertButtons | null = null;

  // Image option elements
  private imageElements: ImageOptionElements;
  private imageOptions: ToolbarImageOptions | null = null;

  // Table elements
  private tableElements: TableButtonElements;

  constructor(editorCore: TiptapEditorCore) {
    this.editorCore = editorCore;

    // Initialize formatting elements
    this.formattingElements = {
      boldBtn: document.getElementById('bold-btn') as HTMLButtonElement,
      italicBtn: document.getElementById('italic-btn') as HTMLButtonElement,
      underlineBtn: document.getElementById('underline-btn') as HTMLButtonElement,
      strikeBtn: document.getElementById('strike-btn') as HTMLButtonElement,
      superscriptBtn: document.getElementById('superscript-btn') as HTMLButtonElement,
      subscriptBtn: document.getElementById('subscript-btn') as HTMLButtonElement,
      fontSizeSelect: document.getElementById('font-size-select') as HTMLSelectElement,
      alignLeftBtn: document.getElementById('align-left-btn') as HTMLButtonElement,
      alignCenterBtn: document.getElementById('align-center-btn') as HTMLButtonElement,
      alignRightBtn: document.getElementById('align-right-btn') as HTMLButtonElement,
      alignJustifyBtn: document.getElementById('align-justify-btn') as HTMLButtonElement,
      heading1Btn: document.getElementById('heading1-btn') as HTMLButtonElement,
      heading2Btn: document.getElementById('heading2-btn') as HTMLButtonElement,
      bulletListBtn: document.getElementById('bullet-list-btn') as HTMLButtonElement,
      numberedListBtn: document.getElementById('numbered-list-btn') as HTMLButtonElement,
      blockquoteBtn: document.getElementById('blockquote-btn') as HTMLButtonElement,
      codeBtn: document.getElementById('code-btn') as HTMLButtonElement,
      codeBlockBtn: document.getElementById('code-block-btn') as HTMLButtonElement,
      dividerBtn: document.getElementById('divider-btn') as HTMLButtonElement,
      undoBtn: document.getElementById('undo-btn') as HTMLButtonElement,
      redoBtn: document.getElementById('redo-btn') as HTMLButtonElement,
      clearFormatBtn: document.getElementById('clear-format-btn') as HTMLButtonElement,
    };

    // Initialize color picker elements
    this.colorPickerElements = {
      colorBtn: document.getElementById('color-btn') as HTMLButtonElement,
      colorPalette: document.getElementById('color-palette') as HTMLElement,
      bgColorBtn: document.getElementById('bg-color-btn') as HTMLButtonElement,
      bgColorPalette: document.getElementById('bg-color-palette') as HTMLElement,
    };

    // Initialize insert button elements
    this.insertElements = {
      emojiBtn: document.getElementById('emoji-btn') as HTMLButtonElement,
      linkBtn: document.getElementById('link-btn') as HTMLButtonElement,
      bookmarkBtn: document.getElementById('bookmark-btn') as HTMLButtonElement,
      imageBtn: document.getElementById('image-btn') as HTMLButtonElement,
      imageInput: document.getElementById('image-input') as HTMLInputElement,
      textboxBtn: document.getElementById('textbox-btn') as HTMLButtonElement,
      insertTableBtn: document.getElementById('insert-table-btn') as HTMLButtonElement,
    };

    // Initialize input prompt modal elements
    this.promptModal = {
      modal: document.getElementById('input-prompt-modal') as HTMLElement,
      title: document.getElementById('input-prompt-title') as HTMLElement,
      label: document.getElementById('input-prompt-label') as HTMLElement,
      field: document.getElementById('input-prompt-field') as HTMLInputElement,
      okBtn: document.getElementById('ok-input-prompt-btn') as HTMLButtonElement,
      cancelBtn: document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement,
      closeBtn: document.getElementById('close-input-prompt-btn') as HTMLButtonElement,
    };

    // Initialize image option elements
    this.imageElements = {
      anchorTypeBtn: document.getElementById('anchor-type-btn') as HTMLButtonElement,
      anchorTypePalette: document.getElementById('anchor-type-palette') as HTMLElement,
      anchorTypeDropdown: document.getElementById('anchor-type-dropdown') as HTMLElement,
      wrapTypeBtn: document.getElementById('wrap-type-btn') as HTMLButtonElement,
      wrapTypePalette: document.getElementById('wrap-type-palette') as HTMLElement,
      wrapTypeDropdown: document.getElementById('wrap-type-dropdown') as HTMLElement,
      imageAlignLeftBtn: document.getElementById('image-align-left-btn') as HTMLButtonElement,
      imageAlignRightBtn: document.getElementById('image-align-right-btn') as HTMLButtonElement,
      imageIndentBtn: document.getElementById('image-indent-btn') as HTMLButtonElement,
      imageOutdentBtn: document.getElementById('image-outdent-btn') as HTMLButtonElement,
    };

    // Initialize table elements
    this.tableElements = {
      tableToolbar: document.getElementById('table-toolbar') as HTMLElement,
      addRowBeforeBtn: document.getElementById('add-row-before-btn') as HTMLButtonElement,
      addRowAfterBtn: document.getElementById('add-row-after-btn') as HTMLButtonElement,
      addColBeforeBtn: document.getElementById('add-col-before-btn') as HTMLButtonElement,
      addColAfterBtn: document.getElementById('add-col-after-btn') as HTMLButtonElement,
      deleteRowBtn: document.getElementById('delete-row-btn') as HTMLButtonElement,
      deleteColBtn: document.getElementById('delete-col-btn') as HTMLButtonElement,
      deleteTableBtn: document.getElementById('delete-table-btn') as HTMLButtonElement,
    };

    // Move palettes to document.body to escape overflow clipping
    this.movePalettesToBody();
  }

  /**
   * Move palette elements to document.body to escape parent overflow clipping
   */
  private movePalettesToBody(): void {
    document.body.appendChild(this.colorPickerElements.colorPalette);
    document.body.appendChild(this.colorPickerElements.bgColorPalette);
    document.body.appendChild(this.imageElements.anchorTypePalette);
    document.body.appendChild(this.imageElements.wrapTypePalette);
    logger.info('Moved palettes to document.body to escape overflow clipping');
  }

  /**
   * Position a palette element relative to a button using fixed positioning
   */
  positionPaletteRelativeToButton(button: HTMLElement, palette: HTMLElement): void {
    const buttonRect = button.getBoundingClientRect();
    const top = buttonRect.bottom + 6;
    const left = buttonRect.left;

    palette.style.top = `${top}px`;
    palette.style.left = `${left}px`;

    requestAnimationFrame(() => {
      const paletteRect = palette.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (paletteRect.right > viewportWidth) {
        const adjustedLeft = viewportWidth - paletteRect.width - 10;
        palette.style.left = `${Math.max(10, adjustedLeft)}px`;
      }

      if (paletteRect.bottom > viewportHeight) {
        const adjustedTop = buttonRect.top - paletteRect.height - 6;
        palette.style.top = `${Math.max(10, adjustedTop)}px`;
      }
    });
  }

  /**
   * Set up toolbar button event listeners
   */
  setupToolbarListeners(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    // Set up formatting buttons
    ToolbarFormattingButtons.setup(this.editorCore, this.formattingElements);

    // Set up color pickers
    this.colorPickers = new ToolbarColorPickers(this.editorCore, this.colorPickerElements);
    this.colorPickers.initialize();

    // Set up insert buttons
    this.insertButtons = new ToolbarInsertButtons(
      this.editorCore,
      this.insertElements,
      this.promptModal
    );
    this.insertButtons.setup();

    // Set up image options
    this.imageOptions = new ToolbarImageOptions(
      this.editorCore,
      this.imageElements,
      { positionPaletteRelativeToButton: this.positionPaletteRelativeToButton.bind(this) }
    );
    this.imageOptions.setup(() => this.closeAllPalettesExcept());

    // Set up table buttons
    ToolbarTableButtons.setup(this.editorCore, this.tableElements);

    // Set up global palette click handler
    this.setupPaletteClickHandler();
  }

  /**
   * Set up document click handler to close all palettes
   */
  private setupPaletteClickHandler(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
    }

    this.paletteClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#color-btn') &&
          !target.closest('#bg-color-btn') &&
          !target.closest('#anchor-type-btn') &&
          !target.closest('#wrap-type-btn') &&
          !target.closest('#color-palette') &&
          !target.closest('#bg-color-palette') &&
          !target.closest('#anchor-type-palette') &&
          !target.closest('#wrap-type-palette')) {
        this.closeAllPalettes();
      }
    };
    document.addEventListener('click', this.paletteClickHandler);
  }

  /**
   * Close all palettes
   */
  private closeAllPalettes(): void {
    this.colorPickers?.closeAll();
    this.imageOptions?.closePalettes();
  }

  /**
   * Close all palettes except image options (used when image options toggle)
   */
  private closeAllPalettesExcept(): void {
    this.colorPickers?.closeAll();
  }

  /**
   * Update button active states
   */
  updateButtonStates(): void {
    // Update formatting button states
    ToolbarFormattingButtons.updateStates(this.editorCore, this.formattingElements);

    // Update link button state
    this.insertButtons?.updateLinkState();

    // Update table toolbar visibility
    ToolbarTableButtons.updateVisibility(this.editorCore, this.tableElements);

    // Update image option states
    this.imageOptions?.updateStates();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
      this.paletteClickHandler = null;
    }

    this.colorPickers?.destroy();

    // Remove palettes from body if they were moved there
    const palettes = [
      this.colorPickerElements.colorPalette,
      this.colorPickerElements.bgColorPalette,
      this.imageElements.anchorTypePalette,
      this.imageElements.wrapTypePalette,
    ];

    for (const palette of palettes) {
      if (palette.parentElement === document.body) {
        document.body.removeChild(palette);
      }
    }

    logger.info('Toolbar manager destroyed');
  }
}
