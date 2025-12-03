/**
 * ToolbarImageOptions
 *
 * Handles image and text box options: anchor type, wrap type, float direction, offset.
 */

import type { TiptapEditorCore } from '../TiptapEditorCore.js';
import { createLogger } from '../../../../shared/logger.js';

const logger = createLogger('ToolbarImageOptions');

export interface ImageOptionElements {
  anchorTypeBtn: HTMLButtonElement;
  anchorTypePalette: HTMLElement;
  anchorTypeDropdown: HTMLElement;
  wrapTypeBtn: HTMLButtonElement;
  wrapTypePalette: HTMLElement;
  wrapTypeDropdown: HTMLElement;
  imageAlignLeftBtn: HTMLButtonElement;
  imageAlignRightBtn: HTMLButtonElement;
  imageIndentBtn: HTMLButtonElement;
  imageOutdentBtn: HTMLButtonElement;
}

export interface PalettePositioner {
  positionPaletteRelativeToButton(button: HTMLElement, palette: HTMLElement): void;
}

export class ToolbarImageOptions {
  private editorCore: TiptapEditorCore;
  private elements: ImageOptionElements;
  private palettePositioner: PalettePositioner;

  constructor(
    editorCore: TiptapEditorCore,
    elements: ImageOptionElements,
    palettePositioner: PalettePositioner
  ) {
    this.editorCore = editorCore;
    this.elements = elements;
    this.palettePositioner = palettePositioner;
  }

