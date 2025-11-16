/**
 * TiptapToolbarManager
 *
 * Manages toolbar UI, event handlers, and button states.
 */

import type { TiptapEditorCore } from './TiptapEditorCore.js';
import { createLogger } from '../../../shared/logger.js';
import { showEmojiPicker } from '../../components/editor/EmojiPicker.js';
import { EditorColorPalettes } from '../../components/editor/ColorPicker.js';
import { compressImage, isSupportedImageType, getRecommendedOptions } from '../../utils/imageCompression.js';

const logger = createLogger('TiptapToolbarManager');

export class TiptapToolbarManager {
  private editorCore: TiptapEditorCore;
  private paletteClickHandler: ((e: MouseEvent) => void) | null = null;

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
  private blockquoteBtn: HTMLButtonElement;
  private codeBtn: HTMLButtonElement;
  private codeBlockBtn: HTMLButtonElement;
  private dividerBtn: HTMLButtonElement;
  private emojiBtn: HTMLButtonElement;
  private linkBtn: HTMLButtonElement;
  private bookmarkBtn: HTMLButtonElement;
  private imageBtn: HTMLButtonElement;
  private imageInput: HTMLInputElement;
  private textboxBtn: HTMLButtonElement;
  private anchorTypeBtn: HTMLButtonElement;
  private anchorTypePalette: HTMLElement;
  private anchorTypeDropdown: HTMLElement;
  private wrapTypeBtn: HTMLButtonElement;
  private wrapTypePalette: HTMLElement;
  private wrapTypeDropdown: HTMLElement;
  private imageAlignLeftBtn: HTMLButtonElement;
  private imageAlignRightBtn: HTMLButtonElement;
  private imageIndentBtn: HTMLButtonElement;
  private imageOutdentBtn: HTMLButtonElement;
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

  private inputPromptModal: HTMLElement;
  private inputPromptTitle: HTMLElement;
  private inputPromptLabel: HTMLElement;
  private inputPromptField: HTMLInputElement;
  private okInputPromptBtn: HTMLButtonElement;
  private cancelInputPromptBtn: HTMLButtonElement;
  private closeInputPromptBtn: HTMLButtonElement;

  constructor(editorCore: TiptapEditorCore) {
    this.editorCore = editorCore;

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
    this.blockquoteBtn = document.getElementById('blockquote-btn') as HTMLButtonElement;
    this.codeBtn = document.getElementById('code-btn') as HTMLButtonElement;
    this.codeBlockBtn = document.getElementById('code-block-btn') as HTMLButtonElement;
    this.dividerBtn = document.getElementById('divider-btn') as HTMLButtonElement;
    this.emojiBtn = document.getElementById('emoji-btn') as HTMLButtonElement;
    this.linkBtn = document.getElementById('link-btn') as HTMLButtonElement;
    this.bookmarkBtn = document.getElementById('bookmark-btn') as HTMLButtonElement;
    this.imageBtn = document.getElementById('image-btn') as HTMLButtonElement;
    this.imageInput = document.getElementById('image-input') as HTMLInputElement;
    this.textboxBtn = document.getElementById('textbox-btn') as HTMLButtonElement;
    this.anchorTypeBtn = document.getElementById('anchor-type-btn') as HTMLButtonElement;
    this.anchorTypePalette = document.getElementById('anchor-type-palette') as HTMLElement;
    this.anchorTypeDropdown = document.getElementById('anchor-type-dropdown') as HTMLElement;
    this.wrapTypeBtn = document.getElementById('wrap-type-btn') as HTMLButtonElement;
    this.wrapTypePalette = document.getElementById('wrap-type-palette') as HTMLElement;
    this.wrapTypeDropdown = document.getElementById('wrap-type-dropdown') as HTMLElement;
    this.imageAlignLeftBtn = document.getElementById('image-align-left-btn') as HTMLButtonElement;
    this.imageAlignRightBtn = document.getElementById('image-align-right-btn') as HTMLButtonElement;
    this.imageIndentBtn = document.getElementById('image-indent-btn') as HTMLButtonElement;
    this.imageOutdentBtn = document.getElementById('image-outdent-btn') as HTMLButtonElement;
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

    this.inputPromptModal = document.getElementById('input-prompt-modal') as HTMLElement;
    this.inputPromptTitle = document.getElementById('input-prompt-title') as HTMLElement;
    this.inputPromptLabel = document.getElementById('input-prompt-label') as HTMLElement;
    this.inputPromptField = document.getElementById('input-prompt-field') as HTMLInputElement;
    this.okInputPromptBtn = document.getElementById('ok-input-prompt-btn') as HTMLButtonElement;
    this.cancelInputPromptBtn = document.getElementById('cancel-input-prompt-btn') as HTMLButtonElement;
    this.closeInputPromptBtn = document.getElementById('close-input-prompt-btn') as HTMLButtonElement;

    // CRITICAL: Move palettes to document.body to escape overflow:hidden clipping
    // The .main-content has overflow:hidden which creates a containing block that clips
    // fixed-position children. Moving to body allows palettes to truly escape all constraints.
    this.movePalettesToBody();
  }

