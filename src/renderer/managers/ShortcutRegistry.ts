/**
 * ShortcutRegistry
 *
 * Centralized registry of all keyboard shortcuts in ScribeCat.
 * Prevents conflicts by validating all shortcuts are unique per context.
 *
 * Usage:
 * - All shortcuts should be defined here
 * - Run validateShortcuts() at app startup to catch conflicts
 * - Use getShortcut() to retrieve shortcut keys programmatically
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('ShortcutRegistry');

/**
 * Context in which a shortcut is active
 */
export type ShortcutContext =
  | 'global' // Works everywhere
  | 'editor' // Only in TipTap editor
  | 'study-mode' // Only in Study Mode
  | 'recording' // During recording
  | 'detail-view' // In session detail view
  | 'command-palette'; // Inside command palette

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Unique identifier for this shortcut */
  id: string;
  /** Human-readable description */
  description: string;
  /** Key combination (e.g., 'Cmd+Space', 'Ctrl+Shift+F') */
  keys: string;
  /** Context where this shortcut is active */
  context: ShortcutContext;
  /** Handler function name (for reference) */
  handler?: string;
  /** File where this shortcut is implemented */
  implementedIn?: string;
}

/**
 * Centralized registry of all keyboard shortcuts
 */
export class ShortcutRegistry {
  private static shortcuts: KeyboardShortcut[] = [
    // === GLOBAL NAVIGATION & SYSTEM ===
    {
      id: 'command-palette',
      description: 'Open Command Palette',
      keys: 'Cmd+K',
      context: 'global',
      handler: 'toggleCommandPalette',
      implementedIn: 'CommandPalette.ts'
    },
    {
      id: 'shortcuts-overlay',
      description: 'Toggle Keyboard Shortcuts Overlay',
      keys: '?',
      context: 'global',
      handler: 'toggleShortcutsOverlay',
      implementedIn: 'KeyboardShortcutsOverlay.ts'
    },
    {
      id: 'settings',
      description: 'Open Settings',
      keys: 'Cmd+,',
      context: 'global',
      handler: 'openSettings',
      implementedIn: 'CommandRegistry.ts'
    },
    {
      id: 'cycle-focus-mode',
      description: 'Cycle Focus Modes',
      keys: 'Cmd+Shift+F',
      context: 'global',
      handler: 'cycleFocusMode',
      implementedIn: 'app.ts'
    },
    {
      id: 'close-modal',
      description: 'Close Modal/Overlay/Palette',
      keys: 'Esc',
      context: 'global',
      handler: 'various',
      implementedIn: 'multiple'
    },

    // === RECORDING CONTROLS ===
    {
      id: 'toggle-recording',
      description: 'Start/Stop Recording',
      keys: 'Option+Space',
      context: 'global',
      handler: 'onToggleRecording',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'pause-recording',
      description: 'Pause/Resume Recording',
      keys: 'Cmd+P',
      context: 'recording',
      handler: 'onTogglePause',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'new-recording',
      description: 'New Recording',
      keys: 'Cmd+N',
      context: 'global',
      handler: 'onNewRecording',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },

    // === BROWSER SHORTCUTS (Electron defaults) ===
    {
      id: 'reload',
      description: 'Reload Window',
      keys: 'Cmd+R',
      context: 'global',
      handler: 'reload',
      implementedIn: 'Electron default'
    },
    {
      id: 'force-reload',
      description: 'Force Reload',
      keys: 'Cmd+Shift+R',
      context: 'global',
      handler: 'forceReload',
      implementedIn: 'Electron default'
    },

    // === TEXT EDITING (TipTap Editor) ===
    {
      id: 'bold',
      description: 'Bold Text',
      keys: 'Cmd+B',
      context: 'editor',
      handler: 'toggleBold',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'italic',
      description: 'Italic Text',
      keys: 'Cmd+I',
      context: 'editor',
      handler: 'toggleItalic',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'underline',
      description: 'Underline Text',
      keys: 'Cmd+U',
      context: 'editor',
      handler: 'toggleUnderline',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'strikethrough',
      description: 'Strikethrough Text',
      keys: 'Cmd+Shift+S',
      context: 'editor',
      handler: 'toggleStrike',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'inline-code',
      description: 'Inline Code',
      keys: 'Cmd+E',
      context: 'editor',
      handler: 'toggleCode',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'code-block',
      description: 'Code Block',
      keys: 'Cmd+Alt+C',
      context: 'editor',
      handler: 'toggleCodeBlock',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'heading-1',
      description: 'Heading 1',
      keys: 'Cmd+Shift+H',
      context: 'editor',
      handler: 'toggleHeading',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'heading-2',
      description: 'Heading 2',
      keys: 'Cmd+Alt+H',
      context: 'editor',
      handler: 'toggleHeading',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'bullet-list',
      description: 'Bullet List',
      keys: 'Cmd+Shift+8',
      context: 'editor',
      handler: 'toggleBulletList',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'numbered-list',
      description: 'Numbered List',
      keys: 'Cmd+Shift+7',
      context: 'editor',
      handler: 'toggleOrderedList',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'blockquote',
      description: 'Blockquote',
      keys: 'Cmd+Shift+B',
      context: 'editor',
      handler: 'toggleBlockquote',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'undo',
      description: 'Undo',
      keys: 'Cmd+Z',
      context: 'editor',
      handler: 'undo',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'redo',
      description: 'Redo',
      keys: 'Cmd+Y',
      context: 'editor',
      handler: 'redo',
      implementedIn: 'TipTap built-in'
    },
    {
      id: 'indent',
      description: 'Indent List Item',
      keys: 'Tab',
      context: 'editor',
      handler: 'indent',
      implementedIn: 'EditorConfigService.ts'
    },
    {
      id: 'outdent',
      description: 'Outdent List Item',
      keys: 'Shift+Tab',
      context: 'editor',
      handler: 'outdent',
      implementedIn: 'EditorConfigService.ts'
    },

    // === STUDY MODE VIEW SWITCHING ===
    {
      id: 'grid-view',
      description: 'Grid View',
      keys: 'Cmd+1',
      context: 'study-mode',
      handler: 'onViewModeChange',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'list-view',
      description: 'List View',
      keys: 'Cmd+2',
      context: 'study-mode',
      handler: 'onViewModeChange',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'timeline-view',
      description: 'Timeline View',
      keys: 'Cmd+3',
      context: 'study-mode',
      handler: 'onViewModeChange',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'board-view',
      description: 'Board View',
      keys: 'Cmd+4',
      context: 'study-mode',
      handler: 'onViewModeChange',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },

    // === STUDY MODE ACTIONS ===
    {
      id: 'focus-search',
      description: 'Focus Search',
      keys: 'Cmd+F',
      context: 'study-mode',
      handler: 'onFocusSearch',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'save-notes',
      description: 'Save Notes',
      keys: 'Cmd+S',
      context: 'global',
      handler: 'onSaveNotes',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'delete-selected',
      description: 'Delete Selected Session',
      keys: 'Delete',
      context: 'study-mode',
      handler: 'onDeleteSelected',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },
    {
      id: 'delete-selected-alt',
      description: 'Delete Selected Session (Alt)',
      keys: 'Backspace',
      context: 'study-mode',
      handler: 'onDeleteSelected',
      implementedIn: 'KeyboardShortcutHandler.ts'
    },

    // === AUDIO PLAYBACK (Detail View) ===
    {
      id: 'play-pause',
      description: 'Play/Pause Audio',
      keys: 'Space',
      context: 'detail-view',
      handler: 'togglePlayback',
      implementedIn: 'SessionPlaybackManager.ts'
    },
    {
      id: 'rewind',
      description: 'Rewind 5 Seconds',
      keys: '←',
      context: 'detail-view',
      handler: 'rewind',
      implementedIn: 'SessionPlaybackManager.ts'
    },
    {
      id: 'forward',
      description: 'Forward 5 Seconds',
      keys: '→',
      context: 'detail-view',
      handler: 'forward',
      implementedIn: 'SessionPlaybackManager.ts'
    },

    // === COMMAND PALETTE NAVIGATION ===
    {
      id: 'palette-next',
      description: 'Next Command',
      keys: '↓',
      context: 'command-palette',
      handler: 'nextCommand',
      implementedIn: 'CommandPalette.ts'
    },
    {
      id: 'palette-prev',
      description: 'Previous Command',
      keys: '↑',
      context: 'command-palette',
      handler: 'previousCommand',
      implementedIn: 'CommandPalette.ts'
    },
    {
      id: 'palette-execute',
      description: 'Execute Command',
      keys: 'Enter',
      context: 'command-palette',
      handler: 'executeCommand',
      implementedIn: 'CommandPalette.ts'
    },
    {
      id: 'palette-close',
      description: 'Close Palette',
      keys: 'Esc',
      context: 'command-palette',
      handler: 'closePalette',
      implementedIn: 'CommandPalette.ts'
    }
  ];

