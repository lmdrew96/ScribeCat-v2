/**
 * InlineEditor - Shared inline editing component
 *
 * Provides reusable inline editing functionality for text fields.
 * Commonly used for title editing with click-to-edit behavior.
 */

export interface InlineEditorConfig {
  element: HTMLElement;
  currentValue: string;
  placeholder?: string;
  onSave: (newValue: string) => Promise<void> | void;
  onCancel?: () => void;
  validator?: (value: string) => boolean | string; // true for valid, string for error message
  inputType?: 'text' | 'textarea';
  selectOnFocus?: boolean;
}

export class InlineEditor {
  private config: InlineEditorConfig;
  private originalElement: HTMLElement;
  private inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;

  constructor(config: InlineEditorConfig) {
    this.config = {
      placeholder: '',
      selectOnFocus: true,
      inputType: 'text',
      ...config
    };
    this.originalElement = config.element;
  }

  /**
   * Start inline editing
   */
  public start(): void {
    if (this.inputElement) {
      // Already editing
      return;
    }

    // Create input element
    this.inputElement = this.createInputElement();

    // Replace element with input
    this.originalElement.replaceWith(this.inputElement);

    // Focus and select
    this.inputElement.focus();
    if (this.config.selectOnFocus) {
      this.inputElement.select();
    }

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Create the input element
   */
  private createInputElement(): HTMLInputElement | HTMLTextAreaElement {
    const isTextarea = this.config.inputType === 'textarea';
    const input = document.createElement(isTextarea ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;

    if (!isTextarea) {
      (input as HTMLInputElement).type = 'text';
    }

    input.value = this.config.currentValue;
    input.placeholder = this.config.placeholder || '';
    input.className = 'inline-edit-input';

    // Apply default styles
    input.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      background-color: var(--bg-tertiary, #1e1e1e);
      color: var(--text-primary, #fff);
      border: 2px solid var(--accent, #3498db);
      border-radius: 4px;
      outline: none;
      ${isTextarea ? 'min-height: 60px; resize: vertical;' : ''}
    `;

    return input;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.inputElement) return;

    // Save on blur
    this.inputElement.addEventListener('blur', () => {
      this.save();
    });

    // Handle keyboard events
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.config.inputType !== 'textarea') {
        e.preventDefault();
        this.save();
      } else if (e.key === 'Enter' && e.ctrlKey && this.config.inputType === 'textarea') {
        // Ctrl+Enter to save in textarea
        e.preventDefault();
        this.save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    });
  }

  /**
   * Save the edited value
   */
  private async save(): Promise<void> {
    if (!this.inputElement) return;

    const newValue = this.inputElement.value.trim();

    // Validate if validator provided
    if (this.config.validator) {
      const validationResult = this.config.validator(newValue);
      if (validationResult !== true) {
        // Show error (could be enhanced with visual feedback)
        const errorMessage = typeof validationResult === 'string'
          ? validationResult
          : 'Invalid value';
        console.warn('Validation failed:', errorMessage);
        this.inputElement.focus();
        return;
      }
    }

    // Only save if value changed
    if (newValue !== this.config.currentValue) {
      try {
        await this.config.onSave(newValue);
        this.config.currentValue = newValue;
      } catch (error) {
        console.error('Failed to save:', error);
        // Restore input for retry
        this.inputElement.focus();
        return;
      }
    }

    this.restore(newValue || this.config.currentValue);
  }

  /**
   * Cancel editing
   */
  private cancel(): void {
    if (this.config.onCancel) {
      this.config.onCancel();
    }
    this.restore(this.config.currentValue);
  }

  /**
   * Restore the original element
   */
  private restore(displayValue: string): void {
    if (!this.inputElement) return;

    // Update original element text
    this.originalElement.textContent = displayValue;

    // Replace input with original element
    this.inputElement.replaceWith(this.originalElement);
    this.inputElement = null;
  }

  /**
   * Static convenience method: Simple inline edit
   */
  public static edit(
    element: HTMLElement,
    currentValue: string,
    onSave: (newValue: string) => Promise<void> | void
  ): InlineEditor {
    const editor = new InlineEditor({
      element,
      currentValue,
      onSave
    });
    editor.start();
    return editor;
  }

  /**
   * Static convenience method: Edit with validation
   */
  public static editWithValidation(
    element: HTMLElement,
    currentValue: string,
    onSave: (newValue: string) => Promise<void> | void,
    validator: (value: string) => boolean | string
  ): InlineEditor {
    const editor = new InlineEditor({
      element,
      currentValue,
      onSave,
      validator
    });
    editor.start();
    return editor;
  }
}
