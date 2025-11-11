/**
 * DraggableNodeExtension
 *
 * Custom TipTap extension that adds drag-and-drop functionality to images and tables.
 * Allows users to reorder nodes by dragging them to new positions.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';

export interface DraggableNodeOptions {
  /**
   * The node types that should be draggable
   */
  nodeTypes: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    draggableNode: {
      /**
       * Enable or disable dragging for a node
       */
      setDraggable: (draggable: boolean) => ReturnType;
    };
  }
}

/**
 * Extension that makes specified node types draggable
 */
export const DraggableNode = Extension.create<DraggableNodeOptions>({
  name: 'draggableNode',

  addOptions() {
    return {
      nodeTypes: ['image', 'table'],
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('draggableNode'),
        props: {
          handleDOMEvents: {
            // Add drag handle on mouseenter
            mouseenter: (view, event) => {
              const target = event.target as HTMLElement;
              const nodeTypes = this.options.nodeTypes;

              // Check if we're hovering over a draggable node
              let nodeElement: HTMLElement | null = null;
              for (const nodeType of nodeTypes) {
                // For tables, check for tableWrapper; for images, check for img tag
                const selector = nodeType === 'table' ? '.tableWrapper' : (nodeType === 'image' ? 'img' : `.tiptap-${nodeType}`);
                const element = target.closest(selector);
                // Only match images that are inside the editor
                if (element && (nodeType !== 'image' || element.closest('.tiptap-content'))) {
                  nodeElement = element as HTMLElement;
                  break;
                }
              }

              // For images, check if parent already has a drag handle
              const parentElement = nodeElement.tagName === 'IMG' ? nodeElement.parentElement : nodeElement;
              if (parentElement && !parentElement.querySelector('.drag-handle')) {
                // Add drag handle
                const handle = document.createElement('div');
                handle.className = 'drag-handle';
                handle.draggable = true;
                handle.contentEditable = 'false';
                handle.innerHTML = '⋮⋮';
                handle.title = 'Drag to reorder';

                // For images, add to parent; for tables, add to tableWrapper
                if (nodeElement.tagName === 'IMG') {
                  parentElement.style.position = 'relative';
                  parentElement.insertBefore(handle, nodeElement);
                } else {
                  nodeElement.style.position = 'relative';
                  nodeElement.appendChild(handle);
                }

                // Handle drag start
                handle.addEventListener('dragstart', (e: DragEvent) => {
                  const pos = view.posAtDOM(nodeElement!, 0);
                  const node = view.state.doc.nodeAt(pos);

                  if (!node) return;

                  // Create drag data using DOMSerializer
                  const serializer = DOMSerializer.fromSchema(view.state.schema);
                  const fragment = document.createDocumentFragment();
                  const dom = serializer.serializeNode(node);
                  fragment.appendChild(dom);

                  // Create a temporary container for HTML serialization
                  const tempDiv = document.createElement('div');
                  tempDiv.appendChild(dom.cloneNode(true));

                  e.dataTransfer!.effectAllowed = 'move';
                  e.dataTransfer!.setData('text/html', tempDiv.innerHTML);
                  e.dataTransfer!.setData('text/plain', node.textContent);

                  // Store the position for later
                  (view as any).draggingNodePos = pos;
                  (view as any).draggingNodeSize = node.nodeSize;

                  // Visual feedback
                  nodeElement!.style.opacity = '0.5';
                });

                // Handle drag end
                handle.addEventListener('dragend', () => {
                  nodeElement!.style.opacity = '1';
                  delete (view as any).draggingNodePos;
                  delete (view as any).draggingNodeSize;
                });
              }

              return false;
            },

            // Remove drag handle on mouseleave
            mouseleave: (view, event) => {
              const target = event.target as HTMLElement;
              const nodeTypes = this.options.nodeTypes;

              // Check if we're leaving a draggable node
              let nodeElement: HTMLElement | null = null;
              for (const nodeType of nodeTypes) {
                // For tables, check for tableWrapper; for images, check for img tag
                const selector = nodeType === 'table' ? '.tableWrapper' : (nodeType === 'image' ? 'img' : `.tiptap-${nodeType}`);
                const element = target.closest(selector);
                // Only match images that are inside the editor
                if (element && (nodeType !== 'image' || element.closest('.tiptap-content'))) {
                  nodeElement = element as HTMLElement;
                  break;
                }
              }

              if (nodeElement) {
                const handle = nodeElement.querySelector('.drag-handle');
                if (handle) {
                  handle.remove();
                }
              }

              return false;
            },

            // Handle drop
            drop: (view, event) => {
              event.preventDefault();

              const draggingPos = (view as any).draggingNodePos;
              const draggingSize = (view as any).draggingNodeSize;

              if (draggingPos === undefined) return false;

              // Get the drop position
              const dropPos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              if (!dropPos) return false;

              // Get the node we're dragging
              const node = view.state.doc.nodeAt(draggingPos);
              if (!node) return false;

              // Calculate target position
              let targetPos = dropPos.pos;

              // Adjust if dropping after the dragged node
              if (targetPos > draggingPos) {
                targetPos -= draggingSize;
              }

              // Create transaction to move the node
              const tr = view.state.tr;

              // Delete from old position
              tr.delete(draggingPos, draggingPos + draggingSize);

              // Insert at new position
              tr.insert(targetPos, node);

              // Apply transaction
              view.dispatch(tr);

              // Clean up
              delete (view as any).draggingNodePos;
              delete (view as any).draggingNodeSize;

              return true;
            },

            // Prevent default dragover to allow drop
            dragover: (view, event) => {
              event.preventDefault();
              event.dataTransfer!.dropEffect = 'move';
              return false;
            },
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setDraggable:
        (draggable: boolean) =>
        ({ commands }) => {
          // This could be used to enable/disable dragging dynamically
          return true;
        },
    };
  },
});
