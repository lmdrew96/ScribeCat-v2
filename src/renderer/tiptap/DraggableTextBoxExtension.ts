/**
 * DraggableTextBoxExtension
 *
 * Extends TipTap to add positionable text boxes for diagrams and annotations
 */

import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeView, EditorView } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node } from '@tiptap/core';

class DraggableTextBoxNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private handle: HTMLDivElement;
  private resizeHandles: HTMLDivElement[] = [];
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  private isResizing = false;
  private isDragging = false;
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
    this.dom.className = 'draggable-textbox-wrapper';
    this.dom.style.lineHeight = '1.5';

    // Apply positioning based on anchor type
    const anchorType = node.attrs.anchorType || 'paragraph';
    this.dom.classList.add(`anchor-${anchorType}`);

    if (anchorType === 'page') {
      // Page-anchored: absolute positioning
      this.dom.style.position = 'absolute';
      this.dom.classList.add('absolute-positioned');

      if (node.attrs.posX === null || node.attrs.posY === null) {
        this.dom.style.left = '20px';
        this.dom.style.top = '20px';
      } else {
        this.dom.style.left = `${node.attrs.posX}px`;
        this.dom.style.top = `${node.attrs.posY}px`;
      }
    } else {
      // Paragraph-anchored: relative positioning with text wrapping
      this.dom.style.position = 'relative';
      this.dom.style.display = 'inline-block';
    }

    // Apply wrapping class
    const wrapType = node.attrs.wrapType || 'square';
    this.dom.classList.add(`wrap-${wrapType}`);

    // Apply float direction class
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

    // Create drag handle
    this.handle = document.createElement('div');
    this.handle.className = 'drag-handle';
    this.handle.draggable = true;
    this.handle.contentEditable = 'false';
    this.handle.style.pointerEvents = 'auto'; // Ensure handle can receive events
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
    this.handle.title = 'Drag to move text box';

    // Create content area (editable)
    // ProseMirror will manage the content in this element
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'textbox-content';
    this.contentDOM.style.pointerEvents = 'auto'; // Ensure content can be edited

    // Set dimensions
    if (node.attrs.width) {
      this.dom.style.width = `${node.attrs.width}px`;
      this.contentDOM.style.width = `${node.attrs.width}px`;
    } else {
      this.dom.style.width = '200px';
      this.contentDOM.style.width = '200px';
    }

    if (node.attrs.height) {
      this.dom.style.height = `${node.attrs.height}px`;
      this.contentDOM.style.height = `${node.attrs.height}px`;
    } else {
      this.dom.style.height = '100px';
      this.contentDOM.style.height = '100px';
    }

    // Create resize handles
    this.createResizeHandles();

    // Handle drag events
    this.handle.addEventListener('dragstart', this.onDragStart.bind(this));
    this.handle.addEventListener('dragend', this.onDragEnd.bind(this));

    // Append elements
    this.dom.appendChild(this.handle);
    this.dom.appendChild(this.contentDOM);
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
        pointerEvents: 'auto', // Ensure resize handles can receive events
        ...pos
      });

      handle.addEventListener('mousedown', (e) => this.onResizeStart(e, dir));
      this.resizeHandles.push(handle);
    }
  }

  private onResizeStart(e: MouseEvent, direction: string) {
    console.log('🟢 TextBox resize start triggered, direction:', direction);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.isResizing = true;
    this.resizeDirection = direction;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const rect = this.contentDOM.getBoundingClientRect();
    this.startWidth = rect.width;
    this.startHeight = rect.height;

    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (e: MouseEvent) => {
    if (!this.isResizing || !this.resizeDirection) {
      console.log('⚠️ Resize move called but not resizing:', { isResizing: this.isResizing, direction: this.resizeDirection });
      return;
    }

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;

    const dir = this.resizeDirection;
    if (dir.includes('e')) newWidth = this.startWidth + deltaX;
    if (dir.includes('w')) newWidth = this.startWidth - deltaX;
    if (dir.includes('s')) newHeight = this.startHeight + deltaY;
    if (dir.includes('n')) newHeight = this.startHeight - deltaY;

    // Apply minimum dimensions
    newWidth = Math.max(100, newWidth);
    newHeight = Math.max(50, newHeight);

    console.log('📏 Resizing to:', { newWidth, newHeight, deltaX, deltaY });

    // Update size
    this.contentDOM.style.width = `${newWidth}px`;
    this.contentDOM.style.height = `${newHeight}px`;
    this.dom.style.width = `${newWidth}px`;
    this.dom.style.height = `${newHeight}px`;
  };

  private onResizeEnd = (e: MouseEvent) => {
    if (!this.isResizing) return;

    console.log('🟢 TextBox resize end triggered');

    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);

    // Update node attributes with new dimensions
    const pos = this.getPos();
    if (pos !== undefined) {
      const rect = this.contentDOM.getBoundingClientRect();
      const finalWidth = Math.round(rect.width);
      const finalHeight = Math.round(rect.height);
      console.log('💾 Saving resize:', { finalWidth, finalHeight });

      const tr = this.view.state.tr;
      tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width: finalWidth,
        height: finalHeight,
      });
      this.view.dispatch(tr);
    }

    this.isResizing = false;
    this.resizeDirection = null;
    console.log('✅ Resize complete, flag reset');
  };

  private onDragStart(e: DragEvent) {
    console.log('🔵 TextBox drag start triggered');
    const pos = this.getPos();
    if (pos === undefined) {
      console.log('⚠️ TextBox drag start: pos is undefined');
      return;
    }

    this.isDragging = true;

    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.dropEffect = 'move';
    e.dataTransfer!.setData('application/x-tiptap-node', JSON.stringify({ pos, nodeSize: this.node.nodeSize }));

    // Also set a generic data type to ensure drag is recognized
    e.dataTransfer!.setData('text/plain', 'textbox');

    (this.view as any).draggingNodePos = pos;
    (this.view as any).draggingNode = this.node;
    (this.view as any).draggingAnchorType = this.node.attrs.anchorType || 'paragraph';

    this.dom.style.opacity = '0.5';
    console.log('✅ TextBox drag start complete, pos:', pos);
  }

  private onDragEnd() {
    console.log('🔵 TextBox drag end triggered');
    this.isDragging = false;
    this.dom.style.opacity = '1';
    delete (this.view as any).draggingNodePos;
    delete (this.view as any).draggingNode;
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;

    // Don't update during resize or drag to prevent interruption
    if (this.isResizing) {
      console.log('⚠️ Blocking update during resize');
      return true;
    }
    if (this.isDragging) {
      console.log('⚠️ Blocking update during drag');
      return true;
    }

    this.node = node;

    // Update dimensions
    if (node.attrs.width) {
      this.dom.style.width = `${node.attrs.width}px`;
      this.contentDOM.style.width = `${node.attrs.width}px`;
    }
    if (node.attrs.height) {
      this.dom.style.height = `${node.attrs.height}px`;
      this.contentDOM.style.height = `${node.attrs.height}px`;
    }

    // Update positioning
    const anchorType = node.attrs.anchorType || 'paragraph';
    this.dom.className = 'draggable-textbox-wrapper';
    this.dom.classList.add(`anchor-${anchorType}`);

    if (anchorType === 'page') {
      this.dom.style.position = 'absolute';
      this.dom.classList.add('absolute-positioned');
      if (node.attrs.posX !== null && node.attrs.posY !== null) {
        this.dom.style.left = `${node.attrs.posX}px`;
        this.dom.style.top = `${node.attrs.posY}px`;
      }
      this.dom.style.display = '';
    } else {
      this.dom.style.position = 'relative';
      this.dom.style.display = 'inline-block';
      this.dom.style.left = '';
      this.dom.style.top = '';
      this.dom.classList.remove('absolute-positioned');
    }

    // Update wrapping class
    const wrapType = node.attrs.wrapType || 'square';
    this.dom.classList.add(`wrap-${wrapType}`);

    // Update float direction
    const floatDirection = node.attrs.floatDirection || 'left';
    this.dom.classList.add(`float-${floatDirection}`);

    // Update horizontal offset
    const horizontalOffset = node.attrs.horizontalOffset || 0;
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
    this.handle.removeEventListener('dragstart', this.onDragStart.bind(this));
    this.handle.removeEventListener('dragend', this.onDragEnd.bind(this));
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }
}

