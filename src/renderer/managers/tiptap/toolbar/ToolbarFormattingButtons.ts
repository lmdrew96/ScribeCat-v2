/**
 * ToolbarFormattingButtons
 *
 * Sets up event listeners for basic formatting buttons.
 */

import type { TiptapEditorCore } from '../TiptapEditorCore.js';

export interface FormattingButtonElements {
  boldBtn: HTMLButtonElement;
  italicBtn: HTMLButtonElement;
  underlineBtn: HTMLButtonElement;
  strikeBtn: HTMLButtonElement;
  superscriptBtn: HTMLButtonElement;
  subscriptBtn: HTMLButtonElement;
  fontSizeSelect: HTMLSelectElement;
  alignLeftBtn: HTMLButtonElement;
  alignCenterBtn: HTMLButtonElement;
  alignRightBtn: HTMLButtonElement;
  alignJustifyBtn: HTMLButtonElement;
  heading1Btn: HTMLButtonElement;
  heading2Btn: HTMLButtonElement;
  bulletListBtn: HTMLButtonElement;
  numberedListBtn: HTMLButtonElement;
  blockquoteBtn: HTMLButtonElement;
  codeBtn: HTMLButtonElement;
  codeBlockBtn: HTMLButtonElement;
  dividerBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  redoBtn: HTMLButtonElement;
  clearFormatBtn: HTMLButtonElement;
}

export class ToolbarFormattingButtons {
  /**
   * Set up formatting button event listeners
   */
  static setup(editorCore: TiptapEditorCore, elements: FormattingButtonElements): void {
    elements.boldBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleBold().run();
    });

    elements.italicBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleItalic().run();
    });

    elements.underlineBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleUnderline().run();
    });

    elements.superscriptBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleSuperscript().run();
    });

    elements.subscriptBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleSubscript().run();
    });

    elements.strikeBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleStrike().run();
    });

    elements.fontSizeSelect.addEventListener('change', (e) => {
      const size = (e.target as HTMLSelectElement).value;
      if (size) {
        editorCore.chain()?.focus().setFontSize(size).run();
      } else {
        editorCore.chain()?.focus().unsetFontSize().run();
      }
    });

    elements.alignLeftBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().setTextAlign('left').run();
    });

    elements.alignCenterBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().setTextAlign('center').run();
    });

    elements.alignRightBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().setTextAlign('right').run();
    });

    elements.alignJustifyBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().setTextAlign('justify').run();
    });

    elements.heading1Btn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleHeading({ level: 1 }).run();
    });

    elements.heading2Btn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleHeading({ level: 2 }).run();
    });

    elements.bulletListBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleBulletList().run();
    });

    elements.numberedListBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleOrderedList().run();
    });

    elements.blockquoteBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleBlockquote().run();
    });

    elements.codeBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleCode().run();
    });

    elements.codeBlockBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().toggleCodeBlock().run();
    });

    elements.dividerBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().setHorizontalRule().run();
    });

    elements.undoBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().undo().run();
    });

    elements.redoBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().redo().run();
    });

    elements.clearFormatBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().clearNodes().unsetAllMarks().run();
    });
  }

  /**
   * Update button active states
   */
  static updateStates(editorCore: TiptapEditorCore, elements: FormattingButtonElements): void {
    ToolbarFormattingButtons.updateButtonState(elements.boldBtn, editorCore.isActive('bold'));
    ToolbarFormattingButtons.updateButtonState(elements.italicBtn, editorCore.isActive('italic'));
    ToolbarFormattingButtons.updateButtonState(elements.underlineBtn, editorCore.isActive('underline'));
    ToolbarFormattingButtons.updateButtonState(elements.strikeBtn, editorCore.isActive('strike'));
    ToolbarFormattingButtons.updateButtonState(elements.superscriptBtn, editorCore.isActive('superscript'));
    ToolbarFormattingButtons.updateButtonState(elements.subscriptBtn, editorCore.isActive('subscript'));

    ToolbarFormattingButtons.updateButtonState(elements.alignLeftBtn, editorCore.isActive({ textAlign: 'left' }));
    ToolbarFormattingButtons.updateButtonState(elements.alignCenterBtn, editorCore.isActive({ textAlign: 'center' }));
    ToolbarFormattingButtons.updateButtonState(elements.alignRightBtn, editorCore.isActive({ textAlign: 'right' }));
    ToolbarFormattingButtons.updateButtonState(elements.alignJustifyBtn, editorCore.isActive({ textAlign: 'justify' }));

    const currentFontSize = editorCore.getAttributes('textStyle').fontSize || '';
    elements.fontSizeSelect.value = currentFontSize;

    ToolbarFormattingButtons.updateButtonState(elements.heading1Btn, editorCore.isActive('heading', { level: 1 }));
    ToolbarFormattingButtons.updateButtonState(elements.heading2Btn, editorCore.isActive('heading', { level: 2 }));

    ToolbarFormattingButtons.updateButtonState(elements.bulletListBtn, editorCore.isActive('bulletList'));
    ToolbarFormattingButtons.updateButtonState(elements.numberedListBtn, editorCore.isActive('orderedList'));

    ToolbarFormattingButtons.updateButtonState(elements.blockquoteBtn, editorCore.isActive('blockquote'));
    ToolbarFormattingButtons.updateButtonState(elements.codeBtn, editorCore.isActive('code'));
    ToolbarFormattingButtons.updateButtonState(elements.codeBlockBtn, editorCore.isActive('codeBlock'));

    elements.undoBtn.disabled = !editorCore.canUndo();
    elements.redoBtn.disabled = !editorCore.canRedo();
  }

  /**
   * Update individual button state
   */
  static updateButtonState(button: HTMLButtonElement, isActive: boolean): void {
    if (isActive) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }
}
