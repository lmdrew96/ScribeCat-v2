/**
 * DraggableImageExtension
 *
 * Extends the Image extension to add drag-and-drop functionality via custom NodeView
 */

import Image from '@tiptap/extension-image';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeView, EditorView } from '@tiptap/pm/view';

class DraggableImageNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  private img: HTMLImageElement;
  private handle: HTMLDivElement;
  private resizeHandles: HTMLDivElement[] = [];
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  // Resize state
  private isResizing = false;
  private resizeDirection: string | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private startPosX = 0;
  private startPosY = 0;
  // Drag state (mouse-based, not HTML5 drag)
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private elementStartX = 0;
  private elementStartY = 0;
  // Bound method references for proper cleanup
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Create wrapper
    this.dom = document.createElement('div');
    this.dom.className = 'draggable-image-wrapper';
    this.dom.style.lineHeight = '0'; // Prevent extra space around image

    // Apply positioning based on anchor type
    const anchorType = node.attrs.anchorType || 'paragraph';
    this.dom.classList.add(`anchor-${anchorType}`);

    if (anchorType === 'page') {
      // Page-anchored: absolute positioning (free positioning anywhere)
      this.dom.style.position = 'absolute';
      this.dom.classList.add('absolute-positioned');

      // If no position set yet, calculate initial position
      if (node.attrs.posX === null || node.attrs.posY === null) {
        this.dom.style.left = '20px';
        this.dom.style.top = '20px';
      } else {
        this.dom.style.left = `${node.attrs.posX}px`;
        this.dom.style.top = `${node.attrs.posY}px`;
      }
    } else if (anchorType === 'inline') {
      // Inline: flows with text as a character
      this.dom.style.position = 'static';
      this.dom.style.display = 'inline-block';
      this.dom.style.verticalAlign = 'middle';
    } else {
      // Paragraph-anchored (default): positioned relative to paragraph, allows text wrapping
      this.dom.style.position = 'relative';
      this.dom.style.display = 'inline-block';
    }

    // Apply wrapping class (only effective for paragraph-anchored images)
    const wrapType = node.attrs.wrapType || 'square';
    this.dom.classList.add(`wrap-${wrapType}`);

    // Apply float direction class (for paragraph-anchored images with wrapping)
    const floatDirection = node.attrs.floatDirection || 'left';
    this.dom.classList.add(`float-${floatDirection}`);

    // Apply horizontal offset if specified
    const horizontalOffset = node.attrs.horizontalOffset || 0;
    if (horizontalOffset !== 0) {
      if (floatDirection === 'left') {
        this.dom.style.marginLeft = `${horizontalOffset}px`;
      } else if (floatDirection === 'right') {
        this.dom.style.marginRight = `${horizontalOffset}px`;
      }
    }

    // Create drag handle with professional icon
    this.handle = document.createElement('div');
    this.handle.className = 'drag-handle';
    this.handle.contentEditable = 'false';
    this.handle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="5" r="1"/>
        <circle cx="9" cy="12" r="1"/>
        <circle cx="9" cy="19" r="1"/>
        <circle cx="15" cy="5" r="1"/>
        <circle cx="15" cy="12" r="1"/>
        <circle cx="15" cy="19" r="1"/>
      </svg>
    `;
    this.handle.title = 'Drag to move image';

    // Create image
    this.img = document.createElement('img');
    this.img.src = node.attrs.src;
    if (node.attrs.alt) this.img.alt = node.attrs.alt;
    if (node.attrs.title) this.img.title = node.attrs.title;

    // Set dimensions or use natural size
    if (node.attrs.width) {
      this.img.style.width = `${node.attrs.width}px`;
      this.dom.style.width = `${node.attrs.width}px`;
    }
    if (node.attrs.height) {
      this.img.style.height = `${node.attrs.height}px`;
      this.dom.style.height = `${node.attrs.height}px`;
    }

    // If no dimensions set, update attrs with natural dimensions on load
    if (!node.attrs.width || !node.attrs.height) {
      this.img.onload = () => {
        const pos = this.getPos();
        if (pos !== undefined && !this.node.attrs.width) {
          // Set wrapper size to match image
          this.dom.style.width = `${this.img.naturalWidth}px`;
          this.dom.style.height = `${this.img.naturalHeight}px`;

          const tr = this.view.state.tr;
          tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            width: this.img.naturalWidth,
            height: this.img.naturalHeight,
          });
          this.view.dispatch(tr);
        }
      };
    }

    // Create resize handles
    this.createResizeHandles();

    // Store bound method references for proper cleanup
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);

    // Handle mouse-based drag (not HTML5 drag API)
    this.handle.addEventListener('mousedown', this.boundOnMouseDown);

    // Append elements
    this.dom.appendChild(this.handle);
    this.dom.appendChild(this.img);
    this.resizeHandles.forEach(h => this.dom.appendChild(h));
  }

  private createResizeHandles() {
    const directions = ['nw', 'ne', 'se', 'sw'];
    const positions = {
      nw: { top: '-4px', left: '-4px', cursor: 'nw-resize' },
      ne: { top: '-4px', right: '-4px', cursor: 'ne-resize' },
      se: { bottom: '-4px', right: '-4px', cursor: 'se-resize' },
      sw: { bottom: '-4px', left: '-4px', cursor: 'sw-resize' },
    };

    for (const dir of directions) {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-handle-${dir}`;
      handle.contentEditable = 'false';

      const pos = positions[dir as keyof typeof positions];
      Object.assign(handle.style, {
        position: 'absolute',
        width: '8px',
        height: '8px',
        background: 'var(--accent)',
        border: '1px solid var(--background)',
        borderRadius: '50%',
        cursor: pos.cursor,
        ...pos
      });

      handle.addEventListener('mousedown', (e) => this.onResizeStart(e, dir));
      this.resizeHandles.push(handle);
    }
  }

  private onResizeStart(e: MouseEvent, direction: string) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.isResizing = true;
    this.resizeDirection = direction;
    this.startX = e.clientX;
    this.startY = e.clientY;

    // Get current dimensions
    const rect = this.img.getBoundingClientRect();
    this.startWidth = rect.width;
    this.startHeight = rect.height;

    // Store initial position for page-anchored elements
    if (this.node.attrs.anchorType === 'page') {
      this.startPosX = this.node.attrs.posX || 0;
      this.startPosY = this.node.attrs.posY || 0;
    }

    // Add global listeners
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (e: MouseEvent) => {
    if (!this.isResizing || !this.resizeDirection) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    const dir = this.resizeDirection;
    const aspectRatio = this.startWidth / this.startHeight;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;

    // Calculate new dimensions with proper aspect ratio handling per corner
    if (dir === 'se') {
      // SE: grow from top-left corner (simplest case)
      newWidth = Math.max(50, this.startWidth + deltaX);
      newHeight = newWidth / aspectRatio;
    } else if (dir === 'sw') {
      // SW: grow width left, height down
      newWidth = Math.max(50, this.startWidth - deltaX);
      newHeight = newWidth / aspectRatio;
      this.dom.style.left = `${this.startPosX + (this.startWidth - newWidth)}px`;
    } else if (dir === 'ne') {
      // NE: grow width right, height up
      newWidth = Math.max(50, this.startWidth + deltaX);
      newHeight = newWidth / aspectRatio;
      const heightDelta = newHeight - this.startHeight;
      this.dom.style.top = `${this.startPosY - heightDelta}px`;
    } else if (dir === 'nw') {
      // NW: grow from bottom-right (opposite of SE)
      newWidth = Math.max(50, this.startWidth - deltaX);
      newHeight = newWidth / aspectRatio;
      this.dom.style.left = `${this.startPosX + (this.startWidth - newWidth)}px`;
      const heightDelta = newHeight - this.startHeight;
      this.dom.style.top = `${this.startPosY - heightDelta}px`;
    }

    // Update image and wrapper size
    this.img.style.width = `${newWidth}px`;
    this.img.style.height = `${newHeight}px`;
    this.dom.style.width = `${newWidth}px`;
    this.dom.style.height = `${newHeight}px`;
  };

  private onResizeEnd = (e: MouseEvent) => {
    if (!this.isResizing) return;

    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);

    // Update node attributes with new dimensions and position
    const pos = this.getPos();
    if (pos !== undefined) {
      const rect = this.img.getBoundingClientRect();
      const newAttrs: Record<string, unknown> = {
        ...this.node.attrs,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };

      // Save position for page-anchored elements
      if (this.node.attrs.anchorType === 'page') {
        newAttrs.posX = parseInt(this.dom.style.left, 10) || this.node.attrs.posX;
        newAttrs.posY = parseInt(this.dom.style.top, 10) || this.node.attrs.posY;
      }

      const tr = this.view.state.tr;
      tr.setNodeMarkup(pos, undefined, newAttrs);
      this.view.dispatch(tr);
    }

    this.isResizing = false;
    this.resizeDirection = null;
  };

  // Mouse-based drag handlers (replacing HTML5 Drag API)
  private onMouseDown(e: MouseEvent) {
    // Only handle left mouse button
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.elementStartX = this.node.attrs.posX || parseInt(this.dom.style.left, 10) || 0;
    this.elementStartY = this.node.attrs.posY || parseInt(this.dom.style.top, 10) || 0;

    // Visual feedback
    this.dom.classList.add('dragging');

    // Add global listeners for move and up
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    // Move element immediately (smooth visual feedback)
    const newX = this.elementStartX + deltaX;
    const newY = this.elementStartY + deltaY;
    this.dom.style.left = `${Math.max(0, newX)}px`;
    this.dom.style.top = `${Math.max(0, newY)}px`;
  }

  private onMouseUp(e: MouseEvent) {
    if (!this.isDragging) return;

    // Remove global listeners
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);

    this.isDragging = false;
    this.dom.classList.remove('dragging');

    // Commit final position to node attributes
    const pos = this.getPos();
    if (pos !== undefined) {
      const newPosX = parseInt(this.dom.style.left, 10) || 0;
      const newPosY = parseInt(this.dom.style.top, 10) || 0;

      const tr = this.view.state.tr;
      tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        posX: Math.max(0, newPosX),
        posY: Math.max(0, newPosY),
      });
      this.view.dispatch(tr);
    }
  }

  // Tell ProseMirror to let events through for our custom handles
  stopEvent(event: Event) {
    // Let the drag handle receive mouse events
    if (event.target === this.handle || this.handle.contains(event.target as Node)) {
      return true;
    }
    // Let resize handles receive mouse events
    for (const rh of this.resizeHandles) {
      if (event.target === rh || rh.contains(event.target as Node)) {
        return true;
      }
    }
    return false;
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;

    // Don't update during resize or drag to prevent interruption
    if (this.isResizing) {
      return true;
    }
    if (this.isDragging) {
      return true;
    }

    this.node = node;
    this.img.src = node.attrs.src;
    if (node.attrs.alt !== undefined) this.img.alt = node.attrs.alt;
    if (node.attrs.title !== undefined) this.img.title = node.attrs.title;

    // Update image and wrapper dimensions
    if (node.attrs.width) {
      this.img.style.width = `${node.attrs.width}px`;
      this.dom.style.width = `${node.attrs.width}px`;
    }
    if (node.attrs.height) {
      this.img.style.height = `${node.attrs.height}px`;
      this.dom.style.height = `${node.attrs.height}px`;
    }

    // Update positioning based on anchor type
    const anchorType = node.attrs.anchorType || 'paragraph';

    // Reset classes
    this.dom.className = 'draggable-image-wrapper';
    this.dom.classList.add(`anchor-${anchorType}`);

    if (anchorType === 'page') {
      // Page-anchored: absolute positioning
      this.dom.style.position = 'absolute';
      this.dom.classList.add('absolute-positioned');

      if (node.attrs.posX !== null && node.attrs.posY !== null) {
        this.dom.style.left = `${node.attrs.posX}px`;
        this.dom.style.top = `${node.attrs.posY}px`;
      }
      this.dom.style.display = '';
      this.dom.style.verticalAlign = '';
    } else if (anchorType === 'inline') {
      // Inline: flows with text
      this.dom.style.position = 'static';
      this.dom.style.display = 'inline-block';
      this.dom.style.verticalAlign = 'middle';
      this.dom.style.left = '';
      this.dom.style.top = '';
      this.dom.classList.remove('absolute-positioned');
    } else {
      // Paragraph-anchored: relative positioning with text wrapping
      this.dom.style.position = 'relative';
      this.dom.style.display = 'inline-block';
      this.dom.style.verticalAlign = '';
      this.dom.style.left = '';
      this.dom.style.top = '';
      this.dom.classList.remove('absolute-positioned');
    }

    // Update wrapping class
    const wrapType = node.attrs.wrapType || 'square';
    this.dom.classList.add(`wrap-${wrapType}`);

    // Update float direction class
    const floatDirection = node.attrs.floatDirection || 'left';
    this.dom.classList.add(`float-${floatDirection}`);

    // Update horizontal offset
    const horizontalOffset = node.attrs.horizontalOffset || 0;
    // Reset margin first
    this.dom.style.marginLeft = '';
    this.dom.style.marginRight = '';
    if (horizontalOffset !== 0) {
      if (floatDirection === 'left') {
        this.dom.style.marginLeft = `${horizontalOffset}px`;
      } else if (floatDirection === 'right') {
        this.dom.style.marginRight = `${horizontalOffset}px`;
      }
    }

    return true;
  }

  destroy() {
    // Clean up drag listeners
    this.handle.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);

    // Clean up resize listeners
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }
}

