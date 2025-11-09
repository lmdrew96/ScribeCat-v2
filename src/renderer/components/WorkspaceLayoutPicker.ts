/**
 * WorkspaceLayoutPicker
 *
 * UI component for selecting workspace layout presets and managing custom layouts.
 * Accessible from the settings modal.
 */

import type { LayoutManager, WorkspacePreset } from '../managers/LayoutManager.js';

export class WorkspaceLayoutPicker {
  private layoutManager: LayoutManager;
  private modal: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private presetsGrid: HTMLElement | null = null;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
  }

  /**
   * Initialize the layout picker
   */
  public initialize(): void {
    this.createModal();
    this.setupEventListeners();
  }

  /**
   * Create layout picker modal
   */
  private createModal(): void {
    const modalHTML = `
      <div id="layout-picker-modal" class="layout-picker-modal">
        <div class="layout-picker-overlay"></div>
        <div class="layout-picker-content">
          <div class="layout-picker-header">
            <h2 class="layout-picker-title">⊞ Workspace Layouts</h2>
            <button class="layout-picker-close" id="close-layout-picker" title="Close">×</button>
          </div>

          <div id="layout-presets-grid" class="layout-presets-grid">
            <!-- Presets will be populated by JavaScript -->
          </div>

          <div class="layout-picker-actions">
            <button class="layout-action-btn" id="save-custom-layout-btn">
              💾 Save Current Layout
            </button>
            <button class="layout-action-btn" id="reset-layout-btn">
              ↺ Reset to Default
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.modal = document.getElementById('layout-picker-modal');
    this.overlay = this.modal?.querySelector('.layout-picker-overlay') as HTMLElement;
    this.content = this.modal?.querySelector('.layout-picker-content') as HTMLElement;
    this.presetsGrid = document.getElementById('layout-presets-grid');

    this.renderPresets();
  }

  /**
   * Render layout preset cards
   */
  private renderPresets(): void {
    if (!this.presetsGrid) return;

    const presets = this.layoutManager.getAllPresets();
    const currentLayout = this.layoutManager.getCurrentLayout();

    this.presetsGrid.innerHTML = presets.map(preset => {
      const isActive = this.isLayoutActive(preset, currentLayout);

      return `
        <div class="layout-preset-card ${isActive ? 'active' : ''}" data-preset-id="${preset.id}">
          <div class="layout-preset-icon">${preset.icon}</div>
          <div class="layout-preset-name">${preset.name}</div>
          <div class="layout-preset-description">${preset.description}</div>
          <div class="layout-preset-preview">
            ${this.renderLayoutPreview(preset)}
          </div>
          ${preset.id.startsWith('custom-') ? `
            <button class="delete-custom-layout-btn" data-preset-id="${preset.id}" title="Delete custom layout">
              ×
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Render visual preview of layout
   */
  private renderLayoutPreview(preset: WorkspacePreset): string {
    const { leftPanelWidth, rightPanelWidth, leftPanelCollapsed, rightPanelCollapsed } = preset.layout;

    return `
      <div class="layout-preview-panel ${leftPanelCollapsed ? 'collapsed' : ''}"
           style="flex: ${leftPanelCollapsed ? '0 0 8px' : `0 0 ${leftPanelWidth}%`}"></div>
      <div class="layout-preview-panel ${rightPanelCollapsed ? 'collapsed' : ''}"
           style="flex: ${rightPanelCollapsed ? '0 0 8px' : `0 0 ${rightPanelWidth}%`}"></div>
    `;
  }

  /**
   * Check if a preset matches the current layout
   */
  private isLayoutActive(preset: WorkspacePreset, currentLayout: any): boolean {
    return preset.layout.leftPanelWidth === currentLayout.leftPanelWidth &&
           preset.layout.rightPanelWidth === currentLayout.rightPanelWidth &&
           preset.layout.leftPanelCollapsed === currentLayout.leftPanelCollapsed &&
           preset.layout.rightPanelCollapsed === currentLayout.rightPanelCollapsed;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Close modal
    this.overlay?.addEventListener('click', () => {
      this.close();
    });

    const closeBtn = document.getElementById('close-layout-picker');
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    // Preset card clicks
    this.presetsGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Check if delete button was clicked
      if (target.classList.contains('delete-custom-layout-btn')) {
        const presetId = target.dataset.presetId;
        if (presetId) {
          this.deleteCustomLayout(presetId);
        }
        return;
      }

      // Otherwise, apply the preset
      const card = target.closest('.layout-preset-card') as HTMLElement;
      if (card) {
        const presetId = card.dataset.presetId;
        if (presetId) {
          this.layoutManager.applyPreset(presetId);
          this.close();
        }
      }
    });

    // Save custom layout
    const saveBtn = document.getElementById('save-custom-layout-btn');
    saveBtn?.addEventListener('click', () => {
      this.promptSaveCustomLayout();
    });

    // Reset to default
    const resetBtn = document.getElementById('reset-layout-btn');
    resetBtn?.addEventListener('click', () => {
      this.layoutManager.applyPreset('balanced');
      this.close();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal?.classList.contains('visible')) {
        this.close();
      }
    });

  }

  /**
   * Open the layout picker
   */
  public open(): void {
    this.modal?.classList.add('visible');
    this.renderPresets(); // Re-render to show current active preset
  }

  /**
   * Close the layout picker
   */
  public close(): void {
    this.modal?.classList.remove('visible');
  }

  /**
   * Prompt user to save custom layout
   */
  private promptSaveCustomLayout(): void {
    // Create custom prompt modal
    const promptHTML = `
      <div class="layout-save-prompt-modal" id="layout-save-prompt">
        <div class="layout-picker-overlay"></div>
        <div class="layout-picker-content" style="max-width: 400px;">
          <div class="layout-picker-header">
            <h3 style="margin: 0; font-size: 18px;">Save Custom Layout</h3>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
              Layout Name:
            </label>
            <input
              type="text"
              id="custom-layout-name"
              placeholder="My Custom Layout"
              style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 14px;"
            >
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
              Description:
            </label>
            <textarea
              id="custom-layout-description"
              placeholder="Describe this layout..."
              rows="3"
              style="width: 100%; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 14px; resize: vertical;"
            ></textarea>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
              Icon (emoji):
            </label>
            <input
              type="text"
              id="custom-layout-icon"
              placeholder="🎨"
              maxlength="2"
              style="width: 60px; padding: 10px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 20px; text-align: center;"
            >
          </div>

          <div class="layout-picker-actions">
            <button class="layout-action-btn" id="cancel-save-layout">Cancel</button>
            <button class="layout-action-btn primary" id="confirm-save-layout">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', promptHTML);

    const promptModal = document.getElementById('layout-save-prompt');
    const nameInput = document.getElementById('custom-layout-name') as HTMLInputElement;
    const descInput = document.getElementById('custom-layout-description') as HTMLTextAreaElement;
    const iconInput = document.getElementById('custom-layout-icon') as HTMLInputElement;

    // Focus name input
    setTimeout(() => nameInput?.focus(), 100);

    // Cancel button
    const cancelBtn = document.getElementById('cancel-save-layout');
    cancelBtn?.addEventListener('click', () => {
      promptModal?.remove();
    });

    // Confirm button
    const confirmBtn = document.getElementById('confirm-save-layout');
    confirmBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim() || 'My Custom Layout';
      const description = descInput?.value.trim() || 'Custom workspace layout';
      const icon = iconInput?.value.trim() || '🎨';

      this.layoutManager.saveCustomLayout(name, description, icon);
      this.renderPresets(); // Re-render to show new custom layout
      promptModal?.remove();
    });

    // Close on escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        promptModal?.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Close on overlay click
    const overlay = promptModal?.querySelector('.layout-picker-overlay');
    overlay?.addEventListener('click', () => {
      promptModal?.remove();
    });
  }

  /**
   * Delete custom layout
   */
  private deleteCustomLayout(presetId: string): void {
    if (!confirm('Delete this custom layout?')) return;

    this.layoutManager.deleteCustomLayout(presetId);
    this.renderPresets(); // Re-render to remove deleted layout

    // Show toast
    const toastManager = (window as any).toastManager;
    if (toastManager) {
      toastManager.info('Custom layout deleted', {
        duration: 2000
      });
    }
  }
}
