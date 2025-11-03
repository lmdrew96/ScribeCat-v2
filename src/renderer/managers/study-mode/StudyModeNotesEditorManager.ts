/**
 * StudyModeNotesEditorManager
 *
 * Manages the Tiptap notes editor in study mode with full formatting toolbar.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { Color, BackgroundColor, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeNotesEditorManager');

export class StudyModeNotesEditorManager {
  private notesEditor: Editor | null = null;
  private isEditingNotes: boolean = false;
  private currentEditingSessionId: string | null = null;
  private studyPaletteClickHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Start editing notes
   */
  startNotesEdit(sessionId: string, currentNotes: string): void {
    this.isEditingNotes = true;
    this.currentEditingSessionId = sessionId;

    // Hide view content and edit button, show edit content and save/cancel buttons
    const notesViewContent = document.querySelector('.notes-view-content') as HTMLElement;
    const notesEditContent = document.querySelector('.notes-edit-content') as HTMLElement;
    const editNotesBtn = document.querySelector('.edit-notes-btn') as HTMLElement;
    const editActions = document.querySelector('.notes-edit-actions') as HTMLElement;

    if (notesViewContent) notesViewContent.classList.add('hidden');
    if (notesEditContent) notesEditContent.classList.remove('hidden');
    if (editNotesBtn) editNotesBtn.classList.add('hidden');
    if (editActions) editActions.classList.remove('hidden');

    // Create editor container HTML if not exists
    if (notesEditContent && !notesEditContent.querySelector('.study-editor-container')) {
      notesEditContent.innerHTML = this.getEditorHTML();
    }

    // Initialize Tiptap editor if not already created
    const editorElement = document.getElementById('study-notes-editor');
    if (editorElement && !this.notesEditor) {
      this.notesEditor = new Editor({
        element: editorElement,
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
          }),
          Underline,
          Highlight.configure({
            multicolor: false,
          }),
          Link.configure({
            openOnClick: false,
            HTMLAttributes: {
              class: 'editor-link',
            },
          }),
          Placeholder.configure({
            placeholder: 'Edit your notes here...',
          }),
          Superscript,
          Subscript,
          Typography,
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
          }),
        ],
        content: currentNotes || '',
        editorProps: {
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
                return this.notesEditor?.commands.liftListItem('listItem') || false;
              } else {
                // Tab: indent (sink) list item
                return this.notesEditor?.commands.sinkListItem('listItem') || false;
              }
            }
            return false;
          },
        },
      });
    } else if (this.notesEditor) {
      // Update existing editor content
      this.notesEditor.commands.setContent(currentNotes || '');
    }

    // Focus the editor
    setTimeout(() => {
      this.notesEditor?.commands.focus();
    }, 100);

    // Setup toolbar event listeners
    this.setupStudyEditorToolbar();

    logger.info(`Started editing notes for session: ${sessionId}`);
  }

  /**
   * Get notes editor HTML
   */
  private getEditorHTML(): string {
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
              <div class="color-palette study-color-palette hidden">
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
              <div class="color-palette study-bg-color-palette hidden">
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

  /**
   * Setup toolbar event listeners for study mode editor
   */
  private setupStudyEditorToolbar(): void {
    if (!this.notesEditor) return;

    // Text formatting
    const boldBtn = document.querySelector('.study-bold-btn');
    boldBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleBold().run();
    });

    const italicBtn = document.querySelector('.study-italic-btn');
    italicBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleItalic().run();
    });

    const underlineBtn = document.querySelector('.study-underline-btn');
    underlineBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleUnderline().run();
    });

    const strikeBtn = document.querySelector('.study-strike-btn');
    strikeBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleStrike().run();
    });

    const superscriptBtn = document.querySelector('.study-superscript-btn');
    superscriptBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleSuperscript().run();
    });

    const subscriptBtn = document.querySelector('.study-subscript-btn');
    subscriptBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleSubscript().run();
    });

    // Color pickers
    const colorBtn = document.querySelector('.study-color-btn');
    const colorPalette = document.querySelector('.study-color-palette');
    const bgColorPalette = document.querySelector('.study-bg-color-palette');

    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPalette?.classList.toggle('hidden');
      bgColorPalette?.classList.add('hidden');
    });

    const colorSwatches = document.querySelectorAll('.study-color-palette .color-swatch');
    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (swatch as HTMLElement).dataset.color;
        if (color) {
          this.notesEditor?.chain().focus().setColor(color).run();
        }
        colorPalette?.classList.add('hidden');
      });
    });

    const bgColorBtn = document.querySelector('.study-bg-color-btn');
    bgColorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      bgColorPalette?.classList.toggle('hidden');
      colorPalette?.classList.add('hidden');
    });

    const bgColorSwatches = document.querySelectorAll('.study-bg-color-palette .color-swatch');
    bgColorSwatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (swatch as HTMLElement).dataset.color;
        if (color) {
          this.notesEditor?.chain().focus().setBackgroundColor(color).run();
        }
        bgColorPalette?.classList.add('hidden');
      });
    });

    // Close palettes when clicking outside (scoped to study mode palettes only)
    if (this.studyPaletteClickHandler) {
      document.removeEventListener('click', this.studyPaletteClickHandler);
    }

    this.studyPaletteClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.study-color-btn') &&
          !target.closest('.study-bg-color-btn') &&
          !target.closest('.study-color-palette') &&
          !target.closest('.study-bg-color-palette')) {
        colorPalette?.classList.add('hidden');
        bgColorPalette?.classList.add('hidden');
      }
    };
    document.addEventListener('click', this.studyPaletteClickHandler);

    // Font size
    const fontSizeSelect = document.querySelector('.study-font-size-select') as HTMLSelectElement;
    fontSizeSelect?.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        this.notesEditor?.chain().focus().setFontSize(size).run();
      } else {
        this.notesEditor?.chain().focus().unsetFontSize().run();
      }
    });

    // Text alignment
    const alignLeftBtn = document.querySelector('.study-align-left-btn');
    alignLeftBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().setTextAlign('left').run();
    });

    const alignCenterBtn = document.querySelector('.study-align-center-btn');
    alignCenterBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().setTextAlign('center').run();
    });

    const alignRightBtn = document.querySelector('.study-align-right-btn');
    alignRightBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().setTextAlign('right').run();
    });

    const alignJustifyBtn = document.querySelector('.study-align-justify-btn');
    alignJustifyBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().setTextAlign('justify').run();
    });

    // Headings
    const heading1Btn = document.querySelector('.study-heading1-btn');
    heading1Btn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleHeading({ level: 1 }).run();
    });

    const heading2Btn = document.querySelector('.study-heading2-btn');
    heading2Btn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleHeading({ level: 2 }).run();
    });

    // Lists
    const bulletListBtn = document.querySelector('.study-bullet-list-btn');
    bulletListBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleBulletList().run();
    });

    const numberedListBtn = document.querySelector('.study-numbered-list-btn');
    numberedListBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleOrderedList().run();
    });

    // Link
    const linkBtn = document.querySelector('.study-link-btn');
    linkBtn?.addEventListener('click', () => {
      this.toggleStudyEditorLink();
    });

    // Highlight
    const highlightBtn = document.querySelector('.study-highlight-btn');
    highlightBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().toggleHighlight().run();
    });

    // Image upload
    const imageBtn = document.querySelector('.study-image-btn');
    const imageInput = document.getElementById('study-image-input') as HTMLInputElement;
    imageBtn?.addEventListener('click', () => {
      imageInput?.click();
    });

    imageInput?.addEventListener('change', (e) => {
      this.handleStudyImageUpload(e);
    });

    // Table insertion
    const tableBtn = document.querySelector('.study-table-btn');
    tableBtn?.addEventListener('click', () => {
      this.insertStudyTable();
    });

    // History
    const undoBtn = document.querySelector('.study-undo-btn');
    undoBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().undo().run();
    });

    const redoBtn = document.querySelector('.study-redo-btn');
    redoBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().redo().run();
    });

    // Clear formatting
    const clearFormatBtn = document.querySelector('.study-clear-format-btn');
    clearFormatBtn?.addEventListener('click', () => {
      this.notesEditor?.chain().focus().clearNodes().unsetAllMarks().run();
    });

    // Update button states on selection change
    this.notesEditor.on('selectionUpdate', () => {
      this.updateStudyToolbarButtonStates();
    });

    this.notesEditor.on('update', () => {
      this.updateStudyToolbarButtonStates();
    });

    // Initial button state update
    this.updateStudyToolbarButtonStates();
  }

  /**
   * Toggle link in study editor
   */
  private toggleStudyEditorLink(): void {
    if (!this.notesEditor) return;

    const previousUrl = this.notesEditor.getAttributes('link').href;

    if (previousUrl) {
      // Remove link
      this.notesEditor.chain().focus().unsetLink().run();
    } else {
      // Check if there's a selection
      const { from, to } = this.notesEditor.state.selection;
      if (from === to) {
        window.alert('Please select some text first before adding a link.');
        return;
      }

      // Add link
      const url = window.prompt('Enter URL:', 'https://');
      if (url && url !== 'https://') {
        this.notesEditor.chain().focus().setLink({ href: url }).run();
      }
    }
  }

  /**
   * Handle image upload for study editor
   */
  private async handleStudyImageUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;

      // Load image to get dimensions and calculate appropriate size
      const img = new window.Image();
      img.onload = () => {
        // Calculate width to maintain aspect ratio with max height of 100px
        const maxHeight = 100;
        let width = img.width;
        let height = img.height;

        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }

        // Insert image with calculated width
        this.notesEditor?.chain().focus().setImage({
          src: base64,
          width: Math.round(width)
        }).run();
      };
      img.src = base64;
    };

    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
  }

  /**
   * Insert table in study editor
   */
  private async insertStudyTable(): Promise<void> {
    const rowsStr = window.prompt('Number of rows:', '3');
    if (!rowsStr) return;

    const colsStr = window.prompt('Number of columns:', '3');
    if (!colsStr) return;

    const rows = parseInt(rowsStr);
    const cols = parseInt(colsStr);

    if (rows > 0 && cols > 0) {
      this.notesEditor?.chain().focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    }
  }

  /**
   * Update toolbar button states
   */
  private updateStudyToolbarButtonStates(): void {
    if (!this.notesEditor) return;

    // Text formatting
    this.updateToolbarBtnState('.study-bold-btn', this.notesEditor.isActive('bold'));
    this.updateToolbarBtnState('.study-italic-btn', this.notesEditor.isActive('italic'));
    this.updateToolbarBtnState('.study-underline-btn', this.notesEditor.isActive('underline'));
    this.updateToolbarBtnState('.study-strike-btn', this.notesEditor.isActive('strike'));
    this.updateToolbarBtnState('.study-superscript-btn', this.notesEditor.isActive('superscript'));
    this.updateToolbarBtnState('.study-subscript-btn', this.notesEditor.isActive('subscript'));

    // Text alignment
    this.updateToolbarBtnState('.study-align-left-btn', this.notesEditor.isActive({ textAlign: 'left' }));
    this.updateToolbarBtnState('.study-align-center-btn', this.notesEditor.isActive({ textAlign: 'center' }));
    this.updateToolbarBtnState('.study-align-right-btn', this.notesEditor.isActive({ textAlign: 'right' }));
    this.updateToolbarBtnState('.study-align-justify-btn', this.notesEditor.isActive({ textAlign: 'justify' }));

    // Font size - update select value
    const currentFontSize = this.notesEditor.getAttributes('textStyle').fontSize || '';
    const fontSizeSelect = document.querySelector('.study-font-size-select') as HTMLSelectElement;
    if (fontSizeSelect) fontSizeSelect.value = currentFontSize;

    // Headings
    this.updateToolbarBtnState('.study-heading1-btn', this.notesEditor.isActive('heading', { level: 1 }));
    this.updateToolbarBtnState('.study-heading2-btn', this.notesEditor.isActive('heading', { level: 2 }));

    // Lists
    this.updateToolbarBtnState('.study-bullet-list-btn', this.notesEditor.isActive('bulletList'));
    this.updateToolbarBtnState('.study-numbered-list-btn', this.notesEditor.isActive('orderedList'));

    // Highlight and Link
    this.updateToolbarBtnState('.study-highlight-btn', this.notesEditor.isActive('highlight'));
    this.updateToolbarBtnState('.study-link-btn', this.notesEditor.isActive('link'));

    // History buttons (disable if can't undo/redo)
    const undoBtn = document.querySelector('.study-undo-btn') as HTMLButtonElement;
    const redoBtn = document.querySelector('.study-redo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !this.notesEditor.can().undo();
    if (redoBtn) redoBtn.disabled = !this.notesEditor.can().redo();
  }

  /**
   * Update individual toolbar button state
   */
  private updateToolbarBtnState(selector: string, isActive: boolean): void {
    const btn = document.querySelector(selector);
    if (btn) {
      if (isActive) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  /**
   * Get notes HTML
   */
  getNotesHTML(): string {
    return this.notesEditor?.getHTML() || '';
  }

  /**
   * Cancel notes editing
   */
  cancelNotesEdit(): void {
    this.exitNotesEditMode('');
  }

  /**
   * Exit notes edit mode and update UI
   */
  private exitNotesEditMode(notesContent: string): void {
    this.isEditingNotes = false;
    this.currentEditingSessionId = null;

    // Update the view content
    const notesViewContent = document.querySelector('.notes-view-content') as HTMLElement;
    if (notesViewContent) {
      notesViewContent.innerHTML = notesContent || '<div class="empty-content">No notes available for this session.</div>';
    }

    // Show view content and edit button, hide edit content and save/cancel buttons
    const notesEditContent = document.querySelector('.notes-edit-content') as HTMLElement;
    const editNotesBtn = document.querySelector('.edit-notes-btn') as HTMLElement;
    const editActions = document.querySelector('.notes-edit-actions') as HTMLElement;

    if (notesViewContent) notesViewContent.classList.remove('hidden');
    if (notesEditContent) notesEditContent.classList.add('hidden');
    if (editNotesBtn) editNotesBtn.classList.remove('hidden');
    if (editActions) editActions.classList.add('hidden');

    // Remove the palette click handler to prevent memory leaks
    if (this.studyPaletteClickHandler) {
      document.removeEventListener('click', this.studyPaletteClickHandler);
      this.studyPaletteClickHandler = null;
    }

    // Destroy the editor to clean up
    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }

    logger.info('Exited notes edit mode');
  }

  /**
   * Update notes view after save
   */
  updateNotesView(notesContent: string): void {
    this.exitNotesEditMode(notesContent);
  }

  /**
   * Check if currently editing
   */
  isEditing(): boolean {
    return this.isEditingNotes;
  }

  /**
   * Get current editing session ID
   */
  getCurrentEditingSessionId(): string | null {
    return this.currentEditingSessionId;
  }
}
