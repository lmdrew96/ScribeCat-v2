/** StudyModeEditorToolbar - Manages the rich text editing toolbar for study mode notes */
import type { Editor } from '@tiptap/core';
import { compressImage, isSupportedImageType, getRecommendedOptions } from '../utils/imageCompression.js';
import { createLogger } from '../../shared/logger.js';
import { notificationTicker } from '../managers/NotificationTicker.js';

const logger = createLogger('StudyModeEditorToolbar');

export class StudyModeEditorToolbar {
  private editor: Editor | null = null;
  private paletteClickHandler: ((e: MouseEvent) => void) | null = null;
  /** Generate toolbar HTML with editor container */
  public getHTML(): string {
    return `
      <div class="study-editor-container">
        <!-- Toolbar -->
        <div class="study-editor-toolbar">
          <!-- Text Style Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-bold-btn" title="Bold • Ctrl+B">
              <span class="btn-icon bold-icon">B</span>
            </button>
            <button class="toolbar-btn study-italic-btn" title="Italic • Ctrl+I">
              <span class="btn-icon italic-icon">I</span>
            </button>
            <button class="toolbar-btn study-underline-btn" title="Underline • Ctrl+U">
              <span class="btn-icon underline-icon">U</span>
            </button>
            <button class="toolbar-btn study-strike-btn" title="Strikethrough • Ctrl+Shift+S">
              <span class="btn-icon strike-icon">S</span>
            </button>
            <button class="toolbar-btn study-superscript-btn" title="Superscript">
              <span class="btn-icon superscript-icon">X²</span>
            </button>
            <button class="toolbar-btn study-subscript-btn" title="Subscript">
              <span class="btn-icon subscript-icon">X₂</span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Color & Font Size Group -->
          <div class="toolbar-group">
            <div class="toolbar-dropdown">
              <button class="toolbar-btn study-color-btn" title="Text Color">
                <span class="btn-icon">A</span>
              </button>
              <div class="color-palette study-color-palette">
                <div class="color-swatch" data-color="#000000" style="background: #000000;" title="Black"></div>
                <div class="color-swatch" data-color="#FF0000" style="background: #FF0000;" title="Red"></div>
                <div class="color-swatch" data-color="#00FF00" style="background: #00FF00;" title="Green"></div>
                <div class="color-swatch" data-color="#0000FF" style="background: #0000FF;" title="Blue"></div>
                <div class="color-swatch" data-color="#FFFF00" style="background: #FFFF00;" title="Yellow"></div>
                <div class="color-swatch" data-color="#FF00FF" style="background: #FF00FF;" title="Magenta"></div>
                <div class="color-swatch" data-color="#00FFFF" style="background: #00FFFF;" title="Cyan"></div>
                <div class="color-swatch" data-color="#FFA500" style="background: #FFA500;" title="Orange"></div>
                <div class="color-swatch" data-color="#800080" style="background: #800080;" title="Purple"></div>
                <div class="color-swatch" data-color="#008000" style="background: #008000;" title="Dark Green"></div>
              </div>
            </div>
            <div class="toolbar-dropdown">
              <button class="toolbar-btn study-bg-color-btn" title="Background Color">
                <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg></span>
              </button>
              <div class="color-palette study-bg-color-palette">
                <div class="color-swatch" data-color="#FFFFFF" style="background: #FFFFFF; border: 2px solid #ddd;" title="White"></div>
                <div class="color-swatch" data-color="#FFEB3B" style="background: #FFEB3B;" title="Yellow"></div>
                <div class="color-swatch" data-color="#FFCDD2" style="background: #FFCDD2;" title="Light Red"></div>
                <div class="color-swatch" data-color="#B3E5FC" style="background: #B3E5FC;" title="Light Blue"></div>
                <div class="color-swatch" data-color="#C8E6C9" style="background: #C8E6C9;" title="Light Green"></div>
                <div class="color-swatch" data-color="#F8BBD0" style="background: #F8BBD0;" title="Light Pink"></div>
                <div class="color-swatch" data-color="#FFE0B2" style="background: #FFE0B2;" title="Light Orange"></div>
                <div class="color-swatch" data-color="#E1BEE7" style="background: #E1BEE7;" title="Light Purple"></div>
                <div class="color-swatch" data-color="#D1C4E9" style="background: #D1C4E9;" title="Light Indigo"></div>
                <div class="color-swatch" data-color="#DCEDC8" style="background: #DCEDC8;" title="Light Lime"></div>
              </div>
            </div>
            <select class="study-font-size-select font-size-select" title="Font Size">
              <option value="">Size</option>
              <option value="12px">12px</option>
              <option value="14px">14px</option>
              <option value="16px">16px</option>
              <option value="18px">18px</option>
              <option value="20px">20px</option>
              <option value="24px">24px</option>
              <option value="28px">28px</option>
              <option value="32px">32px</option>
            </select>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Text Align Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-align-left-btn" title="Align Left">
              <span class="btn-icon align-icon align-left">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <button class="toolbar-btn study-align-center-btn" title="Align Center">
              <span class="btn-icon align-icon align-center">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <button class="toolbar-btn study-align-right-btn" title="Align Right">
              <span class="btn-icon align-icon align-right">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
            <button class="toolbar-btn study-align-justify-btn" title="Justify">
              <span class="btn-icon align-icon align-justify">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Headings Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-heading1-btn" title="Heading 1 • Ctrl+Shift+H">
              <span class="btn-icon">H1</span>
            </button>
            <button class="toolbar-btn study-heading2-btn" title="Heading 2 • Ctrl+Alt+H">
              <span class="btn-icon">H2</span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- List Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-bullet-list-btn" title="Bullet List • Ctrl+Shift+8">
              <span class="btn-icon list-icon">
                <span class="list-bullet">•</span>
                <span class="list-lines">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            </button>
            <button class="toolbar-btn study-numbered-list-btn" title="Numbered List • Ctrl+Shift+7">
              <span class="btn-icon list-icon">
                <span class="list-number">1.</span>
                <span class="list-lines">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Insert Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-link-btn" title="Add Link">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
            </button>
            <button class="toolbar-btn study-highlight-btn" title="Highlight">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg></span>
            </button>
            <button class="toolbar-btn study-image-btn" title="Insert Image">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></span>
            </button>
            <input type="file" id="study-image-input" accept="image/*" style="display: none;">
            <button class="toolbar-btn study-table-btn" title="Insert Table">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg></span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- History Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-undo-btn" title="Undo • Ctrl+Z">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg></span>
            </button>
            <button class="toolbar-btn study-redo-btn" title="Redo • Ctrl+Y">
              <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg></span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Clear Format -->
          <button class="toolbar-btn study-clear-format-btn" title="Clear Formatting">
            <span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span>
          </button>
        </div>
        <!-- Editor with Cursor Overlay -->
        <div class="study-editor-wrapper" style="position: relative;">
          <div id="study-notes-editor" class="study-notes-editor"></div>
          <div id="study-cursor-overlay" class="cursor-overlay-container"></div>
        </div>
      </div>
    `;
  }
  /** Setup toolbar event listeners */
  public setup(editor: Editor): void {
    this.editor = editor;

    document.querySelector('.study-bold-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleBold().run();
    });

