/** StudyModeEditorToolbar - Manages the rich text editing toolbar for study mode notes */
import type { Editor } from '@tiptap/core';
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
                <span class="btn-icon">🎨</span>
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
              <span class="btn-icon">🔗</span>
            </button>
            <button class="toolbar-btn study-highlight-btn" title="Highlight">
              <span class="btn-icon">✨</span>
            </button>
            <button class="toolbar-btn study-image-btn" title="Insert Image">
              <span class="btn-icon">🖼️</span>
            </button>
            <input type="file" id="study-image-input" accept="image/*" style="display: none;">
            <button class="toolbar-btn study-table-btn" title="Insert Table">
              <span class="btn-icon">⊞</span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- History Group -->
          <div class="toolbar-group">
            <button class="toolbar-btn study-undo-btn" title="Undo • Ctrl+Z">
              <span class="btn-icon">↶</span>
            </button>
            <button class="toolbar-btn study-redo-btn" title="Redo • Ctrl+Y">
              <span class="btn-icon">↷</span>
            </button>
          </div>

          <div class="toolbar-divider"></div>

          <!-- Clear Format -->
          <button class="toolbar-btn study-clear-format-btn" title="Clear Formatting">
            <span class="btn-icon">✕</span>
          </button>
        </div>
        <!-- Editor -->
        <div id="study-notes-editor" class="study-notes-editor"></div>
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

        this.editor?.chain().focus().setImage({
          src: base64,
          width: Math.round(width)
        }).run();
      };
      img.src = base64;
    };

    reader.readAsDataURL(file);

    input.value = '';
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