  /**
   * Get all shortcuts
   */
  static getAllShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  /**
   * Get shortcuts by context
   */
  static getShortcutsByContext(context: ShortcutContext): KeyboardShortcut[] {
    return this.shortcuts.filter(s => s.context === context);
  }

  /**
   * Get a specific shortcut by ID
   */
  static getShortcut(id: string): KeyboardShortcut | undefined {
    return this.shortcuts.find(s => s.id === id);
  }

  /**
   * Get shortcut keys by ID (useful for displaying in UI)
   */
  static getShortcutKeys(id: string): string | null {
    const shortcut = this.getShortcut(id);
    return shortcut ? shortcut.keys : null;
  }

  /**
   * Validate all shortcuts for conflicts
   * Returns array of conflict reports
   */
  static validateShortcuts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const seenByContext = new Map<string, Map<string, KeyboardShortcut>>();

    for (const shortcut of this.shortcuts) {
      // Check for conflicts within the same context
      if (!seenByContext.has(shortcut.context)) {
        seenByContext.set(shortcut.context, new Map());
      }

      const contextMap = seenByContext.get(shortcut.context)!;
      const existing = contextMap.get(shortcut.keys);

      if (existing) {
        conflicts.push({
          keys: shortcut.keys,
          context: shortcut.context,
          shortcuts: [existing, shortcut]
        });
      } else {
        contextMap.set(shortcut.keys, shortcut);
      }

      // Check for global conflicts (global shortcuts conflict with everything)
      if (shortcut.context === 'global') {
        for (const [ctx, map] of seenByContext.entries()) {
          if (ctx === 'global') continue;

          const conflicting = map.get(shortcut.keys);
          if (conflicting) {
            conflicts.push({
              keys: shortcut.keys,
              context: 'cross-context',
              shortcuts: [shortcut, conflicting]
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Log validation results to console
   */
  static logValidation(): void {
    const conflicts = this.validateShortcuts();

    if (conflicts.length === 0) {
      logger.info('✅ All keyboard shortcuts validated successfully - no conflicts found!');
      logger.info(`Total shortcuts registered: ${this.shortcuts.length}`);
      return;
    }

    logger.error(`❌ Found ${conflicts.length} keyboard shortcut conflict(s):`);
    conflicts.forEach((conflict, index) => {
      logger.error(`\n Conflict #${index + 1}:`);
      logger.error(`   Keys: ${conflict.keys}`);
      logger.error(`   Context: ${conflict.context}`);
      conflict.shortcuts.forEach(s => {
        logger.error(`   - ${s.id}: ${s.description} (${s.implementedIn})`);
      });
    });

    // Throw error in development to catch conflicts early
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `Keyboard shortcut conflicts detected! See console for details. Fix conflicts in ShortcutRegistry.ts`
      );
    }
  }

  /**
   * Convert platform-agnostic key to platform-specific
   * (e.g., 'Cmd' -> 'Ctrl' on Windows/Linux, 'Option' -> 'Alt' on Windows/Linux)
   */
  static toPlatformKeys(keys: string): string {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
      return keys;
    }
    return keys.replace(/Cmd/g, 'Ctrl').replace(/Option/g, 'Alt');
  }

  /**
   * Format shortcut for display in UI
   */
  static formatForDisplay(keys: string): string {
    const platformKeys = this.toPlatformKeys(keys);
    return platformKeys
      .split('+')
      .map(key => {
        // Capitalize first letter
        return key.charAt(0).toUpperCase() + key.slice(1);
      })
      .join(' + ');
  }
}

/**
 * Shortcut conflict report
 */
export interface ShortcutConflict {
  keys: string;
  context: ShortcutContext | 'cross-context';
  shortcuts: KeyboardShortcut[];
}

/**
 * Initialize shortcut validation
 * Call this at app startup
 */
export function initializeShortcutValidation(): void {
  ShortcutRegistry.logValidation();
}
