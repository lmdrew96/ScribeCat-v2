/**
 * ExportDialogs
 *
 * Manages UI dialogs for export operations.
 */

import { ExportFormat, ExportDestination, ExportOptions } from './types.js';
import { getIconHTML } from '../../utils/iconMap.js';

export class ExportDialogs {
  /**
   * Show a dialog to select export format and destination
   */
  static async showExportOptionsDialog(): Promise<ExportOptions | null> {
    return new Promise(async (resolve) => {
      // First, check if Drive is connected
      const driveConnected = await this.isDriveConnected();

      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.className = 'export-dialog-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement('div');
      dialog.className = 'export-dialog';
      dialog.style.cssText = `
        background: var(--background-color, #1e1e1e);
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
      `;

      dialog.innerHTML = `
        <h3 style="margin-top: 0; color: var(--text-color, #fff);">Export Session</h3>

        <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-color, #fff); font-size: 0.9rem;">Select Format:</h4>
        <div class="format-selection" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button class="format-btn" data-format="txt" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            ${getIconHTML('file', { size: 16 })} Plain Text (.txt)
          </button>
          <button class="format-btn" data-format="pdf" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            ${getIconHTML('filePdf', { size: 16 })} PDF Document (.pdf)
          </button>
          <button class="format-btn" data-format="docx" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            ${getIconHTML('fileWord', { size: 16 })} Word Document (.docx)
          </button>
          <button class="format-btn" data-format="html" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            ${getIconHTML('web', { size: 16 })} HTML Page (.html)
          </button>
        </div>

        <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-color, #fff); font-size: 0.9rem;">Select Destination:</h4>
        <div class="destination-selection" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
          <button class="dest-btn" data-destination="local" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            ${getIconHTML('save', { size: 16 })} Save to Computer
          </button>
          <button class="dest-btn" data-destination="drive" ${!driveConnected ? 'disabled' : ''} style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: ${driveConnected ? 'pointer' : 'not-allowed'}; text-align: left; opacity: ${driveConnected ? '1' : '0.5'};">
            ${getIconHTML('cloud', { size: 16 })} Upload to Google Drive${!driveConnected ? ' (Not Connected)' : ''}
          </button>
          <button class="dest-btn" data-destination="both" ${!driveConnected ? 'disabled' : ''} style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: ${driveConnected ? 'pointer' : 'not-allowed'}; text-align: left; opacity: ${driveConnected ? '1' : '0.5'};">
            ${getIconHTML('save', { size: 16 })}${getIconHTML('cloud', { size: 16 })} Save & Upload to Drive${!driveConnected ? ' (Not Connected)' : ''}
          </button>
        </div>

        <button class="cancel-btn" style="padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border-color, #444); border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; width: 100%;">
          Cancel
        </button>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      let selectedFormat: ExportFormat | null = null;
      let selectedDestination: ExportDestination | null = null;

      const updateButtonStates = () => {
        const formatButtons = dialog.querySelectorAll('.format-btn');
        const destButtons = dialog.querySelectorAll('.dest-btn');

        formatButtons.forEach(btn => {
          const format = btn.getAttribute('data-format');
          if (format === selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            (btn as HTMLElement).style.borderLeft = '4px solid var(--accent-color, #00ff00)';
          } else {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            (btn as HTMLElement).style.borderLeft = 'none';
          }
        });

        destButtons.forEach(btn => {
          const destination = btn.getAttribute('data-destination');
          const isDisabled = (btn as HTMLButtonElement).disabled;
          if (!isDisabled && destination === selectedDestination) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            (btn as HTMLElement).style.borderLeft = '4px solid var(--accent-color, #00ff00)';
          } else if (!isDisabled) {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            (btn as HTMLElement).style.borderLeft = 'none';
          }
        });

        // If both are selected, automatically close and resolve
        if (selectedFormat && selectedDestination) {
          setTimeout(() => {
            document.body.removeChild(overlay);
            resolve({ format: selectedFormat!, destination: selectedDestination! });
          }, 200);
        }
      };

      // Add hover effects and click handlers for format buttons
      const formatButtons = dialog.querySelectorAll('.format-btn');
      formatButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          if (btn.getAttribute('data-format') !== selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (btn.getAttribute('data-format') !== selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
          }
        });
        btn.addEventListener('click', () => {
          selectedFormat = btn.getAttribute('data-format') as ExportFormat;
          updateButtonStates();
        });
      });

      // Add hover effects and click handlers for destination buttons
      const destButtons = dialog.querySelectorAll('.dest-btn');
      destButtons.forEach(btn => {
        const isDisabled = (btn as HTMLButtonElement).disabled;
        if (!isDisabled) {
          btn.addEventListener('mouseenter', () => {
            if (btn.getAttribute('data-destination') !== selectedDestination) {
              (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (btn.getAttribute('data-destination') !== selectedDestination) {
              (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            }
          });
          btn.addEventListener('click', () => {
            selectedDestination = btn.getAttribute('data-destination') as ExportDestination;
            updateButtonStates();
          });
        }
      });

      // Cancel button
      const cancelBtn = dialog.querySelector('.cancel-btn');
      cancelBtn?.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      // Click outside to cancel
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  /**
   * Show uploading overlay
   */
  static showUploadingOverlay(message: string = 'Uploading to Google Drive...'): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'export-dialog-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--background-color, #1e1e1e);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    dialog.innerHTML = `
      <div class="upload-progress" style="color: var(--text-color, #fff); font-size: 1.1rem;">
        ${message}
      </div>
      <div style="margin-top: 1rem; color: var(--text-color, #ccc);">
        Please wait...
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    return overlay;
  }

  /**
   * Check if Google Drive is connected
   */
  private static async isDriveConnected(): Promise<boolean> {
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      return result.data || false;
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      return false;
    }
  }
}
