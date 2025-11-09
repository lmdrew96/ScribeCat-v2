/**
 * CursorOverlay
 *
 * Renders live cursor positions and user labels for collaborators.
 * Uses Yjs awareness to track cursor positions in real-time.
 */

import { Awareness } from 'y-protocols/awareness';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('CursorOverlay');

export interface CursorPosition {
  userId: string;
  userName: string;
  userColor: string;
  anchor: number;
  head: number;
}

export class CursorOverlay {
  private container: HTMLElement;
  private editorElement: HTMLElement;
  private awareness: Awareness | null = null;
  private cursors: Map<string, HTMLElement> = new Map();
  private updateInterval: number | null = null;

  constructor(containerId: string, editorId: string) {
    const container = document.getElementById(containerId);
    const editor = document.getElementById(editorId);

    if (!container || !editor) {
      throw new Error('Container or editor element not found');
    }

    this.container = container;
    this.editorElement = editor;
  }

  /**
   * Start tracking cursors
   */
  start(awareness: Awareness): void {
    this.awareness = awareness;

    // Listen for awareness changes
    this.awareness.on('change', this.handleAwarenessChange.bind(this));

    // Update cursor positions periodically (for smooth movement)
    this.updateInterval = window.setInterval(() => {
      this.updateCursorPositions();
    }, 100);

    logger.info('Cursor overlay started');
  }

  /**
   * Stop tracking cursors
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.awareness) {
      this.awareness.off('change', this.handleAwarenessChange.bind(this));
      this.awareness = null;
    }

    // Remove all cursor elements
    this.cursors.forEach(cursor => cursor.remove());
    this.cursors.clear();

    logger.info('Cursor overlay stopped');
  }

  /**
   * Handle awareness changes
   */
  private handleAwarenessChange(): void {
    if (!this.awareness) return;

    const states = this.awareness.getStates();
    const currentClientId = this.awareness.clientID;

    // Update cursors for all other users
    states.forEach((state, clientId) => {
      // Skip own cursor
      if (clientId === currentClientId) return;

      const cursor = state.cursor;
      if (cursor && cursor.anchor !== undefined) {
        this.updateOrCreateCursor(clientId.toString(), {
          userId: state.user?.userId || clientId.toString(),
          userName: state.user?.userName || 'Anonymous',
          userColor: state.user?.color || this.generateColor(clientId),
          anchor: cursor.anchor,
          head: cursor.head || cursor.anchor
        });
      } else {
        // Remove cursor if user no longer has cursor position
        this.removeCursor(clientId.toString());
      }
    });

    // Remove cursors for users who left
    this.cursors.forEach((_, clientId) => {
      const clientIdNum = parseInt(clientId);
      if (!states.has(clientIdNum)) {
        this.removeCursor(clientId);
      }
    });
  }

  /**
   * Update or create cursor element
   */
  private updateOrCreateCursor(clientId: string, position: CursorPosition): void {
    let cursorEl = this.cursors.get(clientId);

    if (!cursorEl) {
      cursorEl = this.createCursorElement(position);
      this.cursors.set(clientId, cursorEl);
      this.container.appendChild(cursorEl);
    } else {
      this.updateCursorLabel(cursorEl, position);
    }

    // Update cursor data
    cursorEl.dataset.userId = position.userId;
    cursorEl.dataset.anchor = position.anchor.toString();
    cursorEl.dataset.head = position.head.toString();

    // Update position will be called in updateCursorPositions()
  }

  /**
   * Create cursor element
   */
  private createCursorElement(position: CursorPosition): HTMLElement {
    const cursor = document.createElement('div');
    cursor.className = 'collaboration-cursor';
    cursor.style.borderColor = position.userColor;

    const label = document.createElement('div');
    label.className = 'cursor-label';
    label.style.backgroundColor = position.userColor;
    label.textContent = position.userName;

    cursor.appendChild(label);
    return cursor;
  }

  /**
   * Update cursor label
   */
  private updateCursorLabel(cursorEl: HTMLElement, position: CursorPosition): void {
    const label = cursorEl.querySelector('.cursor-label') as HTMLElement;
    if (label) {
      label.textContent = position.userName;
      label.style.backgroundColor = position.userColor;
    }
    cursorEl.style.borderColor = position.userColor;
  }

  /**
   * Update all cursor positions based on DOM
   */
  private updateCursorPositions(): void {
    if (!this.awareness) return;

    this.cursors.forEach((cursorEl, clientId) => {
      const anchor = parseInt(cursorEl.dataset.anchor || '0');
      const head = parseInt(cursorEl.dataset.head || anchor.toString());

      const position = this.getPositionFromOffset(anchor);
      if (position) {
        cursorEl.style.left = `${position.left}px`;
        cursorEl.style.top = `${position.top}px`;
        cursorEl.style.height = `${position.height}px`;
        cursorEl.style.display = 'block';
      } else {
        cursorEl.style.display = 'none';
      }
    });
  }

  /**
   * Get DOM position from text offset
   */
  private getPositionFromOffset(offset: number): { left: number; top: number; height: number } | null {
    try {
      // Get the ProseMirror editor view
      const editorView = (this.editorElement as any).__tiptapEditor?.view;
      if (!editorView) return null;

      // Get DOM coordinates from ProseMirror position
      const coords = editorView.coordsAtPos(offset);
      const editorRect = this.editorElement.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      return {
        left: coords.left - containerRect.left,
        top: coords.top - containerRect.top,
        height: coords.bottom - coords.top
      };
    } catch (error) {
      logger.warn('Failed to get cursor position:', error);
      return null;
    }
  }

  /**
   * Remove cursor element
   */
  private removeCursor(clientId: string): void {
    const cursorEl = this.cursors.get(clientId);
    if (cursorEl) {
      cursorEl.remove();
      this.cursors.delete(clientId);
    }
  }

  /**
   * Generate color from client ID
   */
  private generateColor(clientId: number): string {
    const hue = (clientId * 137.508) % 360; // Golden angle
    return `hsl(${hue}, 70%, 50%)`;
  }
}
