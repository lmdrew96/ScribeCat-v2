/**
 * ToolbarInsertButtons
 *
 * Handles insert operations: link, bookmark, emoji, image, textbox, table.
 */

import type { TiptapEditorCore } from '../TiptapEditorCore.js';
import { showEmojiPicker } from '../../../components/editor/EmojiPicker.js';
import { compressImage, isSupportedImageType, getRecommendedOptions } from '../../../utils/imageCompression.js';
import { createLogger } from '../../../../shared/logger.js';

const logger = createLogger('ToolbarInsertButtons');

export interface InsertButtonElements {
  emojiBtn: HTMLButtonElement;
  linkBtn: HTMLButtonElement;
  bookmarkBtn: HTMLButtonElement;
  imageBtn: HTMLButtonElement;
  imageInput: HTMLInputElement;
  textboxBtn: HTMLButtonElement;
  insertTableBtn: HTMLButtonElement;
}

export interface InputPromptModal {
  modal: HTMLElement;
  title: HTMLElement;
  label: HTMLElement;
  field: HTMLInputElement;
  okBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
}

export class ToolbarInsertButtons {
  private editorCore: TiptapEditorCore;
  private elements: InsertButtonElements;
  private promptModal: InputPromptModal;

  constructor(
    editorCore: TiptapEditorCore,
    elements: InsertButtonElements,
    promptModal: InputPromptModal
  ) {
    this.editorCore = editorCore;
    this.elements = elements;
    this.promptModal = promptModal;
  }

  /**
   * Set up insert button event listeners
   */
  setup(): void {
    this.elements.emojiBtn.addEventListener('click', () => {
      const editor = this.editorCore.getEditor();
      if (editor) {
        showEmojiPicker(editor, this.elements.emojiBtn);
      }
    });

    this.elements.linkBtn.addEventListener('click', () => {
      this.toggleLink();
    });

    this.elements.bookmarkBtn.addEventListener('click', () => {
      this.insertBookmark();
    });

    this.elements.imageBtn.addEventListener('click', () => {
      this.elements.imageInput.click();
    });

    this.elements.imageInput.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    this.elements.textboxBtn.addEventListener('click', () => {
      this.insertTextBox();
    });

    this.elements.insertTableBtn.addEventListener('click', () => {
      this.insertTable();
    });
  }

  /**
   * Toggle link on/off
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
   * Insert bookmark at current recording timestamp
   */
  private insertBookmark(): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const recordingManager = (window as any).recordingManager;

    if (!recordingManager) {
      logger.warn('RecordingManager not available');
      return;
    }

    if (!recordingManager.getIsRecording()) {
      window.alert('Bookmarks can only be inserted during active recording.');
      return;
    }

    const timestampSeconds = recordingManager.getCurrentRecordingTimestamp();
    const minutes = Math.floor(timestampSeconds / 60);
    const seconds = Math.floor(timestampSeconds % 60);
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const bookmarkHTML = `<a href="#" class="audio-bookmark" data-timestamp="${timestampSeconds}" title="Jump to ${formattedTime}">🔖 ${formattedTime}</a>`;

    editor.chain().focus().insertContent(bookmarkHTML + ' ').run();
    logger.info('Bookmark inserted at timestamp:', formattedTime);
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
      this.editorCore.chain()?.focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    }
  }

  /**
   * Insert text box
   */
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

  /**
   * Handle image upload with compression
   */
  private async handleImageUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!isSupportedImageType(file)) {
      logger.warn(`Unsupported image type: ${file.type}`);
      alert('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      input.value = '';
      return;
    }

    try {
      logger.info('Compressing image...');

      const options = getRecommendedOptions(file);
      const result = await compressImage(file, options);

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
      input.value = '';
    }
  }

  /**
   * Show input prompt modal
   */
  private showInputPrompt(title: string, label: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      this.promptModal.title.textContent = title;
      this.promptModal.label.textContent = label;
      this.promptModal.field.value = defaultValue;

      this.promptModal.modal.classList.remove('hidden');

      setTimeout(() => this.promptModal.field.focus(), 100);

      const handleOk = () => {
        const value = this.promptModal.field.value.trim();
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
        this.promptModal.modal.classList.add('hidden');
        this.promptModal.okBtn.removeEventListener('click', handleOk);
        this.promptModal.cancelBtn.removeEventListener('click', handleCancel);
        this.promptModal.closeBtn.removeEventListener('click', handleCancel);
        this.promptModal.field.removeEventListener('keydown', handleKeydown);
      };

      this.promptModal.okBtn.addEventListener('click', handleOk);
      this.promptModal.cancelBtn.addEventListener('click', handleCancel);
      this.promptModal.closeBtn.addEventListener('click', handleCancel);
      this.promptModal.field.addEventListener('keydown', handleKeydown);
    });
  }

  /**
   * Update link button state
   */
  updateLinkState(): void {
    const isLinkActive = this.editorCore.isActive('link');
    if (isLinkActive) {
      this.elements.linkBtn.classList.add('active');
    } else {
      this.elements.linkBtn.classList.remove('active');
    }
  }
}
