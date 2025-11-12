/**
 * DraggableImageExtension
 *
 * Extends the Image extension to add drag-and-drop functionality via custom NodeView
 */

import Image from '@tiptap/extension-image';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeView, EditorView } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';

class DraggableImageNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  private img: HTMLImageElement;
  private handle: HTMLDivElement;
  private resizeHandles: HTMLDivElement[] = [];
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  private isResizing = false;
  private resizeDirection: string | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;

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

    // Create drag handle with professional icon
    this.handle = document.createElement('div');
    this.handle.className = 'drag-handle';
    this.handle.draggable = true;
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

    // Handle drag events
    this.handle.addEventListener('dragstart', this.onDragStart.bind(this));
    this.handle.addEventListener('dragend', this.onDragEnd.bind(this));

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

    this.isResizing = true;
    this.resizeDirection = direction;
    this.startX = e.clientX;
    this.startY = e.clientY;

    // Get current dimensions
    const rect = this.img.getBoundingClientRect();
    this.startWidth = rect.width;
    this.startHeight = rect.height;

    // Add global listeners
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (e: MouseEvent) => {
    if (!this.isResizing || !this.resizeDirection) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;

    // Calculate new dimensions based on direction
    const dir = this.resizeDirection;
    if (dir.includes('e')) newWidth = this.startWidth + deltaX;
    if (dir.includes('w')) newWidth = this.startWidth - deltaX;
    if (dir.includes('s')) newHeight = this.startHeight + deltaY;
    if (dir.includes('n')) newHeight = this.startHeight - deltaY;

    // Preserve aspect ratio for corner handles
    if (dir.length === 2) {
      const aspectRatio = this.startWidth / this.startHeight;
      newHeight = newWidth / aspectRatio;
    }

    // Apply minimum dimensions
    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(50, newHeight);

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

    // Update node attributes with new dimensions
    const pos = this.getPos();
    if (pos !== undefined) {
      const rect = this.img.getBoundingClientRect();
      const tr = this.view.state.tr;
      tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      this.view.dispatch(tr);
    }

    this.isResizing = false;
    this.resizeDirection = null;
  };

  private onDragStart(e: DragEvent) {
    const pos = this.getPos();
    if (pos === undefined) return;

    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/html', this.dom.innerHTML);
    e.dataTransfer!.setData('application/x-tiptap-node', JSON.stringify({ pos, nodeSize: this.node.nodeSize }));

    // Store position info on the view
    (this.view as any).draggingNodePos = pos;
    (this.view as any).draggingNode = this.node;
    (this.view as any).draggingAnchorType = this.node.attrs.anchorType || 'paragraph';

    // Visual feedback
    this.dom.style.opacity = '0.5';
  }

  private onDragEnd() {
    this.dom.style.opacity = '1';
    delete (this.view as any).draggingNodePos;
    delete (this.view as any).draggingNode;
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;

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

    return true;
  }

  destroy() {
    this.handle.removeEventListener('dragstart', this.onDragStart.bind(this));
    this.handle.removeEventListener('dragend', this.onDragEnd.bind(this));

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
        default: 'paragraph',
        parseHTML: element => element.getAttribute('data-anchor-type') || 'paragraph',
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
    };
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      return new DraggableImageNodeView(node, view, getPos as () => number | undefined);
    };
  },

  addProseMirrorPlugins() {
    const basePlugins = this.parent?.() || [];

    // Add drop handler plugin
    const dropPlugin = new Plugin({
      key: new PluginKey('imageDrop'),
      props: {
        handleDOMEvents: {
          drop: (view, event) => {
            const draggingPos = (view as any).draggingNodePos;
            const draggingNode = (view as any).draggingNode;
            const draggingAnchorType = (view as any).draggingAnchorType;

            if (draggingPos === undefined || !draggingNode) return false;

            event.preventDefault();
            event.stopPropagation();

            // Handle page-anchored images (absolute positioning)
            if (draggingAnchorType === 'page') {
              // Get editor container bounds
              const editorEl = view.dom.closest('.tiptap-content') as HTMLElement;
              if (!editorEl) return false;

              const editorRect = editorEl.getBoundingClientRect();
              const newPosX = event.clientX - editorRect.left;
              const newPosY = event.clientY - editorRect.top;

              // Update position attributes
              const tr = view.state.tr;
              tr.setNodeMarkup(draggingPos, undefined, {
                ...draggingNode.attrs,
                posX: Math.max(0, Math.round(newPosX)),
                posY: Math.max(0, Math.round(newPosY)),
              });
              view.dispatch(tr);

              // Clean up
              delete (view as any).draggingNodePos;
              delete (view as any).draggingNode;
              delete (view as any).draggingAnchorType;

              return true;
            }

            // Handle paragraph-anchored and inline images (flow positioning)
            // Get drop position
            const coords = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (!coords) return false;

            // Find the nearest block position for cleaner drops
            const $pos = view.state.doc.resolve(coords.pos);
            let targetPos = coords.pos;

            // Try to drop before/after blocks rather than inside them
            if ($pos.parent.isBlock && $pos.parent.childCount > 0) {
              // If we're past the middle of the drop target, insert after
              const domNode = view.domAtPos(coords.pos).node;
              if (domNode && event.clientY > domNode.getBoundingClientRect().top + domNode.getBoundingClientRect().height / 2) {
                targetPos = $pos.after();
              } else {
                targetPos = $pos.before();
              }
            }

            // Don't do anything if dropping in the same position
            if (Math.abs(targetPos - draggingPos) < draggingNode.nodeSize) {
              delete (view as any).draggingNodePos;
              delete (view as any).draggingNode;
              delete (view as any).draggingAnchorType;
              return true;
            }

            // Adjust if dropping after the dragged node
            if (targetPos > draggingPos) {
              targetPos -= draggingNode.nodeSize;
            }

            // Create transaction
            const tr = view.state.tr;

            // Delete from old position and insert at new position
            tr.delete(draggingPos, draggingPos + draggingNode.nodeSize);
            tr.insert(targetPos, draggingNode);

            // Apply transaction
            view.dispatch(tr);

            // Clean up
            delete (view as any).draggingNodePos;
            delete (view as any).draggingNode;
            delete (view as any).draggingAnchorType;

            return true;
          },

          dragover: (view, event) => {
            if ((view as any).draggingNode) {
              event.preventDefault();
              event.dataTransfer!.dropEffect = 'move';
            }
            return false;
          },
        },
      },
    });

    return [...basePlugins, dropPlugin];
  },
});
