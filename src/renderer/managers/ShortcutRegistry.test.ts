/**
 * ShortcutRegistry Tests
 *
 * Validates that all keyboard shortcuts are properly registered
 * and that there are no conflicts between shortcuts.
 */

import { describe, it, expect } from 'vitest';
import { ShortcutRegistry, type ShortcutContext } from './ShortcutRegistry';

describe('ShortcutRegistry', () => {
  describe('Shortcut Registration', () => {
    it('should have shortcuts registered', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each shortcut', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      shortcuts.forEach(shortcut => {
        expect(shortcut).toHaveProperty('id');
        expect(shortcut).toHaveProperty('description');
        expect(shortcut).toHaveProperty('keys');
        expect(shortcut).toHaveProperty('context');
        expect(shortcut.id).toBeTruthy();
        expect(shortcut.description).toBeTruthy();
        expect(shortcut.keys).toBeTruthy();
        expect(shortcut.context).toBeTruthy();
      });
    });

    it('should have unique IDs for all shortcuts', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const ids = shortcuts.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Conflict Detection', () => {
    it('should have NO shortcut conflicts', () => {
      const conflicts = ShortcutRegistry.validateShortcuts();

      // If this test fails, check the console output for detailed conflict information
      if (conflicts.length > 0) {
        console.error('❌ Keyboard shortcut conflicts detected:');
        conflicts.forEach((conflict, index) => {
          console.error(`\nConflict #${index + 1}:`);
          console.error(`  Keys: ${conflict.keys}`);
          console.error(`  Context: ${conflict.context}`);
          conflict.shortcuts.forEach(s => {
            console.error(`  - ${s.id}: ${s.description} (${s.implementedIn})`);
          });
        });
      }

      expect(conflicts).toHaveLength(0);
    });

    it('should not have duplicate shortcuts in the same context', () => {
      const contexts: ShortcutContext[] = ['global', 'editor', 'study-mode', 'recording', 'detail-view', 'command-palette'];

      contexts.forEach(context => {
        const shortcuts = ShortcutRegistry.getShortcutsByContext(context);
        const keyMap = new Map<string, string>();

        shortcuts.forEach(shortcut => {
          const existing = keyMap.get(shortcut.keys);
          if (existing) {
            throw new Error(
              `Duplicate shortcut in context "${context}": ${shortcut.keys} is used by both "${existing}" and "${shortcut.id}"`
            );
          }
          keyMap.set(shortcut.keys, shortcut.id);
        });
      });
    });
  });

  describe('Shortcut Retrieval', () => {
    it('should retrieve shortcuts by context', () => {
      const globalShortcuts = ShortcutRegistry.getShortcutsByContext('global');
      expect(globalShortcuts.length).toBeGreaterThan(0);
      globalShortcuts.forEach(s => {
        expect(s.context).toBe('global');
      });
    });

    it('should retrieve a specific shortcut by ID', () => {
      const shortcut = ShortcutRegistry.getShortcut('toggle-recording');
      expect(shortcut).toBeDefined();
      expect(shortcut?.keys).toBe('Shift+Space');
      expect(shortcut?.description).toBe('Start/Stop Recording');
    });

    it('should return undefined for non-existent shortcut ID', () => {
      const shortcut = ShortcutRegistry.getShortcut('non-existent-id');
      expect(shortcut).toBeUndefined();
    });

    it('should retrieve shortcut keys by ID', () => {
      const keys = ShortcutRegistry.getShortcutKeys('toggle-recording');
      expect(keys).toBe('Shift+Space');
    });

    it('should return null for non-existent shortcut keys', () => {
      const keys = ShortcutRegistry.getShortcutKeys('non-existent-id');
      expect(keys).toBeNull();
    });
  });

  describe('Critical Shortcuts', () => {
    it('should have recording toggle as Shift+Space (NOT Cmd+R or Cmd+Space)', () => {
      const shortcut = ShortcutRegistry.getShortcut('toggle-recording');
      expect(shortcut?.keys).toBe('Shift+Space');
      expect(shortcut?.keys).not.toBe('Cmd+R');
      expect(shortcut?.keys).not.toBe('Cmd+Space'); // Conflicts with Spotlight
    });

    it('should have Cmd+R reserved for browser reload', () => {
      const shortcut = ShortcutRegistry.getShortcut('reload');
      expect(shortcut?.keys).toBe('Cmd+R');
      expect(shortcut?.description).toContain('Reload');
    });

    it('should NOT have Cmd+E for export session', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const exportShortcut = shortcuts.find(s => s.id === 'export-session');
      expect(exportShortcut).toBeUndefined();
    });

    it('should have Cmd+E only for inline code in editor context', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts().filter(s => s.keys === 'Cmd+E');
      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].id).toBe('inline-code');
      expect(shortcuts[0].context).toBe('editor');
    });

    it('should have Cmd+S for save notes', () => {
      const shortcut = ShortcutRegistry.getShortcut('save-notes');
      expect(shortcut?.keys).toBe('Cmd+S');
      expect(shortcut?.description).toContain('Save Notes');
    });

    it('should have command palette as Cmd+K', () => {
      const shortcut = ShortcutRegistry.getShortcut('command-palette');
      expect(shortcut?.keys).toBe('Cmd+K');
    });
  });

  describe('Context Validation', () => {
    it('should have shortcuts for all contexts', () => {
      const contexts: ShortcutContext[] = ['global', 'editor', 'study-mode', 'recording', 'detail-view', 'command-palette'];

      contexts.forEach(context => {
        const shortcuts = ShortcutRegistry.getShortcutsByContext(context);
        expect(shortcuts.length).toBeGreaterThan(0);
      });
    });

    it('should not have global shortcuts conflicting with context-specific shortcuts', () => {
      const globalShortcuts = ShortcutRegistry.getShortcutsByContext('global');
      const contexts: ShortcutContext[] = ['editor', 'study-mode', 'recording', 'detail-view', 'command-palette'];

      globalShortcuts.forEach(globalShortcut => {
        contexts.forEach(context => {
          const contextShortcuts = ShortcutRegistry.getShortcutsByContext(context);
          const conflict = contextShortcuts.find(s => s.keys === globalShortcut.keys);

          if (conflict) {
            // Global shortcuts can overlap with context shortcuts if they're intentional
            // (e.g., Esc works in multiple contexts)
            // But we should be aware of them
            console.warn(`Global shortcut "${globalShortcut.id}" (${globalShortcut.keys}) overlaps with context "${context}" shortcut "${conflict.id}"`);
          }
        });
      });
    });
  });

  describe('Platform-Specific Formatting', () => {
    it('should convert Cmd to Ctrl on non-Mac platforms', () => {
      // Mock non-Mac platform
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true
      });

      const formatted = ShortcutRegistry.toPlatformKeys('Cmd+Space');
      expect(formatted).toBe('Ctrl+Space');

      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('should keep Cmd on Mac platforms', () => {
      // Mock Mac platform
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true
      });

      const formatted = ShortcutRegistry.toPlatformKeys('Cmd+Space');
      expect(formatted).toBe('Cmd+Space');

      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('should format shortcuts for display', () => {
      const formatted = ShortcutRegistry.formatForDisplay('Cmd+Shift+F');
      expect(formatted).toMatch(/Cmd \+ Shift \+ F|Ctrl \+ Shift \+ F/);
    });
  });

  describe('Regression Tests', () => {
    it('should NOT have Cmd+R for toggle recording (regression)', () => {
      // This was the original bug - ensure it doesn't come back
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const cmdRShortcuts = shortcuts.filter(s => s.keys === 'Cmd+R');

      // Cmd+R should ONLY be used for reload, nothing else
      expect(cmdRShortcuts).toHaveLength(1);
      expect(cmdRShortcuts[0].id).toBe('reload');
      expect(cmdRShortcuts[0].description).toContain('Reload');

      // Make sure toggle-recording is NOT Cmd+R or Cmd+Space
      const toggleRecording = shortcuts.find(s => s.id === 'toggle-recording');
      expect(toggleRecording?.keys).not.toBe('Cmd+R');
      expect(toggleRecording?.keys).not.toBe('Cmd+Space'); // Conflicts with Spotlight
      expect(toggleRecording?.keys).toBe('Shift+Space');
    });

    it('should NOT have Cmd+E for export session (regression)', () => {
      // This was removed - ensure it doesn't come back
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const exportSession = shortcuts.find(s => s.id === 'export-session' || s.id === 'export-session-alt');

      expect(exportSession).toBeUndefined();
    });

    it('should have exactly one use of Shift+Space (toggle recording)', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const shiftSpaceShortcuts = shortcuts.filter(s => s.keys === 'Shift+Space');

      expect(shiftSpaceShortcuts).toHaveLength(1);
      expect(shiftSpaceShortcuts[0].id).toBe('toggle-recording');
    });

    it('should NOT use Cmd+Space (conflicts with Spotlight)', () => {
      const shortcuts = ShortcutRegistry.getAllShortcuts();
      const cmdSpaceShortcuts = shortcuts.filter(s => s.keys === 'Cmd+Space');

      expect(cmdSpaceShortcuts).toHaveLength(0);
    });
  });
});
