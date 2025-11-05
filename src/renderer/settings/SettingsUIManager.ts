/**
 * SettingsUIManager
 *
 * Manages common UI patterns in settings including
 * collapsible groups and state management.
 */

export class SettingsUIManager {
  private collapsedGroups: Set<string> = new Set();

  /**
   * Initialize UI components
   */
  public async initialize(): Promise<void> {
    this.initializeCollapsibleGroups();
    await this.loadCollapsedState();
  }

  /**
   * Initialize collapsible groups functionality
   */
  private initializeCollapsibleGroups(): void {
    const groupHeaders = document.querySelectorAll('.settings-group-header');

    groupHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.settings-group') as HTMLElement;
        if (group) {
          const groupId = group.dataset.group;
          if (groupId) {
            this.toggleGroup(groupId);
          }
        }
      });
    });
  }

  /**
   * Toggle collapse state of a settings group
   */
  private toggleGroup(groupId: string): void {
    const group = document.querySelector(`.settings-group[data-group="${groupId}"]`);
    if (!group) return;

    if (this.collapsedGroups.has(groupId)) {
      // Expand the group
      this.collapsedGroups.delete(groupId);
      group.classList.remove('collapsed');
    } else {
      // Collapse the group
      this.collapsedGroups.add(groupId);
      group.classList.add('collapsed');
    }

    // Save collapsed state
    this.saveCollapsedState();
  }

  /**
   * Save collapsed groups state to electron-store
   */
  private async saveCollapsedState(): Promise<void> {
    try {
      const collapsedArray = Array.from(this.collapsedGroups);
      await window.scribeCat.store.set('settings-collapsed-groups', collapsedArray);
    } catch (error) {
      console.error('Failed to save collapsed state:', error);
    }
  }

  /**
   * Load collapsed groups state from electron-store
   */
  private async loadCollapsedState(): Promise<void> {
    try {
      const collapsedArray = await window.scribeCat.store.get('settings-collapsed-groups') as string[];
      if (Array.isArray(collapsedArray)) {
        this.collapsedGroups = new Set(collapsedArray);

        // Apply collapsed state to UI
        collapsedArray.forEach(groupId => {
          const group = document.querySelector(`.settings-group[data-group="${groupId}"]`);
          if (group) {
            group.classList.add('collapsed');
          }
        });
      }
    } catch (error) {
      console.error('Failed to load collapsed state:', error);
    }
  }

  /**
   * Get collapsed groups
   */
  public getCollapsedGroups(): Set<string> {
    return new Set(this.collapsedGroups);
  }
}
