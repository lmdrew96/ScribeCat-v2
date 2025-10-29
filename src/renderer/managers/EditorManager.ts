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
  private fontSizeSelect: HTMLSelectElement;
  private textColorPicker: HTMLInputElement;

  constructor() {
    this.notesEditor = document.getElementById('notes-editor') as HTMLElement;
    this.charCount = document.getElementById('char-count') as HTMLElement;
    this.wordCount = document.getElementById('word-count') as HTMLElement;
    this.boldBtn = document.getElementById('bold-btn') as HTMLButtonElement;
    this.italicBtn = document.getElementById('italic-btn') as HTMLButtonElement;
    this.underlineBtn = document.getElementById('underline-btn') as HTMLButtonElement;
    this.fontSizeSelect = document.getElementById('font-size-select') as HTMLSelectElement;
    this.textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement;
  }

  /**
   * Initialize editor event listeners
   */
  initialize(): void {
    // Formatting toolbar
    this.boldBtn.addEventListener('click', () => this.applyFormat('bold'));
    this.italicBtn.addEventListener('click', () => this.applyFormat('italic'));
    this.underlineBtn.addEventListener('click', () => this.applyFormat('underline'));
    
    this.fontSizeSelect.addEventListener('change', () => {
      const size = this.fontSizeSelect.value;
      this.applyFormat('fontSize', `${size}px`);
    });
    
    this.textColorPicker.addEventListener('change', () => {
      const color = this.textColorPicker.value;
      this.applyFormat('foreColor', color);
    });
    
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
        }
      }
    });
  }

  /**
   * Apply formatting to selected text
   */
  private applyFormat(command: string, value?: string): void {
    document.execCommand(command, false, value);
    this.notesEditor.focus();
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
