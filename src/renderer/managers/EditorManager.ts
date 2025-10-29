/**
 * EditorManager
 * Handles editor functionality and formatting
 */

export class EditorManager {
  private notesEditor: HTMLElement;
  private charCount: HTMLElement;
  private wordCount: HTMLElement;
  private boldBtn: HTMLButtonElement;
  private italicBtn: HTMLButtonElement;
  private underlineBtn: HTMLButtonElement;
  private fontFamilySelect: HTMLSelectElement;
  private fontSizeSelect: HTMLSelectElement;
  private textColorBtn: HTMLButtonElement;
  private highlightColorBtn: HTMLButtonElement;
  private textColorPicker: HTMLInputElement;
  private highlightColorPicker: HTMLInputElement;
  private textColorIndicator: HTMLElement;
  private highlightColorIndicator: HTMLElement;
  private bulletListBtn: HTMLButtonElement;
  private numberedListBtn: HTMLButtonElement;
  private alignLeftBtn: HTMLButtonElement;
  private alignCenterBtn: HTMLButtonElement;
  private alignRightBtn: HTMLButtonElement;
  private alignJustifyBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private redoBtn: HTMLButtonElement;
  private clearFormatBtn: HTMLButtonElement;

  constructor() {
    this.notesEditor = document.getElementById('notes-editor') as HTMLElement;
    this.charCount = document.getElementById('char-count') as HTMLElement;
    this.wordCount = document.getElementById('word-count') as HTMLElement;
    this.boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
    this.italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
    this.underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
    this.fontFamilySelect = document.getElementById('font-family-select') as HTMLSelectElement;
    this.fontSizeSelect = document.getElementById('font-size-select') as HTMLSelectElement;
    this.textColorBtn = document.getElementById('text-color-btn') as HTMLButtonElement;
    this.highlightColorBtn = document.getElementById('highlight-color-btn') as HTMLButtonElement;
    this.textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement;
    this.highlightColorPicker = document.getElementById('highlight-color-picker') as HTMLInputElement;
    this.textColorIndicator = document.getElementById('text-color-indicator') as HTMLElement;
    this.highlightColorIndicator = document.getElementById('highlight-color-indicator') as HTMLElement;
    this.bulletListBtn = document.getElementById('bullet-list-btn') as HTMLButtonElement;
    this.numberedListBtn = document.getElementById('numbered-list-btn') as HTMLButtonElement;
    this.alignLeftBtn = document.getElementById('align-left-btn') as HTMLButtonElement;
    this.alignCenterBtn = document.getElementById('align-center-btn') as HTMLButtonElement;
    this.alignRightBtn = document.getElementById('align-right-btn') as HTMLButtonElement;
    this.alignJustifyBtn = document.getElementById('align-justify-btn') as HTMLButtonElement;
    this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
    this.clearFormatBtn = document.getElementById('clear-format-btn') as HTMLButtonElement;
  }

  /**
   * Initialize editor event listeners
   */
  initialize(): void {
    // Basic formatting toolbar
    this.boldBtn.addEventListener('click', () => this.applyFormat('bold'));
    this.italicBtn.addEventListener('click', () => this.applyFormat('italic'));
    this.underlineBtn.addEventListener('click', () => this.applyFormat('underline'));
    
    // Font controls
    this.fontFamilySelect.addEventListener('change', () => this.applyFontFamily());
    this.fontSizeSelect.addEventListener('change', () => this.applyFontSize());
    
    // Color button controls - trigger hidden pickers
    this.textColorBtn.addEventListener('click', () => {
      this.textColorPicker.click();
    });
    this.highlightColorBtn.addEventListener('click', () => {
      this.highlightColorPicker.click();
    });
    
    // Color picker changes
    this.textColorPicker.addEventListener('change', () => {
      const color = this.textColorPicker.value;
      this.textColorIndicator.style.backgroundColor = color;
      this.applyFormat('foreColor', color);
    });
    this.highlightColorPicker.addEventListener('change', () => {
      const color = this.highlightColorPicker.value;
      this.highlightColorIndicator.style.backgroundColor = color;
      this.applyHighlight();
    });
    
    // List controls
    this.bulletListBtn.addEventListener('click', () => this.toggleList('unordered'));
    this.numberedListBtn.addEventListener('click', () => this.toggleList('ordered'));
    
    // Alignment controls
    this.alignLeftBtn.addEventListener('click', () => this.applyAlignment('left'));
    this.alignCenterBtn.addEventListener('click', () => this.applyAlignment('center'));
    this.alignRightBtn.addEventListener('click', () => this.applyAlignment('right'));
    this.alignJustifyBtn.addEventListener('click', () => this.applyAlignment('justify'));
    
    // Undo/Redo controls
    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());
    
    // Clear formatting
    this.clearFormatBtn.addEventListener('click', () => this.clearFormatting());
    
    // Update stats on input
    this.notesEditor.addEventListener('input', () => this.updateStats());
    
