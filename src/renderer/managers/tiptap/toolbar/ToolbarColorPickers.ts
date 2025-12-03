/**
 * ToolbarColorPickers
 *
 * Sets up color and background color palette functionality.
 */

import type { TiptapEditorCore } from '../TiptapEditorCore.js';
import { EditorColorPalettes } from '../../../components/editor/ColorPicker.js';
import { createLogger } from '../../../../shared/logger.js';

const logger = createLogger('ToolbarColorPickers');

export interface ColorPickerElements {
  colorBtn: HTMLButtonElement;
  colorPalette: HTMLElement;
  bgColorBtn: HTMLButtonElement;
  bgColorPalette: HTMLElement;
}

export class ToolbarColorPickers {
  private editorCore: TiptapEditorCore;
  private elements: ColorPickerElements;
  private paletteClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(editorCore: TiptapEditorCore, elements: ColorPickerElements) {
    this.editorCore = editorCore;
    this.elements = elements;
  }

  /**
   * Initialize color pickers
   */
  initialize(): void {
    this.movePalettesToBody();
    this.setupColorPalette();
    this.setupBgColorPalette();
    this.setupButtonListeners();
    this.setupDocumentClickHandler();
  }

  /**
   * Move palette elements to document.body to escape parent overflow clipping
   */
  private movePalettesToBody(): void {
    document.body.appendChild(this.elements.colorPalette);
    document.body.appendChild(this.elements.bgColorPalette);
    logger.info('Moved color palettes to document.body');
  }

  /**
   * Position a palette element relative to a button
   */
  positionPaletteRelativeToButton(button: HTMLElement, palette: HTMLElement): void {
    const buttonRect = button.getBoundingClientRect();
    const top = buttonRect.bottom + 6;
    const left = buttonRect.left;

    palette.style.top = `${top}px`;
    palette.style.left = `${left}px`;

    requestAnimationFrame(() => {
      const paletteRect = palette.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (paletteRect.right > viewportWidth) {
        const adjustedLeft = viewportWidth - paletteRect.width - 10;
        palette.style.left = `${Math.max(10, adjustedLeft)}px`;
      }

      if (paletteRect.bottom > viewportHeight) {
        const adjustedTop = buttonRect.top - paletteRect.height - 6;
        palette.style.top = `${Math.max(10, adjustedTop)}px`;
      }
    });
  }

  /**
   * Set up button click listeners
   */
  private setupButtonListeners(): void {
    this.elements.colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.elements.colorPalette.classList.contains('show');
      this.elements.colorPalette.classList.toggle('show');
      this.elements.bgColorPalette.classList.remove('show');

      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.elements.colorBtn, this.elements.colorPalette);
      }
    });

    this.elements.bgColorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.elements.bgColorPalette.classList.contains('show');
      this.elements.bgColorPalette.classList.toggle('show');
      this.elements.colorPalette.classList.remove('show');

      if (!isShowing) {
        this.positionPaletteRelativeToButton(this.elements.bgColorBtn, this.elements.bgColorPalette);
      }
    });
  }

  /**
   * Set up document click handler to close palettes
   */
  private setupDocumentClickHandler(): void {
    this.paletteClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#color-btn') &&
          !target.closest('#bg-color-btn') &&
          !target.closest('#color-palette') &&
          !target.closest('#bg-color-palette')) {
        this.elements.colorPalette.classList.remove('show');
        this.elements.bgColorPalette.classList.remove('show');
      }
    };
    document.addEventListener('click', this.paletteClickHandler);
  }

  /**
   * Set up color palette swatches
   */
  private setupColorPalette(): void {
    this.elements.colorPalette.innerHTML = '';

    EditorColorPalettes.textColors.forEach(({ name, value }) => {
      const swatch = document.createElement('div');
      swatch.className = 'editor-color-swatch';
      swatch.setAttribute('data-color', value);
      swatch.setAttribute('title', name);
      swatch.style.background = value;

      if (value === '#FFFFFF' || value === '#EEEEEE') {
        swatch.style.border = '1px solid var(--border)';
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editorCore.chain()?.focus().setColor(value).run();
        this.elements.colorPalette.classList.remove('show');
      });

      this.elements.colorPalette.appendChild(swatch);
    });
  }

  /**
   * Set up background color palette swatches
   */
  private setupBgColorPalette(): void {
    this.elements.bgColorPalette.innerHTML = '';

    EditorColorPalettes.highlightColors.forEach(({ name, value }) => {
      const swatch = document.createElement('div');
      swatch.className = 'editor-color-swatch';
      swatch.setAttribute('data-color', value);
      swatch.setAttribute('title', name);
      swatch.style.background = value;

      if (value === '#FFFFFF' || value.toUpperCase().startsWith('#FFF')) {
        swatch.style.border = '1px solid var(--border)';
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editorCore.chain()?.focus().setBackgroundColor(value).run();
        this.elements.bgColorPalette.classList.remove('show');
      });

      this.elements.bgColorPalette.appendChild(swatch);
    });
  }

  /**
   * Close all palettes
   */
  closeAll(): void {
    this.elements.colorPalette.classList.remove('show');
    this.elements.bgColorPalette.classList.remove('show');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.paletteClickHandler) {
      document.removeEventListener('click', this.paletteClickHandler);
      this.paletteClickHandler = null;
    }

    if (this.elements.colorPalette.parentElement === document.body) {
      document.body.removeChild(this.elements.colorPalette);
    }
    if (this.elements.bgColorPalette.parentElement === document.body) {
      document.body.removeChild(this.elements.bgColorPalette);
    }
  }
}
