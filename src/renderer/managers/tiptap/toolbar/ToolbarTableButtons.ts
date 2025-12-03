/**
 * ToolbarTableButtons
 *
 * Handles table row and column operations.
 */

import type { TiptapEditorCore } from '../TiptapEditorCore.js';

export interface TableButtonElements {
  tableToolbar: HTMLElement;
  addRowBeforeBtn: HTMLButtonElement;
  addRowAfterBtn: HTMLButtonElement;
  addColBeforeBtn: HTMLButtonElement;
  addColAfterBtn: HTMLButtonElement;
  deleteRowBtn: HTMLButtonElement;
  deleteColBtn: HTMLButtonElement;
  deleteTableBtn: HTMLButtonElement;
}

export class ToolbarTableButtons {
  /**
   * Set up table button event listeners
   */
  static setup(editorCore: TiptapEditorCore, elements: TableButtonElements): void {
    elements.addRowBeforeBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().addRowBefore().run();
    });

    elements.addRowAfterBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().addRowAfter().run();
    });

    elements.addColBeforeBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().addColumnBefore().run();
    });

    elements.addColAfterBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().addColumnAfter().run();
    });

    elements.deleteRowBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().deleteRow().run();
    });

    elements.deleteColBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().deleteColumn().run();
    });

    elements.deleteTableBtn.addEventListener('click', () => {
      editorCore.chain()?.focus().deleteTable().run();
    });
  }

  /**
   * Update table toolbar visibility based on selection
   */
  static updateVisibility(editorCore: TiptapEditorCore, elements: TableButtonElements): void {
    const isInTable = editorCore.isActive('table');
    elements.tableToolbar.style.display = isInTable ? 'flex' : 'none';
  }
}
