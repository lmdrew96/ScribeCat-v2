/**
 * DraggableTextBoxExtension
 *
 * Extends TipTap to add positionable text boxes for diagrams and annotations
 */

import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeView, EditorView } from '@tiptap/pm/view';
import { Node } from '@tiptap/core';

// ============================================================================
// MODULE-LEVEL GLOBALS (shared across ALL TextBox instances)
// This prevents multiple instances from each adding their own handlers
// ============================================================================
let instanceCounter = 0;
let activeInstance: DraggableTextBoxNodeView | null = null;
let globalHandlersInstalled = false;
const allInstances = new Set<DraggableTextBoxNodeView>();

// Single global handlers - installed once, shared by all instances
function globalPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement;

  // Check all instances to see if we hit any of their handles
  for (const instance of allInstances) {
    // Check drag handle
    if (target === instance.handle || instance.handle.contains(target)) {
      console.log('[TextBox] HIT DRAG HANDLE on instance', instance.instanceId);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      activeInstance = instance;
      instance.onDragStart(e);
      return;
    }

    // Check resize handles
    for (const rh of instance.resizeHandles) {
      if (target === rh || rh.contains(target)) {
        console.log('[TextBox] HIT RESIZE HANDLE on instance', instance.instanceId);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        activeInstance = instance;
        const dir = rh.className.match(/resize-handle-(\w+)/)?.[1] || 'se';
        instance.onResizeStart(e, dir);
        return;
      }
    }
  }
}

function globalPointerMove(e: PointerEvent) {
  if (!activeInstance) return;

  if (activeInstance.isDragging) {
    activeInstance.onMouseMove(e);
  }
  if (activeInstance.isResizing) {
    activeInstance.onResizeMove(e);
  }
}

function globalPointerUp(e: PointerEvent) {
  if (!activeInstance) return;

  if (activeInstance.isDragging) {
    console.log('[TextBox] GLOBAL pointerup while dragging instance', activeInstance.instanceId);
    activeInstance.onMouseUp(e);
  }
  if (activeInstance.isResizing) {
    console.log('[TextBox] GLOBAL pointerup while resizing instance', activeInstance.instanceId);
    activeInstance.onResizeEnd(e);
  }
  activeInstance = null;
}

function installGlobalHandlers() {
  if (globalHandlersInstalled) return;
  console.log('[TextBox] Installing global handlers');
  document.addEventListener('pointerdown', globalPointerDown, { capture: true });
  document.addEventListener('pointermove', globalPointerMove, { capture: true });
  document.addEventListener('pointerup', globalPointerUp, { capture: true });
  globalHandlersInstalled = true;
}

function uninstallGlobalHandlers() {
  if (!globalHandlersInstalled) return;
  if (allInstances.size > 0) return; // Don't uninstall if instances still exist
  console.log('[TextBox] Uninstalling global handlers');
  document.removeEventListener('pointerdown', globalPointerDown, { capture: true });
  document.removeEventListener('pointermove', globalPointerMove, { capture: true });
  document.removeEventListener('pointerup', globalPointerUp, { capture: true });
  globalHandlersInstalled = false;
}