export const DraggableImage = Image.extend({
  name: 'draggableImage',

  addAttributes() {
    return {
      ...this.parent?.(),
      anchorType: {
        default: 'page',
        parseHTML: element => element.getAttribute('data-anchor-type') || 'page',
        renderHTML: attributes => {
          return { 'data-anchor-type': attributes.anchorType };
        },
      },
      posX: {
        default: null,
        parseHTML: element => {
          const val = element.getAttribute('data-pos-x');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: attributes => {
          if (attributes.posX !== null && attributes.posX !== undefined) {
            return { 'data-pos-x': attributes.posX };
          }
          return {};
        },
      },
      posY: {
        default: null,
        parseHTML: element => {
          const val = element.getAttribute('data-pos-y');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: attributes => {
          if (attributes.posY !== null && attributes.posY !== undefined) {
            return { 'data-pos-y': attributes.posY };
          }
          return {};
        },
      },
      wrapType: {
        default: 'square',
        parseHTML: element => element.getAttribute('data-wrap-type') || 'square',
        renderHTML: attributes => {
          return { 'data-wrap-type': attributes.wrapType };
        },
      },
      floatDirection: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-float-direction') || 'left',
        renderHTML: attributes => {
          return { 'data-float-direction': attributes.floatDirection };
        },
      },
      horizontalOffset: {
        default: 0,
        parseHTML: element => {
          const val = element.getAttribute('data-horizontal-offset');
          return val ? parseInt(val, 10) : 0;
        },
        renderHTML: attributes => {
          if (attributes.horizontalOffset) {
            return { 'data-horizontal-offset': attributes.horizontalOffset };
          }
          return {};
        },
      },
    };
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      return new DraggableImageNodeView(node, view, getPos as () => number | undefined);
    };
  },

  // No ProseMirror plugins needed - drag is handled via mouse events in NodeView
});