  /**
   * Set up image option event listeners
   */
  setup(closePalettes: () => void): void {
    // Anchor type palette toggle
    this.elements.anchorTypeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.elements.anchorTypePalette.classList.contains('show');
      this.elements.anchorTypePalette.classList.toggle('show');
      closePalettes();

      if (!isShowing) {
        this.elements.anchorTypePalette.classList.add('show');
        this.palettePositioner.positionPaletteRelativeToButton(
          this.elements.anchorTypeBtn,
          this.elements.anchorTypePalette
        );
      }
    });

    // Anchor type palette options
    this.elements.anchorTypePalette.querySelectorAll('.anchor-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const anchorType = (e.currentTarget as HTMLElement).getAttribute('data-anchor');
        if (anchorType) {
          this.changeImageAnchor(anchorType);
          this.elements.anchorTypePalette.classList.remove('show');
        }
      });
    });

    // Wrap type palette toggle
    this.elements.wrapTypeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = this.elements.wrapTypePalette.classList.contains('show');
      this.elements.wrapTypePalette.classList.toggle('show');
      closePalettes();

      if (!isShowing) {
        this.elements.wrapTypePalette.classList.add('show');
        this.palettePositioner.positionPaletteRelativeToButton(
          this.elements.wrapTypeBtn,
          this.elements.wrapTypePalette
        );
      }
    });

    // Wrap type palette options
    this.elements.wrapTypePalette.querySelectorAll('.wrap-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const wrapType = (e.currentTarget as HTMLElement).getAttribute('data-wrap');
        if (wrapType) {
          this.changeImageWrapType(wrapType);
          this.elements.wrapTypePalette.classList.remove('show');
        }
      });
    });

    // Image alignment buttons
    this.elements.imageAlignLeftBtn.addEventListener('click', () => {
      this.changeImageFloatDirection('left');
    });

    this.elements.imageAlignRightBtn.addEventListener('click', () => {
      this.changeImageFloatDirection('right');
    });

    // Image position adjustment buttons
    this.elements.imageIndentBtn.addEventListener('click', () => {
      this.adjustImageHorizontalOffset(-20);
    });

    this.elements.imageOutdentBtn.addEventListener('click', () => {
      this.adjustImageHorizontalOffset(20);
    });
  }

  /**
   * Change image wrap type
   */
  private changeImageWrapType(wrapType: string): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false;
      }
    });

    if (!imageNode || imagePos === null) return;

    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      wrapType: wrapType,
    });

    editor.view.dispatch(tr);
  }

  /**
   * Change image float direction
   */
  private changeImageFloatDirection(direction: 'left' | 'right' | 'none'): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false;
      }
    });

    if (!imageNode || imagePos === null) return;

    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      floatDirection: direction,
    });

    editor.view.dispatch(tr);
  }

  /**
   * Adjust image horizontal offset
   */
  private adjustImageHorizontalOffset(delta: number): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false;
      }
    });

    if (!imageNode || imagePos === null) return;

    const currentOffset = imageNode.attrs.horizontalOffset || 0;
    const newOffset = Math.max(-100, Math.min(100, currentOffset + delta));

    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      horizontalOffset: newOffset,
    });

    editor.view.dispatch(tr);
  }

  /**
   * Change image anchor type
   */
  private changeImageAnchor(anchorType: string): void {
    const editor = this.editorCore.getEditor();
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;

    let imageNode: any = null;
    let imagePos: number | null = null;

    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === 'draggableImage' || node.type.name === 'draggableTextBox') {
        imageNode = node;
        imagePos = pos;
        return false;
      }
    });

    if (!imageNode || imagePos === null) return;

    const tr = state.tr.setNodeMarkup(imagePos, undefined, {
      ...imageNode.attrs,
      anchorType: anchorType,
      posX: anchorType === 'page' ? (imageNode.attrs.posX || 20) : null,
      posY: anchorType === 'page' ? (imageNode.attrs.posY || 20) : null,
    });

    editor.view.dispatch(tr);
  }

  /**
   * Update image option UI states based on selection
   */
  updateStates(): void {
    const imageAttrs = this.editorCore.getAttributes('draggableImage');
    const textboxAttrs = this.editorCore.getAttributes('draggableTextBox');
    const isImageSelected = Object.keys(imageAttrs).length > 0;
    const isTextBoxSelected = Object.keys(textboxAttrs).length > 0;
    const isPositionableSelected = isImageSelected || isTextBoxSelected;

    const attrs = isImageSelected ? imageAttrs : textboxAttrs;
    const anchorType = attrs.anchorType || 'paragraph';

    // Always show anchor dropdown when image or text box is selected
    this.elements.anchorTypeDropdown.style.display = isPositionableSelected ? 'inline-block' : 'none';

    // Only show wrap dropdown for paragraph-anchored items
    const showWrapDropdown = isPositionableSelected && anchorType === 'paragraph';
    this.elements.wrapTypeDropdown.style.display = showWrapDropdown ? 'inline-block' : 'none';

    // Show alignment and position buttons for paragraph-anchored items with wrapping enabled
    const wrapType = attrs.wrapType || 'square';
    const showPositionControls = isPositionableSelected && anchorType === 'paragraph' &&
                                  (wrapType === 'square' || wrapType === 'tight');
    this.elements.imageAlignLeftBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.elements.imageAlignRightBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.elements.imageIndentBtn.style.display = showPositionControls ? 'inline-block' : 'none';
    this.elements.imageOutdentBtn.style.display = showPositionControls ? 'inline-block' : 'none';

    if (isPositionableSelected) {
      // Update active anchor type in palette
      this.elements.anchorTypePalette.querySelectorAll('.anchor-option').forEach(option => {
        if (option.getAttribute('data-anchor') === anchorType) {
          option.classList.add('active');
        } else {
          option.classList.remove('active');
        }
      });

      // Update active wrap type in palette (if applicable)
      if (anchorType === 'paragraph') {
        this.elements.wrapTypePalette.querySelectorAll('.wrap-option').forEach(option => {
          if (option.getAttribute('data-wrap') === wrapType) {
            option.classList.add('active');
          } else {
            option.classList.remove('active');
          }
        });

        // Update active alignment button
        if (wrapType === 'square' || wrapType === 'tight') {
          const floatDirection = attrs.floatDirection || 'left';
          this.updateButtonState(this.elements.imageAlignLeftBtn, floatDirection === 'left');
          this.updateButtonState(this.elements.imageAlignRightBtn, floatDirection === 'right');
        }
      }
    }
  }

  /**
   * Update individual button state
   */
  private updateButtonState(button: HTMLButtonElement, isActive: boolean): void {
    if (isActive) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }

  /**
   * Close all palettes
   */
  closePalettes(): void {
    this.elements.anchorTypePalette.classList.remove('show');
    this.elements.wrapTypePalette.classList.remove('show');
  }
}