// ============================================================================
// TextBox NodeView Class
// ============================================================================
class DraggableTextBoxNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  handle: HTMLDivElement; // Made public for global handler access
  resizeHandles: HTMLDivElement[] = []; // Made public for global handler access
  private node: ProseMirrorNode;
  private view: EditorView;
  private getPos: () => number | undefined;
  instanceId: number; // Made public for global handler access
  // Resize state
  isResizing = false; // Made public for global handler access
  resizeDirection: string | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private startPosX = 0;
  private startPosY = 0;
  // Drag state (mouse-based, not HTML5 drag)
  isDragging = false; // Made public for global handler access
  private dragStartX = 0;
  private dragStartY = 0;
  private elementStartX = 0;
  private elementStartY = 0;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.instanceId = ++instanceCounter;

    // Register this instance and install global handlers
    allInstances.add(this);
    installGlobalHandlers();
    console.log('[TextBox] Created instance', this.instanceId, 'total instances:', allInstances.size);

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
    this.handle.contentEditable = 'false';
    this.handle.style.pointerEvents = 'auto'; // Ensure handle can receive events
    this.handle.draggable = false; // Prevent native HTML5 drag
    this.handle.style.userSelect = 'none';
    this.handle.style.webkitUserSelect = 'none';
    (this.handle.style as CSSStyleDeclaration & { webkitUserDrag?: string }).webkitUserDrag = 'none';
    this.handle.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none; user-select: none;">
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

      // No individual listeners - handled by document-level capture listener
      this.resizeHandles.push(handle);
    }
  }

  private onResizeStart(e: PointerEvent, direction: string) {
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

    // Store initial position for page-anchored elements
    if (this.node.attrs.anchorType === 'page') {
      this.startPosX = this.node.attrs.posX || 0;
      this.startPosY = this.node.attrs.posY || 0;
    }

    // Don't use setPointerCapture - rely on global handlers instead
    // ProseMirror steals pointer capture, so we can't use it
    console.log('[TextBox] Resize started, direction:', direction, 'isResizing:', this.isResizing);
  }

  private onResizeMove = (e: MouseEvent) => {
    console.log('[TextBox] onResizeMove called, isResizing:', this.isResizing, 'direction:', this.resizeDirection);
    if (!this.isResizing || !this.resizeDirection) {
      return;
    }

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;
    console.log('[TextBox] Resize delta:', deltaX, deltaY);

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

    // Update size
    this.contentDOM.style.width = `${newWidth}px`;
    this.contentDOM.style.height = `${newHeight}px`;
    this.dom.style.width = `${newWidth}px`;
    this.dom.style.height = `${newHeight}px`;

    // Adjust position for page-anchored elements when resizing from N or W edges
    if (this.node.attrs.anchorType === 'page') {
      if (dir.includes('w')) {
        this.dom.style.left = `${this.startPosX + deltaX}px`;
      }
      if (dir.includes('n')) {
        this.dom.style.top = `${this.startPosY + deltaY}px`;
      }
    }
  };

  private onResizeEnd = (e: MouseEvent | PointerEvent) => {
    console.log('[TextBox] onResizeEnd called, isResizing:', this.isResizing);
    if (!this.isResizing) return;

    // Update node attributes with new dimensions and position
    const pos = this.getPos();
    if (pos !== undefined) {
      const rect = this.contentDOM.getBoundingClientRect();
      const finalWidth = Math.round(rect.width);
      const finalHeight = Math.round(rect.height);

      const newAttrs: Record<string, unknown> = {
        ...this.node.attrs,
        width: finalWidth,
        height: finalHeight,
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

  // Pointer-based drag handlers (using pointer capture for reliable event delivery)
  private onDragStart(e: PointerEvent) {
    console.log('[TextBox] onDragStart called, button:', e.button, 'pointerId:', e.pointerId);
    // Only handle left mouse button
    if (e.button !== 0) return;

    // Event already stopped by document handler
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.elementStartX = this.node.attrs.posX || parseInt(this.dom.style.left, 10) || 0;
    this.elementStartY = this.node.attrs.posY || parseInt(this.dom.style.top, 10) || 0;

    console.log('[TextBox] Drag started at:', this.elementStartX, this.elementStartY);
    console.log('[TextBox] anchorType:', this.node.attrs.anchorType);

    // Visual feedback
    this.dom.classList.add('dragging');

    // Don't use setPointerCapture - rely on global document handlers instead
    // (which we proved work for resize)
    console.log('[TextBox] isDragging is now:', this.isDragging);
  }

  private onMouseMove(e: MouseEvent) {
    console.log('[TextBox] onMouseMove called, isDragging:', this.isDragging);
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    // Move element immediately (smooth visual feedback)
    const newX = this.elementStartX + deltaX;
    const newY = this.elementStartY + deltaY;
    console.log('[TextBox] Moving to:', newX, newY);
    this.dom.style.left = `${Math.max(0, newX)}px`;
    this.dom.style.top = `${Math.max(0, newY)}px`;
  }

  private onMouseUp(e: MouseEvent) {
    console.log('[TextBox] onMouseUp called, isDragging:', this.isDragging);
    if (!this.isDragging) return;

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

  // Tell ProseMirror to ignore certain DOM mutations (prevents NodeView recreation during drag/resize)
  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Element }): boolean {
    // During ANY active drag/resize, ignore ALL mutations to prevent NodeView recreation
    if (activeInstance !== null) {
      return true;
    }

    // Always ignore style attribute changes on our wrapper elements
    if (mutation.type === 'attributes' &&
        (mutation as MutationRecord).attributeName === 'style') {
      return true;
    }

    // Ignore class changes (e.g., 'dragging' class)
    if (mutation.type === 'attributes' &&
        (mutation as MutationRecord).attributeName === 'class') {
      return true;
    }

    // Let ProseMirror handle other mutations normally
    return false;
  }

  update(node: ProseMirrorNode) {
    console.log('[TextBox] update() called, isDragging:', this.isDragging, 'isResizing:', this.isResizing);
    if (node.type !== this.node.type) return false;

    // Don't update during resize or drag to prevent interruption
    if (this.isResizing) {
      console.log('[TextBox] Skipping update - resizing');
      return true;
    }
    if (this.isDragging) {
      console.log('[TextBox] Skipping update - dragging');
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
    console.log('[TextBox] Destroying instance', this.instanceId);

    // Clear activeInstance if it's this one
    if (activeInstance === this) {
      activeInstance = null;
    }

    // Remove from instance set
    allInstances.delete(this);

    // Uninstall global handlers if no instances remain
    uninstallGlobalHandlers();
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

  // No ProseMirror plugins needed - drag is handled via mouse events in NodeView
});