export const DraggableTextBox = Node.create({
  name: 'draggableTextBox',

  group: 'block',

  content: 'inline*',

  draggable: false, // Disable ProseMirror's drag to avoid conflicts with editable content

  addAttributes() {
    return {
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
      width: {
        default: 200,
        parseHTML: element => {
          const val = element.getAttribute('data-width');
          return val ? parseInt(val, 10) : 200;
        },
        renderHTML: attributes => {
          return { 'data-width': attributes.width };
        },
      },
      height: {
        default: 100,
        parseHTML: element => {
          const val = element.getAttribute('data-height');
          return val ? parseInt(val, 10) : 100;
        },
        renderHTML: attributes => {
          return { 'data-height': attributes.height };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="textbox"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'textbox' }, 0];
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      return new DraggableTextBoxNodeView(node, view, getPos as () => number | undefined);
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('textBoxDrop'),
        props: {
          handleDOMEvents: {
            drop: (view, event) => {
              console.log('🎯 Drop event triggered');
              const draggingPos = (view as any).draggingNodePos;
              const draggingNode = (view as any).draggingNode;
              const draggingAnchorType = (view as any).draggingAnchorType;

              console.log('Drop data:', { draggingPos, nodeType: draggingNode?.type.name, anchorType: draggingAnchorType });

              if (draggingPos === undefined || !draggingNode) {
                console.log('❌ Drop rejected: no dragging node');
                return false;
              }
              if (draggingNode.type.name !== 'draggableTextBox') {
                console.log('❌ Drop rejected: not a text box, is:', draggingNode.type.name);
                return false;
              }

              console.log('✅ Processing text box drop');
              event.preventDefault();
              event.stopPropagation();

              // Handle page-anchored text boxes
              if (draggingAnchorType === 'page') {
                const editorEl = view.dom.closest('.tiptap-content') as HTMLElement;
                if (!editorEl) return false;

                const editorRect = editorEl.getBoundingClientRect();
                const newPosX = event.clientX - editorRect.left;
                const newPosY = event.clientY - editorRect.top;

                const tr = view.state.tr;
                tr.setNodeMarkup(draggingPos, undefined, {
                  ...draggingNode.attrs,
                  posX: Math.max(0, Math.round(newPosX)),
                  posY: Math.max(0, Math.round(newPosY)),
                });
                view.dispatch(tr);

                delete (view as any).draggingNodePos;
                delete (view as any).draggingNode;
                delete (view as any).draggingAnchorType;

                return true;
              }

              // Handle paragraph-anchored text boxes
              console.log('📄 Handling paragraph-anchored text box');
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              if (!coords) {
                console.log('❌ No coords found for drop position');
                return false;
              }
              console.log('Target coords:', coords);

              const $pos = view.state.doc.resolve(coords.pos);
              let targetPos = coords.pos;

              if ($pos.parent.isBlock && $pos.parent.childCount > 0) {
                const domNode = view.domAtPos(coords.pos).node;
                if (domNode && event.clientY > domNode.getBoundingClientRect().top + domNode.getBoundingClientRect().height / 2) {
                  targetPos = $pos.after();
                } else {
                  targetPos = $pos.before();
                }
              }

              if (Math.abs(targetPos - draggingPos) < draggingNode.nodeSize) {
                delete (view as any).draggingNodePos;
                delete (view as any).draggingNode;
                delete (view as any).draggingAnchorType;
                return true;
              }

              if (targetPos > draggingPos) {
                targetPos -= draggingNode.nodeSize;
              }

              console.log('🔄 Moving text box from', draggingPos, 'to', targetPos);

              const tr = view.state.tr;
              tr.delete(draggingPos, draggingPos + draggingNode.nodeSize);
              tr.insert(targetPos, draggingNode);
              view.dispatch(tr);

              console.log('✅ Text box moved successfully');

              delete (view as any).draggingNodePos;
              delete (view as any).draggingNode;
              delete (view as any).draggingAnchorType;

              return true;
            },

            dragenter: (view, event) => {
              const isDraggingTextBox = (view as any).draggingNode?.type.name === 'draggableTextBox';
              console.log('🟠 Dragenter fired, isDraggingTextBox:', isDraggingTextBox);
              if (isDraggingTextBox) {
                event.preventDefault();
              }
              return false;
            },

            dragover: (view, event) => {
              const isDraggingTextBox = (view as any).draggingNode?.type.name === 'draggableTextBox';
              if (isDraggingTextBox) {
                event.preventDefault();
                event.dataTransfer!.dropEffect = 'move';
                console.log('🟡 Dragover: allowing text box drop');
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
