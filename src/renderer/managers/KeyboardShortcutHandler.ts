/**
 * KeyboardShortcutHandler
 *
 * Handles keyboard shortcuts for Phase 3 Study Mode features.
 * Implements the shortcuts shown in KeyboardShortcutsOverlay.
 */

import type { ViewMode } from './ViewModeManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('KeyboardShortcutHandler');

export interface KeyboardShortcutCallbacks {
  onViewModeChange: (mode: ViewMode) => void;
  onFocusSearch: () => void;
  onNewRecording: () => void;
  onSaveNotes: () => void;
  onDeleteSelected: () => void;
  onToggleRecording: () => void;
  onTogglePause: () => void;
}

export class KeyboardShortcutHandler {
  private callbacks: KeyboardShortcutCallbacks;
  private isEnabled: boolean = true;

  constructor(callbacks: KeyboardShortcutCallbacks) {
    this.callbacks = callbacks;
    this.setupEventListeners();
  }

  /**
   * Set up global keyboard event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (this.isInputFocused()) {
        return;
      }

      // Don't trigger if disabled
      if (!this.isEnabled) {
        return;
      }

      this.handleKeyPress(e);
    });

    logger.info('Keyboard shortcut handler initialized');
  }

  /**
   * Handle key press events
   */
  private handleKeyPress(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // View Mode shortcuts: Cmd/Ctrl + 1/2/3/4
    if (cmdOrCtrl && !e.shiftKey && !e.altKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          this.callbacks.onViewModeChange('grid');
          logger.info('Keyboard shortcut: Switch to Grid view');
          return;
        case '2':
          e.preventDefault();
          this.callbacks.onViewModeChange('list');
          logger.info('Keyboard shortcut: Switch to List view');
          return;
        case '3':
          e.preventDefault();
          this.callbacks.onViewModeChange('timeline');
          logger.info('Keyboard shortcut: Switch to Timeline view');
          return;
        case '4':
          e.preventDefault();
          this.callbacks.onViewModeChange('board');
          logger.info('Keyboard shortcut: Switch to Board view');
          return;
      }
    }

    // Search: Cmd/Ctrl + F
    if (cmdOrCtrl && e.key === 'f') {
      e.preventDefault();
      this.callbacks.onFocusSearch();
      logger.info('Keyboard shortcut: Focus search');
      return;
    }

    // New recording: Cmd/Ctrl + N
    if (cmdOrCtrl && e.key === 'n') {
      e.preventDefault();
      this.callbacks.onNewRecording();
      logger.info('Keyboard shortcut: New recording');
      return;
    }

    // Save notes: Cmd/Ctrl + S
    if (cmdOrCtrl && e.key === 's') {
      e.preventDefault();
      this.callbacks.onSaveNotes();
      logger.info('Keyboard shortcut: Save notes');
      return;
    }

    // Delete: Delete key
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only trigger if not in input field (already checked above)
      e.preventDefault();
      this.callbacks.onDeleteSelected();
      logger.info('Keyboard shortcut: Delete selected');
      return;
    }

    // Recording shortcuts
    // Toggle recording: Shift + Space
    if (e.shiftKey && e.key === ' ' && !cmdOrCtrl && !e.altKey) {
      e.preventDefault();
      this.callbacks.onToggleRecording();
      logger.info('Keyboard shortcut: Toggle recording');
      return;
    }

    // Pause/Resume: Cmd/Ctrl + P
    if (cmdOrCtrl && e.key === 'p') {
      e.preventDefault();
      this.callbacks.onTogglePause();
      logger.info('Keyboard shortcut: Toggle pause');
      return;
    }
  }

  /**
   * Check if an input element is focused
   */
  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement as HTMLElement)?.isContentEditable ||
      activeElement?.classList.contains('ProseMirror')
    );
  }

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    this.isEnabled = true;
    logger.info('Keyboard shortcuts enabled');
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    this.isEnabled = false;
    logger.info('Keyboard shortcuts disabled');
  }

  /**
   * Check if shortcuts are enabled
   */
  isActive(): boolean {
    return this.isEnabled;
  }
}