    document.querySelector('.study-italic-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleItalic().run();
    });

    document.querySelector('.study-underline-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleUnderline().run();
    });

    document.querySelector('.study-strike-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleStrike().run();
    });

    document.querySelector('.study-superscript-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleSuperscript().run();
    });

    document.querySelector('.study-subscript-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleSubscript().run();
    });

    this.setupColorControls();

    const fontSizeSelect = document.querySelector('.study-font-size-select') as HTMLSelectElement;
    fontSizeSelect?.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        this.editor?.chain().focus().setFontSize(size).run();
      } else {
        this.editor?.chain().focus().unsetFontSize().run();
      }
    });

    document.querySelector('.study-align-left-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('left').run();
    });

    document.querySelector('.study-align-center-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('center').run();
    });

    document.querySelector('.study-align-right-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('right').run();
    });

    document.querySelector('.study-align-justify-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().setTextAlign('justify').run();
    });

    document.querySelector('.study-heading1-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHeading({ level: 1 }).run();
    });

    document.querySelector('.study-heading2-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHeading({ level: 2 }).run();
    });

    document.querySelector('.study-bullet-list-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleBulletList().run();
    });

    document.querySelector('.study-numbered-list-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleOrderedList().run();
    });

    document.querySelector('.study-link-btn')?.addEventListener('click', () => {
      this.toggleLink();
    });

    document.querySelector('.study-highlight-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().toggleHighlight().run();
    });

    const imageBtn = document.querySelector('.study-image-btn');
    const imageInput = document.getElementById('study-image-input') as HTMLInputElement;
    imageBtn?.addEventListener('click', () => {
      imageInput?.click();
    });

    imageInput?.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });

    document.querySelector('.study-table-btn')?.addEventListener('click', () => {
      this.insertTable();
    });

    document.querySelector('.study-undo-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().undo().run();
    });

    document.querySelector('.study-redo-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().redo().run();
    });

    document.querySelector('.study-clear-format-btn')?.addEventListener('click', () => {
      this.editor?.chain().focus().clearNodes().unsetAllMarks().run();
    });

    this.editor.on('selectionUpdate', () => {
      this.updateButtonStates();
    });

    this.editor.on('update', () => {
      this.updateButtonStates();
    });

    this.updateButtonStates();
  }
  /** Setup color picker controls */
  private setupColorControls(): void {
    const colorBtn = document.querySelector('.study-color-btn');
    const colorPalette = document.querySelector('.study-color-palette');
    const bgColorBtn = document.querySelector('.study-bg-color-btn');
    const bgColorPalette = document.querySelector('.study-bg-color-palette');

    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPalette?.classList.toggle('show');
      bgColorPalette?.classList.remove('show');
    });

    const colorSwatches = document.querySelectorAll('.study-color-palette .color-swatch');
    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (swatch as HTMLElement).dataset.color;
        if (color) {
          this.editor?.chain().focus().setColor(color).run();
        }
        colorPalette?.classList.remove('show');
      });
    });

    bgColorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      bgColorPalette?.classList.toggle('show');
      colorPalette?.classList.remove('show');
    });

    const bgColorSwatches = document.querySelectorAll('.study-bg-color-palette .color-swatch');
    bgColorSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (swatch as HTMLElement).dataset.color;
        if (color) {
          this.editor?.chain().focus().setBackgroundColor(color).run();
        }
        bgColorPalette?.classList.remove('show');
      });
    });

    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
    }

    this.paletteClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.study-color-btn') &&
          !target.closest('.study-bg-color-btn') &&
          !target.closest('.study-color-palette') &&
          !target.closest('.study-bg-color-palette')) {
        colorPalette?.classList.remove('show');
        bgColorPalette?.classList.remove('show');
      }
    };
    document.addEventListener('click', this.paletteClickHandler);
  }
  /** Toggle link insertion */
  private toggleLink(): void {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('link').href;

    if (previousUrl) {
      this.editor.chain().focus().unsetLink().run();
    } else {
      const { from, to } = this.editor.state.selection;
      if (from === to) {
        window.alert('Please select some text first before adding a link.');
        return;
      }

      const url = window.prompt('Enter URL:', 'https://');
      if (url && url !== 'https://') {
        this.editor.chain().focus().setLink({ href: url }).run();
      }
    }
  }
  /** Handle image upload */
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
      // Show loading state
      notificationTicker.info('Compressing image...', 0); // 0 = persistent until dismissed
      logger.info('Compressing image...');

      // Compress image with recommended settings
      const options = getRecommendedOptions(file);
      const result = await compressImage(file, options);

      // Insert compressed image into editor
      this.editor?.chain().focus().setImage({
        src: result.dataUrl,
        width: result.width,
        height: result.height,
      }).run();

      // Show success feedback
      notificationTicker.success('Image added successfully', 2000);
      logger.info('Image inserted successfully');
    } catch (error) {
      logger.error('Failed to process image:', error);
      notificationTicker.error('Failed to process image. Please try again.', 3000);
    } finally {
      // Clear input so same file can be selected again
      input.value = '';
    }
  }
  /** Insert table */
  private async insertTable(): Promise<void> {
    const rowsStr = window.prompt('Number of rows:', '3');
    if (!rowsStr) return;

    const colsStr = window.prompt('Number of columns:', '3');
    if (!colsStr) return;

    const rows = parseInt(rowsStr);
    const cols = parseInt(colsStr);

    if (rows > 0 && cols > 0) {
      this.editor?.chain().focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    }
  }
  /** Update toolbar button states */
  private updateButtonStates(): void {
    if (!this.editor) return;

    this.updateBtnState('.study-bold-btn', this.editor.isActive('bold'));
    this.updateBtnState('.study-italic-btn', this.editor.isActive('italic'));
    this.updateBtnState('.study-underline-btn', this.editor.isActive('underline'));
    this.updateBtnState('.study-strike-btn', this.editor.isActive('strike'));
    this.updateBtnState('.study-superscript-btn', this.editor.isActive('superscript'));
    this.updateBtnState('.study-subscript-btn', this.editor.isActive('subscript'));

    this.updateBtnState('.study-align-left-btn', this.editor.isActive({ textAlign: 'left' }));
    this.updateBtnState('.study-align-center-btn', this.editor.isActive({ textAlign: 'center' }));
    this.updateBtnState('.study-align-right-btn', this.editor.isActive({ textAlign: 'right' }));
    this.updateBtnState('.study-align-justify-btn', this.editor.isActive({ textAlign: 'justify' }));

    const currentFontSize = this.editor.getAttributes('textStyle').fontSize || '';
    const fontSizeSelect = document.querySelector('.study-font-size-select') as HTMLSelectElement;
    if (fontSizeSelect) fontSizeSelect.value = currentFontSize;

    this.updateBtnState('.study-heading1-btn', this.editor.isActive('heading', { level: 1 }));
    this.updateBtnState('.study-heading2-btn', this.editor.isActive('heading', { level: 2 }));

    this.updateBtnState('.study-bullet-list-btn', this.editor.isActive('bulletList'));
    this.updateBtnState('.study-numbered-list-btn', this.editor.isActive('orderedList'));

    this.updateBtnState('.study-highlight-btn', this.editor.isActive('highlight'));
    this.updateBtnState('.study-link-btn', this.editor.isActive('link'));

    const undoBtn = document.querySelector('.study-undo-btn') as HTMLButtonElement;
    const redoBtn = document.querySelector('.study-redo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !this.editor.can().undo();
    if (redoBtn) redoBtn.disabled = !this.editor.can().redo();
  }
  /** Update individual button state */
  private updateBtnState(selector: string, isActive: boolean): void {
    const btn = document.querySelector(selector);
    if (btn) {
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
  /** Cleanup event listeners */
  public cleanup(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
      this.paletteClickHandler = null;
    }
    this.editor = null;
  }
}