  /**
   * Move palette elements to document.body to escape parent overflow clipping
   * This is necessary because .main-content has overflow:hidden which creates a
   * containing block that clips fixed-position descendants
   */
  private movePalettesToBody(): void {
    document.body.appendChild(this.colorPalette);
    document.body.appendChild(this.bgColorPalette);
    document.body.appendChild(this.anchorTypePalette);
    document.body.appendChild(this.wrapTypePalette);
    logger.info('Moved palettes to document.body to escape overflow clipping');
  }

  /**
   * Position a palette element relative to a button using fixed positioning
   * This escapes all parent stacking contexts and ensures proper z-index layering
   */
  private positionPaletteRelativeToButton(button: HTMLElement, palette: HTMLElement): void {
    const buttonRect = button.getBoundingClientRect();

    // Position palette below the button with a small gap
    const top = buttonRect.bottom + 6;
    const left = buttonRect.left;

    // Apply position
    palette.style.top = `${top}px`;
    palette.style.left = `${left}px`;

    // Optional: Adjust if palette would go off-screen
    // Get palette dimensions after it's shown (might need a small delay)
    requestAnimationFrame(() => {
      const paletteRect = palette.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if palette goes off right edge
      if (paletteRect.right > viewportWidth) {
        const adjustedLeft = viewportWidth - paletteRect.width - 10;
        palette.style.left = `${Math.max(10, adjustedLeft)}px`;
      }

      // Adjust vertical position if palette goes off bottom edge
      if (paletteRect.bottom > viewportHeight) {
        // Position above button instead
        const adjustedTop = buttonRect.top - paletteRect.height - 6;
        palette.style.top = `${Math.max(10, adjustedTop)}px`;
      }
    });
  }
  /** Set up toolbar button event listeners */
  setupToolbarListeners(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

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

    this.colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.colorPalette.classList.contains('show');
      this.colorPalette.classList.toggle('show');
      this.bgColorPalette.classList.remove('show');

      // Position palette when showing
      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.colorBtn, this.colorPalette);
      }
    });

    this.setupColorPalette();

    this.bgColorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.bgColorPalette.classList.contains('show');
      this.bgColorPalette.classList.toggle('show');
      this.colorPalette.classList.remove('show');

      // Position palette when showing
      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.bgColorBtn, this.bgColorPalette);
      }
    });

    this.setupBgColorPalette();

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
        this.colorPalette.classList.remove('show');
        this.bgColorPalette.classList.remove('show');
        this.anchorTypePalette.classList.remove('show');
        this.wrapTypePalette.classList.remove('show');
      }
    };
    document.addEventListener('click', this.paletteClickHandler);

    this.fontSizeSelect.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        this.editorCore.chain()?.focus().setFontSize(size).run();
      } else {
        this.editorCore.chain()?.focus().unsetFontSize().run();
      }
    });

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

    this.heading1Btn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleHeading({ level: 1 }).run();
    });

    this.heading2Btn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleHeading({ level: 2 }).run();
    });

    this.bulletListBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleBulletList().run();
    });

    this.numberedListBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleOrderedList().run();
    });

    this.blockquoteBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleBlockquote().run();
    });

    this.codeBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleCode().run();
    });

    this.codeBlockBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().toggleCodeBlock().run();
    });

    this.dividerBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().setHorizontalRule().run();
    });

    this.emojiBtn.addEventListener('click', () => {
      const editor = this.editorCore.getEditor();
      if (editor) {
        showEmojiPicker(editor, this.emojiBtn);
      }
    });

    this.linkBtn.addEventListener('click', () => {
      this.toggleLink();
    });

    this.bookmarkBtn.addEventListener('click', () => {
      this.insertBookmark();
    });

    this.imageBtn.addEventListener('click', () => {
      this.imageInput.click();
    });

    this.imageInput.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    this.textboxBtn.addEventListener('click', () => {
      this.insertTextBox();
    });

    // Anchor type palette toggle
    this.anchorTypeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.anchorTypePalette.classList.contains('show');
      this.anchorTypePalette.classList.toggle('show');
      this.colorPalette.classList.remove('show');
      this.bgColorPalette.classList.remove('show');
      this.wrapTypePalette.classList.remove('show');

      // Position palette when showing
      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.anchorTypeBtn, this.anchorTypePalette);
      }
    });

    // Anchor type palette options
    this.anchorTypePalette.querySelectorAll('.anchor-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const anchorType = (e.currentTarget as HTMLElement).getAttribute('data-anchor');
        if (anchorType) {
          this.changeImageAnchor(anchorType);
          this.anchorTypePalette.classList.remove('show');
        }
      });
    });

    // Wrap type palette toggle
    this.wrapTypeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.wrapTypePalette.classList.contains('show');
      this.wrapTypePalette.classList.toggle('show');
      this.colorPalette.classList.remove('show');
      this.bgColorPalette.classList.remove('show');
      this.anchorTypePalette.classList.remove('show');

      // Position palette when showing
      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.wrapTypeBtn, this.wrapTypePalette);
      }
    });

    // Wrap type palette options
    this.wrapTypePalette.querySelectorAll('.wrap-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const wrapType = (e.currentTarget as HTMLElement).getAttribute('data-wrap');
        if (wrapType) {
          this.changeImageWrapType(wrapType);
          this.wrapTypePalette.classList.remove('show');
        }
      });
    });

    // Image alignment buttons
    this.imageAlignLeftBtn.addEventListener('click', () => {
      this.changeImageFloatDirection('left');
    });

    this.imageAlignRightBtn.addEventListener('click', () => {
      this.changeImageFloatDirection('right');
    });

    // Image position adjustment buttons
    this.imageIndentBtn.addEventListener('click', () => {
      this.adjustImageHorizontalOffset(-20); // Move inward by 20px
    });

    this.imageOutdentBtn.addEventListener('click', () => {
      this.adjustImageHorizontalOffset(20); // Move outward by 20px
    });

    this.insertTableBtn.addEventListener('click', () => {
      this.insertTable();
    });

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

    this.undoBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().undo().run();
    });

    this.redoBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().redo().run();
    });

    this.clearFormatBtn.addEventListener('click', () => {
      this.editorCore.chain()?.focus().clearNodes().unsetAllMarks().run();
    });

    // Setup scroll-to-top button
    this.setupScrollToTopButton();
  }
  /** Set up color palette swatches */
  private setupColorPalette(): void {
    // Clear existing swatches
    this.colorPalette.innerHTML = '';

    // Create swatches from professional palette
    EditorColorPalettes.textColors.forEach(({ name, value }) => {
      const swatch = document.createElement('div');
      swatch.className = 'editor-color-swatch';
      swatch.setAttribute('data-color', value);
      swatch.setAttribute('title', name);
      swatch.style.background = value;

      // Add border for light colors
      if (value === '#FFFFFF' || value === '#EEEEEE') {
        swatch.style.border = '1px solid var(--border)';
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editorCore.chain()?.focus().setColor(value).run();
        this.colorPalette.classList.remove('show');
      });

      this.colorPalette.appendChild(swatch);
    });
  }
  /** Set up background color palette swatches */
  private setupBgColorPalette(): void {
    // Clear existing swatches
    this.bgColorPalette.innerHTML = '';

    // Create swatches from professional highlight palette
    EditorColorPalettes.highlightColors.forEach(({ name, value }) => {
      const swatch = document.createElement('div');
      swatch.className = 'editor-color-swatch';
      swatch.setAttribute('data-color', value);
      swatch.setAttribute('title', name);
      swatch.style.background = value;

      // Add border for very light colors
      if (value === '#FFFFFF' || value.toUpperCase().startsWith('#FFF')) {
        swatch.style.border = '1px solid var(--border)';
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editorCore.chain()?.focus().setBackgroundColor(value).run();
        this.bgColorPalette.classList.remove('show');
      });

      this.bgColorPalette.appendChild(swatch);
    });
  }
  /** Show input prompt modal */
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
  /** Toggle link */
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
   * Insert bookmark at current recording timestamp
   */
  private insertBookmark(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    // Access recordingManager from window (exposed globally in app.ts)
    const recordingManager = (window as any).recordingManager;

    if (!recordingManager) {
      logger.warn('RecordingManager not available');
      return;
    }

    // Check if currently recording
    if (!recordingManager.getIsRecording()) {
      window.alert('Bookmarks can only be inserted during active recording.');
      return;
    }

    // Get current recording timestamp (in seconds)
    const timestampSeconds = recordingManager.getCurrentRecordingTimestamp();

    // Format timestamp as MM:SS
    const minutes = Math.floor(timestampSeconds / 60);
    const seconds = Math.floor(timestampSeconds % 60);
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Create bookmark HTML
    const bookmarkHTML = `<a href="#" class="audio-bookmark" data-timestamp="${timestampSeconds}" title="Jump to ${formattedTime}">🔖 ${formattedTime}</a>`;

    // Insert bookmark at cursor position
    editor.chain().focus().insertContent(bookmarkHTML + ' ').run();

    logger.info('Bookmark inserted at timestamp:', formattedTime);
  }

  /** Insert table */
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

  /** Insert text box */
  private insertTextBox(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    editor.chain().focus().insertContent({
      type: 'draggableTextBox',
      attrs: {
        anchorType: 'paragraph',
        wrapType: 'square',
        floatDirection: 'left',
        horizontalOffset: 0,
        width: 200,
        height: 100,
      },
      content: [
        {
          type: 'text',
          text: 'Text Box',
        },
      ],
    }).run();
  }

  /** Handle image upload with compression */
  private async handleImageUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Check if file type is supported
    if (!isSupportedImageType(file)) {
      logger.warn(`Unsupported image type: ${file.type}`);
      alert('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      input.value = '';
      return;
    }

    try {
      // Show loading state (TODO: Add UI indicator)
      logger.info('Compressing image...');

      // Compress image with recommended settings
      const options = getRecommendedOptions(file);
      const result = await compressImage(file, options);

      // Insert compressed image into editor
      this.editorCore.chain()?.focus().setImage({
        src: result.dataUrl,
        width: result.width,
        height: result.height,
        anchorType: 'paragraph',
      }).run();

      logger.info('Image inserted successfully');
    } catch (error) {
      logger.error('Failed to process image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      // Clear input so same file can be selected again
      input.value = '';
    }
  }
  /** Change image wrap type */
  private changeImageWrapType(wrapType: string): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    // Find the image node
    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false; // Stop iteration
      }
    });

    if (!imageNode || imagePos === null) return;

    // Update node attributes
    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      wrapType: wrapType,
    });

    editor.view.dispatch(tr);
  }

  /** Change image float direction */
  private changeImageFloatDirection(direction: 'left' | 'right' | 'none'): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    // Find the image node
    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false; // Stop iteration
      }
    });

    if (!imageNode || imagePos === null) return;

    // Update node attributes
    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      floatDirection: direction,
    });

    editor.view.dispatch(tr);
  }

  /** Adjust image horizontal offset */
  private adjustImageHorizontalOffset(delta: number): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    // Find the image node
    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false; // Stop iteration
      }
    });

    if (!imageNode || imagePos === null) return;

    // Calculate new offset (clamp between -100 and 100)
    const currentOffset = imageNode.attrs.horizontalOffset || 0;
    const newOffset = Math.max(-100, Math.min(100, currentOffset + delta));

    // Update node attributes
    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      horizontalOffset: newOffset,
    });

    editor.view.dispatch(tr);
  }

  /** Change image anchor type */
  private changeImageAnchor(anchorType: string): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    // Find the image node
    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false; // Stop iteration
      }
    });

    if (!imageNode || imagePos === null) return;

    // Update node attributes
    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      anchorType: anchorType,
      // Reset position for page anchor
      posX: anchorType === 'page' ? (imageNode.attrs.posX || 20) : null,
      posY: anchorType === 'page' ? (imageNode.attrs.posY || 20) : null,
    });

    editor.view.dispatch(tr);
  }

  /** REMOVED: Toggle image position mode - all images now use absolute positioning */
  private toggleImagePositionMode_REMOVED(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    // Find the image node
    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false; // Stop iteration
      }
    });

    if (!imageNode || imagePos === null) return;

    const currentMode = imageNode.attrs.positionMode || 'flow';
    const newMode = currentMode === 'flow' ? 'absolute' : 'flow';

    // Get current position if switching to absolute mode
    let posX = imageNode.attrs.posX;
    let posY = imageNode.attrs.posY;

    if (newMode === 'absolute' && (posX === null || posY === null)) {
      // Calculate initial position from current DOM position
      const editorEl = editor.view.dom.closest('.tiptap-content') as HTMLElement;
      const nodeEl = editor.view.nodeDOM(imagePos) as HTMLElement;

      if (editorEl && nodeEl) {
        const editorRect = editorEl.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();

        posX = nodeRect.left - editorRect.left;
        posY = nodeRect.top - editorRect.top;
      }
    } else if (newMode === 'flow') {
      // Clear position when switching back to flow
      posX = null;
      posY = null;
    }

    // Update node attributes
    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      positionMode: newMode,
      posX,
      posY,
    });

    editor.view.dispatch(tr);
  }

  /** Update button active states */
  updateButtonStates(): void {
    this.updateButtonState(this.boldBtn, this.editorCore.isActive('bold'));
    this.updateButtonState(this.italicBtn, this.editorCore.isActive('italic'));
    this.updateButtonState(this.underlineBtn, this.editorCore.isActive('underline'));
    this.updateButtonState(this.strikeBtn, this.editorCore.isActive('strike'));
    this.updateButtonState(this.superscriptBtn, this.editorCore.isActive('superscript'));
    this.updateButtonState(this.subscriptBtn, this.editorCore.isActive('subscript'));

    this.updateButtonState(this.alignLeftBtn, this.editorCore.isActive({ textAlign: 'left' }));
    this.updateButtonState(this.alignCenterBtn, this.editorCore.isActive({ textAlign: 'center' }));
    this.updateButtonState(this.alignRightBtn, this.editorCore.isActive({ textAlign: 'right' }));
    this.updateButtonState(this.alignJustifyBtn, this.editorCore.isActive({ textAlign: 'justify' }));

    const currentFontSize = this.editorCore.getAttributes('textStyle').fontSize || '';
    this.fontSizeSelect.value = currentFontSize;

    this.updateButtonState(this.heading1Btn, this.editorCore.isActive('heading', { level: 1 }));
    this.updateButtonState(this.heading2Btn, this.editorCore.isActive('heading', { level: 2 }));

    this.updateButtonState(this.bulletListBtn, this.editorCore.isActive('bulletList'));
    this.updateButtonState(this.numberedListBtn, this.editorCore.isActive('orderedList'));

    this.updateButtonState(this.blockquoteBtn, this.editorCore.isActive('blockquote'));
    this.updateButtonState(this.codeBtn, this.editorCore.isActive('code'));
    this.updateButtonState(this.codeBlockBtn, this.editorCore.isActive('codeBlock'));

    this.updateButtonState(this.linkBtn, this.editorCore.isActive('link'));

    const isInTable = this.editorCore.isActive('table');
    this.tableToolbar.style.display = isInTable ? 'flex' : 'none';

    // Show/hide anchor and wrap type dropdowns based on image or text box selection
    const imageAttrs = this.editorCore.getAttributes('draggableImage');
    const textboxAttrs = this.editorCore.getAttributes('draggableTextBox');
    const isImageSelected = Object.keys(imageAttrs).length > 0;
    const isTextBoxSelected = Object.keys(textboxAttrs).length > 0;
    const isPositionableSelected = isImageSelected || isTextBoxSelected;

    const attrs = isImageSelected ? imageAttrs : textboxAttrs;
    const anchorType = attrs.anchorType || 'paragraph';

    // Always show anchor dropdown when image or text box is selected
    this.anchorTypeDropdown.style.display = isPositionableSelected ? 'inline-block' : 'none';

    // Only show wrap dropdown for paragraph-anchored items
    const showWrapDropdown = isPositionableSelected && anchorType === 'paragraph';
    this.wrapTypeDropdown.style.display = showWrapDropdown ? 'inline-block' : 'none';

    // Show alignment and position buttons for paragraph-anchored items with wrapping enabled
    const wrapType = attrs.wrapType || 'square';
    const showPositionControls = isPositionableSelected && anchorType === 'paragraph' &&
                                  (wrapType === 'square' || wrapType === 'tight');
    this.imageAlignLeftBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.imageAlignRightBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.imageIndentBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.imageOutdentBtn.style.display = showPositionControls ? 'inline-block' : 'none';

    if (isPositionableSelected) {
      // Update active anchor type in palette
      this.anchorTypePalette.querySelectorAll('.anchor-option').forEach(option => {
        if (option.getAttribute('data-anchor') === anchorType) {
          option.classList.add('active');
        } else {
          option.classList.remove('active');
        }
      });

      // Update active wrap type in palette (if applicable)
      if (anchorType === 'paragraph') {
        const wrapType = imageAttrs.wrapType || 'square';
        this.wrapTypePalette.querySelectorAll('.wrap-option').forEach(option => {
          if (option.getAttribute('data-wrap') === wrapType) {
            option.classList.add('active');
          } else {
            option.classList.remove('active');
          }
        });

        // Update active alignment button
        if (wrapType === 'square' || wrapType === 'tight') {
          const floatDirection = imageAttrs.floatDirection || 'left';
          this.updateButtonState(this.imageAlignLeftBtn, floatDirection === 'left');
          this.updateButtonState(this.imageAlignRightBtn, floatDirection === 'right');
        }
      }
    }

    this.undoBtn.disabled = !this.editorCore.canUndo();
    this.redoBtn.disabled = !this.editorCore.canRedo();
  }
  /** Update individual button state */
  private updateButtonState(button: HTMLButtonElement, isActive: boolean): void {
    if (isActive) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }
  /** Cleanup */
  destroy(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
      this.paletteClickHandler = null;
    }

    // Remove palettes from body if they were moved there
    if (this.colorPalette.parentElement === document.body) {
      document.body.removeChild(this.colorPalette);
    }
    if (this.bgColorPalette.parentElement === document.body) {
      document.body.removeChild(this.bgColorPalette);
    }
    if (this.anchorTypePalette.parentElement === document.body) {
      document.body.removeChild(this.anchorTypePalette);
    }
    if (this.wrapTypePalette.parentElement === document.body) {
      document.body.removeChild(this.wrapTypePalette);
    }

    logger.info('Toolbar manager destroyed');
  }

  /**
   * Setup scroll-to-top button behavior
   */
  private setupScrollToTopButton(): void {
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    const editorContainer = document.getElementById('tiptap-editor');

    if (!scrollBtn || !editorContainer) return;

    // Show/hide button based on scroll position
    editorContainer.addEventListener('scroll', () => {
      if (editorContainer.scrollTop > 200) {
        scrollBtn.style.display = 'block';
      } else {
        scrollBtn.style.display = 'none';
      }
    });

    // Scroll to top when clicked
    scrollBtn.addEventListener('click', () => {
      editorContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}
