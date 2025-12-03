/**
 * StudyModeKeyboardConfig
 *
 * Creates keyboard shortcut handler with appropriate callbacks.
 */

import { KeyboardShortcutHandler } from '../KeyboardShortcutHandler.js';
import { ViewModeManager } from '../ViewModeManager.js';
import { BulkSelectionManager } from './BulkSelectionManager.js';

export interface KeyboardConfigCallbacks {
  onBulkDelete: (sessionIds: Set<string>) => void;
}

export class StudyModeKeyboardConfig {
  /**
   * Create a keyboard shortcut handler with appropriate callbacks
   */
  static create(
    viewModeManager: ViewModeManager,
    bulkSelectionManager: BulkSelectionManager,
    callbacks: KeyboardConfigCallbacks
  ): KeyboardShortcutHandler {
    return new KeyboardShortcutHandler({
      onViewModeChange: (mode) => {
        viewModeManager.setMode(mode);
      },
      onFocusSearch: () => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      },
      onNewRecording: () => {
        (window as any).viewManager?.show('recording');
      },
      onSaveNotes: async () => {
        const notesAutoSaveManager = (window as any).notesAutoSaveManager;
        if (notesAutoSaveManager) {
          await notesAutoSaveManager.saveImmediately();
        }
      },
      onDeleteSelected: () => {
        const selectedIds = bulkSelectionManager.getSelectedSessionIds();
        if (selectedIds.size > 0) {
          callbacks.onBulkDelete(selectedIds);
        }
      },
      onToggleRecording: () => {
        const recordingManager = (window as any).recordingManager;
        if (recordingManager) {
          if (recordingManager.isRecording) {
            recordingManager.stopRecording();
          } else {
            recordingManager.startRecording();
          }
        }
      },
      onTogglePause: () => {
        const recordingManager = (window as any).recordingManager;
        if (recordingManager && recordingManager.isRecording) {
          if (recordingManager.isPaused) {
            recordingManager.resumeRecording();
          } else {
            recordingManager.pauseRecording();
          }
        }
      }
    });
  }
}
