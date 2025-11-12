/**
 * ToolbarIconUpgrader
 *
 * Upgrades toolbar buttons from emoji icons to professional Lucide SVG icons.
 * Run once at app initialization to modernize the UI.
 */

import { createIconHTML, type EditorIconName } from './EditorIcons.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('ToolbarIconUpgrader');

/**
 * Mapping of button IDs to their Lucide icon names
 */
const BUTTON_ICON_MAP: Record<string, EditorIconName> = {
  // Main editor toolbar
  'bold-btn': 'bold',
  'italic-btn': 'italic',
  'underline-btn': 'underline',
  'strike-btn': 'strike',
  'superscript-btn': 'superscript',
  'subscript-btn': 'subscript',
  'color-btn': 'color',
  'bg-color-btn': 'highlight',
  'align-left-btn': 'alignLeft',
  'align-center-btn': 'alignCenter',
  'align-right-btn': 'alignRight',
  'align-justify-btn': 'alignJustify',
  'heading1-btn': 'heading1',
  'heading2-btn': 'heading2',
  'bullet-list-btn': 'bulletList',
  'numbered-list-btn': 'numberedList',
  'link-btn': 'link',
  'image-btn': 'image',
  'anchor-type-btn': 'anchor',
  'wrap-type-btn': 'wrap',
  'insert-table-btn': 'table',
  'undo-btn': 'undo',
  'redo-btn': 'redo',
  'clear-format-btn': 'clearFormat',

  // Panel header actions
  'toggle-toolbar-btn': 'color',
  'clear-notes-btn': 'clearFormat',
  'clear-transcription-btn': 'clearFormat',

  // Top bar actions
  'settings-btn': 'more',
  'study-mode-btn': 'more',
};

/**
 * Upgrade a single button to use Lucide icon
 */
function upgradeButton(button: HTMLElement, iconName: EditorIconName): void {
  try {
    // Find the icon element inside the button
    const iconElement = button.querySelector('.btn-icon');

    if (iconElement) {
      // Replace emoji text with SVG icon
      const svgHTML = createIconHTML(iconName, { size: 18, strokeWidth: 2 });
      iconElement.innerHTML = svgHTML;
      logger.debug(`Upgraded button icon: ${iconName}`);
    } else {
      // If no .btn-icon element, replace entire button content
      const currentHTML = button.innerHTML.trim();

      // Only replace if it's an emoji or single character (basic check)
      if (/[\u{1F600}-\u{1F9FF}]|^[^\w\s]{1,3}$/u.test(currentHTML)) {
        const svgHTML = createIconHTML(iconName, { size: 18, strokeWidth: 2 });
        button.innerHTML = svgHTML;
        logger.debug(`Upgraded button (no .btn-icon): ${iconName}`);
      } else {
        logger.debug(`Skipped button (no emoji): ${button.id || button.className}`);
      }
    }
  } catch (error) {
    logger.error(`Error upgrading button:`, error);
  }
}

/**
 * Upgrade all toolbar buttons in the main editor
 */
export function upgradeMainEditorToolbar(): void {
  logger.info('🎨 Upgrading main editor toolbar icons...');

  let upgraded = 0;
  let notFound = 0;

  for (const [buttonId, iconName] of Object.entries(BUTTON_ICON_MAP)) {
    const button = document.getElementById(buttonId);

    if (button) {
      try {
        upgradeButton(button, iconName);
        upgraded++;
      } catch (error) {
        logger.warn(`Failed to upgrade button ${buttonId}:`, error);
      }
    } else {
      notFound++;
      logger.debug(`Button not found: ${buttonId}`);
    }
  }

  logger.info(`✅ Upgraded ${upgraded} toolbar buttons (${notFound} not found)`);
}

/**
 * Upgrade study mode editor toolbar buttons
 */
export function upgradeStudyModeToolbar(): void {
  logger.info('Upgrading study mode editor toolbar icons...');

  const studyButtonMap: Record<string, EditorIconName> = {
    'study-bold-btn': 'bold',
    'study-italic-btn': 'italic',
    'study-underline-btn': 'underline',
    'study-strike-btn': 'strike',
    'study-superscript-btn': 'superscript',
    'study-subscript-btn': 'subscript',
    'study-color-btn': 'color',
    'study-bg-color-btn': 'highlight',
    'study-align-left-btn': 'alignLeft',
    'study-align-center-btn': 'alignCenter',
    'study-align-right-btn': 'alignRight',
    'study-align-justify-btn': 'alignJustify',
    'study-heading1-btn': 'heading1',
    'study-heading2-btn': 'heading2',
    'study-bullet-list-btn': 'bulletList',
    'study-numbered-list-btn': 'numberedList',
    'study-link-btn': 'link',
    'study-highlight-btn': 'highlight',
    'study-image-btn': 'image',
    'study-table-btn': 'table',
    'study-undo-btn': 'undo',
    'study-redo-btn': 'redo',
    'study-clear-format-btn': 'clearFormat',
  };

  let upgraded = 0;

  for (const [className, iconName] of Object.entries(studyButtonMap)) {
    const buttons = document.querySelectorAll(`.${className}`);

    buttons.forEach(button => {
      try {
        upgradeButton(button as HTMLElement, iconName);
        upgraded++;
      } catch (error) {
        logger.warn(`Failed to upgrade study button ${className}:`, error);
      }
    });
  }

  logger.info(`Upgraded ${upgraded} study mode toolbar buttons`);
}

/**
 * Upgrade all toolbars in the application
 */
export function upgradeAllToolbars(): void {
  logger.info('Starting toolbar icon upgrade...');

  // Upgrade main editor immediately
  upgradeMainEditorToolbar();

  // Watch for study mode toolbar creation (it's dynamically generated)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Check if study mode toolbar was added
          if (node.classList?.contains('study-editor-toolbar') ||
              node.querySelector?.('.study-editor-toolbar')) {
            upgradeStudyModeToolbar();
          }
        }
      }
    }
  });

  // Observe the document for study mode toolbar creation
  observer.observe(document.body, { childList: true, subtree: true });

  logger.info('Toolbar icon upgrade complete');
}

/**
 * Initialize toolbar upgrades on app load
 */
export function initToolbarUpgrades(): void {
  // Upgrade immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', upgradeAllToolbars);
  } else {
    upgradeAllToolbars();
  }
}