    // Keyboard shortcuts
    this.notesEditor.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            this.applyFormat('bold');
            break;
          case 'i':
            e.preventDefault();
            this.applyFormat('italic');
            break;
          case 'u':
            e.preventDefault();
            this.applyFormat('underline');
            break;
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              this.redo();
            } else {
              e.preventDefault();
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
        }
      }
    });
    
    // Selection change listener for active state detection
    document.addEventListener('selectionchange', () => {
      this.updateButtonStates();
    });
    
    // Also update on mouse up (for clicks)
    this.notesEditor.addEventListener('mouseup', () => {
      this.updateButtonStates();
    });
    
    // Initial state update
    this.updateButtonStates();
  }

  /**
   * Update button active states based on current selection
   */
  private updateButtonStates(): void {
    try {
      // Update formatting buttons
      this.updateButtonState(this.boldBtn, 'bold');
      this.updateButtonState(this.italicBtn, 'italic');
      this.updateButtonState(this.underlineBtn, 'underline');
      
      // Update list buttons
      this.updateButtonState(this.bulletListBtn, 'insertUnorderedList');
      this.updateButtonState(this.numberedListBtn, 'insertOrderedList');
      
      // Update alignment buttons
      this.updateButtonState(this.alignLeftBtn, 'justifyLeft');
      this.updateButtonState(this.alignCenterBtn, 'justifyCenter');
      this.updateButtonState(this.alignRightBtn, 'justifyRight');
      this.updateButtonState(this.alignJustifyBtn, 'justifyFull');
    } catch (e) {
      // Silently fail if selection is not in editor
    }
  }

  /**
   * Update individual button state
   */
  private updateButtonState(button: HTMLButtonElement, command: string): void {
    try {
      const isActive = document.queryCommandState(command);
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    } catch (e) {
      button.classList.remove('active');
    }
  }

  /**
   * Apply formatting to selected text
   */
  private applyFormat(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.notesEditor.focus();
  }

  /**
   * Apply font family to selected text
   */
  private applyFontFamily(): void {
    const font = this.fontFamilySelect.value;
    this.applyFormat('fontName', font);
  }

  /**
   * Apply font size to selected text using CSS (allows multiple applications)
   */
  private applyFontSize(): void {
    const size = this.fontSizeSelect.value;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    
    const range = selection.getRangeAt(0);
    
    // If nothing is selected, do nothing
    if (range.collapsed) {
      return;
    }
    
    // Create a span with the font size
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    
    try {
      // Extract the selected content
      const contents = range.extractContents();
      
      // Remove any existing font size spans to avoid nesting
      const existingSpans = contents.querySelectorAll('span[style*="font-size"]');
      existingSpans.forEach(existingSpan => {
        const spanElement = existingSpan as HTMLElement;
        // Remove the font-size style but keep other styles
        spanElement.style.fontSize = '';
        // If no other styles remain, unwrap the span
        if (!spanElement.getAttribute('style')) {
          const parent = spanElement.parentNode;
          while (spanElement.firstChild) {
            parent?.insertBefore(spanElement.firstChild, spanElement);
          }
          parent?.removeChild(spanElement);
        }
      });
      
      // Add the content to our new span
      span.appendChild(contents);
      
      // Insert the span at the selection
      range.insertNode(span);
      
      // Restore selection
      range.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      console.error('Error applying font size:', e);
    }
    
    this.notesEditor.focus();
  }

  /**
   * Apply highlight color to selected text
   */
  private applyHighlight(): void {
    const color = this.highlightColorPicker.value;
    this.applyFormat('backColor', color);
  }

  /**
   * Toggle list formatting
   */
  private toggleList(type: 'ordered' | 'unordered'): void {
    const command = type === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList';
    this.applyFormat(command);
  }

  /**
   * Apply text alignment
   */
  private applyAlignment(align: 'left' | 'center' | 'right' | 'justify'): void {
    const commands = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull'
    };
    this.applyFormat(commands[align]);
  }

  /**
   * Undo last action
   */
  private undo(): void {
    document.execCommand('undo', false);
    this.notesEditor.focus();
  }

  /**
   * Redo last undone action
   */
  private redo(): void {
    document.execCommand('redo', false);
    this.notesEditor.focus();
  }

  /**
   * Clear all formatting from selected text
   */
  private clearFormatting(): void {
    this.applyFormat('removeFormat');
  }

  /**
   * Update editor statistics (character and word count)
   */
  private updateStats(): void {
    const text = this.notesEditor.textContent || '';
    
    // Character count
    const chars = text.length;
    this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
    
    // Word count
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  /**
   * Get current notes text
   */
  getNotesText(): string {
    return this.notesEditor.textContent || '';
  }

  /**
   * Set notes text
   */
  setNotesText(text: string): void {
    this.notesEditor.innerHTML = text.replace(/\n/g, '<br>');
    this.updateStats();
  }

  /**
   * Append text to notes
   */
  appendToNotes(text: string): void {
    this.notesEditor.innerHTML += text.replace(/\n/g, '<br>');
    this.updateStats();
  }

  /**
   * Clear notes
   */
  clearNotes(): void {
    this.notesEditor.innerHTML = '';
    this.updateStats();
  }
}
